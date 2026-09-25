"""Add manual reservation date blocks.

Revision ID: 20260924_0003
Revises: 20260924_0002
Create Date: 2026-09-24
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260924_0003"
down_revision: str | None = "20260924_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reservation_date_blocks",
        sa.Column("block_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("block_date", name="uq_reservation_date_blocks_date"),
    )
    op.create_index(
        op.f("ix_reservation_date_blocks_block_date"),
        "reservation_date_blocks",
        ["block_date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_reservation_date_blocks_block_date"),
        table_name="reservation_date_blocks",
    )
    op.drop_table("reservation_date_blocks")
