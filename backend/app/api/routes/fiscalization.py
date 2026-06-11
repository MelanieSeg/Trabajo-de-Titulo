from io import BytesIO
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.db.models import ComplianceStandard, LegalRequirement
from app.schemas.api import (
    AuditIntegrityResponse,
    CalibrationCertificateResponse,
    CalibrationCreate,
    CalibrationItem,
    CertifiableReportMetadata,
    ComplianceEvaluationItem,
    ComplianceStandardItem,
    ComplianceSummaryResponse,
    LegalRequirementCreate,
    LegalRequirementItem,
)
from app.services import fiscalization_service

router = APIRouter(prefix="/fiscalizacion", tags=["fiscalizacion"])


def _requirements_to_items(
    requirements: list[LegalRequirement],
    standards: list[ComplianceStandard],
) -> list[LegalRequirementItem]:
    standards_by_id = {row.id: row.code for row in standards}
    payload: list[LegalRequirementItem] = []
    for req in requirements:
        payload.append(
            LegalRequirementItem(
                id=req.id,
                code=req.code,
                title=req.title,
                utility=req.utility,
                metric_name=req.metric_name,
                limit_operator=req.limit_operator,
                limit_value=req.limit_value,
                limit_unit=req.limit_unit,
                warning_ratio=req.warning_ratio,
                severity_on_breach=req.severity_on_breach if req.severity_on_breach in {"critical", "warning", "info"} else "warning",
                jurisdiction=req.jurisdiction,
                legal_reference=req.legal_reference,
                standard_code=standards_by_id.get(req.standard_id),
                is_active=req.is_active,
            )
        )
    return payload


@router.get("/standards", response_model=list[ComplianceStandardItem])
def list_standards(db: Session = Depends(get_db_session)) -> list[ComplianceStandardItem]:
    rows = fiscalization_service.list_standards(db)
    return [
        ComplianceStandardItem(
            id=row.id,
            code=row.code,
            name=row.name,
            version=row.version,
            description=row.description,
            source_url=row.source_url,
            is_active=row.is_active,
        )
        for row in rows
    ]


@router.get("/requirements", response_model=list[LegalRequirementItem])
def list_requirements(
    active_only: bool = Query(default=True),
    db: Session = Depends(get_db_session),
) -> list[LegalRequirementItem]:
    rows = fiscalization_service.list_legal_requirements(db, active_only=active_only)
    standards = fiscalization_service.list_standards(db)
    return _requirements_to_items(rows, standards)


@router.post("/requirements", response_model=LegalRequirementItem)
def upsert_requirement(payload: LegalRequirementCreate, db: Session = Depends(get_db_session)) -> LegalRequirementItem:
    row = fiscalization_service.upsert_legal_requirement(db, payload.model_dump())
    db.commit()
    standards = fiscalization_service.list_standards(db)
    return _requirements_to_items([row], standards)[0]


@router.get("/compliance/summary", response_model=ComplianceSummaryResponse)
def compliance_summary(
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db_session),
) -> ComplianceSummaryResponse:
    payload = fiscalization_service.evaluate_compliance(db, year=year, month=month, create_alerts=False)
    return ComplianceSummaryResponse(
        year=payload["year"],
        month=payload["month"],
        month_label=payload["month_label"],
        summary=payload["summary"],
        evaluations=[ComplianceEvaluationItem(**item) for item in payload["evaluations"]],
    )


@router.post("/compliance/evaluate", response_model=ComplianceSummaryResponse)
def evaluate_compliance(
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db_session),
) -> ComplianceSummaryResponse:
    payload = fiscalization_service.evaluate_compliance(db, year=year, month=month, create_alerts=True)
    db.commit()
    return ComplianceSummaryResponse(
        year=payload["year"],
        month=payload["month"],
        month_label=payload["month_label"],
        summary=payload["summary"],
        evaluations=[ComplianceEvaluationItem(**item) for item in payload["evaluations"]],
    )


@router.get("/reports/certifiable", response_model=CertifiableReportMetadata)
def generate_certifiable_report_metadata(
    report_format: Literal["pdf", "xlsx"] = Query(default="pdf"),
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db_session),
) -> CertifiableReportMetadata:
    result = fiscalization_service.generate_certifiable_report(
        db,
        report_format=report_format,
        year=year,
        month=month,
        generated_by="api",
    )
    db.commit()
    return CertifiableReportMetadata(**result["metadata"])


@router.get("/reports/certifiable/download")
def download_certifiable_report(
    report_format: Literal["pdf", "xlsx"] = Query(default="pdf"),
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db_session),
) -> StreamingResponse:
    result = fiscalization_service.generate_certifiable_report(
        db,
        report_format=report_format,
        year=year,
        month=month,
        generated_by="api",
    )
    db.commit()
    headers = {
        "Content-Disposition": f"attachment; filename={result['filename']}",
        "X-Report-Code": result["metadata"]["report_code"],
        "X-Report-Hash": result["metadata"]["sha256_hash"],
        "X-Report-Signature": result["metadata"]["digital_signature"],
    }
    return StreamingResponse(BytesIO(result["bytes"]), media_type=result["mime"], headers=headers)


@router.get("/reports/history", response_model=list[CertifiableReportMetadata])
def report_history(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db_session),
) -> list[CertifiableReportMetadata]:
    rows = fiscalization_service.list_report_history(db, limit=limit)
    return [CertifiableReportMetadata(**item) for item in rows]


@router.get("/calibrations", response_model=list[CalibrationItem])
def list_calibrations(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db_session),
) -> list[CalibrationItem]:
    rows = fiscalization_service.list_calibrations(db, limit=limit)
    return [CalibrationItem(**item) for item in rows]


@router.post("/calibrations", response_model=CalibrationItem)
def create_calibration(payload: CalibrationCreate, db: Session = Depends(get_db_session)) -> CalibrationItem:
    if payload.valid_until <= payload.calibrated_at:
        raise HTTPException(status_code=400, detail="La fecha de vigencia debe ser posterior a la calibracion.")
    item = fiscalization_service.create_calibration(db, payload.model_dump())
    db.commit()
    return CalibrationItem(**item)


@router.get("/calibrations/{calibration_id}/certificate", response_model=CalibrationCertificateResponse)
def calibration_certificate(calibration_id: int, db: Session = Depends(get_db_session)) -> CalibrationCertificateResponse:
    try:
        payload = fiscalization_service.get_calibration_certificate(db, calibration_id)
        return CalibrationCertificateResponse(**payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/audit/chain/verify", response_model=AuditIntegrityResponse)
def verify_audit_chain(db: Session = Depends(get_db_session)) -> AuditIntegrityResponse:
    payload = fiscalization_service.verify_audit_chain(db)
    return AuditIntegrityResponse(**payload)


@router.get("/audit/logs/export")
def export_logs(
    export_format: Literal["csv", "json"] = Query(default="csv"),
    db: Session = Depends(get_db_session),
) -> StreamingResponse:
    content = fiscalization_service.export_activity_logs(db, export_format=export_format)
    db.commit()
    media_type = "application/json" if export_format == "json" else "text/csv"
    filename = f"audit_logs.{export_format}"
    return StreamingResponse(
        BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/audit/chain/export")
def export_chain(
    export_format: Literal["csv", "json"] = Query(default="csv"),
    db: Session = Depends(get_db_session),
) -> StreamingResponse:
    content = fiscalization_service.export_audit_chain(db, export_format=export_format)
    db.commit()
    media_type = "application/json" if export_format == "json" else "text/csv"
    filename = f"audit_chain.{export_format}"
    return StreamingResponse(
        BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/raw")
def export_raw_data(
    export_format: Literal["json", "zip"] = Query(default="zip"),
    db: Session = Depends(get_db_session),
) -> StreamingResponse:
    if export_format == "json":
        content = fiscalization_service.export_raw_data_json(db)
        media_type = "application/json"
        filename = "raw_data_auditable.json"
    else:
        content = fiscalization_service.export_raw_data_zip(db)
        media_type = "application/zip"
        filename = "raw_data_auditable.zip"
    db.commit()
    return StreamingResponse(
        BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
