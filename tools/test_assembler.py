#!/usr/bin/env python3
"""
test_assembler.py — acceptance test for assembler.py (Stage 6).

Generates a throwaway job folder with 3 solid-color stills and a 5s silent
voiceover, runs the module in --preview mode, and checks the output is a
1080x1920 mp4 with both an audio and a video stream.

Usage:
    python tools/test_assembler.py
"""

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import assembler  # noqa: E402

TOOLS_DIR = Path(__file__).parent


def build_job(job_dir: Path):
    from PIL import Image

    images_dir = job_dir / "images"
    images_dir.mkdir(parents=True)
    colors = [(200, 40, 40), (40, 160, 60), (40, 60, 200)]
    for i, color in enumerate(colors, start=1):
        Image.new("RGB", (1200, 1600), color).save(images_dir / f"{i:02d}.png")

    voiceover = job_dir / "voiceover.mp3"
    subprocess.run(
        ["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
         "-t", "5", "-q:a", "9", str(voiceover)],
        check=True, capture_output=True,
    )

    script = {
        "slug": "test-short",
        "beats": [
            {"image": "01.png", "start": 0.0, "end": 1.8},
            {"image": "02.png", "start": 1.8, "end": 3.4},
            {"image": "03.png", "start": 3.4, "end": 5.0},
        ],
    }
    (job_dir / "script.json").write_text(json.dumps(script))

    timestamps = {
        "words": [
            {"word": "grocery", "start": 0.0, "end": 0.4},
            {"word": "stores", "start": 0.4, "end": 0.8},
            {"word": "are", "start": 0.8, "end": 1.0},
            {"word": "designed", "start": 1.0, "end": 1.6},
            {"word": "to", "start": 1.6, "end": 1.8},
            {"word": "rob", "start": 1.8, "end": 2.2},
            {"word": "you.", "start": 2.2, "end": 2.6},
            {"word": "Here's", "start": 3.4, "end": 3.7},
            {"word": "how.", "start": 3.7, "end": 4.1},
        ]
    }
    (job_dir / "timestamps.json").write_text(json.dumps(timestamps))


def ffprobe_streams(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height",
         "-of", "json", str(path)],
        stdout=subprocess.PIPE, text=True, check=True,
    )
    return json.loads(out.stdout)["streams"]


def main():
    with tempfile.TemporaryDirectory(prefix="assembler_test_") as tmp:
        job_dir = Path(tmp) / "job"
        build_job(job_dir)

        out_path, duration = assembler.assemble(job_dir, preview=True)

        assert out_path.is_file(), f"Output file not created: {out_path}"

        streams = ffprobe_streams(out_path)
        video = [s for s in streams if s["codec_type"] == "video"]
        audio = [s for s in streams if s["codec_type"] == "audio"]
        assert video, "No video stream in output"
        assert audio, "No audio stream in output"
        assert video[0]["width"] == assembler.WIDTH, video[0]["width"]
        assert video[0]["height"] == assembler.HEIGHT, video[0]["height"]

        print(f"\nPASS: {out_path.name} — {video[0]['width']}x{video[0]['height']}, "
              f"{duration:.2f}s, video+audio streams present")


if __name__ == "__main__":
    main()
