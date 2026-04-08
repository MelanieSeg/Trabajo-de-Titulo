from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    """Login request schema with email and password validation"""
    email: EmailStr
    password: str = Field(min_length=1, max_length=255)


class LoginResponse(BaseModel):
    """Login response schema with JWT token"""
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


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
