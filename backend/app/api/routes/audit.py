from datetime import date, datetime, time, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DatabaseSession
from sqlalchemy.sql.elements import ColumnElement

from app.api.dependencies import require_admin
from app.db.session import get_db
from app.models import Reservation, ReservationEvent, User
from app.models.enums import ReservationAction
from app.schemas.audit import AuditEventPage, AuditEventResponse

router = APIRouter(prefix="/audit", tags=["auditoria"])


@router.get("/reservation-events", response_model=AuditEventPage)
def list_reservation_events(
    event_date: date | None = Query(default=None, alias="date"),
    user_id: UUID | None = None,
    action: ReservationAction | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: DatabaseSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> AuditEventPage:
    filters: list[ColumnElement[bool]] = []
    if event_date is not None:
        start = datetime.combine(event_date, time.min)
        filters.extend(
            (
                ReservationEvent.created_at >= start,
                ReservationEvent.created_at < start + timedelta(days=1),
            )
        )
    if user_id is not None:
        filters.append(ReservationEvent.user_id == user_id)
    if action is not None:
        filters.append(ReservationEvent.action == action)

    total = db.scalar(select(func.count()).select_from(ReservationEvent).where(*filters)) or 0
    statement = (
        select(ReservationEvent, Reservation, User)
        .join(Reservation, Reservation.id == ReservationEvent.reservation_id)
        .join(User, User.id == ReservationEvent.user_id)
        .where(*filters)
        .order_by(ReservationEvent.created_at.desc(), ReservationEvent.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [
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
    return AuditEventPage(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size,
    )
