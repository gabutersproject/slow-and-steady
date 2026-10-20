import httpx

from app.providers.base import CancelToken, ChatMessage, GenerationOptions
from app.providers.demo import DEMO_FOOTER, DemoProvider, pick_demo_response
from tests.conftest import parse_sse


def _options() -> GenerationOptions:
    return GenerationOptions(model=None, temperature=0.7, max_tokens=256, system_prompt="")


def test_demo_responses_are_labelled_as_scripted():
    for prompt in ["hello", "explain gravity", "help me write better code", "summarize this", "random gibberish 12345"]:
        response = pick_demo_response(prompt)
        assert response.endswith(DEMO_FOOTER)
        assert "scripted reply" in response


def test_demo_picks_topic_specific_response():
    assert "```python" in pick_demo_response("Help me write better code")
    assert "project ideas" in pick_demo_response("Brainstorm a new project")
    assert "SQLite" in pick_demo_response("How do you handle privacy?")
    assert "handful of scripted replies" in pick_demo_response("zzzz qqqq")


async def test_demo_provider_is_always_available_and_streams():
    provider = DemoProvider(token_delay_seconds=0.0)
    assert await provider.is_available() is True
    models = await provider.list_models()
    assert models[0].name == "demo-scripted"

    messages = [ChatMessage(role="user", content="teach me something new")]
    full = await provider.generate(messages, _options(), CancelToken())
    streamed = "".join([chunk async for chunk in provider.stream(messages, _options(), CancelToken())])
    assert streamed == full.content
    assert full.provider == "demo"


async def test_demo_stream_stops_when_cancelled():
    provider = DemoProvider(token_delay_seconds=0.0)
    cancel = CancelToken()
    chunks: list[str] = []
    async for chunk in provider.stream([ChatMessage(role="user", content="hello")], _options(), cancel):
        chunks.append(chunk)
        if len(chunks) == 3:
            cancel.cancel()
    assert len(chunks) == 3


async def test_chat_in_demo_mode_without_ollama(client: httpx.AsyncClient):
    response = await client.post("/api/chat", json={"message": "Explain a complex topic simply."})
    assert response.status_code == 200
    body = response.json()
    assert body["assistant_message"]["provider"] == "demo"
    assert body["assistant_message"]["status"] == "complete"
    assert "scripted reply" in body["assistant_message"]["content"]
    assert body["user_message"]["content"] == "Explain a complex topic simply."


async def test_demo_stream_endpoint_emits_sse_events(client: httpx.AsyncClient):
    response = await client.post("/api/chat/stream", json={"message": "hello"})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    events = parse_sse(response.text)
    names = [name for name, _ in events]
    assert names[0] == "accepted"
    assert names[1] == "start"
    assert "delta" in names
    assert names[-1] == "done"
    start = dict(events)["start"]
    assert start["provider"] == "demo"
    done = events[-1][1]
    assert done["cancelled"] is False
    streamed = "".join(data["content"] for name, data in events if name == "delta")
    assert streamed == done["message"]["content"]


async def test_status_reports_demo_mode(client: httpx.AsyncClient, ollama_mock):
    from tests.conftest import mock_ollama_offline

    mock_ollama_offline(ollama_mock)
    response = await client.get("/api/ai/status")
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "demo"
    assert body["state"] == "demo"
    assert body["ollama"]["available"] is False
