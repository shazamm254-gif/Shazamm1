#!/usr/bin/env python3
"""
assembler.py — Stage 6: renders a finished 1080x1920 vertical Short from the
voiceover + visuals produced by earlier stages, ready for upload.

Runs headless (no GPU, no display) via ffmpeg/ffprobe subprocesses. Captions
are burned in as Pillow-rendered PNG overlays (not the subtitles/libass
filter), so nothing here depends on ffmpeg being built with libass.

Job folder layout (all paths relative to --job):
    voiceover.mp3     ElevenLabs narration (required)
    timestamps.json   word-level timing from the ElevenLabs timestamps
                       endpoint (required) — accepts either the raw
                       character-level `alignment` block ElevenLabs returns,
                       or a pre-grouped `{"words": [{"word","start","end"}]}`
                       list
    images/            numbered Leonardo stills: 01.png, 02.png, ... (required)
    script.json        beat list mapping each beat to an image + start/end
                       time, e.g. {"slug": "...", "beats": [{"image": "01.png",
                       "start": 0.0, "end": 3.4}, ...]}. "end" may be omitted
                       and is inferred from the next beat's "start" (or the
                       voiceover duration for the last beat). (required)
    music.mp3          optional background track, ducked under the VO

Usage:
    python tools/assembler.py --job jobs/grocery-stores-designed-to-rob-you
    python tools/assembler.py --job jobs/my-short --preview   # first 5s only

Output:
    <job>/<slug>.mp4 — 1080x1920, H.264 + AAC, 30fps

If GDRIVE_UPLOAD=1 is set, the finished file is uploaded to the Google Drive
folder GDRIVE_FOLDER_ID using the service account at
GOOGLE_APPLICATION_CREDENTIALS. Otherwise the file is simply left in the job
folder.
"""

import argparse
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# --- Output spec -------------------------------------------------------
WIDTH, HEIGHT, FPS = 1080, 1920, 30
TAIL_SECONDS = 0.5          # extra hold after the voiceover ends
PREVIEW_SECONDS = 5.0

# --- Ken Burns tuning ----------------------------------------------------
# Each still is first scaled+cropped to cover this oversized canvas (1.5x the
# final frame) so zoompan/pan has headroom to move without exposing edges.
CANVAS_W, CANVAS_H = int(WIDTH * 1.5), int(HEIGHT * 1.5)
MAX_ZOOM = 1.25       # ceiling for the zoom-in / floor-reversal for zoom-out
PAN_ZOOM = 1.12        # fixed zoom used during the lateral-drift effect

# --- Captions --------------------------------------------------------------
CAPTION_MIN_WORDS, CAPTION_MAX_WORDS = 2, 4
CAPTION_FONT_SIZE = 72
CAPTION_Y_FRACTION = 0.70    # vertical center of the caption, as a fraction of HEIGHT
CAPTION_BOX_OPACITY = int(0.85 * 255)
CAPTION_BOX_PAD_X, CAPTION_BOX_PAD_Y = 36, 22
CAPTION_BOX_RADIUS = 24

MUSIC_DUCK_DB = -18
MUSIC_FADE_OUT_S = 1.0


# ============================================================================
# Environment / robustness
# ============================================================================

def check_ffmpeg():
    missing = [b for b in ("ffmpeg", "ffprobe") if shutil.which(b) is None]
    if missing:
        sys.exit(
            "Missing required binary/binaries: " + ", ".join(missing) + "\n\n"
            "assembler.py renders video via ffmpeg/ffprobe and needs both on PATH.\n"
            "Install instructions:\n"
            "  Debian/Ubuntu (incl. most Render environments): apt-get update && apt-get install -y ffmpeg\n"
            "  macOS (Homebrew):                                brew install ffmpeg\n"
            "  Render specifically: add an apt.txt file containing 'ffmpeg' to your\n"
            "  repo root (Render's native buildpack installs apt.txt packages at build\n"
            "  time), or switch to a Docker-based service with ffmpeg in the image."
        )


def run(cmd, label):
    """Run an ffmpeg/ffprobe command, logging it first. Raises on failure."""
    print(f"\n--- {label} " + "-" * max(0, 60 - len(label)))
    print(shlex.join(str(c) for c in cmd))
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if result.returncode != 0:
        tail = "\n".join(result.stdout.splitlines()[-40:])
        raise RuntimeError(f"{label} failed (exit {result.returncode}):\n{tail}")
    return result.stdout


def ffprobe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    if out.returncode != 0 or not out.stdout.strip():
        raise RuntimeError(f"Could not read duration of {path}:\n{out.stdout}")
    return float(out.stdout.strip())


# ============================================================================
# Input validation
# ============================================================================

def validate_job(job_dir: Path):
    """Resolve and check every required input file/dir. Fails loudly by name."""
    required_files = {
        "voiceover": job_dir / "voiceover.mp3",
        "timestamps": job_dir / "timestamps.json",
        "script": job_dir / "script.json",
    }
    for name, path in required_files.items():
        if not path.is_file():
            raise FileNotFoundError(f"Missing required input '{path.name}' — expected at {path}")

    images_dir = job_dir / "images"
    if not images_dir.is_dir():
        raise FileNotFoundError(f"Missing required 'images/' folder at {images_dir}")
    images = sorted(images_dir.glob("*.png"), key=lambda p: p.name)
    if not images:
        raise FileNotFoundError(f"No .png stills found in {images_dir}")

    music = job_dir / "music.mp3"
    return {
        **required_files,
        "images_dir": images_dir,
        "images": images,
        "music": music if music.is_file() else None,
    }


def slugify(text):
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower()).strip("-")
    text = re.sub(r"-{2,}", "-", text)
    return text or "short"


def load_script(script_path: Path, images_dir: Path, voiceover_duration: float):
    """Load beats, filling in missing 'end' times, and resolve image paths."""
    data = json.loads(script_path.read_text())
    beats_raw = data.get("beats")
    if not beats_raw:
        raise ValueError(f"{script_path} has no 'beats' list")

    beats = []
    for i, b in enumerate(beats_raw):
        if "image" not in b or "start" not in b:
            raise ValueError(f"{script_path}: beat {i} is missing 'image' or 'start'")
        image_path = images_dir / b["image"]
        if not image_path.is_file():
            raise FileNotFoundError(f"{script_path}: beat {i} references missing image {image_path}")
        beats.append({"image": image_path, "start": float(b["start"]),
                       "end": float(b["end"]) if "end" in b else None})

    for i, beat in enumerate(beats):
        if beat["end"] is None:
            beat["end"] = beats[i + 1]["start"] if i + 1 < len(beats) else voiceover_duration
        if beat["end"] <= beat["start"]:
            raise ValueError(f"{script_path}: beat {i} has non-positive duration "
                              f"(start={beat['start']}, end={beat['end']})")

    slug = slugify(data.get("slug") or script_path.parent.name)
    return slug, beats


def load_word_timings(timestamps_path: Path):
    """Normalize the ElevenLabs timestamps payload to a flat [{word,start,end}] list."""
    data = json.loads(timestamps_path.read_text())

    if "words" in data:
        return [{"word": w["word"], "start": float(w["start"]), "end": float(w["end"])}
                for w in data["words"] if w["word"].strip()]

    alignment = data.get("alignment", data)
    chars = alignment.get("characters")
    starts = alignment.get("character_start_times_seconds")
    ends = alignment.get("character_end_times_seconds")
    if not (chars and starts and ends):
        raise ValueError(
            f"{timestamps_path}: unrecognized timestamps format — expected either a "
            "'words' list or an ElevenLabs 'alignment' block with "
            "characters/character_start_times_seconds/character_end_times_seconds"
        )

    words, cur, cur_start = [], "", None
    for ch, s, e in zip(chars, starts, ends):
        if ch.isspace():
            if cur:
                words.append({"word": cur, "start": cur_start, "end": prev_end})
                cur, cur_start = "", None
            continue
        if cur_start is None:
            cur_start = s
        cur += ch
        prev_end = e
    if cur:
        words.append({"word": cur, "start": cur_start, "end": prev_end})
    return words


CAPTION_MAX_TEXT_WIDTH = int((WIDTH * 0.9) - CAPTION_BOX_PAD_X * 2)


def group_captions(words, min_words=CAPTION_MIN_WORDS, max_words=CAPTION_MAX_WORDS):
    """Group words into 2-4 word caption lines, breaking early on sentence
    punctuation or if the line would overflow the frame width."""
    from PIL import Image, ImageDraw

    font = _load_caption_font()
    measure = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    groups, current = [], []

    def flush():
        if current:
            groups.append({
                "text": " ".join(w["word"] for w in current),
                "start": current[0]["start"],
                "end": current[-1]["end"],
            })

    for w in words:
        candidate = current + [w]
        text_w = measure.textbbox((0, 0), " ".join(c["word"] for c in candidate), font=font)[2]
        too_wide = text_w > CAPTION_MAX_TEXT_WIDTH
        if current and (too_wide or len(current) >= max_words):
            flush()
            current = []
        current.append(w)
        ends_sentence = w["word"][-1:] in ".!?" if w["word"] else False
        if len(current) >= min_words and ends_sentence:
            flush()
            current = []
    flush()

    if groups:
        groups[0]["start"] = 0.0  # first caption must be visible on frame 1
    return groups


# ============================================================================
# Stage: Ken Burns
# ============================================================================

EFFECTS = ["zoom_in", "zoom_out", "pan"]


def _zoompan_expr(effect, index, frames):
    """Return (zoom_expr, x_expr, y_expr) for a beat's zoompan filter."""
    center_x = "iw/2-(iw/zoom/2)"
    center_y = "ih/2-(ih/zoom/2)"
    if effect == "zoom_in":
        incr = (MAX_ZOOM - 1.0) / max(frames, 1)
        return f"min(zoom+{incr:.6f},{MAX_ZOOM})", center_x, center_y
    if effect == "zoom_out":
        decr = (MAX_ZOOM - 1.0) / max(frames, 1)
        return f"if(eq(on,0),{MAX_ZOOM},max(zoom-{decr:.6f},1.0))", center_x, center_y
    # lateral drift: fixed zoom, pan left<->right (direction alternates by index)
    last = max(frames - 1, 1)
    x_expr = f"(iw-iw/zoom)*(on/{last})"
    if index % 2 == 1:
        x_expr = f"(iw-iw/zoom)*(1-on/{last})"
    return f"{PAN_ZOOM}", x_expr, center_y


def build_kenburns_filtergraph(beats):
    """Build the ffmpeg input args + filter_complex for the Ken Burns stage.
    One input per beat, one zoompan branch per beat, concatenated in order."""
    input_args = []
    branches = []
    labels = []
    for i, beat in enumerate(beats):
        duration = beat["end"] - beat["start"]
        frames = max(round(duration * FPS), 1)
        effect = EFFECTS[i % len(EFFECTS)]
        z, x, y = _zoompan_expr(effect, i, frames)

        input_args += ["-loop", "1", "-i", str(beat["image"])]
        label = f"v{i}"
        labels.append(label)
        branches.append(
            f"[{i}:v]scale={CANVAS_W}:{CANVAS_H}:force_original_aspect_ratio=increase,"
            f"crop={CANVAS_W}:{CANVAS_H},"
            f"zoompan=z='{z}':x='{x}':y='{y}':d={frames}:s={WIDTH}x{HEIGHT}:fps={FPS},"
            f"trim=end_frame={frames},setpts=PTS-STARTPTS,setsar=1,format=yuv420p[{label}]"
        )

    concat_inputs = "".join(f"[{l}]" for l in labels)
    filter_complex = ";\n".join(branches) + f";\n{concat_inputs}concat=n={len(labels)}:v=1:a=0[outv]"
    return input_args, filter_complex


def render_kenburns(beats, out_path):
    input_args, filter_complex = build_kenburns_filtergraph(beats)
    print("\nKen Burns filtergraph:\n" + filter_complex)
    cmd = ["ffmpeg", "-y", *input_args,
           "-filter_complex", filter_complex,
           "-map", "[outv]", "-r", str(FPS),
           "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
           str(out_path)]
    run(cmd, "Ken Burns render")


# ============================================================================
# Stage: Captions
# ============================================================================

def _load_caption_font():
    from PIL import ImageFont
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    ]
    for path in candidates:
        if Path(path).is_file():
            return ImageFont.truetype(path, CAPTION_FONT_SIZE)
    return ImageFont.load_default()


def render_caption_images(captions, tmp_dir: Path):
    from PIL import Image, ImageDraw

    font = _load_caption_font()
    measure = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    paths = []
    for i, cap in enumerate(captions):
        bbox = measure.textbbox((0, 0), cap["text"], font=font)
        text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]

        box_w = text_w + CAPTION_BOX_PAD_X * 2
        box_h = text_h + CAPTION_BOX_PAD_Y * 2
        img = Image.new("RGBA", (box_w, box_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        draw.rounded_rectangle(
            [0, 0, box_w - 1, box_h - 1],
            radius=CAPTION_BOX_RADIUS, fill=(0, 0, 0, CAPTION_BOX_OPACITY),
        )
        draw.text((CAPTION_BOX_PAD_X - bbox[0], CAPTION_BOX_PAD_Y - bbox[1]),
                   cap["text"], font=font, fill=(255, 255, 255, 255))

        path = tmp_dir / f"caption_{i:03d}.png"
        img.save(path)
        paths.append({**cap, "path": path, "w": box_w, "h": box_h})
    return paths


def build_captions_filtergraph(caption_images):
    """Chain one overlay per caption line, each gated to its own time window."""
    input_args = []
    filters = []
    current = "[0:v]"
    for i, cap in enumerate(caption_images):
        input_args += ["-loop", "1", "-i", str(cap["path"])]
        x = (WIDTH - cap["w"]) // 2
        y = int(HEIGHT * CAPTION_Y_FRACTION - cap["h"] / 2)
        out_label = f"[c{i}]" if i < len(caption_images) - 1 else "[outv]"
        filters.append(
            f"{current}[{i + 1}:v]overlay={x}:{y}:enable='between(t,{cap['start']:.3f},{cap['end']:.3f})'{out_label}"
        )
        current = out_label
    filter_complex = ";\n".join(filters)
    return input_args, filter_complex


def render_captions(video_in: Path, caption_images, out_path: Path):
    if not caption_images:
        shutil.copyfile(video_in, out_path)
        return
    input_args, filter_complex = build_captions_filtergraph(caption_images)
    print("\nCaptions filtergraph:\n" + filter_complex)
    # The caption PNGs are looped (-loop 1) with no natural end, so without an
    # explicit duration the overlay chain would run forever. Bound it to the
    # base video's own length.
    duration = ffprobe_duration(video_in)
    cmd = ["ffmpeg", "-y", "-i", str(video_in), *input_args,
           "-filter_complex", filter_complex,
           "-map", "[outv]", "-t", f"{duration:.3f}",
           "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
           str(out_path)]
    run(cmd, "Caption overlay")


# ============================================================================
# Stage: Audio mix + final mux
# ============================================================================

def render_final(video_in: Path, voiceover: Path, music, target_duration: float, out_path: Path):
    inputs = ["-i", str(video_in), "-i", str(voiceover)]
    video_dur = ffprobe_duration(video_in)
    pad = max(target_duration - video_dur, 0.0)

    video_filter = f"[0:v]tpad=stop_mode=clone:stop_duration={pad:.3f}[vout]" if pad > 0 \
        else f"[0:v]trim=duration={target_duration:.3f},setpts=PTS-STARTPTS[vout]"

    if music:
        inputs += ["-i", str(music)]
        audio_filter = (
            f"[1:a]apad=whole_dur={target_duration:.3f}[voice];"
            f"[2:a]aloop=loop=-1:size=2000000000,atrim=duration={target_duration:.3f},"
            f"volume={MUSIC_DUCK_DB}dB,"
            f"afade=t=out:st={max(target_duration - MUSIC_FADE_OUT_S, 0):.3f}:d={MUSIC_FADE_OUT_S}[music];"
            f"[voice][music]amix=inputs=2:duration=first:normalize=0[aout]"
        )
    else:
        audio_filter = f"[1:a]apad=whole_dur={target_duration:.3f}[aout]"

    filter_complex = video_filter + ";\n" + audio_filter
    print("\nFinal mux filtergraph:\n" + filter_complex)
    cmd = ["ffmpeg", "-y", *inputs,
           "-filter_complex", filter_complex,
           "-map", "[vout]", "-map", "[aout]",
           "-t", f"{target_duration:.3f}",
           "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "192k",
           "-r", str(FPS),
           str(out_path)]
    run(cmd, "Final audio mix + mux")


# ============================================================================
# Drive upload
# ============================================================================

def upload_to_drive(path: Path):
    folder_id = os.environ.get("GDRIVE_FOLDER_ID")
    creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not folder_id or not creds_path:
        sys.exit("GDRIVE_UPLOAD=1 but GDRIVE_FOLDER_ID and/or GOOGLE_APPLICATION_CREDENTIALS is not set.")

    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload
    except ImportError:
        sys.exit("GDRIVE_UPLOAD=1 requires google-api-python-client and google-auth. "
                  "Install with: pip install google-api-python-client google-auth")

    creds = service_account.Credentials.from_service_account_file(
        creds_path, scopes=["https://www.googleapis.com/auth/drive.file"])
    service = build("drive", "v3", credentials=creds)
    media = MediaFileUpload(str(path), mimetype="video/mp4", resumable=True)
    file = service.files().create(
        body={"name": path.name, "parents": [folder_id]},
        media_body=media, fields="id,webViewLink",
    ).execute()
    print(f"Uploaded to Google Drive: {file.get('webViewLink', file.get('id'))}")


# ============================================================================
# Orchestration
# ============================================================================

def assemble(job_dir: Path, preview: bool, output: Path = None):
    check_ffmpeg()
    inputs = validate_job(job_dir)

    voice_duration = ffprobe_duration(inputs["voiceover"])
    slug, beats = load_script(inputs["script"], inputs["images_dir"], voice_duration)
    words = load_word_timings(inputs["timestamps"])
    captions = group_captions(words)

    target_duration = voice_duration + TAIL_SECONDS
    if preview:
        target_duration = min(target_duration, PREVIEW_SECONDS)
        beats = [b for b in beats if b["start"] < target_duration]
        for b in beats:
            b["end"] = min(b["end"], target_duration)
        captions = [c for c in captions if c["start"] < target_duration]
        for c in captions:
            c["end"] = min(c["end"], target_duration)

    out_path = output or job_dir / f"{slug}.mp4"

    with tempfile.TemporaryDirectory(prefix="assembler_") as tmp:
        tmp_dir = Path(tmp)
        kenburns_path = tmp_dir / "kenburns.mp4"
        captioned_path = tmp_dir / "captioned.mp4"

        render_kenburns(beats, kenburns_path)

        caption_images = render_caption_images(captions, tmp_dir)
        render_captions(kenburns_path, caption_images, captioned_path)

        render_final(captioned_path, inputs["voiceover"], inputs["music"], target_duration, out_path)

    final_duration = ffprobe_duration(out_path)
    print(f"\nDone: {out_path} ({final_duration:.2f}s)")

    if os.environ.get("GDRIVE_UPLOAD") == "1":
        upload_to_drive(out_path)

    return out_path, final_duration


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--job", required=True, help="Job folder containing voiceover.mp3, "
                                                   "timestamps.json, images/, script.json")
    ap.add_argument("--preview", action="store_true",
                    help="Render only the first 5 seconds, for fast iteration")
    ap.add_argument("--output", help="Override output path (default: <job>/<slug>.mp4)")
    args = ap.parse_args()

    job_dir = Path(args.job)
    if not job_dir.is_dir():
        sys.exit(f"Job folder not found: {job_dir}")

    output = Path(args.output) if args.output else None
    try:
        assemble(job_dir, args.preview, output)
    except (FileNotFoundError, ValueError, RuntimeError) as e:
        sys.exit(f"assembler.py: {e}")


if __name__ == "__main__":
    main()
