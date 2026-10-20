"""Request and response schemas for conversations and chat."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.settings import (
    MAX_TOKENS_MAX,
    MAX_TOKENS_MIN,
    SYSTEM_PROMPT_MAX,
    TEMPERATURE_MAX,
    TEMPERATURE_MIN,
    normalize_model_name,
)

MessageRole = Literal["user", "assistant", "system"]
MessageStatus = Literal["complete", "cancelled", "error"]


class Message(BaseModel):
    id: str
    conversation_id: str
    role: MessageRole
    content: str
    status: MessageStatus = "complete"
    provider: str | None = None
    model: str | None = None
    created_at: str


class ConversationSummary(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int


class ConversationDetail(ConversationSummary):
    messages: list[Message]


class ConversationCreate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be empty.")
        return value


class ConversationUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def _strip(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be empty.")
        return value


class GenerationOverrides(BaseModel):
    """Per-request overrides for the stored settings. All optional."""

    model: str | None = Field(default=None, max_length=200)
    temperature: float | None = Field(default=None, ge=TEMPERATURE_MIN, le=TEMPERATURE_MAX)
    max_tokens: int | None = Field(default=None, ge=MAX_TOKENS_MIN, le=MAX_TOKENS_MAX)
    system_prompt: str | None = Field(default=None, max_length=SYSTEM_PROMPT_MAX)

    @field_validator("model")
    @classmethod
    def _validate_model(cls, value: str | None) -> str | None:
        return normalize_model_name(value)


class ChatRequest(BaseModel):
    conversation_id: str | None = Field(default=None, min_length=1, max_length=64)
    message: str = Field(min_length=1)
    options: GenerationOverrides | None = None

    @field_validator("message")
    @classmethod
    def _non_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Message cannot be blank.")
        return value

    @field_validator("conversation_id")
    @classmethod
    def _id_format(cls, value: str | None) -> str | None:
        if value is not None and not value.isalnum():
            raise ValueError("Invalid conversation id.")
        return value


class RegenerateRequest(BaseModel):
    stream: bool = False
    options: GenerationOverrides | None = None


class ChatResponse(BaseModel):
    conversation: ConversationSummary
    user_message: Message | None
    assistant_message: Message


class DeleteAllResponse(BaseModel):
    deleted: int
