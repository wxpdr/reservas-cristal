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


def test_production_requires_https_and_brevo() -> None:
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

    with pytest.raises(ValidationError, match="Brevo"):
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
        brevo_api_key="test-api-key",
        email_from="reservas@example.com",
    )

    assert settings.brevo_enabled
    assert settings.email_from_name == "Reservas Cristal"


def test_production_rejects_smtp_only() -> None:
    with pytest.raises(ValidationError, match="Brevo"):
        Settings(
            _env_file=None,
            app_environment="production",
            frontend_url="https://reservas.example.com",
            session_cookie_secure=True,
            smtp_host="smtp.example.com",
            smtp_username="user",
            smtp_password="password",
            smtp_from="reservas@example.com",
        )


@pytest.mark.parametrize(
    "values",
    [
        {"brevo_api_key": "test-api-key"},
        {"email_from": "sender@example.com"},
        {"brevo_api_key": "", "email_from": "sender@example.com"},
        {"brevo_api_key": "   ", "email_from": "sender@example.com"},
        {"brevo_api_key": "test-api-key", "email_from": "invalid"},
        {
            "brevo_api_key": "test-api-key",
            "email_from": "sender@example.com",
            "email_from_name": " ",
        },
    ],
)
def test_invalid_brevo_configuration_does_not_expose_key(
    values: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    for name, value in values.items():
        monkeypatch.setenv(name.upper(), value)
    with pytest.raises(ValidationError) as error:
        Settings(_env_file=None)
    assert "test-api-key" not in str(error.value)
