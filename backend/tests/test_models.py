from typing import cast

from sqlalchemy import Table, UniqueConstraint

from app.models import PasswordToken, Session, User


def test_unique_constraints_and_lookup_indexes_are_declared_separately() -> None:
    expected = (
        (User, "email", "uq_users_email"),
        (Session, "token_hash", "uq_sessions_token_hash"),
        (PasswordToken, "token_hash", "uq_password_tokens_token_hash"),
    )

    for model, column_name, constraint_name in expected:
        table = cast(Table, model.__table__)
        constraints = {
            constraint.name
            for constraint in table.constraints
            if isinstance(constraint, UniqueConstraint)
        }
        assert constraint_name in constraints
        index = next(
            index
            for index in table.indexes
            if index.name == f"ix_{model.__tablename__}_{column_name}"
        )
        assert index.unique is not True
