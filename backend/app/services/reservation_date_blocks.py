from datetime import date

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DatabaseSession

from app.models import ReservationDateBlock, User


def get_date_block(db: DatabaseSession, block_date: date) -> ReservationDateBlock | None:
    return db.scalar(
        select(ReservationDateBlock).where(ReservationDateBlock.block_date == block_date)
    )


def is_date_blocked(db: DatabaseSession, block_date: date) -> bool:
    return get_date_block(db, block_date) is not None


def block_date(
    db: DatabaseSession, block_date: date, reason: str | None, user: User
) -> ReservationDateBlock:
    existing = get_date_block(db, block_date)
    if existing is not None:
        existing.reason = reason
        db.commit()
        db.refresh(existing)
        return existing

    date_block = ReservationDateBlock(
        block_date=block_date,
        reason=reason,
        created_by=user.id,
    )
    db.add(date_block)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        concurrent = get_date_block(db, block_date)
        if concurrent is None:
            raise
        return concurrent
    db.refresh(date_block)
    return date_block


def unblock_date(db: DatabaseSession, block_date: date) -> None:
    existing = get_date_block(db, block_date)
    if existing is None:
        return
    db.delete(existing)
    db.commit()
