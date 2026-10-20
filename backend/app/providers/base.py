"""Abstract AI provider interface.

The UI and API never talk to an inference engine directly; they only use this
interface. New engines (llama.cpp, LM Studio, ...) can be added by implementing
``AIProvider`` and registering it in ``app.providers.registry``.
"""

from __future__ import annotations

import abc
import asyncio
from dataclasses import dataclass, field
from typing import AsyncIterator, Awaitable, Literal, TypeVar

from app.schemas.ai import ModelInfo

T = TypeVar("T")


@dataclass(frozen=True)
class ChatMessage:
    role: Literal["user", "assistant", "system"]
    content: str


@dataclass(frozen=True)
class GenerationOptions:
    model: str | None
    temperature: float
    max_tokens: int
    system_prompt: str


@dataclass
class GenerationResult:
    content: str
    model: str | None
    provider: str
    finish_reason: Literal["stop", "length", "cancelled"] = "stop"


@dataclass
class CancelToken:
    """Cooperative cancellation shared between the API layer and the provider."""

    event: asyncio.Event = field(default_factory=asyncio.Event)

    @property
    def cancelled(self) -> bool:
        return self.event.is_set()

    def cancel(self) -> None:
        self.event.set()

    async def race(self, awaitable: Awaitable[T]) -> T | None:
        """Await ``awaitable`` unless cancellation happens first (returns None)."""
        task = asyncio.ensure_future(awaitable)
        waiter = asyncio.ensure_future(self.event.wait())
        try:
            done, _ = await asyncio.wait({task, waiter}, return_when=asyncio.FIRST_COMPLETED)
            if task in done:
                return task.result()
            task.cancel()
            return None
        finally:
            waiter.cancel()


class AIProvider(abc.ABC):
    name: str

    @abc.abstractmethod
    async def is_available(self) -> bool:
        """Return True only after verifying that the engine can be reached."""

    @abc.abstractmethod
    async def list_models(self) -> list[ModelInfo]:
        """Return models that are installed locally and ready to use."""

    @abc.abstractmethod
    async def generate(self, messages: list[ChatMessage], options: GenerationOptions, cancel: CancelToken) -> GenerationResult:
        """Generate a full response."""

    @abc.abstractmethod
    def stream(self, messages: list[ChatMessage], options: GenerationOptions, cancel: CancelToken) -> AsyncIterator[str]:
        """Yield response text incrementally. Must stop promptly when ``cancel`` is set."""

    async def cancel(self, cancel: CancelToken) -> None:
        """Request cancellation of a generation started with ``cancel``."""
        cancel.cancel()
