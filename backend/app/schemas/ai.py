"""Schemas describing the AI engine state."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

AIState = Literal[
    "demo",  # Demo provider active; responses are scripted
    "ready",  # Ollama verified reachable and the selected model is installed
    "checking",  # status check in progress (frontend-only state, kept for parity)
    "offline",  # Ollama is not reachable
    "no_models",  # Ollama reachable but no models are installed
    "model_not_found",  # Ollama reachable but the selected model is not installed
]


class ModelInfo(BaseModel):
    name: str
    size_bytes: int | None = None
    parameter_size: str | None = None
    quantization: str | None = None
    family: str | None = None
    modified_at: str | None = None


class OllamaStatus(BaseModel):
    available: bool
    base_url: str
    version: str | None = None
    model_count: int = 0
    error: str | None = None


class AIStatus(BaseModel):
    provider: Literal["demo", "ollama"]
    state: AIState
    selected_model: str | None
    model_available: bool
    message: str
    ollama: OllamaStatus
    suggested_model: str


class ModelsResponse(BaseModel):
    provider: Literal["demo", "ollama"]
    ollama_available: bool
    models: list[ModelInfo]
    selected_model: str | None
    suggested_model: str
    message: str | None = None


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    app: str
    version: str
    database: Literal["ok", "unavailable"]
