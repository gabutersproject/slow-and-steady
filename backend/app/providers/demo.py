"""Demo provider: scripted responses for exploring the interface without a model.

Every demo reply is clearly labelled so it can never be mistaken for output of a
language model. The demo provider is only used when the user has explicitly
selected it; it never substitutes for a failed local model request.
"""

from __future__ import annotations

import asyncio
import re
from typing import AsyncIterator

from app.providers.base import AIProvider, CancelToken, ChatMessage, GenerationOptions, GenerationResult
from app.schemas.ai import ModelInfo

DEMO_MODEL_NAME = "demo-scripted"

DEMO_FOOTER = (
    "\n\n---\n*Demo Mode: this is a scripted reply, not output from a language model. "
    "Connect a local Ollama model to get real answers.*"
)

# Each entry: (compiled keyword pattern, response body)
_SCRIPTED: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"\b(hi|hello|hey|good (morning|afternoon|evening))\b", re.I),
        "Hello! You're looking at **Slow and Steady** in Demo Mode.\n\n"
        "In this mode the interface is fully interactive, but replies come from a small set of "
        "scripted messages. Everything you type is stored only in the local SQLite database on this machine.\n\n"
        "When you're ready, install [Ollama](https://ollama.com), pull a model such as `qwen2.5:1.5b`, "
        "and switch to **Local AI** from the sidebar.",
    ),
    (
        re.compile(r"\b(explain|what is|what's|how does|why does|complex topic)\b", re.I),
        "Here's how a real local model would approach an explanation request:\n\n"
        "1. **Identify the core idea** and strip away jargon.\n"
        "2. **Use an analogy** grounded in everyday experience.\n"
        "3. **Build up gradually**, checking that each step follows from the last.\n"
        "4. **Finish with a one-sentence summary** you could repeat to someone else.\n\n"
        "For example, *streaming* a response means sending words as they are produced instead of "
        "waiting for the whole answer, much like a conversation instead of a letter.",
    ),
    (
        re.compile(r"\b(code|program|function|bug|python|typescript|javascript|react|fastapi|sql)\b", re.I),
        "A local coding assistant can help you review, refactor and explain code. Here's the kind of "
        "snippet it might produce:\n\n"
        "```python\n"
        "def chunked(items: list, size: int) -> list[list]:\n"
        "    \"\"\"Split *items* into consecutive groups of *size*.\"\"\"\n"
        "    if size <= 0:\n"
        "        raise ValueError(\"size must be positive\")\n"
        "    return [items[i : i + size] for i in range(0, len(items), size)]\n"
        "```\n\n"
        "Notes a good reviewer would add:\n\n"
        "- Validate inputs early and fail with a clear message.\n"
        "- Prefer small, pure functions that are easy to test.\n"
        "- Add a docstring that says *what*, not *how*.",
    ),
    (
        re.compile(r"\b(summar(y|ize|ise)|tl;?dr|shorten|condense)\b", re.I),
        "To summarize text, a local model reads the whole passage and keeps only what carries meaning:\n\n"
        "- **Main claim** in one sentence.\n"
        "- **Supporting points**, usually two or three.\n"
        "- **Action or conclusion**, if the text has one.\n\n"
        "Paste a paragraph after connecting a local model and it will return a summary that never "
        "leaves your computer.",
    ),
    (
        re.compile(r"\b(brainstorm|ideas?|project|startup|build something|what should i (make|build))\b", re.I),
        "Some project ideas that fit a local-first, open-source AI stack:\n\n"
        "1. **Personal knowledge journal** that tags and links your notes offline.\n"
        "2. **Meeting notes cleaner** that turns rough bullet points into clear minutes.\n"
        "3. **Reading companion** that explains difficult passages in a book you're reading.\n"
        "4. **Code tutor** that walks through unfamiliar repositories one file at a time.\n"
        "5. **Language practice partner** that corrects your writing gently.\n\n"
        "Pick the one that solves a problem you have this week; small and finished beats large and abandoned.",
    ),
    (
        re.compile(r"\b(teach|learn|lesson|something new|fact)\b", re.I),
        "Something worth knowing: **quantization** is how models like Qwen2.5 1.5B fit on an ordinary laptop.\n\n"
        "Model weights are normally stored as 16-bit numbers. Quantization rounds them to 4 or 8 bits, "
        "shrinking memory use by two to four times with only a small loss in quality. That's why a model "
        "tagged `q4_K_M` can run comfortably on a machine with 8 GB of RAM.",
    ),
    (
        re.compile(r"\b(privacy|private|offline|data|telemetry|track)\b", re.I),
        "Privacy in Slow and Steady works like this:\n\n"
        "- Conversations are stored in a **SQLite file on this computer**.\n"
        "- The backend binds to **localhost only** and talks to Ollama on `127.0.0.1`.\n"
        "- There is **no telemetry** and no cloud AI provider, so your messages are never sent anywhere.\n"
        "- Network access is only needed when **installing dependencies** or **downloading a model**.\n\n"
        "The README documents exactly which steps touch the network.",
    ),
    (
        re.compile(r"\b(write|poem|story|creative|haiku)\b", re.I),
        "A short piece in the spirit of the project:\n\n"
        "> Slow and steady wins,\n"
        "> not by racing to the cloud,\n"
        "> but by thinking here.\n\n"
        "With a local model connected you can ask for stories, outlines, dialogue or rewrites in any tone.",
    ),
]

_FALLBACK = (
    "Thanks for trying Slow and Steady. Demo Mode only has a handful of scripted replies, so I can't "
    "respond to that specific message.\n\n"
    "Try one of the suggested prompts, or connect a local model:\n\n"
    "1. Install Ollama from https://ollama.com\n"
    "2. Run `ollama pull qwen2.5:1.5b` in a terminal\n"
    "3. Choose **Local AI** in the sidebar and pick the model"
)


def pick_demo_response(prompt: str) -> str:
    for pattern, body in _SCRIPTED:
        if pattern.search(prompt):
            return body + DEMO_FOOTER
    return _FALLBACK + DEMO_FOOTER


class DemoProvider(AIProvider):
    name = "demo"

    def __init__(self, token_delay_seconds: float = 0.02) -> None:
        self.token_delay_seconds = token_delay_seconds

    async def is_available(self) -> bool:
        return True

    async def list_models(self) -> list[ModelInfo]:
        return [ModelInfo(name=DEMO_MODEL_NAME, family="scripted")]

    @staticmethod
    def _last_user_prompt(messages: list[ChatMessage]) -> str:
        for message in reversed(messages):
            if message.role == "user":
                return message.content
        return ""

    async def generate(self, messages: list[ChatMessage], options: GenerationOptions, cancel: CancelToken) -> GenerationResult:
        content = pick_demo_response(self._last_user_prompt(messages))
        return GenerationResult(content=content, model=DEMO_MODEL_NAME, provider=self.name)

    async def stream(self, messages: list[ChatMessage], options: GenerationOptions, cancel: CancelToken) -> AsyncIterator[str]:
        content = pick_demo_response(self._last_user_prompt(messages))
        # Emit word-sized chunks to exercise the same streaming path as a real model.
        for chunk in re.findall(r"\S+\s*|\s+", content):
            if cancel.cancelled:
                return
            yield chunk
            if self.token_delay_seconds:
                await asyncio.sleep(self.token_delay_seconds)
