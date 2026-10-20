#!/usr/bin/env bash
# Start the Slow and Steady FastAPI backend on localhost only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"
if [[ ! -x .venv/bin/python ]]; then
  echo "Creating a Python virtual environment in backend/.venv"
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt
fi
HOST="${SAS_HOST:-127.0.0.1}"
PORT="${SAS_PORT:-8747}"
echo "Starting Slow and Steady backend at http://${HOST}:${PORT}"
exec .venv/bin/python -m uvicorn app.main:app --host "$HOST" --port "$PORT"
