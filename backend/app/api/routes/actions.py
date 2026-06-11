from datetime import date
from io import StringIO

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.db.models import CustomMetric, EfficiencyTarget
from app.schemas.api import (
    ActionResponse,
    AlertConfigResponse,
    AlertConfigUpdate,
    CustomMetricCreate,
    CustomMetricResponse,
    ReportResponse,
    TargetCreate,
    TargetResponse,
)
from app.services.activity_service import log_activity
from app.services.alert_service import get_or_create_alert_config, regenerate_anomaly_alerts, update_alert_config
from app.services.dashboard_service import export_consumption_csv, get_report_for_latest_month

router = APIRouter(tags=["actions"])


@router.get("/reports/monthly", response_model=ReportResponse)
def monthly_report(db: Session = Depends(get_db_session)) -> ReportResponse:
    data = get_report_for_latest_month(db)
    log_activity(db, activity_type="report", message=f"Reporte generado para {data['month_label']}", metadata=data)
    db.commit()
    return ReportResponse(**data)


@router.get("/export/consumption.csv")
def export_consumption(db: Session = Depends(get_db_session)) -> StreamingResponse:
    csv_content = export_consumption_csv(db)
    stream = StringIO(csv_content)
    headers = {"Content-Disposition": "attachment; filename=consumption_export.csv"}

    log_activity(
        db,
        activity_type="export",
        message="Exportación CSV completada",
        metadata={"rows": max(csv_content.count("\n") - 1, 0)},
    )
    db.commit()

    return StreamingResponse(iter([stream.getvalue()]), media_type="text/csv", headers=headers)


@router.get("/alerts/config", response_model=AlertConfigResponse)
def get_alert_configuration(db: Session = Depends(get_db_session)) -> AlertConfigResponse:
    cfg = get_or_create_alert_config(db)
    db.commit()
    db.refresh(cfg)
    return AlertConfigResponse(
        electricity_threshold_pct=cfg.electricity_threshold_pct,
        water_threshold_pct=cfg.water_threshold_pct,
        volatility_threshold_pct=cfg.volatility_threshold_pct,
        updated_at=cfg.updated_at,
    )


@router.post("/alerts/config", response_model=AlertConfigResponse)
def set_alert_configuration(payload: AlertConfigUpdate, db: Session = Depends(get_db_session)) -> AlertConfigResponse:
    cfg = update_alert_config(
        db,
        electricity_threshold_pct=payload.electricity_threshold_pct,
        water_threshold_pct=payload.water_threshold_pct,
        volatility_threshold_pct=payload.volatility_threshold_pct,
    )
    regenerate_anomaly_alerts(db)
    db.commit()
    db.refresh(cfg)
    return AlertConfigResponse(
        electricity_threshold_pct=cfg.electricity_threshold_pct,
        water_threshold_pct=cfg.water_threshold_pct,
        volatility_threshold_pct=cfg.volatility_threshold_pct,
        updated_at=cfg.updated_at,
    )


@router.post("/targets", response_model=TargetResponse)
def define_target(payload: TargetCreate, db: Session = Depends(get_db_session)) -> TargetResponse:
    existing = db.scalar(
        select(EfficiencyTarget).where(
            EfficiencyTarget.metric_name == payload.metric_name,
            EfficiencyTarget.unit == payload.unit,
        )
    )
    if existing:
        existing.target_value = payload.target_value
        target = existing
    else:
        target = EfficiencyTarget(
            metric_name=payload.metric_name,
            target_value=payload.target_value,
            unit=payload.unit,
            start_date=date.today(),
        )
        db.add(target)

    log_activity(
        db,
        activity_type="target",
        message=f"Meta definida para {payload.metric_name}",
        metadata={"target_value": payload.target_value, "unit": payload.unit},
    )
    db.commit()
    db.refresh(target)

    return TargetResponse(
        id=target.id,
        metric_name=target.metric_name,
        target_value=target.target_value,
        unit=target.unit,
    )


@router.post("/metrics/custom", response_model=CustomMetricResponse)
def create_custom_metric(payload: CustomMetricCreate, db: Session = Depends(get_db_session)) -> CustomMetricResponse:
    metric = db.scalar(select(CustomMetric).where(CustomMetric.name == payload.name))
    if metric:
        metric.description = payload.description
        metric.unit = payload.unit
        metric.target_value = payload.target_value
        metric.current_value = payload.current_value
    else:
        metric = CustomMetric(
            name=payload.name,
            description=payload.description,
            unit=payload.unit,
            target_value=payload.target_value,
            current_value=payload.current_value,
        )
        db.add(metric)

    log_activity(
        db,
        activity_type="custom_metric",
        message=f"Métrica personalizada actualizada: {payload.name}",
        metadata={"target_value": payload.target_value, "current_value": payload.current_value},
    )
    db.commit()
    db.refresh(metric)

    return CustomMetricResponse(
        id=metric.id,
        name=metric.name,
        description=metric.description,
        unit=metric.unit,
        target_value=metric.target_value,
        current_value=metric.current_value,
    )


@router.post("/actions/ping", response_model=ActionResponse)
def ping_action() -> ActionResponse:
    return ActionResponse(message="Acción ejecutada correctamente")
