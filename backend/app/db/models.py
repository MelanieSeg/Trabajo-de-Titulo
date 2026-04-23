from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "app_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False)
    role: Mapped[str] = mapped_column(String(30), default="USER", nullable=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    industry: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    facilities: Mapped[list[Facility]] = relationship("Facility", back_populates="company", cascade="all, delete-orphan")


class Facility(Base):
    __tablename__ = "facilities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    region: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("company_id", "name", name="uq_facility_company_name"),)

    company: Mapped[Company] = relationship("Company", back_populates="facilities")
    consumptions: Mapped[list[MonthlyConsumption]] = relationship(
        "MonthlyConsumption",
        back_populates="facility",
        cascade="all, delete-orphan",
    )


class MonthlyConsumption(Base):
    __tablename__ = "monthly_consumptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    facility_id: Mapped[int] = mapped_column(ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)

    electricity_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    water_m3: Mapped[float] = mapped_column(Float, nullable=False)
    electricity_cost_usd: Mapped[float] = mapped_column(Float, nullable=False)
    water_cost_usd: Mapped[float] = mapped_column(Float, nullable=False)
    co2_avoided_ton: Mapped[float] = mapped_column(Float, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("facility_id", "year", "month", name="uq_monthly_consumption"),
        CheckConstraint("month >= 1 AND month <= 12", name="ck_month_range"),
    )

    facility: Mapped[Facility] = relationship("Facility", back_populates="consumptions")
    distributions: Mapped[list[AreaDistribution]] = relationship(
        "AreaDistribution",
        back_populates="monthly_consumption",
        cascade="all, delete-orphan",
    )


class AreaDistribution(Base):
    __tablename__ = "area_distributions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    monthly_consumption_id: Mapped[int] = mapped_column(
        ForeignKey("monthly_consumptions.id", ondelete="CASCADE"),
        nullable=False,
    )
    area_name: Mapped[str] = mapped_column(String(80), nullable=False)
    percentage: Mapped[float] = mapped_column(Float, nullable=False)

    __table_args__ = (UniqueConstraint("monthly_consumption_id", "area_name", name="uq_month_area"),)

    monthly_consumption: Mapped[MonthlyConsumption] = relationship("MonthlyConsumption", back_populates="distributions")


class MLPrediction(Base):
    __tablename__ = "ml_predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    scope: Mapped[str] = mapped_column(String(50), nullable=False, default="global")
    utility: Mapped[str] = mapped_column(String(30), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    predicted_value: Mapped[float] = mapped_column(Float, nullable=False)
    model_name: Mapped[str] = mapped_column(String(80), nullable=False, default="RandomForestRegressor")
    validation_mae: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("scope", "utility", "year", "month", name="uq_prediction_scope_utility_month"),)


class SmartAlert(Base):
    __tablename__ = "smart_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    utility: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    month: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    extra_data: Mapped[dict] = mapped_column("metadata", JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AlertConfig(Base):
    __tablename__ = "alert_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    electricity_threshold_pct: Mapped[float] = mapped_column(Float, nullable=False, default=20.0)
    water_threshold_pct: Mapped[float] = mapped_column(Float, nullable=False, default=18.0)
    volatility_threshold_pct: Mapped[float] = mapped_column(Float, nullable=False, default=15.0)
    notify_email: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notify_in_app: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class EfficiencyTarget(Base):
    __tablename__ = "efficiency_targets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    metric_name: Mapped[str] = mapped_column(String(80), nullable=False)
    target_value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(30), nullable=False)
    start_date: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("metric_name", "unit", name="uq_efficiency_target_metric_unit"),)


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    activity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(String(255), nullable=False)
    extra_data: Mapped[dict] = mapped_column("metadata", JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ETLJob(Base):
    __tablename__ = "etl_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source_filename: Mapped[str] = mapped_column(String(180), nullable=False)
    rows_processed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rows_rejected: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="completed")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    finished_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ETLSchedule(Base):
    __tablename__ = "etl_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    cron_expression: Mapped[str] = mapped_column(String(64), nullable=False, default="0 6 1 * *")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class CustomMetric(Base):
    __tablename__ = "custom_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    unit: Mapped[str] = mapped_column(String(30), nullable=False)
    target_value: Mapped[float] = mapped_column(Float, nullable=False)
    current_value: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ComplianceStandard(Base):
    __tablename__ = "compliance_standards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    version: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class LegalRequirement(Base):
    __tablename__ = "legal_requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    standard_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("compliance_standards.id", ondelete="SET NULL"),
        nullable=True,
    )
    code: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    utility: Mapped[str] = mapped_column(String(30), nullable=False)
    metric_name: Mapped[str] = mapped_column(String(80), nullable=False)
    limit_operator: Mapped[str] = mapped_column(String(8), nullable=False, default="<=")
    limit_value: Mapped[float] = mapped_column(Float, nullable=False)
    limit_unit: Mapped[str] = mapped_column(String(30), nullable=False)
    warning_ratio: Mapped[float] = mapped_column(Float, nullable=False, default=0.9)
    severity_on_breach: Mapped[str] = mapped_column(String(20), nullable=False, default="critical")
    jurisdiction: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    legal_reference: Mapped[Optional[str]] = mapped_column(String(180), nullable=True)
    effective_from: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)
    effective_to: Mapped[Optional[Date]] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("warning_ratio >= 0 AND warning_ratio <= 1", name="ck_legal_requirements_warning_ratio"),
        CheckConstraint(
            "severity_on_breach IN ('critical', 'warning', 'info')",
            name="ck_legal_requirements_severity",
        ),
    )


class ComplianceAssessment(Base):
    __tablename__ = "compliance_assessments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    requirement_id: Mapped[int] = mapped_column(
        ForeignKey("legal_requirements.id", ondelete="CASCADE"),
        nullable=False,
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    observed_value: Mapped[float] = mapped_column(Float, nullable=False)
    limit_value: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    details: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("requirement_id", "year", "month", name="uq_compliance_assessment_req_period"),
        CheckConstraint("month >= 1 AND month <= 12", name="ck_compliance_assessment_month"),
        CheckConstraint("year >= 2000 AND year <= 2100", name="ck_compliance_assessment_year"),
        CheckConstraint(
            "status IN ('compliant', 'warning', 'breach')",
            name="ck_compliance_assessment_status",
        ),
        CheckConstraint(
            "risk_level IN ('low', 'medium', 'high', 'critical')",
            name="ck_compliance_assessment_risk_level",
        ),
    )


class CertifiableReport(Base):
    __tablename__ = "certifiable_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    report_code: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    report_name: Mapped[str] = mapped_column(String(180), nullable=False)
    report_format: Mapped[str] = mapped_column(String(16), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    digital_signature: Mapped[str] = mapped_column(String(128), nullable=False)
    timestamp_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    generated_by: Mapped[str] = mapped_column(String(120), nullable=False, default="system")
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("month >= 1 AND month <= 12", name="ck_certifiable_report_month"),
        CheckConstraint("year >= 2000 AND year <= 2100", name="ck_certifiable_report_year"),
        CheckConstraint("report_format IN ('pdf', 'xlsx')", name="ck_certifiable_report_format"),
    )


class MeterCalibration(Base):
    __tablename__ = "meter_calibrations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    meter_code: Mapped[str] = mapped_column(String(80), nullable=False)
    meter_name: Mapped[str] = mapped_column(String(120), nullable=False)
    facility_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    utility: Mapped[str] = mapped_column(String(30), nullable=False)
    calibrated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    valid_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    performed_by: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="valid")
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "status IN ('valid', 'expiring', 'expired')",
            name="ck_meter_calibrations_status",
        ),
    )


class MeasurementCertificate(Base):
    __tablename__ = "measurement_certificates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    calibration_id: Mapped[int] = mapped_column(
        ForeignKey("meter_calibrations.id", ondelete="CASCADE"),
        nullable=False,
    )
    certificate_number: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    issuer: Mapped[str] = mapped_column(String(120), nullable=False)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    digital_signature: Mapped[str] = mapped_column(String(128), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AuditTrailBlock(Base):
    __tablename__ = "audit_trail_blocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    entity_type: Mapped[str] = mapped_column(String(60), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(120), nullable=False)
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    previous_hash: Mapped[str] = mapped_column(String(64), nullable=False, default="GENESIS")
    block_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    digital_signature: Mapped[str] = mapped_column(String(128), nullable=False)
    actor: Mapped[str] = mapped_column(String(120), nullable=False, default="system")
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("entity_type", "entity_id", "action", "payload_hash", name="uq_audit_trail_block_event"),
    )
