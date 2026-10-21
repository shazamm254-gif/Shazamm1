#!/usr/bin/env python3
"""
Burn on-screen title cards onto a finished cut.

  python3 title_cards.py --video cut.mp4 --cards cards.txt --out final.mp4

Not captions. burn_captions.py chunks a spoken read into two- and
three-word beats timed to the voice; this is the other thing a Short
needs -- a handful of deliberate cards that announce, state a number and
ask a question, on a video that may have no narration at all.

One line per card:

    START  END  POSITION  STYLE  TEXT

    0.2  3.6  center       hook     TWO KINGS. | ONE SWAMP.
    4.1  7.0  lower-third  stat     T. REX | *8 TONS* - STRONGEST BITE
    16.6 20.1 center       verdict  YOUR PICK? | 👇

`|` breaks a line. `*stars*` put a word in the accent colour. Blank lines
and # comments are ignored, so the sheet can carry the timing notes next
to the cards.

Cards fade rather than pop -- 150ms each way. A title card that cuts on
hard reads as a mistake at this size, and the fade costs nothing.

Everything stays inside the Shorts safe area, same margins burn_captions
uses, because the interface eats the same pixels whatever is drawn in
them.
"""

import argparse
import os
import re
import subprocess

from burn_captions import UI_BOTTOM, UI_RIGHT, UI_TOP, hex_to_ass

WHITE = '&H00FFFFFF&'

# Sizes are for a 1080x1920 frame and scale with it.
STYLES = {
    'hook':    dict(font='Archivo Narrow', size=150, outline=11, shadow=0,
                    bold=-1, spacing=2),
    'stat':    dict(font='Archivo Narrow', size=80, outline=6, shadow=0,
                    bold=-1, spacing=1),
    'verdict': dict(font='Archivo Narrow', size=112, outline=9, shadow=0,
                    bold=-1, spacing=1),
    'small':   dict(font='Archivo', size=64, outline=5, shadow=2,
                    bold=0, spacing=0),
}

POSITIONS = {
    'center': (5, 0),
    'lower-third': (2, UI_BOTTOM + 120),
    'upper-third': (8, UI_TOP + 220),
}

FADE_MS = 150


def parse(path):
    cards = []
    for n, raw in enumerate(open(path, encoding='utf-8'), 1):
        line = raw.split('#')[0].rstrip()
        if not line.strip():
            continue
        m = re.match(r'^\s*([\d.]+)\s+([\d.]+)\s+(\S+)\s+(\S+)\s+(.*)$', line)
        if not m:
            raise SystemExit(f'{path}:{n}: cannot read "{line.strip()}"')
        start, end, pos, style, text = m.groups()
        if pos not in POSITIONS:
            raise SystemExit(f'{path}:{n}: position must be one of '
                             f'{sorted(POSITIONS)}')
        if style not in STYLES:
            raise SystemExit(f'{path}:{n}: style must be one of '
                             f'{sorted(STYLES)}')
        if float(end) <= float(start):
            raise SystemExit(f'{path}:{n}: ends before it starts')
        cards.append(dict(start=float(start), end=float(end), pos=pos,
                          style=style, text=text.strip()))
    cards.sort(key=lambda c: c['start'])
    for x, y in zip(cards, cards[1:]):
        if y['start'] < x['end'] - 1e-6 and y['pos'] == x['pos']:
            raise SystemExit(f'two cards overlap at {y["start"]:.2f}s in the '
                             f'same position -- they would draw on top of '
                             f'each other')
    return cards


def ass_time(t):
    t = max(0.0, t)
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f'{h:d}:{m:02d}:{s:05.2f}'


def markup(text, accent):
    """`|` is a line break, `*stars*` are the accent colour."""
    out = []
    for part in re.split(r'(\*[^*]+\*)', text):
        if part.startswith('*') and part.endswith('*') and len(part) > 2:
            out.append('{\\c' + accent + '}' + part[1:-1] + '{\\c' + WHITE + '}')
        else:
            out.append(part)
    return ''.join(out).replace('|', r'\N')


def build_ass(cards, width, height, accent):
    acc = hex_to_ass(accent)
    styles, events = [], []
    for name, s in STYLES.items():
        for pos, (align, margin) in POSITIONS.items():
            styles.append(
                f"Style: {name}_{pos},{s['font']},{s['size']},&H00FFFFFF,"
                f"&H00000000,&H00000000,{s['bold']},0,0,0,100,100,"
                f"{s['spacing']},0,1,{s['outline']},{s['shadow']},{align},"
                f"{UI_RIGHT},{UI_RIGHT},{margin},1")
    for c in cards:
        fade = r'{\fad(%d,%d)}' % (FADE_MS, FADE_MS)
        events.append(
            f"Dialogue: 0,{ass_time(c['start'])},{ass_time(c['end'])},"
            f"{c['style']}_{c['pos']},,0,0,0,,{fade}{markup(c['text'], acc)}")
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
"""
    return (head + '\n'.join(styles) + "\n\n[Events]\nFormat: Layer, Start, "
            "End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
            + '\n'.join(events) + '\n')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--video', required=True)
    p.add_argument('--cards', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--accent', default='#FFD60A')
    p.add_argument('--fontsdir', default='/usr/share/fonts')
    p.add_argument('--crf', type=int, default=17)
    p.add_argument('--keep-ass', action='store_true')
    p.add_argument('--ass-only', action='store_true')
    a = p.parse_args()

    cards = parse(a.cards)
    err = subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-i', a.video],
                         capture_output=True, text=True).stderr
    m = re.search(r'Video:.*?[ ,](\d{2,5})x(\d{2,5})[ ,\[]', err, re.S)
    w, h = (int(m.group(1)), int(m.group(2))) if m else (1080, 1920)

    ass_path = os.path.splitext(a.out)[0] + '.ass'
    open(ass_path, 'w').write(build_ass(cards, w, h, a.accent))
    print(f'{len(cards)} card(s), {w}x{h}, accent {a.accent}')
    for c in cards:
        print(f"  {c['start']:5.2f}-{c['end']:5.2f}s  {c['style']:<8} "
              f"{c['pos']:<12} {c['text']}")
    if a.ass_only:
        print(f'-> {ass_path}')
        return

    esc = ass_path.replace('\\', '/').replace(':', r'\:').replace("'", r"\'")
    subprocess.run(
        ['ffmpeg', '-y', '-v', 'error', '-i', a.video,
         '-vf', f"subtitles='{esc}':fontsdir={a.fontsdir}",
         '-c:v', 'libx264', '-preset', 'slow', '-crf', str(a.crf),
         '-pix_fmt', 'yuv420p', '-c:a', 'copy', a.out],
        check=True)
    if not a.keep_ass:
        os.remove(ass_path)
    print(f'-> {a.out}')


if __name__ == '__main__':
    main()
