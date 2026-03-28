from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.schemas.api import PlatformConfigApplyResponse, PlatformConfigResponse
from app.services.platform_service import apply_platform_config_to_db, get_platform_config

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/platform-config", response_model=PlatformConfigResponse)
def read_platform_config() -> PlatformConfigResponse:
    payload = get_platform_config(force_reload=False)
    return PlatformConfigResponse(**payload)


@router.post("/apply-config", response_model=PlatformConfigApplyResponse)
def apply_platform_config(db: Session = Depends(get_db_session)) -> PlatformConfigApplyResponse:
    payload = apply_platform_config_to_db(db, force_reload=True)
    db.commit()
    return PlatformConfigApplyResponse(**payload)
