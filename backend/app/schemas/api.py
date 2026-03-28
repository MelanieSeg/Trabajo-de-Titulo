from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class SummaryMetric(BaseModel):
    title: str
    value: float
    unit: str
    change_pct: float


class DashboardSummaryResponse(BaseModel):
    latest_month_label: str
    metrics: list[SummaryMetric]
    open_alerts: int


class TimeseriesPoint(BaseModel):
    year: int
    month: int
    label: str
    electricity_kwh: Optional[float]
    water_m3: Optional[float]
    predicted_electricity_kwh: Optional[float]
    predicted_water_m3: Optional[float]


class DistributionItem(BaseModel):
    name: str
    value: float


class AlertItem(BaseModel):
    id: int
    severity: Literal["critical", "warning", "info"]
    title: str
    description: str
    utility: Optional[str]
    year: Optional[int]
    month: Optional[int]
    created_at: datetime


class ActivityItem(BaseModel):
    id: int
    activity_type: str
    message: str
    created_at: datetime
    metadata: dict[str, Any]


class EfficiencyItem(BaseModel):
    label: str
    value: float
    target: float


class EfficiencyResponse(BaseModel):
    score: float
    items: list[EfficiencyItem]


class DashboardDataResponse(BaseModel):
    summary: DashboardSummaryResponse
    timeseries: list[TimeseriesPoint]
    distribution: list[DistributionItem]
    alerts: list[AlertItem]
    activity: list[ActivityItem]
    efficiency: EfficiencyResponse


class ETLUploadResponse(BaseModel):
    filename: str
    rows_processed: int
    rows_rejected: int
    status: str
    notes: str


class ETLScheduleUpdate(BaseModel):
    cron_expression: str = Field(default="0 6 1 * *")
    enabled: bool = True


class ETLScheduleResponse(BaseModel):
    cron_expression: str
    enabled: bool
    updated_at: datetime


class MLTrainRequest(BaseModel):
    horizon_months: int = Field(default=3, ge=1, le=12)


class MLPredictionItem(BaseModel):
    utility: str
    year: int
    month: int
    value: float


class MLTrainResponse(BaseModel):
    model: str
    trained_records: int
    validation_mae: dict[str, float]
    predictions: list[MLPredictionItem]


class AlertConfigUpdate(BaseModel):
    electricity_threshold_pct: float = Field(ge=1, le=100)
    water_threshold_pct: float = Field(ge=1, le=100)
    volatility_threshold_pct: float = Field(ge=1, le=100)


class AlertConfigResponse(BaseModel):
    electricity_threshold_pct: float
    water_threshold_pct: float
    volatility_threshold_pct: float
    updated_at: datetime


class TargetCreate(BaseModel):
    metric_name: str
    target_value: float = Field(gt=0)
    unit: str


class TargetResponse(BaseModel):
    id: int
    metric_name: str
    target_value: float
    unit: str


class CustomMetricCreate(BaseModel):
    name: str
    description: str
    unit: str
    target_value: float = Field(gt=0)
    current_value: float = Field(gt=0)


class CustomMetricResponse(BaseModel):
    id: int
    name: str
    description: str
    unit: str
    target_value: float
    current_value: float


class ReportResponse(BaseModel):
    month_label: str
    total_electricity_kwh: float
    total_water_m3: float
    total_cost_usd: float
    highlights: list[str]


class ActionResponse(BaseModel):
    message: str


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


class PlatformConfigResponse(BaseModel):
    source: str
    path: str
    loaded_at: datetime
    config: dict[str, Any]


class PlatformConfigApplyResponse(BaseModel):
    source: str
    path: str
    loaded_at: datetime
    company_name: str
    created_company: bool
    targets_upserted: int
    cron_expression: str
    etl_enabled: bool
    alert_thresholds: dict[str, float]


class APIError(BaseModel):
    model_config = ConfigDict(extra="allow")

    detail: str
