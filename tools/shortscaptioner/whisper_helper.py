#!/usr/bin/env python3
"""
whisper_helper.py — word-level transcription for ShortsCaptioner.

Wraps faster-whisper so the rest of the app only ever sees a flat, clean list of
Word objects with trustworthy start/end floats. Whisper's raw word timings are
usable but messy: words arrive with leading spaces, occasional zero-length
spans, and the odd timestamp that goes backwards. Everything here exists to
hand the renderer something it can index by time without defensive checks.

Typical use:
    from whisper_helper import transcribe_words
    words = transcribe_words("clip.mp4", model_size="base")
    # -> [Word(text="THIS", start=0.12, end=0.34), ...]

Transcripts can be cached to JSON so restyling a video doesn't re-run the model:
    words = transcribe_words("clip.mp4", cache_path="clip.words.json")
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass

# Whisper sometimes emits a word with end <= start (usually on filler sounds).
# Give those a floor so a highlight never has zero duration and flickers.
MIN_WORD_DURATION = 0.04


class TranscriptionError(RuntimeError):
    """Raised when audio extraction or the Whisper model itself fails."""


@dataclass
class Word:
    """One spoken word with the timing window it occupies, in seconds."""

    text: str
    start: float
    end: float
    probability: float = 1.0

    @property
    def duration(self) -> float:
        return self.end - self.start


# ---------------------------------------------------------------------------
# Audio extraction
# ---------------------------------------------------------------------------

def _require_ffmpeg() -> str:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise TranscriptionError(
            "ffmpeg was not found on your PATH.\n"
            "  macOS:   brew install ffmpeg\n"
            "  Ubuntu:  sudo apt install ffmpeg\n"
            "  Windows: winget install Gyan.FFmpeg"
        )
    return ffmpeg


def extract_audio(video_path: str, out_wav: str) -> str:
    """Pull a 16 kHz mono WAV out of the video — what Whisper wants natively."""
    ffmpeg = _require_ffmpeg()
    cmd = [
        ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
        "-i", video_path,
        "-vn", "-ac", "1", "-ar", "16000", "-f", "wav",
        out_wav,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise TranscriptionError(
            f"ffmpeg could not extract audio from {video_path!r}.\n"
            f"{proc.stderr.strip()}"
        )
    if not os.path.exists(out_wav) or os.path.getsize(out_wav) < 1024:
        raise TranscriptionError(
            f"No usable audio track found in {video_path!r} — a silent video "
            f"has nothing to caption."
        )
    return out_wav


# ---------------------------------------------------------------------------
# Cleanup of raw Whisper output
# ---------------------------------------------------------------------------

def clean_words(raw: list[Word]) -> list[Word]:
    """Drop empties and force the timeline to move strictly forwards.

    Whisper occasionally hands back overlapping or reversed spans. Since the
    renderer picks the active word by scanning timestamps, one bad pair makes a
    word highlight early or never at all, so we repair rather than trust.
    """
    cleaned: list[Word] = []
    for word in raw:
        text = word.text.strip()
        if not text:
            continue
        start = max(0.0, float(word.start))
        end = float(word.end)
        if end < start + MIN_WORD_DURATION:
            end = start + MIN_WORD_DURATION
        if cleaned and start < cleaned[-1].end:
            # Overlap: butt this word up against the previous one rather than
            # letting two words claim the same instant.
            start = cleaned[-1].end
            end = max(end, start + MIN_WORD_DURATION)
        cleaned.append(Word(text, start, end, float(word.probability)))
    return cleaned


# ---------------------------------------------------------------------------
# Transcription
# ---------------------------------------------------------------------------

def transcribe_words(
    video_path: str,
    model_size: str = "base",
    device: str = "auto",
    compute_type: str | None = None,
    language: str | None = None,
    vad_filter: bool = True,
    beam_size: int = 5,
    cache_path: str | None = None,
    verbose: bool = True,
) -> list[Word]:
    """Transcribe `video_path` and return every word with start/end seconds.

    `cache_path` short-circuits the model entirely when the JSON already exists,
    which is the difference between a 30-second restyle and a 3-minute one.
    """
    if cache_path and os.path.exists(cache_path):
        words = load_words(cache_path)
        if verbose:
            print(f"  Loaded {len(words)} cached words from {cache_path}")
        return words

    if not os.path.exists(video_path):
        raise TranscriptionError(f"Input video not found: {video_path}")

    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:  # pragma: no cover - depends on install state
        raise TranscriptionError(
            "faster-whisper is not installed. Install it with:\n"
            "    pip install faster-whisper"
        ) from exc

    if compute_type is None:
        # int8 keeps CPU transcription tolerable; float16 is the GPU sweet spot.
        compute_type = "float16" if device == "cuda" else "int8"

    tmp_dir = tempfile.mkdtemp(prefix="shortscaptioner_")
    wav_path = os.path.join(tmp_dir, "audio.wav")
    try:
        if verbose:
            print(f"  Extracting audio from {os.path.basename(video_path)} ...")
        extract_audio(video_path, wav_path)

        if verbose:
            print(f"  Loading Whisper model '{model_size}' "
                  f"(device={device}, compute_type={compute_type}) ...")
        try:
            model = WhisperModel(model_size, device=device,
                                 compute_type=compute_type)
        except Exception as exc:
            raise TranscriptionError(
                f"Could not load Whisper model {model_size!r}: {exc}\n"
                f"Valid sizes: tiny, base, small, medium, large-v3 "
                f"(add '.en' for English-only, e.g. small.en)."
            ) from exc

        segments, info = model.transcribe(
            wav_path,
            language=language,
            beam_size=beam_size,
            word_timestamps=True,
            vad_filter=vad_filter,
        )

        if verbose:
            detected = getattr(info, "language", None) or "unknown"
            print(f"  Transcribing (language={detected}) ...")

        raw: list[Word] = []
        for segment in segments:
            for word in (segment.words or []):
                raw.append(Word(
                    text=word.word,
                    start=word.start,
                    end=word.end,
                    probability=getattr(word, "probability", 1.0) or 1.0,
                ))
            if verbose:
                sys.stdout.write(f"\r  ... {segment.end:6.1f}s transcribed")
                sys.stdout.flush()
        if verbose:
            sys.stdout.write("\r" + " " * 40 + "\r")

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    words = clean_words(raw)
    if not words:
        raise TranscriptionError(
            "Whisper returned no words. The audio may be silent, music-only, "
            "or too noisy — try --model small and --no-vad."
        )

    if verbose:
        print(f"  Got {len(words)} words "
              f"({words[0].start:.2f}s -> {words[-1].end:.2f}s)")

    if cache_path:
        save_words(words, cache_path)
        if verbose:
            print(f"  Cached transcript to {cache_path}")

    return words


# ---------------------------------------------------------------------------
# JSON round-trip
# ---------------------------------------------------------------------------

def save_words(words: list[Word], path: str) -> None:
    parent = os.path.dirname(os.path.abspath(path))
    os.makedirs(parent, exist_ok=True)
    payload = {"version": 1, "words": [asdict(w) for w in words]}
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)


def load_words(path: str) -> list[Word]:
    with open(path, encoding="utf-8") as fh:
        payload = json.load(fh)
    entries = payload["words"] if isinstance(payload, dict) else payload
    words = [
        Word(
            text=entry["text"],
            start=float(entry["start"]),
            end=float(entry["end"]),
            probability=float(entry.get("probability", 1.0)),
        )
        for entry in entries
    ]
    if not words:
        raise TranscriptionError(f"Transcript {path!r} contains no words.")
    return clean_words(words)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Dump word-level timestamps.")
    parser.add_argument("video")
    parser.add_argument("--model", default="base")
    parser.add_argument("--device", default="auto")
    parser.add_argument("--language", default=None)
    parser.add_argument("--out", default=None, help="Write the words to JSON.")
    args = parser.parse_args()

    try:
        result = transcribe_words(
            args.video, model_size=args.model, device=args.device,
            language=args.language, cache_path=args.out,
        )
    except TranscriptionError as err:
        print(f"Error: {err}", file=sys.stderr)
        raise SystemExit(1)

    for item in result:
        print(f"{item.start:7.2f} -> {item.end:7.2f}  {item.text}")
