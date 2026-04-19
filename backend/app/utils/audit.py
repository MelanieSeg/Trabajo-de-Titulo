"""Audit logging for security-related events"""
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.db.models import Activity

logger = logging.getLogger(__name__)


def log_audit_event(
    db: Session,
    user_id: int,
    activity_type: str,
    message: str,
    metadata: dict = None,
) -> None:
    """
    Log an audit event to the database and logger.

    Args:
        db: Database session
        user_id: ID of the user performing the action
        activity_type: Type of activity (PASSWORD_RESET, PASSWORD_CHANGE, etc.)
        message: Human-readable message
        metadata: Additional context as dictionary
    """
    try:
        # Log to application logger
        logger.warning(
            f"AUDIT: {activity_type} - User {user_id}: {message}",
            extra={"metadata": metadata},
        )

        # Log to database
        activity = Activity(
            user_id=user_id,
            activity_type=activity_type,
            message=message,
            metadata=metadata or {},
            created_at=datetime.now(timezone.utc),
        )
        db.add(activity)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to log audit event: {str(e)}")
        # Don't raise, just log the error
