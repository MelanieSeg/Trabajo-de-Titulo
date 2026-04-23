from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.schemas.api import ResourceCatalogItem, ResourceOverviewResponse
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
