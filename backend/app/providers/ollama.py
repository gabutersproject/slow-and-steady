"""Ollama provider: talks to the local Ollama HTTP API.

Only the configured base URL (``127.0.0.1:11434`` by default) is ever contacted.
Models are never downloaded by this provider; pulling a model is an explicit
action the user performs with the ``ollama`` CLI.
"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator

import httpx

from app.core.errors import (
    GenerationCancelled,
    GenerationError,
    GenerationTimeoutError,
    ModelNotFoundError,
    NoModelsInstalledError,
    ProviderUnavailableError,
)
from app.providers.base import AIProvider, CancelToken, ChatMessage, GenerationOptions, GenerationResult
from app.schemas.ai import ModelInfo

logger = logging.getLogger("slow_and_steady.ollama")

OLLAMA_INSTALL_HINT = (
    "Ollama is not reachable. Install it from https://ollama.com, start it (`ollama serve` or the desktop app) "
    "and make sure it listens on the configured address."
)


class OllamaProvider(AIProvider):
    name = "ollama"

    def __init__(
        self,
        base_url: str,
        *,
        connect_timeout: float = 3.0,
        read_timeout: float = 120.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self._timeout = httpx.Timeout(connect=connect_timeout, read=read_timeout, write=10.0, pool=connect_timeout)
        self._client = client

    def _client_or_new(self) -> httpx.AsyncClient:
        return self._client or httpx.AsyncClient(timeout=self._timeout)

    async def _close_if_owned(self, client: httpx.AsyncClient) -> None:
        if client is not self._client:
            await client.aclose()

    # ---- availability ---------------------------------------------------

    async def version(self) -> str | None:
        client = self._client_or_new()
        try:
            response = await client.get(f"{self.base_url}/api/version")
            response.raise_for_status()
            data = response.json()
            return str(data.get("version")) if isinstance(data, dict) else None
        except (httpx.HTTPError, ValueError):
            return None
        finally:
            await self._close_if_owned(client)

    async def is_available(self) -> bool:
        return await self.version() is not None

    async def list_models(self) -> list[ModelInfo]:
        client = self._client_or_new()
        try:
            response = await client.get(f"{self.base_url}/api/tags")
            response.raise_for_status()
            payload = response.json()
        except httpx.HTTPError as exc:
            logger.info("Ollama unavailable while listing models: %s", exc.__class__.__name__)
            raise ProviderUnavailableError(OLLAMA_INSTALL_HINT) from exc
        except ValueError as exc:
            raise GenerationError("Ollama returned an unexpected response while listing models.") from exc
        finally:
            await self._close_if_owned(client)

        models: list[ModelInfo] = []
        for item in payload.get("models", []) if isinstance(payload, dict) else []:
            if not isinstance(item, dict) or not item.get("name"):
                continue
            details = item.get("details") or {}
            models.append(
                ModelInfo(
                    name=str(item["name"]),
                    size_bytes=item.get("size"),
                    parameter_size=details.get("parameter_size"),
                    quantization=details.get("quantization_level"),
                    family=details.get("family"),
                    modified_at=item.get("modified_at"),
                )
            )
        return models

    # ---- generation -----------------------------------------------------

    def _build_payload(self, messages: list[ChatMessage], options: GenerationOptions, stream: bool) -> dict[str, Any]:
        if not options.model:
            raise ModelNotFoundError("No model is selected. Choose an installed model in the sidebar.")
        chat_messages: list[dict[str, str]] = []
        if options.system_prompt.strip():
            chat_messages.append({"role": "system", "content": options.system_prompt.strip()})
        chat_messages.extend({"role": m.role, "content": m.content} for m in messages)
        return {
            "model": options.model,
            "messages": chat_messages,
            "stream": stream,
            "options": {"temperature": options.temperature, "num_predict": options.max_tokens},
        }

    @staticmethod
    def _translate_error(exc: Exception, model: str | None) -> Exception:
        if isinstance(exc, httpx.ConnectError):
            return ProviderUnavailableError(OLLAMA_INSTALL_HINT)
        if isinstance(exc, (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.WriteTimeout, httpx.PoolTimeout)):
            return GenerationTimeoutError(
                "The local model took too long to respond. Try a shorter prompt, a smaller model, or increase the timeout."
            )
        if isinstance(exc, httpx.HTTPStatusError):
            status = exc.response.status_code
            message = _extract_error_message(exc.response)
            if status == 404 or "not found" in message.lower():
                return ModelNotFoundError(
                    f"The model '{model}' is not installed. Run `ollama pull {model}` or select another model.",
                    details={"model": model},
                )
            return GenerationError(f"Ollama could not generate a response ({status}). {message}".strip())
        if isinstance(exc, httpx.HTTPError):
            return GenerationError("The connection to Ollama was interrupted before the response finished.")
        return GenerationError("The local model failed to generate a response.")

    async def generate(self, messages: list[ChatMessage], options: GenerationOptions, cancel: CancelToken) -> GenerationResult:
        payload = self._build_payload(messages, options, stream=False)
        client = self._client_or_new()
        try:
            response = await cancel.race(client.post(f"{self.base_url}/api/chat", json=payload))
            if response is None:
                raise GenerationCancelled("Generation was stopped.")
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError as exc:
            raise self._translate_error(exc, options.model) from exc
        except ValueError as exc:
            raise GenerationError("Ollama returned a response that could not be read.") from exc
        finally:
            await self._close_if_owned(client)

        message = data.get("message") if isinstance(data, dict) else None
        content = message.get("content", "") if isinstance(message, dict) else ""
        if not isinstance(content, str):
            raise GenerationError("Ollama returned a response that could not be read.")
        finish = "length" if data.get("done_reason") == "length" else "stop"
        return GenerationResult(content=content, model=options.model, provider=self.name, finish_reason=finish)

    async def stream(self, messages: list[ChatMessage], options: GenerationOptions, cancel: CancelToken) -> AsyncIterator[str]:
        payload = self._build_payload(messages, options, stream=True)
        client = self._client_or_new()
        try:
            async with client.stream("POST", f"{self.base_url}/api/chat", json=payload) as response:
                if response.status_code >= 400:
                    await response.aread()
                    raise httpx.HTTPStatusError("Ollama error", request=response.request, response=response)
                lines = response.aiter_lines()
                while True:
                    if cancel.cancelled:
                        return
                    try:
                        line = await cancel.race(lines.__anext__())
                    except StopAsyncIteration:
                        return
                    if line is None:  # cancelled while waiting for the next chunk
                        return
                    if not line.strip():
                        continue
                    try:
                        event = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if isinstance(event, dict) and event.get("error"):
                        raise GenerationError(f"Ollama reported an error: {event['error']}")
                    message = event.get("message") if isinstance(event, dict) else None
                    chunk = message.get("content", "") if isinstance(message, dict) else ""
                    if chunk:
                        yield chunk
                    if isinstance(event, dict) and event.get("done"):
                        return
        except httpx.HTTPError as exc:
            raise self._translate_error(exc, options.model) from exc
        finally:
            await self._close_if_owned(client)

    # ---- helpers --------------------------------------------------------

    async def ensure_model(self, model: str | None, installed: list[ModelInfo]) -> None:
        if not installed:
            raise NoModelsInstalledError(
                "Ollama is running but no models are installed. Run `ollama pull qwen2.5:1.5b` to download a small model."
            )
        if not model_is_installed(model, installed):
            raise ModelNotFoundError(
                f"The selected model '{model or '(none)'}' is not installed. Pick one of the installed models.",
                details={"model": model, "installed": [m.name for m in installed]},
            )


def model_is_installed(model: str | None, installed: list[ModelInfo]) -> bool:
    """Ollama lists untagged models as ``name:latest``; accept both spellings."""
    if not model:
        return False
    candidates = {model, f"{model}:latest"} if ":" not in model else {model}
    return any(m.name in candidates for m in installed)


def _extract_error_message(response: httpx.Response) -> str:
    try:
        data = response.json()
        if isinstance(data, dict) and isinstance(data.get("error"), str):
            return data["error"]
    except ValueError:
        pass
    return ""
