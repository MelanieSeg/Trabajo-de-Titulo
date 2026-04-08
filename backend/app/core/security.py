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
