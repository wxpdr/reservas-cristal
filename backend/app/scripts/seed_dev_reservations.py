"""Popula manualmente a agenda DEV com reservas fictícias para validação visual."""

import argparse
from dataclasses import dataclass
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session as DatabaseSession

from app.db.session import SessionLocal
from app.models import Reservation, User
from app.models.enums import ReservationOrigin, ReservationStatus
from app.schemas.reservation import ReservationCreate
from app.services.reservations import (
    cancel_reservation,
    check_in_reservation,
    confirm_reservation,
    create_reservation,
)

DEV_TIMEZONE = ZoneInfo("America/Sao_Paulo")


@dataclass(frozen=True)
class DevReservation:
    customer_name: str
    phone: str
    party_size: int
    reservation_time: time
    origin: ReservationOrigin
    notes: str | None
    target_status: ReservationStatus
    cancellation_reason: str | None = None


DEV_RESERVATIONS = (
    DevReservation(
        "Mariana Souza",
        "(00) 90000-0001",
        4,
        time(18, 0),
        ReservationOrigin.PHONE,
        None,
        ReservationStatus.SCHEDULED,
    ),
    DevReservation(
        "Carlos Almeida",
        "(00) 90000-0002",
        2,
        time(18, 30),
        ReservationOrigin.WHATSAPP,
        "Comemoração de aniversário.",
        ReservationStatus.CONFIRMED,
    ),
    DevReservation(
        "Juliana Santos",
        "(00) 90000-0003",
        5,
        time(19, 0),
        ReservationOrigin.IN_PERSON,
        (
            "Cliente pediu uma mesa em local mais tranquilo, longe da entrada "
            "e com espaço para carrinho de bebê."
        ),
        ReservationStatus.ARRIVED,
    ),
    DevReservation(
        "Roberto Lima",
        "(00) 90000-0004",
        3,
        time(19, 0),
        ReservationOrigin.TAGME,
        None,
        ReservationStatus.CANCELLED,
        "Cancelamento fictício para validação visual.",
    ),
    DevReservation(
        "Grupo Empresa Aurora",
        "(00) 90000-0005",
        24,
        time(19, 30),
        ReservationOrigin.OTHER,
        "Grupo corporativo; prefere mesas próximas e melhor circulação no salão.",
        ReservationStatus.SCHEDULED,
    ),
    DevReservation(
        "Fernanda Costa",
        "(00) 90000-0006",
        6,
        time(20, 15),
        ReservationOrigin.PHONE,
        None,
        ReservationStatus.CONFIRMED,
    ),
    DevReservation(
        "Beatriz Nascimento",
        "(00) 90000-0007",
        1,
        time(21, 0),
        ReservationOrigin.WHATSAPP,
        "Aguardar na recepção.",
        ReservationStatus.SCHEDULED,
    ),
    DevReservation(
        "Lucas Ferreira",
        "(00) 90000-0008",
        8,
        time(22, 0),
        ReservationOrigin.IN_PERSON,
        "Reserva fictícia do último horário da agenda.",
        ReservationStatus.ARRIVED,
    ),
)


def current_dev_date() -> date:
    return datetime.now(DEV_TIMEZONE).date()


def seed_dev_reservations(
    db: DatabaseSession, user: User, reservation_date: date
) -> tuple[int, int]:
    phones = [item.phone for item in DEV_RESERVATIONS]
    existing_phones = set(
        db.scalars(
            select(Reservation.phone).where(
                Reservation.reservation_date == reservation_date,
                Reservation.phone.in_(phones),
            )
        )
    )
    created = 0

    for item in DEV_RESERVATIONS:
        if item.phone in existing_phones:
            continue

        reservation = create_reservation(
            db,
            ReservationCreate(
                customer_name=item.customer_name,
                phone=item.phone,
                party_size=item.party_size,
                reservation_date=reservation_date,
                reservation_time=item.reservation_time,
                origin=item.origin,
                notes=item.notes,
            ),
            user,
        )
        if item.target_status == ReservationStatus.CONFIRMED:
            confirm_reservation(db, reservation.id, user)
        elif item.target_status == ReservationStatus.ARRIVED:
            check_in_reservation(db, reservation.id, user)
        elif item.target_status == ReservationStatus.CANCELLED:
            cancel_reservation(db, reservation.id, item.cancellation_reason, user)
        created += 1

    return created, len(DEV_RESERVATIONS) - created


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ferramenta DEV manual para popular a Agenda do Dia com dados fictícios."
    )
    parser.add_argument(
        "--confirm-dev",
        action="store_true",
        help="Confirma conscientemente a inserção de dados fictícios no banco configurado.",
    )
    args = parser.parse_args()
    if not args.confirm_dev:
        raise SystemExit("Execução cancelada: informe --confirm-dev para popular o banco DEV.")

    reservation_date = current_dev_date()
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.active.is_(True)).order_by(User.created_at))
        if user is None:
            raise SystemExit("Nenhum usuário ativo disponível para atribuir a auditoria do seed.")
        created, skipped = seed_dev_reservations(db, user, reservation_date)

        status_counts = db.execute(
            select(Reservation.status, func.count())
            .where(
                Reservation.reservation_date == reservation_date,
                Reservation.phone.in_([item.phone for item in DEV_RESERVATIONS]),
            )
            .group_by(Reservation.status)
        ).all()

    counts = ", ".join(f"{status.value}={count}" for status, count in status_counts)
    print(f"Seed DEV concluído para {reservation_date.isoformat()}.")
    print(f"Criadas: {created}. Já existentes: {skipped}.")
    print(f"Estados: {counts}.")


if __name__ == "__main__":
    main()
