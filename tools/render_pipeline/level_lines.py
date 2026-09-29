#!/usr/bin/env python3
"""
Even out a voiceover whose lines were rendered at different levels.

  python3 level_lines.py --audio vo.wav --beats beats.srt --out even.wav

A TTS pipeline that renders a script line by line can hand back chunks that
differ in level by a lot. One 44s read arrived with its lines in two clear
groups 8 dB apart -- sixteen at about -25 dBFS, seven at about -17 -- with
nothing in between. That is not a performance; it is a splice.

It sounds like the volume lurching between sentences, and it quietly wrecks
mastering: the loud group is already near full scale while the quiet group
is 8 dB down, so any gain that fixes the average has to flatten the peaks,
and the read loses the dynamics it did have.

Correcting it per line is the cheap fix, and it is NOT compression. Each
line keeps its own internal shape exactly -- one constant gain is applied
across the whole line -- and only the line-to-line offsets move. The gain
is interpolated through the pauses, so nothing steps.

Match this against what the ear does: a consistent 8 dB offset between
chunks is an error to remove, while a speaker leaning into one word is not.
Only spans given in the beats file are levelled, so the unit is always a
line, never a syllable.
"""

import argparse
import os
import re
import subprocess
import sys

import numpy as np

CUE = re.compile(r"(\d+:\d+:[\d,.]+)\s*-->\s*(\d+:\d+:[\d,.]+)")


def secs(stamp):
    h, m, s = stamp.replace(",", ".").split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def read_spans(path):
    out = []
    for line in open(path, encoding="utf-8"):
        m = CUE.search(line)
        if m:
            out.append((secs(m.group(1)), secs(m.group(2))))
    return out


def read_audio(path):
    sr = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
         "stream=sample_rate", "-of", "csv=p=0", path],
        capture_output=True, text=True).stdout.strip()
    sr = int(sr) if sr.isdigit() else 44100
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-f", "s16le", "-ac", "1",
         "-ar", str(sr), "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0, sr


def main():
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--audio", required=True)
    p.add_argument("--beats", required=True, help="SRT giving one cue per line")
    p.add_argument("--out", required=True)
    p.add_argument("--max-gain", type=float, default=10.0, metavar="dB",
                   help="Most any one line may be moved (default 10). A line "
                        "needing more than this is likelier a detection error "
                        "than a level error, so it is clamped and reported.")
    p.add_argument("--target", type=float, default=None, metavar="dBFS",
                   help="Level to bring lines to (default: the median line, "
                        "which leaves the overall level about where it was)")
    args = p.parse_args()

    for f in (args.audio, args.beats):
        if not os.path.isfile(f):
            sys.exit(f"Not found: {f}")

    x, sr = read_audio(args.audio)
    spans = read_spans(args.beats)
    if not spans:
        sys.exit(f"No cues found in {args.beats}")

    lines = []
    for a, b in spans:
        i, j = int(a * sr), min(int(b * sr), len(x))
        if j - i < sr // 100:
            continue
        rms = float(np.sqrt((x[i:j] ** 2).mean()))
        lines.append((i, j, 20 * np.log10(rms + 1e-12)))
    if not lines:
        sys.exit("Every cue was too short to measure.")

    levels = [lv for _i, _j, lv in lines]
    target = args.target if args.target is not None else float(np.median(levels))

    gains, clamped = [], 0
    for _i, _j, lv in lines:
        g = target - lv
        if abs(g) > args.max_gain:
            g = args.max_gain * (1 if g > 0 else -1)
            clamped += 1
        gains.append(g)

    # A gain envelope: flat across each line, interpolated through the gaps
    # in dB so a change always happens during silence and never mid-word.
    env_db = np.empty(len(x))
    env_db[:lines[0][0]] = gains[0]
    for k, ((i, j, _lv), g) in enumerate(zip(lines, gains)):
        env_db[i:j] = g
        if k + 1 < len(lines):
            nxt_i = lines[k + 1][0]
            if nxt_i > j:
                env_db[j:nxt_i] = np.linspace(g, gains[k + 1], nxt_i - j)
    env_db[lines[-1][1]:] = gains[-1]

    y = x * (10 ** (env_db / 20.0))
    peak = np.abs(y).max()
    if peak > 0.99:                      # keep headroom; mastering comes later
        y *= 0.99 / peak

    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "f64le", "-ar", str(sr),
         "-ac", "1", "-i", "pipe:0", "-c:a", "pcm_s16le", args.out],
        input=y.tobytes(), check=True)

    print(f"{len(lines)} lines, level spread {max(levels)-min(levels):.1f} dB "
          f"-> target {target:.1f} dBFS")
    print(f"  gains applied: {min(gains):+.1f} to {max(gains):+.1f} dB")
    after = [20 * np.log10(np.sqrt((y[i:j] ** 2).mean()) + 1e-12)
             for i, j, _lv in lines]
    print(f"  spread now {max(after)-min(after):.1f} dB -> {args.out}")
    if clamped:
        print(f"  {clamped} line(s) hit the {args.max_gain} dB clamp -- check "
              f"those cues line up with the audio")


if __name__ == "__main__":
    main()
