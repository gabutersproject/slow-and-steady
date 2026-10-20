"""Data access for conversations, messages and settings.

The repository layer returns plain dataclass records; API schemas are built in
the route layer so the database stays independent of the HTTP contract.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import aiosqlite

from app.core.errors import DatabaseError, NotFoundError
from app.database.db import Database


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return uuid.uuid4().hex


@dataclass
class MessageRecord:
    id: str
    conversation_id: str
    role: str
    content: str
    status: str
    provider: str | None
    model: str | None
    created_at: str


@dataclass
class ConversationRecord:
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int = 0


def _wrap(exc: aiosqlite.Error) -> DatabaseError:
    return DatabaseError("The local database could not complete the request. Try again or restart the backend.")


class ConversationRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    async def list(self) -> list[ConversationRecord]:
        try:
            cursor = await self.db.conn.execute(
                """
                SELECT c.id, c.title, c.created_at, c.updated_at,
                       (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
                FROM conversations c
                ORDER BY c.updated_at DESC
                """
            )
            rows = await cursor.fetchall()
        except aiosqlite.Error as exc:
            raise _wrap(exc) from exc
        return [ConversationRecord(**dict(row)) for row in rows]

    async def create(self, title: str | None = None) -> ConversationRecord:
        now = utcnow()
        record = ConversationRecord(id=new_id(), title=(title or "New chat").strip() or "New chat", created_at=now, updated_at=now)
        try:
            await self.db.conn.execute(
                "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (record.id, record.title, record.created_at, record.updated_at),
            )
            await self.db.conn.commit()
        except aiosqlite.Error as exc:
            raise _wrap(exc) from exc
        return record

    async def get(self, conversation_id: str) -> ConversationRecord:
        try:
            cursor = await self.db.conn.execute(
                """
                SELECT c.id, c.title, c.created_at, c.updated_at,
                       (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
                FROM conversations c WHERE c.id = ?
                """,
                (conversation_id,),
            )
            row = await cursor.fetchone()
        except aiosqlite.Error as exc:
            raise _wrap(exc) from exc
        if row is None:
            raise NotFoundError("That conversation no longer exists.", details={"conversation_id": conversation_id})
        return ConversationRecord(**dict(row))

    async def rename(self, conversation_id: str, title: str) -> ConversationRecord:
        await self.get(conversation_id)
        try:
            await self.db.conn.execute(
                "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
                (title.strip(), utcnow(), conversation_id),
            )
            await self.db.conn.commit()
        except aiosqlite.Error as exc:
            raise _wrap(exc) from exc
        return await self.get(conversation_id)

    async def touch(self, conversation_id: str) -> None:
        try:
            await self.db.conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (utcnow(), conversation_id))
            await self.db.conn.commit()
        except aiosqlite.Error as exc:
            raise _wrap(exc) from exc

    async def delete(self, conversation_id: str) -> None:
        await self.get(conversation_id)
        try:
            await self.db.conn.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
            await self.db.conn.commit()
        except aiosqlite.Error as exc:
            raise _wrap(exc) from exc

    async def delete_all(self) -> int:
        try:
            cursor = await self.db.conn.execute("SELECT COUNT(*) FROM conversations")
            (count,) = await cursor.fetchone()
            await self.db.conn.execute("DELETE FROM conversations")
            await self.db.conn.commit()
        except aiosqlite.Error as exc:
            raise _wrap(exc) from exc
        return int(count)

    # ---- messages -------------------------------------------------------

    async def list_messages(self, conversation_id: str) -> list[MessageRecord]:
        try:
            cursor = await self.db.conn.execute(
                "SELECT id, conversation_id, role, content, status, provider, model, created_at "
                "FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC",
                (conversation_id,),
            )
            rows = await cursor.fetchall()
        except aiosqlite.Error as exc:
            raise _wrap(exc) from exc
        return [MessageRecord(**dict(row)) for row in rows]

    async def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        *,
        status: str = "complete",
        provider: str | None = None,
        model: str | None = None,
        message_id: str | None = None,
    ) -> MessageRecord:
        record = MessageRecord(
            id=message_id or new_id(),
            conversation_id=conversation_id,
            role=role,
            content=content,
            status=status,
            provider=provider,
            model=model,
            created_at=utcnow(),
        )
        try:
            await self.db.conn.execute(
                "INSERT INTO messages (id, conversation_id, role, content, status, provider, model, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (record.id, conversation_id, role, content, status, provider, model, record.created_at),
            )
            await self.db.conn.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?", (record.created_at, conversation_id)
            )
            await self.db.conn.commit()
        except aiosqlite.Error as exc:
            raise _wrap(exc) from exc
        return record

    async def delete_message(self, message_id: str) -> None:
        try:
            await self.db.conn.execute("DELETE FROM messages WHERE id = ?", (message_id,))
            await self.db.conn.commit()
        except aiosqlite.Error as exc:
            raise _wrap(exc) from exc


class SettingsRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    async def load(self) -> dict[str, Any]:
        try:
            cursor = await self.db.conn.execute("SELECT key, value FROM app_settings")
            rows = await cursor.fetchall()
        except aiosqlite.Error as exc:
            raise _wrap(exc) from exc
        result: dict[str, Any] = {}
        for row in rows:
            try:
                result[row["key"]] = json.loads(row["value"])
            except json.JSONDecodeError:
                continue
        return result

    async def save(self, values: dict[str, Any]) -> None:
        try:
            await self.db.conn.executemany(
                "INSERT INTO app_settings (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                [(key, json.dumps(value)) for key, value in values.items()],
            )
            await self.db.conn.commit()
        except aiosqlite.Error as exc:
            raise _wrap(exc) from exc
