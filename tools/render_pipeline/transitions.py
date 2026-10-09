#!/usr/bin/env python3
"""
Transitions at the act breaks, and hard cuts everywhere else.

  python3 transitions.py plan  --words words.json --shots v.shots.json --out plan.json
  python3 transitions.py apply --video v.mp4 --plan plan.json --out v-t.mp4

A transition on every cut is the single clearest tell of a cheap edit. A
Short cuts twenty or thirty times in a minute and nearly all of those cuts
are the picture keeping up with the narration -- a new shot because a new
thing is being described. Dressing those up fights the read: the viewer
stops hearing the sentence and starts watching the software.

But a script has two or three places where it actually turns. Setup to
twist, twist to verdict. Those are worth marking, and the writer already
marked them: they are where the voice stops. So the act breaks are not
guessed or set by hand, they are read off the voiceover as the pauses
longer than six tenths of a second, and a transition is only ever offered
where one of those pauses lines up with a cut that is already there.

Five transitions, and none of them blends two frames together. Blending is
what exposes a generated clip -- hold two AI frames on top of each other at
50% and the hands and the fur stop being able to decide where they are --
so there is no cross-dissolve here at all, and between two generated clips
the only things allowed are a hard-edged wipe and no transition.

None of the five changes the running time either. The picture is locked to
the narration; a transition that borrowed six frames from the overlap would
walk every shot after it out of sync with the voice. So each one works on
the frames that are already there: the outgoing frames smear, or the
incoming frames arrive zoomed, or one held frame gets wiped off the top.
Frame count in equals frame count out, which is the property the whole
thing is built around.
"""

import argparse
import json
import os
import re
import subprocess
import sys

import numpy as np

LIBRARY = ('hard-cut', 'whip-pan', 'zoom-punch', 'flash', 'masked-wipe')

# What may join two generated clips.
#
# The whip and the punch are out. Neither blends frames, but both resample
# the picture, and a smear or a scale on generated footage drags the eye
# straight to the part of the frame the model was least sure about.
#
# The flash is in, by Rodney's call. It does not resample anything and it
# does not mix two pictures -- it ramps one frame toward white and back --
# so the reason the other two are excluded does not apply to it, and the
# verdict beat is worth more than the consistency.
AI_SAFE = ('hard-cut', 'masked-wipe', 'flash')

MIN_GAP = 0.6          # what counts as an act break, in seconds of silence
TOLERANCE = 0.5        # how far a cut may be from the pause and still count

# Frame budgets are the spec's: whip-pan at most 8 frames all in, zoom-punch
# at most 6, flash 2 or 3.
INTENSITY = {
    'subtle': dict(whip=2, whip_shift=0.18, whip_blur=0.022,
                   zoom=4, zoom_amount=1.10,
                   flash=2, flash_peak=0.55,
                   wipe=4),
    'standard': dict(whip=4, whip_shift=0.38, whip_blur=0.055,
                     zoom=6, zoom_amount=1.18,
                     flash=3, flash_peak=0.85,
                     wipe=6),
}


# ---------------------------------------------------------------- planning

def act_breaks(words, min_gap=MIN_GAP):
    """The pauses in the read that are long enough to be structural.

    A gap of a fifth of a second is a comma and a gap of six tenths is a
    decision. Only the second kind gets a transition."""
    out = []
    for i, (a, b) in enumerate(zip(words, words[1:])):
        gap = b['start'] - a['end']
        if gap >= min_gap:
            out.append(dict(gap=round(gap, 3),
                            mid=round((a['end'] + b['start']) / 2, 3),
                            word=i + 1,          # the word the pause leads into
                            before=a['text'], after=b['text']))
    return out


def verdict_word(words):
    """Index of the first word of the script's closing sentence.

    The verdict beat is the silence in front of that word -- not whichever
    pause happens to come last. On a read that trails off into a long tail,
    those are different pauses, and the flash belongs on the first one."""
    for i in range(len(words) - 1, 0, -1):
        if words[i - 1]['text'].rstrip('"\'').endswith(('.', '!', '?', ':')):
            return i
    return 0


def suggest(kind_out, kind_in, gap, is_verdict):
    """One transition per break, and a reason for it.

    The verdict gets the flash, because that is the one beat the viewer is
    meant to feel rather than follow, and it outranks the clip rule: a
    flash resamples nothing and mixes nothing, so it is safe on generated
    footage. Otherwise two generated clips get the wipe whatever the pause
    was. A long pause gets the whip and a shorter one the punch -- the
    transition should be about as big as the silence it is filling."""
    if is_verdict:
        return 'flash', 'the verdict'
    if kind_out == 'clip' and kind_in == 'clip':
        return 'masked-wipe', 'both sides are generated footage'
    if gap >= 1.0:
        return 'whip-pan', f'{gap:.1f}s pause'
    return 'zoom-punch', f'{gap:.1f}s pause'


CROWD = 1.0            # seconds: two transitions closer than this are one too many


def _crowds(a, b):
    """Whether b sits too close on top of a to be separate punctuation."""
    if a['cut'] is not None and b['cut'] is not None:
        return b['cut'] - a['cut'] == 1
    return abs(b['time'] - a['time']) < CROWD


def _where(c):
    return f"cut {c['cut']}" if c.get('cut') else f"{c['time']:.2f}s"


def shot_at(shots, t):
    """Which shot is on screen at time t."""
    for s in shots:
        if s['start'] <= t < s['start'] + s['duration']:
            return s
    return shots[-1]


def plan(words, shots, cuts, intensity='subtle',
         min_gap=MIN_GAP, tolerance=TOLERANCE, verdict_flash=True):
    breaks = act_breaks(words, min_gap)
    vw = verdict_word(words)
    chosen, notes = [], []
    for bi, b in enumerate(breaks):
        is_verdict = b['word'] == vw
        ci, off = None, None
        if cuts:
            ci = min(range(len(cuts)), key=lambda i: abs(cuts[i] - b['mid']))
            off = cuts[ci] - b['mid']
        if ci is None or abs(off) > tolerance:
            # Four of the five join two shots, so without a cut there is
            # nothing for them to do. The flash is the exception: it is a
            # lighting event, not a join, and it reads perfectly well in
            # the middle of a held shot. So the verdict still gets one --
            # on the word, where the voice comes back in.
            if not (is_verdict and verdict_flash):
                notes.append(f"{b['mid']:6.2f}s  {b['gap']:.2f}s pause  "
                             f"-- no cut within {tolerance:.1f}s, left alone")
                continue
            t0 = words[vw]['start']
            k = shot_at(shots, t0)['kind']
            chosen.append(dict(cut=None, time=round(t0, 3), type='flash',
                               direction='left', gap=b['gap'], offset=None,
                               between=[k, k], before=b['before'],
                               after=b['after'],
                               why='the verdict (no cut here; a flash does '
                                   'not need one)'))
            continue
        kind_out = shots[ci]['kind']
        kind_in = shots[ci + 1]['kind']
        t, why = suggest(kind_out, kind_in, b['gap'], is_verdict)
        chosen.append(dict(cut=ci + 1, time=cuts[ci], type=t,
                           direction='left' if len(chosen) % 2 == 0 else 'right',
                           gap=b['gap'], offset=round(off, 3),
                           between=[kind_out, kind_in],
                           before=b['before'], after=b['after'], why=why))

    # Never two in a row: that stops reading as punctuation and starts
    # reading as a style. Adjacent cuts, or anything landing within a
    # second of the cut-less verdict flash. The longer pause keeps its
    # transition, except against the verdict, which wins outright.
    keep = []
    for c in chosen:
        if keep and _crowds(keep[-1], c):
            verdict = (c['type'] == 'flash') - (keep[-1]['type'] == 'flash')
            if verdict > 0 or (verdict == 0 and c['gap'] > keep[-1]['gap']):
                notes.append(f"  dropped {keep[-1]['type']} at "
                             f"{keep[-1]['time']:.2f}s (too close to the "
                             f"{c['type']} at {c['time']:.2f}s)")
                keep[-1] = c
            else:
                notes.append(f"  dropped {c['type']} at {c['time']:.2f}s "
                             f"(too close to the {keep[-1]['type']} at "
                             f"{keep[-1]['time']:.2f}s)")
            continue
        keep.append(c)

    if intensity == 'off':
        for c in keep:
            c['type'] = 'hard-cut'
            c['why'] += ' (intensity off)'
    return dict(intensity=intensity, min_gap=min_gap,
                breaks=len(breaks), transitions=keep, notes=notes)


# --------------------------------------------------------------- rendering

def probe(video):
    """Size, frame rate and duration, off `ffmpeg -i`.

    Not ffprobe: the pipeline runs on machines where ffprobe is a shim that
    answers three queries, and frame rate is not one of them. ffmpeg prints
    all of it on stderr anyway."""
    err = subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-i', video],
                         capture_output=True, text=True).stderr
    # Anchored on both sides and at least two digits a side: the codec
    # tag "(avc1 / 0x31637661)" is otherwise a perfectly good 0x31637661.
    size = re.search(r'Video:.*?[ ,](\d{2,5})x(\d{2,5})[ ,\[]', err, re.S)
    fps = re.search(r'([\d.]+) fps', err)
    dur = re.search(r'Duration: (\d+):(\d+):([\d.]+)', err)
    if not (size and fps and dur):
        raise SystemExit(f'cannot read the video stream of {video}')
    h_, m_, s_ = dur.groups()
    return (int(size.group(1)), int(size.group(2)), float(fps.group(1)),
            int(h_) * 3600 + int(m_) * 60 + float(s_))


def count_frames(video):
    """Exactly how many video frames, by decoding to nothing.

    The duration line is only good to a hundredth of a second, which at
    24fps cannot tell 1932 frames from 1933 -- and one frame either way is
    the whole question when the claim being checked is that the transition
    pass cost nothing. A stream copy would be quicker but this ffmpeg
    reports no frame count for one, so it decodes."""
    err = subprocess.run(
        ['ffmpeg', '-nostdin', '-v', 'info', '-i', video,
         '-map', '0:v:0', '-f', 'null', '-'],
        capture_output=True, text=True).stderr
    m = re.findall(r'frame=\s*(\d+)', err)
    return int(m[-1]) if m else -1


def _blur_x(f, r):
    """Horizontal box blur, as a running sum. The directional part of the
    whip: blurring both axes just looks out of focus."""
    r = int(r)
    if r < 1:
        return f
    k = 2 * r + 1
    pad = np.pad(f, ((0, 0), (r, r), (0, 0)), mode='edge').astype(np.uint32)
    c = np.cumsum(pad, axis=1)
    z = np.zeros((f.shape[0], 1, f.shape[2]), np.uint32)
    c = np.concatenate([z, c], axis=1)
    return ((c[:, k:, :] - c[:, :-k, :]) // k).astype(np.uint8)


def _shift_x(f, dx):
    """Slide the picture sideways, extending the edge pixel into the gap."""
    dx = int(round(dx))
    if dx == 0:
        return f
    out = np.empty_like(f)
    if dx > 0:
        out[:, dx:, :] = f[:, :-dx, :]
        out[:, :dx, :] = f[:, :1, :]
    else:
        d = -dx
        out[:, :-d, :] = f[:, d:, :]
        out[:, -d:, :] = f[:, -1:, :]
    return out


def _zoom(f, z):
    """Centre crop by 1/z and back up to full size."""
    if z <= 1.0005:
        return f
    from PIL import Image
    h, w = f.shape[:2]
    cw, ch = int(w / z), int(h / z)
    x, y = (w - cw) // 2, (h - ch) // 2
    im = Image.fromarray(f[y:y + ch, x:x + cw])
    return np.array(im.resize((w, h), Image.BILINEAR))


def _flash(f, amount):
    """Toward white. A flash is not a fade: the picture stays visible under
    it, which is why 0.55 reads as a camera and 1.0 reads as a dropout."""
    a = float(np.clip(amount, 0.0, 1.0))
    if a <= 0.002:
        return f
    g = f.astype(np.float32)
    return (g + (255.0 - g) * a).astype(np.uint8)


def build_ops(trans, fps, width, params):
    """Which frames get touched, and with what. One dict per frame index,
    so the renderer never has to search."""
    ops = {}

    def add(n, op):
        ops.setdefault(n, []).append(op)

    for c in trans:
        t = c['type']
        if t == 'hard-cut':
            continue
        n = int(round(c['time'] * fps))
        d = -1 if c.get('direction', 'left') == 'left' else 1
        if t == 'flash':
            k = params['flash']
            for f in range(n - 1, n - 1 + k):
                amp = params['flash_peak'] * max(0.0, 1.0 - abs(f - n) / k)
                add(f, ('flash', amp))
        elif t == 'zoom-punch':
            k = params['zoom']
            for i in range(k):
                z = 1.0 + (params['zoom_amount'] - 1.0) * (1.0 - i / k)
                add(n + i, ('zoom', z))
        elif t == 'whip-pan':
            k = params['whip']
            smax = params['whip_shift'] * width
            bmax = params['whip_blur'] * width
            for i in range(k):                     # outgoing, building up
                p = (i + 1) / k
                add(n - k + i, ('whip', d * smax * p, bmax * p))
            for i in range(k):                     # incoming, settling
                q = 1.0 - i / k
                add(n + i, ('whip', -d * smax * q, bmax * q))
        elif t == 'masked-wipe':
            k = params['wipe']
            for i in range(k):
                add(n + i, ('wipe', d, (i + 1) / k))
        else:
            raise SystemExit(f'unknown transition {t!r}')
    return ops


def render(video, pl, out, crf=18, preset='slow'):
    w, h, fps, dur = probe(video)
    params = INTENSITY[pl['intensity'] if pl['intensity'] != 'off' else 'subtle']
    ops = build_ops(pl['transitions'], fps, w, params)
    px = w * h * 3

    src = subprocess.Popen(
        ['ffmpeg', '-nostdin', '-v', 'error', '-i', video,
         '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
        stdout=subprocess.PIPE, bufsize=px)
    enc = subprocess.Popen(
        ['ffmpeg', '-nostdin', '-y', '-v', 'error',
         '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}',
         '-r', f'{fps}', '-i', '-', '-i', video,
         '-map', '0:v:0', '-map', '1:a:0?',
         '-c:v', 'libx264', '-preset', preset, '-crf', str(crf),
         # No -shortest: the voiceover usually runs a fraction past the last
         # video frame, and cutting it to the picture would clip the tail
         # off the read. The picture is what has to stay the same length.
         '-pix_fmt', 'yuv420p', '-c:a', 'copy', out],
        stdin=subprocess.PIPE)

    n = 0
    prev = None            # the last frame before the cut, for the wipe
    touched = 0
    while True:
        buf = src.stdout.read(px)
        if len(buf) < px:
            break
        todo = ops.get(n)
        if not todo:
            enc.stdin.write(buf)          # straight through, no numpy at all
            prev = buf
            n += 1
            continue
        touched += 1
        f = np.frombuffer(buf, np.uint8).reshape(h, w, 3)
        for op in todo:
            if op[0] == 'flash':
                f = _flash(f, op[1])
            elif op[0] == 'zoom':
                f = _zoom(f, op[1])
            elif op[0] == 'whip':
                f = _blur_x(_shift_x(f, op[1]), op[2])
            elif op[0] == 'wipe':
                _, d, p = op
                if prev is None:
                    continue
                held = np.frombuffer(prev, np.uint8).reshape(h, w, 3)
                edge = int(round(w * p))
                f = f.copy()
                if d < 0:
                    f[:, edge:, :] = held[:, edge:, :]   # reveals left to right
                else:
                    f[:, :w - edge, :] = held[:, :w - edge, :]
        enc.stdin.write(np.ascontiguousarray(f).tobytes())
        n += 1
    src.stdout.close()
    src.wait()
    enc.stdin.close()
    if enc.wait() != 0:
        raise SystemExit('encode failed')
    return n, touched, dur


# -------------------------------------------------------------------- cli

def cmd_plan(a):
    words = json.load(open(a.words))['words']
    sl = json.load(open(a.shots))
    pl = plan(words, sl['shots'], sl['cuts'], intensity=a.intensity,
              min_gap=a.min_gap, tolerance=a.tolerance,
              verdict_flash=not a.no_verdict_flash)
    print(f"{pl['breaks']} act break(s) at pauses >= {a.min_gap}s, "
          f"{len(sl['cuts'])} cuts in the edit")
    for c in pl['transitions']:
        where = f"cut {c['cut']:>3}" if c['cut'] else 'mid-shot'
        print(f"  {where:>8} @ {c['time']:7.2f}s  {c['type']:<12} "
              f"{c['direction']:<5} {'/'.join(c['between']):<11} "
              f"{c['why']:<28} ...{c['before']} | {c['after']}...")
    for nt in pl['notes']:
        print(f"  {nt}")
    bad = [c for c in pl['transitions']
           if c['between'] == ['clip', 'clip'] and c['type'] not in AI_SAFE]
    if bad:
        raise SystemExit(f'{len(bad)} transition(s) between generated clips '
                         f'are not one of {AI_SAFE}')
    json.dump(pl, open(a.out, 'w'), indent=1)
    n = sum(1 for c in pl['transitions'] if c['type'] != 'hard-cut')
    print(f"{n} transition(s) over {pl['breaks']} break(s) -> {a.out}")


def cmd_apply(a):
    pl = json.load(open(a.plan))
    if a.intensity:
        pl['intensity'] = a.intensity
    for c in pl['transitions']:
        if c['type'] not in LIBRARY:
            raise SystemExit(f"{c['type']!r} is not in the library: {LIBRARY}")
        if c['between'] == ['clip', 'clip'] and c['type'] not in AI_SAFE:
            raise SystemExit(
                f"{_where(c)} is between two generated clips, so "
                f"{c['type']!r} is not allowed there -- only {AI_SAFE}")
    live = [c for c in pl['transitions'] if c['type'] != 'hard-cut']
    for x, y in zip(live, live[1:]):
        if _crowds(x, y):
            raise SystemExit(f'{x["type"]} at {x["time"]:.2f}s and '
                             f'{y["type"]} at {y["time"]:.2f}s are too close '
                             f'together')

    frames, touched, dur_in = render(a.video, pl, a.out, crf=a.crf)
    w, h, fps, dur_out = probe(a.out)
    print(f"{len(live)} transition(s), {touched} of {frames} frames touched")
    for c in live:
        print(f"  {c['time']:7.2f}s  {c['type']:<12} {c['direction']:<5} "
              f"{c['why']}")
    print(f"runtime {dur_in:.3f}s -> {dur_out:.3f}s "
          f"(added {dur_out - dur_in:+.3f}s)")
    print(f"-> {a.out}")


def main():
    p = argparse.ArgumentParser(description=__doc__.strip().split('\n')[0])
    sub = p.add_subparsers(dest='cmd', required=True)

    q = sub.add_parser('plan', help='find the act breaks and suggest one '
                                    'transition for each')
    q.add_argument('--words', required=True, help='words.json for the read')
    q.add_argument('--shots', required=True,
                   help='the .shots.json the builder wrote next to the video')
    q.add_argument('--out', required=True, help='plan JSON, for editing by hand')
    q.add_argument('--intensity', choices=('off', 'subtle', 'standard'),
                   default='subtle')
    q.add_argument('--min-gap', type=float, default=MIN_GAP)
    q.add_argument('--tolerance', type=float, default=TOLERANCE,
                   help='how far a cut may sit from the pause and still '
                        'count as the same beat')
    q.add_argument('--no-verdict-flash', action='store_true',
                   help='Do not flash the verdict when no cut lands on it. '
                        'By default it gets one anyway -- a flash is a '
                        'lighting event, not a join, so it does not need a '
                        'cut underneath it.')
    q.set_defaults(fn=cmd_plan)

    r = sub.add_parser('apply', help='render the plan onto the assembled video')
    r.add_argument('--video', required=True)
    r.add_argument('--plan', required=True)
    r.add_argument('--out', required=True)
    r.add_argument('--intensity', choices=('off', 'subtle', 'standard'),
                   default=None, help="override the plan's own setting")
    r.add_argument('--crf', type=int, default=18)
    r.set_defaults(fn=cmd_apply)

    a = p.parse_args()
    a.fn(a)


if __name__ == '__main__':
    main()
