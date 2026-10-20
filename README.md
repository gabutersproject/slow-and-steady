# Slow and Steady

**Build Something with Open-Source AI at Its Core.**

Slow and Steady is a personal AI workspace that talks to open-source language models running on your own computer. Conversations stay in a local SQLite file. There is no account, no telemetry, and no cloud language-model provider.

The default experience is **Demo Mode**: a complete chat interface with scripted replies, so you can explore the product before installing Ollama or downloading a model.

---

## Main features

- Local-first chat with streaming, stop, regenerate, copy, and Markdown (including fenced code).
- Provider-based inference: **Demo** (scripted) and **Ollama** (local models). There is no automatic cloud fallback, and Demo Mode never silently replaces a failed local request.
- Conversation history stored in SQLite: create, rename, delete, continue, and clear-all with confirmation.
- Model settings: selection, temperature, max tokens, system prompt, streaming on/off.
- Status indicators: Demo Mode, Local AI Ready, Model Loading, Generating Response, Model Not Found, Ollama Offline, Backend Unavailable.
- First-launch welcome with **Start Demo** and **Connect Local AI**.
- Backend bound to localhost; CORS limited to the local frontend origin.

---

## Architecture

```
┌─────────────────────┐     /api (proxy)      ┌──────────────────────┐
│  Vite + React UI    │ ────────────────────► │  FastAPI backend     │
│  127.0.0.1:4747     │                       │  127.0.0.1:8747      │
└─────────────────────┘                       │  SQLite conversations│
                                              └──────────┬───────────┘
                                                         │ localhost only
                                              ┌──────────▼───────────┐
                                              │  Ollama (optional)   │
                                              │  127.0.0.1:11434     │
                                              └──────────────────────┘
```

- `frontend/` — React 19, TypeScript, Vite 8, Tailwind CSS 4, Lucide icons.
- `backend/` — FastAPI, Pydantic v2, aiosqlite, httpx.
- `backend/app/providers/` — `AIProvider` interface plus `DemoProvider` and `OllamaProvider`.
- `backend/app/database/` — persistence, kept separate from inference.
- `backend/app/core/chat_service.py` — conversation context, generation, cancellation.

Inference never runs in the browser. The UI only talks to the local FastAPI process.

---

## Prerequisites

| Tool | Used for | Notes |
| --- | --- | --- |
| Node.js 20+ and npm | Frontend | Verified with Node 22. |
| Python 3.12+ | Backend | A virtual environment is recommended. |
| Ollama (optional) | Local models | Required only for Local AI, not for Demo Mode. |

---

## Installation

Clone the repository, then install each half. Network access is needed for these install steps (npm registry, PyPI). Chat itself does not use those networks.

### Backend

**Linux / macOS**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

If `python3 -m venv` is unavailable, [`uv`](https://docs.astral.sh/uv/) works as well:

```bash
cd backend
uv venv .venv
uv pip install --python .venv/bin/python -r requirements.txt
```

**Windows (PowerShell)**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Frontend

**Linux / macOS / Windows**

```bash
cd frontend
npm install
```

---

## How to start the application

You need **two processes**: the API and the UI. Start the backend first.

### Linux / macOS

```bash
# terminal 1
./scripts/start-backend.sh

# terminal 2
./scripts/start-frontend.sh
```

Or, from the repo root, `./scripts/dev.sh` starts the backend in the background and then the frontend.

Equivalent without the scripts:

```bash
# terminal 1 — from backend/
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8747

# terminal 2 — from frontend/
npm run dev
```

### Windows (PowerShell)

```powershell
# terminal 1
.\scripts\start-backend.ps1

# terminal 2
.\scripts\start-frontend.ps1
```

Then open **http://127.0.0.1:4747**.

| Service | Default address | Bind |
| --- | --- | --- |
| Frontend (Vite) | http://127.0.0.1:4747 | localhost |
| Backend (FastAPI) | http://127.0.0.1:8747 | localhost |
| Ollama (optional) | http://127.0.0.1:11434 | local install |

The Vite dev server proxies `/api` to `http://127.0.0.1:8747`. Override with `SAS_BACKEND_URL` if you change the backend port. CORS on the API allows only `http://127.0.0.1:4747` and `http://localhost:4747`.

---

## Demo Mode

On first launch choose **Start Demo**, or pick **Demo Mode (scripted replies)** in the sidebar model menu.

- Replies come from a small built-in set of responses, clearly labelled as scripted.
- No Ollama process and no model file are required.
- Conversations are still saved locally, so history, rename, and delete work the same way.
- Demo Mode is **never** used as a silent fallback when a local model request fails.

---

## Ollama installation and local models

1. Install Ollama from [https://ollama.com](https://ollama.com) (desktop app or CLI).
2. Confirm it is running:

   ```bash
   ollama --version
   curl http://127.0.0.1:11434/api/version
   ```

3. Pull a model **yourself**. The app does not download models automatically.

   ```bash
   ollama pull qwen2.5:1.5b
   ```

   `qwen2.5:1.5b` is the suggested starter model because it is small enough for many laptops. Any model `ollama list` shows will appear in the sidebar.

4. In Slow and Steady, choose **Connect Local AI** (welcome screen) or pick the installed model in the sidebar.

**Local AI Ready** is shown only after the backend has verified that Ollama answers on the configured URL *and* the selected model is installed. If Ollama is down you will see **Ollama Offline**. If it is up but empty, **No Models Installed**. If the selected tag is missing, **Model Not Found**.

To change the Ollama URL (still intended to be local):

```bash
export SAS_OLLAMA_BASE_URL=http://127.0.0.1:11434
```

---

## Testing

Ollama is mocked in automated tests. The suite does not download a model.

**Backend** (from `backend/`):

```bash
.venv/bin/python -m pytest -q
```

Last run in this workspace: **46 passed**.

**Frontend** (from `frontend/`):

```bash
npm test
```

Last run in this workspace: **17 passed**. Typecheck: `npx tsc -b` succeeded.

---

## Configuration

Backend settings use the `SAS_` prefix (see `backend/app/core/config.py`).

| Variable | Default | Meaning |
| --- | --- | --- |
| `SAS_HOST` | `127.0.0.1` | API bind address |
| `SAS_PORT` | `8747` | API port |
| `SAS_OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Local Ollama |
| `SAS_DATABASE_PATH` | `backend/data/slow_and_steady.sqlite3` | Conversation DB |
| `SAS_CORS_ORIGINS` | the Vite origin | Allowed browser origins |
| `SAS_BACKEND_URL` | `http://127.0.0.1:8747` | Vite proxy target (frontend) |

Do not bind the API to `0.0.0.0` unless you understand that anyone on that network could reach your conversations.

---

## Privacy architecture

- Conversations and settings live in SQLite on disk (`backend/data/`). That directory is gitignored.
- The API listens on loopback by default.
- CORS is restricted to the local frontend origin.
- Request bodies are size-limited; message length, temperature, and token counts are validated.
- The app does not execute shell commands from model output, does not expose environment variables in replies, and does not give the model arbitrary filesystem access.
- There is no analytics SDK and no cloud LLM client.

### What may use the network

| When | What |
| --- | --- |
| First setup | `npm install`, `pip install` (package registries). |
| Model setup | `ollama pull …` (Ollama's registry). |
| Optional | Clicking a documentation link in About / Demo replies. |
| Runtime chat | **Nothing remote.** Traffic is UI → FastAPI → (optional) local Ollama. |

This application is **not** completely offline until Node/Python packages are installed, a model (if you want Local AI) is already on disk, and you have confirmed generation works with the network disconnected. Demo Mode after `npm install` / `pip install` does not need Ollama or further downloads.

---

## Troubleshooting

| Symptom | What to try |
| --- | --- |
| **Backend Unavailable** | Start the API (`./scripts/start-backend.sh`). Confirm http://127.0.0.1:8747/api/health returns `"status": "ok"`. |
| **Ollama Offline** | Start the Ollama app or `ollama serve`. Check `curl http://127.0.0.1:11434/api/version`. |
| **No Models Installed** | Run `ollama pull qwen2.5:1.5b`. The app will not pull it for you. |
| **Model Not Found** | `ollama list`, then pick a name that appears there. |
| Generation times out | Use a smaller model, shorter prompt, or raise `SAS_OLLAMA_READ_TIMEOUT_SECONDS`. |
| CORS errors | Use http://127.0.0.1:4747 (not a different host/port) or extend `SAS_CORS_ORIGINS`. |
| Database error | Ensure `backend/data/` is writable. Delete the sqlite file only if you are willing to lose history. |
| Port already in use | Set `SAS_PORT` / change Vite `server.port` in `frontend/vite.config.ts`. |

Errors from the API are JSON `{ "error": { "code", "message" } }` with no stack traces.

---

## Known limitations

- This workspace did **not** have Ollama installed, so live local-model generation was not verified here. Availability detection (offline) and a fully mocked Ollama test suite were verified. On a machine with Ollama and `qwen2.5:1.5b` (or any listed model), choose that model in the sidebar to generate for real.
- Context sent to the model is truncated to the most recent messages (30 messages / ~16k characters) so prompts stay bounded.
- Only one generation can run per conversation at a time (HTTP 409 otherwise).
- Cancellation is cooperative: the backend stops reading the Ollama stream and saves whatever text arrived, tagged `cancelled`.
- There is no multi-user auth; anyone who can reach the localhost ports can read the local history.

---

## Project layout

```
slow-and-steady/
├── frontend/          React + Vite + Tailwind
├── backend/           FastAPI + SQLite + providers
├── scripts/           Start helpers (bash and PowerShell)
├── .gitignore
└── README.md
```

Build slowly. Build reliably. Keep the intelligence open-source and the experience local.
