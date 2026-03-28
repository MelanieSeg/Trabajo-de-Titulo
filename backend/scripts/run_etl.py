from pathlib import Path

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.services.alert_service import regenerate_anomaly_alerts
from app.services.etl_service import run_etl_from_csv
from app.services.ml_service import train_and_predict


def main() -> None:
    settings = get_settings()
    sample_path = Path(settings.sample_csv_path)

    db = SessionLocal()
    try:
        job = run_etl_from_csv(db, str(sample_path), source_filename=sample_path.name)
        regenerate_anomaly_alerts(db)
        train_and_predict(db, horizon_months=3)
        db.commit()
        print(f"ETL completado: {job.rows_processed} filas procesadas")
    finally:
        db.close()


if __name__ == "__main__":
    main()
