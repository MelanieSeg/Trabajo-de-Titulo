from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.api.routes import api_router
from app.core.config import get_settings
from app.core.rate_limit import limiter
from app.db.session import SessionLocal
from app.services.bootstrap_service import bootstrap

settings = get_settings()


def split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]

# Middleware para límite de carga
class LimitUploadMiddleware(BaseHTTPMiddleware):
    MAX_BODY_SIZE = 1 * 1024 * 1024  # 1 MB en bytes

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method in ["POST", "PUT", "PATCH"]:
            if "content-length" in request.headers:
                content_length = int(request.headers["content-length"])
                if content_length > self.MAX_BODY_SIZE:
                    return Response("Payload demasiado grande", status_code=413)
        return await call_next(request)

# Middleware para headers de seguridad (Helmet)
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # Protección contra ataques de clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Protección contra MIME-type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Protección contra XSS
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self'; "
            "connect-src 'self' https:; "
            "frame-ancestors 'none'"
        )

        # HSTS (HTTP Strict Transport Security)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions Policy
        response.headers["Permissions-Policy"] = (
            "geolocation=(), "
            "microphone=(), "
            "camera=(), "
            "payment=(), "
            "usb=(), "
            "magnetometer=(), "
            "gyroscope=(), "
            "accelerometer=()"
        )

        return response


@asynccontextmanager
async def lifespan(_: FastAPI):
    db = SessionLocal()
    try:
        bootstrap(db)
        db.commit()
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

# Set up rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Agregar middlewares de seguridad
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(LimitUploadMiddleware)

origins = split_csv(settings.cors_origins)
methods = split_csv(settings.cors_methods) or ["*"]
headers = split_csv(settings.cors_headers) or ["*"]
expose_headers = split_csv(settings.cors_expose_headers)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=methods,
    allow_headers=headers,
    expose_headers=expose_headers,
)

app.include_router(api_router)
