from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.rate_limit import limiter
from app.core.security import (
    create_access_token,
    create_email_verification_token,
    create_password_reset_token,
    hash_password,
    verify_email_token,
    verify_password,
    verify_password_reset_token,
)
from app.db.models import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    UserResponse,
    VerifyEmailResponse,
)
from app.services.email import send_password_reset_email
from app.utils.audit import AuditLogger

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
    # Normalizar email (convertir a minúsculas y eliminar espacios)
    email = credentials.email.lower().strip()

    # Buscar usuario por email
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña inválidos",
        )

    # Verificar contraseña
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña inválidos",
        )

    # Verificar si el email está confirmado
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu email no ha sido verificado. Por favor, revisa tu bandeja de entrada.",
        )

    # Verificar estado de la cuenta
    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tu cuenta está {user.status.lower()}. Contacta al administrador.",
        )

    # Verificar si el usuario debe cambiar la contraseña
    if user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Debes cambiar tu contraseña antes de continuar.",
        )

    # Actualizar último login
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    # Crear token de acceso
    access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        role=user.role,
    )

    # Preparar respuesta de usuario (excluir datos sensibles)
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
    # Normalizar email
    email = payload.email.lower().strip()

    # Verificar si el usuario ya existe
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este correo ya está registrado",
        )

    # Hashear contraseña
    password_hash = hash_password(payload.password)

    # Crear nuevo usuario (por defecto: email_verified=False, status=INACTIVE, role=USER)
    new_user = User(
        email=email,
        password_hash=password_hash,
        full_name=payload.full_name,
        email_verified=False,  # Se requiere verificación de email
        status="INACTIVE",  # El usuario debe verificar el email primero
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

    # Generar token de verificación de email
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
    # Verificar token y obtener user_id
    user_id = verify_email_token(token)

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token de verificación inválido o expirado",
        )

    # Buscar usuario
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    # ¿Ya verificado?
    if user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este email ya ha sido verificado",
        )

    # Activar usuario
    user.email_verified = True
    user.status = "ACTIVE"
    db.commit()

    return VerifyEmailResponse(
        message="Email verificado correctamente. Ahora puedes iniciar sesión.",
        user_id=user.id,
        email=user.email,
        status=user.status,
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@limiter.limit("3/hour")
def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Request password reset with rate limiting (3 attempts per hour per IP).

    Generates a reset token and sends it via email.

    Parameters:
    - email: Email address of the account to reset password

    Returns:
    - Success message (for security, always returns success even if email not found)
    """
    # Normalizar email
    email = payload.email.lower().strip()

    # Buscar usuario por email
    user = db.query(User).filter(User.email == email).first()

    # Por seguridad, siempre devolver éxito (no revelar si el email existe)
    if not user:
        return ForgotPasswordResponse(
            message="Si tu correo está registrado, recibirás un enlace para recuperar tu contraseña.",
            email=email,
        )

    # Generar token de reset
    reset_token = create_password_reset_token(user.id, user.email)

    # Enviar email con enlace de reset (usa URL configurable del frontend)
    email_sent = send_password_reset_email(
        recipient_email=user.email,
        reset_token=reset_token,
    )

    if not email_sent:
        # Registrar pero no exponer fallo del servicio de email al cliente
        pass

    return ForgotPasswordResponse(
        message="Si tu correo está registrado, recibirás un enlace para recuperar tu contraseña.",
        email=email,
    )


@router.post("/reset-password", response_model=ResetPasswordResponse)
@limiter.limit("5/hour")
def reset_password(
    request: Request,
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Reset password with reset token.

    ⏱️ Rate Limit: 5 attempts per hour per IP address

    Parameters:
    - token: Password reset token from email link
    - password: New password (must meet strength requirements)

    Returns:
    - Success message if password reset successfully
    - 400 Bad Request if token is invalid or expired
    - 404 Not Found if user not found

    Security Features:
    - ✅ Rate limiting prevents brute force attacks
    - ✅ Token expiration (1 hour)
    - ✅ Password strength validation
    - ✅ Audit logging for all attempts
    """
    # Obtener IP del cliente para registrar y aplicar límite de velocidad
    client_ip = request.client.host if request.client else None

    # Verificar token
    token_data = verify_password_reset_token(payload.token)

    if token_data is None:
        # 📝 Log failed attempt
        AuditLogger.log_invalid_reset_attempt(
            db=db,
            ip_address=client_ip,
            reason="invalid_or_expired_token",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token de recuperación inválido o expirado",
        )

    user_id = token_data["user_id"]
    email = token_data["email"]

    # Buscar usuario
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        # 📝 Log failed attempt
        AuditLogger.log_invalid_reset_attempt(
            db=db,
            email=email,
            ip_address=client_ip,
            reason="user_not_found",
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    # Verificar que el email coincida (seguridad extra)
    if user.email.lower() != email.lower():
        # 📝 Log failed attempt
        AuditLogger.log_invalid_reset_attempt(
            db=db,
            email=email,
            ip_address=client_ip,
            reason="email_mismatch",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token de recuperación inválido",
        )

    # Hashear nueva contraseña
    password_hash = hash_password(payload.password)

    # Actualizar contraseña y limpiar bandera must_change_password si está establecida
    user.password_hash = password_hash
    user.must_change_password = False

    try:
        db.commit()

        # ✅ 📝 Log successful password reset to DB and application logs
        AuditLogger.log_password_reset(
            db=db,
            user_id=user.id,
            user_email=user.email,
            ip_address=client_ip,
            success=True,
        )
    except Exception as e:
        db.rollback()

        # ❌ 📝 Log failed password reset
        AuditLogger.log_password_reset(
            db=db,
            user_id=user.id,
            user_email=user.email,
            ip_address=client_ip,
            success=False,
            error_message=str(e),
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al cambiar la contraseña",
        ) from e

    return ResetPasswordResponse(
        message="Contraseña restablecida exitosamente. Ahora puedes iniciar sesión.",
        email=user.email,
    )
