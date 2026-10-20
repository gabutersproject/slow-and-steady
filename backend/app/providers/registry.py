"""Selects the active provider from the stored settings.

There is deliberately no fallback: if the user selected Ollama and it is not
reachable, the request fails with an actionable error instead of silently
switching to the demo provider.
"""

from __future__ import annotations

from app.core.config import Settings
from app.providers.base import AIProvider
from app.providers.demo import DemoProvider
from app.providers.ollama import OllamaProvider
from app.schemas.settings import ProviderName


class ProviderRegistry:
    def __init__(self, settings: Settings, *, ollama: OllamaProvider | None = None, demo: DemoProvider | None = None) -> None:
        self.settings = settings
        self._providers: dict[str, AIProvider] = {
            "demo": demo or DemoProvider(token_delay_seconds=settings.demo_token_delay_seconds),
            "ollama": ollama
            or OllamaProvider(
                settings.ollama_base_url,
                connect_timeout=settings.ollama_connect_timeout_seconds,
                read_timeout=settings.ollama_read_timeout_seconds,
            ),
        }

    def get(self, name: ProviderName) -> AIProvider:
        try:
            return self._providers[name]
        except KeyError as exc:
            raise ValueError(f"Unknown provider '{name}'") from exc

    @property
    def ollama(self) -> OllamaProvider:
        provider = self._providers["ollama"]
        assert isinstance(provider, OllamaProvider)
        return provider

    @property
    def demo(self) -> DemoProvider:
        provider = self._providers["demo"]
        assert isinstance(provider, DemoProvider)
        return provider

    def names(self) -> list[str]:
        return list(self._providers)
