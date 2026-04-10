from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class LoginRequest(BaseModel):
    """Login request schema with email and password validation"""
    email: EmailStr
    password: str = Field(min_length=1, max_length=255)


class RegisterRequest(BaseModel):
    """Register request schema with strong password validation"""
    full_name: str = Field(min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """
        Validate password requirements:
        - Minimum 8 characters
        - Maximum 100 characters
        - At least one uppercase letter (A-Z)
        - At least one lowercase letter (a-z)
        - At least one digit (0-9)
        - At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
        """
        if not any(c.isupper() for c in v):
            raise ValueError("La contraseña debe contener al menos una mayúscula (A-Z)")

        if not any(c.islower() for c in v):
            raise ValueError("La contraseña debe contener al menos una minúscula (a-z)")

        if not any(c.isdigit() for c in v):
            raise ValueError("La contraseña debe contener al menos un número (0-9)")

        special_chars = set("!@#$%^&*()_+-=[]{}|;:,.<>?")
        if not any(c in special_chars for c in v):
            raise ValueError("La contraseña debe contener al menos un carácter especial (!@#$%^&*()_+-=[]{}|;:,.<>?)")

        return v


class LoginResponse(BaseModel):
    """Login response schema with JWT token"""
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class RegisterResponse(BaseModel):
    """Register response schema"""
    id: int
    email: str
    full_name: str
    status: str
    created_at: datetime
    verification_token: str
    message: str = "Usuario registrado exitosamente. Se envió un enlace de verificación a tu email."


class VerifyEmailResponse(BaseModel):
    """Email verification response schema"""
    message: str
    user_id: int
    email: str
    status: str


class UserResponse(BaseModel):
    """User response schema for API responses"""
    id: int
    email: str
    full_name: Optional[str]
    email_verified: bool
    status: str
    role: str
    last_login_at: Optional[datetime]
    created_at: datetime


class TokenData(BaseModel):
    """Token payload data for JWT"""
    sub: int  # user_id
    email: str
    role: str
    scope: str = "full_access"
    iat: datetime
    exp: datetime
