import httpx


async def test_conversation_crud_roundtrip(client: httpx.AsyncClient):
    created = await client.post("/api/conversations", json={"title": "Planning"})
    assert created.status_code == 201
    conversation = created.json()
    assert conversation["title"] == "Planning"
    assert conversation["message_count"] == 0

    listed = await client.get("/api/conversations")
    assert [c["id"] for c in listed.json()] == [conversation["id"]]

    renamed = await client.patch(f"/api/conversations/{conversation['id']}", json={"title": "  Weekly planning  "})
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Weekly planning"

    detail = await client.get(f"/api/conversations/{conversation['id']}")
    assert detail.status_code == 200
    assert detail.json()["messages"] == []

    deleted = await client.delete(f"/api/conversations/{conversation['id']}")
    assert deleted.status_code == 204

    missing = await client.get(f"/api/conversations/{conversation['id']}")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"


async def test_create_without_body_uses_default_title(client: httpx.AsyncClient):
    created = await client.post("/api/conversations")
    assert created.status_code == 201
    assert created.json()["title"] == "New chat"


async def test_rename_rejects_blank_title(client: httpx.AsyncClient):
    created = await client.post("/api/conversations")
    response = await client.patch(f"/api/conversations/{created.json()['id']}", json={"title": "   "})
    assert response.status_code == 422


async def test_invalid_conversation_id_is_rejected(client: httpx.AsyncClient):
    response = await client.get("/api/conversations/../etc/passwd")
    assert response.status_code in (404, 422)
    response = await client.get("/api/conversations/not-valid-id!")
    assert response.status_code == 422


async def test_clear_all_requires_confirmation(client: httpx.AsyncClient):
    await client.post("/api/conversations")
    await client.post("/api/conversations")

    refused = await client.delete("/api/conversations")
    assert refused.status_code == 409
    assert len((await client.get("/api/conversations")).json()) == 2

    confirmed = await client.delete("/api/conversations", params={"confirm": "true"})
    assert confirmed.status_code == 200
    assert confirmed.json()["deleted"] == 2
    assert (await client.get("/api/conversations")).json() == []


async def test_messages_persist_across_chat_turns(client: httpx.AsyncClient):
    first = await client.post("/api/chat", json={"message": "hello"})
    assert first.status_code == 200
    conversation_id = first.json()["conversation"]["id"]
    assert first.json()["conversation"]["title"] == "hello"

    second = await client.post("/api/chat", json={"conversation_id": conversation_id, "message": "tell me about privacy"})
    assert second.status_code == 200

    detail = (await client.get(f"/api/conversations/{conversation_id}")).json()
    roles = [m["role"] for m in detail["messages"]]
    assert roles == ["user", "assistant", "user", "assistant"]
    assert all(m["status"] == "complete" for m in detail["messages"])
    assert detail["message_count"] == 4
