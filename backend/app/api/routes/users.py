from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DatabaseSession

from app.api.dependencies import require_admin
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models.auth import Session, User
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.services.auth import normalize_email, send_first_access
from app.services.email import EmailSender, get_email_sender

router = APIRouter(prefix="/users", tags=["usuários"])


def user_response(user: User) -> UserResponse:
    return UserResponse.model_validate(
        {**user.__dict__, "invitation_pending": user.password_hash is None}
    )


def get_user_or_404(db: DatabaseSession, user_id: UUID) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    return user


@router.get("", response_model=list[UserResponse])
def list_users(
    db: DatabaseSession = Depends(get_db), _: User = Depends(require_admin)
) -> list[UserResponse]:
    users = db.scalars(select(User).order_by(User.password_hash.is_not(None), User.name)).all()
    return [user_response(user) for user in users]


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
    return user_response(user)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    payload: UserUpdate,
    db: DatabaseSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserResponse:
    user = get_user_or_404(db, user_id)
    changes = payload.model_dump(exclude_unset=True)
    if "email" in changes:
        changes["email"] = normalize_email(str(changes["email"]))
        duplicate = db.scalar(
            select(User.id).where(User.email == changes["email"], User.id != user.id)
        )
        if duplicate is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="E-mail já cadastrado")
    for field, value in changes.items():
        setattr(user, field, value.strip() if field == "name" else value)
    if changes.get("active") is False:
        db.execute(delete(Session).where(Session.user_id == user.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="E-mail já cadastrado"
        ) from None
    db.refresh(user)
    return user_response(user)


@router.post("/{user_id}/resend-invitation", response_model=UserResponse)
def resend_invitation(
    user_id: UUID,
    db: DatabaseSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    email_sender: EmailSender = Depends(get_email_sender),
    _: User = Depends(require_admin),
) -> UserResponse:
    user = get_user_or_404(db, user_id)
    if user.password_hash is not None or not user.active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="O convite só pode ser reenviado para um usuário ativo com convite pendente",
        )
    send_first_access(db, user, settings, email_sender)
    return user_response(user)
