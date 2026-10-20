import asyncio

import httpx

from app.core.chat_service import title_from_prompt


async def test_blank_message_rejected(client: httpx.AsyncClient):
    response = await client.post("/api/chat", json={"message": "   "})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


async def test_message_over_limit_rejected(client: httpx.AsyncClient):
    response = await client.post("/api/chat", json={"message": "x" * 8001})
    assert response.status_code == 422
    body = response.json()["error"]
    assert body["code"] == "validation_error"
    assert body["details"]["max_chars"] == 8000


async def test_unknown_conversation_rejected(client: httpx.AsyncClient):
    response = await client.post("/api/chat", json={"conversation_id": "deadbeef", "message": "hi"})
    assert response.status_code == 404


async def test_invalid_override_values_rejected(client: httpx.AsyncClient):
    response = await client.post("/api/chat", json={"message": "hi", "options": {"temperature": -1}})
    assert response.status_code == 422
    response = await client.post("/api/chat", json={"message": "hi", "options": {"max_tokens": 999999}})
    assert response.status_code == 422


async def test_regenerate_replaces_last_assistant_message(client: httpx.AsyncClient):
    first = await client.post("/api/chat", json={"message": "hello"})
    conversation_id = first.json()["conversation"]["id"]
    original_id = first.json()["assistant_message"]["id"]

    regenerated = await client.post(f"/api/chat/{conversation_id}/regenerate", json={"stream": False})
    assert regenerated.status_code == 200
    assert regenerated.json()["user_message"] is None
    assert regenerated.json()["assistant_message"]["id"] != original_id

    detail = (await client.get(f"/api/conversations/{conversation_id}")).json()
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant"]


async def test_regenerate_streaming_variant(client: httpx.AsyncClient):
    first = await client.post("/api/chat", json={"message": "hello"})
    conversation_id = first.json()["conversation"]["id"]
    response = await client.post(f"/api/chat/{conversation_id}/regenerate", json={"stream": True})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: done" in response.text


async def test_regenerate_on_empty_conversation_fails_cleanly(client: httpx.AsyncClient):
    created = await client.post("/api/conversations")
    response = await client.post(f"/api/chat/{created.json()['id']}/regenerate")
    assert response.status_code == 400


async def test_concurrent_requests_on_same_conversation_conflict(client: httpx.AsyncClient, config):
    created = await client.post("/api/conversations")
    conversation_id = created.json()["id"]

    # Slow the demo provider down so the first request is still running when the second arrives.
    from app.providers.demo import DemoProvider

    client_app = client._transport.app  # type: ignore[attr-defined]
    client_app.state.providers._providers["demo"] = DemoProvider(token_delay_seconds=0.02)

    first = asyncio.create_task(client.post("/api/chat", json={"conversation_id": conversation_id, "message": "hello"}))
    await asyncio.sleep(0.1)
    second = await client.post("/api/chat", json={"conversation_id": conversation_id, "message": "again"})
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "conflict"

    first_response = await first
    assert first_response.status_code == 200

    detail = (await client.get(f"/api/conversations/{conversation_id}")).json()
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant"]


def test_title_from_prompt_truncates():
    assert title_from_prompt("hello") == "hello"
    assert title_from_prompt("  first line\nsecond ") == "first line"
    long = "word " * 40
    title = title_from_prompt(long)
    assert len(title) <= 60
    assert title.endswith("…")
