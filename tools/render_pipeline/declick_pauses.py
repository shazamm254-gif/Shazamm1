#!/usr/bin/env python3
"""
Remove the clicks a chunk-assembled voiceover has at every pause.

  python3 declick_pauses.py --audio vo.wav --out clean.wav

A TTS pipeline that renders a script line by line and joins the pieces with
inserted silence will, unless it is careful, cut each piece wherever the
buffer happened to end. If that sample is not near zero the waveform steps
straight from it to digital silence, and a step is a click. Measured on one
44s read: thirteen pauses, a discontinuity at both ends of every one, the
worst -17.6 dBFS.

Quiet enough to miss on a phone speaker in the raw file. Not quiet enough to
survive being gained up: normalising a -22 LUFS read to broadcast level
multiplies those steps by four or five and they become the glitch everybody
can hear. Fix them before any gain is applied.

The repair is a short raised-cosine fade into and out of each silence. The
silence really is digital zero, so fading toward it invents nothing; the
only cost is a few milliseconds off the tail of a word, well under the ~20ms
where the ear starts to notice a truncation.

Prints what it found, so a file with no clicks is reported as such rather
than being quietly rewritten.
"""

import argparse
import os
import subprocess
import sys

import numpy as np


def read_audio(path):
    """Mono float32 plus the sample rate, decoded through ffmpeg."""
    sr = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0",
         "-show_entries", "stream=sample_rate", "-of", "csv=p=0", path],
        capture_output=True, text=True).stdout.strip()
    sr = int(sr) if sr.isdigit() else 44100
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-f", "s16le", "-ac", "1",
         "-ar", str(sr), "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0, sr


def silence_runs(x, min_len):
    """Runs of exact digital zero at least `min_len` samples long."""
    z = (x == 0.0).astype(np.int8)
    d = np.diff(np.concatenate(([0], z, [0])))
    return [(s, e) for s, e in zip(np.where(d == 1)[0], np.where(d == -1)[0])
            if e - s >= min_len]


def declick(x, sr, min_pause=0.05, fade=0.005):
    """Fade into and out of every inserted silence. Returns (audio, report)."""
    n_fade = max(int(sr * fade), 2)
    ramp = 0.5 * (1 - np.cos(np.linspace(0, np.pi, n_fade)))   # raised cosine

    y = x.copy()
    report = []
    for s, e in silence_runs(x, int(sr * min_pause)):
        before = abs(x[s - 1]) if s > 0 else 0.0
        after = abs(x[e]) if e < len(x) else 0.0
        report.append((s / sr, (e - s) / sr, max(before, after)))

        a = max(s - n_fade, 0)                 # ramp down into the silence
        if s - a > 1:
            y[a:s] *= ramp[-(s - a):][::-1]
        b = min(e + n_fade, len(y))            # ramp up out of it
        if b - e > 1:
            y[e:b] *= ramp[:b - e]
    return y, report


def write_wav(y, sr, path):
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(sr),
         "-ac", "1", "-i", "pipe:0", "-c:a", "pcm_s16le", path],
        input=y.astype(np.float32).tobytes(), check=True)


def truncation_report(x, sr, min_pause):
    """
    Utterances that stop while still loud, i.e. cut before the word ended.

    This is a different defect from a click and a far worse one. A click is
    a step at a boundary and a fade removes it. A truncation is missing
    audio: the renderer ended the chunk part-way through the final
    phoneme, and nothing downstream can put the syllable back. It sounds
    like the speaker stumbling at the end of nearly every line, and it
    survives every repair in this file -- so it is reported loudly rather
    than silently half-fixed.

    A word that finishes decays to near nothing over its last 50-100ms.
    One still within 6 dB of its own recent peak 5ms before the silence
    did not finish.
    """
    out = []
    for s, e in silence_runs(x, int(sr * min_pause)):
        def lvl(ms_from, ms_to):
            i = max(s - int(sr * ms_from / 1000), 0)
            j = max(s - int(sr * ms_to / 1000), i + 1)
            seg = x[i:j]
            return float(np.abs(seg).max()) if seg.size else 0.0
        far = lvl(80, 75)
        near = lvl(5, 0)
        if near > 1e-4 and far > 1e-6:
            ratio_db = 20 * np.log10(near / far)
            if ratio_db > -6 and 20 * np.log10(near) > -40:
                out.append((s / sr, 20 * np.log10(near)))
    return out


def main():
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--audio", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--min-pause", type=float, default=0.05,
                   help="Shortest silence treated as an inserted pause "
                        "(seconds, default 0.05)")
    p.add_argument("--fade", type=float, default=0.005,
                   help="Fade length at each edge (seconds, default 0.005). "
                        "Raise it only if clicks survive; past ~0.02 the "
                        "truncation starts to be audible.")
    p.add_argument("--threshold", type=float, default=-45.0, metavar="dBFS",
                   help="Steps quieter than this are not reported as clicks")
    args = p.parse_args()

    if not os.path.isfile(args.audio):
        sys.exit(f"Not found: {args.audio}")

    x, sr = read_audio(args.audio)
    if x.size == 0:
        sys.exit(f"No audio decoded from {args.audio}")
    y, report = declick(x, sr, args.min_pause, args.fade)

    loud = [r for r in report if r[2] > 10 ** (args.threshold / 20)]
    print(f"{len(report)} inserted pause(s); {len(loud)} with an audible step")
    for at, length, step in sorted(loud, key=lambda r: -r[2])[:10]:
        print(f"  {at:6.2f}s  pause {length*1000:4.0f}ms  "
              f"step {20*np.log10(step):6.1f} dBFS")
    if not loud:
        print("  Nothing above the threshold -- this file did not need fixing.")

    cut = truncation_report(x, sr, args.min_pause)
    if cut:
        print(f"\n  WARNING: {len(cut)} of {len(report)} utterance(s) end while "
              f"still loud -- cut before the word finished.")
        for at, lv in sorted(cut, key=lambda c: -c[1])[:6]:
            print(f"    {at:6.2f}s  still at {lv:5.1f} dBFS when the audio stops")
        print("  This is MISSING AUDIO, not a click, and nothing here can "
              "restore it.\n  The renderer must stop trimming each chunk "
              "before the word has decayed.\n")

    write_wav(y, sr, args.out)
    worst = max((r[2] for r in silence_report(y, sr, args.min_pause)), default=0.0)
    print(f"-> {args.out}  (worst remaining step "
          f"{20*np.log10(worst) if worst else -99:.1f} dBFS)")


def silence_report(x, sr, min_pause):
    for s, e in silence_runs(x, int(sr * min_pause)):
        before = abs(x[s - 1]) if s > 0 else 0.0
        after = abs(x[e]) if e < len(x) else 0.0
        yield (s / sr, (e - s) / sr, max(before, after))


if __name__ == "__main__":
    main()
