"""Unified LLM client with three interchangeable backends.

  * "offline"    — no LLM at all. `generate()` always returns None so every
                    generator falls back to its rule-based templates. This
                    is the default and requires no install and no API key.
  * "ollama"     — a local model server (https://ollama.com), completely
                    free and runs entirely on the user's machine.
  * "openrouter" — a hosted, optional, pay-as-you-go API. Only used if the
                    user explicitly supplies OPENROUTER_API_KEY.

Every generator module calls `LLMClient.generate(system, user)` and must
handle a None return by using its offline fallback — the LLM path only ever
*improves* output, it is never required for the app to function.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

import requests

from core.config import (
    LLM_HEALTHCHECK_TIMEOUT_SECONDS,
    LLM_TIMEOUT_SECONDS,
    OLLAMA_HOST,
    OLLAMA_MODEL,
    OPENROUTER_API_KEY,
    OPENROUTER_MODEL,
    OPENROUTER_URL,
)

VALID_BACKENDS = ("offline", "ollama", "openrouter")


@dataclass
class LLMClient:
    backend: str = "offline"
    ollama_host: str = OLLAMA_HOST
    ollama_model: str = OLLAMA_MODEL
    openrouter_api_key: str = OPENROUTER_API_KEY
    openrouter_model: str = OPENROUTER_MODEL

    def __post_init__(self) -> None:
        if self.backend not in VALID_BACKENDS:
            raise ValueError(f"Unknown LLM backend '{self.backend}'. Choose one of {VALID_BACKENDS}.")

    # ------------------------------------------------------------------
    # Availability checks (used by the UI to grey out unusable options)
    # ------------------------------------------------------------------
    def is_available(self) -> bool:
        if self.backend == "offline":
            return True
        if self.backend == "ollama":
            return self._ollama_reachable()
        if self.backend == "openrouter":
            return bool(self.openrouter_api_key)
        return False

    def _ollama_reachable(self) -> bool:
        try:
            resp = requests.get(
                f"{self.ollama_host}/api/tags", timeout=LLM_HEALTHCHECK_TIMEOUT_SECONDS
            )
            return resp.status_code == 200
        except requests.RequestException:
            return False

    # ------------------------------------------------------------------
    # Generation
    # ------------------------------------------------------------------
    def generate(self, system_prompt: str, user_prompt: str) -> str | None:
        """Return the model's text response, or None if unavailable/failed."""
        if self.backend == "offline":
            return None
        if self.backend == "ollama":
            return self._generate_ollama(system_prompt, user_prompt)
        if self.backend == "openrouter":
            return self._generate_openrouter(system_prompt, user_prompt)
        return None

    def _generate_ollama(self, system_prompt: str, user_prompt: str) -> str | None:
        try:
            resp = requests.post(
                f"{self.ollama_host}/api/chat",
                json={
                    "model": self.ollama_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "stream": False,
                },
                timeout=LLM_TIMEOUT_SECONDS,
            )
            resp.raise_for_status()
            return resp.json()["message"]["content"]
        except (requests.RequestException, KeyError, json.JSONDecodeError):
            return None

    def _generate_openrouter(self, system_prompt: str, user_prompt: str) -> str | None:
        if not self.openrouter_api_key:
            return None
        try:
            resp = requests.post(
                OPENROUTER_URL,
                headers={"Authorization": f"Bearer {self.openrouter_api_key}"},
                json={
                    "model": self.openrouter_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                },
                timeout=LLM_TIMEOUT_SECONDS,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except (requests.RequestException, KeyError, IndexError, json.JSONDecodeError):
            return None


def try_parse_json(raw: str | None) -> dict | list | None:
    """Best-effort JSON extraction from an LLM response (which may wrap the
    JSON in prose or a markdown code fence)."""
    if not raw:
        return None
    text = raw.strip()
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("{") or part.startswith("["):
                text = part
                break
    start = min((i for i in (text.find("{"), text.find("[")) if i != -1), default=-1)
    if start == -1:
        return None
    try:
        return json.loads(text[start:])
    except json.JSONDecodeError:
        return None
