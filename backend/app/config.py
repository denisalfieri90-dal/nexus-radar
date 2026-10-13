"""Configurazione centralizzata (variabili d'ambiente / file .env)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database: SQLite in locale, Postgres su Render (DATABASE_URL)
    database_url: str = "sqlite:///./nexus.db"

    # Claude API
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-5-5"
    claude_max_tokens: int = 4000

    # Fonti dati
    fred_api_key: str = ""  # gratuita: https://fred.stlouisfed.org/docs/api/api_key.html
    sec_user_agent: str = "NexusRadar research contact@example.com"  # la SEC richiede nome + email
    github_token: str = ""  # opzionale, alza i limiti di rate

    # Sicurezza endpoint dei job
    admin_token: str = "change-me"

    # CORS per il frontend
    cors_origins: str = "http://localhost:3000"

    # Scheduler interno (in locale). Su Render usare il cron job.
    enable_scheduler: bool = False

    # Servizio briefing su richiesta (Render free): codice d'accesso e snapshot del DB
    access_code: str = ""  # se impostato, POST /api/briefings richiede l'header X-Access-Code
    db_snapshot_url: str = ""  # es. https://raw.githubusercontent.com/<owner>/<repo>/data/nexus.db
    snapshot_max_age_minutes: int = 60

    # Benchmark per il journal
    default_benchmark: str = "SPY"

    @property
    def sqlalchemy_url(self) -> str:
        url = self.database_url
        if url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://"):]
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
