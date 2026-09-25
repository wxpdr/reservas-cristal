from typing import Any, cast

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ReservationDateBlock, User

BLOCKED_DATE = "2026-11-15"
OPEN_DATE = "2026-11-16"


def login(client: TestClient, user: User) -> None:
    response = client.post(
        "/api/auth/login", json={"email": user.email, "password": "senha-segura"}
    )
    assert response.status_code == 200


def reservation_payload(reservation_date: str = OPEN_DATE) -> dict[str, Any]:
    return {
        "customer_name": "Cliente Bloqueio",
        "phone": "11999999999",
        "party_size": 6,
        "reservation_date": reservation_date,
        "reservation_time": "19:30",
        "origin": "TELEFONE",
    }


def create_reservation(client: TestClient, reservation_date: str = OPEN_DATE) -> dict[str, Any]:
    response = client.post("/api/reservations", json=reservation_payload(reservation_date))
    assert response.status_code == 201, response.text
    return cast(dict[str, Any], response.json())


def test_admin_blocks_queries_and_unblocks_with_optional_reason(
    client: TestClient, db: Session, admin: User
) -> None:
    login(client, admin)
    open_status = client.get(f"/api/reservation-date-blocks/{BLOCKED_DATE}")
    assert open_status.json() == {"date": BLOCKED_DATE, "blocked": False, "reason": None}

    blocked = client.post(
        f"/api/reservation-date-blocks/{BLOCKED_DATE}",
        json={"reason": "  Evento privado  "},
    )
    assert blocked.status_code == 200
    assert blocked.json()["reason"] == "Evento privado"
    assert blocked.json()["created_by"] == str(admin.id)

    repeated = client.post(f"/api/reservation-date-blocks/{BLOCKED_DATE}", json={"reason": None})
    assert repeated.status_code == 200
    assert db.scalar(select(func.count()).select_from(ReservationDateBlock)) == 1
    assert client.get(f"/api/reservation-date-blocks/{BLOCKED_DATE}").json() == {
        "date": BLOCKED_DATE,
        "blocked": True,
        "reason": None,
    }

    unblocked = client.delete(f"/api/reservation-date-blocks/{BLOCKED_DATE}")
    assert unblocked.status_code == 200
    assert unblocked.json() == {"date": BLOCKED_DATE, "blocked": False, "reason": None}


def test_operator_can_read_but_cannot_manage_blocks(
    client: TestClient, admin: User, operator: User
) -> None:
    login(client, admin)
    assert client.post(f"/api/reservation-date-blocks/{BLOCKED_DATE}", json={}).status_code == 200

    login(client, operator)
    assert client.get(f"/api/reservation-date-blocks/{BLOCKED_DATE}").status_code == 200
    assert client.post(f"/api/reservation-date-blocks/{OPEN_DATE}", json={}).status_code == 403
    assert client.delete(f"/api/reservation-date-blocks/{BLOCKED_DATE}").status_code == 403


def test_block_controls_creation_date_changes_and_existing_reservation_actions(
    client: TestClient, admin: User
) -> None:
    login(client, admin)
    existing_on_blocked_day = create_reservation(client, BLOCKED_DATE)
    reservation_to_move = create_reservation(client, OPEN_DATE)
    assert client.post(f"/api/reservation-date-blocks/{BLOCKED_DATE}", json={}).status_code == 200

    rejected_create = client.post("/api/reservations", json=reservation_payload(BLOCKED_DATE))
    assert rejected_create.status_code == 409
    assert rejected_create.json()["detail"] == "Esta data está bloqueada para novas reservas."

    same_day_edit = client.patch(
        f"/api/reservations/{existing_on_blocked_day['id']}", json={"table_label": "Mesa 8"}
    )
    assert same_day_edit.status_code == 200
    assert same_day_edit.json()["table_label"] == "Mesa 8"

    move_rejected = client.patch(
        f"/api/reservations/{reservation_to_move['id']}",
        json={"reservation_date": BLOCKED_DATE},
    )
    assert move_rejected.status_code == 409

    checked_in = client.post(f"/api/reservations/{existing_on_blocked_day['id']}/check-in")
    assert checked_in.status_code == 200
    assert checked_in.json()["status"] == "CHEGOU"
    undone = client.post(f"/api/reservations/{existing_on_blocked_day['id']}/undo-check-in")
    assert undone.status_code == 200
    cancelled = client.post(f"/api/reservations/{existing_on_blocked_day['id']}/cancel", json={})
    assert cancelled.status_code == 200

    assert client.delete(f"/api/reservation-date-blocks/{BLOCKED_DATE}").status_code == 200
    assert (
        client.post("/api/reservations", json=reservation_payload(BLOCKED_DATE)).status_code == 201
    )


def test_monthly_summary_marks_block_without_changing_active_totals(
    client: TestClient, admin: User
) -> None:
    login(client, admin)
    active = create_reservation(client, BLOCKED_DATE)
    cancelled = create_reservation(client, BLOCKED_DATE)
    assert client.post(f"/api/reservations/{cancelled['id']}/cancel", json={}).status_code == 200
    assert active["party_size"] == 6
    assert client.post(f"/api/reservation-date-blocks/{BLOCKED_DATE}", json={}).status_code == 200

    response = client.get("/api/reservations/monthly", params={"year": 2026, "month": 11})
    assert response.status_code == 200
    assert response.json() == [
        {"date": BLOCKED_DATE, "reservation_count": 1, "people_count": 6, "blocked": True},
    ]

    assert client.post("/api/reservation-date-blocks/2026-11-17", json={}).status_code == 200
    empty_block = client.get("/api/reservations/monthly", params={"year": 2026, "month": 11})
    assert empty_block.json()[1] == {
        "date": "2026-11-17",
        "reservation_count": 0,
        "people_count": 0,
        "blocked": True,
    }
