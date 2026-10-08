#!/usr/bin/env python3
"""
Repair dead-air splices in a generated voiceover.

A TTS read assembled from separately rendered segments is often butted
together with blocks of absolute digital zero between them. The defect
this causes is not a click. It is the room tone vanishing: the noise
floor sits at -40 dB or so through the whole take, drops to nothing for
a third of a second, then comes back. On headphones that reads as the
audio cutting out, which is what "glitching" usually turns out to mean.

Fading into and out of the gap does not help, because the gap itself is
the problem. The fix is to put tone back. A clean stretch of the take's
own room tone is found, scaled to match the level either side of each
hole, and crossfaded in -- so the floor is continuous and the splice
stops announcing itself.

Donor tone is taken from the file being repaired rather than
synthesised, so its spectrum matches: a generated voice's floor is
rarely white, and white noise at the right level still sounds wrong.
"""

import argparse
import wave

import numpy as np


def read_wav(path):
    with wave.open(path) as w:
        assert w.getsampwidth() == 2 and w.getnchannels() == 1, 'want 16-bit mono'
        sr = w.getframerate()
        xi = np.frombuffer(w.readframes(w.getnframes()), '<i2')
    return xi.astype(np.float64) / 32768.0, sr


def write_wav(path, x, sr):
    xi = np.clip(np.rint(x * 32768.0), -32768, 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(xi.tobytes())


def dead_blocks(x, sr, min_ms=20):
    """Runs of exact digital zero long enough to be heard as a dropout."""
    z = x == 0.0
    out, start = [], None
    need = int(min_ms / 1000 * sr)
    for k in range(len(z)):
        if z[k]:
            if start is None:
                start = k
        elif start is not None:
            if k - start >= need:
                out.append((start, k))
            start = None
    if start is not None and len(z) - start >= need:
        out.append((start, len(z)))
    return out


def rms(a):
    return float(np.sqrt((a ** 2).mean())) if a.size else 0.0


def floor_level(a, sr, win_ms=20):
    """The level of the TONE in a stretch, ignoring any speech in it.

    A plain RMS of the 150ms next to a hole is useless when a word
    starts 40ms in -- the estimate comes back 20 dB hot and the fill
    steps up out of nowhere. The quietest fifth of short windows is the
    floor; anything louder is signal."""
    w = max(1, int(win_ms / 1000 * sr))
    if a.size < w * 2:
        return rms(a)
    q = np.array([rms(a[i:i + w]) for i in range(0, a.size - w, w)])
    q = q[q > 0]
    return float(np.percentile(q, 20)) if q.size else 0.0


def find_donor(x, sr, blocks, want_ms=400):
    """The quietest stretch of real tone that is not speech and not a hole.

    Scanned in windows so a donor is picked on its own level rather than
    on where it happens to sit in the take."""
    need = int(want_ms / 1000 * sr)
    mask = np.ones(len(x), bool)
    for a, b in blocks:
        mask[max(0, a - sr // 20):min(len(x), b + sr // 20)] = False
    step = sr // 100
    best = None
    for j in range(0, len(x) - need, step):
        if not mask[j:j + need].all():
            continue
        seg = x[j:j + need]
        lvl = rms(seg)
        if lvl <= 0:
            continue
        # steady: no big swings inside the window, i.e. no speech in it
        q = np.array([rms(seg[i:i + step]) for i in range(0, need - step, step)])
        if q.size < 3 or q.max() > 4 * (q.min() + 1e-9):
            continue
        if best is None or lvl < best[0]:
            best = (lvl, j)
    return None if best is None else x[best[1]:best[1] + need].copy()


def tile(donor, n):
    """Enough tone to cover n samples, mirrored so the joins don't tick."""
    if donor.size >= n:
        return donor[:n].copy()
    out = [donor]
    total = donor.size
    flip = True
    while total < n:
        piece = donor[::-1] if flip else donor
        out.append(piece); total += donor.size; flip = not flip
    return np.concatenate(out)[:n].copy()


def fill(x, sr, min_ms=20, fade_ms=10, context_ms=150):
    blocks = dead_blocks(x, sr, min_ms)
    if not blocks:
        return x, []
    donor = find_donor(x, sr, blocks)
    if donor is None:
        return x, []
    dlvl = rms(donor)
    ctx = int(context_ms / 1000 * sr)
    fade = int(fade_ms / 1000 * sr)
    y = x.copy()
    report = []
    for a, b in blocks:
        before = floor_level(x[max(0, a - ctx):a], sr)
        after = floor_level(x[b:min(len(x), b + ctx)], sr)
        lvls = [v for v in (before, after) if v > 0]
        if not lvls:
            continue
        if before <= 0:
            before = after
        if after <= 0:
            after = before
        n = b - a
        # Glide from the floor on one side to the floor on the other
        # instead of holding a flat average: where the two differ by
        # 20 dB, a flat fill just moves the step rather than removing it.
        ramp = np.linspace(before, after, n)
        tone = tile(donor, n) * (ramp / dlvl)
        # Raised-cosine in and out, so the tone arrives and leaves without
        # a step of its own.
        f = min(fade, n // 2)
        if f > 1:
            r = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, f))
            tone[:f] *= r
            tone[-f:] *= r[::-1]
        y[a:b] = tone
        report.append((a / sr, n / sr * 1000,
                       20 * np.log10(before + 1e-12),
                       20 * np.log10(after + 1e-12)))
    return y, report


def trim(x, sr, head_ms=80, tail_ms=250, floor_db=35):
    """Cut the lead-in and the trailing pad to a deliberate length."""
    h, win = int(0.005 * sr), int(0.02 * sr)
    env = np.array([rms(x[j:j + win]) for j in range(0, len(x) - win, h)])
    db = 20 * np.log10(env + 1e-12)
    act = np.where(db > db.max() - floor_db)[0]
    first, last = act[0] * h, act[-1] * h + win
    a = max(0, first - int(head_ms / 1000 * sr))
    b = min(len(x), last + int(tail_ms / 1000 * sr))
    return x[a:b], first / sr, (len(x) - last) / sr


def main():
    p = argparse.ArgumentParser()
    p.add_argument('src'); p.add_argument('out')
    p.add_argument('--head-ms', type=float, default=80)
    p.add_argument('--tail-ms', type=float, default=250)
    a = p.parse_args()

    x, sr = read_wav(a.src)
    y, rep = fill(x, sr)
    print(f'{len(rep)} dead-air block(s) filled with matched room tone:')
    for t, ms, b4, af in rep:
        print(f'  {t:6.2f}s  {ms:6.0f}ms   floor {b4:6.1f} dB -> {af:6.1f} dB')
    y, had_head, had_tail = trim(y, sr, a.head_ms, a.tail_ms)
    print(f'lead-in {had_head:.3f}s -> {a.head_ms/1000:.3f}s, '
          f'tail {had_tail:.3f}s -> {a.tail_ms/1000:.3f}s')
    write_wav(a.out, y, sr)
    print(f'-> {a.out}  {len(y)/sr:.2f}s')


if __name__ == '__main__':
    main()
