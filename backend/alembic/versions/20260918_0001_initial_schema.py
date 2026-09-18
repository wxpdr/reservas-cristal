"""Create initial schema.

Revision ID: 20260918_0001
Revises:
Create Date: 2026-09-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260918_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

user_role = postgresql.ENUM("admin", "operator", name="user_role", create_type=False)
reservation_origin = postgresql.ENUM(
    "TELEFONE",
    "WHATSAPP",
    "PRESENCIAL",
    "TAGME",
    "OUTRO",
    name="reservation_origin",
    create_type=False,
)
reservation_status = postgresql.ENUM(
    "AGENDADA",
    "CONFIRMADA",
    "CHEGOU",
    "CANCELADA",
    name="reservation_status",
    create_type=False,
)
reservation_action = postgresql.ENUM(
    "CREATE",
    "UPDATE",
    "CONFIRM",
    "CHECK_IN",
    "UNDO_CHECK_IN",
    "CANCEL",
    "TABLE_CHANGE",
    name="reservation_action",
    create_type=False,
)
password_token_purpose = postgresql.ENUM(
    "FIRST_ACCESS", "PASSWORD_RESET", name="password_token_purpose", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    user_role.create(bind, checkfirst=True)
    reservation_origin.create(bind, checkfirst=True)
    reservation_status.create(bind, checkfirst=True)
    reservation_action.create(bind, checkfirst=True)
    password_token_purpose.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.String(255)),
        sa.Column("role", user_role, nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "reservations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("customer_name", sa.String(120), nullable=False),
        sa.Column("phone", sa.String(30), nullable=False),
        sa.Column("party_size", sa.Integer(), nullable=False),
        sa.Column("reservation_date", sa.Date(), nullable=False),
        sa.Column("reservation_time", sa.Time(), nullable=False),
        sa.Column("table_label", sa.String(50)),
        sa.Column("origin", reservation_origin, nullable=False),
        sa.Column("notes", sa.Text()),
        sa.Column("status", reservation_status, nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True)),
        sa.Column("checked_in_at", sa.DateTime(timezone=True)),
        sa.Column("cancelled_at", sa.DateTime(timezone=True)),
        sa.Column("cancellation_reason", sa.Text()),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("updated_by", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], name="fk_reservations_created_by_users"
        ),
        sa.ForeignKeyConstraint(
            ["updated_by"], ["users.id"], name="fk_reservations_updated_by_users"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_reservations"),
    )
    op.create_index("ix_reservations_reservation_date", "reservations", ["reservation_date"])

    op.create_table(
        "sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_sessions_user_id_users", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_sessions"),
        sa.UniqueConstraint("token_hash", name="uq_sessions_token_hash"),
    )
    op.create_index("ix_sessions_token_hash", "sessions", ["token_hash"])
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])

    op.create_table(
        "password_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("purpose", password_token_purpose, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_password_tokens_user_id_users", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_password_tokens"),
        sa.UniqueConstraint("token_hash", name="uq_password_tokens_token_hash"),
    )
    op.create_index("ix_password_tokens_token_hash", "password_tokens", ["token_hash"])
    op.create_index("ix_password_tokens_user_id", "password_tokens", ["user_id"])

    op.create_table(
        "reservation_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("reservation_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("action", reservation_action, nullable=False),
        sa.Column("changes", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["reservation_id"],
            ["reservations.id"],
            name="fk_reservation_events_reservation_id_reservations",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_reservation_events_user_id_users"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_reservation_events"),
    )
    op.create_index(
        "ix_reservation_events_reservation_id", "reservation_events", ["reservation_id"]
    )
    op.create_index("ix_reservation_events_user_id", "reservation_events", ["user_id"])


def downgrade() -> None:
    op.drop_table("reservation_events")
    op.drop_table("password_tokens")
    op.drop_table("sessions")
    op.drop_table("reservations")
    op.drop_table("users")
    bind = op.get_bind()
    password_token_purpose.drop(bind, checkfirst=True)
    reservation_action.drop(bind, checkfirst=True)
    reservation_status.drop(bind, checkfirst=True)
    reservation_origin.drop(bind, checkfirst=True)
    user_role.drop(bind, checkfirst=True)
