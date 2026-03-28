from sqlalchemy.orm import Session

from app.db.models import ActivityLog


def log_activity(db: Session, activity_type: str, message: str, metadata: dict | None = None) -> None:
    activity = ActivityLog(
        activity_type=activity_type,
        message=message,
        extra_data=metadata or {},
    )
    db.add(activity)
