from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DatabaseSession

from app.api.dependencies import require_admin
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models.auth import User
from app.schemas.user import UserCreate, UserResponse
from app.services.auth import normalize_email, send_first_access
from app.services.email import EmailSender, get_email_sender

router = APIRouter(prefix="/users", tags=["usuários"])


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: DatabaseSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    email_sender: EmailSender = Depends(get_email_sender),
    _: User = Depends(require_admin),
) -> UserResponse:
    email = normalize_email(str(payload.email))
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="E-mail já cadastrado")

    user = User(name=payload.name.strip(), email=email, role=payload.role, active=True)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="E-mail já cadastrado"
        ) from None
    db.refresh(user)
    send_first_access(db, user, settings, email_sender)
    return UserResponse.model_validate({**user.__dict__, "invitation_pending": True})
