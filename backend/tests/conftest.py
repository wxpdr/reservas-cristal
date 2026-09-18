from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import Settings, get_settings
from app.core.security import hash_password
from app.db.session import get_db
from app.main import app
from app.models import Base, User
from app.models.enums import UserRole
from app.services.email import InMemoryEmailSender, get_email_sender


@pytest.fixture
def db() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, expire_on_commit=False)
    with testing_session() as session:
        yield session
    Base.metadata.drop_all(engine)


@pytest.fixture
def mailer() -> InMemoryEmailSender:
    return InMemoryEmailSender()


@pytest.fixture
def settings() -> Settings:
    return Settings(
        database_url="sqlite+pysqlite:///:memory:",
        frontend_url="http://localhost:3000",
        session_cookie_secure=False,
        session_ttl_hours=12,
        password_token_ttl_hours=24,
    )


@pytest.fixture
def client(
    db: Session, mailer: InMemoryEmailSender, settings: Settings
) -> Generator[TestClient, None, None]:
    def override_db() -> Generator[Session, None, None]:
        yield db

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_email_sender] = lambda: mailer
    app.dependency_overrides[get_settings] = lambda: settings
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin(db: Session) -> User:
    user = User(
        name="Admin Teste",
        email="admin@cristalpizza.com.br",
        password_hash=hash_password("senha-segura"),
        role=UserRole.ADMIN,
        active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def operator(db: Session) -> User:
    user = User(
        name="Operador Teste",
        email="operador@cristalpizza.com.br",
        password_hash=hash_password("senha-segura"),
        role=UserRole.OPERATOR,
        active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
