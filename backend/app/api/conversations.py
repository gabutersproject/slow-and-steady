from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from app.api.deps import get_conversations, get_generations
from app.core.chat_service import to_conversation_schema, to_message_schema
from app.core.errors import ConflictError, ValidationFailed
from app.core.generation_registry import GenerationRegistry
from app.database import ConversationRepository
from app.schemas.chat import (
    ConversationCreate,
    ConversationDetail,
    ConversationSummary,
    ConversationUpdate,
    DeleteAllResponse,
)

router = APIRouter(prefix="/conversations", tags=["conversations"])


def _validate_id(conversation_id: str) -> str:
    if not conversation_id.isalnum() or len(conversation_id) > 64:
        raise ValidationFailed("Invalid conversation id.")
    return conversation_id


@router.get("", response_model=list[ConversationSummary])
async def list_conversations(repo: ConversationRepository = Depends(get_conversations)) -> list[ConversationSummary]:
    return [to_conversation_schema(c) for c in await repo.list()]


@router.post("", response_model=ConversationSummary, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    body: ConversationCreate | None = None, repo: ConversationRepository = Depends(get_conversations)
) -> ConversationSummary:
    record = await repo.create(body.title if body else None)
    return to_conversation_schema(record)


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(conversation_id: str, repo: ConversationRepository = Depends(get_conversations)) -> ConversationDetail:
    _validate_id(conversation_id)
    record = await repo.get(conversation_id)
    messages = await repo.list_messages(conversation_id)
    return ConversationDetail(**to_conversation_schema(record).model_dump(), messages=[to_message_schema(m) for m in messages])


@router.patch("/{conversation_id}", response_model=ConversationSummary)
async def rename_conversation(
    conversation_id: str, body: ConversationUpdate, repo: ConversationRepository = Depends(get_conversations)
) -> ConversationSummary:
    _validate_id(conversation_id)
    return to_conversation_schema(await repo.rename(conversation_id, body.title))


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    repo: ConversationRepository = Depends(get_conversations),
    generations: GenerationRegistry = Depends(get_generations),
) -> Response:
    _validate_id(conversation_id)
    if generations.is_busy(conversation_id):
        generations.cancel(conversation_id)
    await repo.delete(conversation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("", response_model=DeleteAllResponse)
async def delete_all_conversations(
    confirm: bool = False,
    repo: ConversationRepository = Depends(get_conversations),
    generations: GenerationRegistry = Depends(get_generations),
) -> DeleteAllResponse:
    if not confirm:
        raise ConflictError("Clearing all history requires confirmation. Repeat the request with `?confirm=true`.")
    generations.cancel_all()
    deleted = await repo.delete_all()
    return DeleteAllResponse(deleted=deleted)
