# Hacktoberfest Open-Source AI Challenge — Week 3

**This is a submission for the [Hacktoberfest Open-Source AI Challenge: Week 3](https://dev.to/challenges/hacktoberfest-week3-2026-10-19): Slow and Steady.**

- **Project:** Slow and Steady
- **Tagline:** Build Something with Open-Source AI at Its Core.
- **Author:** [Amier Gabuters](https://github.com/gabutersproject) (`gabutersproject`)
- **Challenge window:** 19–25 October 2026 (International Sloth Day: 20 October)
- **Tags for the DEV post:** `#devchallenge` `#hf26challenge`

---

## What I Built

Slow and Steady is a personal AI workspace that runs on the machine in front of you.

The idea is sloth-shaped on purpose. Most “AI assistants” ask you to open an account, paste private text into someone else’s API, and keep paying per token. That is a lot of fuss for a tool that is supposed to take work off your plate. This app does the opposite: install it once, talk to an open-source model on localhost, and keep the conversation in a SQLite file on disk.

It helps with the work people put off: explain a hard topic, tidy a paragraph, sketch a project, walk through a code snippet, or just sit with a calm chat window. The computer does the drafting. You stay in the chair.

There is a **Demo Mode** so you can use the whole interface before you download a model. Demo replies are scripted and labelled as scripted. They never pretend to be a language model, and they never silently replace a failed local request.

When you are ready, connect [Ollama](https://ollama.com), pick an installed model such as `qwen2.5:1.5b`, and chat for real. Streaming, stop, regenerate, Markdown, code highlighting, and conversation history all work the same way in both modes.

### What it does

- Chat with streaming, stop, regenerate, copy, and Markdown
- Keep history locally: create, rename, delete, continue, clear all
- Choose Demo Mode or any model already installed in Ollama
- Tune temperature, max tokens, system prompt, and streaming
- Show an honest status: Demo Mode, Local AI Ready, Model Loading, Generating, Model Not Found, Ollama Offline, Backend Unavailable

**Local AI Ready** is only shown after the backend has checked that Ollama answers *and* the selected model is installed.

---

## Demo

- **GitHub:** https://github.com/gabutersproject/slow-and-steady
- **Origin:** https://cursor.com/codebase/projectgabuters/slow-and-steady
- **Run locally:** see the [README](./README.md) — open http://127.0.0.1:4747 after starting both processes

Quick path for judges who do not want to pull a model:

```bash
./scripts/start-backend.sh    # terminal 1
./scripts/start-frontend.sh   # terminal 2
```

Click **Start Demo**. Suggested prompts are on the empty chat. Replies are labelled *scripted, not an AI model*.

To use a real open-weight model (not automatic — you pull it):

```bash
ollama pull qwen2.5:1.5b
```

Then choose that model in the sidebar.

---

## How I Built It

Two processes, both on loopback.

```
Browser (Vite + React)  →  FastAPI on 127.0.0.1:8747  →  Ollama on 127.0.0.1:11434
                                ↓
                         SQLite (chats + settings)
```

The UI never talks to a model. An abstract `AIProvider` sits behind the API with two implementations:

1. **DemoProvider** — a small set of scripted replies, streamed in chunks so the UI path is the same as a real model.
2. **OllamaProvider** — local HTTP only (`/api/tags`, `/api/chat`). No cloud fallback. No auto-download.

Stack:

| Layer | Choice |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, Lucide |
| Backend | Python, FastAPI, Pydantic v2 |
| Inference | Ollama + open-weight models (example: Qwen2.5 1.5B) |
| Data | SQLite via aiosqlite |
| Tests | Pytest (Ollama mocked) and Vitest |

Security choices that match the theme of “do less, leak less”:

- Bind the API to localhost; CORS only for the local Vite origin
- Validate temperature, token limits, message length, and model names
- One generation per conversation at a time (no interleaved history)
- Stop/cancel persists partial text as `cancelled`, never as a finished answer
- No shell from model output, no secret leakage in error payloads, no arbitrary file tools in chat

Tests run without a downloaded model. Last run in the build environment: **46 backend tests passed**, **17 frontend tests passed**. Live generation against a real Ollama instance was not verified in that environment because Ollama was not installed there; offline detection and the mocked provider suite were.

---

## Why Open Innovation Matters

The closed path for a chat app is easy: drop in a paid API key and ship. It is also the path that sends every draft, code snippet, and half-formed question to a server you do not run.

Slow and Steady is built so the open pieces are the product, not a badge:

- **Your words stay here.** History is a local SQLite file. The model, when connected, is a process on `127.0.0.1`.
- **No meter running.** After `npm install`, `pip install`, and an optional `ollama pull`, chat does not call a cloud LLM. You are not renting intelligence by the token.
- **You can swap the brain.** Any model Ollama lists is selectable. The UI does not care whether it is Qwen, Llama, or something else you pulled yourself.
- **It still works when you are tired.** Demo Mode is the sloth door: explore the app at 11pm without waiting on a multi-gigabyte download. Connect a real model when you have the energy.

A closed API would have been faster to stub and worse at the job. The job is a private, unhurried assistant that does the typing so you do not have to.

---

## Prize Categories

- **Hacktoberfest Open-Source AI Challenge: Week 3** (theme: Slow and Steady) — overall

No partner runtime is required for this project. It is meant to live on a laptop, not on a hosted GPU. I am not claiming Render, Gemma-as-a-service, DigitalOcean, or other partner categories unless those are added later with a real integration.

---

## Theme: Slow and Steady

International Sloth Day is a good excuse to refuse urgency.

This app is slow in the useful ways: it will not download a model behind your back, it will not fake a successful reply, and it will not rush you onto a cloud account. It is steady in the ways that matter: Demo Mode works without Ollama, local chats persist, errors tell you what to install, and the provider interface is there so the next model is a dropdown, not a rewrite.

Build slowly. Build reliably. Keep the intelligence open-source and the experience local.

---

## Copy-paste for the DEV post

Judges read the DEV write-up most closely. Suggested opening line:

> This is a submission for the [Hacktoberfest Open-Source AI Challenge: Week 3](https://dev.to/challenges/hacktoberfest-week3-2026-10-19): Slow and Steady.

Then paste the sections **What I Built**, **Demo**, **How I Built It**, **Why Open Innovation Matters**, and **Prize Categories** above. Link the GitHub repo and this file.
