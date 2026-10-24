import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./data/catalog.db")
    seed_demo: bool = os.getenv("SEED_DEMO", "true").lower() == "true"
    stale_days: int = int(os.getenv("STALE_DAYS", "90"))


settings = Settings()
