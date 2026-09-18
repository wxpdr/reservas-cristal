from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session as DatabaseSession

from app.core.config import Settings, get_settings
from app.core.security import hash_token
from app.db.session import get_db
from app.models.auth import Session, User
from app.models.base import utc_now
from app.models.enums import UserRole


def get_current_user(
    request: Request,
    db: DatabaseSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    session_token = request.cookies.get(settings.session_cookie_name)
    if session_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado")

    session = db.scalar(
        select(Session).where(
            Session.token_hash == hash_token(session_token), Session.expires_at > utc_now()
        )
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão inválida")

    user = db.get(User, session.user_id)
    if user is None or not user.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário inativo")

    session.last_used_at = utc_now()
    db.commit()
    return user


def require_role(*roles: UserRole) -> Callable[..., User]:
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
        return user

    return dependency


require_admin = require_role(UserRole.ADMIN)
require_operator = require_role(UserRole.ADMIN, UserRole.OPERATOR)
