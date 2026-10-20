"""Tracks in-flight generations so they can be serialised per conversation and cancelled.

Only one generation may run for a given conversation at a time. Starting a second
one fails fast with 409 instead of queueing, which keeps conversation state from
being interleaved by concurrent requests.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.core.errors import ConflictError
from app.providers.base import CancelToken


@dataclass
class ActiveGeneration:
    conversation_id: str
    generation_id: str
    cancel: CancelToken = field(default_factory=CancelToken)


class GenerationRegistry:
    def __init__(self) -> None:
        self._active: dict[str, ActiveGeneration] = {}

    def is_busy(self, conversation_id: str) -> bool:
        return conversation_id in self._active

    def get(self, conversation_id: str) -> ActiveGeneration | None:
        return self._active.get(conversation_id)

    def start(self, conversation_id: str, generation_id: str) -> ActiveGeneration:
        if conversation_id in self._active:
            raise ConflictError(
                "A response is already being generated for this conversation. Wait for it to finish or stop it first.",
                details={"conversation_id": conversation_id},
            )
        active = ActiveGeneration(conversation_id=conversation_id, generation_id=generation_id)
        self._active[conversation_id] = active
        return active

    def finish(self, conversation_id: str, generation_id: str) -> None:
        active = self._active.get(conversation_id)
        if active is not None and active.generation_id == generation_id:
            del self._active[conversation_id]

    def cancel(self, conversation_id: str) -> bool:
        active = self._active.get(conversation_id)
        if active is None:
            return False
        active.cancel.cancel()
        return True

    def cancel_all(self) -> None:
        for active in list(self._active.values()):
            active.cancel.cancel()
