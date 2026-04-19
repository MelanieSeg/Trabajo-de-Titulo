from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import ValidationError

from app.core.config import get_settings

settings = get_settings()

# Pasword hashing context using bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    user_id: int,
    email: str,
    role: str,
    scope: str = "full_access",
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a JWT access token"""
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
    """Decode and validate a JWT token"""
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
    """Create an email verification token (expires in 24 hours)"""
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
    Verify an email verification token and return user_id if valid.
    Returns None if token is invalid or expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
        )

        # Check token type
        if payload.get("type") != "email_verification":
            return None

        user_id = int(payload.get("sub"))
        return user_id
    except (JWTError, ValidationError, ValueError):
        return None


def create_password_reset_token(user_id: int, email: str) -> str:
    """Create a password reset token (expires in 1 hour)"""
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
    Verify a password reset token and return user_id and email if valid.
    Returns None if token is invalid or expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
        )

        # Check token type
        if payload.get("type") != "password_reset":
            return None

        user_id = int(payload.get("sub"))
        email = payload.get("email")

        if not email:
            return None

        return {"user_id": user_id, "email": email}
    except (JWTError, ValidationError, ValueError):
        return None
