from email.message import EmailMessage
from typing import Any

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.services.email import DevelopmentEmailSender, SMTPEmailSender, get_email_sender


class FakeSMTP:
    def __init__(self, host: str, port: int, timeout: int) -> None:
        self.host = host
        self.port = port
        self.timeout = timeout
        self.ehlo_calls = 0
        self.starttls_called = False
        self.login_credentials: tuple[str, str] | None = None
        self.message: EmailMessage | None = None

    def __enter__(self) -> "FakeSMTP":
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def ehlo(self) -> None:
        self.ehlo_calls += 1

    def starttls(self, *, context: Any) -> None:
        assert context is not None
        self.starttls_called = True

    def login(self, username: str, password: str) -> None:
        self.login_credentials = (username, password)

    def send_message(self, message: EmailMessage) -> None:
        self.message = message


def test_smtp_sender_uses_starttls_authentication_and_configured_sender(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    smtp_instances: list[FakeSMTP] = []

    def fake_smtp(host: str, port: int, timeout: int) -> FakeSMTP:
        instance = FakeSMTP(host, port, timeout)
        smtp_instances.append(instance)
        return instance

    monkeypatch.setattr("app.services.email.smtplib.SMTP", fake_smtp)
    sender = SMTPEmailSender(
        host="smtp.gmail.com",
        port=587,
        username="sender@example.com",
        password="app-password-for-test",
        sender="sender@example.com",
    )
    sender.send_password_reset(
        "recipient@example.com", "http://localhost:3000/redefinir-senha?token=test-token"
    )

    smtp = smtp_instances[0]
    assert (smtp.host, smtp.port, smtp.timeout) == ("smtp.gmail.com", 587, 15)
    assert smtp.ehlo_calls == 2
    assert smtp.starttls_called is True
    assert smtp.login_credentials == ("sender@example.com", "app-password-for-test")
    assert smtp.message is not None
    assert smtp.message["From"] == "sender@example.com"
    assert smtp.message["To"] == "recipient@example.com"
    assert "http://localhost:3000/redefinir-senha" in smtp.message.get_content()


def test_email_sender_uses_development_adapter_without_smtp_configuration() -> None:
    settings = Settings(database_url="sqlite+pysqlite:///:memory:", _env_file=None)
    assert isinstance(get_email_sender(settings), DevelopmentEmailSender)


def test_email_sender_uses_smtp_when_configuration_is_complete() -> None:
    settings = Settings(
        database_url="sqlite+pysqlite:///:memory:",
        smtp_host="smtp.gmail.com",
        smtp_port=587,
        smtp_username="sender@example.com",
        smtp_password="app-password-for-test",
        smtp_from="sender@example.com",
        _env_file=None,
    )
    assert isinstance(get_email_sender(settings), SMTPEmailSender)
    assert "app-password-for-test" not in repr(settings)


def test_partial_smtp_configuration_is_rejected() -> None:
    with pytest.raises(ValidationError, match="devem ser configurados juntos"):
        Settings(
            database_url="sqlite+pysqlite:///:memory:",
            smtp_host="smtp.gmail.com",
            _env_file=None,
        )
