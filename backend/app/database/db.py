"""SQLite connection management and schema migrations (aiosqlite)."""

from __future__ import annotations

import logging
from pathlib import Path

import aiosqlite

from app.core.errors import DatabaseError

logger = logging.getLogger("slow_and_steady.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('complete', 'cancelled', 'error')),
    provider TEXT,
    model TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


class Database:
    """Owns a single aiosqlite connection for the lifetime of the app."""

    def __init__(self, path: Path | str) -> None:
        self.path = Path(path) if str(path) != ":memory:" else path
        self._conn: aiosqlite.Connection | None = None

    @property
    def conn(self) -> aiosqlite.Connection:
        if self._conn is None:
            raise DatabaseError("The local database is not available. Restart the backend and try again.")
        return self._conn

    async def connect(self) -> None:
        try:
            if isinstance(self.path, Path):
                self.path.parent.mkdir(parents=True, exist_ok=True)
            self._conn = await aiosqlite.connect(str(self.path))
            self._conn.row_factory = aiosqlite.Row
            await self._conn.execute("PRAGMA foreign_keys = ON")
            if isinstance(self.path, Path):
                await self._conn.execute("PRAGMA journal_mode = WAL")
            await self._conn.executescript(SCHEMA)
            await self._conn.commit()
        except (OSError, aiosqlite.Error) as exc:
            logger.error("Could not open database: %s", exc.__class__.__name__)
            raise DatabaseError(
                "The local database could not be opened. Check that the data directory is writable."
            ) from exc

    async def close(self) -> None:
        if self._conn is not None:
            await self._conn.close()
            self._conn = None

    async def ping(self) -> bool:
        try:
            cursor = await self.conn.execute("SELECT 1")
            await cursor.fetchone()
            return True
        except (DatabaseError, aiosqlite.Error):
            return False
