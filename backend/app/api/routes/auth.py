from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.rate_limit import limiter
from app.core.security import (
    create_access_token,
    create_email_verification_token,
    hash_password,
    verify_email_token,
    verify_password,
)
from app.db.models import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    UserResponse,
    VerifyEmailResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/15minutes")
def login(
    request: Request,
    credentials: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Login endpoint with rate limiting (5 attempts per 15 minutes per IP).

    Accepts email and password, returns JWT token if valid.

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


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/hour")
def register(
    request: Request,
    payload: RegisterRequest,
    db: Session = Depends(get_db),
):
    """
    Register endpoint with rate limiting (3 attempts per hour per IP).

    Creates a new user account with strong password validation.

    Validations:
    - Email must be unique
    - Password must meet strength requirements:
      * 8-100 characters
      * At least one uppercase letter
      * At least one lowercase letter
      * At least one digit
      * At least one special character
    """
    # Normalize email
    email = payload.email.lower().strip()

    # Check if user already exists
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este correo ya está registrado",
        )

    # Hash password
    password_hash = hash_password(payload.password)

    # Create new user (default: email_verified=False, status=INACTIVE, role=USER)
    new_user = User(
        email=email,
        password_hash=password_hash,
        full_name=payload.full_name,
        email_verified=False,  # Email verification required
        status="INACTIVE",  # User must verify email first
        role="USER",
        must_change_password=False,
        is_active=True,
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al crear la cuenta",
        ) from e

    # Generate email verification token
    verification_token = create_email_verification_token(new_user.id)

    return RegisterResponse(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        status=new_user.status,
        created_at=new_user.created_at,
        verification_token=verification_token,
        message="Usuario registrado exitosamente. Se envió un enlace de verificación a tu email.",
    )


@router.get("/verify-email/{token}", response_model=VerifyEmailResponse)
def verify_email(token: str, db: Session = Depends(get_db)):
    """
    Verify email with token. Activates user account if token is valid.

    Parameters:
    - token: Email verification token from registration

    Returns:
    - Success message if email verified
    - 400 Bad Request if token is invalid or expired
    - 404 Not Found if user not found
    """
    # Verify token and get user_id
    user_id = verify_email_token(token)

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token de verificación inválido o expirado",
        )

    # Find user
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    # Already verified?
    if user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este email ya ha sido verificado",
        )

    # Activate user
    user.email_verified = True
    user.status = "ACTIVE"
    db.commit()

    return VerifyEmailResponse(
        message="Email verificado correctamente. Ahora puedes iniciar sesión.",
        user_id=user.id,
        email=user.email,
        status=user.status,
    )
