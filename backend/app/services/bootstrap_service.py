from __future__ import annotations

from pathlib import Path

from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.models import (
    AuditTrailBlock,
    CertifiableReport,
    ComplianceAssessment,
    ComplianceStandard,
    ETLSchedule,
    EfficiencyTarget,
    LegalRequirement,
    MeasurementCertificate,
    MeterCalibration,
    MonthlyConsumption,
    User,
)
from app.db.session import engine
from app.services.alert_service import add_info_alert_if_empty, get_or_create_alert_config, regenerate_anomaly_alerts
from app.services.etl_service import run_etl_from_csv
from app.services.ml_service import train_and_predict
from app.services.platform_service import apply_platform_config_to_db


def init_schema() -> None:
    inspector = inspect(engine)
    # El esquema principal es administrado por db/init.sql.
    # Fallback a la creación de tabla SQLAlchemy solo cuando las tablas principales no existen.
    if "companies" in inspector.get_table_names():
        return
    Base.metadata.create_all(bind=engine)


def run_compat_migrations(db: Session) -> None:
    """Parchar desviaciones de esquema conocidas para implementaciones existentes sin Alembic."""
    db.execute(text("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS role VARCHAR(30) NOT NULL DEFAULT 'USER'"))
    db.execute(text("UPDATE app_users SET role = 'USER' WHERE role IS NULL"))
    db.execute(text("ALTER TABLE alert_configs ADD COLUMN IF NOT EXISTS notify_email BOOLEAN NOT NULL DEFAULT TRUE"))
    db.execute(text("ALTER TABLE alert_configs ADD COLUMN IF NOT EXISTS notify_in_app BOOLEAN NOT NULL DEFAULT TRUE"))
    # Crear únicamente las nuevas tablas de fiscalización si aún no existen.
    Base.metadata.create_all(
        bind=engine,
        tables=[
            ComplianceStandard.__table__,
            LegalRequirement.__table__,
            ComplianceAssessment.__table__,
            CertifiableReport.__table__,
            MeterCalibration.__table__,
            MeasurementCertificate.__table__,
            AuditTrailBlock.__table__,
        ],
    )


def ensure_defaults(db: Session) -> None:
    get_or_create_alert_config(db)

    etl_schedule = db.get(ETLSchedule, 1)
    if not etl_schedule:
        db.add(ETLSchedule(id=1, cron_expression="0 6 1 * *", enabled=True))

    defaults = [
        ("electricity_kwh", 5200.0, "kWh"),
        ("water_m3", 2500.0, "m3"),
        ("co2_avoided_ton", 1.6, "Ton"),
    ]
    for metric_name, target_value, unit in defaults:
        exists = db.scalar(
            select(EfficiencyTarget).where(
                EfficiencyTarget.metric_name == metric_name,
                EfficiencyTarget.unit == unit,
            )
        )
        if not exists:
            db.add(
                EfficiencyTarget(
                    metric_name=metric_name,
                    target_value=target_value,
                    unit=unit,
                )
            )

    # Aplicar configuración en tiempo de ejecución de nivel superior desde app/platform-config.json
    apply_platform_config_to_db(db, force_reload=False)

    # Estándares de referencia para cumplimiento y fiscalización.
    default_standards = [
        {
            "code": "ISO50001",
            "name": "ISO 50001 - Energy Management Systems",
            "version": "2018",
            "description": "Requisitos para establecer, implementar y mejorar un SGE.",
            "source_url": "https://www.iso.org/standard/69426.html",
        },
        {
            "code": "ISO14001",
            "name": "ISO 14001 - Environmental Management Systems",
            "version": "2015",
            "description": "Marco de gestión ambiental orientado a cumplimiento y mejora continua.",
            "source_url": "https://www.iso.org/iso-14001-environmental-management.html",
        },
        {
            "code": "LEGAL-LOCAL-BASE",
            "name": "Marco legal operativo local",
            "version": "2026",
            "description": "Requisitos legales configurables para fiscalización de consumos y riesgos.",
            "source_url": None,
        },
    ]
    standards_by_code: dict[str, ComplianceStandard] = {}
    for payload in default_standards:
        row = db.scalar(select(ComplianceStandard).where(ComplianceStandard.code == payload["code"]))
        if not row:
            row = ComplianceStandard(**payload)
            db.add(row)
            db.flush()
        else:
            row.name = payload["name"]
            row.version = payload["version"]
            row.description = payload["description"]
            row.source_url = payload["source_url"]
            row.is_active = True
        standards_by_code[payload["code"]] = row

    default_requirements = [
        {
            "code": "CL-ELEC-MENSUAL-LIM-001",
            "title": "Límite mensual de consumo eléctrico consolidado",
            "utility": "electricity",
            "metric_name": "electricity_kwh",
            "limit_operator": "<=",
            "limit_value": 7000.0,
            "limit_unit": "kWh",
            "warning_ratio": 0.9,
            "severity_on_breach": "critical",
            "jurisdiction": "CL",
            "legal_reference": "Límite operacional configurable",
            "standard_code": "LEGAL-LOCAL-BASE",
        },
        {
            "code": "CL-AGUA-MENSUAL-LIM-001",
            "title": "Límite mensual de consumo de agua consolidado",
            "utility": "water",
            "metric_name": "water_m3",
            "limit_operator": "<=",
            "limit_value": 3200.0,
            "limit_unit": "m3",
            "warning_ratio": 0.9,
            "severity_on_breach": "critical",
            "jurisdiction": "CL",
            "legal_reference": "Límite operacional configurable",
            "standard_code": "LEGAL-LOCAL-BASE",
        },
    ]

    for payload in default_requirements:
        existing = db.scalar(select(LegalRequirement).where(LegalRequirement.code == payload["code"]))
        standard = standards_by_code.get(payload["standard_code"])
        if existing:
            existing.standard_id = standard.id if standard else None
            existing.title = payload["title"]
            existing.utility = payload["utility"]
            existing.metric_name = payload["metric_name"]
            existing.limit_operator = payload["limit_operator"]
            existing.limit_value = payload["limit_value"]
            existing.limit_unit = payload["limit_unit"]
            existing.warning_ratio = payload["warning_ratio"]
            existing.severity_on_breach = payload["severity_on_breach"]
            existing.jurisdiction = payload["jurisdiction"]
            existing.legal_reference = payload["legal_reference"]
            existing.is_active = True
        else:
            db.add(
                LegalRequirement(
                    standard_id=standard.id if standard else None,
                    code=payload["code"],
                    title=payload["title"],
                    utility=payload["utility"],
                    metric_name=payload["metric_name"],
                    limit_operator=payload["limit_operator"],
                    limit_value=payload["limit_value"],
                    limit_unit=payload["limit_unit"],
                    warning_ratio=payload["warning_ratio"],
                    severity_on_breach=payload["severity_on_breach"],
                    jurisdiction=payload["jurisdiction"],
                    legal_reference=payload["legal_reference"],
                    is_active=True,
                )
            )


def seed_test_user(db: Session) -> None:
    """Crear un usuario de prueba para desarrollo/testing"""
    test_email = "test@ejemplo.com"
    test_user = db.scalar(select(User).where(User.email == test_email))

    if not test_user:
        test_user = User(
            email=test_email,
            password_hash=hash_password("password123"),
            full_name="Usuario de Prueba",
            email_verified=True,
            status="ACTIVE",
            role="ADMIN",
            must_change_password=False,
        )
        db.add(test_user)


def seed_if_empty(db: Session) -> None:
    has_data = db.scalar(select(MonthlyConsumption.id).limit(1))
    if has_data:
        return

    settings = get_settings()
    sample_path = Path(settings.sample_csv_path)
    if not sample_path.exists():
        return

    run_etl_from_csv(db, str(sample_path), source_filename=sample_path.name)
    regenerate_anomaly_alerts(db)
    try:
        train_and_predict(db, horizon_months=3)
    except ValueError:
        # Si no hay suficientes registros después del ETL, continuar con datos de panel básico.
        pass


def bootstrap(db: Session) -> None:
    init_schema()
    run_compat_migrations(db)
    ensure_defaults(db)
    seed_test_user(db)
    seed_if_empty(db)
    regenerate_anomaly_alerts(db)
    add_info_alert_if_empty(db)
