#!/usr/bin/env bash
# Convenience launcher: starts the backend in the background, then the frontend.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/scripts/start-backend.sh" &
BACKEND_PID=$!
trap 'kill "$BACKEND_PID" 2>/dev/null || true' EXIT INT TERM
# Give the API a moment to bind before Vite starts proxying.
sleep 1
"$ROOT/scripts/start-frontend.sh"
