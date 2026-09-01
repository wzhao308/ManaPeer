"""App configuration, loaded from environment variables / a local .env file."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="MANAPEER_", extra="ignore")

    secret_key: str
    db_path: str = "./manapeer.db"
    sync_interval_minutes: int = 15
    frontend_origin: str = "http://localhost:5173"


@lru_cache
def get_settings() -> Settings:
    return Settings()
