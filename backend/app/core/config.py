from functools import lru_cache

from pydantic import AnyHttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Reservas Cristal API"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/reservas_cristal"
    frontend_url: AnyHttpUrl = AnyHttpUrl("http://localhost:3000")
    session_cookie_name: str = "cristal_session"
    session_cookie_secure: bool = False
    session_ttl_hours: int = 12
    password_token_ttl_hours: int = 24

    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
