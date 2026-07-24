#!/usr/bin/env python3
"""Breakout Files — one command, one finished .mp4.

    python run.py "Case Name"        real run (Claude + ElevenLabs + FLUX + ffmpeg)
    python run.py --dry-run          offline test: bundled sample script + synthetic
                                      placeholder images/audio, no API calls, no credits

Five stages, all in this one file: SCRIPT -> VOICEOVER -> IMAGES -> ASSEMBLY -> METADATA.
Every knob (keys, voice id, style prompt, Space name) lives in config.yaml.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent


# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------

_ENV_PATTERN = re.compile(r"\$\{([A-Z0-9_]+)\}")


def _expand_env(value):
    if isinstance(value, str):
        return _ENV_PATTERN.sub(lambda m: os.environ.get(m.group(1), ""), value)
    if isinstance(value, dict):
        return {k: _expand_env(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_expand_env(v) for v in value]
    return value


def load_config(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)
    return _expand_env(raw)


def require(cfg: dict, dotted_key: str) -> str:
    """Fetch a required (secret) config value, erroring clearly if unset."""
    node = cfg
    for part in dotted_key.split("."):
        node = node[part]
    if not node:
        env_hint = dotted_key.split(".")[-1].upper()
        raise SystemExit(
            f"Missing config value '{dotted_key}'. Set the matching environment "
            f"variable (see .env.example) and `source .env` before running."
        )
    return node


# --------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------

def log(msg: str) -> None:
    print(f"[breakout-files] {msg}", flush=True)


def run_ffmpeg(args: list, quiet: bool = True) -> None:
    cmd = ["ffmpeg", "-y", "-hide_banner"]
    if quiet:
        cmd += ["-loglevel", "error"]
    cmd += args
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {' '.join(cmd)}\n{result.stderr[-4000:]}")


def ffprobe_duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(path),
        ],
        capture_output=True, text=True,
    )
    return float(result.stdout.strip())


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "case"


def parse_json_response(text: str) -> dict:
    """Claude is asked for raw JSON but strip fences defensively if present."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON object found in model response:\n{text[:500]}")
    return json.loads(match.group(0))


# --------------------------------------------------------------------------
# Stage 1 — SCRIPT (Claude API)
# --------------------------------------------------------------------------

def generate_script(case_name: str, cfg: dict) -> dict:
    log(f"Stage 1/5 — generating script for '{case_name}' via Claude...")
    api_key = require(cfg, "anthropic.api_key")
    try:
        import anthropic
    except ImportError:
        raise SystemExit("pip install anthropic  (see requirements.txt)")

    client = anthropic.Anthropic(api_key=api_key)
    ac = cfg["anthropic"]
    response = client.messages.create(
        model=ac["model"],
        max_tokens=ac.get("max_tokens", 2000),
        system=ac["system_prompt"],
        messages=[{"role": "user", "content": f"Case: {case_name}"}],
    )
    text = "".join(block.text for block in response.content if block.type == "text")
    script = parse_json_response(text)

    n = len(script.get("scenes", []))
    lo, hi = cfg["image"]["count_min"], cfg["image"]["count_max"]
    if not (lo <= n <= hi):
        log(f"warning: model returned {n} scenes (expected {lo}-{hi}); continuing anyway")
    script["case_name"] = case_name
    return script


# --------------------------------------------------------------------------
# Stage 2 — VOICEOVER (ElevenLabs)
# --------------------------------------------------------------------------

def generate_voiceover(script: dict, cfg: dict, out_dir: Path) -> None:
    log("Stage 2/5 — generating voiceover (ElevenLabs)...")
    api_key = require(cfg, "elevenlabs.api_key")
    ec = cfg["elevenlabs"]
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ec['voice_id']}/with-timestamps"

    for i, scene in enumerate(script["scenes"]):
        body = json.dumps({
            "text": scene["narration"],
            "model_id": ec.get("model_id", "eleven_multilingual_v2"),
            "voice_settings": ec.get("voice_settings", {}),
        }).encode("utf-8")
        req = urllib.request.Request(
            url, data=body, method="POST",
            headers={
                "xi-api-key": api_key,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"ElevenLabs error on scene {i}: {e.code} {e.read().decode()[:300]}")

        audio_bytes = base64.b64decode(payload["audio_base64"])
        mp3_path = out_dir / f"scene_{i:02d}.mp3"
        mp3_path.write_bytes(audio_bytes)

        alignment = payload.get("alignment") or {}
        ends = alignment.get("character_end_times_seconds")
        duration = ends[-1] if ends else ffprobe_duration(mp3_path)

        scene["audio_path"] = str(mp3_path)
        scene["duration"] = round(float(duration), 3)
        log(f"  scene {i}: {scene['duration']}s -> {mp3_path.name}")


# --------------------------------------------------------------------------
# Stage 3 — IMAGES (FLUX.1-schnell via HF ZeroGPU Space)
# --------------------------------------------------------------------------

def _crop_to_target(src: Path, dst: Path, width: int, height: int) -> None:
    run_ffmpeg([
        "-i", str(src),
        "-vf", f"scale={width}:{height}:force_original_aspect_ratio=increase,"
               f"crop={width}:{height}",
        "-frames:v", "1",
        str(dst),
    ])


def _next_stock_frame(cfg: dict, used: set) -> Path | None:
    stock_dir = HERE / cfg["image"]["fallback_stock_dir"]
    if not stock_dir.is_dir():
        return None
    candidates = sorted(
        p for p in stock_dir.iterdir()
        if p.suffix.lower() in (".jpg", ".jpeg", ".png")
    )
    if not candidates:
        return None
    for p in candidates:
        if p not in used:
            used.add(p)
            return p
    return candidates[0]  # reuse cyclically once exhausted


def generate_images(script: dict, cfg: dict, out_dir: Path) -> None:
    log("Stage 3/5 — generating images (FLUX.1-schnell)...")
    hf_token = require(cfg, "huggingface.token")
    try:
        from gradio_client import Client
    except ImportError:
        raise SystemExit("pip install gradio_client  (see requirements.txt)")

    hc = cfg["huggingface"]
    ic = cfg["image"]
    client = Client(hc["space"], hf_token=hf_token)
    used_stock: set = set()

    for i, scene in enumerate(script["scenes"]):
        full_prompt = f"{ic['style_prompt']}, {scene['image_prompt']}"
        dst = out_dir / f"scene_{i:02d}.jpg"
        raw_path = None

        for attempt in range(1, hc.get("retry_attempts", 3) + 1):
            try:
                result = client.predict(
                    prompt=full_prompt,
                    negative_prompt=ic.get("negative_prompt", ""),
                    seed=0,
                    randomize_seed=True,
                    width=1024,
                    height=1024,
                    num_inference_steps=hc.get("num_inference_steps", 4),
                    api_name=hc.get("api_name", "/infer"),
                )
                raw_path = Path(result[0] if isinstance(result, (list, tuple)) else result)
                break
            except Exception as e:
                log(f"  scene {i}: image attempt {attempt} failed ({e})")
                if attempt < hc.get("retry_attempts", 3):
                    time.sleep(hc.get("retry_backoff_sec", 5))

        if raw_path and raw_path.exists():
            _crop_to_target(raw_path, dst, ic["width"], ic["height"])
            log(f"  scene {i}: generated -> {dst.name}")
        else:
            stock = _next_stock_frame(cfg, used_stock)
            if stock is None:
                raise RuntimeError(
                    f"scene {i}: image generation failed and no fallback stock "
                    f"frames found in {ic['fallback_stock_dir']}/"
                )
            _crop_to_target(stock, dst, ic["width"], ic["height"])
            log(f"  scene {i}: fell back to stock frame {stock.name}")

        scene["image_path"] = str(dst)


# --------------------------------------------------------------------------
# Stage 4 — ASSEMBLY (ffmpeg only)
# --------------------------------------------------------------------------

def _kenburns_clip(scene: dict, index: int, cfg: dict, tmp_dir: Path) -> Path:
    vc = cfg["video"]
    w, h, fps = vc["width"], vc["height"], vc["fps"]
    duration = scene["duration"]
    nframes = max(1, round(duration * fps))

    zoom_per_frame = vc["kenburns_zoom_per_sec"] / fps
    max_zoom = vc["kenburns_max_zoom"]
    zoom_out = index % 2 == 1  # alternate zoom-in / zoom-out for variety
    if zoom_out:
        zoom_expr = f"max({max_zoom}-on*{zoom_per_frame:.6f},1.0)"
    else:
        zoom_expr = f"min(1.0+on*{zoom_per_frame:.6f},{max_zoom})"

    clip_path = tmp_dir / f"clip_{index:02d}.mp4"
    run_ffmpeg([
        "-loop", "1", "-i", scene["image_path"],
        "-vf",
        (
            f"scale={w * 2}:{h * 2}:force_original_aspect_ratio=increase,"
            f"crop={w * 2}:{h * 2},"
            f"zoompan=z='{zoom_expr}':d={nframes}:s={w}x{h}:fps={fps}:"
            "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)',"
            f"format=yuv420p"
        ),
        "-t", f"{duration:.3f}",
        "-an",
        str(clip_path),
    ])
    return clip_path


def assemble_video(script: dict, cfg: dict, out_dir: Path, tmp_dir: Path) -> Path:
    log("Stage 4/5 — assembling video (ffmpeg)...")
    vc = cfg["video"]
    scenes = script["scenes"]
    n = len(scenes)
    crossfade = vc["crossfade_sec"]

    clip_paths = [_kenburns_clip(scenes[i], i, cfg, tmp_dir) for i in range(n)]
    durations = [scenes[i]["duration"] for i in range(n)]

    inputs = []
    for p in clip_paths:
        inputs += ["-i", str(p)]
    for s in scenes:
        inputs += ["-i", s["audio_path"]]

    music_path = HERE / vc["music_file"]
    has_music = music_path.is_file()
    if has_music:
        inputs += ["-stream_loop", "-1", "-i", str(music_path)]

    filter_parts = []

    # Video crossfade chain
    if n == 1:
        v_out = "0:v"
    else:
        running = durations[0]
        prev = "0:v"
        for i in range(1, n):
            offset = max(running - crossfade, 0)
            out_label = f"v{i}" if i < n - 1 else "vout"
            filter_parts.append(
                f"[{prev}][{i}:v]xfade=transition=fade:duration={crossfade}:"
                f"offset={offset:.3f}[{out_label}]"
            )
            running = running + durations[i] - crossfade
            prev = out_label
        v_out = "vout"
    total_duration = sum(durations) - crossfade * max(n - 1, 0)

    # Audio crossfade chain (narration)
    if n == 1:
        narr_out = f"{n}:a"
    else:
        prev = f"{n}:a"
        for i in range(1, n):
            out_label = f"a{i}" if i < n - 1 else "anarr"
            filter_parts.append(
                f"[{prev}][{n + i}:a]acrossfade=d={crossfade}[{out_label}]"
            )
            prev = out_label
        narr_out = "anarr"

    if has_music:
        music_index = 2 * n
        duck_db = vc["music_duck_db"]
        filter_parts.append(
            f"[{music_index}:a]atrim=0:{total_duration:.3f},"
            f"volume={duck_db}dB,afade=t=out:st={max(total_duration - 1, 0):.3f}:d=1[music]"
        )
        filter_parts.append(
            f"[{narr_out}][music]amix=inputs=2:duration=first:dropout_transition=0[aout]"
        )
        a_out = "aout"
    else:
        a_out = narr_out

    filter_complex = ";".join(filter_parts)
    out_path = out_dir / "final.mp4"
    run_ffmpeg(
        inputs + [
            "-filter_complex", filter_complex,
            "-map", f"[{v_out}]", "-map", f"[{a_out}]",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k",
            "-t", f"{total_duration:.3f}",
            str(out_path),
        ]
    )
    log(f"  wrote {out_path} ({total_duration:.1f}s)")
    return out_path


# --------------------------------------------------------------------------
# Stage 5 — METADATA
# --------------------------------------------------------------------------

def write_metadata(script: dict, video_path: Path, cfg: dict) -> Path:
    log("Stage 5/5 — writing metadata...")
    meta_path = video_path.parent / cfg["metadata"]["filename"]
    hashtags = " ".join(script.get("hashtags", [])[:3])
    meta_path.write_text(
        f"Title: {script.get('title', script.get('case_name', ''))}\n"
        f"Description: {script.get('description', '')}\n"
        f"Hashtags: {hashtags}\n",
        encoding="utf-8",
    )
    log(f"  wrote {meta_path}")
    return meta_path


# --------------------------------------------------------------------------
# Dry-run support — synthetic assets, zero API calls
# --------------------------------------------------------------------------

def _make_placeholder_image(dst: Path, label: str, width: int, height: int) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    safe_label = label.replace("'", r"\'").replace(":", r"\:")
    run_ffmpeg([
        "-f", "lavfi",
        "-i", f"color=c=0x1a2233:s={width}x{height}",
        "-vf",
        (
            f"drawtext=text='{safe_label}':fontcolor=white:fontsize=48:"
            "x=(w-text_w)/2:y=(h-text_h)/2"
        ),
        "-frames:v", "1",
        str(dst),
    ])


def _make_silent_audio(dst: Path, duration: float) -> None:
    run_ffmpeg([
        "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=mono",
        "-t", f"{duration:.3f}",
        str(dst),
    ])


def load_dry_run_script(cfg: dict, out_dir: Path) -> dict:
    sample_path = HERE / cfg["dry_run"]["sample_script"]
    script = json.loads(sample_path.read_text(encoding="utf-8"))
    placeholder_dir = HERE / cfg["dry_run"]["placeholder_dir"]
    ic, vc = cfg["image"], cfg["video"]

    for i, scene in enumerate(script["scenes"]):
        img_src = placeholder_dir / f"scene_{i:02d}.jpg"
        if not img_src.exists():
            _make_placeholder_image(img_src, f"Scene {i + 1}", ic["width"], ic["height"])
        img_dst = out_dir / f"scene_{i:02d}.jpg"
        shutil.copyfile(img_src, img_dst)
        scene["image_path"] = str(img_dst)

        duration = float(scene.get("duration", 6.0))
        audio_dst = out_dir / f"scene_{i:02d}.mp3"
        _make_silent_audio(audio_dst, duration)
        scene["audio_path"] = str(audio_dst)
        scene["duration"] = duration

    script.setdefault("case_name", "Dry Run Sample")
    log(f"Dry run: loaded {sample_path.name}, synthesized {len(script['scenes'])} placeholder scenes")
    return script


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Breakout Files — Case File Shorts pipeline")
    parser.add_argument("case_name", nargs="?", help="Case name/description to script, e.g. 'John Doe (Texas, 1998)'")
    parser.add_argument("--config", default=str(HERE / "config.yaml"))
    parser.add_argument("--dry-run", action="store_true", help="Use bundled sample script + synthetic assets, no API calls")
    args = parser.parse_args()

    if not args.dry_run and not args.case_name:
        parser.error("case_name is required unless --dry-run is set")

    cfg = load_config(Path(args.config))

    slug = slugify(args.case_name) if args.case_name else "dry-run"
    out_dir = HERE / cfg["output"]["dir"] / slug
    tmp_dir = HERE / cfg["output"]["tmp_dir"] / slug
    out_dir.mkdir(parents=True, exist_ok=True)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    if args.dry_run:
        script = load_dry_run_script(cfg, out_dir)
    else:
        script = generate_script(args.case_name, cfg)
        (out_dir / "script.json").write_text(json.dumps(script, indent=2), encoding="utf-8")
        generate_voiceover(script, cfg, out_dir)
        generate_images(script, cfg, out_dir)

    video_path = assemble_video(script, cfg, out_dir, tmp_dir)
    write_metadata(script, video_path, cfg)

    shutil.rmtree(tmp_dir, ignore_errors=True)
    log(f"Done -> {video_path}")


if __name__ == "__main__":
    main()
