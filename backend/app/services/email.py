import logging
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage as SMTPMessage
from typing import Protocol

import httpx
from fastapi import Depends

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class EmailSender(Protocol):
    def send_first_access(self, recipient: str, link: str) -> None: ...

    def send_password_reset(self, recipient: str, link: str) -> None: ...


class DevelopmentEmailSender:
    def send_first_access(self, recipient: str, link: str) -> None:
        logger.info("Convite de primeiro acesso para %s: %s", recipient, link)

    def send_password_reset(self, recipient: str, link: str) -> None:
        logger.info("Recuperação de senha para %s: %s", recipient, link)


class SMTPEmailSender:
    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        sender: str,
    ) -> None:
        self.host = host
        self.port = port
        self.username = username
        self._password = password
        self.sender = sender

    def _send(self, recipient: str, subject: str, introduction: str, link: str) -> None:
        message = SMTPMessage()
        message["Subject"] = subject
        message["From"] = self.sender
        message["To"] = recipient
        message.set_content(
            f"{introduction}\n\n{link}\n\nSe você não solicitou esta mensagem, pode ignorá-la."
        )

        context = ssl.create_default_context()
        with smtplib.SMTP(self.host, self.port, timeout=15) as smtp:
            smtp.ehlo()
            smtp.starttls(context=context)
            smtp.ehlo()
            smtp.login(self.username, self._password)
            smtp.send_message(message)

    def send_first_access(self, recipient: str, link: str) -> None:
        self._send(
            recipient,
            "Convite de primeiro acesso — Reservas Cristal",
            "Você recebeu um convite para acessar o Reservas Cristal. Defina sua senha:",
            link,
        )

    def send_password_reset(self, recipient: str, link: str) -> None:
        self._send(
            recipient,
            "Redefinição de senha — Reservas Cristal",
            "Use o link abaixo para redefinir sua senha no Reservas Cristal:",
            link,
        )


class EmailDeliveryError(RuntimeError):
    """Delivery failure without provider response bodies or sensitive request data."""


class BrevoEmailSender:
    def __init__(self, api_key: str, sender: str, sender_name: str) -> None:
        self._api_key = api_key
        self.sender = sender
        self.sender_name = sender_name

    def _send(self, recipient: str, subject: str, introduction: str, link: str) -> None:
        try:
            response = httpx.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "api-key": self._api_key,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json={
                    "sender": {"email": self.sender, "name": self.sender_name},
                    "to": [{"email": recipient}],
                    "subject": subject,
                    "textContent": (
                        f"{introduction}\n\n{link}\n\n"
                        "Se você não solicitou esta mensagem, pode ignorá-la."
                    ),
                },
                timeout=15.0,
                follow_redirects=False,
            )
        except httpx.RequestError:
            raise EmailDeliveryError(
                "Não foi possível conectar à Brevo para enviar o e-mail."
            ) from None
        if not response.is_success:
            raise EmailDeliveryError(
                f"A Brevo recusou o envio do e-mail (HTTP {response.status_code})."
            )

    def send_first_access(self, recipient: str, link: str) -> None:
        self._send(
            recipient,
            "Convite de primeiro acesso — Reservas Cristal",
            "Você recebeu um convite para acessar o Reservas Cristal. Defina sua senha:",
            link,
        )

    def send_password_reset(self, recipient: str, link: str) -> None:
        self._send(
            recipient,
            "Redefinição de senha — Reservas Cristal",
            "Use o link abaixo para redefinir sua senha no Reservas Cristal:",
            link,
        )


@dataclass
class EmailMessage:
    kind: str
    recipient: str
    link: str


class InMemoryEmailSender:
    def __init__(self) -> None:
        self.messages: list[EmailMessage] = []

    def send_first_access(self, recipient: str, link: str) -> None:
        self.messages.append(EmailMessage("first_access", recipient, link))

    def send_password_reset(self, recipient: str, link: str) -> None:
        self.messages.append(EmailMessage("password_reset", recipient, link))


def get_email_sender(settings: Settings = Depends(get_settings)) -> EmailSender:
    if settings.brevo_enabled:
        assert settings.brevo_api_key is not None
        assert settings.email_from is not None
        return BrevoEmailSender(
            api_key=settings.brevo_api_key.get_secret_value(),
            sender=settings.email_from,
            sender_name=settings.email_from_name,
        )
    if not settings.smtp_enabled:
        return DevelopmentEmailSender()

    assert settings.smtp_host is not None
    assert settings.smtp_username is not None
    assert settings.smtp_password is not None
    assert settings.smtp_from is not None
    return SMTPEmailSender(
        host=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_username,
        password=settings.smtp_password.get_secret_value(),
        sender=settings.smtp_from,
    )
