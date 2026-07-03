#!/usr/bin/env python3
"""
generate_voiceover.py — turn the VO lines in docs/FIRST_10_SHORTS.md into audio
files using a local OpenAI-compatible TTS server (e.g. travisvn/openai-edge-tts):

    docker run -d -p 5050:5050 travisvn/openai-edge-tts:latest

Works two ways:
  * Batch: pull the voiceover text straight out of the script doc and render
    one audio file per Short.
  * Ad hoc: render any text you pass in directly.

Usage:
    python tools/generate_voiceover.py --list
    python tools/generate_voiceover.py --short 1
    python tools/generate_voiceover.py --all
    python tools/generate_voiceover.py --text "Hello from the void" -o hello.mp3

Configure the server with env vars (see .env.example):
    TTS_API_URL   e.g. http://localhost:5050   (default)
    TTS_API_KEY   only needed if the server was started with REQUIRE_API_KEY=True
    TTS_VOICE     e.g. onyx, echo, fable...     (default: onyx)
    TTS_FORMAT    mp3, opus, aac, flac, wav, pcm (default: mp3)
    TTS_SPEED     0.25-4.0                      (default: 0.9, slow/certain per
                                                  the Production notes)
"""

import argparse
import os
import re
import sys
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SOURCE = os.path.join(HERE, "..", "docs", "FIRST_10_SHORTS.md")
DEFAULT_OUTPUT_DIR = os.path.join(HERE, "..", "voiceovers")

HEADING_RE = re.compile(r'^##\s*(\d+)\s*—\s*"(.+?)"')
VO_RE = re.compile(r'^-\s*\*\*VO:\*\*\s*"(.+)"\s*$')


def parse_shorts(source_path):
    """Return a list of {number, title, vo} dicts parsed out of the script doc."""
    shorts = []
    current = None
    with open(source_path, encoding="utf-8") as f:
        for line in f:
            heading = HEADING_RE.match(line)
            if heading:
                current = {"number": int(heading.group(1)), "title": heading.group(2)}
                continue
            vo = VO_RE.match(line)
            if vo and current is not None:
                current["vo"] = vo.group(1)
                shorts.append(current)
                current = None
    return shorts


def slugify(title):
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return slug or "untitled"


def synthesize(text, api_url, api_key, voice, response_format, speed):
    """POST text to the TTS server's OpenAI-compatible /v1/audio/speech endpoint."""
    url = api_url.rstrip("/") + "/v1/audio/speech"
    payload = {
        "model": "tts-1",
        "input": text,
        "voice": voice,
        "response_format": response_format,
        "speed": speed,
    }
    import json

    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"TTS server returned {e.code}: {body}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(
            f"Couldn't reach TTS server at {url} ({e.reason}). "
            "Is the container running? docker run -d -p 5050:5050 travisvn/openai-edge-tts:latest"
        ) from e


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--source", default=DEFAULT_SOURCE,
                     help="Script doc to parse VO lines from (default: docs/FIRST_10_SHORTS.md)")
    ap.add_argument("--output-dir", default=DEFAULT_OUTPUT_DIR,
                     help="Where to write audio files (default: voiceovers/)")
    ap.add_argument("--list", action="store_true", help="List parsed Shorts and exit")
    ap.add_argument("--short", type=int, help="Generate audio for one Short by number")
    ap.add_argument("--all", action="store_true", help="Generate audio for every Short")
    ap.add_argument("--text", help="Generate audio for arbitrary text instead of the doc")
    ap.add_argument("-o", "--out", help="Output filename, used with --text")
    ap.add_argument("--api-url", default=os.environ.get("TTS_API_URL", "http://localhost:5050"))
    ap.add_argument("--api-key", default=os.environ.get("TTS_API_KEY", ""))
    ap.add_argument("--voice", default=os.environ.get("TTS_VOICE", "onyx"))
    ap.add_argument("--format", dest="response_format",
                     default=os.environ.get("TTS_FORMAT", "mp3"))
    ap.add_argument("--speed", type=float, default=float(os.environ.get("TTS_SPEED", "0.9")))
    args = ap.parse_args()

    if args.text:
        out = args.out or "voiceover." + args.response_format
        os.makedirs(os.path.dirname(os.path.abspath(out)) or ".", exist_ok=True)
        print(f"Synthesizing custom text -> {out}")
        try:
            audio = synthesize(args.text, args.api_url, args.api_key, args.voice,
                                args.response_format, args.speed)
        except RuntimeError as e:
            print(f"  {e}", file=sys.stderr)
            sys.exit(1)
        with open(out, "wb") as f:
            f.write(audio)
        print(f"  wrote {len(audio):,} bytes")
        return

    shorts = parse_shorts(args.source)
    if not shorts:
        print(f"No VO lines found in {args.source}", file=sys.stderr)
        sys.exit(1)

    if args.list:
        print(f"\n  {len(shorts)} Shorts found in {args.source}")
        print("  " + "=" * 56)
        for s in shorts:
            print(f"  {s['number']:>2}. {s['title']}  ({len(s['vo'].split())} words)")
        print()
        return

    if args.short:
        selected = [s for s in shorts if s["number"] == args.short]
        if not selected:
            print(f"No Short #{args.short} found in {args.source}", file=sys.stderr)
            sys.exit(1)
    elif args.all:
        selected = shorts
    else:
        ap.error("pass --list, --short N, --all, or --text")
        return

    os.makedirs(args.output_dir, exist_ok=True)
    for s in selected:
        filename = f"{s['number']:02d}-{slugify(s['title'])}.{args.response_format}"
        out_path = os.path.join(args.output_dir, filename)
        print(f"  {s['number']:>2}. {s['title']} -> {out_path}")
        try:
            audio = synthesize(s["vo"], args.api_url, args.api_key, args.voice,
                                args.response_format, args.speed)
        except RuntimeError as e:
            print(f"      {e}", file=sys.stderr)
            sys.exit(1)
        with open(out_path, "wb") as f:
            f.write(audio)
        print(f"      wrote {len(audio):,} bytes")

    print(f"\n  Done. {len(selected)} file(s) in {args.output_dir}/\n")


if __name__ == "__main__":
    main()
