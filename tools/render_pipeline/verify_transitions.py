#!/usr/bin/env python3
"""
Check a transition pass against the read, the library and the clock.

  python3 verify_transitions.py --before v.mp4 --after v-t.mp4 \
      --plan plan.json --words words.json

Five checks.

Placement: every transition sits on a pause of at least six tenths of a
second in the voiceover. This is re-derived from the word list rather than
read out of the plan, so a hand-edited plan that moved a transition
somewhere prettier gets caught.

Count: no more transitions than there are act breaks, and never two on
consecutive cuts.

Runtime: the output is the same length as the input. Not within half a
second -- the same. The picture is locked to the narration, so a
transition that cost frames would walk every later shot out of sync.

Frame blending, measured rather than taken on trust. A wipe takes every
output pixel from exactly one of the two shots; a dissolve takes a bit of
both, which is what makes generated footage fall apart. So for each wipe
between two generated clips, every pixel of every frame in the window is
compared against the held outgoing frame and against the incoming frame,
and has to match one of them. A dissolve fails this on most of the frame.

Library: nothing outside the five, and no cross-dissolve anywhere.
"""

import argparse
import json
import subprocess
import sys

import numpy as np

from transitions import (AI_SAFE, LIBRARY, MIN_GAP, TOLERANCE, act_breaks,
                         count_frames, probe)

MATCH_TOL = 24          # levels of re-encode noise to forgive per channel
MATCH_MIN = 0.98        # fraction of pixels that must come from one source
RUNTIME_BUDGET = 0.5    # the spec's ceiling; the design target is 0.0


PAD = 3                 # frames either side of a window, to prove alignment


def frames_at(video, n0, count, w, h, fps):
    """`count` frames starting at frame `n0`.

    Seeks to the middle of the frame period rather than its edge: landing
    exactly on a boundary is where a half-frame of timestamp rounding
    decides which frame you get, and this check is worthless if the two
    files are compared one frame apart.

    One call per window, never one per frame. Two short seeks into the same
    file do not reliably land the same distance from their keyframe, and a
    comparison that is one frame out reads as heavy blending -- which is
    exactly the thing being looked for, so it would be believed."""
    px = w * h * 3
    out = subprocess.run(
        ['ffmpeg', '-nostdin', '-v', 'error', '-ss', f'{(n0 + 0.5) / fps:.6f}',
         '-i', video, '-frames:v', str(count),
         '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
        capture_output=True, check=True).stdout
    n = len(out) // px
    return np.frombuffer(out[:n * px], np.uint8).reshape(n, h, w, 3)


def from_one_source(got, a, b, tol=MATCH_TOL):
    """Fraction of pixels in `got` that came from `a` or from `b`, whole."""
    da = np.abs(got.astype(np.int16) - a.astype(np.int16)).max(axis=2)
    db = np.abs(got.astype(np.int16) - b.astype(np.int16)).max(axis=2)
    return float((np.minimum(da, db) <= tol).mean())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--before', required=True)
    ap.add_argument('--after', required=True)
    ap.add_argument('--plan', required=True)
    ap.add_argument('--words', required=True)
    ap.add_argument('--min-gap', type=float, default=MIN_GAP)
    ap.add_argument('--tolerance', type=float, default=TOLERANCE)
    a = ap.parse_args()

    pl = json.load(open(a.plan))
    words = json.load(open(a.words))['words']
    breaks = act_breaks(words, a.min_gap)
    live = [c for c in pl['transitions'] if c['type'] != 'hard-cut']
    fails = []

    w0, h0, fps, d0 = probe(a.before)
    w1, h1, fps1, d1 = probe(a.after)

    # 1. placement
    worst = 0.0
    for c in live:
        off = min(abs(c['time'] - b['mid']) for b in breaks) if breaks else 1e9
        worst = max(worst, off)
        if off > a.tolerance:
            fails.append(f"{c['type']} at {c['time']:.2f}s is {off:.2f}s from "
                         f"the nearest pause of {a.min_gap}s or more")
    print(f'placement: {len(live)} transition(s), worst {worst:.2f}s from a '
          f'long-pause beat [tolerance {a.tolerance:.1f}s]')

    # 2. count, and no two in a row
    print(f'count:     {len(live)} transition(s) over {len(breaks)} act '
          f'break(s)')
    if len(live) > len(breaks):
        fails.append(f'{len(live)} transitions for {len(breaks)} act breaks')
    cuts = sorted(c['cut'] for c in live)
    for x, y in zip(cuts, cuts[1:]):
        if y - x == 1:
            fails.append(f'transitions on consecutive cuts {x} and {y}')

    # 3. library
    kinds = sorted({c['type'] for c in live})
    print(f"library:   {', '.join(kinds) or 'none'}")
    for c in live:
        if c['type'] not in LIBRARY:
            fails.append(f"{c['type']!r} is not in the library")
        if c['between'] == ['clip', 'clip'] and c['type'] not in AI_SAFE:
            fails.append(f"cut {c['cut']} joins two generated clips with "
                         f"{c['type']!r}; only {AI_SAFE} allowed there")

    # 4. runtime
    n0, n1 = count_frames(a.before), count_frames(a.after)
    print(f'runtime:   {d0:.3f}s -> {d1:.3f}s ({d1 - d0:+.3f}s), '
          f'{n0} -> {n1} frames [budget {RUNTIME_BUDGET:.1f}s]')
    if abs(d1 - d0) > RUNTIME_BUDGET:
        fails.append(f'runtime moved {d1 - d0:+.3f}s')
    if n0 != n1:
        fails.append(f'frame count moved {n0} -> {n1}')
    if (w0, h0) != (w1, h1):
        fails.append(f'frame size changed {w0}x{h0} -> {w1}x{h1}')

    # 5. no frame blending where it is banned
    checked = 0
    for c in live:
        if c['between'] != ['clip', 'clip']:
            continue
        n = int(round(c['time'] * fps))
        k = 8
        n0 = n - PAD
        src = frames_at(a.before, n0, k + 2 * PAD, w0, h0, fps)
        got = frames_at(a.after, n0, k + 2 * PAD, w0, h0, fps)
        m = min(len(src), len(got))
        if m <= PAD:
            fails.append(f"could not read frames at {c['time']:.2f}s")
            continue
        # The frames before the cut are untouched, so they are the proof
        # that the two decodes are on the same frame.
        lead = min(from_one_source(got[i], src[i], src[i]) for i in range(PAD))
        if lead < MATCH_MIN:
            fails.append(f"frames before {c['time']:.2f}s differ by "
                         f"{(1 - lead) * 100:.1f}% -- the two decodes are "
                         f"not aligned, so the blend check means nothing")
            continue
        held = src[PAD - 1]
        worst_f, worst_i = 1.0, 0
        for i in range(PAD, m):
            f = from_one_source(got[i], held, src[i])
            if f < worst_f:
                worst_f, worst_i = f, i - PAD
        checked += 1
        print(f"blend:     {c['type']} at {c['time']:.2f}s "
              f"(clip/clip) -- worst frame {worst_f * 100:.1f}% of pixels "
              f"from one source alone [floor {MATCH_MIN * 100:.0f}%]")
        if worst_f < MATCH_MIN:
            fails.append(f"frame {n + worst_i} at {c['time']:.2f}s is "
                         f"{(1 - worst_f) * 100:.1f}% mixed pixels -- that is "
                         f"frame blending between generated clips")
    if not checked:
        print('blend:     no clip-to-clip transitions in this edit')

    print()
    for f in fails:
        print(f'FAIL  {f}')
    print('PASS' if not fails else f'{len(fails)} failures')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
