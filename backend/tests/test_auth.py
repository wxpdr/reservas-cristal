from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import PasswordToken, User
from app.services.email import InMemoryEmailSender


def login(client: TestClient, email: str, password: str = "senha-segura") -> None:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200


def token_from_last_email(mailer: InMemoryEmailSender) -> str:
    return parse_qs(urlparse(mailer.messages[-1].link).query)["token"][0]


def test_login_me_and_logout(client: TestClient, admin: User) -> None:
    response = client.post(
        "/api/auth/login",
        json={"email": admin.email.upper(), "password": "senha-segura"},
    )
    assert response.status_code == 200
    assert response.json()["role"] == "admin"
    assert response.cookies.get("cristal_session")
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=lax" in response.headers["set-cookie"]

    assert client.get("/api/auth/me").status_code == 200
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_invalid_login_does_not_create_session(client: TestClient, admin: User) -> None:
    response = client.post(
        "/api/auth/login", json={"email": admin.email, "password": "senha-incorreta"}
    )
    assert response.status_code == 401
    assert response.cookies.get("cristal_session") is None


def test_admin_creates_user_and_first_access_is_single_use(
    client: TestClient,
    db: Session,
    mailer: InMemoryEmailSender,
    admin: User,
) -> None:
    login(client, admin.email)
    response = client.post(
        "/api/users",
        json={"name": "Nova Pessoa", "email": "NOVA@cristalpizza.com.br", "role": "operator"},
    )
    assert response.status_code == 201
    assert response.json()["invitation_pending"] is True
    assert len(mailer.messages) == 1

    created_user = db.scalar(select(User).where(User.email == "nova@cristalpizza.com.br"))
    assert created_user is not None
    assert created_user.password_hash is None
    stored_token = db.scalar(select(PasswordToken).where(PasswordToken.user_id == created_user.id))
    assert stored_token is not None
    assert token_from_last_email(mailer) not in stored_token.token_hash

    token = token_from_last_email(mailer)
    completion = client.post(
        "/api/auth/first-access", json={"token": token, "password": "nova-senha-segura"}
    )
    assert completion.status_code == 200
    assert (
        client.post(
            "/api/auth/first-access", json={"token": token, "password": "outra-senha"}
        ).status_code
        == 400
    )
    client.cookies.clear()
    login(client, created_user.email, "nova-senha-segura")


def test_operator_cannot_create_users(client: TestClient, operator: User) -> None:
    login(client, operator.email)
    response = client.post(
        "/api/users",
        json={"name": "Sem Permissão", "email": "sem@cristal.com", "role": "operator"},
    )
    assert response.status_code == 403


def test_password_reset_is_enumeration_safe_single_use_and_revokes_sessions(
    client: TestClient,
    mailer: InMemoryEmailSender,
    operator: User,
) -> None:
    login(client, operator.email)
    old_cookie = client.cookies.get("cristal_session")
    assert old_cookie is not None

    missing = client.post(
        "/api/auth/password-reset/request", json={"email": "inexistente@cristal.com"}
    )
    existing = client.post("/api/auth/password-reset/request", json={"email": operator.email})
    assert missing.status_code == existing.status_code == 200
    assert missing.json() == existing.json()
    assert len(mailer.messages) == 1

    token = token_from_last_email(mailer)
    reset = client.post(
        "/api/auth/password-reset/complete",
        json={"token": token, "password": "senha-nova-segura"},
    )
    assert reset.status_code == 200
    assert (
        client.post(
            "/api/auth/password-reset/complete",
            json={"token": token, "password": "outra-senha-segura"},
        ).status_code
        == 400
    )

    client.cookies.set("cristal_session", old_cookie)
    assert client.get("/api/auth/me").status_code == 401
    client.cookies.clear()
    login(client, operator.email, "senha-nova-segura")
