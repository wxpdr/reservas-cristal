from typing import Any, cast
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Reservation, ReservationEvent, User
from app.models.enums import ReservationAction


def login(client: TestClient, user: User) -> None:
    response = client.post(
        "/api/auth/login", json={"email": user.email, "password": "senha-segura"}
    )
    assert response.status_code == 200


def reservation_payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "customer_name": "Cliente Teste",
        "phone": "11999999999",
        "party_size": 4,
        "reservation_date": "2026-10-10",
        "reservation_time": "19:30",
        "origin": "TELEFONE",
        "notes": "Perto da janela",
    }
    payload.update(overrides)
    return payload


def create_reservation(client: TestClient, **overrides: Any) -> dict[str, Any]:
    response = client.post("/api/reservations", json=reservation_payload(**overrides))
    assert response.status_code == 201, response.text
    return cast(dict[str, Any], response.json())


def actions_for(db: Session, reservation_id: str) -> list[ReservationAction]:
    return list(
        db.scalars(
            select(ReservationEvent.action)
            .where(ReservationEvent.reservation_id == UUID(reservation_id))
            .order_by(ReservationEvent.created_at)
        )
    )


def test_admin_creates_scheduled_reservation_and_create_audit(
    client: TestClient, db: Session, admin: User
) -> None:
    login(client, admin)
    created = create_reservation(client, party_size=20, table_label=None)

    assert created["status"] == "AGENDADA"
    assert created["party_size"] == 20
    assert created["table_label"] is None
    assert created["created_by"] == str(admin.id)
    assert created["updated_by"] == str(admin.id)

    event = db.scalar(
        select(ReservationEvent).where(ReservationEvent.reservation_id == UUID(created["id"]))
    )
    assert event is not None
    assert event.action == ReservationAction.CREATE
    assert event.user_id == admin.id
    assert event.changes is not None
    assert event.changes["after"]["status"] == "AGENDADA"


def test_operator_can_create_and_same_time_has_no_conflict(
    client: TestClient, operator: User
) -> None:
    login(client, operator)
    first = create_reservation(client, customer_name="Primeira")
    second = create_reservation(client, customer_name="Segunda")

    assert first["reservation_time"] == second["reservation_time"] == "19:30:00"


def test_unauthenticated_and_invalid_payloads_are_rejected(client: TestClient, admin: User) -> None:
    assert client.post("/api/reservations", json=reservation_payload()).status_code == 401
    login(client, admin)

    missing = reservation_payload()
    del missing["customer_name"]
    assert client.post("/api/reservations", json=missing).status_code == 422
    assert (
        client.post("/api/reservations", json=reservation_payload(party_size=0)).status_code == 422
    )
    assert (
        client.post("/api/reservations", json=reservation_payload(status="CANCELADA")).status_code
        == 422
    )


def test_get_by_id_and_list_day_are_ordered_and_keep_cancelled(
    client: TestClient, admin: User
) -> None:
    login(client, admin)
    late = create_reservation(client, customer_name="Mais tarde", reservation_time="21:00")
    early = create_reservation(client, customer_name="Mais cedo", reservation_time="18:00")
    other_day = create_reservation(client, customer_name="Outro dia", reservation_date="2026-10-11")
    cancelled = client.post(f"/api/reservations/{early['id']}/cancel", json={})
    assert cancelled.status_code == 200

    detail = client.get(f"/api/reservations/{late['id']}")
    assert detail.status_code == 200
    assert detail.json()["customer_name"] == "Mais tarde"

    response = client.get("/api/reservations", params={"date": "2026-10-10"})
    assert response.status_code == 200
    listed = response.json()
    assert [item["id"] for item in listed] == [early["id"], late["id"]]
    assert listed[0]["status"] == "CANCELADA"
    assert other_day["id"] not in {item["id"] for item in listed}


def test_monthly_summary_groups_active_reservations_and_excludes_cancelled(
    client: TestClient, admin: User
) -> None:
    login(client, admin)
    create_reservation(client, reservation_date="2026-09-05", party_size=4)
    create_reservation(client, reservation_date="2026-09-05", party_size=6)
    confirmed = create_reservation(client, reservation_date="2026-09-06", party_size=3)
    arrived = create_reservation(client, reservation_date="2026-09-06", party_size=5)
    cancelled = create_reservation(client, reservation_date="2026-09-05", party_size=20)
    create_reservation(client, reservation_date="2026-10-05", party_size=99)

    assert client.post(f"/api/reservations/{confirmed['id']}/confirm").status_code == 200
    assert client.post(f"/api/reservations/{arrived['id']}/check-in").status_code == 200
    assert client.post(f"/api/reservations/{cancelled['id']}/cancel", json={}).status_code == 200

    response = client.get("/api/reservations/monthly", params={"year": 2026, "month": 9})

    assert response.status_code == 200
    assert response.json() == [
        {"date": "2026-09-05", "reservation_count": 2, "people_count": 10},
        {"date": "2026-09-06", "reservation_count": 2, "people_count": 8},
    ]


def test_monthly_summary_requires_authentication_and_valid_month(
    client: TestClient, admin: User
) -> None:
    unauthenticated = client.get("/api/reservations/monthly", params={"year": 2026, "month": 9})
    assert unauthenticated.status_code == 401
    login(client, admin)
    invalid_month = client.get("/api/reservations/monthly", params={"year": 2026, "month": 13})
    assert invalid_month.status_code == 422


def test_edit_records_only_changed_fields_and_does_not_accept_status(
    client: TestClient, db: Session, operator: User
) -> None:
    login(client, operator)
    created = create_reservation(client)
    response = client.patch(
        f"/api/reservations/{created['id']}",
        json={"customer_name": "Nome alterado", "party_size": 25, "table_label": "A-7"},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["customer_name"] == "Nome alterado"
    assert updated["party_size"] == 25
    assert updated["table_label"] == "A-7"
    assert updated["updated_by"] == str(operator.id)
    assert updated["status"] == "AGENDADA"

    event = db.scalar(
        select(ReservationEvent).where(
            ReservationEvent.reservation_id == UUID(created["id"]),
            ReservationEvent.action == ReservationAction.UPDATE,
        )
    )
    assert event is not None
    assert event.changes == {
        "customer_name": {"before": "Cliente Teste", "after": "Nome alterado"},
        "party_size": {"before": 4, "after": 25},
        "table_label": {"before": None, "after": "A-7"},
    }

    ignored_status = client.patch(
        f"/api/reservations/{created['id']}", json={"status": "CANCELADA"}
    )
    assert ignored_status.status_code == 422


def test_confirm_is_idempotent_and_audited(client: TestClient, db: Session, admin: User) -> None:
    login(client, admin)
    created = create_reservation(client)
    first = client.post(f"/api/reservations/{created['id']}/confirm")
    second = client.post(f"/api/reservations/{created['id']}/confirm")

    assert first.status_code == second.status_code == 200
    assert first.json()["status"] == "CONFIRMADA"
    assert first.json()["confirmed_at"] is not None
    assert actions_for(db, created["id"]).count(ReservationAction.CONFIRM) == 1


def test_check_in_directly_and_undo_restores_scheduled(
    client: TestClient, db: Session, operator: User
) -> None:
    login(client, operator)
    created = create_reservation(client)
    checked_in = client.post(f"/api/reservations/{created['id']}/check-in")
    assert checked_in.status_code == 200
    assert checked_in.json()["status"] == "CHEGOU"
    assert checked_in.json()["checked_in_at"] is not None

    undone = client.post(f"/api/reservations/{created['id']}/undo-check-in")
    assert undone.status_code == 200
    assert undone.json()["status"] == "AGENDADA"
    assert undone.json()["checked_in_at"] is None
    assert actions_for(db, created["id"]) == [
        ReservationAction.CREATE,
        ReservationAction.CHECK_IN,
        ReservationAction.UNDO_CHECK_IN,
    ]


def test_check_in_confirmed_and_undo_restores_confirmed(client: TestClient, admin: User) -> None:
    login(client, admin)
    created = create_reservation(client)
    assert client.post(f"/api/reservations/{created['id']}/confirm").status_code == 200
    assert client.post(f"/api/reservations/{created['id']}/check-in").status_code == 200

    undone = client.post(f"/api/reservations/{created['id']}/undo-check-in")
    assert undone.status_code == 200
    assert undone.json()["status"] == "CONFIRMADA"
    assert undone.json()["confirmed_at"] is not None


def test_cancel_without_reason_is_soft_delete_and_audited(
    client: TestClient, db: Session, operator: User
) -> None:
    login(client, operator)
    created = create_reservation(client)
    response = client.post(f"/api/reservations/{created['id']}/cancel", json={})

    assert response.status_code == 200
    assert response.json()["status"] == "CANCELADA"
    assert response.json()["cancelled_at"] is not None
    assert response.json()["cancellation_reason"] is None
    assert db.get(Reservation, UUID(created["id"])) is not None
    assert actions_for(db, created["id"])[-1] == ReservationAction.CANCEL

    repeated = client.post(
        f"/api/reservations/{created['id']}/cancel",
        json={"cancellation_reason": "Não deve substituir"},
    )
    assert repeated.status_code == 200
    assert repeated.json()["cancellation_reason"] is None
    cancel_count = db.scalar(
        select(func.count())
        .select_from(ReservationEvent)
        .where(
            ReservationEvent.reservation_id == UUID(created["id"]),
            ReservationEvent.action == ReservationAction.CANCEL,
        )
    )
    assert cancel_count == 1


def test_invalid_transitions_return_conflict(client: TestClient, admin: User) -> None:
    login(client, admin)
    created = create_reservation(client)
    assert client.post(f"/api/reservations/{created['id']}/undo-check-in").status_code == 409
    assert client.post(f"/api/reservations/{created['id']}/cancel", json={}).status_code == 200
    assert client.post(f"/api/reservations/{created['id']}/confirm").status_code == 409
    assert client.post(f"/api/reservations/{created['id']}/check-in").status_code == 409


def test_missing_reservation_returns_not_found(client: TestClient, admin: User) -> None:
    login(client, admin)
    missing_id = "00000000-0000-0000-0000-000000000000"
    assert client.get(f"/api/reservations/{missing_id}").status_code == 404
    assert client.patch(f"/api/reservations/{missing_id}", json={}).status_code == 404
