from __future__ import annotations

from pathlib import Path

from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.models import ETLSchedule, EfficiencyTarget, MonthlyConsumption, User
from app.db.session import engine
from app.services.alert_service import add_info_alert_if_empty, get_or_create_alert_config, regenerate_anomaly_alerts
from app.services.etl_service import run_etl_from_csv
from app.services.ml_service import train_and_predict
from app.services.platform_service import apply_platform_config_to_db


def init_schema() -> None:
    inspector = inspect(engine)
    # Primary schema is managed by db/init.sql.
    # Fallback to SQLAlchemy table creation only when core tables do not exist.
    if "companies" in inspector.get_table_names():
        return
    Base.metadata.create_all(bind=engine)


def run_compat_migrations(db: Session) -> None:
    """Patch known schema drifts for existing deployments without Alembic."""
    db.execute(text("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS role VARCHAR(30) NOT NULL DEFAULT 'USER'"))
    db.execute(text("UPDATE app_users SET role = 'USER' WHERE role IS NULL"))
    db.execute(text("ALTER TABLE alert_configs ADD COLUMN IF NOT EXISTS notify_email BOOLEAN NOT NULL DEFAULT TRUE"))
    db.execute(text("ALTER TABLE alert_configs ADD COLUMN IF NOT EXISTS notify_in_app BOOLEAN NOT NULL DEFAULT TRUE"))


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

    # Apply cross-cutting runtime configuration from root-level app/platform-config.json
    apply_platform_config_to_db(db, force_reload=False)


def seed_test_user(db: Session) -> None:
    """Create a test user for development/testing"""
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
        # If there are not enough records after ETL, continue with basic dashboard data.
        pass


def bootstrap(db: Session) -> None:
    init_schema()
    run_compat_migrations(db)
    ensure_defaults(db)
    seed_test_user(db)
    seed_if_empty(db)
    regenerate_anomaly_alerts(db)
    add_info_alert_if_empty(db)
