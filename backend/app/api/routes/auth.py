from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session as DatabaseSession

from app.api.dependencies import get_current_user
from app.core.config import Settings, get_settings
from app.core.security import hash_token, verify_password
from app.db.session import get_db
from app.models.auth import Session, User
from app.models.enums import PasswordTokenPurpose
from app.schemas.auth import LoginRequest, MessageResponse, PasswordCompletion, PasswordRequest
from app.schemas.user import UserResponse
from app.services.auth import (
    consume_password_token,
    create_session,
    normalize_email,
    send_password_reset,
)
from app.services.email import EmailSender, get_email_sender

router = APIRouter(prefix="/auth", tags=["autenticação"])


def user_response(user: User) -> UserResponse:
    return UserResponse.model_validate(
        {**user.__dict__, "invitation_pending": user.password_hash is None}
    )


@router.post("/login", response_model=UserResponse)
def login(
    payload: LoginRequest,
    response: Response,
    db: DatabaseSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> UserResponse:
    user = db.scalar(select(User).where(User.email == normalize_email(str(payload.email))))
    if (
        user is None
        or not user.active
        or user.password_hash is None
        or not verify_password(user.password_hash, payload.password)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha inválidos"
        )

    token = create_session(db, user, settings)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        max_age=settings.session_ttl_hours * 3600,
        path="/",
    )
    return user_response(user)


@router.post("/logout", response_model=MessageResponse)
def logout(
    request: Request,
    response: Response,
    db: DatabaseSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> MessageResponse:
    session_token = request.cookies.get(settings.session_cookie_name)
    if session_token:
        db.execute(delete(Session).where(Session.token_hash == hash_token(session_token)))
        db.commit()
    response.delete_cookie(settings.session_cookie_name, path="/")
    return MessageResponse(message="Sessão encerrada")


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)) -> UserResponse:
    return user_response(user)


@router.post("/first-access", response_model=MessageResponse)
def first_access(
    payload: PasswordCompletion, db: DatabaseSession = Depends(get_db)
) -> MessageResponse:
    user = consume_password_token(
        db, payload.token, payload.password, PasswordTokenPurpose.FIRST_ACCESS
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Convite inválido ou expirado"
        )
    return MessageResponse(message="Senha definida com sucesso")


@router.post("/password-reset/request", response_model=MessageResponse)
def request_password_reset(
    payload: PasswordRequest,
    db: DatabaseSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    email_sender: EmailSender = Depends(get_email_sender),
) -> MessageResponse:
    user = db.scalar(select(User).where(User.email == normalize_email(str(payload.email))))
    if user is not None and user.active and user.password_hash is not None:
        send_password_reset(db, user, settings, email_sender)
    return MessageResponse(message="Se o e-mail estiver cadastrado, as instruções serão enviadas")


@router.post("/password-reset/complete", response_model=MessageResponse)
def complete_password_reset(
    payload: PasswordCompletion, db: DatabaseSession = Depends(get_db)
) -> MessageResponse:
    user = consume_password_token(
        db, payload.token, payload.password, PasswordTokenPurpose.PASSWORD_RESET
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Link inválido ou expirado"
        )
    return MessageResponse(message="Senha redefinida com sucesso")
