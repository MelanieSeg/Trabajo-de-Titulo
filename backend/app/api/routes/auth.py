from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import User
from app.schemas.auth import LoginRequest, LoginResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(
    credentials: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Login endpoint. Accepts email and password, returns JWT token if valid.

    Validations:
    - User email exists
    - Password is correct
    - User email is verified
    - User status is ACTIVE
    """
    # Normalize email (lowercase and strip whitespace)
    email = credentials.email.lower().strip()

    # Find user by email
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña inválidos",
        )

    # Verify password
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña inválidos",
        )

    # Check if email is verified
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu email no ha sido verificado. Por favor, revisa tu bandeja de entrada.",
        )

    # Check user status
    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tu cuenta está {user.status.lower()}. Contacta al administrador.",
        )

    # Check if user must change password
    if user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Debes cambiar tu contraseña antes de continuar.",
        )

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    # Create access token
    access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        role=user.role,
    )

    # Prepare user response (exclude sensitive data)
    user_response = UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        email_verified=user.email_verified,
        status=user.status,
        role=user.role,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response,
    )
