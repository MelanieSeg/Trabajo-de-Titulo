from typing import Any, Literal

from datetime import date
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.schemas.api import OperationsSettingsUpdate, OperationsUserCreate
from app.services import operations_service
from app.services.activity_service import log_activity
from app.services.utility_report_service import generate_utility_pdf_report

router = APIRouter(prefix="/operations", tags=["operations"])


@router.get("/overview", response_model=dict[str, Any])
def operations_overview(
    months: int = Query(default=12, ge=3, le=36),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    return operations_service.get_operations_overview(db, months=months)


@router.post("/alerts/{alert_id}/resolve", response_model=dict[str, Any])
def resolve_alert(alert_id: int, db: Session = Depends(get_db_session)) -> dict[str, Any]:
    try:
        payload = operations_service.resolve_alert(db, alert_id)
        db.commit()
        return payload
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/alerts/resolve-all", response_model=dict[str, Any])
def resolve_all_alerts(db: Session = Depends(get_db_session)) -> dict[str, Any]:
    payload = operations_service.resolve_all_alerts(db)
    db.commit()
    return payload


@router.post("/users", response_model=dict[str, Any], status_code=status.HTTP_201_CREATED)
def create_user(payload: OperationsUserCreate, db: Session = Depends(get_db_session)) -> dict[str, Any]:
    try:
        response = operations_service.create_user(
            db,
            full_name=payload.full_name,
            email=payload.email,
            password=payload.password,
            role=payload.role,
            status=payload.status,
            email_verified=payload.email_verified,
        )
        db.commit()
        return response
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/settings", response_model=dict[str, Any])
def update_settings(payload: OperationsSettingsUpdate, db: Session = Depends(get_db_session)) -> dict[str, Any]:
    result = operations_service.update_settings(db, payload.model_dump(exclude_none=True))
    db.commit()
    return result


@router.get("/reports/utility.pdf")
def download_utility_report_pdf(
    utility: Literal["electricity", "water"] = Query(...),
    period_type: Literal["monthly", "annual", "range"] = Query(default="monthly"),
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db_session),
) -> StreamingResponse:
    try:
        report = generate_utility_pdf_report(
            db,
            utility=utility,
            period_type=period_type,
            year=year,
            month=month,
            start_date=start_date,
            end_date=end_date,
        )
        log_activity(
            db,
            activity_type="report",
            message=f"Reporte PDF de {utility} generado ({period_type})",
            metadata=report["metadata"],
        )
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    headers = {"Content-Disposition": f'attachment; filename="{report["filename"]}"'}
    return StreamingResponse(BytesIO(report["content"]), media_type="application/pdf", headers=headers)
