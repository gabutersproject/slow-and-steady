from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_config, get_db
from app.core.config import Settings
from app.database import Database
from app.schemas.ai import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(db: Database = Depends(get_db), config: Settings = Depends(get_config)) -> HealthResponse:
    db_ok = await db.ping()
    return HealthResponse(
        status="ok" if db_ok else "degraded",
        app=config.app_name,
        version=config.app_version,
        database="ok" if db_ok else "unavailable",
    )
