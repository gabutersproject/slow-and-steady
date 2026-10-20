import asyncio
import json

import httpx
import pytest
import respx

from app.core.errors import GenerationTimeoutError, ModelNotFoundError, ProviderUnavailableError
from app.providers.base import CancelToken, ChatMessage, GenerationOptions
from app.providers.ollama import OllamaProvider, model_is_installed
from app.schemas.ai import ModelInfo
from tests.conftest import OLLAMA_URL, ndjson_stream, mock_ollama_offline, mock_ollama_online, parse_sse


def _provider() -> OllamaProvider:
    return OllamaProvider(OLLAMA_URL, connect_timeout=1, read_timeout=2)


def _options(model: str | None = "qwen2.5:1.5b") -> GenerationOptions:
    return GenerationOptions(model=model, temperature=0.5, max_tokens=128, system_prompt="Be brief.")


async def test_availability_check_detects_offline_and_online(ollama_mock: respx.MockRouter):
    provider = _provider()
    mock_ollama_offline(ollama_mock)
    assert await provider.is_available() is False

    ollama_mock.reset()
    mock_ollama_online(ollama_mock)
    assert await provider.is_available() is True
    assert await provider.version() == "0.5.0"


async def test_list_models_parses_ollama_tags(ollama_mock: respx.MockRouter):
    mock_ollama_online(ollama_mock)
    models = await _provider().list_models()
    assert [m.name for m in models] == ["qwen2.5:1.5b", "llama3.2:latest"]
    assert models[0].parameter_size == "1.5B"
    assert models[0].quantization == "Q4_K_M"


async def test_list_models_raises_when_offline(ollama_mock: respx.MockRouter):
    mock_ollama_offline(ollama_mock)
    with pytest.raises(ProviderUnavailableError):
        await _provider().list_models()


def test_model_is_installed_accepts_latest_alias():
    installed = [ModelInfo(name="llama3.2:latest"), ModelInfo(name="qwen2.5:1.5b")]
    assert model_is_installed("llama3.2", installed)
    assert model_is_installed("llama3.2:latest", installed)
    assert model_is_installed("qwen2.5:1.5b", installed)
    assert not model_is_installed("qwen2.5", installed)
    assert not model_is_installed(None, installed)


async def test_stream_sends_system_prompt_and_options(ollama_mock: respx.MockRouter):
    mock_ollama_online(ollama_mock, chunks=["Hi", " there"])
    provider = _provider()
    chunks = [c async for c in provider.stream([ChatMessage(role="user", content="hey")], _options(), CancelToken())]
    assert chunks == ["Hi", " there"]

    sent = json.loads(ollama_mock.calls.last.request.content)
    assert sent["model"] == "qwen2.5:1.5b"
    assert sent["stream"] is True
    assert sent["messages"][0] == {"role": "system", "content": "Be brief."}
    assert sent["messages"][1] == {"role": "user", "content": "hey"}
    assert sent["options"] == {"temperature": 0.5, "num_predict": 128}


async def test_generate_non_streaming(ollama_mock: respx.MockRouter):
    mock_ollama_online(ollama_mock)
    ollama_mock.post("/api/chat").mock(
        return_value=httpx.Response(200, json={"model": "qwen2.5:1.5b", "message": {"role": "assistant", "content": "Done."}, "done": True})
    )
    result = await _provider().generate([ChatMessage(role="user", content="go")], _options(), CancelToken())
    assert result.content == "Done."
    assert result.provider == "ollama"


async def test_missing_model_maps_to_model_not_found(ollama_mock: respx.MockRouter):
    ollama_mock.post("/api/chat").mock(return_value=httpx.Response(404, json={"error": "model 'nope' not found, try pulling it first"}))
    with pytest.raises(ModelNotFoundError):
        async for _ in _provider().stream([ChatMessage(role="user", content="x")], _options("nope"), CancelToken()):
            pass


async def test_timeout_maps_to_generation_timeout(ollama_mock: respx.MockRouter):
    ollama_mock.post("/api/chat").mock(side_effect=httpx.ReadTimeout("slow"))
    with pytest.raises(GenerationTimeoutError):
        async for _ in _provider().stream([ChatMessage(role="user", content="x")], _options(), CancelToken()):
            pass


async def test_stream_stops_on_cancel(ollama_mock: respx.MockRouter):
    mock_ollama_online(ollama_mock, chunks=["a", "b", "c", "d", "e"])
    cancel = CancelToken()
    received = []
    async for chunk in _provider().stream([ChatMessage(role="user", content="x")], _options(), cancel):
        received.append(chunk)
        if len(received) == 2:
            cancel.cancel()
    assert received == ["a", "b"]


# ---- API level --------------------------------------------------------------


async def _select_ollama(client: httpx.AsyncClient, model: str | None = "qwen2.5:1.5b") -> None:
    response = await client.put("/api/settings", json={"provider": "ollama", "model": model})
    assert response.status_code == 200


async def test_status_ready_only_after_verifying_ollama(client: httpx.AsyncClient, ollama_mock: respx.MockRouter):
    await _select_ollama(client)
    mock_ollama_offline(ollama_mock)
    body = (await client.get("/api/ai/status")).json()
    assert body["state"] == "offline"
    assert body["ollama"]["available"] is False
    assert "ollama.com" in body["message"]

    ollama_mock.reset()
    mock_ollama_online(ollama_mock)
    body = (await client.get("/api/ai/status")).json()
    assert body["state"] == "ready"
    assert body["model_available"] is True
    assert body["ollama"]["model_count"] == 2


async def test_status_reports_no_models_and_model_not_found(client: httpx.AsyncClient, ollama_mock: respx.MockRouter):
    await _select_ollama(client, "qwen2.5:1.5b")
    mock_ollama_online(ollama_mock, tags={"models": []})
    body = (await client.get("/api/ai/status")).json()
    assert body["state"] == "no_models"
    assert "ollama pull" in body["message"]

    ollama_mock.reset()
    mock_ollama_online(ollama_mock)
    await _select_ollama(client, "mistral:7b")
    body = (await client.get("/api/ai/status")).json()
    assert body["state"] == "model_not_found"


async def test_models_endpoint_lists_installed_models(client: httpx.AsyncClient, ollama_mock: respx.MockRouter):
    mock_ollama_online(ollama_mock)
    body = (await client.get("/api/ai/models")).json()
    assert body["ollama_available"] is True
    assert [m["name"] for m in body["models"]] == ["qwen2.5:1.5b", "llama3.2:latest"]
    assert body["suggested_model"] == "qwen2.5:1.5b"

    ollama_mock.reset()
    mock_ollama_offline(ollama_mock)
    body = (await client.get("/api/ai/models")).json()
    assert body["ollama_available"] is False
    assert body["models"] == []
    assert body["message"]


async def test_chat_with_ollama_persists_model_name(client: httpx.AsyncClient, ollama_mock: respx.MockRouter):
    await _select_ollama(client)
    mock_ollama_online(ollama_mock, chunks=["Local", " answer."])
    response = await client.post("/api/chat", json={"message": "hi"})
    assert response.status_code == 200
    assistant = response.json()["assistant_message"]
    assert assistant["content"] == "Local answer."
    assert assistant["provider"] == "ollama"
    assert assistant["model"] == "qwen2.5:1.5b"


async def test_ollama_offline_does_not_fall_back_to_demo(client: httpx.AsyncClient, ollama_mock: respx.MockRouter):
    await _select_ollama(client)
    mock_ollama_offline(ollama_mock)
    response = await client.post("/api/chat", json={"message": "hi"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "provider_unavailable"

    # The user message is kept, but no assistant message is fabricated.
    conversations = (await client.get("/api/conversations")).json()
    detail = (await client.get(f"/api/conversations/{conversations[0]['id']}")).json()
    assert [m["role"] for m in detail["messages"]] == ["user"]


async def test_stream_error_event_when_model_missing(client: httpx.AsyncClient, ollama_mock: respx.MockRouter):
    await _select_ollama(client, "missing:1b")
    mock_ollama_online(ollama_mock)
    response = await client.post("/api/chat/stream", json={"message": "hi"})
    assert response.status_code == 200
    events = parse_sse(response.text)
    assert events[-1][0] == "error"
    assert events[-1][1]["code"] == "model_not_found"
    assert "ollama pull" in events[-1][1]["message"] or "not installed" in events[-1][1]["message"]


async def test_stream_with_ollama_streams_deltas(client: httpx.AsyncClient, ollama_mock: respx.MockRouter):
    await _select_ollama(client)
    mock_ollama_online(ollama_mock, chunks=["Stream", "ing", " works"])
    response = await client.post("/api/chat/stream", json={"message": "hi"})
    events = parse_sse(response.text)
    deltas = [data["content"] for name, data in events if name == "delta"]
    assert deltas == ["Stream", "ing", " works"]
    assert events[-1][0] == "done"
    assert events[-1][1]["message"]["model"] == "qwen2.5:1.5b"


async def test_generation_failure_mid_stream_is_reported_not_hidden(client: httpx.AsyncClient, ollama_mock: respx.MockRouter):
    await _select_ollama(client)
    mock_ollama_online(ollama_mock)
    body = ndjson_stream(["Partial"]).decode().splitlines()[0] + "\n" + json.dumps({"error": "out of memory"}) + "\n"
    ollama_mock.post("/api/chat").mock(return_value=httpx.Response(200, content=body.encode()))
    response = await client.post("/api/chat/stream", json={"message": "hi"})
    events = parse_sse(response.text)
    assert events[-1][0] == "error"
    assert events[-1][1]["code"] == "generation_failed"
    assert events[-1][1]["partial_message"]["status"] == "error"
    assert events[-1][1]["partial_message"]["content"] == "Partial"


async def test_cancel_endpoint_stops_in_flight_generation(client: httpx.AsyncClient, ollama_mock: respx.MockRouter):
    await _select_ollama(client)
    mock_ollama_online(ollama_mock)

    async def slow_stream(request: httpx.Request) -> httpx.Response:
        async def body():
            for i in range(50):
                yield json.dumps({"message": {"role": "assistant", "content": f"tok{i} "}, "done": False}).encode() + b"\n"
                await asyncio.sleep(0.05)
            yield json.dumps({"message": {"role": "assistant", "content": ""}, "done": True}).encode() + b"\n"

        return httpx.Response(200, stream=_AsyncStream(body()))

    ollama_mock.post("/api/chat").mock(side_effect=slow_stream)

    created = await client.post("/api/conversations")
    conversation_id = created.json()["id"]

    async def run_chat():
        return await client.post("/api/chat", json={"conversation_id": conversation_id, "message": "go"})

    task = asyncio.create_task(run_chat())
    await asyncio.sleep(0.3)
    cancel = await client.post(f"/api/chat/{conversation_id}/cancel")
    assert cancel.json()["cancelled"] is True
    response = await task
    assert response.status_code == 200
    assistant = response.json()["assistant_message"]
    assert assistant["status"] == "cancelled"
    assert assistant["content"].startswith("tok0")
    assert len(assistant["content"]) < len("tok0 " * 50)


class _AsyncStream(httpx.AsyncByteStream):
    def __init__(self, gen):
        self._gen = gen

    async def __aiter__(self):
        async for chunk in self._gen:
            yield chunk
