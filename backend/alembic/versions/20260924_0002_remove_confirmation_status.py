"""Remove reservation confirmation status and timestamp.

Revision ID: 20260924_0002
Revises: 20260918_0001
Create Date: 2026-09-24
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260924_0002"
down_revision: str | None = "20260918_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE reservations SET status = 'AGENDADA' WHERE status = 'CONFIRMADA'")
    op.execute("ALTER TYPE reservation_status RENAME TO reservation_status_old")
    op.execute("CREATE TYPE reservation_status AS ENUM ('AGENDADA', 'CHEGOU', 'CANCELADA')")
    op.execute(
        "ALTER TABLE reservations ALTER COLUMN status TYPE reservation_status "
        "USING status::text::reservation_status"
    )
    op.execute("DROP TYPE reservation_status_old")
    op.drop_column("reservations", "confirmed_at")


def downgrade() -> None:
    op.add_column("reservations", sa.Column("confirmed_at", sa.DateTime(timezone=True)))
    op.execute("ALTER TYPE reservation_status RENAME TO reservation_status_new")
    op.execute(
        "CREATE TYPE reservation_status AS ENUM ('AGENDADA', 'CONFIRMADA', 'CHEGOU', 'CANCELADA')"
    )
    op.execute(
        "ALTER TABLE reservations ALTER COLUMN status TYPE reservation_status "
        "USING status::text::reservation_status"
    )
    op.execute("DROP TYPE reservation_status_new")
