"""Text-to-speech engine abstraction over four free/local backends:

  * "edge"  — Microsoft Edge neural voices via the free `edge-tts` package.
              No API key, no local model download; needs internet. Outputs
              MP3 natively. This is the default because it works out of the
              box after `pip install edge-tts`.
  * "piper" — Piper TTS (https://github.com/rhasspy/piper), fully offline
              and open-source. Needs the `piper` binary and a downloaded
              .onnx voice model on disk.
  * "coqui" — Coqui TTS / XTTS (https://github.com/coqui-ai/TTS), fully
              offline, open-source, higher quality but a heavy install.
  * "xtts"  — alias of "coqui" using a multi-speaker XTTS model, kept as a
              distinct engine key since the UI lists it separately per spec.

`synthesize()` always returns the path it actually wrote to — callers should
not assume a fixed extension, since engines differ (edge -> mp3, piper/coqui
-> wav). `convert_to_mp3()` is available for wav outputs when ffmpeg is
installed, and returns the original path unchanged if it is not (never
raises, since MP3 export is a nice-to-have, not a requirement).
"""

from __future__ import annotations

import asyncio
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from core.config import (
    COQUI_MODEL_NAME,
    EDGE_DEFAULT_VOICE,
    PIPER_BINARY,
    PIPER_MODEL_PATH,
)

ENGINE_KEYS = ("edge", "piper", "coqui", "xtts")


@dataclass
class EngineStatus:
    key: str
    label: str
    available: bool
    detail: str


def list_engines() -> list[EngineStatus]:
    return [
        _edge_status(),
        _piper_status(),
        _coqui_status("coqui", "Coqui TTS"),
        _coqui_status("xtts", "Coqui XTTS (multi-voice)"),
    ]


def synthesize(
    text: str,
    engine: str,
    output_path: Path,
    voice: str | None = None,
) -> Path:
    """Synthesize `text` with the given engine, writing to `output_path`
    (extension is corrected automatically to match what the engine produces).
    Raises RuntimeError with an actionable message if the engine is unavailable.
    """
    if not text.strip():
        raise ValueError("Cannot synthesize empty text.")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    if engine == "edge":
        return _synthesize_edge(text, output_path.with_suffix(".mp3"), voice or EDGE_DEFAULT_VOICE)
    if engine == "piper":
        return _synthesize_piper(text, output_path.with_suffix(".wav"))
    if engine in ("coqui", "xtts"):
        return _synthesize_coqui(text, output_path.with_suffix(".wav"), voice)

    raise ValueError(f"Unknown TTS engine '{engine}'. Choose one of {ENGINE_KEYS}.")


def convert_to_mp3(wav_path: Path) -> Path:
    """Best-effort WAV -> MP3 conversion via ffmpeg. Returns the wav path
    unchanged (never raises) if ffmpeg is not installed."""
    if shutil.which("ffmpeg") is None:
        return wav_path
    mp3_path = wav_path.with_suffix(".mp3")
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(wav_path), "-codec:a", "libmp3lame", "-qscale:a", "2", str(mp3_path)],
            check=True,
            capture_output=True,
        )
        return mp3_path
    except (subprocess.CalledProcessError, OSError):
        return wav_path


# ---------------------------------------------------------------------------
# Edge TTS
# ---------------------------------------------------------------------------

def _edge_status() -> EngineStatus:
    try:
        import edge_tts  # noqa: F401
    except ImportError:
        return EngineStatus(
            key="edge", label="Edge TTS (free, online)", available=False,
            detail="Not installed. Run: pip install edge-tts",
        )
    return EngineStatus(
        key="edge", label="Edge TTS (free, online)", available=True,
        detail=f"Ready. Default voice: {EDGE_DEFAULT_VOICE}. Needs internet.",
    )


def _synthesize_edge(text: str, output_path: Path, voice: str) -> Path:
    try:
        import edge_tts
    except ImportError as exc:
        raise RuntimeError("Edge TTS is not installed. Run: pip install edge-tts") from exc

    async def _run() -> None:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(str(output_path))

    try:
        asyncio.run(_run())
    except RuntimeError:
        # Already inside a running event loop (some Gradio setups) — use a
        # fresh loop in a dedicated thread instead of nesting run().
        import threading

        error: list[BaseException] = []

        def _worker() -> None:
            try:
                asyncio.run(_run())
            except BaseException as exc:  # noqa: BLE001
                error.append(exc)

        thread = threading.Thread(target=_worker)
        thread.start()
        thread.join()
        if error:
            raise RuntimeError(f"Edge TTS failed: {error[0]}") from error[0]

    return output_path


def list_edge_voices() -> list[str]:
    """A short curated list of natural-sounding English voices (the full
    catalog has 300+ entries across languages; this keeps the UI dropdown
    usable). Use `edge-tts --list-voices` for the complete catalog."""
    return [
        "en-US-GuyNeural",
        "en-US-AriaNeural",
        "en-US-DavisNeural",
        "en-GB-RyanNeural",
        "en-GB-SoniaNeural",
        "en-AU-WilliamNeural",
    ]


# ---------------------------------------------------------------------------
# Piper TTS
# ---------------------------------------------------------------------------

def _piper_status() -> EngineStatus:
    binary_found = shutil.which(PIPER_BINARY) is not None
    model_found = bool(PIPER_MODEL_PATH) and Path(PIPER_MODEL_PATH).exists()
    if binary_found and model_found:
        return EngineStatus(
            key="piper", label="Piper TTS (free, offline)", available=True,
            detail=f"Ready. Model: {PIPER_MODEL_PATH}",
        )
    missing = []
    if not binary_found:
        missing.append("the `piper` binary is not on PATH")
    if not model_found:
        missing.append("PIPER_MODEL_PATH is not set to a valid .onnx voice model")
    return EngineStatus(
        key="piper", label="Piper TTS (free, offline)", available=False,
        detail=(
            "Not ready: " + "; ".join(missing) + ". Install from "
            "https://github.com/rhasspy/piper, download a voice model, then set "
            "PIPER_BINARY and PIPER_MODEL_PATH."
        ),
    )


def _synthesize_piper(text: str, output_path: Path) -> Path:
    status = _piper_status()
    if not status.available:
        raise RuntimeError(f"Piper TTS is not ready: {status.detail}")

    try:
        subprocess.run(
            [PIPER_BINARY, "--model", PIPER_MODEL_PATH, "--output_file", str(output_path)],
            input=text.encode("utf-8"),
            check=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"Piper TTS failed: {exc.stderr.decode(errors='replace')}") from exc

    return output_path


# ---------------------------------------------------------------------------
# Coqui TTS / XTTS
# ---------------------------------------------------------------------------

_coqui_instance_cache: dict[str, object] = {}


def _coqui_status(key: str, label: str) -> EngineStatus:
    try:
        import TTS  # noqa: F401
    except ImportError:
        return EngineStatus(
            key=key, label=f"{label} (free, offline)", available=False,
            detail="Not installed. Run: pip install TTS (large download, ~2GB+ with models).",
        )
    return EngineStatus(
        key=key, label=f"{label} (free, offline)", available=True,
        detail=f"Ready. Model: {COQUI_MODEL_NAME} (downloads on first use).",
    )


def _synthesize_coqui(text: str, output_path: Path, speaker_wav: str | None) -> Path:
    try:
        from TTS.api import TTS as CoquiTTS
    except ImportError as exc:
        raise RuntimeError("Coqui TTS is not installed. Run: pip install TTS") from exc

    if COQUI_MODEL_NAME not in _coqui_instance_cache:
        _coqui_instance_cache[COQUI_MODEL_NAME] = CoquiTTS(model_name=COQUI_MODEL_NAME)
    tts = _coqui_instance_cache[COQUI_MODEL_NAME]

    kwargs = {"text": text, "file_path": str(output_path)}
    if speaker_wav:
        kwargs["speaker_wav"] = speaker_wav
    tts.tts_to_file(**kwargs)  # type: ignore[attr-defined]
    return output_path
