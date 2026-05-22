from __future__ import annotations

from datetime import datetime, timezone
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
    FuelTransaction,
    LegalRequirement,
    MeasurementCertificate,
    MeterCalibration,
    MonthlyConsumption,
    ResourceAreaDistribution,
    ResourceMonthlyConsumption,
    ResourceType,
    User,
)
from app.db.session import engine
from app.services.alert_service import add_info_alert_if_empty, get_or_create_alert_config, regenerate_anomaly_alerts
from app.services.etl_service import run_etl_from_csv
from app.services.ml_service import train_and_predict
from app.services.platform_service import apply_platform_config_to_db
from app.services.resource_service import ensure_resource_catalog, list_resource_catalog, seed_resource_data


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
            ResourceType.__table__,
            ResourceMonthlyConsumption.__table__,
            ResourceAreaDistribution.__table__,
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
    ensure_resource_catalog(db)

    resource_target_defaults = {
        "gas_natural": 620.0,
        "diesel": 85.0,
        "gasolina": 40.0,
        "glp_propano": 55.0,
        "vapor_termica": 24.0,
        "energia_renovable": 950.0,
        "residuos": 36.0,
        "emisiones_co2e": 3.2,
        "quimicos_consumibles": 90.0,
    }
    for resource in list_resource_catalog(db):
        code = resource["code"]
        unit = resource["unit"]
        exists = db.scalar(
            select(EfficiencyTarget).where(
                EfficiencyTarget.metric_name == code,
                EfficiencyTarget.unit == unit,
            )
        )
        if exists:
            continue
        db.add(
            EfficiencyTarget(
                metric_name=code,
                target_value=resource_target_defaults.get(code, 100.0),
                unit=unit,
            )
        )

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


def _dt(y: int, m: int, d: int) -> datetime:
    return datetime(y, m, d, 8, 0, 0, tzinfo=timezone.utc)


def seed_fuel_transactions(db: Session) -> None:
    """
    Carga transacciones de flota de demostración (idempotente).
    Cubre 17 meses (Ene 2025 – May 2026) con 5 vehículos.
    Viajes normales: 4-5% sobre litros teóricos (bajo umbral del 10%).
    Anomalías en Abr-May 2026: 50-120% sobre teórico (severidad alta).
    Total: 170 registros, todos con fuel_liters_real.
    """
    if db.scalar(select(FuelTransaction.id).limit(1)):
        return

    def _tx(
        vid: str, vcat: str, ft: str,
        year: int, month: int, day: int,
        dist: int, kpl: float, precio: int,
        real: float, notas: str | None = None,
    ) -> FuelTransaction:
        return FuelTransaction(
            vehicle_id=vid, vehicle_cat=vcat, fuel_type=ft,
            fecha=_dt(year, month, day),
            dist_km=float(dist), fuel_liters_real=real,
            km_per_liter=kpl, precio_litro_clp=float(precio),
            notas=notas,
        )

    def _n(dist: int, kpl: float, pct: float = 0.05) -> float:
        """Consumo normal: pct% sobre litros teóricos (dist/kpl)."""
        return round((dist / kpl) * (1.0 + pct), 1)

    txs: list[FuelTransaction] = []

    # ── HISTÓRICO NORMAL: Ene 2025 – Mar 2026  (15 meses × 5 vehículos × 2 viajes = 150) ─
    #
    # Flota:
    #   BCK-4521  Van/Diésel   kpl=13.0  reparto urbano          distancias 360-440 km
    #   GHD-7832  Truck/Diésel kpl=6.0   distribución pesada     distancias 260-340 km
    #   MDW-2341  Bus/Gas Oil  kpl=5.0   transporte de personal  distancias 180-220 km
    #   NTY-9901  Car/Diésel   kpl=15.0  vehículo ejecutivo      distancias 250-300 km
    #   PLX-6634  Van/Diésel   kpl=11.5  reparto carga media     distancias 290-380 km

    for year, month in [(2025, m) for m in range(1, 13)] + [(2026, m) for m in range(1, 4)]:
        odd = month % 2  # alterna distancias para dar variedad mensual

        # BCK-4521
        da, db2 = (380, 420) if odd else (360, 440)
        txs += [
            _tx("BCK-4521", "Van",   "D", year, month,  8, da,  13.0, 1050, _n(da,  13.0, 0.05)),
            _tx("BCK-4521", "Van",   "D", year, month, 22, db2, 13.0, 1050, _n(db2, 13.0, 0.04)),
        ]

        # GHD-7832
        da, db2 = (280, 320) if odd else (260, 340)
        txs += [
            _tx("GHD-7832", "Truck", "D", year, month,  7, da,  6.0,  1050, _n(da,  6.0,  0.05)),
            _tx("GHD-7832", "Truck", "D", year, month, 21, db2, 6.0,  1050, _n(db2, 6.0,  0.04)),
        ]

        # MDW-2341
        da, db2 = (190, 210) if odd else (180, 220)
        txs += [
            _tx("MDW-2341", "Bus",   "G", year, month, 10, da,  5.0,  950,  _n(da,  5.0,  0.04)),
            _tx("MDW-2341", "Bus",   "G", year, month, 24, db2, 5.0,  950,  _n(db2, 5.0,  0.05)),
        ]

        # NTY-9901
        da, db2 = (260, 300) if odd else (250, 290)
        txs += [
            _tx("NTY-9901", "Car",   "D", year, month,  9, da,  15.0, 1050, _n(da,  15.0, 0.05)),
            _tx("NTY-9901", "Car",   "D", year, month, 23, db2, 15.0, 1050, _n(db2, 15.0, 0.04)),
        ]

        # PLX-6634
        da, db2 = (310, 360) if odd else (290, 380)
        txs += [
            _tx("PLX-6634", "Van",   "D", year, month, 11, da,  11.5, 1050, _n(da,  11.5, 0.05)),
            _tx("PLX-6634", "Van",   "D", year, month, 25, db2, 11.5, 1050, _n(db2, 11.5, 0.04)),
        ]

    # ── ABR 2026: inicio de anomalías ──────────────────────────────────────────────────────
    # Desviaciones calculadas sobre litros_teoricos = dist/kpl:
    #   BCK-4521: 400/13=30.8 L  →  62 L  (+101%)  severidad "alta"
    #   GHD-7832: 300/6 =50.0 L  →  95 L  (+90%)   severidad "alta"
    #   MDW-2341: normal en abril
    #   NTY-9901: 290/15=19.3 L  →  42 L  (+117%)  severidad "alta"
    #   PLX-6634: normal en abril

    txs += [
        _tx("BCK-4521","Van",  "D",2026,4, 7,400,13.0,1050, 62.0, "Consumo elevado — posible fuga en inyector"),
        _tx("BCK-4521","Van",  "D",2026,4,21,360,13.0,1050, 56.5, "Consumo superior al predicho — revisar motor"),
        _tx("GHD-7832","Truck","D",2026,4,14,300, 6.0,1050, 95.0, "Filtro obstruido — consumo 90% sobre predicción"),
        _tx("GHD-7832","Truck","D",2026,4,28,280, 6.0,1050, 88.0, "Anomalía persistente — requiere revisión mecánica"),
        _tx("MDW-2341","Bus",  "G",2026,4,10,200, 5.0, 950, _n(200,5.0,0.04)),
        _tx("MDW-2341","Bus",  "G",2026,4,24,210, 5.0, 950, _n(210,5.0,0.05)),
        _tx("NTY-9901","Car",  "D",2026,4, 9,290,15.0,1050, 42.0, "Consumo anómalo — posible uso no autorizado"),
        _tx("NTY-9901","Car",  "D",2026,4,23,270,15.0,1050, _n(270,15.0,0.05)),
        _tx("PLX-6634","Van",  "D",2026,4,11,340,11.5,1050, _n(340,11.5,0.05)),
        _tx("PLX-6634","Van",  "D",2026,4,25,310,11.5,1050, _n(310,11.5,0.04)),
    ]

    # ── MAY 2026: anomalías persistentes + recuperaciones ─────────────────────────────────
    # BCK-4521 persiste en anomalía, segundo viaje ya corregido
    # GHD-7832 persiste en anomalía, segundo viaje ya corregido
    # MDW-2341 ruta extendida en primer viaje (47% desvío = severidad "alta")
    # NTY-9901 recuperado; PLX-6634 normal

    txs += [
        _tx("BCK-4521","Van",  "D",2026,5,12,420,13.0,1050, 64.0, "Anomalía persistente — inyector sin reparar"),
        _tx("BCK-4521","Van",  "D",2026,5,26,380,13.0,1050, _n(380,13.0,0.05), "Recuperado tras mantenimiento correctivo"),
        _tx("GHD-7832","Truck","D",2026,5, 3,280, 6.0,1050, 88.0, "Anomalía persistente — filtro sin reemplazar"),
        _tx("GHD-7832","Truck","D",2026,5,19,310, 6.0,1050, _n(310,6.0,0.05)),
        _tx("MDW-2341","Bus",  "G",2026,5,12,210, 5.0, 950, 62.0, "Consumo elevado — ruta modificada sin autorización"),
        _tx("MDW-2341","Bus",  "G",2026,5,26,190, 5.0, 950, _n(190,5.0,0.04)),
        _tx("NTY-9901","Car",  "D",2026,5, 8,270,15.0,1050, _n(270,15.0,0.05)),
        _tx("NTY-9901","Car",  "D",2026,5,22,260,15.0,1050, _n(260,15.0,0.04)),
        _tx("PLX-6634","Van",  "D",2026,5,11,320,11.5,1050, _n(320,11.5,0.05)),
        _tx("PLX-6634","Van",  "D",2026,5,25,350,11.5,1050, _n(350,11.5,0.04)),
    ]

    for t in txs:
        db.add(t)


def bootstrap(db: Session) -> None:
    init_schema()
    run_compat_migrations(db)
    ensure_defaults(db)
    seed_test_user(db)
    seed_if_empty(db)
    seed_resource_data(db)
    seed_fuel_transactions(db)
    regenerate_anomaly_alerts(db)
    add_info_alert_if_empty(db)
