#!/usr/bin/env python3
"""
kokoro_vo.py — record the voiceover with Kokoro, locally and for free.

The Verticals v3 pipeline ships Edge TTS, ElevenLabs, MiniMax, 60db and macOS
`say`. Kokoro is on its roadmap, not in it. Rather than fork the pipeline, this
renders the voiceover here and hands it over: the audio is written into the
pipeline's work directory and the draft's `voiceover` stage is marked done, so
`verticals produce` skips its own TTS and uses ours — the same resume mechanism
tools/to_verticals.py uses to skip the script stage.

    to_verticals.py  ->  [ kokoro_vo.py ]  ->  verticals produce
                            (voiceover)        (b-roll, captions, assemble)

Kokoro is 82M parameters, Apache-2.0, and runs on CPU — no API key, no per-word
billing, and the voice can't be deprecated out from under the channel.

Setup (once):
    pip install kokoro soundfile
    apt-get install espeak-ng        # for out-of-dictionary words

Usage:
    python tools/kokoro_vo.py --draft ~/.verticals/drafts/<job_id>.json
    python tools/kokoro_vo.py --draft <path> --voice af_bella --speed 0.95
    python tools/kokoro_vo.py --list-voices

Then render as usual — the voiceover stage is already done:
    python -m verticals produce --draft ~/.verticals/drafts/<job_id>.json

Voice choice matters more than it looks: Kokoro's own grades run from A down to
F, and most voices are C or below. --list-voices shows them; the tool warns
before spending time synthesising with a poorly-graded one.
"""

import argparse
import json
import os
import sys
import time
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from to_verticals import placeholders  # noqa: E402  (same TTS safety guard)

SAMPLE_RATE = 24000  # Kokoro's native output rate
DEFAULT_MEDIA_DIR = os.path.join(os.path.expanduser("~"), ".verticals", "media")

# Grades published in the Kokoro model card (kokoro.js/README.md). Only a
# handful of voices are genuinely broadcast quality; the rest are usable but
# audibly worse, which on a faceless channel is the whole product.
VOICES = {
    # American English
    "af_heart":   ("F", "A",  "American English"),
    "af_bella":   ("F", "A-", "American English"),
    "af_nicole":  ("F", "B-", "American English (ASMR/headphone)"),
    "af_aoede":   ("F", "C+", "American English"),
    "af_kore":    ("F", "C+", "American English"),
    "af_sarah":   ("F", "C+", "American English"),
    "af_alloy":   ("F", "C",  "American English"),
    "af_nova":    ("F", "C",  "American English"),
    "af_sky":     ("F", "C-", "American English"),
    "af_jessica": ("F", "D",  "American English"),
    "af_river":   ("F", "D",  "American English"),
    "am_fenrir":  ("M", "C+", "American English"),
    "am_michael": ("M", "C+", "American English"),
    "am_puck":    ("M", "C+", "American English"),
    "am_echo":    ("M", "D",  "American English"),
    "am_eric":    ("M", "D",  "American English"),
    "am_liam":    ("M", "D",  "American English"),
    "am_onyx":    ("M", "D",  "American English"),
    "am_santa":   ("M", "D-", "American English"),
    "am_adam":    ("M", "F+", "American English"),
    # British English
    "bf_emma":     ("F", "B-", "British English"),
    "bf_isabella": ("F", "C",  "British English"),
    "bf_alice":    ("F", "D",  "British English"),
    "bf_lily":     ("F", "D",  "British English"),
    "bm_fable":    ("M", "C",  "British English"),
    "bm_george":   ("M", "C",  "British English"),
    "bm_lewis":    ("M", "D+", "British English"),
    "bm_daniel":   ("M", "D",  "British English"),
}
GOOD_GRADES = {"A", "A-", "B", "B-", "B+"}
POOR_GRADES = {"D+", "D", "D-", "F+", "F"}

# Kokoro splits on blank lines by default. Our voiceovers are a single
# paragraph, so split on sentence ends instead — that gives natural pauses
# and keeps every chunk well inside the model's token limit.
SENTENCE_SPLIT = r"(?<=[.!?])\s+"


def list_voices():
    """Print the graded voice table, best first."""
    order = {"A": 0, "A-": 1, "B+": 2, "B": 3, "B-": 4, "C+": 5, "C": 6,
             "C-": 7, "D+": 8, "D": 9, "D-": 10, "F+": 11, "F": 12}
    rows = sorted(VOICES.items(), key=lambda kv: (order.get(kv[1][1], 99), kv[0]))
    print("\n  Kokoro voices, by the model card's own overall grade:\n")
    print(f"    {'voice':<14} {'sex':<4} {'grade':<6} language")
    for name, (sex, grade, lang) in rows:
        mark = " <-- recommended" if grade in GOOD_GRADES else ""
        print(f"    {name:<14} {sex:<4} {grade:<6} {lang}{mark}")
    print("\n  Only four voices grade B- or better, and all four are female.")
    print("  The best male voices are C+ (am_michael, am_fenrir, am_puck):")
    print("  if the channel needs a male narrator, that is the ceiling today.")
    print("\n  Voices can be blended by passing a comma-separated list,")
    print("  e.g. --voice af_heart,af_bella (Kokoro averages the two).\n")


def lang_code_for(voice):
    """Kokoro requires the voice prefix to match the pipeline's language code.

    'af_heart' -> 'a' (American English), 'bm_george' -> 'b' (British).
    """
    first = (voice or "a")[0].lower()
    return first if first in "abefhijpz" else "a"


def synthesize(text, voice, speed, lang_code):
    """Run Kokoro and return a list of float32 numpy chunks at 24 kHz."""
    try:
        from kokoro import KPipeline
    except ImportError:
        sys.exit(
            "Kokoro is not installed. Run:\n"
            "    pip install kokoro soundfile\n"
            "    apt-get install espeak-ng   # for out-of-dictionary words"
        )

    pipeline = KPipeline(lang_code=lang_code)
    chunks = []
    for result in pipeline(text, voice=voice, speed=speed,
                           split_pattern=SENTENCE_SPLIT):
        audio = result.audio
        if audio is None:
            continue
        chunks.append(audio.detach().cpu().numpy())
    if not chunks:
        sys.exit("Kokoro produced no audio — is the script empty?")
    return chunks


def join_chunks(chunks, pause_s):
    """Concatenate sentence chunks with a short pause between them."""
    import numpy as np

    if pause_s <= 0 or len(chunks) == 1:
        return np.concatenate(chunks)
    gap = np.zeros(int(SAMPLE_RATE * pause_s), dtype=chunks[0].dtype)
    joined = []
    for i, chunk in enumerate(chunks):
        joined.append(chunk)
        if i < len(chunks) - 1:
            joined.append(gap)
    return np.concatenate(joined)


def write_wav(samples, path):
    """Write 16-bit PCM. Uses soundfile when present, else the stdlib.

    Downstream only needs a readable audio file — Whisper derives caption
    timings from it and ffmpeg reads its duration — so the stdlib path is a
    genuine fallback, not a degraded one.
    """
    try:
        import soundfile as sf
        sf.write(path, samples, SAMPLE_RATE)
        return
    except ImportError:
        pass

    import numpy as np
    clipped = np.clip(samples, -1.0, 1.0)
    pcm = (clipped * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(pcm.tobytes())


def main():
    ap = argparse.ArgumentParser(
        description="Render a draft's voiceover with Kokoro and hand it to Verticals.")
    ap.add_argument("--draft", help="Draft JSON from tools/to_verticals.py")
    ap.add_argument("--voice", default="af_heart",
                    help="Kokoro voice, or a comma-separated blend (default af_heart)")
    ap.add_argument("--speed", type=float, default=1.0,
                    help="Speaking rate; 0.9-0.95 suits ominous narration (default 1.0)")
    ap.add_argument("--pause", type=float, default=0.15,
                    help="Seconds of silence between sentences (default 0.15)")
    ap.add_argument("--lang", default="en",
                    help="Pipeline language tag used in filenames (default en)")
    ap.add_argument("--media-dir", default=DEFAULT_MEDIA_DIR,
                    help=f"Pipeline media dir (default {DEFAULT_MEDIA_DIR})")
    ap.add_argument("--out", default="",
                    help="Write the audio here instead of the pipeline's work dir")
    ap.add_argument("--list-voices", action="store_true", help="Show graded voices and exit")
    ap.add_argument("--force", action="store_true", help="Re-record even if already done")
    ap.add_argument("--allow-placeholders", action="store_true",
                    help="Speak unfilled [FACT: ...] slots aloud anyway")
    args = ap.parse_args()

    if args.list_voices:
        list_voices()
        return
    if not args.draft:
        ap.error("--draft is required (or use --list-voices)")

    if args.voice not in VOICES and "," not in args.voice:
        print(f"  ! '{args.voice}' is not a known Kokoro voice. "
              f"Run --list-voices to see the options.")
    for v in args.voice.split(","):
        grade = VOICES.get(v.strip(), (None, None, None))[1]
        if grade in POOR_GRADES:
            print(f"  ! '{v.strip()}' is graded {grade} by Kokoro's own model card. "
                  f"af_heart (A) or af_bella (A-) will sound noticeably better.")

    with open(args.draft) as f:
        draft = json.load(f)

    state = draft.setdefault("_pipeline_state", {})
    if state.get("voiceover", {}).get("status") == "done" and not args.force:
        existing = state["voiceover"].get("artifacts", {}).get("path", "")
        print(f"  Voiceover already recorded: {existing}")
        print("  Pass --force to re-record.")
        return

    script = (draft.get("script") or "").strip()
    if not script:
        sys.exit(f"No 'script' in {args.draft}")

    slots = placeholders(script)
    if slots and not args.allow_placeholders:
        print("\n  This script still has unfilled research slots, which Kokoro")
        print("  would read aloud word for word:\n")
        for slot in slots[:5]:
            print(f"    {slot}")
        sys.exit("\n  Fill them in, or pass --allow-placeholders.")

    job_id = draft.get("job_id") or str(int(time.time()))
    if args.out:
        out_path = args.out
        os.makedirs(os.path.dirname(os.path.abspath(out_path)) or ".", exist_ok=True)
    else:
        # Mirror the pipeline's own layout so `produce` finds the file where
        # it would have written one itself.
        work_dir = os.path.join(args.media_dir, f"work_{job_id}_{args.lang}")
        os.makedirs(work_dir, exist_ok=True)
        out_path = os.path.join(work_dir, f"voiceover_{args.lang}.wav")

    words = len(script.split())
    lang_code = lang_code_for(args.voice)
    print(f"\n  Recording {words} words as {args.voice} "
          f"(speed {args.speed}, lang_code '{lang_code}')...")

    started = time.time()
    chunks = synthesize(script, args.voice, args.speed, lang_code)
    samples = join_chunks(chunks, args.pause)
    write_wav(samples, out_path)
    elapsed = time.time() - started

    duration = len(samples) / SAMPLE_RATE
    print(f"  Wrote {out_path}")
    print(f"  {duration:.1f}s of audio from {len(chunks)} sentence(s) "
          f"in {elapsed:.1f}s")

    if duration > 60:
        print(f"  ! {duration:.0f}s is long for a Short — consider --speed 1.1 "
              f"or a tighter script.")

    stamp = time.strftime("%Y-%m-%dT%H:%M:%S+00:00", time.gmtime())
    state["voiceover"] = {
        "status": "done",
        "timestamp": stamp,
        "artifacts": {"path": os.path.abspath(out_path)},
    }
    with open(args.draft, "w") as f:
        json.dump(draft, f, indent=2, ensure_ascii=False)
    print(f"  Marked the voiceover stage done in {os.path.basename(args.draft)}")

    print("\n  Render the rest with:")
    print(f"    python -m verticals produce --draft {args.draft}")


if __name__ == "__main__":
    main()
