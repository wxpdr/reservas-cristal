from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import ReservationAction, UserRole


class AuditEventResponse(BaseModel):
    id: UUID
    reservation_id: UUID
    reservation_customer_name: str
    reservation_date: date
    user_id: UUID
    user_name: str
    user_role: UserRole
    action: ReservationAction
    changes: dict[str, Any] | None
    created_at: datetime
