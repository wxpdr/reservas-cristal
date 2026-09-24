from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import PasswordToken, User
from app.models.enums import PasswordTokenPurpose
from app.services.email import InMemoryEmailSender


def login(client: TestClient, user: User) -> None:
    response = client.post(
        "/api/auth/login", json={"email": user.email, "password": "senha-segura"}
    )
    assert response.status_code == 200


def test_admin_lists_updates_and_deactivates_users(
    client: TestClient, admin: User, operator: User
) -> None:
    login(client, admin)

    listed = client.get("/api/users")
    assert listed.status_code == 200
    assert {item["email"] for item in listed.json()} == {admin.email, operator.email}

    updated = client.patch(
        f"/api/users/{operator.id}",
        json={"name": "Operadora Atualizada", "email": "NOVA@cristal.com", "role": "admin"},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Operadora Atualizada"
    assert updated.json()["email"] == "nova@cristal.com"
    assert updated.json()["role"] == "admin"

    deactivated = client.patch(f"/api/users/{operator.id}", json={"active": False})
    assert deactivated.status_code == 200
    assert deactivated.json()["active"] is False

    client.cookies.clear()
    denied_login = client.post(
        "/api/auth/login", json={"email": "nova@cristal.com", "password": "senha-segura"}
    )
    assert denied_login.status_code == 401

    login(client, admin)
    reactivated = client.patch(f"/api/users/{operator.id}", json={"active": True})
    assert reactivated.status_code == 200
    assert reactivated.json()["active"] is True


def test_user_management_permissions_duplicates_and_missing_user(
    client: TestClient, admin: User, operator: User
) -> None:
    assert client.get("/api/users").status_code == 401
    login(client, operator)
    assert client.get("/api/users").status_code == 403
    assert client.patch(f"/api/users/{admin.id}", json={"name": "Negado"}).status_code == 403

    client.cookies.clear()
    login(client, admin)
    duplicate = client.patch(f"/api/users/{operator.id}", json={"email": admin.email})
    assert duplicate.status_code == 409
    missing = client.patch(
        "/api/users/00000000-0000-0000-0000-000000000000", json={"active": False}
    )
    assert missing.status_code == 404


def test_admin_creates_admin_and_resends_pending_invitation(
    client: TestClient,
    db: Session,
    mailer: InMemoryEmailSender,
    admin: User,
) -> None:
    login(client, admin)
    created = client.post(
        "/api/users",
        json={"name": "Nova Admin", "email": "nova-admin@cristal.com", "role": "admin"},
    )
    assert created.status_code == 201
    assert created.json()["role"] == "admin"
    assert created.json()["invitation_pending"] is True

    user = db.scalar(select(User).where(User.email == "nova-admin@cristal.com"))
    assert user is not None
    assert user.password_hash is None
    assert len(mailer.messages) == 1

    resent = client.post(f"/api/users/{user.id}/resend-invitation")
    assert resent.status_code == 200
    assert len(mailer.messages) == 2
    active_tokens = db.scalar(
        select(func.count(PasswordToken.id)).where(
            PasswordToken.user_id == user.id,
            PasswordToken.purpose == PasswordTokenPurpose.FIRST_ACCESS,
            PasswordToken.used_at.is_(None),
        )
    )
    assert active_tokens == 1

    not_pending = client.post(f"/api/users/{admin.id}/resend-invitation")
    assert not_pending.status_code == 409


def test_admin_audit_history_filters_and_operator_is_forbidden(
    client: TestClient, admin: User, operator: User
) -> None:
    login(client, admin)
    created = client.post(
        "/api/reservations",
        json={
            "customer_name": "Cliente Auditoria",
            "phone": "11900000000",
            "party_size": 4,
            "reservation_date": "2026-09-24",
            "reservation_time": "19:00",
            "origin": "TELEFONE",
        },
    )
    assert created.status_code == 201

    history = client.get("/api/audit/reservation-events", params={"user_id": str(admin.id)})
    assert history.status_code == 200
    assert history.json()["page"] == 1
    assert history.json()["page_size"] == 25
    assert history.json()["total"] == 1
    assert history.json()["total_pages"] == 1
    event = history.json()["items"][0]
    assert event["reservation_customer_name"] == "Cliente Auditoria"
    assert event["user_name"] == admin.name
    assert event["action"] == "CREATE"

    empty = client.get(
        "/api/audit/reservation-events",
        params={"date": date(2020, 1, 1).isoformat(), "action": "CANCEL"},
    )
    assert empty.status_code == 200
    assert empty.json()["items"] == []
    assert empty.json()["total"] == 0
    assert empty.json()["total_pages"] == 0

    client.cookies.clear()
    login(client, operator)
    assert client.get("/api/audit/reservation-events").status_code == 403


def test_audit_history_paginates_and_validates_page_size(client: TestClient, admin: User) -> None:
    login(client, admin)
    for index in range(27):
        created = client.post(
            "/api/reservations",
            json={
                "customer_name": f"Cliente {index:02d}",
                "phone": "11900000000",
                "party_size": 2,
                "reservation_date": "2026-09-24",
                "reservation_time": "19:00",
                "origin": "TELEFONE",
            },
        )
        assert created.status_code == 201

    first = client.get("/api/audit/reservation-events")
    second = client.get("/api/audit/reservation-events", params={"page": 2})

    assert len(first.json()["items"]) == 25
    assert first.json()["total"] == 27
    assert first.json()["total_pages"] == 2
    assert len(second.json()["items"]) == 2
    assert second.json()["page"] == 2
    assert client.get("/api/audit/reservation-events", params={"page_size": 101}).status_code == 422
