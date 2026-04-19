from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import ValidationError

from app.core.config import get_settings

settings = get_settings()

# Contexto de hash de contraseña usando bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Generar hash de contraseña usando bcrypt"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verificar una contraseña simple contra su hash"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    user_id: int,
    email: str,
    role: str,
    scope: str = "full_access",
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Crear un token de acceso JWT"""
    if expires_delta is None:
        expires_delta = timedelta(hours=settings.jwt_expiration_hours)

    now = datetime.now(timezone.utc)
    expire = now + expires_delta

    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "scope": scope,
        "iat": now.timestamp(),
        "exp": expire.timestamp(),
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
    }

    encoded_jwt = jwt.encode(
        payload,
        settings.secret_key,
        algorithm=settings.jwt_algorithm,
    )
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """Decodificar y validar un token JWT"""
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
        )
        return payload
    except JWTError:
        return None
    except ValidationError:
        return None


def create_email_verification_token(user_id: int) -> str:
    """Crear un token de verificación de email (expira en 24 horas)"""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=24)

    payload = {
        "sub": str(user_id),
        "type": "email_verification",
        "iat": now.timestamp(),
        "exp": expire.timestamp(),
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
    }

    encoded_jwt = jwt.encode(
        payload,
        settings.secret_key,
        algorithm=settings.jwt_algorithm,
    )
    return encoded_jwt


def verify_email_token(token: str) -> Optional[int]:
    """
    Verificar un token de verificación de email y devolver user_id si es válido.
    Devuelve None si el token es inválido o ha expirado.
    """
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
        )

        # Verificar tipo de token
        if payload.get("type") != "email_verification":
            return None

        user_id = int(payload.get("sub"))
        return user_id
    except (JWTError, ValidationError, ValueError):
        return None


def create_password_reset_token(user_id: int, email: str) -> str:
    """Crear un token de restablecimiento de contraseña (expira en 1 hora)"""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=settings.reset_password_token_expire_hours)

    payload = {
        "sub": str(user_id),
        "email": email,
        "type": "password_reset",
        "iat": now.timestamp(),
        "exp": expire.timestamp(),
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
    }

    encoded_jwt = jwt.encode(
        payload,
        settings.secret_key,
        algorithm=settings.jwt_algorithm,
    )
    return encoded_jwt


def verify_password_reset_token(token: str) -> Optional[dict]:
    """
    Verificar un token de restablecimiento de contraseña y devolver user_id y email si es válido.
    Devuelve None si el token es inválido o ha expirado.
    """
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
        )

        # Verificar tipo de token
        if payload.get("type") != "password_reset":
            return None

        user_id = int(payload.get("sub"))
        email = payload.get("email")

        if not email:
            return None

        return {"user_id": user_id, "email": email}
    except (JWTError, ValidationError, ValueError):
        return None
