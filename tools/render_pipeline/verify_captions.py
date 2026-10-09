#!/usr/bin/env python3
"""
Check a caption pass against the read and against the Shorts safe area.

  python3 verify_captions.py --ass out.ass --words words.json

Four things, and all four are measured rather than assumed.

Timing, against the word list the captions were built from. A caption that
is right on average and 200ms late on the hook is a bad caption, so this
reports the worst card, not the mean.

Card length. Four words is the ceiling; past that it stops being a caption
and becomes a subtitle.

Safe area, by rendering the subtitle file over black and finding the ink.
This is the only check that catches the two failures that actually ship: a
long card overflowing the frame, and a card wrapping to a second line that
pushes up into the action rail. Reading the margin numbers out of the style
line would pass both -- the margins are inputs, and what matters is where
the glyphs landed.

Aspect, because an upstream scale filter getting it wrong is silent until
the video is on a phone.
"""

import argparse
import json
import re
import subprocess
import sys

import numpy as np

from burn_captions import (UI_BOTTOM, UI_TOP, UI_RIGHT, MAX_WORDS_CAP,
                           chunk, card_times)

TOL_MS = 80.0


def parse_ass(path):
    """(start, end, plain text, raw text) per dialogue line."""
    out = []
    for ln in open(path, encoding='utf-8'):
        if not ln.startswith('Dialogue:'):
            continue
        f = ln.split(',', 9)
        out.append((ass_secs(f[1]), ass_secs(f[2]), strip_tags(f[9]).strip(),
                    f[9].strip()))
    return out


def ass_secs(t):
    h, m, s = t.strip().split(':')
    return int(h) * 3600 + int(m) * 60 + float(s)


def strip_tags(t):
    return re.sub(r'\{[^}]*\}', '', t).replace(r'\N', ' ')


def ink_boxes(ass, width, height, dur, fps=8.0):
    """Where the glyphs actually are, frame by frame, over black.

    Streamed rather than buffered: a full-resolution gray frame is 2MB and
    a minute at 8fps is a gigabyte, which is a lot of memory to spend on
    finding the edges of some letters."""
    esc = ass.replace('\\', '/').replace(':', r'\:').replace("'", r"\'")
    p = subprocess.Popen(
        ['ffmpeg', '-nostdin', '-v', 'error',
         '-f', 'lavfi', '-i', f'color=black:s={width}x{height}:r={fps}',
         '-t', f'{dur:.3f}', '-vf', f"subtitles='{esc}'",
         '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
        stdout=subprocess.PIPE)
    px = width * height
    i = 0
    while True:
        buf = p.stdout.read(px)
        if len(buf) < px:
            break
        f = np.frombuffer(buf, dtype=np.uint8).reshape(height, width)
        ys, xs = np.nonzero(f > 16)
        if ys.size:
            yield i / fps, (int(xs.min()), int(xs.max()),
                            int(ys.min()), int(ys.max()))
        i += 1
    p.stdout.close()
    p.wait()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ass', required=True)
    ap.add_argument('--words', required=True)
    ap.add_argument('--video', default=None,
                    help='The captioned render, for the aspect check')
    ap.add_argument('--max-words', type=int, default=3,
                    help='What the caption pass was built with')
    ap.add_argument('--width', type=int, default=1080)
    ap.add_argument('--height', type=int, default=1920)
    a = ap.parse_args()

    cards = parse_ass(a.ass)
    words = json.load(open(a.words))['words']
    fails = []

    # 1. timing
    groups = chunk(words, max_words=min(a.max_words, MAX_WORDS_CAP))
    want = card_times(groups)
    if len(want) != len(cards):
        fails.append(f'{len(cards)} cards in the file, {len(want)} from the '
                     f'word list -- cannot compare timings')
        worst = None
    else:
        errs = [abs(c[0] - wv[0]) * 1000 for c, wv in zip(cards, want)]
        worst = max(errs)
        i = errs.index(worst)
        print(f'timing:   worst {worst:.1f}ms (card {i + 1}, '
              f'"{cards[i][2]}"), mean {sum(errs)/len(errs):.1f}ms '
              f'[tolerance {TOL_MS:.0f}ms]')
        if worst > TOL_MS:
            fails.append(f'card {i + 1} starts {worst:.0f}ms off the read')

    # 2. card length
    lens = [len(c[2].split()) for c in cards]
    print(f'length:   {min(lens)}-{max(lens)} words per card '
          f'[ceiling {MAX_WORDS_CAP}]')
    for i, n in enumerate(lens):
        if n > MAX_WORDS_CAP:
            fails.append(f'card {i + 1} is {n} words: "{cards[i][2]}"')

    # 3. safe area
    dur = max(c[1] for c in cards) + 0.5
    x0 = y0 = 10 ** 9
    x1 = y1 = -1
    for t, (bx0, bx1, by0, by1) in ink_boxes(a.ass, a.width, a.height, dur):
        x0, x1 = min(x0, bx0), max(x1, bx1)
        y0, y1 = min(y0, by0), max(y1, by1)
        if by1 > a.height - UI_BOTTOM:
            fails.append(f'{t:.2f}s: ink reaches y={by1}, '
                         f'inside the bottom {UI_BOTTOM}px')
        if by0 < UI_TOP:
            fails.append(f'{t:.2f}s: ink reaches y={by0}, '
                         f'inside the top {UI_TOP}px')
        if bx1 > a.width - UI_RIGHT:
            fails.append(f'{t:.2f}s: ink reaches x={bx1}, '
                         f'inside the {UI_RIGHT}px action rail')
        if bx0 < 0 or bx1 >= a.width:
            fails.append(f'{t:.2f}s: ink runs off the frame at x={bx1}')
    if x1 < 0:
        fails.append('no caption ink rendered at all')
    else:
        print(f'safe:     ink x {x0}-{x1} of {a.width}, y {y0}-{y1} of '
              f'{a.height} [clear of top {UI_TOP}, bottom {UI_BOTTOM}, '
              f'right {UI_RIGHT}]')

    # 4. aspect
    if a.video:
        probe = subprocess.run(
            ['ffmpeg', '-nostdin', '-hide_banner', '-i', a.video],
            capture_output=True, text=True).stderr
        m = re.search(r', (\d+)x(\d+)', probe)
        vw, vh = int(m.group(1)), int(m.group(2))
        print(f'aspect:   {vw}x{vh} = {vw / vh:.4f} [9:16 is {9 / 16:.4f}]')
        if abs(vw / vh - 9 / 16) > 1e-4:
            fails.append(f'{vw}x{vh} is not 9:16')

    print()
    for f in fails[:20]:
        print(f'FAIL  {f}')
    if len(fails) > 20:
        print(f'... and {len(fails) - 20} more')
    print('PASS' if not fails else f'{len(fails)} failures')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
