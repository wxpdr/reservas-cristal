from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import ReservationOrigin, ReservationStatus


class ReservationFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    customer_name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=1, max_length=30)
    party_size: int = Field(gt=0)
    reservation_date: date
    reservation_time: time
    origin: ReservationOrigin
    table_label: str | None = Field(default=None, max_length=50)
    notes: str | None = None

    @field_validator("customer_name", "phone")
    @classmethod
    def required_text_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("não pode ficar em branco")
        return value

    @field_validator("table_label", "notes")
    @classmethod
    def optional_text_is_trimmed(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class ReservationCreate(ReservationFields):
    pass


class ReservationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    customer_name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, min_length=1, max_length=30)
    party_size: int | None = Field(default=None, gt=0)
    reservation_date: date | None = None
    reservation_time: time | None = None
    origin: ReservationOrigin | None = None
    table_label: str | None = Field(default=None, max_length=50)
    notes: str | None = None

    @field_validator("customer_name", "phone")
    @classmethod
    def required_text_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("não pode ficar em branco")
        return value

    @field_validator("table_label", "notes")
    @classmethod
    def optional_text_is_trimmed(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @model_validator(mode="after")
    def required_fields_cannot_be_null(self) -> "ReservationUpdate":
        required = {
            "customer_name",
            "phone",
            "party_size",
            "reservation_date",
            "reservation_time",
            "origin",
        }
        null_fields = required.intersection(self.model_fields_set)
        if any(getattr(self, field) is None for field in null_fields):
            raise ValueError("campos obrigatórios não podem ser nulos")
        return self


class ReservationCancellation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cancellation_reason: str | None = None

    @field_validator("cancellation_reason")
    @classmethod
    def reason_is_trimmed(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class ReservationResponse(ReservationFields):
    id: UUID
    status: ReservationStatus
    checked_in_at: datetime | None
    cancelled_at: datetime | None
    cancellation_reason: str | None
    created_by: UUID
    updated_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MonthlyReservationSummary(BaseModel):
    date: date
    reservation_count: int
    people_count: int
    blocked: bool
