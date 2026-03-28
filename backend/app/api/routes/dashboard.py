from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.schemas.api import (
    ActivityItem,
    AlertItem,
    DashboardDataResponse,
    DashboardSummaryResponse,
    DistributionItem,
    EfficiencyResponse,
    TimeseriesPoint,
)
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def dashboard_summary(db: Session = Depends(get_db_session)) -> DashboardSummaryResponse:
    return dashboard_service.get_summary(db)


@router.get("/timeseries", response_model=list[TimeseriesPoint])
def dashboard_timeseries(
    months: int = Query(default=12, ge=3, le=36),
    db: Session = Depends(get_db_session),
) -> list[TimeseriesPoint]:
    return dashboard_service.get_timeseries(db, months=months)


@router.get("/distribution", response_model=list[DistributionItem])
def dashboard_distribution(db: Session = Depends(get_db_session)) -> list[DistributionItem]:
    return dashboard_service.get_distribution(db)


@router.get("/alerts", response_model=list[AlertItem])
def dashboard_alerts(
    limit: int = Query(default=4, ge=1, le=20),
    db: Session = Depends(get_db_session),
) -> list[AlertItem]:
    return dashboard_service.get_alerts(db, limit=limit)


@router.get("/activity", response_model=list[ActivityItem])
def dashboard_activity(
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db_session),
) -> list[ActivityItem]:
    return dashboard_service.get_recent_activity(db, limit=limit)


@router.get("/efficiency", response_model=EfficiencyResponse)
def dashboard_efficiency(db: Session = Depends(get_db_session)) -> EfficiencyResponse:
    return dashboard_service.get_efficiency(db)


@router.get("/data", response_model=DashboardDataResponse)
def dashboard_all(
    months: int = Query(default=12, ge=3, le=36),
    alert_limit: int = Query(default=4, ge=1, le=20),
    activity_limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db_session),
) -> DashboardDataResponse:
    return DashboardDataResponse(
        summary=dashboard_service.get_summary(db),
        timeseries=dashboard_service.get_timeseries(db, months=months),
        distribution=dashboard_service.get_distribution(db),
        alerts=dashboard_service.get_alerts(db, limit=alert_limit),
        activity=dashboard_service.get_recent_activity(db, limit=activity_limit),
        efficiency=dashboard_service.get_efficiency(db),
    )
