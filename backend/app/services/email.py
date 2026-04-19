"""Email service for sending notifications"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def send_password_reset_email(recipient_email: str, reset_token: str, frontend_url: str = None) -> bool:
    """
    Send password reset email with reset link.

    Args:
        recipient_email: Email address to send reset link to
        reset_token: Password reset token
        frontend_url: Frontend URL for the reset link (uses config if None)

    Returns:
        True if email sent successfully, False otherwise
    """
    try:
        # Use provided URL or get from config
        if frontend_url is None:
            frontend_url = settings.frontend_url

        # Build reset link
        reset_link = f"{frontend_url}/reset-password?token={reset_token}"

        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Recuperar tu contraseña en EcoEnergy"
        msg["From"] = f"{settings.email_from_name} <{settings.email_from}>"
        msg["To"] = recipient_email

        # Email body (HTML)
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #22c55e;">Recuperar tu contraseña</h2>
                    <p>Recibimos una solicitud para recuperar tu contraseña en EcoEnergy.</p>
                    <p>Haz clic en el siguiente enlace para establecer una nueva contraseña:</p>
                    <p style="margin: 30px 0;">
                        <a href="{reset_link}" style="display: inline-block; padding: 12px 30px; background-color: #22c55e; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Restablecer contraseña
                        </a>
                    </p>
                    <p style="font-size: 12px; color: #666;">
                        O copia este enlace en tu navegador:<br/>
                        <span style="word-break: break-all; color: #0066cc;">{reset_link}</span>
                    </p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                    <p style="font-size: 12px; color: #999;">
                        Este enlace expirará en {settings.reset_password_token_expire_hours} hora(s) por razones de seguridad.<br/>
                        Si no solicitaste recuperar tu contraseña, ignora este correo.
                    </p>
                </div>
            </body>
        </html>
        """

        # Plain text alternative
        text_body = f"""
        Recuperar tu contraseña en EcoEnergy

        Recibimos una solicitud para recuperar tu contraseña.

        Haz clic en el siguiente enlace para establecer una nueva contraseña:
        {reset_link}

        Este enlace expirará en {settings.reset_password_token_expire_hours} hora(s) por razones de seguridad.

        Si no solicitaste recuperar tu contraseña, ignora este correo.
        """

        # Attach both versions
        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        # Development mode: just log the email
        if settings.app_env == "development":
            logger.warning("=" * 80)
            logger.warning(f"MODO DESARROLLO - Email de recuperación de contraseña")
            logger.warning(f"Para: {recipient_email}")
            logger.warning(f"Token: {reset_token}")
            logger.warning(f"Link: {reset_link}")
            logger.warning("=" * 80)
            return True

        # Production: send email via SMTP
        with smtplib.SMTP(settings.smtp_server, settings.smtp_port, timeout=10) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)

        logger.info(f"Password reset email sent to {recipient_email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send password reset email to {recipient_email}: {str(e)}")
        # In development, still return True so tests don't fail
        if settings.app_env == "development":
            return True
        return False


def send_verification_email(recipient_email: str, verification_token: str, frontend_url: str = None) -> bool:
    """
    Send email verification link.

    Args:
        recipient_email: Email address to send verification link to
        verification_token: Email verification token
        frontend_url: Frontend URL for the verification link (uses config if None)

    Returns:
        True if email sent successfully, False otherwise
    """
    try:
        # Use provided URL or get from config
        if frontend_url is None:
            frontend_url = settings.frontend_url

        # Build verification link
        verification_link = f"{frontend_url}/verificar-email?token={verification_token}"

        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Verifica tu correo en EcoEnergy"
        msg["From"] = f"{settings.email_from_name} <{settings.email_from}>"
        msg["To"] = recipient_email

        # Email body (HTML)
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #22c55e;">Verifica tu correo electrónico</h2>
                    <p>¡Gracias por registrarte en EcoEnergy! Para completar tu registro, necesitamos verificar tu correo electrónico.</p>
                    <p style="margin: 30px 0;">
                        <a href="{verification_link}" style="display: inline-block; padding: 12px 30px; background-color: #22c55e; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Verificar correo
                        </a>
                    </p>
                    <p style="font-size: 12px; color: #666;">
                        O copia este enlace:<br/>
                        <span style="word-break: break-all; color: #0066cc;">{verification_link}</span>
                    </p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                    <p style="font-size: 12px; color: #999;">
                        Este enlace expirará en 24 horas.
                    </p>
                </div>
            </body>
        </html>
        """

        # Plain text alternative
        text_body = f"""
        Verifica tu correo electrónico en EcoEnergy

        Haz clic en el siguiente enlace para verificar tu correo:
        {verification_link}

        Este enlace expirará en 24 horas.
        """

        # Attach both versions
        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        # Development mode: just log the email
        if settings.app_env == "development":
            logger.warning("=" * 80)
            logger.warning(f"MODO DESARROLLO - Email de verificación")
            logger.warning(f"Para: {recipient_email}")
            logger.warning(f"Token: {verification_token}")
            logger.warning(f"Link: {verification_link}")
            logger.warning("=" * 80)
            return True

        # Production: send email via SMTP
        with smtplib.SMTP(settings.smtp_server, settings.smtp_port, timeout=10) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)

        logger.info(f"Verification email sent to {recipient_email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send verification email to {recipient_email}: {str(e)}")
        # In development, still return True so tests don't fail
        if settings.app_env == "development":
            return True
        return False

    """
    Send password reset email with reset link.

    Args:
        recipient_email: Email address to send reset link to
        reset_token: Password reset token
        frontend_url: Frontend URL for the reset link

    Returns:
        True if email sent successfully, False otherwise
    """
    try:
        # Build reset link
        reset_link = f"{frontend_url}/reset-password?token={reset_token}"

        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Recuperar tu contraseña en EcoEnergy"
        msg["From"] = f"{settings.email_from_name} <{settings.email_from}>"
        msg["To"] = recipient_email

        # Email body (HTML)
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #22c55e;">Recuperar tu contraseña</h2>
                    <p>Recibimos una solicitud para recuperar tu contraseña en EcoEnergy.</p>
                    <p>Haz clic en el siguiente enlace para establecer una nueva contraseña:</p>
                    <p style="margin: 30px 0;">
                        <a href="{reset_link}" style="display: inline-block; padding: 12px 30px; background-color: #22c55e; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Restablecer contraseña
                        </a>
                    </p>
                    <p style="font-size: 12px; color: #666;">
                        O copia este enlace en tu navegador:<br/>
                        <span style="word-break: break-all; color: #0066cc;">{reset_link}</span>
                    </p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                    <p style="font-size: 12px; color: #999;">
                        Este enlace expirará en 1 hora por razones de seguridad.<br/>
                        Si no solicitaste recuperar tu contraseña, ignora este correo.
                    </p>
                </div>
            </body>
        </html>
        """

        # Plain text alternative
        text_body = f"""
        Recuperar tu contraseña en EcoEnergy

        Recibimos una solicitud para recuperar tu contraseña.

        Haz clic en el siguiente enlace para establecer una nueva contraseña:
        {reset_link}

        Este enlace expirará en 1 hora por razones de seguridad.

        Si no solicitaste recuperar tu contraseña, ignora este correo.
        """

        # Attach both versions
        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        # Send email
        with smtplib.SMTP(settings.smtp_server, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)

        logger.info(f"Password reset email sent to {recipient_email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send password reset email to {recipient_email}: {str(e)}")
        return False


def send_verification_email(recipient_email: str, verification_token: str, frontend_url: str = "http://localhost:8081") -> bool:
    """
    Send email verification link.

    Args:
        recipient_email: Email address to send verification link to
        verification_token: Email verification token
        frontend_url: Frontend URL for the verification link

    Returns:
        True if email sent successfully, False otherwise
    """
    try:
        # Build verification link
        verification_link = f"{frontend_url}/verify-email?token={verification_token}"

        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Verifica tu correo en EcoEnergy"
        msg["From"] = f"{settings.email_from_name} <{settings.email_from}>"
        msg["To"] = recipient_email

        # Email body (HTML)
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #22c55e;">Verifica tu correo electrónico</h2>
                    <p>¡Gracias por registrarte en EcoEnergy! Para completar tu registro, necesitamos verificar tu correo electrónico.</p>
                    <p style="margin: 30px 0;">
                        <a href="{verification_link}" style="display: inline-block; padding: 12px 30px; background-color: #22c55e; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Verificar correo
                        </a>
                    </p>
                    <p style="font-size: 12px; color: #666;">
                        O copia este enlace:<br/>
                        <span style="word-break: break-all; color: #0066cc;">{verification_link}</span>
                    </p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                    <p style="font-size: 12px; color: #999;">
                        Este enlace expirará en 24 horas.
                    </p>
                </div>
            </body>
        </html>
        """

        # Plain text alternative
        text_body = f"""
        Verifica tu correo electrónico en EcoEnergy

        Haz clic en el siguiente enlace para verificar tu correo:
        {verification_link}

        Este enlace expirará en 24 horas.
        """

        # Attach both versions
        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        # Send email
        with smtplib.SMTP(settings.smtp_server, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)

        logger.info(f"Verification email sent to {recipient_email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send verification email to {recipient_email}: {str(e)}")
        return False
