"""Shared fixtures. Ollama is always mocked with respx; no model download is needed."""

from __future__ import annotations

import json
from pathlib import Path
from typing import AsyncIterator

import httpx
import pytest
import respx
from asgi_lifespan import LifespanManager

from app.core.config import Settings
from app.main import create_app
from app.providers.demo import DemoProvider
from app.providers.ollama import OllamaProvider
from app.providers.registry import ProviderRegistry

OLLAMA_URL = "http://ollama.test:11434"


def make_settings(tmp_path: Path) -> Settings:
    return Settings(
        database_path=tmp_path / "test.sqlite3",
        ollama_base_url=OLLAMA_URL,
        demo_token_delay_seconds=0.0,
        _env_file=None,  # type: ignore[call-arg]
    )


@pytest.fixture
def config(tmp_path: Path) -> Settings:
    return make_settings(tmp_path)


@pytest.fixture
def ollama_mock() -> AsyncIterator[respx.MockRouter]:
    with respx.mock(base_url=OLLAMA_URL, assert_all_called=False) as router:
        yield router


@pytest.fixture
async def client(config: Settings, ollama_mock: respx.MockRouter) -> AsyncIterator[httpx.AsyncClient]:
    providers = ProviderRegistry(
        config,
        ollama=OllamaProvider(config.ollama_base_url, connect_timeout=1, read_timeout=5),
        demo=DemoProvider(token_delay_seconds=0.0),
    )
    app = create_app(config, providers=providers)
    async with LifespanManager(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as http:
            yield http


# ---- Ollama response helpers ------------------------------------------------

TAGS_PAYLOAD = {
    "models": [
        {
            "name": "qwen2.5:1.5b",
            "size": 986_000_000,
            "modified_at": "2026-01-01T00:00:00Z",
            "details": {"family": "qwen2", "parameter_size": "1.5B", "quantization_level": "Q4_K_M"},
        },
        {"name": "llama3.2:latest", "size": 2_000_000_000, "details": {"family": "llama", "parameter_size": "3.2B"}},
    ]
}


def ndjson_stream(chunks: list[str], model: str = "qwen2.5:1.5b") -> bytes:
    lines = [json.dumps({"model": model, "message": {"role": "assistant", "content": c}, "done": False}) for c in chunks]
    lines.append(json.dumps({"model": model, "message": {"role": "assistant", "content": ""}, "done": True, "done_reason": "stop"}))
    return ("\n".join(lines) + "\n").encode()


def mock_ollama_online(router: respx.MockRouter, chunks: list[str] | None = None, tags: dict | None = None) -> None:
    router.get("/api/version").mock(return_value=httpx.Response(200, json={"version": "0.5.0"}))
    router.get("/api/tags").mock(return_value=httpx.Response(200, json=tags if tags is not None else TAGS_PAYLOAD))
    router.post("/api/chat").mock(return_value=httpx.Response(200, content=ndjson_stream(chunks or ["Hello", " from", " Ollama."])))


def mock_ollama_offline(router: respx.MockRouter) -> None:
    router.get("/api/version").mock(side_effect=httpx.ConnectError("refused"))
    router.get("/api/tags").mock(side_effect=httpx.ConnectError("refused"))
    router.post("/api/chat").mock(side_effect=httpx.ConnectError("refused"))


def parse_sse(body: str) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    for block in body.strip().split("\n\n"):
        name, data = None, None
        for line in block.splitlines():
            if line.startswith("event: "):
                name = line[7:]
            elif line.startswith("data: "):
                data = json.loads(line[6:])
        if name is not None:
            events.append((name, data or {}))
    return events
