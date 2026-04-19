"""
Audit logging module for security-related events.

This module provides centralized logging for:
- Password resets
- Account changes
- Security events
- User actions

Logs are written to both:
1. Application logs (file/console)
2. Database (ActivityLog table)
"""
import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session

from app.db.models import ActivityLog

logger = logging.getLogger(__name__)


class AuditLogger:
    """Centralized audit logging for security events."""

    @staticmethod
    def log_password_reset(
        db: Session,
        user_id: int,
        user_email: str,
        ip_address: Optional[str] = None,
        success: bool = True,
        error_message: Optional[str] = None,
    ) -> None:
        """
        Log a password reset event to both application logs and database.

        Args:
            db: Database session
            user_id: ID of user whose password was reset
            user_email: Email of user whose password was reset
            ip_address: IP address of the request
            success: Whether the reset was successful
            error_message: Error message if reset failed
        """
        # Determine status
        status = "SUCCESS" if success else "FAILURE"

        # Create log message
        log_message = f"PASSWORD_RESET [{status}] - User: {user_email} (ID: {user_id})"
        if ip_address:
            log_message += f" - IP: {ip_address}"
        if error_message:
            log_message += f" - Error: {error_message}"

        # Log to application logger (WARNING level for security events)
        if success:
            logger.warning(f"🔐 {log_message}")
        else:
            logger.error(f"❌ {log_message}")

        # Log to database
        try:
            activity = ActivityLog(
                user_id=user_id,
                activity_type="PASSWORD_RESET",
                message=f"Password reset {'successful' if success else 'failed'} for {user_email}",
                metadata={
                    "email": user_email,
                    "ip_address": ip_address,
                    "status": status,
                    "error": error_message,
                },
                created_at=datetime.now(timezone.utc),
            )
            db.add(activity)
            db.commit()
            logger.debug(f"Audit log saved to database - {user_email}")
        except Exception as e:
            logger.error(f"Failed to save audit log to database: {str(e)}")
            # Don't raise - audit logging failure shouldn't break the request

    @staticmethod
    def log_forgot_password_request(
        db: Session,
        email: str,
        ip_address: Optional[str] = None,
        user_found: bool = False,
    ) -> None:
        """
        Log a forgot password request.

        Args:
            db: Database session
            email: Email address that was requested
            ip_address: IP address of the request
            user_found: Whether the email exists in the system
        """
        log_message = f"FORGOT_PASSWORD_REQUEST - Email: {email}"
        if ip_address:
            log_message += f" - IP: {ip_address}"
        log_message += f" - User found: {user_found}"

        logger.warning(f"🔑 {log_message}")

        try:
            # Only log if we're within rate limits (we have a user to associate with)
            # For security, we don't store forgot password requests for non-existent users
            if user_found:
                activity = ActivityLog(
                    user_id=None,  # We don't log this to a specific user for security
                    activity_type="FORGOT_PASSWORD_REQUEST",
                    message=f"Password recovery requested for {email}",
                    metadata={
                        "email": email,
                        "ip_address": ip_address,
                        "user_found": user_found,
                    },
                    created_at=datetime.now(timezone.utc),
                )
                db.add(activity)
                db.commit()
        except Exception as e:
            logger.error(f"Failed to save forgot password audit log: {str(e)}")

    @staticmethod
    def log_invalid_reset_attempt(
        db: Session,
        email: Optional[str] = None,
        ip_address: Optional[str] = None,
        reason: str = "invalid_token",
    ) -> None:
        """
        Log failed password reset attempts for security monitoring.

        Args:
            db: Database session
            email: Email if available
            ip_address: IP address of the request
            reason: Why the reset failed (invalid_token, expired_token, etc.)
        """
        log_message = f"INVALID_PASSWORD_RESET - Reason: {reason}"
        if email:
            log_message += f" - Email: {email}"
        if ip_address:
            log_message += f" - IP: {ip_address}"

        logger.warning(f"⚠️ {log_message}")

        try:
            activity = ActivityLog(
                user_id=None,
                activity_type="INVALID_PASSWORD_RESET_ATTEMPT",
                message=f"Failed password reset attempt: {reason}",
                metadata={
                    "email": email,
                    "ip_address": ip_address,
                    "reason": reason,
                },
                created_at=datetime.now(timezone.utc),
            )
            db.add(activity)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to save invalid reset attempt log: {str(e)}")
