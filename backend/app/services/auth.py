from datetime import timedelta
from urllib.parse import urlencode

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session as DatabaseSession

from app.core.config import Settings
from app.core.security import generate_token, hash_password, hash_token
from app.models.auth import PasswordToken, Session, User
from app.models.base import utc_now
from app.models.enums import PasswordTokenPurpose
from app.services.email import EmailSender


def normalize_email(email: str) -> str:
    return email.strip().lower()


def create_session(db: DatabaseSession, user: User, settings: Settings) -> str:
    raw_token = generate_token()
    db.add(
        Session(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=utc_now() + timedelta(hours=settings.session_ttl_hours),
        )
    )
    db.commit()
    return raw_token


def create_password_token(
    db: DatabaseSession,
    user: User,
    purpose: PasswordTokenPurpose,
    settings: Settings,
) -> str:
    db.execute(
        update(PasswordToken)
        .where(
            PasswordToken.user_id == user.id,
            PasswordToken.purpose == purpose,
            PasswordToken.used_at.is_(None),
        )
        .values(used_at=utc_now())
    )
    raw_token = generate_token()
    db.add(
        PasswordToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            purpose=purpose,
            expires_at=utc_now() + timedelta(hours=settings.password_token_ttl_hours),
        )
    )
    db.commit()
    return raw_token


def send_first_access(
    db: DatabaseSession,
    user: User,
    settings: Settings,
    email_sender: EmailSender,
) -> None:
    token = create_password_token(db, user, PasswordTokenPurpose.FIRST_ACCESS, settings)
    query = urlencode({"token": token})
    email_sender.send_first_access(user.email, f"{settings.frontend_url}/definir-senha?{query}")


def send_password_reset(
    db: DatabaseSession,
    user: User,
    settings: Settings,
    email_sender: EmailSender,
) -> None:
    token = create_password_token(db, user, PasswordTokenPurpose.PASSWORD_RESET, settings)
    query = urlencode({"token": token})
    email_sender.send_password_reset(user.email, f"{settings.frontend_url}/redefinir-senha?{query}")


def consume_password_token(
    db: DatabaseSession,
    raw_token: str,
    password: str,
    purpose: PasswordTokenPurpose,
) -> User | None:
    token = db.scalar(
        select(PasswordToken)
        .where(
            PasswordToken.token_hash == hash_token(raw_token),
            PasswordToken.purpose == purpose,
            PasswordToken.used_at.is_(None),
            PasswordToken.expires_at > utc_now(),
        )
        .with_for_update()
    )
    if token is None:
        return None

    user = db.get(User, token.user_id)
    if user is None or not user.active:
        return None

    user.password_hash = hash_password(password)
    token.used_at = utc_now()
    if purpose == PasswordTokenPurpose.PASSWORD_RESET:
        db.execute(delete(Session).where(Session.user_id == user.id))
    db.commit()
    db.refresh(user)
    return user
