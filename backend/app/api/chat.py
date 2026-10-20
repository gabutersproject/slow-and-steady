"""Chat endpoints: blocking, streaming (SSE), regenerate and cancel."""

from __future__ import annotations

import json
from typing import Any, AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.deps import get_chat_service, get_config, get_generations
from app.core.chat_service import ChatService, to_conversation_schema, to_message_schema
from app.core.config import Settings
from app.core.errors import AppError, GenerationCancelled, ValidationFailed
from app.core.generation_registry import GenerationRegistry
from app.schemas.chat import ChatRequest, ChatResponse, GenerationOverrides, Message, RegenerateRequest

router = APIRouter(prefix="/chat", tags=["chat"])

SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"}


def _check_length(message: str, config: Settings) -> None:
    if len(message) > config.max_message_chars:
        raise ValidationFailed(
            f"Messages are limited to {config.max_message_chars} characters.",
            details={"max_chars": config.max_message_chars, "received": len(message)},
        )


def _sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def _sse_stream(events: AsyncIterator[dict[str, Any]], prelude: list[tuple[str, Any]]) -> AsyncIterator[str]:
    for name, data in prelude:
        yield _sse(name, data)
    async for item in events:
        yield _sse(item["event"], item["data"])


async def _collect(events: AsyncIterator[dict[str, Any]]) -> Message:
    """Drain a generation and return the final assistant message or raise."""
    final: dict[str, Any] | None = None
    async for item in events:
        if item["event"] == "done":
            final = item["data"]
        elif item["event"] == "error":
            data = item["data"]
            error = AppError(data["message"], status_code=data.get("status_code", 500), details=data.get("details") or {})
            error.code = data.get("code", "generation_failed")
            raise error
    if final is None or final.get("message") is None:
        raise GenerationCancelled("Generation was stopped before any text was produced.")
    return Message.model_validate(final["message"])


@router.post("", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    chat_service: ChatService = Depends(get_chat_service),
    config: Settings = Depends(get_config),
) -> ChatResponse:
    _check_length(body.message, config)
    conversation, user_message = await chat_service.prepare_turn(body.conversation_id, body.message)
    assistant = await _collect(chat_service.run(conversation.id, body.options))
    conversation = await chat_service.conversations.get(conversation.id)
    return ChatResponse(
        conversation=to_conversation_schema(conversation),
        user_message=to_message_schema(user_message),
        assistant_message=assistant,
    )


@router.post("/stream")
async def chat_stream(
    body: ChatRequest,
    chat_service: ChatService = Depends(get_chat_service),
    config: Settings = Depends(get_config),
) -> StreamingResponse:
    _check_length(body.message, config)
    conversation, user_message = await chat_service.prepare_turn(body.conversation_id, body.message)
    prelude = [
        (
            "accepted",
            {
                "conversation": to_conversation_schema(conversation).model_dump(),
                "user_message": to_message_schema(user_message).model_dump(),
            },
        )
    ]
    events = chat_service.run(conversation.id, body.options)
    return StreamingResponse(_sse_stream(events, prelude), media_type="text/event-stream", headers=SSE_HEADERS)


@router.post("/{conversation_id}/regenerate")
async def regenerate(
    conversation_id: str,
    body: RegenerateRequest | None = None,
    chat_service: ChatService = Depends(get_chat_service),
):
    if not conversation_id.isalnum():
        raise ValidationFailed("Invalid conversation id.")
    body = body or RegenerateRequest()
    conversation = await chat_service.prepare_regenerate(conversation_id)
    options: GenerationOverrides | None = body.options
    if body.stream:
        prelude = [("accepted", {"conversation": to_conversation_schema(conversation).model_dump(), "user_message": None})]
        events = chat_service.run(conversation.id, options)
        return StreamingResponse(_sse_stream(events, prelude), media_type="text/event-stream", headers=SSE_HEADERS)

    assistant = await _collect(chat_service.run(conversation.id, options))
    conversation = await chat_service.conversations.get(conversation.id)
    return ChatResponse(conversation=to_conversation_schema(conversation), user_message=None, assistant_message=assistant)


@router.post("/{conversation_id}/cancel")
async def cancel_generation(conversation_id: str, generations: GenerationRegistry = Depends(get_generations)) -> dict[str, Any]:
    if not conversation_id.isalnum():
        raise ValidationFailed("Invalid conversation id.")
    stopped = generations.cancel(conversation_id)
    return {"conversation_id": conversation_id, "cancelled": stopped}
