"""Application configuration.

All values can be overridden with environment variables prefixed with ``SAS_``
(for example ``SAS_PORT=9000``). Defaults are chosen so that everything binds
to the local machine only.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SAS_", env_file=".env", extra="ignore")

    app_name: str = "Slow and Steady"
    app_version: str = "0.1.0"

    # Networking: localhost only by default.
    host: str = "127.0.0.1"
    port: int = 8747
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://127.0.0.1:4747", "http://localhost:4747"]
    )

    # Local inference service. Only the local Ollama instance is used by default.
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_connect_timeout_seconds: float = 3.0
    ollama_read_timeout_seconds: float = 120.0
    default_model: str = "qwen2.5:1.5b"

    # Persistence
    database_path: Path = BACKEND_ROOT / "data" / "slow_and_steady.sqlite3"

    # Request limits
    max_message_chars: int = 8000
    max_system_prompt_chars: int = 4000
    max_request_body_bytes: int = 64 * 1024
    max_context_messages: int = 30
    max_context_chars: int = 16000

    # Demo provider pacing (seconds between simulated tokens)
    demo_token_delay_seconds: float = 0.02


@lru_cache
def get_settings() -> Settings:
    return Settings()
