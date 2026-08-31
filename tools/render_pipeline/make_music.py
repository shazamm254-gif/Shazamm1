#!/usr/bin/env python3
"""
Generate a royalty-free ambient music bed, with no dependencies beyond the
Python standard library.

This exists because finding a usable, licence-safe track is often the thing
that stalls a video. Anything generated here is synthesised from scratch --
there is no sample, no recording, and nothing to Content ID.

  python3 make_music.py --duration 60 --out bed.wav
  python3 make_music.py --duration 60 --style pulse --key A --out bed.wav

Styles:
  ambient  slow evolving pad, arpeggio enters partway, swells to a peak
  pulse    steady low heartbeat under a sparse pad -- good for tension
  minimal  drone and occasional high notes only, stays out of the way

The build peaks at --peak (fraction of total, default 0.58), which is where
a 60s explainer usually lands its reveal. Set it to match wherever your
script turns.
"""

import argparse
import math
import struct
import wave

SR = 44100

# Semitone offsets for a natural minor scale, and note names to semitones
# from A. Everything is generated in a minor key: it reads as serious and
# considered rather than triumphant, which suits explanatory content.
NOTE_SEMITONES = {"A": 0, "A#": 1, "B": 2, "C": 3, "C#": 4, "D": 5,
                  "D#": 6, "E": 7, "F": 8, "F#": 9, "G": 10, "G#": 11}


def freq(semitones_from_a4, octave_shift=0):
    return 440.0 * (2 ** ((semitones_from_a4 + 12 * octave_shift) / 12.0))


def adsr(n, total, attack, decay, sustain, release):
    """Envelope value at sample n of a note `total` samples long."""
    a, d, r = int(attack * SR), int(decay * SR), int(release * SR)
    if n < a:
        return n / max(a, 1)
    if n < a + d:
        return 1.0 - (1.0 - sustain) * ((n - a) / max(d, 1))
    if n > total - r:
        return sustain * max(0.0, (total - n) / max(r, 1))
    return sustain


def voice(buf, start_s, dur_s, f, amp, harmonics=(1.0, 0.35, 0.18, 0.08),
          attack=0.02, decay=0.15, sustain=0.7, release=0.4, detune=0.0):
    """
    Add one note to the buffer using additive synthesis.

    A few quiet harmonics on top of the fundamental is what separates a
    warm tone from a bare sine. A touch of detune between the two channels
    widens it in stereo.
    """
    n0 = int(start_s * SR)
    n = int(dur_s * SR)
    if n0 >= len(buf[0]):
        return
    n = min(n, len(buf[0]) - n0)
    for ch in (0, 1):
        fc = f * (1.0 + (detune if ch == 0 else -detune))
        w = 2 * math.pi * fc / SR
        for i in range(n):
            env = adsr(i, n, attack, decay, sustain, release)
            if env <= 0:
                continue
            s = 0.0
            ph = w * i
            for k, h in enumerate(harmonics, start=1):
                if h:
                    s += h * math.sin(ph * k)
            buf[ch][n0 + i] += s * env * amp


def lowpass(chan, cutoff_hz):
    """One-pole lowpass; takes the edge off additive harmonics."""
    dt = 1.0 / SR
    rc = 1.0 / (2 * math.pi * cutoff_hz)
    a = dt / (rc + dt)
    prev = 0.0
    for i, v in enumerate(chan):
        prev += a * (v - prev)
        chan[i] = prev


def echo(chan, delay_s, feedback, mix):
    """Cheap reverb substitute: a couple of feedback taps."""
    d = int(delay_s * SR)
    if d <= 0 or d >= len(chan):
        return
    for i in range(d, len(chan)):
        chan[i] += chan[i - d] * feedback * mix


def build(duration, style, root_name, peak_frac):
    n = int(duration * SR)
    buf = [[0.0] * n, [0.0] * n]
    root = NOTE_SEMITONES.get(root_name.upper(), 0)

    # Minor triad plus the octave and the seventh, in semitones from root.
    tri = [0, 3, 7, 12, 10]
    peak = duration * peak_frac

    def swell(t):
        """0 -> 1 rising to the peak, easing off after it."""
        if t <= peak:
            return (t / max(peak, 0.01)) ** 1.35
        tail = (duration - peak) or 1
        return max(0.25, 1.0 - 0.65 * ((t - peak) / tail))

    # --- sustained bass drone, present throughout -------------------------
    voice(buf, 0, duration, freq(root - 24), 0.16,
          harmonics=(1.0, 0.22, 0.06), attack=2.5, decay=0.1,
          sustain=1.0, release=3.0, detune=0.0007)
    voice(buf, 0, duration, freq(root - 12), 0.10,
          harmonics=(1.0, 0.18), attack=3.5, decay=0.1,
          sustain=1.0, release=3.0, detune=0.0012)

    if style == "minimal":
        step = 6.0
        t = 4.0
        i = 0
        while t < duration - 2:
            voice(buf, t, 5.0, freq(root + tri[i % 3], 1), 0.05 * swell(t),
                  attack=1.2, decay=0.6, sustain=0.5, release=2.0, detune=0.002)
            t += step
            i += 1

    elif style == "pulse":
        # Low heartbeat -- steady, slightly under 60 bpm so it feels calm.
        beat = 1.15
        t = 0.5
        while t < duration - 0.5:
            voice(buf, t, 0.55, freq(root - 24), 0.30 * (0.45 + 0.55 * swell(t)),
                  harmonics=(1.0, 0.3), attack=0.005, decay=0.22,
                  sustain=0.15, release=0.25)
            t += beat
        # Sparse pad chords above it.
        t = 0.0
        ci = 0
        while t < duration:
            for off in (tri[0], tri[1], tri[2]):
                voice(buf, t, 8.0, freq(root + off), 0.045 * swell(t),
                      attack=2.0, decay=1.0, sustain=0.6, release=3.0,
                      detune=0.0015 + 0.0004 * ci)
            t += 7.5
            ci += 1

    else:  # ambient
        # Pad chords, overlapping so they never fully drop out.
        t = 0.0
        ci = 0
        while t < duration:
            chord = [tri[0], tri[2], tri[3]] if ci % 2 == 0 else [tri[0], tri[1], tri[2]]
            for off in chord:
                voice(buf, t, 9.0, freq(root + off), 0.05 * swell(t + 3),
                      attack=2.5, decay=1.2, sustain=0.65, release=3.5,
                      detune=0.0015)
            t += 8.0
            ci += 1

        # Arpeggio enters at a third of the way in and accumulates -- the
        # figure repeats and climbs, which suits anything about growth.
        arp_start = duration * 0.30
        note_len = 0.34
        seq = [tri[0], tri[1], tri[2], tri[3], tri[2], tri[1]]
        t = arp_start
        i = 0
        while t < duration - 1.0:
            oct_shift = 1 if (i // len(seq)) % 2 == 0 else 2
            a = 0.055 * swell(t)
            voice(buf, t, note_len * 2.2, freq(root + seq[i % len(seq)], oct_shift),
                  a, harmonics=(1.0, 0.25, 0.1),
                  attack=0.01, decay=0.18, sustain=0.25, release=0.5,
                  detune=0.002)
            t += note_len
            i += 1

    for ch in buf:
        lowpass(ch, 2600)
        echo(ch, 0.37, 0.32, 0.5)
        echo(ch, 0.53, 0.22, 0.4)

    # Soft-clip then normalise with headroom, so the bed never fights the
    # limiter later in the mix.
    peak_val = max(max(abs(v) for v in ch) for ch in buf) or 1.0
    target = 0.72
    for ch in buf:
        for i, v in enumerate(ch):
            x = (v / peak_val) * target
            ch[i] = math.tanh(x * 1.25) * 0.8

    # Fade both ends.
    fade = int(min(2.5, duration / 8) * SR)
    for ch in buf:
        for i in range(fade):
            g = i / fade
            ch[i] *= g
            ch[-(i + 1)] *= g
    return buf


def write_wav(buf, path):
    n = len(buf[0])
    with wave.open(path, "w") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = bytearray()
        for i in range(n):
            for ch in (0, 1):
                v = int(max(-1.0, min(1.0, buf[ch][i])) * 32000)
                frames += struct.pack("<h", v)
        w.writeframes(bytes(frames))


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--duration", type=float, required=True, help="Length in seconds")
    p.add_argument("--out", required=True, help="Output .wav path")
    p.add_argument("--style", choices=["ambient", "pulse", "minimal"], default="ambient")
    p.add_argument("--key", default="A", help="Root note, e.g. A, C, D, F (minor key)")
    p.add_argument("--peak", type=float, default=0.58,
                   help="Where the build peaks, as a fraction of duration (default 0.58)")
    args = p.parse_args()

    print(f"generating {args.duration:.0f}s of '{args.style}' in {args.key.upper()} minor, "
          f"peaking at {args.duration * args.peak:.0f}s")
    buf = build(args.duration, args.style, args.key, args.peak)
    write_wav(buf, args.out)
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
