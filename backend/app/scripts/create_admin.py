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
    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.email == email)) is not None:
            raise SystemExit("Já existe um usuário com este e-mail.")
        user = User(name=args.name.strip(), email=email, role=UserRole.ADMIN, active=True)
        db.add(user)
        db.commit()
        db.refresh(user)
        send_first_access(db, user, get_settings(), get_email_sender())
    print("Administrador criado. Use o link de convite exibido no log acima.")


if __name__ == "__main__":
    main()
