from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Reservation, ReservationEvent, User
from app.models.enums import ReservationStatus
from app.scripts.seed_dev_reservations import DEV_RESERVATIONS, seed_dev_reservations


def test_seed_creates_representative_audited_data_without_duplicates(
    db: Session, admin: User
) -> None:
    target_date = date(2026, 9, 22)

    assert seed_dev_reservations(db, admin, target_date) == (8, 0)
    assert seed_dev_reservations(db, admin, target_date) == (0, 8)

    reservations = list(
        db.scalars(
            select(Reservation)
            .where(Reservation.reservation_date == target_date)
            .order_by(Reservation.reservation_time)
        )
    )
    assert len(reservations) == len(DEV_RESERVATIONS) == 8
    assert [item.reservation_time for item in reservations] == sorted(
        item.reservation_time for item in reservations
    )
    assert (
        sum(
            item.reservation_time.hour == 19 and item.reservation_time.minute == 0
            for item in reservations
        )
        == 2
    )
    assert {item.status for item in reservations} == {
        ReservationStatus.SCHEDULED,
        ReservationStatus.ARRIVED,
        ReservationStatus.CANCELLED,
    }
    assert any(item.party_size >= 20 for item in reservations)
    assert any(item.notes is None for item in reservations)
    assert any(item.notes is not None and len(item.notes) > 80 for item in reservations)

    event_count = db.scalar(select(func.count()).select_from(ReservationEvent))
    assert event_count == 11
