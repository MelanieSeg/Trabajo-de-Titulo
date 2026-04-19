from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class LoginRequest(BaseModel):
    """Esquema de solicitud de login con validación de email y contraseña"""
    email: EmailStr
    password: str = Field(min_length=1, max_length=255)


class RegisterRequest(BaseModel):
    """Esquema de solicitud de registro con validación de contraseña fuerte"""
    full_name: str = Field(min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """
        Validar requisitos de contraseña:
        - Mínimo 8 caracteres
        - Máximo 100 caracteres
        - Al menos una letra mayúscula (A-Z)
        - Al menos una letra minúscula (a-z)
        - Al menos un dígito (0-9)
        - Al menos un carácter especial (!@#$%^&*()_+-=[]{}|;:,.<>?)
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
    """Esquema de respuesta de login con token JWT"""
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class RegisterResponse(BaseModel):
    """Esquema de respuesta de registro"""
    id: int
    email: str
    full_name: str
    status: str
    created_at: datetime
    verification_token: str
    message: str = "Usuario registrado exitosamente. Se envió un enlace de verificación a tu email."


class VerifyEmailResponse(BaseModel):
    """Esquema de respuesta de verificación de email"""
    message: str
    user_id: int
    email: str
    status: str


class UserResponse(BaseModel):
    """Esquema de respuesta de usuario para respuestas de API"""
    id: int
    email: str
    full_name: Optional[str]
    email_verified: bool
    status: str
    role: str
    last_login_at: Optional[datetime]
    created_at: datetime


class TokenData(BaseModel):
    """Datos de carga del token para JWT"""
    sub: int  # user_id
    email: str
    role: str
    scope: str = "full_access"
    iat: datetime
    exp: datetime


class ForgotPasswordRequest(BaseModel):
    """Esquema de solicitud de contraseña olvidada"""
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    """Esquema de respuesta de contraseña olvidada"""
    message: str
    email: str


class ResetPasswordRequest(BaseModel):
    """Esquema de solicitud de restablecimiento de contraseña con validación de contraseña fuerte"""
    token: str = Field(min_length=1, max_length=1000)
    password: str = Field(min_length=8, max_length=100)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """
        Validar requisitos de contraseña:
        - Mínimo 8 caracteres
        - Máximo 100 caracteres
        - Al menos una letra mayúscula (A-Z)
        - Al menos una letra minúscula (a-z)
        - Al menos un dígito (0-9)
        - Al menos un carácter especial (!@#$%^&*()_+-=[]{}|;:,.<>?)
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


class ResetPasswordResponse(BaseModel):
    """Esquema de respuesta de restablecimiento de contraseña"""
    message: str
    email: str
