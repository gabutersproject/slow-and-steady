from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_chat_service, get_config, get_settings_repo
from app.core.chat_service import ChatService
from app.core.config import Settings
from app.database import SettingsRepository
from app.schemas.settings import AppSettings, SettingsLimits, SettingsResponse, SettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


def _response(settings: AppSettings, config: Settings) -> SettingsResponse:
    return SettingsResponse(settings=settings, limits=SettingsLimits(message_max_chars=config.max_message_chars))


@router.get("", response_model=SettingsResponse)
async def get_settings(chat: ChatService = Depends(get_chat_service), config: Settings = Depends(get_config)) -> SettingsResponse:
    return _response(await chat.load_settings(), config)


@router.put("", response_model=SettingsResponse)
async def update_settings(
    body: SettingsUpdate,
    chat: ChatService = Depends(get_chat_service),
    repo: SettingsRepository = Depends(get_settings_repo),
    config: Settings = Depends(get_config),
) -> SettingsResponse:
    current = await chat.load_settings()
    changes = body.model_dump(exclude_unset=True)
    merged = AppSettings.model_validate({**current.model_dump(), **changes})
    await repo.save(merged.model_dump())
    return _response(merged, config)
