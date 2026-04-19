"""Tests for authentication endpoints including password reset"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.api.deps import get_db
from app.db.models import User
from app.core.security import hash_password, create_password_reset_token, verify_password_reset_token

client = TestClient(app)


@pytest.fixture
def test_user(db: Session):
    """Create a test user"""
    user = User(
        email="test@example.com",
        password_hash=hash_password("TestPassword123!"),
        full_name="Test User",
        email_verified=True,
        status="ACTIVE",
        role="USER",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


class TestPasswordReset:
    """Test password reset endpoints"""

    def test_forgot_password_with_valid_email(self, test_user):
        """Test forgot-password with valid email"""
        response = client.post(
            "/api/auth/forgot-password",
            json={"email": "test@example.com"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"
        assert "recibirás un enlace" in data["message"]

    def test_forgot_password_with_invalid_email(self):
        """Test forgot-password with non-existent email (should not reveal)"""
        response = client.post(
            "/api/auth/forgot-password",
            json={"email": "nonexistent@example.com"},
        )
        # Should return 200 for security (don't reveal if email exists)
        assert response.status_code == 200
        data = response.json()
        assert "recibirás un enlace" in data["message"]

    def test_forgot_password_with_invalid_email_format(self):
        """Test forgot-password with invalid email format"""
        response = client.post(
            "/api/auth/forgot-password",
            json={"email": "invalid-email"},
        )
        # Should return 422 due to validation
        assert response.status_code == 422

    def test_forgot_password_rate_limiting(self, test_user):
        """Test rate limiting on forgot-password (3 per hour)"""
        for i in range(3):
            response = client.post(
                "/api/auth/forgot-password",
                json={"email": "test@example.com"},
            )
            assert response.status_code == 200

        # 4th request should be rate limited
        response = client.post(
            "/api/auth/forgot-password",
            json={"email": "test@example.com"},
        )
        assert response.status_code == 429  # Too Many Requests

    def test_reset_password_with_valid_token(self, test_user):
        """Test reset-password with valid token"""
        # Create a valid reset token
        reset_token = create_password_reset_token(test_user.id, test_user.email)

        response = client.post(
            "/api/auth/reset-password",
            json={
                "token": reset_token,
                "password": "NewPassword123!",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email
        assert "exitosamente" in data["message"]

    def test_reset_password_with_invalid_token(self):
        """Test reset-password with invalid token"""
        response = client.post(
            "/api/auth/reset-password",
            json={
                "token": "invalid-token",
                "password": "NewPassword123!",
            },
        )
        assert response.status_code == 400
        data = response.json()
        assert "inválido" in data["detail"]

    def test_reset_password_with_weak_password(self, test_user):
        """Test reset-password with weak password"""
        reset_token = create_password_reset_token(test_user.id, test_user.email)

        # Missing uppercase letter
        response = client.post(
            "/api/auth/reset-password",
            json={
                "token": reset_token,
                "password": "weakpassword123!",
            },
        )
        assert response.status_code == 422  # Validation error

    def test_reset_password_rate_limiting(self, test_user):
        """Test rate limiting on reset-password (5 per hour)"""
        reset_token = create_password_reset_token(test_user.id, test_user.email)

        for i in range(5):
            new_token = create_password_reset_token(test_user.id, test_user.email)
            response = client.post(
                "/api/auth/reset-password",
                json={
                    "token": new_token,
                    "password": f"NewPassword{i}123!",
                },
            )
            assert response.status_code in [200, 400]  # 200 success or 400 token error

        # Create another token and try to use it (5th successful request)
        new_token = create_password_reset_token(test_user.id, test_user.email)
        response = client.post(
            "/api/auth/reset-password",
            json={
                "token": new_token,
                "password": "NewPassword5123!",
            },
        )

        # 6th request should be rate limited
        another_token = create_password_reset_token(test_user.id, test_user.email)
        response = client.post(
            "/api/auth/reset-password",
            json={
                "token": another_token,
                "password": "NewPassword6123!",
            },
        )
        assert response.status_code == 429  # Too Many Requests

    def test_password_reset_token_expiration(self, test_user):
        """Test that expired tokens are rejected"""
        from app.core.security import verify_password_reset_token
        from datetime import timedelta
        from app.core.security import jwt, settings
        from datetime import datetime, timezone

        # Create an expired token
        now = datetime.now(timezone.utc)
        expire = now - timedelta(hours=2)  # Expired 2 hours ago

        payload = {
            "sub": str(test_user.id),
            "email": test_user.email,
            "type": "password_reset",
            "iat": now.timestamp(),
            "exp": expire.timestamp(),
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
        }

        expired_token = jwt.encode(
            payload,
            settings.secret_key,
            algorithm=settings.jwt_algorithm,
        )

        response = client.post(
            "/api/auth/reset-password",
            json={
                "token": expired_token,
                "password": "NewPassword123!",
            },
        )
        assert response.status_code == 400
        data = response.json()
        assert "inválido" in data["detail"]

    def test_reset_password_then_login_with_new_password(self, test_user):
        """Test that user can login with new password after reset"""
        # Reset password
        reset_token = create_password_reset_token(test_user.id, test_user.email)

        response = client.post(
            "/api/auth/reset-password",
            json={
                "token": reset_token,
                "password": "NewPassword123!",
            },
        )
        assert response.status_code == 200

        # Try to login with new password
        response = client.post(
            "/api/auth/login",
            json={
                "email": test_user.email,
                "password": "NewPassword123!",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data

        # Try to login with old password (should fail)
        response = client.post(
            "/api/auth/login",
            json={
                "email": test_user.email,
                "password": "TestPassword123!",
            },
        )
        assert response.status_code == 401


class TestTokenGeneration:
    """Test token generation and verification"""

    def test_create_password_reset_token(self, test_user):
        """Test password reset token creation"""
        token = create_password_reset_token(test_user.id, test_user.email)
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0

    def test_verify_password_reset_token(self, test_user):
        """Test password reset token verification"""
        token = create_password_reset_token(test_user.id, test_user.email)
        token_data = verify_password_reset_token(token)

        assert token_data is not None
        assert token_data["user_id"] == test_user.id
        assert token_data["email"] == test_user.email

    def test_verify_invalid_token(self):
        """Test verification of invalid token"""
        token_data = verify_password_reset_token("invalid-token")
        assert token_data is None

    def test_verify_wrong_token_type(self, test_user):
        """Test that email verification token fails password reset verification"""
        from app.core.security import create_email_verification_token

        email_token = create_email_verification_token(test_user.id)
        token_data = verify_password_reset_token(email_token)

        # Should be None because token type is wrong
        assert token_data is None
