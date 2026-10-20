"""FastAPI dependencies that expose the per-app singletons stored on ``app.state``."""

from __future__ import annotations

from fastapi import Request

from app.core.chat_service import ChatService
from app.core.config import Settings
from app.core.generation_registry import GenerationRegistry
from app.database import ConversationRepository, Database, SettingsRepository
from app.providers.registry import ProviderRegistry


def get_config(request: Request) -> Settings:
    return request.app.state.config


def get_db(request: Request) -> Database:
    return request.app.state.db


def get_conversations(request: Request) -> ConversationRepository:
    return request.app.state.conversations


def get_settings_repo(request: Request) -> SettingsRepository:
    return request.app.state.settings_repo


def get_providers(request: Request) -> ProviderRegistry:
    return request.app.state.providers


def get_generations(request: Request) -> GenerationRegistry:
    return request.app.state.generations


def get_chat_service(request: Request) -> ChatService:
    return request.app.state.chat_service
