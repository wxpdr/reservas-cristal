import argparse
import logging

from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import User
from app.models.enums import UserRole
from app.services.auth import normalize_email, send_first_access
from app.services.email import get_email_sender


def main() -> None:
    parser = argparse.ArgumentParser(description="Cria o primeiro administrador por convite")
    parser.add_argument("--name", required=True)
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    email = normalize_email(args.email)
    name = args.name.strip()
    if not name:
        raise SystemExit("O nome do administrador e obrigatorio.")
    settings = get_settings()
    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.email == email)) is not None:
            raise SystemExit("Já existe um usuário com este e-mail.")
        user = User(name=name, email=email, role=UserRole.ADMIN, active=True)
        db.add(user)
        db.commit()
        db.refresh(user)
        send_first_access(db, user, settings, get_email_sender(settings))
    destination = "enviado por e-mail" if settings.smtp_enabled else "exibido no log"
    print(f"Administrador criado. Convite {destination}.")


if __name__ == "__main__":
    main()
