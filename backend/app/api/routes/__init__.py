from fastapi import APIRouter

from app.api.routes.actions import router as actions_router
from app.api.routes.auth import router as auth_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.etl import router as etl_router
from app.api.routes.health import router as health_router
from app.api.routes.ml import router as ml_router
from app.api.routes.system import router as system_router

api_router = APIRouter(prefix="/api")
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(dashboard_router)
api_router.include_router(etl_router)
api_router.include_router(ml_router)
api_router.include_router(actions_router)
api_router.include_router(system_router)
