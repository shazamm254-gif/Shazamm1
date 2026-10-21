#!/usr/bin/env python3
"""
Lay sound effects under a dialogue track, at times you choose.

  python3 place_sfx.py --voice vo.wav --cues cues.txt --out mixed.wav

The music path already in this pipeline mixes one bed across a whole
episode and ducks it against the narration. Drama needs the other thing:
a dozen separate sounds, each at a particular moment, some of them
holding for fifteen seconds and some lasting a tenth of one.

So a cue sheet. One line per sound, two kinds:

    AT   24.60  sub-drop.wav   -12
    BED  9.0-23.5  drone.wav   -26
    BED  9.0-23.5  drone.wav   -26  noduck

A gain of `auto` on a bed means measure it: the level is set so the bed
sits `--bed-under` dB beneath the voice while the voice is speaking.
Prefer it. A number is a guess about a file you have not heard.

`AT` fires a sound once at that second. `BED` holds one across a span,
looping it with a crossfade if the file is shorter than the span and
fading it in and out at the edges.

**Beds duck under speech; one-shots do not.** That split is the whole
design. A drone competing with a voice is mud and has to get out of the
way, but a door latch or a sub drop is punctuation -- ducking it is the
same mistake as fading down a cut. Pass `noduck` on a bed to override.

Blank lines and # comments are ignored, so the cue sheet can carry the
spotting notes next to the cues.
"""

import argparse
import os
import re
import subprocess

import numpy as np

SR = 48000


def read(path, sr=SR):
    raw = subprocess.run(
        ['ffmpeg', '-nostdin', '-v', 'error', '-i', path,
         '-f', 'f32le', '-ac', '1', '-ar', str(sr), '-'],
        capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def write(path, x, sr=SR):
    subprocess.run(
        ['ffmpeg', '-nostdin', '-y', '-v', 'error',
         '-f', 'f32le', '-ac', '1', '-ar', str(sr), '-i', '-',
         '-c:a', 'pcm_f32le', path],
        input=x.astype(np.float32).tobytes(), check=True)


def parse_cues(path, root):
    cues = []
    for ln, raw in enumerate(open(path, encoding='utf-8'), 1):
        line = raw.split('#')[0].strip()
        if not line:
            continue
        parts = line.split()
        kind = parts[0].upper()
        if kind not in ('AT', 'BED') or len(parts) < 3:
            raise SystemExit(f'{path}:{ln}: cannot read "{line.strip()}"')
        when, fname = parts[1], parts[2]
        raw_gain = parts[3] if len(parts) > 3 else '0'
        auto = raw_gain.lower() == 'auto'
        gain = 0.0 if auto else float(raw_gain)
        flags = {p.lower() for p in parts[4:]}
        f = fname if os.path.isabs(fname) else os.path.join(root, fname)
        if not os.path.isfile(f):
            raise SystemExit(f'{path}:{ln}: no such file {f}')
        if kind == 'AT':
            cues.append(dict(kind='AT', start=float(when), end=None,
                             file=f, gain=gain, duck=False, auto=auto))
        else:
            m = re.match(r'^([\d.]+)-([\d.]+)$', when)
            if not m:
                raise SystemExit(f'{path}:{ln}: BED wants START-END, got {when}')
            cues.append(dict(kind='BED', start=float(m.group(1)),
                             end=float(m.group(2)), file=f, gain=gain,
                             duck='noduck' not in flags, auto=auto))
    return cues


def tile(x, n, xfade_s=0.5):
    """Fill n samples from x, crossfading each wrap so the seam is not a
    click. A bed shorter than its span is the normal case -- twenty
    seconds of drone covering a forty second scene."""
    if len(x) >= n:
        return x[:n].copy()
    f = max(1, int(xfade_s * SR))
    f = min(f, len(x) // 3)
    out = np.zeros(n)
    pos, body = 0, len(x) - f
    while pos < n:
        seg = x if pos + len(x) <= n else x[:n - pos]
        out[pos:pos + len(seg)] += seg * _edge(len(seg), f, pos > 0,
                                               pos + len(x) < n)
        pos += body
    return out


def _edge(n, f, fade_in, fade_out):
    e = np.ones(n)
    f = min(f, n // 2)
    if f > 0 and fade_in:
        e[:f] = np.linspace(0, 1, f)
    if f > 0 and fade_out:
        e[-f:] = np.linspace(1, 0, f)
    return e


def speech_envelope(voice, win=0.03, hop=0.01, attack=0.02, release=0.35):
    """How loud the voice is, smoothed the way a duck should move.

    Fast to clamp down when a line starts, slow to let go, so the bed
    does not pump back up between words."""
    w, h = int(win * SR), int(hop * SR)
    n = max(1, (len(voice) - w) // h)
    e = np.array([np.sqrt((voice[i * h:i * h + w] ** 2).mean())
                  for i in range(n)])
    a = np.exp(-hop / max(attack, 1e-6))
    r = np.exp(-hop / max(release, 1e-6))
    out = np.zeros_like(e)
    acc = 0.0
    for i, v in enumerate(e):
        acc = (a * acc + (1 - a) * v) if v < acc else (r * acc + (1 - r) * v)
        out[i] = max(acc, v)
    full = np.interp(np.arange(len(voice)), np.arange(n) * h, out)
    return full


def duck_curve(voice, depth_db, knee=1e-3):
    """A gain curve that pulls the bed down where the voice is.

    Scaled by how loud the voice is at that instant rather than switched
    on and off, so a quiet aside ducks less than a hard line."""
    env = speech_envelope(voice)
    peak = np.percentile(env, 99) or 1.0
    norm = np.clip(env / max(peak, knee), 0.0, 1.0)
    return 10 ** ((depth_db * norm) / 20.0)


def db(x):
    p = float(np.sqrt((x ** 2).mean())) if len(x) else 0.0
    return 20 * np.log10(p + 1e-12)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--voice', required=True, help='the dialogue, already mastered')
    p.add_argument('--cues', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--sfx-dir', default=None,
                   help='where the cue files live (default: next to the sheet)')
    p.add_argument('--duck', type=float, default=-11.0,
                   help='dB to pull beds down under speech (default -11)')
    p.add_argument('--bed-under', type=float, default=20.0,
                   help='for beds written `auto`, how many dB under the '
                        'voice to sit while it speaks (default 20)')
    p.add_argument('--tail', type=float, default=0.0,
                   help='extra seconds past the end of the voice')
    a = p.parse_args()

    voice = read(a.voice)
    root = a.sfx_dir or os.path.dirname(os.path.abspath(a.cues))
    cues = parse_cues(a.cues, root)

    # Load first, then size. A one-shot runs as long as its file does, and
    # guessing a length here is how the mix ends up half a minute of
    # silence after the last cue.
    for c in cues:
        c['audio'] = read(c['file']) * 10 ** (c['gain'] / 20.0)
    end = max([len(voice) / SR + a.tail]
              + [c['end'] if c['kind'] == 'BED'
                 else c['start'] + len(c['audio']) / SR for c in cues])
    n = int(end * SR)
    v = np.zeros(n)
    v[:len(voice)] = voice

    beds = np.zeros(n)
    autobeds = np.zeros(n)
    hits = np.zeros(n)
    print(f'voice {len(voice)/SR:.2f}s, {len(cues)} cue(s), bed duck {a.duck:+.0f} dB')
    for c in cues:
        x = c['audio']
        s = int(c['start'] * SR)
        if c['kind'] == 'BED':
            ln = int((c['end'] - c['start']) * SR)
            seg = tile(x, ln) * _edge(ln, int(0.4 * SR), True, True)
            tgt = (autobeds if c['auto'] else beds) if c['duck'] else hits
            tgt[s:s + ln] += seg
            print(f"  BED {c['start']:6.2f}-{c['end']:6.2f}  {c['gain']:+5.1f} dB  "
                  f"{'ducked' if c['duck'] else 'flat  '}  "
                  f"{os.path.basename(c['file'])}")
        else:
            ln = min(len(x), n - s)
            if ln > 0:
                hits[s:s + ln] += x[:ln]
            print(f"  AT  {c['start']:6.2f}          {c['gain']:+5.1f} dB  "
                  f"one-shot  {os.path.basename(c['file'])}")

    g = duck_curve(v, a.duck)

    # Beds written as `auto` get measured rather than guessed. Setting a
    # bed by dB against a file that was normalised to a peak does not
    # work -- the same gain gives a drone and a heartbeat completely
    # different loudness, because their crest factors are nothing alike.
    # This pipeline already learned that once with the music bed.
    for c in cues:
        if c['kind'] != 'BED' or not c['auto']:
            continue
        s0, e0 = int(c['start'] * SR), int(c['end'] * SR)
        seg = autobeds[s0:e0] * g[s0:e0]
        vs = v[s0:e0]
        live = np.abs(seg) > 1e-9
        talk = live & (np.abs(vs) > 1e-4)
        ref = talk if talk.any() else live
        if not ref.any():
            continue
        want = db(vs[ref] if talk.any() else v[np.abs(v) > 1e-4]) - a.bed_under
        adj = want - db(seg[ref])
        beds[s0:e0] += autobeds[s0:e0] * 10 ** (adj / 20.0)
        print(f"  auto {c['start']:6.2f}-{c['end']:6.2f}  {adj:+5.1f} dB  "
              f"-> {a.bed_under:.0f} dB under the voice  "
              f"{os.path.basename(c['file'])}")

    mix = v + beds * g + hits

    peak = float(np.abs(mix).max())
    if peak > 0.97:
        mix *= 0.97 / peak
        print(f'  peak {20*np.log10(peak):+.1f} dBFS -> trimmed to -0.26')
    write(a.out, mix)

    # Measured only where each thing actually is. Averaging a bed across
    # the silence either side of it reports a level the bed never has,
    # and it is the one number that says whether this will be audible.
    bed = beds * g
    live = np.abs(bed) > 1e-6
    talk = live & (np.abs(v) > 1e-4)
    print(f'voice {db(v[:len(voice)]):.1f} dB')
    if live.any():
        print(f'bed   {db(bed[live]):.1f} dB where it plays'
              + (f', {db(v[talk]) - db(bed[talk]):.0f} dB under the voice '
                 f'while it speaks' if talk.any() else ''))
    if (np.abs(hits) > 1e-6).any():
        print(f'hits  {db(hits[np.abs(hits) > 1e-6]):.1f} dB where they play')
    print(f'-> {a.out}  {len(mix)/SR:.2f}s')


if __name__ == '__main__':
    main()
