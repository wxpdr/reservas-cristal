import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_production_requires_secure_cookie() -> None:
    with pytest.raises(ValidationError, match="SESSION_COOKIE_SECURE"):
        Settings(
            _env_file=None,
            app_environment="production",
            database_url="postgresql+psycopg://user:password@db.example.com/app",
            frontend_url="https://reservas.example.com",
            session_cookie_secure=False,
            smtp_host="smtp.example.com",
            smtp_username="user",
            smtp_password="password",
            smtp_from="reservas@example.com",
        )


def test_production_requires_https_and_smtp() -> None:
    with pytest.raises(ValidationError, match="FRONTEND_URL"):
        Settings(
            _env_file=None,
            app_environment="production",
            database_url="postgresql+psycopg://user:password@db.example.com/app",
            frontend_url="http://reservas.example.com",
            session_cookie_secure=True,
            smtp_host="smtp.example.com",
            smtp_username="user",
            smtp_password="password",
            smtp_from="reservas@example.com",
        )

    with pytest.raises(ValidationError, match="SMTP"):
        Settings(
            _env_file=None,
            app_environment="production",
            database_url="postgresql+psycopg://user:password@db.example.com/app",
            frontend_url="https://reservas.example.com",
            session_cookie_secure=True,
        )


def test_valid_production_configuration() -> None:
    settings = Settings(
        _env_file=None,
        app_environment="production",
        database_url="postgresql+psycopg://user:password@db.example.com/app",
        frontend_url="https://reservas.example.com",
        session_cookie_secure=True,
        smtp_host="smtp.example.com",
        smtp_username="user",
        smtp_password="password",
        smtp_from="reservas@example.com",
    )

    assert settings.smtp_enabled
