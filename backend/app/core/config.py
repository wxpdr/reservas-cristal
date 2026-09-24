from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Reservas Cristal API"
    app_environment: Literal["development", "test", "production"] = "development"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/reservas_cristal"
    frontend_url: AnyHttpUrl = AnyHttpUrl("http://localhost:3000")
    session_cookie_name: str = "cristal_session"
    session_cookie_secure: bool = False
    session_ttl_hours: int = 12
    password_token_ttl_hours: int = 24
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: SecretStr | None = None
    smtp_from: str | None = None

    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    @model_validator(mode="after")
    def validate_smtp_configuration(self) -> "Settings":
        values = (self.smtp_host, self.smtp_username, self.smtp_password, self.smtp_from)
        if any(value is not None for value in values) and not all(values):
            raise ValueError(
                "SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD e SMTP_FROM devem ser configurados juntos"
            )
        if self.app_environment == "production":
            if not self.session_cookie_secure:
                raise ValueError("SESSION_COOKIE_SECURE deve ser true em producao")
            if self.frontend_url.scheme != "https":
                raise ValueError("FRONTEND_URL deve usar HTTPS em producao")
            if not self.smtp_enabled:
                raise ValueError("SMTP deve estar configurado em producao")
        return self

    @property
    def smtp_enabled(self) -> bool:
        return self.smtp_host is not None


@lru_cache
def get_settings() -> Settings:
    return Settings()
