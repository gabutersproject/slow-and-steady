from fastapi import APIRouter

from app.api import ai, chat, conversations, health, settings

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(ai.router)
api_router.include_router(chat.router)
api_router.include_router(conversations.router)
api_router.include_router(settings.router)

__all__ = ["api_router"]
