"""Pytest configuration and fixtures"""
import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.api.deps import get_db
from app.main import app


# Use in-memory SQLite for testing
@pytest.fixture(scope="function")
def db():
    """Create a fresh in-memory database for each test"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    db = SessionLocal()

    def override_get_db():
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    yield db

    db.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def cleanup():
    """Clean up after each test"""
    yield
    app.dependency_overrides.clear()
