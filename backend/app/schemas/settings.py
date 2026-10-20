"""User-editable application settings (persisted in SQLite)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

ProviderName = Literal["demo", "ollama"]

TEMPERATURE_MIN, TEMPERATURE_MAX = 0.0, 2.0
MAX_TOKENS_MIN, MAX_TOKENS_MAX = 16, 8192
SYSTEM_PROMPT_MAX = 4000

DEFAULT_SYSTEM_PROMPT = (
    "You are Slow and Steady, a calm and careful local assistant. "
    "Answer clearly and honestly. If you are unsure, say so."
)


_MODEL_NAME_CHARS = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._:/-")


def normalize_model_name(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    if any(ch not in _MODEL_NAME_CHARS for ch in value):
        raise ValueError("Model names may only contain letters, numbers, '.', '_', ':', '/' and '-'.")
    return value


class AppSettings(BaseModel):
    provider: ProviderName = "demo"
    model: str | None = Field(default=None, max_length=200, description="Ollama model tag, e.g. qwen2.5:1.5b")
    temperature: float = Field(default=0.7, ge=TEMPERATURE_MIN, le=TEMPERATURE_MAX)
    max_tokens: int = Field(default=1024, ge=MAX_TOKENS_MIN, le=MAX_TOKENS_MAX)
    system_prompt: str = Field(default=DEFAULT_SYSTEM_PROMPT, max_length=SYSTEM_PROMPT_MAX)
    stream: bool = True

    @field_validator("model")
    @classmethod
    def _validate_model(cls, value: str | None) -> str | None:
        return normalize_model_name(value)


class SettingsUpdate(BaseModel):
    """Partial update; every field optional."""

    provider: ProviderName | None = None
    model: str | None = Field(default=None, max_length=200)
    temperature: float | None = Field(default=None, ge=TEMPERATURE_MIN, le=TEMPERATURE_MAX)
    max_tokens: int | None = Field(default=None, ge=MAX_TOKENS_MIN, le=MAX_TOKENS_MAX)
    system_prompt: str | None = Field(default=None, max_length=SYSTEM_PROMPT_MAX)
    stream: bool | None = None

    @field_validator("model")
    @classmethod
    def _validate_model(cls, value: str | None) -> str | None:
        return normalize_model_name(value)


class SettingsLimits(BaseModel):
    temperature_min: float = TEMPERATURE_MIN
    temperature_max: float = TEMPERATURE_MAX
    max_tokens_min: int = MAX_TOKENS_MIN
    max_tokens_max: int = MAX_TOKENS_MAX
    system_prompt_max_chars: int = SYSTEM_PROMPT_MAX
    message_max_chars: int


class SettingsResponse(BaseModel):
    settings: AppSettings
    limits: SettingsLimits
    default_system_prompt: str = DEFAULT_SYSTEM_PROMPT
