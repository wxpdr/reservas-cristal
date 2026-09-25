from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DatabaseSession

from app.api.dependencies import require_admin, require_operator
from app.db.session import get_db
from app.models import User
from app.schemas.reservation_date_block import (
    ReservationDateBlockCreate,
    ReservationDateBlockResponse,
    ReservationDateBlockStatus,
)
from app.services import reservation_date_blocks as date_block_service

router = APIRouter(prefix="/reservation-date-blocks", tags=["bloqueios de datas"])


@router.get("/{block_date}", response_model=ReservationDateBlockStatus)
def get_date_block(
    block_date: date,
    db: DatabaseSession = Depends(get_db),
    _: User = Depends(require_operator),
) -> ReservationDateBlockStatus:
    date_block = date_block_service.get_date_block(db, block_date)
    return ReservationDateBlockStatus(
        date=block_date,
        blocked=date_block is not None,
        reason=date_block.reason if date_block is not None else None,
    )


@router.post("/{block_date}", response_model=ReservationDateBlockResponse)
def block_date(
    block_date: date,
    payload: ReservationDateBlockCreate,
    db: DatabaseSession = Depends(get_db),
    user: User = Depends(require_admin),
) -> ReservationDateBlockResponse:
    date_block = date_block_service.block_date(db, block_date, payload.reason, user)
    return ReservationDateBlockResponse(
        id=date_block.id,
        date=date_block.block_date,
        blocked=True,
        reason=date_block.reason,
        created_by=date_block.created_by,
        created_at=date_block.created_at,
    )


@router.delete("/{block_date}", response_model=ReservationDateBlockStatus)
def unblock_date(
    block_date: date,
    db: DatabaseSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> ReservationDateBlockStatus:
    date_block_service.unblock_date(db, block_date)
    return ReservationDateBlockStatus(date=block_date, blocked=False, reason=None)
