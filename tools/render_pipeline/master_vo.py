#!/usr/bin/env python3
"""
Master a generated voiceover to delivery spec.

  python3 master_vo.py in.wav out.wav

The reads arrive inconsistent: 44.1 or 48 kHz depending on the day,
anywhere from -20 to -14 LUFS, and sometimes with a true peak already
over zero. This lands all of them in the same place -- 48 kHz, -14 LUFS,
true peak under the ceiling -- and does it by measuring rather than by
applying a fixed chain.

Two things worth knowing about the order of operations.

The peaks come down BEFORE the level goes up. A read at -20 LUFS whose
true peak is already at zero has nowhere to put 6 dB of gain, and
feeding that straight to a limiter means the limiter does all the work
on every plosive. A gentle compressor first keeps the crest factor
where a voice should sit; measured on these reads it costs about a
decibel of crest and buys back all the headroom.

And loudnorm runs in LINEAR mode off a measured first pass. Its dynamic
mode rides the level through the take and pulls the loudness range in
hard, which on a spoken read flattens exactly the emphasis the
performance is carrying. Linear applies one constant gain and leaves
the shape alone.

loudnorm's own true-peak guard then stops it about a decibel short of
target, so the last of the gain is handed to the limiter deliberately.
Arriving quiet is a loss you cannot get back: YouTube only ever turns a
track down.
"""

import argparse
import json
import os
import re
import subprocess


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True).stderr


def measure(path):
    err = run(['ffmpeg', '-nostdin', '-hide_banner', '-i', path,
               '-af', 'ebur128=peak=true', '-f', 'null', '-'])
    # ebur128 prints running values and the summary last: take the last.
    g = lambda p: float(re.findall(p, err)[-1])
    return (g(r'I:\s+(-?[\d.]+) LUFS'), g(r'LRA:\s+(-?[\d.]+) LU'),
            g(r'Peak:\s+(-?[\d.]+) dBFS'))


def rolloff(path, frac=0.995):
    """The frequency below which almost all the energy sits.

    Reads do not always arrive at the same quality. A 44.1kHz WAV carries
    useful articulation to 10kHz or more; a 64kbps 24kHz MP3 is empty
    above 8 by construction, and sounds like a phone call. Worth knowing
    before mastering, because the fix is different: level and dynamics
    are repairable, bandwidth is gone and can only be compensated for."""
    import numpy as np
    raw = subprocess.run(
        ['ffmpeg', '-nostdin', '-v', 'error', '-i', path,
         '-f', 'f32le', '-ac', '1', '-ar', '48000', '-'],
        capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    if x.size < 4096:
        return 0.0
    n = min(len(x), 48000 * 20)
    sp = np.abs(np.fft.rfft(x[:n])) ** 2
    f = np.fft.rfftfreq(n, 1 / 48000)
    c = np.cumsum(sp) / max(sp.sum(), 1e-20)
    return float(f[np.searchsorted(c, frac)])


def main():
    p = argparse.ArgumentParser()
    p.add_argument('src'); p.add_argument('out')
    p.add_argument('--lufs', type=float, default=-14.0)
    p.add_argument('--ceiling', type=float, default=-1.0)
    p.add_argument('--rate', type=int, default=48000)
    p.add_argument('--threshold', default='-20dB')
    p.add_argument('--ratio', type=float, default=3.0)
    p.add_argument('--tol', type=float, default=0.3)
    p.add_argument('--presence', type=float, default=0.0,
                   help='dB of lift around 3.5kHz, for a read that arrived '
                        'bandwidth-limited. It cannot put back what is not '
                        'there; it raises the articulation that is.')
    a = p.parse_args()

    i, lra, tp = measure(a.src)
    ro = rolloff(a.src)
    print(f'  source  {i:6.1f} LUFS   LRA {lra:4.1f} LU   TP {tp:5.1f} dBTP'
          f'   rolloff {ro/1000:.1f} kHz')
    if ro < 9000 and not a.presence:
        print(f'  !! almost nothing above {ro/1000:.1f} kHz -- this read is '
              f'bandwidth-limited. --presence 3 lifts what articulation '
              f'there is.')

    pre = ''
    if a.presence:
        pre += f'equalizer=f=3500:width_type=o:width=1.6:g={a.presence},'
    pre += (f'acompressor=threshold={a.threshold}:ratio={a.ratio}'
            f':attack=5:release=120:makeup=1,')
    err = run(['ffmpeg', '-nostdin', '-hide_banner', '-i', a.src, '-af',
               pre + f'loudnorm=I={a.lufs}:TP={a.ceiling}:LRA=11'
                     f':print_format=json', '-f', 'null', '-'])
    m = json.loads(err[err.rindex('{'):err.rindex('}') + 1])

    limit = 10 ** (a.ceiling / 20.0)
    gain = 0.0
    # The resample is its own pass rather than the tail of the chain.
    # loudnorm runs internally at 192kHz and hands that rate on, so
    # something has to bring it back to 48 -- but ffmpeg 7.0.2 aborts on
    # the combined graph (best_input assertion, ffmpeg_filter.c) once the
    # read is longer than about 87 seconds. Same filters, same order, two
    # invocations; the intermediate stays float so nothing is quantised
    # twice.
    stage1 = os.path.splitext(a.out)[0] + '.stage1.wav'
    for _ in range(4):
        chain = (pre
                 + f"loudnorm=I={a.lufs}:TP={a.ceiling}:LRA=11"
                   f":measured_I={m['input_i']}:measured_TP={m['input_tp']}"
                   f":measured_LRA={m['input_lra']}"
                   f":measured_thresh={m['input_thresh']}"
                   f":offset={m['target_offset']}:linear=true,"
                 + (f'volume={gain:.2f}dB,' if gain else '')
                 + f'alimiter=limit={limit:.4f}:level=disabled')
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', a.src,
                        '-af', chain, '-ac', '1',
                        '-c:a', 'pcm_f32le', stage1], check=True)
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', stage1,
                        '-af', f'aresample={a.rate}:resampler=soxr:precision=28',
                        '-ar', str(a.rate), '-ac', '1',
                        '-c:a', 'pcm_s16le', a.out], check=True)
        got, glra, gtp = measure(a.out)
        if abs(got - a.lufs) <= a.tol and gtp <= a.ceiling + 0.05:
            break
        gain += a.lufs - got          # hand the shortfall to the limiter

    print(f'  master  {got:6.1f} LUFS   LRA {glra:4.1f} LU   TP {gtp:5.1f} dBTP'
          f'   (+{gain:.1f} dB into the limiter)')
    if gtp > a.ceiling + 0.05:
        print(f'  !! true peak {gtp:.1f} is above the {a.ceiling} ceiling')


if __name__ == '__main__':
    main()
