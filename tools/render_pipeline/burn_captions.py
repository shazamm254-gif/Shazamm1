#!/usr/bin/env python3
"""
Burn phrase-chunk captions onto a vertical video.

  python3 burn_captions.py --video in.mp4 --words words.json --out out.mp4

Most Shorts are watched muted, so the captions are not an accessibility
afterthought -- they are how the video is read. That means something
different from a subtitle track. A subtitle holds a whole sentence for
four seconds at the bottom of the frame; a Short wants two or three
words at a time, large, landing on the beat of the voice. This builds
the second kind, from the word timings align_from_srt.py produces.

Three things it gets right that the pipeline's old caption card did not.

It breaks on sentence ends and on real pauses, never mid-clause, so a
chunk is always something you can read as a unit. It holds each chunk
until the next one starts rather than dropping to nothing between
words, because captions that blink off in the gaps read as broken. And
it sits above the Shorts interface: the title strip, the handle and the
button rail eat the bottom of the frame, and a caption placed by eye in
a preview is routinely covered on a phone.

Rendered through libass rather than as a stack of PNGs, so the text is
drawn once at full resolution with a real outline instead of being
composited per shot.
"""

import argparse
import json
import os
import subprocess

# The Shorts interface, in pixels of a 1080x1920 frame. Captions clear it.
UI_BOTTOM = 320


# Words that should never be the last thing on screen. Ending a chunk on
# one leaves the reader hanging on a hinge -- "Rembrandts out of" tells
# you nothing until the next card arrives, and at two words a second
# that is long enough to feel like a stutter.
DANGLING = {
    'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with',
    'from', 'into', 'out', 'and', 'or', 'but', 'so', 'as', 'than', 'that',
    'is', 'was', 'were', 'be', 'been', 'their', 'his', 'her', 'its', 'our',
    'they', 'he', 'she', 'it', 'we', 'you', 'can', 'had', 'has', 'have',
}


def _bare(w):
    return w['text'].strip('.,;:!?"\'').lower()


def _ends_sentence(w):
    return w['text'].rstrip('"\'').endswith(('.', '!', '?', ':'))


def _card_cost(words, i, j, max_words, max_chars, gap, n):
    """How bad it is to put words[i..j] on one card."""
    text = ' '.join(w['text'] for w in words[i:j + 1])
    k = j - i + 1
    cost = 0.0
    if _bare(words[j]) in DANGLING and not _ends_sentence(words[j]):
        cost += 45                       # left hanging on a hinge
    if k == 1 and not _ends_sentence(words[j]):
        cost += 25                       # a stranded word reads as a glitch
    if len(text) > max_chars:
        cost += 50 + (len(text) - max_chars) * 4
    # Don't break inside a name: "at the Gardner" / "Museum." splits a
    # proper noun across two cards, and the reader reassembles it a beat
    # late.
    if (j + 1 < n and not _ends_sentence(words[j])
            and words[j]['text'][:1].isupper()
            and words[j + 1]['text'][:1].isupper()):
        cost += 30
    at_pause = j + 1 < n and words[j + 1]['start'] - words[j]['end'] >= gap
    if not _ends_sentence(words[j]) and not at_pause:
        cost += 8                        # breaking mid-breath
    cost += (max_words - k) * 2          # all else equal, fill the card
    return cost


def chunk(words, max_words=3, gap=0.28, max_chars=24):
    """Group words into readable units.

    Counting to three is not the same as reading, and neither is taking
    the best break in front of you. A greedy pass will happily spend
    three words on "at the Gardner" and leave "Museum." stranded on its
    own card -- each decision looked fine when it was made. The damage
    always lands on the NEXT card, so the whole sequence has to be
    solved at once.

    This is the line-breaking problem, so it gets the line-breaking
    answer: least total cost over every way of cutting the read, by
    dynamic programming. A card is penalised for ending on a
    preposition or an article, for stranding a single word the writer
    did not end with a full stop, for overflowing a 1080-wide frame,
    and for breaking mid-breath rather than on a pause.

    One hard rule rather than a cost: a card never runs past a full
    stop. The script is written in short sentences on purpose, and a
    card that straddles two of them throws away the punctuation the
    writer put there.
    """
    n = len(words)
    if n == 0:
        return []
    INF = float('inf')
    best = [INF] * (n + 1)
    nxt = [0] * (n + 1)
    best[n] = 0.0
    for i in range(n - 1, -1, -1):
        for k in range(1, max_words + 1):
            j = i + k - 1
            if j >= n:
                break
            # never span a sentence end
            if any(_ends_sentence(words[m]) for m in range(i, j)):
                break
            c = _card_cost(words, i, j, max_words, max_chars, gap, n) + best[j + 1]
            if c < best[i]:
                best[i], nxt[i] = c, k
    out, i = [], 0
    while i < n:
        k = nxt[i] or 1
        out.append(words[i:i + k])
        i += k
    return out


def ass_time(t):
    t = max(0.0, t)
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f'{h:d}:{m:02d}:{s:05.2f}'


def parse_avoid(spec):
    out = []
    if not spec:
        return out
    for part in spec.split(','):
        rng, _, mv = part.partition(':')
        a, _, b = rng.partition('-')
        out.append((float(a), float(b), int(mv)))
    return out


def build_ass(groups, width, height, font, size, margin_v, upper, avoid=()):
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Pop,{font},{size},&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,1,0,1,{max(4, size // 14)},2,2,80,80,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    for i, g in enumerate(groups):
        start = g[0]['start']
        # Hold until the next chunk unless the gap is long enough that the
        # caption would visibly outstay the voice.
        own_end = g[-1]['end']
        nxt = groups[i + 1][0]['start'] if i + 1 < len(groups) else None
        end = min(nxt, own_end + 0.6) if nxt is not None else own_end + 0.35
        end = max(end, start + 0.2)
        text = ' '.join(w['text'] for w in g)
        if upper:
            text = text.upper()
        text = text.replace('{', '(').replace('}', ')').replace('\n', ' ')
        mv = 0
        mid = (start + end) / 2
        for a0, b0, m in avoid:
            if a0 <= mid <= b0:
                mv = m
                break
        lines.append(
            f'Dialogue: 0,{ass_time(start)},{ass_time(end)},Pop,,0,0,{mv},,{text}')
    return head + '\n'.join(lines) + '\n'


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--video', required=True)
    p.add_argument('--words', required=True, help='words.json from align_from_srt.py')
    p.add_argument('--out', required=True)
    p.add_argument('--font', default='Archivo Narrow')
    p.add_argument('--fontsdir', default='/usr/share/fonts')
    p.add_argument('--size', type=int, default=140)
    p.add_argument('--max-words', type=int, default=3)
    p.add_argument('--upper', action='store_true', help='Set the captions in capitals')
    p.add_argument('--margin-v', type=int, default=None,
                   help=f'Pixels from the frame bottom (default 420, which '
                        f'clears the {UI_BOTTOM}px Shorts interface and sits '
                        f'below most in-frame signage)')
    p.add_argument('--avoid', default=None, metavar='A-B:MARGIN,...',
                   help='Time ranges where the shot carries its own text, with '
                        'the margin to use there, e.g. "52.9-64.8:300". A '
                        'caption landing on a prop\'s lettering is the one '
                        'collision a viewer always notices.')
    p.add_argument('--crf', type=int, default=18)
    p.add_argument('--keep-ass', action='store_true')
    a = p.parse_args()

    words = json.load(open(a.words))['words']
    groups = chunk(words, max_words=a.max_words)
    lens = [len(g) for g in groups]
    print(f'{len(words)} words -> {len(groups)} captions '
          f'({min(lens)}-{max(lens)} words each, {sum(lens)/len(lens):.1f} avg)')

    probe = subprocess.run(
        ['ffmpeg', '-nostdin', '-hide_banner', '-i', a.video],
        capture_output=True, text=True).stderr
    import re
    m = re.search(r', (\d+)x(\d+)', probe)
    w, h = (int(m.group(1)), int(m.group(2))) if m else (1080, 1920)

    margin_v = a.margin_v if a.margin_v is not None else UI_BOTTOM + 100
    ass_path = os.path.splitext(a.out)[0] + '.ass'
    avoid = parse_avoid(a.avoid)
    open(ass_path, 'w').write(
        build_ass(groups, w, h, a.font, a.size, margin_v, a.upper, avoid))
    for a0, b0, m in avoid:
        print(f'  {a0:.1f}-{b0:.1f}s moved to {m}px (shot carries its own text)')
    print(f'{w}x{h}, captions {margin_v}px off the bottom '
          f'(interface needs {UI_BOTTOM})')

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
