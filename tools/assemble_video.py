#!/usr/bin/env python3
"""
assemble_video.py — assemble a script (from generate_script.py) + a folder of
shot images + an optional voiceover track into a final vertical Short (MP4),
with Ken-Burns motion and burned-in on-screen captions synced to each beat.

Needs ffmpeg on your PATH (https://ffmpeg.org/download.html). No Python video
libraries required — this shells out to ffmpeg directly.

Images: put one image per beat in --images-dir, named shot_01.*, shot_02.*,
... (any common extension: png/jpg/jpeg/webp). Missing shots are filled with
a plain color placeholder (from the niche's palette) so you can preview
timing and captions before your real art is ready.

Voiceover: pass a single narration track with --voiceover (wav/mp3/m4a). If
it doesn't match the script's computed duration, pass --stretch-to-audio to
rescale every beat's on-screen duration proportionally to the real audio
length (recommended once you have final VO). Without --voiceover, a silent
track is generated for the script's computed duration.

Music: --music adds a background bed, ducked under the voiceover.

Usage:
    python tools/assemble_video.py --script tools/output/script_foo.json \\
        --images-dir ./shots --voiceover ./vo.mp3 --stretch-to-audio \\
        --out tools/output/short_foo.mp4

    # Preview timing/captions with placeholder art and no audio work yet:
    python tools/assemble_video.py --script tools/output/script_foo.json --dry-run
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import textwrap

HERE = os.path.dirname(os.path.abspath(__file__))
IMG_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".bmp")
PLACEHOLDER_COLORS = ["#1a1a2e", "#16213e", "#0f3460", "#222831", "#0b0e1a", "#0a1024"]


def load_niche(niche_file="niche.json"):
    path = niche_file if os.path.isabs(niche_file) else os.path.join(HERE, niche_file)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_script(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def check_ffmpeg():
    for exe in ("ffmpeg", "ffprobe"):
        if not shutil.which(exe):
            sys.exit(
                f"'{exe}' not found on PATH. Install ffmpeg first:\n"
                "  macOS:   brew install ffmpeg\n"
                "  Ubuntu:  sudo apt install ffmpeg\n"
                "  Windows: https://ffmpeg.org/download.html\n"
            )


def ffprobe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def find_shot_image(images_dir, index):
    if not images_dir:
        return None
    for ext in IMG_EXTS:
        for pattern in (f"shot_{index:02d}{ext}", f"shot_{index}{ext}", f"{index:02d}{ext}"):
            candidate = os.path.join(images_dir, pattern)
            if os.path.exists(candidate):
                return candidate
    return None


def wrap_caption(text, width=22):
    return "\n".join(textwrap.wrap(text, width=width)) if text else ""


def write_caption_file(text, path):
    with open(path, "w", encoding="utf-8") as f:
        f.write(wrap_caption(text))


def stretch_durations(beats, target_total):
    current_total = sum(b["duration"] for b in beats)
    if current_total <= 0:
        return
    ratio = target_total / current_total
    for b in beats:
        b["duration"] = round(b["duration"] * ratio, 3)


def build_filter_complex(beats, images, caption_files, width, height, fps, caption_style, font):
    """One [-loop 1/-f lavfi] input per beat; each gets scale+zoompan (Ken Burns)
    then a drawtext caption; concat all beat clips into a single [vout]."""
    v_labels = []
    filters = []
    for i, (beat, img) in enumerate(zip(beats, images)):
        dur = beat["duration"]
        frames = max(1, int(round(dur * fps)))
        zoom_step = 0.0012
        zoompan = (
            f"zoompan=z='min(zoom+{zoom_step},1.15)':d={frames}:"
            f"s={width}x{height}:fps={fps}"
        )
        if img["is_placeholder"]:
            base = f"[{i}:v]{zoompan},setsar=1[bg{i}]"
        else:
            base = f"[{i}:v]scale={width * 2}:-2,{zoompan},setsar=1[bg{i}]"
        filters.append(base)

        caption_file = caption_files[i]
        label = f"v{i}"
        if caption_file:
            fontfile_clause = f"fontfile='{font}':" if font else ""
            drawtext = (
                f"[bg{i}]drawtext=textfile='{caption_file}':{fontfile_clause}"
                f"fontcolor={caption_style.get('fontcolor', 'white')}:"
                f"fontsize={max(48, width // 16)}:"
                f"box=1:boxcolor={caption_style.get('boxcolor', 'black@0.55')}:"
                f"boxborderw=24:line_spacing=12:"
                f"x=(w-text_w)/2:y=h*0.72:"
                f"text_align=center[{label}]"
            )
            filters.append(drawtext)
        else:
            filters.append(f"[bg{i}]null[{label}]")
        v_labels.append(f"[{label}]")

    concat = f"{''.join(v_labels)}concat=n={len(beats)}:v=1:a=0[vout]"
    filters.append(concat)
    return ";".join(filters)


def build_command(script, niche, images_dir, voiceover, music, out_path,
                   width, height, fps, font, dry_run, stretch_to_audio):
    beats = script.get("beats", [])
    if not beats:
        sys.exit("Script has no beats.")

    if voiceover and stretch_to_audio:
        stretch_durations(beats, ffprobe_duration(voiceover))

    style = niche.get("visual_style", {})
    caption_style = style.get("caption_style", {})
    palette = style.get("palette") or PLACEHOLDER_COLORS

    tmpdir = tempfile.mkdtemp(prefix="assemble_video_")
    images = []
    caption_files = []
    cmd = ["ffmpeg", "-y"]

    for i, beat in enumerate(beats):
        img_path = find_shot_image(images_dir, i + 1)
        if img_path:
            cmd += ["-loop", "1", "-t", str(beat["duration"]), "-i", img_path]
            images.append({"path": img_path, "is_placeholder": False})
        else:
            color = palette[i % len(palette)].lstrip("#")
            cmd += ["-f", "lavfi", "-t", str(beat["duration"]),
                    "-i", f"color=c=0x{color}:s={width}x{height}:rate={fps}"]
            images.append({"path": None, "is_placeholder": True})

        on_screen = beat.get("on_screen") or beat.get("vo", "")
        if on_screen:
            cap_path = os.path.join(tmpdir, f"caption_{i:02d}.txt")
            write_caption_file(on_screen, cap_path)
            caption_files.append(cap_path)
        else:
            caption_files.append(None)

    filter_complex = build_filter_complex(beats, images, caption_files, width, height, fps,
                                          caption_style, font)

    total_duration = sum(b["duration"] for b in beats)
    audio_input_index = len(beats)
    if voiceover and music:
        cmd += ["-i", voiceover, "-i", music]
        filter_complex += (
            f";[{audio_input_index}:a]volume=1.0[voa]"
            f";[{audio_input_index + 1}:a]volume=0.15[mus]"
            f";[voa][mus]amix=inputs=2:duration=first:dropout_transition=2[aout]"
        )
        audio_map = "[aout]"
    elif voiceover:
        cmd += ["-i", voiceover]
        audio_map = f"{audio_input_index}:a"
    else:
        cmd += ["-f", "lavfi", "-t", str(total_duration), "-i", "anullsrc=r=44100:cl=stereo"]
        audio_map = f"{audio_input_index}:a"

    cmd += [
        "-filter_complex", filter_complex,
        "-map", "[vout]", "-map", audio_map,
        "-t", str(total_duration),
        "-r", str(fps),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        out_path,
    ]

    return cmd, tmpdir


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--script", required=True, help="Path to a script JSON from generate_script.py")
    ap.add_argument("--niche-file", default="niche.json",
                     help="Path to a niche config (default: tools/niche.json)")
    ap.add_argument("--images-dir", default="", help="Folder with shot_01.*, shot_02.*, ... "
                     "(missing shots use a placeholder color card)")
    ap.add_argument("--voiceover", default="", help="Narration audio file (wav/mp3/m4a)")
    ap.add_argument("--music", default="", help="Background music, ducked under the voiceover")
    ap.add_argument("--stretch-to-audio", action="store_true",
                     help="Rescale beat durations to match the real --voiceover length")
    ap.add_argument("--out", default="", help="Output MP4 path (default: alongside the script)")
    ap.add_argument("--width", type=int, default=1080)
    ap.add_argument("--height", type=int, default=1920)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--font", default="", help="Path to a .ttf/.otf for captions (default: ffmpeg's built-in)")
    ap.add_argument("--dry-run", action="store_true", help="Print the ffmpeg command instead of running it")
    args = ap.parse_args()

    if not os.path.exists(args.script):
        sys.exit(f"Script not found: {args.script}")
    if args.voiceover and not os.path.exists(args.voiceover):
        sys.exit(f"Voiceover not found: {args.voiceover}")
    if args.music and not os.path.exists(args.music):
        sys.exit(f"Music not found: {args.music}")

    if not args.dry_run:
        check_ffmpeg()

    niche = load_niche(args.niche_file)
    script = load_script(args.script)
    out_path = args.out or os.path.splitext(args.script)[0].replace("script_", "short_") + ".mp4"
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)

    cmd, tmpdir = build_command(
        script, niche, args.images_dir, args.voiceover, args.music, out_path,
        args.width, args.height, args.fps, args.font, args.dry_run, args.stretch_to_audio,
    )

    print(f"\n  Assembling: {script.get('title', script.get('hook', ''))}")
    print(f"  Beats: {len(script.get('beats', []))}  ·  "
          f"Total: ~{sum(b['duration'] for b in script['beats']):.1f}s  ·  "
          f"{args.width}x{args.height}@{args.fps}")
    if not args.images_dir:
        print("  No --images-dir given — using placeholder color cards for every shot.")

    if args.dry_run:
        print("\n  --dry-run: ffmpeg command that would run "
              f"(caption text files kept at {tmpdir} so this is copy-pasteable):\n")
        print("  " + " ".join(f"'{c}'" if " " in c else c for c in cmd) + "\n")
        return

    try:
        subprocess.run(cmd, check=True)
        print(f"\n  Saved -> {out_path}\n")
    except subprocess.CalledProcessError as e:
        sys.exit(f"\n  ffmpeg failed (exit {e.returncode}). Re-run with --dry-run to inspect the command.\n")
    finally:
        if tmpdir:
            shutil.rmtree(tmpdir, ignore_errors=True)


if __name__ == "__main__":
    main()
