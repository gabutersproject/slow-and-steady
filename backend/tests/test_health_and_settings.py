import httpx


async def test_health_reports_ok(client: httpx.AsyncClient):
    response = await client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    assert body["app"] == "Slow and Steady"


async def test_settings_defaults_to_demo_provider(client: httpx.AsyncClient):
    response = await client.get("/api/settings")
    assert response.status_code == 200
    body = response.json()
    assert body["settings"]["provider"] == "demo"
    assert body["settings"]["temperature"] == 0.7
    assert body["settings"]["max_tokens"] == 1024
    assert body["limits"]["message_max_chars"] == 8000


async def test_settings_update_persists_partial_changes(client: httpx.AsyncClient):
    response = await client.put("/api/settings", json={"temperature": 0.2, "model": "qwen2.5:1.5b"})
    assert response.status_code == 200
    assert response.json()["settings"]["temperature"] == 0.2
    assert response.json()["settings"]["model"] == "qwen2.5:1.5b"

    # Unchanged fields are preserved.
    response = await client.get("/api/settings")
    settings = response.json()["settings"]
    assert settings["temperature"] == 0.2
    assert settings["max_tokens"] == 1024
    assert settings["provider"] == "demo"


async def test_settings_validation_rejects_out_of_range_values(client: httpx.AsyncClient):
    response = await client.put("/api/settings", json={"temperature": 5})
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["details"]["issues"][0]["field"] == "temperature"

    response = await client.put("/api/settings", json={"max_tokens": 1})
    assert response.status_code == 422

    response = await client.put("/api/settings", json={"provider": "openai"})
    assert response.status_code == 422

    response = await client.put("/api/settings", json={"model": "bad model; rm -rf"})
    assert response.status_code == 422


async def test_unknown_route_returns_consistent_json_error(client: httpx.AsyncClient):
    response = await client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


async def test_oversized_body_is_rejected(client: httpx.AsyncClient):
    response = await client.post(
        "/api/chat",
        content=b"{}",
        headers={"content-type": "application/json", "content-length": str(10 * 1024 * 1024)},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "payload_too_large"
