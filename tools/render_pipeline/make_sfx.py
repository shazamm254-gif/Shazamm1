#!/usr/bin/env python3
"""
Synthesise the cinematic sound-design elements, from nothing.

  python3 make_sfx.py sub-drop --out drop.wav
  python3 make_sfx.py heartbeat --duration 12 --bpm 54 --out heart.wav
  python3 make_sfx.py --list

Same bargain as make_music.py: no sample, no recording, nothing to Content
ID. And unlike foley, no loss -- a sub drop, a riser and an impact are
synthetic in real film sound too. Nobody records a sub drop; somebody
makes one. These are built the way the real ones are, which is why they
sound like them rather than like an approximation of them.

What is NOT here, deliberately: footsteps, cloth, door latches, rain. Those
are recordings of real objects and synthesising them lands in the uncanny
middle where it is obviously neither. Source those, or leave them out --
a tense wide shot carries fine on a drone and a sub.

The elements:

  sub-drop    one low hit that falls away. The cut-to-something punctuation.
  impact      transient plus a short low body. Harder and drier than a drop.
  riser       noise and pitch climbing together into a cut. Ends at silence
              on purpose, so it butts straight against the next thing.
  heartbeat   two thumps a beat, slow, felt more than heard.
  drone       a low bed that moves just enough not to be a sine wave.
  room-tone   filtered noise at a level you cannot name but can hear leave.
  whoosh      a passing band of filtered noise. For a camera move or a cut.

Everything is written as mono 48kHz float WAV, peaking where you ask
(default -6 dBFS), on the assumption that place_sfx.py does the final
level against the dialogue.
"""

import argparse
import math
import subprocess

import numpy as np

SR = 48000


def _env(n, attack, release, curve=2.0):
    """Attack-release envelope over n samples, both in samples."""
    e = np.ones(n)
    a = max(1, int(attack))
    r = max(1, int(release))
    if a < n:
        e[:a] = np.linspace(0.0, 1.0, a) ** (1 / curve)
    if r < n:
        e[-r:] = np.linspace(1.0, 0.0, r) ** curve
    return e


def _noise(n, seed):
    return np.random.default_rng(seed).standard_normal(n)


def _onepole_lp(x, cutoff):
    """One-pole low pass. Cheap, and the right amount of blunt for this."""
    a = math.exp(-2.0 * math.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def _lp_sweep(x, f0, f1, shape=None, poles=1):
    """Low pass whose cutoff moves. Done in blocks -- a per-sample
    coefficient in Python is a minute of waiting for a two-second cue.

    `shape` overrides the straight glide with a cutoff per unit position,
    for a filter that has to go somewhere and come back."""
    for _ in range(poles - 1):
        x = _lp_sweep(x, f0, f1, shape)
    n = len(x)
    blk = 512
    out = np.empty_like(x)
    acc = 0.0
    for s in range(0, n, blk):
        e = min(n, s + blk)
        u = s / max(1, n)
        f = shape(u) if shape else f0 + (f1 - f0) * u
        a = math.exp(-2.0 * math.pi * max(20.0, f) / SR)
        seg = x[s:e]
        y = np.empty_like(seg)
        for i in range(len(seg)):
            acc = (1 - a) * seg[i] + a * acc
            y[i] = acc
        out[s:e] = y
    return out


def _lp(x, cutoff, poles=3):
    """Cascaded one-pole. A single pole rolls off at 6dB an octave, which
    leaves enough top on filtered noise that it still reads as hiss --
    the reason the first room tone here came out sounding like a radio."""
    for _ in range(poles):
        x = _onepole_lp(x, cutoff)
    return x


def _sweep(n, f0, f1, curve=3.0):
    """A sine whose frequency glides. Phase is integrated rather than
    assumed -- writing sin(2*pi*f(t)*t) gives you a chirp that is wrong
    everywhere except t=0, which is the classic way to get a drop that
    sounds like a mistake."""
    t = np.arange(n) / SR
    k = (t / max(t[-1], 1e-9)) ** curve
    f = f0 + (f1 - f0) * k
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def sub_drop(dur=2.5, f0=110.0, f1=28.0, seed=1):
    """One low hit that falls away. Punctuation for a hard cut."""
    n = int(dur * SR)
    body = _sweep(n, f0, f1, curve=2.2)
    # A touch of the octave above keeps it audible on a phone speaker,
    # which cannot reproduce 28Hz at all.
    body += 0.25 * _sweep(n, f0 * 2, f1 * 2, curve=2.2)
    click = _noise(int(0.012 * SR), seed) * _env(int(0.012 * SR), 1, int(0.011 * SR))
    out = body * _env(n, int(0.004 * SR), int(dur * 0.75 * SR), curve=2.6)
    out[:len(click)] += 0.5 * _onepole_lp(click, 900)
    return out


def impact(dur=1.2, seed=2):
    """A transient and a short low body. Harder and drier than a drop."""
    n = int(dur * SR)
    low = _sweep(n, 70.0, 38.0, curve=1.6) * _env(n, int(0.002 * SR),
                                                  int(dur * 0.8 * SR), 2.4)
    crack = _noise(n, seed) * _env(n, 1, int(0.09 * SR), 3.0)
    crack = _lp_sweep(crack, 4000, 300)
    return 0.85 * low + 0.35 * crack


def riser(dur=3.0, seed=3):
    """Noise and pitch climbing together, ending at silence for a cut."""
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    nz = _lp_sweep(_noise(n, seed), 300, 7000)
    tone = _sweep(n, 180.0, 1400.0, curve=2.0) * 0.35
    # Tremolo that speeds up. The acceleration is what reads as "about to".
    rate = 4.0 + 20.0 * t ** 2
    trem = 0.75 + 0.25 * np.sin(2 * np.pi * np.cumsum(rate) / SR)
    out = (nz * 0.8 + tone) * trem * (t ** 1.8)
    out[-int(0.004 * SR):] *= np.linspace(1, 0, int(0.004 * SR))
    return out


def heartbeat(dur=10.0, bpm=52.0, seed=4):
    """Two thumps a beat, slow, felt more than heard."""
    n = int(dur * SR)
    out = np.zeros(n)
    beat = 60.0 / bpm
    k = 0
    while k * beat < dur:
        for off, amp in ((0.0, 1.0), (0.26, 0.62)):      # lub, dub
            s = int((k * beat + off) * SR)
            ln = int(0.17 * SR)
            if s + ln >= n:
                break
            thump = _sweep(ln, 62.0, 34.0, curve=1.4)
            thump *= _env(ln, int(0.004 * SR), int(0.14 * SR), 2.2)
            out[s:s + ln] += amp * thump
        k += 1
    return out


def drone(dur=20.0, root=48.0, seed=5):
    """A low bed that moves. Three detuned partials beating slowly against
    each other, which is what stops it reading as a test tone."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for mult, det, amp in ((1.0, 0.0, 1.0), (1.0, 0.13, 0.7),
                           (2.0, -0.21, 0.33), (3.0, 0.31, 0.15)):
        f = root * mult + det
        out += amp * np.sin(2 * np.pi * f * t + np.sin(2 * np.pi * 0.07 * t))
    nz = _onepole_lp(_noise(n, seed), 160) * 0.22
    out = out / 2.2 + nz
    swell = 0.72 + 0.28 * np.sin(2 * np.pi * 0.031 * t - 1.2)
    fade = int(min(1.5, dur / 4) * SR)
    return out * swell * _env(n, fade, fade, 1.5)


def room_tone(dur=20.0, seed=6):
    """Air in a room: rumble, a little body, no hiss."""
    n = int(dur * SR)
    x = _lp(_noise(n, seed), 240, poles=3) * 1.0
    x += 2.5 * _lp(_noise(n, seed + 99), 70, poles=3)
    return x * _env(n, int(0.3 * SR), int(0.3 * SR), 1.2)


def whoosh(dur=1.0, seed=7):
    """Something passing the camera: a band that rises and falls again."""
    n = int(dur * SR)
    nz = _noise(n, seed)
    # Up and back down, because a pass-by does not keep going up. A band
    # that only rises is a riser, and it was reading as one.
    top = lambda u: 300 + 2300 * math.sin(math.pi * min(max(u, 0.0), 1.0))
    # A real band pass: cut the top off, then take the bottom off what is
    # left. Subtracting two single poles leaves most of the top behind --
    # 6dB an octave is barely a slope -- and the first version of this
    # came out 70% above 2kHz, which is a hiss, not a pass-by.
    y = _lp_sweep(nz, 0, 0, shape=top, poles=3)
    band = y - _lp_sweep(y, 0, 0, shape=lambda u: top(u) * 0.3, poles=3)
    return band * _env(n, int(dur * 0.45 * SR), int(dur * 0.5 * SR), 1.8)


ELEMENTS = {
    'sub-drop': sub_drop,
    'impact': impact,
    'riser': riser,
    'heartbeat': heartbeat,
    'drone': drone,
    'room-tone': room_tone,
    'whoosh': whoosh,
}


def normalise(x, peak_db=-6.0):
    p = float(np.abs(x).max())
    if p < 1e-9:
        return x
    return x * (10 ** (peak_db / 20.0) / p)


def write(path, x, sr=SR):
    subprocess.run(
        ['ffmpeg', '-nostdin', '-y', '-v', 'error',
         '-f', 'f32le', '-ac', '1', '-ar', str(sr), '-i', '-',
         '-c:a', 'pcm_f32le', path],
        input=x.astype(np.float32).tobytes(), check=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('element', nargs='?', choices=sorted(ELEMENTS))
    p.add_argument('--out')
    p.add_argument('--duration', type=float, default=None)
    p.add_argument('--bpm', type=float, default=52.0, help='heartbeat only')
    p.add_argument('--root', type=float, default=48.0, help='drone only, Hz')
    p.add_argument('--peak', type=float, default=-6.0, help='dBFS')
    p.add_argument('--seed', type=int, default=None)
    p.add_argument('--list', action='store_true')
    a = p.parse_args()

    if a.list or not a.element:
        for k, f in sorted(ELEMENTS.items()):
            print(f'  {k:<10} {f.__doc__.splitlines()[0] if f.__doc__ else ""}')
        return
    if not a.out:
        raise SystemExit('--out is required')

    fn = ELEMENTS[a.element]
    kw = {}
    if a.duration is not None:
        kw['duration' if 'duration' in fn.__code__.co_varnames else 'dur'] = a.duration
    if a.element == 'heartbeat':
        kw['bpm'] = a.bpm
    if a.element == 'drone':
        kw['root'] = a.root
    if a.seed is not None:
        kw['seed'] = a.seed

    x = normalise(fn(**kw), a.peak)
    write(a.out, x)
    rms = 20 * math.log10(float(np.sqrt((x ** 2).mean())) + 1e-12)
    print(f'{a.element}: {len(x)/SR:.2f}s, peak {a.peak:.1f} dBFS, '
          f'rms {rms:.1f} dBFS -> {a.out}')


if __name__ == '__main__':
    main()
