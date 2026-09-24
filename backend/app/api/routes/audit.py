from datetime import date, datetime, time, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session as DatabaseSession

from app.api.dependencies import require_admin
from app.db.session import get_db
from app.models import Reservation, ReservationEvent, User
from app.models.enums import ReservationAction
from app.schemas.audit import AuditEventResponse

router = APIRouter(prefix="/audit", tags=["auditoria"])


@router.get("/reservation-events", response_model=list[AuditEventResponse])
def list_reservation_events(
    event_date: date | None = Query(default=None, alias="date"),
    user_id: UUID | None = None,
    action: ReservationAction | None = None,
    db: DatabaseSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[AuditEventResponse]:
    statement = (
        select(ReservationEvent, Reservation, User)
        .join(Reservation, Reservation.id == ReservationEvent.reservation_id)
        .join(User, User.id == ReservationEvent.user_id)
        .order_by(ReservationEvent.created_at.desc())
        .limit(200)
    )
    if event_date is not None:
        start = datetime.combine(event_date, time.min)
        statement = statement.where(
            ReservationEvent.created_at >= start,
            ReservationEvent.created_at < start + timedelta(days=1),
        )
    if user_id is not None:
        statement = statement.where(ReservationEvent.user_id == user_id)
    if action is not None:
        statement = statement.where(ReservationEvent.action == action)

    return [
        AuditEventResponse(
            id=event.id,
            reservation_id=reservation.id,
            reservation_customer_name=reservation.customer_name,
            reservation_date=reservation.reservation_date,
            user_id=user.id,
            user_name=user.name,
            user_role=user.role,
            action=event.action,
            changes=event.changes,
            created_at=event.created_at,
        )
        for event, reservation, user in db.execute(statement).all()
    ]
