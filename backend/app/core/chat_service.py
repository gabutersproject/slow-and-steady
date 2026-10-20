"""Chat orchestration: resolves the provider, builds context, runs generation and persists results.

Generation runs in its own asyncio task that pushes events into a queue. The HTTP
layer only reads from the queue, so a client disconnect never interrupts the
bookkeeping (persisting partial output, releasing the conversation slot).
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass
from typing import Any, AsyncIterator

from app.core.config import Settings
from app.core.errors import AppError, ConflictError, GenerationCancelled, ProviderUnavailableError
from app.core.generation_registry import ActiveGeneration, GenerationRegistry
from app.database.repository import ConversationRecord, ConversationRepository, MessageRecord, SettingsRepository
from app.providers.base import AIProvider, ChatMessage, GenerationOptions
from app.providers.ollama import OLLAMA_INSTALL_HINT, OllamaProvider
from app.providers.registry import ProviderRegistry
from app.schemas.chat import ConversationSummary, GenerationOverrides, Message
from app.schemas.settings import AppSettings

logger = logging.getLogger("slow_and_steady.chat")

_END = object()


def to_message_schema(record: MessageRecord) -> Message:
    return Message(
        id=record.id,
        conversation_id=record.conversation_id,
        role=record.role,  # type: ignore[arg-type]
        content=record.content,
        status=record.status,  # type: ignore[arg-type]
        provider=record.provider,
        model=record.model,
        created_at=record.created_at,
    )


def to_conversation_schema(record: ConversationRecord) -> ConversationSummary:
    return ConversationSummary(
        id=record.id,
        title=record.title,
        created_at=record.created_at,
        updated_at=record.updated_at,
        message_count=record.message_count,
    )


def title_from_prompt(prompt: str, limit: int = 60) -> str:
    first_line = prompt.strip().splitlines()[0] if prompt.strip() else "New chat"
    cleaned = " ".join(first_line.split())
    return cleaned if len(cleaned) <= limit else cleaned[: limit - 1].rstrip() + "…"


@dataclass
class ResolvedGeneration:
    provider: AIProvider
    options: GenerationOptions
    settings: AppSettings


class ChatService:
    def __init__(
        self,
        *,
        config: Settings,
        conversations: ConversationRepository,
        settings_repo: SettingsRepository,
        providers: ProviderRegistry,
        generations: GenerationRegistry,
    ) -> None:
        self.config = config
        self.conversations = conversations
        self.settings_repo = settings_repo
        self.providers = providers
        self.generations = generations

    # ---- settings & provider resolution ----------------------------------

    async def load_settings(self) -> AppSettings:
        stored = await self.settings_repo.load()
        try:
            return AppSettings.model_validate(stored)
        except ValueError:
            logger.warning("Stored settings were invalid; falling back to defaults.")
            return AppSettings()

    async def resolve(self, overrides: GenerationOverrides | None) -> ResolvedGeneration:
        settings = await self.load_settings()
        model = (overrides.model if overrides and overrides.model else settings.model) or None
        options = GenerationOptions(
            model=model,
            temperature=overrides.temperature if overrides and overrides.temperature is not None else settings.temperature,
            max_tokens=overrides.max_tokens if overrides and overrides.max_tokens is not None else settings.max_tokens,
            system_prompt=overrides.system_prompt if overrides and overrides.system_prompt is not None else settings.system_prompt,
        )
        provider = self.providers.get(settings.provider)
        if isinstance(provider, OllamaProvider):
            # Verify before generating so the user gets a precise, actionable error.
            if not await provider.is_available():
                raise ProviderUnavailableError(OLLAMA_INSTALL_HINT)
            installed = await provider.list_models()
            await provider.ensure_model(options.model, installed)
        return ResolvedGeneration(provider=provider, options=options, settings=settings)

    # ---- context ----------------------------------------------------------

    def build_context(self, history: list[MessageRecord]) -> list[ChatMessage]:
        """Keep the most recent messages within the configured message/char budget."""
        usable = [m for m in history if m.role in ("user", "assistant") and m.status != "error" and m.content.strip()]
        selected: list[ChatMessage] = []
        chars = 0
        for record in reversed(usable):
            if len(selected) >= self.config.max_context_messages:
                break
            if selected and chars + len(record.content) > self.config.max_context_chars:
                break
            selected.append(ChatMessage(role=record.role, content=record.content))  # type: ignore[arg-type]
            chars += len(record.content)
        selected.reverse()
        return selected

    # ---- conversation preparation ----------------------------------------

    def _ensure_idle(self, conversation_id: str) -> None:
        if self.generations.is_busy(conversation_id):
            raise ConflictError(
                "A response is already being generated for this conversation. Wait for it to finish or stop it first.",
                details={"conversation_id": conversation_id},
            )

    async def prepare_turn(self, conversation_id: str | None, prompt: str) -> tuple[ConversationRecord, MessageRecord]:
        if conversation_id:
            conversation = await self.conversations.get(conversation_id)
        else:
            conversation = await self.conversations.create(title_from_prompt(prompt))
        self._ensure_idle(conversation.id)
        if conversation.title == "New chat" and conversation.message_count == 0:
            conversation = await self.conversations.rename(conversation.id, title_from_prompt(prompt))
        user_message = await self.conversations.add_message(conversation.id, "user", prompt)
        return conversation, user_message

    async def prepare_regenerate(self, conversation_id: str) -> ConversationRecord:
        conversation = await self.conversations.get(conversation_id)
        self._ensure_idle(conversation.id)
        history = await self.conversations.list_messages(conversation.id)
        if not history or not any(m.role == "user" for m in history):
            raise AppError("There is no user message to regenerate a response for.", status_code=400)
        # Drop the trailing assistant reply (if any) so the new one takes its place.
        while history and history[-1].role == "assistant":
            await self.conversations.delete_message(history[-1].id)
            history.pop()
        return conversation

    # ---- generation -------------------------------------------------------

    async def run(self, conversation_id: str, overrides: GenerationOverrides | None) -> AsyncIterator[dict[str, Any]]:
        """Yield SSE-ready event dicts: start, delta, done, error."""
        generation_id = uuid.uuid4().hex
        active = self.generations.start(conversation_id, generation_id)
        queue: asyncio.Queue[Any] = asyncio.Queue()
        task = asyncio.create_task(self._generate(active, queue, overrides))
        try:
            while True:
                item = await queue.get()
                if item is _END:
                    break
                yield item
        finally:
            if not task.done():
                # Client disconnected: stop the model but let the task finish persisting.
                active.cancel.cancel()

    async def _generate(self, active: ActiveGeneration, queue: asyncio.Queue[Any], overrides: GenerationOverrides | None) -> None:
        conversation_id = active.conversation_id
        assistant_id = uuid.uuid4().hex
        partial: list[str] = []
        provider_name: str | None = None
        model: str | None = None
        try:
            resolved = await self.resolve(overrides)
            provider_name = resolved.provider.name
            model = resolved.options.model if provider_name != "demo" else "demo-scripted"
            history = await self.conversations.list_messages(conversation_id)
            context = self.build_context(history)
            await queue.put(
                {
                    "event": "start",
                    "data": {"conversation_id": conversation_id, "assistant_message_id": assistant_id, "provider": provider_name, "model": model},
                }
            )
            async for chunk in resolved.provider.stream(context, resolved.options, active.cancel):
                partial.append(chunk)
                await queue.put({"event": "delta", "data": {"content": chunk}})
                if active.cancel.cancelled:
                    break

            status = "cancelled" if active.cancel.cancelled else "complete"
            record = await self.conversations.add_message(
                conversation_id,
                "assistant",
                "".join(partial),
                status=status,
                provider=provider_name,
                model=model,
                message_id=assistant_id,
            )
            conversation = await self.conversations.get(conversation_id)
            await queue.put(
                {
                    "event": "done",
                    "data": {
                        "message": to_message_schema(record).model_dump(),
                        "conversation": to_conversation_schema(conversation).model_dump(),
                        "cancelled": status == "cancelled",
                    },
                }
            )
        except GenerationCancelled:
            await self._persist_partial_and_emit(queue, conversation_id, assistant_id, partial, provider_name, model, "cancelled", None)
        except AppError as exc:
            await self._persist_partial_and_emit(queue, conversation_id, assistant_id, partial, provider_name, model, "error", exc)
        except Exception:  # noqa: BLE001 - never leak internals to the client
            logger.exception("Unexpected generation failure")
            error = AppError("The response could not be generated because of an unexpected local error.")
            await self._persist_partial_and_emit(queue, conversation_id, assistant_id, partial, provider_name, model, "error", error)
        finally:
            self.generations.finish(conversation_id, active.generation_id)
            await queue.put(_END)

    async def _persist_partial_and_emit(
        self,
        queue: asyncio.Queue[Any],
        conversation_id: str,
        assistant_id: str,
        partial: list[str],
        provider_name: str | None,
        model: str | None,
        status: str,
        error: AppError | None,
    ) -> None:
        message_payload: dict[str, Any] | None = None
        content = "".join(partial)
        if content or status == "cancelled":
            try:
                record = await self.conversations.add_message(
                    conversation_id, "assistant", content, status=status, provider=provider_name, model=model, message_id=assistant_id
                )
                message_payload = to_message_schema(record).model_dump()
            except AppError:
                logger.warning("Could not persist partial assistant message")
        if error is None:
            await queue.put({"event": "done", "data": {"message": message_payload, "conversation": None, "cancelled": True}})
        else:
            await queue.put(
                {
                    "event": "error",
                    "data": {"code": error.code, "message": error.message, "details": error.details, "status_code": error.status_code, "partial_message": message_payload},
                }
            )
