from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.core.config import get_settings
from app.db.models import ETLSchedule
from app.schemas.api import ETLScheduleResponse, ETLScheduleUpdate, ETLUploadResponse
from app.services.alert_service import regenerate_anomaly_alerts
from app.services.etl_service import run_etl_from_csv
from app.services.ml_service import train_and_predict

router = APIRouter(prefix="/etl", tags=["etl"])


@router.post("/upload", response_model=ETLUploadResponse)
def upload_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db_session),
) -> ETLUploadResponse:
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos CSV.")

    settings = get_settings()
    upload_dir = Path(settings.etl_upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_path = upload_dir / file.filename
    try:
        file_path.write_bytes(file.file.read())
        job = run_etl_from_csv(db, str(file_path), source_filename=file.filename)
        regenerate_anomaly_alerts(db)
        try:
            train_and_predict(db, horizon_months=3)
        except ValueError:
            pass
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return ETLUploadResponse(
        filename=job.source_filename,
        rows_processed=job.rows_processed,
        rows_rejected=job.rows_rejected,
        status=job.status,
        notes=job.notes or "",
    )


@router.get("/schedule", response_model=ETLScheduleResponse)
def get_schedule(db: Session = Depends(get_db_session)) -> ETLScheduleResponse:
    schedule = db.get(ETLSchedule, 1)
    if not schedule:
        schedule = ETLSchedule(id=1, cron_expression="0 6 1 * *", enabled=True)
        db.add(schedule)
        db.commit()
        db.refresh(schedule)

    return ETLScheduleResponse(
        cron_expression=schedule.cron_expression,
        enabled=schedule.enabled,
        updated_at=schedule.updated_at,
    )


@router.post("/schedule", response_model=ETLScheduleResponse)
def update_schedule(payload: ETLScheduleUpdate, db: Session = Depends(get_db_session)) -> ETLScheduleResponse:
    schedule = db.get(ETLSchedule, 1)
    if not schedule:
        schedule = ETLSchedule(id=1)
        db.add(schedule)

    schedule.cron_expression = payload.cron_expression
    schedule.enabled = payload.enabled
    db.commit()
    db.refresh(schedule)

    return ETLScheduleResponse(
        cron_expression=schedule.cron_expression,
        enabled=schedule.enabled,
        updated_at=schedule.updated_at,
    )


@router.post("/run-sample", response_model=ETLUploadResponse)
def run_sample_etl(db: Session = Depends(get_db_session)) -> ETLUploadResponse:
    settings = get_settings()
    sample_path = Path(settings.sample_csv_path)
    if not sample_path.exists():
        raise HTTPException(status_code=404, detail="No existe dataset de ejemplo.")

    try:
        job = run_etl_from_csv(db, str(sample_path), source_filename=sample_path.name)
        regenerate_anomaly_alerts(db)
        train_and_predict(db, horizon_months=3)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return ETLUploadResponse(
        filename=job.source_filename,
        rows_processed=job.rows_processed,
        rows_rejected=job.rows_rejected,
        status=job.status,
        notes=job.notes or "",
    )
