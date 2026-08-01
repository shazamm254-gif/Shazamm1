"""Application-wide configuration and constants.

All paths are resolved relative to the package root so the app can be run
from any working directory. Every setting here has a free/local default —
paid backends (OpenRouter) are strictly optional and only activate if the
user supplies an API key.
"""

from __future__ import annotations

import os
from pathlib import Path

# --------------------------------------------------------------------------
# Paths
# --------------------------------------------------------------------------

PACKAGE_ROOT: Path = Path(__file__).resolve().parent.parent
PROJECTS_DIR: Path = PACKAGE_ROOT / "projects"
DB_PATH: Path = PACKAGE_ROOT / "wildlife_shorts.db"

PROJECTS_DIR.mkdir(parents=True, exist_ok=True)

# --------------------------------------------------------------------------
# Script / video defaults
# --------------------------------------------------------------------------

MIN_DURATION_SECONDS: int = 45
MAX_DURATION_SECONDS: int = 60
TARGET_DURATION_SECONDS: int = 54
WORDS_PER_SECOND: float = 2.7  # narration pacing used to time captions/scenes
DEFAULT_SCENE_COUNT: int = 10

# --------------------------------------------------------------------------
# LLM backends (all optional — the app is fully functional with none of
# these configured, using the offline rule-based generators instead)
# --------------------------------------------------------------------------

# "offline" (default, no install/API key needed), "ollama" (local model
# server), or "openrouter" (hosted, optional, needs an API key).
DEFAULT_LLM_BACKEND: str = os.environ.get("WSS_LLM_BACKEND", "offline")

OLLAMA_HOST: str = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL: str = os.environ.get("OLLAMA_MODEL", "llama3.1")

OPENROUTER_API_KEY: str = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL: str = os.environ.get("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free")
OPENROUTER_URL: str = "https://openrouter.ai/api/v1/chat/completions"

LLM_TIMEOUT_SECONDS: int = 30
LLM_HEALTHCHECK_TIMEOUT_SECONDS: float = 2.0

# --------------------------------------------------------------------------
# Voiceover / TTS defaults
# --------------------------------------------------------------------------

DEFAULT_TTS_ENGINE: str = "edge"  # "edge", "piper", or "coqui"
EDGE_DEFAULT_VOICE: str = "en-US-GuyNeural"
PIPER_BINARY: str = os.environ.get("PIPER_BINARY", "piper")
PIPER_MODEL_PATH: str = os.environ.get("PIPER_MODEL_PATH", "")
COQUI_MODEL_NAME: str = os.environ.get(
    "COQUI_MODEL_NAME", "tts_models/en/ljspeech/tacotron2-DDC"
)

# --------------------------------------------------------------------------
# Wildlife niche voice (shared across every generator so output stays
# consistent with the channel's established style)
# --------------------------------------------------------------------------

CHANNEL_NAME: str = "Wild Secrets"
NICHE_TONE: str = (
    "Cinematic wildlife documentary narration — BBC Planet Earth / National "
    "Geographic level. Calm, precise, and awestruck, letting real biology "
    "carry the shock. Never cheesy, never robotic, never textbook."
)
VISUAL_STYLE_TAGS: str = (
    "photorealistic, wildlife documentary, ultra detailed, 8K, HDR, "
    "vertical 9:16, National Geographic quality, BBC Earth quality, "
    "movie-quality realism, no text, no watermark"
)
CORE_HASHTAGS: list[str] = [
    "#wildlife", "#animals", "#nature", "#natureismetal", "#animalfacts",
]
EXTRA_HASHTAGS: list[str] = [
    "#shorts", "#wildlifephotography", "#naturedocumentary", "#biology",
    "#animalkingdom", "#natgeo", "#planetearth", "#aiart", "#didyouknow",
    "#wildlifedocumentary", "#animalbehavior", "#sciencefacts", "#earth",
    "#documentary", "#instawildlife",
]
