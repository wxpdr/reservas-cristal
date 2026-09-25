from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ReservationDateBlockCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str | None = Field(default=None, max_length=500)

    @field_validator("reason")
    @classmethod
    def trim_reason(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class ReservationDateBlockStatus(BaseModel):
    date: date
    blocked: bool
    reason: str | None


class ReservationDateBlockResponse(ReservationDateBlockStatus):
    id: UUID
    created_by: UUID
    created_at: datetime
