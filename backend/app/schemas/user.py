from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    role: UserRole


class UserResponse(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    role: UserRole
    active: bool
    invitation_pending: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
