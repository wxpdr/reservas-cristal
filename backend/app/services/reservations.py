from datetime import date, datetime, time
from enum import Enum
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session as DatabaseSession

from app.models import Reservation, ReservationEvent, User
from app.models.base import utc_now
from app.models.enums import ReservationAction, ReservationStatus
from app.schemas.reservation import ReservationCreate, ReservationUpdate


class ReservationNotFoundError(Exception):
    pass


class InvalidReservationTransitionError(Exception):
    pass


def _json_value(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, date | datetime | time):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    return value


def _snapshot(reservation: Reservation) -> dict[str, Any]:
    fields = (
        "customer_name",
        "phone",
        "party_size",
        "reservation_date",
        "reservation_time",
        "origin",
        "table_label",
        "notes",
        "status",
        "confirmed_at",
        "checked_in_at",
        "cancelled_at",
        "cancellation_reason",
    )
    return {field: _json_value(getattr(reservation, field)) for field in fields}


def _add_event(
    db: DatabaseSession,
    reservation: Reservation,
    user: User,
    action: ReservationAction,
    changes: dict[str, Any] | None,
) -> None:
    db.add(
        ReservationEvent(
            reservation_id=reservation.id,
            user_id=user.id,
            action=action,
            changes=changes,
        )
    )


def _get_for_update(db: DatabaseSession, reservation_id: UUID) -> Reservation:
    reservation = db.scalar(
        select(Reservation).where(Reservation.id == reservation_id).with_for_update()
    )
    if reservation is None:
        raise ReservationNotFoundError
    return reservation


def create_reservation(db: DatabaseSession, payload: ReservationCreate, user: User) -> Reservation:
    reservation = Reservation(
        **payload.model_dump(),
        status=ReservationStatus.SCHEDULED,
        created_by=user.id,
        updated_by=user.id,
    )
    db.add(reservation)
    db.flush()
    _add_event(
        db,
        reservation,
        user,
        ReservationAction.CREATE,
        {"after": _snapshot(reservation)},
    )
    db.commit()
    db.refresh(reservation)
    return reservation


def get_reservation(db: DatabaseSession, reservation_id: UUID) -> Reservation:
    reservation = db.get(Reservation, reservation_id)
    if reservation is None:
        raise ReservationNotFoundError
    return reservation


def list_reservations_by_date(db: DatabaseSession, reservation_date: date) -> list[Reservation]:
    return list(
        db.scalars(
            select(Reservation)
            .where(Reservation.reservation_date == reservation_date)
            .order_by(Reservation.reservation_time.asc(), Reservation.created_at.asc())
        )
    )


def update_reservation(
    db: DatabaseSession,
    reservation_id: UUID,
    payload: ReservationUpdate,
    user: User,
) -> Reservation:
    reservation = _get_for_update(db, reservation_id)
    changes: dict[str, dict[str, Any]] = {}
    for field, value in payload.model_dump(exclude_unset=True).items():
        before = getattr(reservation, field)
        if before != value:
            changes[field] = {"before": _json_value(before), "after": _json_value(value)}
            setattr(reservation, field, value)

    if changes:
        reservation.updated_by = user.id
        _add_event(db, reservation, user, ReservationAction.UPDATE, changes)
        db.commit()
        db.refresh(reservation)
    return reservation


def confirm_reservation(db: DatabaseSession, reservation_id: UUID, user: User) -> Reservation:
    reservation = _get_for_update(db, reservation_id)
    if reservation.status == ReservationStatus.CONFIRMED:
        return reservation
    if reservation.status != ReservationStatus.SCHEDULED:
        raise InvalidReservationTransitionError(
            f"Não é possível confirmar uma reserva com status {reservation.status.value}"
        )

    confirmed_at = utc_now()
    reservation.status = ReservationStatus.CONFIRMED
    reservation.confirmed_at = confirmed_at
    reservation.updated_by = user.id
    _add_event(
        db,
        reservation,
        user,
        ReservationAction.CONFIRM,
        {
            "status": {
                "before": ReservationStatus.SCHEDULED.value,
                "after": ReservationStatus.CONFIRMED.value,
            },
            "confirmed_at": {"before": None, "after": confirmed_at.isoformat()},
        },
    )
    db.commit()
    db.refresh(reservation)
    return reservation


def check_in_reservation(db: DatabaseSession, reservation_id: UUID, user: User) -> Reservation:
    reservation = _get_for_update(db, reservation_id)
    if reservation.status == ReservationStatus.ARRIVED:
        return reservation
    if reservation.status not in {ReservationStatus.SCHEDULED, ReservationStatus.CONFIRMED}:
        raise InvalidReservationTransitionError(
            f"Não é possível registrar chegada com status {reservation.status.value}"
        )

    previous_status = reservation.status
    checked_in_at = utc_now()
    reservation.status = ReservationStatus.ARRIVED
    reservation.checked_in_at = checked_in_at
    reservation.updated_by = user.id
    _add_event(
        db,
        reservation,
        user,
        ReservationAction.CHECK_IN,
        {
            "status": {
                "before": previous_status.value,
                "after": ReservationStatus.ARRIVED.value,
            },
            "checked_in_at": {"before": None, "after": checked_in_at.isoformat()},
        },
    )
    db.commit()
    db.refresh(reservation)
    return reservation


def undo_check_in(db: DatabaseSession, reservation_id: UUID, user: User) -> Reservation:
    reservation = _get_for_update(db, reservation_id)
    if reservation.status != ReservationStatus.ARRIVED:
        raise InvalidReservationTransitionError(
            f"Não é possível desfazer chegada com status {reservation.status.value}"
        )

    restored_status = (
        ReservationStatus.CONFIRMED
        if reservation.confirmed_at is not None
        else ReservationStatus.SCHEDULED
    )
    previous_checked_in_at = reservation.checked_in_at
    reservation.status = restored_status
    reservation.checked_in_at = None
    reservation.updated_by = user.id
    _add_event(
        db,
        reservation,
        user,
        ReservationAction.UNDO_CHECK_IN,
        {
            "status": {
                "before": ReservationStatus.ARRIVED.value,
                "after": restored_status.value,
            },
            "checked_in_at": {
                "before": _json_value(previous_checked_in_at),
                "after": None,
            },
        },
    )
    db.commit()
    db.refresh(reservation)
    return reservation


def cancel_reservation(
    db: DatabaseSession,
    reservation_id: UUID,
    cancellation_reason: str | None,
    user: User,
) -> Reservation:
    reservation = _get_for_update(db, reservation_id)
    if reservation.status == ReservationStatus.CANCELLED:
        return reservation

    previous_status = reservation.status
    cancelled_at = utc_now()
    reservation.status = ReservationStatus.CANCELLED
    reservation.cancelled_at = cancelled_at
    reservation.cancellation_reason = cancellation_reason
    reservation.updated_by = user.id
    _add_event(
        db,
        reservation,
        user,
        ReservationAction.CANCEL,
        {
            "status": {
                "before": previous_status.value,
                "after": ReservationStatus.CANCELLED.value,
            },
            "cancelled_at": {"before": None, "after": cancelled_at.isoformat()},
            "cancellation_reason": {"before": None, "after": cancellation_reason},
        },
    )
    db.commit()
    db.refresh(reservation)
    return reservation
