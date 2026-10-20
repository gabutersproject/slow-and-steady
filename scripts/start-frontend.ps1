# Start the Slow and Steady Vite frontend. /api is proxied to the local backend.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $Root "frontend")
if (-not (Test-Path "node_modules")) {
    npm install
}
if (-not $env:SAS_BACKEND_URL) { $env:SAS_BACKEND_URL = "http://127.0.0.1:8747" }
Write-Host "Starting Slow and Steady frontend at http://127.0.0.1:4747"
Write-Host "API proxy target: $($env:SAS_BACKEND_URL)"
npm run dev
