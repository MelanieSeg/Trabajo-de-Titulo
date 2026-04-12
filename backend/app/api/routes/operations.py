from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.schemas.api import OperationsSettingsUpdate, OperationsUserCreate
from app.services import operations_service

router = APIRouter(prefix="/operations", tags=["operations"])


@router.get("/overview", response_model=dict[str, Any])
def operations_overview(db: Session = Depends(get_db_session)) -> dict[str, Any]:
    return operations_service.get_operations_overview(db)


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
