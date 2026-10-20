# Start the Slow and Steady FastAPI backend on localhost only.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $Root "backend")
if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "Creating a Python virtual environment in backend/.venv"
    python -m venv .venv
    .\.venv\Scripts\pip install -r requirements.txt
}
$HostName = if ($env:SAS_HOST) { $env:SAS_HOST } else { "127.0.0.1" }
$Port = if ($env:SAS_PORT) { $env:SAS_PORT } else { "8747" }
Write-Host "Starting Slow and Steady backend at http://${HostName}:${Port}"
& .\.venv\Scripts\python.exe -m uvicorn app.main:app --host $HostName --port $Port
