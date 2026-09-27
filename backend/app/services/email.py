import logging
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage as SMTPMessage
from html import escape
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

    def _send(
        self,
        recipient: str,
        subject: str,
        title: str,
        paragraphs: tuple[str, ...],
        button_label: str,
        security_text: str,
        closing_text: str,
        link: str,
    ) -> None:
        text_content = "\n\n".join(
            (
                title,
                *paragraphs,
                f"{button_label}: {link}",
                security_text,
                closing_text,
                "Cristal Pizza\nReservas Cristal",
            )
        )
        escaped_link = escape(link, quote=True)
        paragraphs_html = "".join(
            f'<p style="margin:0 0 16px;color:#4a504b;font-size:16px;line-height:1.6;">'
            f"{escape(paragraph)}</p>"
            for paragraph in paragraphs
        )
        card_style = (
            "width:100%;max-width:600px;background:#ffffff;"
            "border:1px solid #e3ddd4;border-radius:16px;"
        )
        brand_style = (
            "margin:0 0 24px;color:#a64f43;font-size:14px;font-weight:700;letter-spacing:.04em;"
        )
        title_style = "margin:0 0 20px;color:#252b27;font-size:26px;line-height:1.25;"
        button_style = (
            "display:inline-block;padding:14px 22px;color:#ffffff;"
            "text-decoration:none;font-size:16px;font-weight:700;"
        )
        info_style = "margin:0 0 12px;color:#727870;font-size:14px;line-height:1.6;"
        closing_style = "margin:0;color:#727870;font-size:14px;line-height:1.6;"
        footer_style = (
            "padding:20px 28px;border-top:1px solid #e3ddd4;"
            "color:#727870;font-size:13px;line-height:1.5;"
        )
        html_content = f"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
    style="width:100%;background:#f6f3ee;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
          style="{card_style}">
          <tr>
            <td style="padding:32px 28px;">
              <p style="{brand_style}">RESERVAS CRISTAL</p>
              <h1 style="{title_style}">{escape(title)}</h1>
              {paragraphs_html}
              <table role="presentation" cellspacing="0" cellpadding="0" border="0"
                style="margin:28px 0;">
                <tr>
                  <td style="border-radius:10px;background:#a64f43;">
                    <a href="{escaped_link}" style="{button_style}">
                      {escape(button_label)}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="{info_style}">{escape(security_text)}</p>
              <p style="{closing_style}">{escape(closing_text)}</p>
            </td>
          </tr>
          <tr>
            <td style="{footer_style}">
              <strong style="color:#252b27;">Cristal Pizza</strong><br>
              Reservas Cristal
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
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
                    "textContent": text_content,
                    "htmlContent": html_content,
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
            "Bem-vindo(a) ao Reservas Cristal!",
            (
                "Seu acesso ao sistema de reservas da Cristal Pizza foi criado.",
                "Para começar, defina sua senha clicando no botão abaixo.",
            ),
            "Definir minha senha",
            "Por segurança, este link é pessoal e possui prazo de validade.",
            "Se você não esperava receber este convite, pode ignorar este e-mail.",
            link,
        )

    def send_password_reset(self, recipient: str, link: str) -> None:
        self._send(
            recipient,
            "Redefinição de senha — Reservas Cristal",
            "Redefinição de senha",
            ("Recebemos uma solicitação para redefinir a senha da sua conta no Reservas Cristal.",),
            "Redefinir minha senha",
            "Por segurança, este link é pessoal e possui prazo de validade.",
            "Se você não solicitou a redefinição da senha, nenhuma ação é necessária.",
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
