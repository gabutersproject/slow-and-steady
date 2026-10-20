#!/usr/bin/env bash
# Start the Slow and Steady Vite frontend. /api is proxied to the local backend.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"
if [[ ! -d node_modules ]]; then
  npm install
fi
export SAS_BACKEND_URL="${SAS_BACKEND_URL:-http://127.0.0.1:8747}"
echo "Starting Slow and Steady frontend at http://127.0.0.1:4747"
echo "API proxy target: ${SAS_BACKEND_URL}"
exec npm run dev
