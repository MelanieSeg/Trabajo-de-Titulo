from __future__ import annotations

from datetime import date
from io import BytesIO
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.schemas.api import ResourceCatalogItem, ResourceOverviewResponse
from app.services.activity_service import log_activity
from app.services.resource_report_service import generate_resource_pdf_report
from app.services.resource_service import get_resource_overview, list_resource_catalog

router = APIRouter(prefix="/resources", tags=["resources"])


@router.get("/catalog", response_model=list[ResourceCatalogItem])
def resource_catalog(db: Session = Depends(get_db_session)) -> list[ResourceCatalogItem]:
    rows = list_resource_catalog(db)
    return [ResourceCatalogItem(**item) for item in rows]


@router.get("/{code}/overview", response_model=ResourceOverviewResponse)
def resource_overview(
    code: str,
    months: int = Query(default=12, ge=3, le=36),
    db: Session = Depends(get_db_session),
) -> ResourceOverviewResponse:
    try:
        payload = get_resource_overview(db, code=code, months=months)
        db.commit()
        return ResourceOverviewResponse(**payload)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{code}/report.pdf")
def resource_report_pdf(
    code: str,
    period_type: Literal["monthly", "annual", "range"] = Query(default="annual"),
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db_session),
) -> StreamingResponse:
    """Genera y descarga un reporte PDF para un recurso fiscalizado."""
    try:
        report = generate_resource_pdf_report(
            db,
            code=code,
            period_type=period_type,
            year=year,
            month=month,
            start_date=start_date,
            end_date=end_date,
        )
        log_activity(
            db,
            activity_type="report",
            message=f"Reporte PDF de {code} generado ({period_type})",
            metadata=report["metadata"],
        )
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    headers = {"Content-Disposition": f'attachment; filename="{report["filename"]}"'}
    return StreamingResponse(BytesIO(report["content"]), media_type="application/pdf", headers=headers)
