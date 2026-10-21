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

The design elements:

  sub-drop    one low hit that falls away. The cut-to-something punctuation.
  impact      transient plus a short low body. Harder and drier than a drop.
  riser       noise and pitch climbing together into a cut. Ends at silence
              on purpose, so it butts straight against the next thing.
  heartbeat   two thumps a beat, slow, felt more than heard.
  drone       a low bed that moves just enough not to be a sine wave.
  room-tone   filtered noise at a level you cannot name but can hear leave.
  whoosh      a passing band of filtered noise. For a camera move or a cut.

And the foley, which is modal synthesis:

  rain-glass  a wash plus individual drops, close on a window.
  footsteps   a few footfalls on a wooden floor. Not a walk cycle.
  cloth       a jacket moving. Low, brief, almost subliminal.
  door-latch  the mechanism. A click and a short metal ring.
  door-creak  stick-slip on a hinge, which is what a creak physically is.

A struck object rings at a handful of sharply tuned frequencies that
decay at different rates, and that is nearly all there is to a footstep,
a latch or a drop of water. Summing decaying sinusoids at those
frequencies -- modal synthesis -- is how games and film have made these
sounds for twenty years, so they are no more "fake" than the sub drop is.
The hard part is not the physics, it is the variation: real footsteps
differ from each other, and the surest way to sound synthetic is to
repeat one of them. Every mode here is jittered per event.

Everything is written as mono 48kHz float WAV, peaking where you ask
(default -6 dBFS), on the assumption that place_sfx.py does the final
level against the dialogue.

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


# --- foley, by modal synthesis ---------------------------------------
#
# An object that gets hit rings at a few sharply tuned frequencies, each
# decaying at its own rate. Wood is low and dies fast; metal is high and
# rings on. Reproduce those modes and you have the sound, which is why
# this works and why a filtered noise burst never does.


def _modal(n, modes, rng, jitter=0.03):
    """Sum of decaying sinusoids. modes = [(hz, amp, decay_seconds), ...]

    Frequencies and decays are jittered per call, because the one thing
    that gives synthetic foley away is two identical events."""
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f, a, d in modes:
        f = f * (1.0 + rng.normal(0, jitter))
        d = d * (1.0 + rng.normal(0, jitter * 2))
        out += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 2 * np.pi)) \
            * np.exp(-t / max(d, 1e-4))
    return out


def rain_glass(dur=10.0, seed=11, drops_per_s=38.0):
    """A wash plus individual drops, close on a window."""
    n = int(dur * SR)
    rng = np.random.default_rng(seed)
    # Heard from inside a car, rain is mostly body: a low roar with
    # ticks on top. Built tick-first it comes out 77% above 3kHz, which
    # is a hiss on a window, not weather.
    # Balance solved against a target spread rather than guessed: the
    # first pass was 77% above 3kHz (a hiss), the correction for it was
    # 69% below 200Hz (a rumble), and neither is rain.
    wash = _lp(rng.standard_normal(n), 1500, poles=2) * 0.8
    wash += _lp(rng.standard_normal(n), 220, poles=3) * 1.4
    out = wash
    # Each drop is a tiny bright tick with a glassy ring over it. Poisson
    # arrivals, not a grid -- evenly spaced drops read as a machine.
    k = rng.poisson(drops_per_s * dur)
    ln = int(0.03 * SR)
    for s in rng.integers(0, max(1, n - ln), size=k):
        a = rng.uniform(0.2, 1.0) ** 2
        tick = _lp(rng.standard_normal(ln), 6000, poles=1)
        tick *= _env(ln, 1, int(0.008 * SR), 3.0)
        ring = _modal(ln, [(rng.uniform(1400, 3400), 0.5, 0.007),
                           (rng.uniform(3400, 6000), 0.2, 0.004)], rng)
        out[s:s + ln] += a * 0.6 * (tick * 0.6 + ring)
    return out


def footsteps(dur=4.0, count=4, interval=0.78, seed=12):
    """A few footfalls on a wooden floor. Not a walk cycle."""
    n = int(dur * SR)
    rng = np.random.default_rng(seed)
    out = np.zeros(n)
    ln = int(0.32 * SR)
    t = 0.25
    for i in range(count):
        s = int(t * SR)
        if s + ln >= n:
            break
        # Wooden floor modes: low, close together, gone in a fifth of a
        # second. Plus the heel transient and a little sole scuff.
        # A board knocks as well as thuds. Weighted to the low modes
        # alone it came out 95% below 200Hz, which is a footstep heard
        # through a floor rather than one on it.
        body = _modal(ln, [(72, 1.0, 0.085), (118, 0.75, 0.06),
                           (196, 0.6, 0.045), (340, 0.5, 0.03),
                           (520, 0.38, 0.022), (810, 0.28, 0.016),
                           (1240, 0.16, 0.011)], rng, jitter=0.06)
        body *= _env(ln, int(0.0015 * SR), int(0.28 * SR), 2.5)
        thud = _lp(rng.standard_normal(ln), 260, poles=2)
        thud *= _env(ln, 1, int(0.035 * SR), 3.0)
        scuff = _lp(rng.standard_normal(ln), 3800, poles=1)
        scuff *= _env(ln, int(0.004 * SR), int(0.05 * SR), 2.0)
        amp = rng.uniform(0.72, 1.0)
        out[s:s + ln] += amp * (body * 0.8 + thud * 0.32 + scuff * 0.3)
        t += interval * rng.uniform(0.88, 1.12)     # nobody walks to a click
    return out


def cloth(dur=1.2, seed=13):
    """A jacket moving. Low, brief, almost subliminal."""
    n = int(dur * SR)
    rng = np.random.default_rng(seed)
    out = np.zeros(n)
    for _ in range(rng.integers(3, 6)):
        ln = int(rng.uniform(0.06, 0.18) * SR)
        s = rng.integers(0, max(1, n - ln))
        b = _lp(rng.standard_normal(ln), rng.uniform(2000, 4500), poles=2)
        b -= _lp(b, 600, poles=2)
        out[s:s + ln] += b * _env(ln, int(ln * 0.3), int(ln * 0.6), 1.6) \
            * rng.uniform(0.4, 1.0)
    return out


def door_latch(dur=0.6, seed=14):
    """The mechanism. A click and a short metal ring."""
    n = int(dur * SR)
    rng = np.random.default_rng(seed)
    click = rng.standard_normal(int(0.004 * SR))
    ring = _modal(n, [(1180, 1.0, 0.045), (1930, 0.6, 0.035),
                      (3260, 0.4, 0.022), (4700, 0.22, 0.014),
                      (640, 0.3, 0.06)], rng, jitter=0.02)
    out = ring * _env(n, int(0.0008 * SR), int(0.2 * SR), 2.5)
    out[:len(click)] += click * 0.8
    return out


def door_creak(dur=2.2, seed=15):
    """Stick-slip on a hinge, which is what a creak physically is."""
    n = int(dur * SR)
    rng = np.random.default_rng(seed)
    out = np.zeros(n)
    # A creak is not a tone, it is hundreds of tiny slips. Rate and pitch
    # wander; that wander is the whole character of the sound.
    t = 0.0
    while t < dur:
        s = int(t * SR)
        ln = int(0.05 * SR)
        if s + ln >= n:
            break
        f = rng.uniform(380, 1250)
        out[s:s + ln] += _modal(ln, [(f, 1.0, 0.012),
                                     (f * 2.4, 0.35, 0.008)], rng) \
            * rng.uniform(0.3, 1.0)
        t += rng.uniform(0.004, 0.028)
    out *= _env(n, int(0.2 * SR), int(0.8 * SR), 1.4)
    return out + _lp(rng.standard_normal(n), 140, poles=3) * 0.25 * \
        _env(n, int(0.3 * SR), int(0.9 * SR), 1.4)


ELEMENTS = {
    'rain-glass': rain_glass,
    'footsteps': footsteps,
    'cloth': cloth,
    'door-latch': door_latch,
    'door-creak': door_creak,
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
    p.add_argument('--count', type=int, default=4, help='footsteps only')
    p.add_argument('--interval', type=float, default=0.78, help='footsteps only')
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
    if a.element == 'footsteps':
        kw['count'] = a.count
        kw['interval'] = a.interval
    if a.seed is not None:
        kw['seed'] = a.seed

    x = normalise(fn(**kw), a.peak)
    write(a.out, x)
    rms = 20 * math.log10(float(np.sqrt((x ** 2).mean())) + 1e-12)
    print(f'{a.element}: {len(x)/SR:.2f}s, peak {a.peak:.1f} dBFS, '
          f'rms {rms:.1f} dBFS -> {a.out}')


if __name__ == '__main__':
    main()
