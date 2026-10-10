#!/usr/bin/env python3
"""
Rebuild the peaks a generated voiceover had flattened against full scale.

  python3 declip_vo.py vo.wav vo-declipped.wav

A read that arrives at nought point one dBFS has already lost something.
The synthesiser rendered a waveform that went past full scale and the file
format had nowhere to put it, so the tops of the loudest cycles came back
as a straight line at 1.0. Turning the whole file down afterwards does not
undo that -- it just gives you a quieter flat top. The distortion is in the
samples, and it has to be repaired there or not at all.

It is usually a handful of samples on a plosive, and on its own that is a
faint edge most people would not name. It matters because of what happens
next. The master pass runs a compressor and a limiter, and both of them
work on peaks: a flat top reads as a peak that arrived early and stayed,
so the limiter pulls down a whole syllable to control a click that is four
samples long. Repairing first means the limiter is responding to the
voice instead of to an artefact.

The repair is interpolation, not invention. Every run of samples pinned at
full scale is replaced by a cubic fitted to the samples either side, which
is free to arch above 1.0 -- that arch is the peak that was there before
the file clipped it. Nothing is guessed about the content; the curve is
determined entirely by how the waveform was travelling as it went in and
how it was travelling as it came out. Runs longer than a millisecond or so
are left alone and reported instead: past that the signal is genuinely
gone, and a cubic drawn across it is a fabrication rather than a repair.

The output can exceed full scale, which is intended. It is written as
32-bit float so the restored peaks survive to the master pass, where the
limiter is the thing that should be deciding the ceiling.
"""

import argparse
import subprocess

import numpy as np

THRESH = 0.999         # a sample this close to the rail did not get there alone
MAX_RUN_MS = 1.0       # longer than this and the waveform is not recoverable
MIN_RUN = 2            # a single sample at the rail is just a loud sample


def read_audio(path, sr):
    raw = subprocess.run(
        ['ffmpeg', '-nostdin', '-v', 'error', '-i', path,
         '-f', 'f32le', '-ac', '1', '-ar', str(sr), '-'],
        capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def write_audio(path, x, sr):
    subprocess.run(
        ['ffmpeg', '-nostdin', '-y', '-v', 'error',
         '-f', 'f32le', '-ac', '1', '-ar', str(sr), '-i', '-',
         '-c:a', 'pcm_f32le', path],
        input=x.astype(np.float32).tobytes(), check=True)


def clipped_runs(x, thresh=THRESH, min_run=MIN_RUN):
    """Start and end of every run of samples pinned at the rail."""
    flat = (np.abs(x) >= thresh).astype(np.int8)
    d = np.diff(np.concatenate(([0], flat, [0])))
    starts = np.nonzero(d == 1)[0]
    ends = np.nonzero(d == -1)[0]
    return [(s, e) for s, e in zip(starts, ends) if e - s >= min_run]


def _cubic(x, s, e, guard=2):
    """Replace x[s:e] with a cubic through the samples either side.

    Hermite, so the curve leaves the last good sample travelling the way
    the waveform was travelling and arrives at the next one the same way.
    The slopes come from the neighbouring samples rather than being
    assumed: a peak clipped on the way up and a peak clipped at its apex
    want different arches, and the only evidence for which is the gradient
    on each side."""
    a, b = s - 1, e              # last good sample, first good sample
    if a - guard < 0 or b + guard >= len(x):
        return False
    y0, y1 = x[a], x[b]
    m0 = (x[a] - x[a - guard]) / guard
    m1 = (x[b + guard] - x[b]) / guard
    n = b - a
    t = (np.arange(s, e) - a) / n
    h00 = 2 * t ** 3 - 3 * t ** 2 + 1
    h10 = t ** 3 - 2 * t ** 2 + t
    h01 = -2 * t ** 3 + 3 * t ** 2
    h11 = t ** 3 - t ** 2
    x[s:e] = h00 * y0 + h10 * (m0 * n) + h01 * y1 + h11 * (m1 * n)
    return True


def declip(x, sr, thresh=THRESH, max_run_ms=MAX_RUN_MS, min_run=MIN_RUN):
    x = x.copy()
    runs = clipped_runs(x, thresh, min_run)
    cap = max(min_run, int(sr * max_run_ms / 1000))
    fixed, skipped = [], []
    for s, e in runs:
        if e - s > cap or not _cubic(x, s, e):
            skipped.append((s, e))
        else:
            fixed.append((s, e))
    return x, fixed, skipped


def group(runs, sr, within=0.05):
    """Runs within 50ms of each other are one clipped syllable."""
    out = []
    for s, e in runs:
        if out and s - out[-1][1] < sr * within:
            out[-1] = (out[-1][0], e, out[-1][2] + (e - s))
        else:
            out.append((s, e, e - s))
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument('src')
    p.add_argument('out')
    p.add_argument('--rate', type=int, default=44100,
                   help='Work at the file\'s own rate; resampling before a '
                        'declip smears the flat tops into slopes and hides '
                        'the thing being looked for')
    p.add_argument('--threshold', type=float, default=THRESH)
    p.add_argument('--max-run-ms', type=float, default=MAX_RUN_MS)
    a = p.parse_args()

    x = read_audio(a.src, a.rate)
    y, fixed, skipped = declip(x, a.rate, a.threshold, a.max_run_ms)

    n = sum(e - s for s, e in fixed)
    print(f'{len(x) / a.rate:.2f}s, peak {np.abs(x).max():.4f}')
    if not fixed and not skipped:
        print('no clipped runs; nothing to repair')
    for s, e, c in group(fixed, a.rate):
        print(f'  {s / a.rate:7.3f}s  {c:3d} samples rebuilt over '
              f'{(e - s) / a.rate * 1000:5.2f}ms')
    for s, e, c in group(skipped, a.rate):
        print(f'  {s / a.rate:7.3f}s  {c:3d} samples LEFT ALONE '
              f'({(e - s) / a.rate * 1000:.2f}ms is too long to rebuild)')
    print(f'{len(fixed)} run(s) rebuilt, {n} sample(s); '
          f'{len(skipped)} left alone')
    print(f'peak now {np.abs(y).max():.4f} '
          f'({20 * np.log10(max(np.abs(y).max(), 1e-9)):+.2f} dBFS) '
          f'-- over full scale on purpose, for the limiter to take down')
    write_audio(a.out, y, a.rate)
    print(f'-> {a.out}')


if __name__ == '__main__':
    main()
