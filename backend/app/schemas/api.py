from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


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


class OperationsUserCreate(BaseModel):
    full_name: str = Field(min_length=3, max_length=120)
    email: EmailStr
    password: str | None = Field(default=None, min_length=8, max_length=100)
    role: str = Field(default="USER", pattern="^[A-Z_]+$")
    status: str = Field(default="ACTIVE", pattern="^[A-Z_]+$")
    email_verified: bool = True


class OperationsSettingsUpdate(BaseModel):
    notify_email: bool | None = None
    notify_in_app: bool | None = None
    electricity_threshold_pct: float | None = Field(default=None, ge=1, le=100)
    water_threshold_pct: float | None = Field(default=None, ge=1, le=100)
    volatility_threshold_pct: float | None = Field(default=None, ge=1, le=100)
    etl_enabled: bool | None = None
    etl_cron_expression: str | None = None


class ComplianceStandardItem(BaseModel):
    id: int
    code: str
    name: str
    version: str | None
    description: str | None
    source_url: str | None
    is_active: bool


class LegalRequirementItem(BaseModel):
    id: int
    code: str
    title: str
    utility: str
    metric_name: str
    limit_operator: str
    limit_value: float
    limit_unit: str
    warning_ratio: float
    severity_on_breach: Literal["critical", "warning", "info"]
    jurisdiction: str | None
    legal_reference: str | None
    standard_code: str | None
    is_active: bool


class LegalRequirementCreate(BaseModel):
    code: str
    title: str
    utility: str
    metric_name: str
    limit_operator: Literal["<=", "<", ">=", ">", "=="] = "<="
    limit_value: float = Field(gt=0)
    limit_unit: str
    warning_ratio: float = Field(default=0.9, ge=0, le=1)
    severity_on_breach: Literal["critical", "warning", "info"] = "critical"
    jurisdiction: str | None = None
    legal_reference: str | None = None
    standard_code: str | None = None


class ComplianceEvaluationItem(BaseModel):
    requirement_id: int
    code: str
    title: str
    utility: str
    metric_name: str
    observed_value: float
    limit_operator: str
    limit_value: float
    unit: str
    status: Literal["compliant", "warning", "breach"]
    risk_level: Literal["low", "medium", "high", "critical"]
    risk_score: float
    legal_reference: str | None


class ComplianceSummaryResponse(BaseModel):
    year: int
    month: int
    month_label: str
    summary: dict[str, int]
    evaluations: list[ComplianceEvaluationItem]


class CertifiableReportMetadata(BaseModel):
    report_code: str
    report_name: str
    report_format: Literal["pdf", "xlsx"]
    year: int
    month: int
    generated_at: datetime
    sha256_hash: str
    digital_signature: str
    verification_token: str


class CalibrationCreate(BaseModel):
    meter_code: str
    meter_name: str
    facility_name: str | None = None
    utility: str = Field(default="electricity")
    performed_by: str
    calibrated_at: datetime
    valid_until: datetime
    notes: str | None = None


class CalibrationItem(BaseModel):
    id: int
    meter_code: str
    meter_name: str
    facility_name: str | None
    utility: str
    calibrated_at: datetime
    valid_until: datetime
    performed_by: str
    status: Literal["valid", "expiring", "expired"]
    certificate_number: str | None


class CalibrationCertificateResponse(BaseModel):
    calibration_id: int
    certificate_number: str
    issued_at: datetime
    expires_at: datetime
    issuer: str
    sha256_hash: str
    digital_signature: str
    payload: dict[str, Any]


class AuditIntegrityResponse(BaseModel):
    valid: bool
    total_blocks: int
    checked_at: datetime
    broken_block_id: int | None = None
    message: str


class ResourceCatalogItem(BaseModel):
    code: str
    name: str
    category: str
    unit: str
    regulatory_body: str | None
    description: str | None


class ResourceOverviewCard(BaseModel):
    label: str
    value: float
    unit: str
    change_pct: float


class ResourceMonthlyPoint(BaseModel):
    year: int
    month: int
    mes: str
    consumo: float
    costo: float


class ResourceAreaPoint(BaseModel):
    area: str
    consumo: float
    percentage: float


class ResourcePredictionPoint(BaseModel):
    year: int
    month: int
    mes: str
    value: float


class ResourceAlertItem(BaseModel):
    id: int
    severity: Literal["critical", "warning", "info"]
    title: str
    description: str
    year: int | None
    month: int | None
    created_at: datetime


class ResourceOverviewResponse(BaseModel):
    resource: ResourceCatalogItem
    cards: list[ResourceOverviewCard]
    monthly: list[ResourceMonthlyPoint]
    areas: list[ResourceAreaPoint]
    predictions: list[ResourcePredictionPoint]
    alerts: list[ResourceAlertItem]


class APIError(BaseModel):
    model_config = ConfigDict(extra="allow")

    detail: str
