"""Application error types and consistent JSON error responses.

Every error returned by the API has the shape::

    {"error": {"code": "<machine_code>", "message": "<human message>", "details": {...}}}

Messages are written for end users and never include stack traces or paths.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("slow_and_steady")


class AppError(Exception):
    status_code = 500
    code = "internal_error"

    def __init__(self, message: str, *, details: dict[str, Any] | None = None, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}
        if status_code is not None:
            self.status_code = status_code

    def to_payload(self) -> dict[str, Any]:
        payload: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.details:
            payload["details"] = self.details
        return {"error": payload}


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"


class ValidationFailed(AppError):
    status_code = 422
    code = "validation_error"


class ProviderUnavailableError(AppError):
    """The inference service (Ollama) is not reachable."""

    status_code = 503
    code = "provider_unavailable"


class ModelNotFoundError(AppError):
    status_code = 404
    code = "model_not_found"


class NoModelsInstalledError(AppError):
    status_code = 409
    code = "no_models_installed"


class GenerationError(AppError):
    status_code = 502
    code = "generation_failed"


class GenerationTimeoutError(AppError):
    status_code = 504
    code = "generation_timeout"


class GenerationCancelled(AppError):
    status_code = 499
    code = "generation_cancelled"


class DatabaseError(AppError):
    status_code = 500
    code = "database_error"


def error_response(status_code: int, code: str, message: str, details: dict[str, Any] | None = None) -> JSONResponse:
    payload: dict[str, Any] = {"code": code, "message": message}
    if details:
        payload["details"] = details
    return JSONResponse(status_code=status_code, content={"error": payload})


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=exc.to_payload())

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        issues = []
        for err in exc.errors():
            loc = [str(part) for part in err.get("loc", []) if part != "body"]
            issues.append({"field": ".".join(loc) or "body", "message": err.get("msg", "Invalid value")})
        return error_response(422, "validation_error", "The request contains invalid values.", {"issues": issues})

    @app.exception_handler(StarletteHTTPException)
    async def _http_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {404: "not_found", 405: "method_not_allowed", 413: "payload_too_large"}.get(exc.status_code, "http_error")
        message = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return error_response(exc.status_code, code, message)

    @app.exception_handler(Exception)
    async def _unhandled_handler(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error: %s", exc.__class__.__name__)
        return error_response(500, "internal_error", "Something went wrong on the local server. Check the backend logs for details.")
