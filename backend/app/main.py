"""FastAPI application factory for Slow and Steady.

Run locally with::

    uvicorn app.main:app --host 127.0.0.1 --port 8747 --reload
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import api_router
from app.core.chat_service import ChatService
from app.core.config import Settings, get_settings
from app.core.errors import error_response, register_exception_handlers
from app.core.generation_registry import GenerationRegistry
from app.database import ConversationRepository, Database, SettingsRepository
from app.providers.registry import ProviderRegistry

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("slow_and_steady")


def create_app(config: Settings | None = None, *, providers: ProviderRegistry | None = None) -> FastAPI:
    config = config or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        db = Database(config.database_path)
        await db.connect()
        conversations = ConversationRepository(db)
        settings_repo = SettingsRepository(db)
        registry = providers or ProviderRegistry(config)
        generations = GenerationRegistry()
        app.state.config = config
        app.state.db = db
        app.state.conversations = conversations
        app.state.settings_repo = settings_repo
        app.state.providers = registry
        app.state.generations = generations
        app.state.chat_service = ChatService(
            config=config,
            conversations=conversations,
            settings_repo=settings_repo,
            providers=registry,
            generations=generations,
        )
        logger.info("%s backend listening on http://%s:%s (local only)", config.app_name, config.host, config.port)
        try:
            yield
        finally:
            generations.cancel_all()
            await db.close()

    app = FastAPI(
        title=config.app_name,
        version=config.app_version,
        description="Local, privacy-focused AI assistant backend. Talks only to a local Ollama instance.",
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Accept"],
    )

    @app.middleware("http")
    async def limit_body_size(request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit() and int(content_length) > config.max_request_body_bytes:
            return error_response(413, "payload_too_large", "The request body is too large.")
        return await call_next(request)

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        return response

    register_exception_handlers(app)
    app.include_router(api_router)

    @app.get("/", include_in_schema=False)
    async def root() -> JSONResponse:
        return JSONResponse({"app": config.app_name, "docs": "/api/docs", "health": "/api/health"})

    return app


app = create_app()
