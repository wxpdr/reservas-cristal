from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session as DatabaseSession

from app.api.dependencies import require_operator
from app.db.session import get_db
from app.models import User
from app.schemas.reservation import (
    MonthlyReservationSummary,
    ReservationCancellation,
    ReservationCreate,
    ReservationResponse,
    ReservationUpdate,
)
from app.services import reservations as reservation_service

router = APIRouter(prefix="/reservations", tags=["reservas"])


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reserva não encontrada")


def _invalid_transition(error: Exception) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))


@router.post("", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
def create_reservation(
    payload: ReservationCreate,
    db: DatabaseSession = Depends(get_db),
    user: User = Depends(require_operator),
) -> ReservationResponse:
    reservation = reservation_service.create_reservation(db, payload, user)
    return ReservationResponse.model_validate(reservation)


@router.get("", response_model=list[ReservationResponse])
def list_reservations(
    reservation_date: date = Query(alias="date"),
    db: DatabaseSession = Depends(get_db),
    _: User = Depends(require_operator),
) -> list[ReservationResponse]:
    reservations = reservation_service.list_reservations_by_date(db, reservation_date)
    return [ReservationResponse.model_validate(reservation) for reservation in reservations]


@router.get("/monthly", response_model=list[MonthlyReservationSummary])
def list_monthly_reservations(
    year: int = Query(ge=1, le=9999),
    month: int = Query(ge=1, le=12),
    db: DatabaseSession = Depends(get_db),
    _: User = Depends(require_operator),
) -> list[MonthlyReservationSummary]:
    summaries = reservation_service.list_monthly_reservation_summary(db, year, month)
    return [
        MonthlyReservationSummary(
            date=day,
            reservation_count=reservation_count,
            people_count=people_count,
        )
        for day, reservation_count, people_count in summaries
    ]


@router.get("/{reservation_id}", response_model=ReservationResponse)
def get_reservation(
    reservation_id: UUID,
    db: DatabaseSession = Depends(get_db),
    _: User = Depends(require_operator),
) -> ReservationResponse:
    try:
        reservation = reservation_service.get_reservation(db, reservation_id)
    except reservation_service.ReservationNotFoundError:
        raise _not_found() from None
    return ReservationResponse.model_validate(reservation)


@router.patch("/{reservation_id}", response_model=ReservationResponse)
def update_reservation(
    reservation_id: UUID,
    payload: ReservationUpdate,
    db: DatabaseSession = Depends(get_db),
    user: User = Depends(require_operator),
) -> ReservationResponse:
    try:
        reservation = reservation_service.update_reservation(db, reservation_id, payload, user)
    except reservation_service.ReservationNotFoundError:
        raise _not_found() from None
    return ReservationResponse.model_validate(reservation)


@router.post("/{reservation_id}/confirm", response_model=ReservationResponse)
def confirm_reservation(
    reservation_id: UUID,
    db: DatabaseSession = Depends(get_db),
    user: User = Depends(require_operator),
) -> ReservationResponse:
    try:
        reservation = reservation_service.confirm_reservation(db, reservation_id, user)
    except reservation_service.ReservationNotFoundError:
        raise _not_found() from None
    except reservation_service.InvalidReservationTransitionError as error:
        raise _invalid_transition(error) from None
    return ReservationResponse.model_validate(reservation)


@router.post("/{reservation_id}/check-in", response_model=ReservationResponse)
def check_in_reservation(
    reservation_id: UUID,
    db: DatabaseSession = Depends(get_db),
    user: User = Depends(require_operator),
) -> ReservationResponse:
    try:
        reservation = reservation_service.check_in_reservation(db, reservation_id, user)
    except reservation_service.ReservationNotFoundError:
        raise _not_found() from None
    except reservation_service.InvalidReservationTransitionError as error:
        raise _invalid_transition(error) from None
    return ReservationResponse.model_validate(reservation)


@router.post("/{reservation_id}/undo-check-in", response_model=ReservationResponse)
def undo_check_in(
    reservation_id: UUID,
    db: DatabaseSession = Depends(get_db),
    user: User = Depends(require_operator),
) -> ReservationResponse:
    try:
        reservation = reservation_service.undo_check_in(db, reservation_id, user)
    except reservation_service.ReservationNotFoundError:
        raise _not_found() from None
    except reservation_service.InvalidReservationTransitionError as error:
        raise _invalid_transition(error) from None
    return ReservationResponse.model_validate(reservation)


@router.post("/{reservation_id}/cancel", response_model=ReservationResponse)
def cancel_reservation(
    reservation_id: UUID,
    payload: ReservationCancellation,
    db: DatabaseSession = Depends(get_db),
    user: User = Depends(require_operator),
) -> ReservationResponse:
    try:
        reservation = reservation_service.cancel_reservation(
            db, reservation_id, payload.cancellation_reason, user
        )
    except reservation_service.ReservationNotFoundError:
        raise _not_found() from None
    return ReservationResponse.model_validate(reservation)
