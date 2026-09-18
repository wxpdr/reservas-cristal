import logging
from dataclasses import dataclass
from typing import Protocol

logger = logging.getLogger(__name__)


class EmailSender(Protocol):
    def send_first_access(self, recipient: str, link: str) -> None: ...

    def send_password_reset(self, recipient: str, link: str) -> None: ...


class DevelopmentEmailSender:
    def send_first_access(self, recipient: str, link: str) -> None:
        logger.info("Convite de primeiro acesso para %s: %s", recipient, link)

    def send_password_reset(self, recipient: str, link: str) -> None:
        logger.info("Recuperação de senha para %s: %s", recipient, link)


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


email_sender: EmailSender = DevelopmentEmailSender()


def get_email_sender() -> EmailSender:
    return email_sender
