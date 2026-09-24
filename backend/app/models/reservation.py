from datetime import date, datetime, time
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, Date, DateTime, Enum, ForeignKey, Integer, String, Text, Time
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, utc_now
from app.models.enums import ReservationAction, ReservationOrigin, ReservationStatus


class Reservation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "reservations"

    customer_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(30), nullable=False)
    party_size: Mapped[int] = mapped_column(Integer, nullable=False)
    reservation_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    reservation_time: Mapped[time] = mapped_column(Time, nullable=False)
    table_label: Mapped[str | None] = mapped_column(String(50))
    origin: Mapped[ReservationOrigin] = mapped_column(
        Enum(
            ReservationOrigin,
            name="reservation_origin",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ReservationStatus] = mapped_column(
        Enum(
            ReservationStatus,
            name="reservation_status",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        default=ReservationStatus.SCHEDULED,
        nullable=False,
    )
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancellation_reason: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    updated_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

    events: Mapped[list["ReservationEvent"]] = relationship(back_populates="reservation")


class ReservationEvent(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "reservation_events"

    reservation_id: Mapped[UUID] = mapped_column(
        ForeignKey("reservations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    action: Mapped[ReservationAction] = mapped_column(
        Enum(
            ReservationAction,
            name="reservation_action",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        nullable=False,
    )
    changes: Mapped[dict[str, Any] | None] = mapped_column(JSON().with_variant(JSONB, "postgresql"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    reservation: Mapped[Reservation] = relationship(back_populates="events")
