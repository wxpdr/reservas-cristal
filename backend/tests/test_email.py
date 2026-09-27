import json
from email.message import EmailMessage
from html import escape
from typing import Any

import httpx
import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.services.email import (
    BrevoEmailSender,
    DevelopmentEmailSender,
    EmailDeliveryError,
    SMTPEmailSender,
    get_email_sender,
)


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


@pytest.mark.parametrize("environment", ["development", "test", "production"])
def test_brevo_takes_priority_over_legacy_smtp(
    environment: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("APP_ENVIRONMENT", environment)
    monkeypatch.setenv("BREVO_API_KEY", "test-api-key")
    monkeypatch.setenv("EMAIL_FROM", "sender@example.com")
    settings = Settings(
        _env_file=None,
        frontend_url="https://reservas.example.com",
        session_cookie_secure=True,
        smtp_host="smtp.example.com",
    )
    sender = get_email_sender(settings)
    assert isinstance(sender, BrevoEmailSender)
    assert sender.sender == "sender@example.com"
    assert sender.sender_name == "Reservas Cristal"
    assert "test-api-key" not in repr(settings)
    assert "test-api-key" not in repr(sender)


@pytest.mark.parametrize(
    ("method", "path", "subject", "title", "button_label", "closing_text"),
    [
        (
            "send_first_access",
            "/definir-senha",
            "Convite de primeiro acesso — Reservas Cristal",
            "Bem-vindo(a) ao Reservas Cristal!",
            "Definir minha senha",
            "Se você não esperava receber este convite, pode ignorar este e-mail.",
        ),
        (
            "send_password_reset",
            "/redefinir-senha",
            "Redefinição de senha — Reservas Cristal",
            "Redefinição de senha",
            "Redefinir minha senha",
            "Se você não solicitou a redefinição da senha, nenhuma ação é necessária.",
        ),
    ],
)
def test_brevo_sends_responsive_html_and_plain_text_fallback(
    monkeypatch: pytest.MonkeyPatch,
    method: str,
    path: str,
    subject: str,
    title: str,
    button_label: str,
    closing_text: str,
) -> None:
    link = f'https://reservas.example.com{path}?token=test-token&source="email"'
    requests: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        assert request.method == "POST"
        assert str(request.url) == "https://api.brevo.com/v3/smtp/email"
        assert request.headers["api-key"] == "test-api-key"
        assert request.headers["Content-Type"] == "application/json"
        assert request.headers["Accept"] == "application/json"
        assert all(value == 15.0 for value in request.extensions["timeout"].values())
        payload = json.loads(request.content.decode("utf-8"))
        assert payload["sender"] == {
            "email": "sender@example.com",
            "name": "Cristal Pizza",
        }
        assert payload["to"] == [{"email": "recipient@example.com"}]
        assert payload["subject"] == subject

        text_content = payload["textContent"]
        assert title in text_content
        assert button_label in text_content
        assert link in text_content
        assert "Por segurança, este link é pessoal e possui prazo de validade." in text_content
        assert closing_text in text_content
        assert "Cristal Pizza\nReservas Cristal" in text_content

        html_content = payload["htmlContent"]
        escaped_link = escape(link, quote=True)
        assert '<meta name="viewport"' in html_content
        assert title in html_content
        assert button_label in html_content
        assert f'href="{escaped_link}"' in html_content
        assert html_content.count(escaped_link) == 1
        assert link not in html_content
        assert closing_text in html_content
        assert "Cristal Pizza" in html_content
        assert "Reservas Cristal" in html_content
        return httpx.Response(201, json={"messageId": "test-message"})

    with httpx.Client(transport=httpx.MockTransport(handle)) as client:
        monkeypatch.setattr("app.services.email.httpx.post", client.post)
        sender = BrevoEmailSender("test-api-key", "sender@example.com", "Cristal Pizza")
        getattr(sender, method)("recipient@example.com", link)
    assert len(requests) == 1


@pytest.mark.parametrize("status", [301, 400, 401, 403, 429, 500, 503])
def test_brevo_http_errors_are_sanitized_without_retry_or_redirect(
    monkeypatch: pytest.MonkeyPatch, status: int, caplog: pytest.LogCaptureFixture
) -> None:
    requests: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            status,
            text="sensitive-api-key secret-token",
            headers={"Location": "https://other.example.com"},
        )

    with httpx.Client(transport=httpx.MockTransport(handle)) as client:
        monkeypatch.setattr("app.services.email.httpx.post", client.post)
        sender = BrevoEmailSender("sensitive-api-key", "sender@example.com", "Cristal")
        with pytest.raises(EmailDeliveryError, match=f"HTTP {status}") as error:
            sender.send_first_access(
                "recipient@example.com", "https://example.com?token=secret-token"
            )
    output = str(error.value) + caplog.text
    assert "sensitive-api-key" not in output
    assert "secret-token" not in output
    assert error.value.__cause__ is None
    assert len(requests) == 1


@pytest.mark.parametrize("error_type", [httpx.ConnectError, httpx.ReadTimeout])
def test_brevo_network_errors_are_sanitized(
    monkeypatch: pytest.MonkeyPatch, error_type: type[httpx.RequestError]
) -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        raise error_type("sensitive-api-key secret-token", request=request)

    with httpx.Client(transport=httpx.MockTransport(handle)) as client:
        monkeypatch.setattr("app.services.email.httpx.post", client.post)
        sender = BrevoEmailSender("sensitive-api-key", "sender@example.com", "Cristal")
        with pytest.raises(EmailDeliveryError, match="conectar à Brevo") as error:
            sender.send_password_reset(
                "recipient@example.com", "https://example.com?token=secret-token"
            )
    output = str(error.value)
    assert "sensitive-api-key" not in output
    assert "secret-token" not in output
    assert error.value.__cause__ is None
