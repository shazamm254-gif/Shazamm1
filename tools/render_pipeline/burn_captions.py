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

It also reserves one colour for the words that carry the episode. White
body text, and a single accent on the numbers, the names and the verdict
line -- the things a muted viewer scans for. One colour per episode, not
a rainbow: the accent only means something while it stays rare. Which
words get it is decided by the word list, not by hand, and whether the
accent is readable on a given shot is measured against the frames behind
it rather than guessed from a preview.

Rendered through libass rather than as a stack of PNGs, so the text is
drawn once at full resolution with a real outline instead of being
composited per shot.

verify_captions.py checks the output: timing against the read, card
length, and where the glyphs actually landed.
"""

import argparse
import json
import os
import subprocess

import numpy as np

# The Shorts interface, in pixels of a 1080x1920 frame. Captions clear it.
UI_BOTTOM = 320
UI_TOP = 90
UI_RIGHT = 150          # the like/comment/share rail

WHITE = '&H00FFFFFF&'

# Style presets. Outline is what carries legibility over a moving picture --
# a drop shadow alone disappears against a bright frame -- so even the soft
# preset keeps one.
STYLES = {
    'bold-impact': dict(font='Archivo Narrow', size=140, outline=10, shadow=0),
    'clean':       dict(font='Archivo',        size=120, outline=5,  shadow=3),
}

# Position presets, as (ASS alignment, margin from that edge).
POSITIONS = {
    'lower-third': (2, UI_BOTTOM + 100),
    'center':      (5, 0),
    'upper-third': (8, UI_TOP + 260),
}

ACCENT_DEFAULT = '#FFD60A'

# Spelled-out numbers, since the scripts write every figure as words so the
# voice reads it correctly -- "four hundred and twenty pounds" has no digit
# in it anywhere.
CARDINALS = {
    'one','two','three','four','five','six','seven','eight','nine','ten',
    'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen',
    'eighteen','nineteen','twenty','thirty','forty','fifty','sixty','seventy',
    'eighty','ninety','hundred','thousand','million','billion','trillion',
    'dozen','half','twice','double','triple',
}
# Plurals count: "for thousands of years" is a figure the viewer should see.
CARDINALS |= {w + 's' for w in
              ('hundred','thousand','million','billion','trillion','dozen')}

ORDINALS = {
    'first','second','third','fourth','fifth','sixth','seventh','eighth',
    'ninth','tenth','hundredth','thousandth',
}

NUMBER_WORDS = CARDINALS | ORDINALS

SUPERLATIVES = {
    'biggest','largest','smallest','greatest','worst','best','most','least',
    'only','never','always','every','everyone','nobody','none','all','no',
    'first','last','largest','longest','shortest','highest','lowest',
    'impossible','perfect','entire','whole','zero','not','without',
}


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


def load_keywords(path):
    """A manual list, one phrase per line. Blank lines and # comments out."""
    if not path:
        return set()
    out = set()
    for ln in open(path, encoding='utf-8'):
        ln = ln.split('#')[0].strip()
        if ln:
            out.add(ln.lower())
    return out


def detect_keywords(words, manual=(), superlatives=SUPERLATIVES,
                    verdict_words=0, auto=True):
    """Which word indices carry the accent.

    Tier 1, heuristics only. Four sources: anything with a digit in it,
    numbers written out as words, proper nouns, and a configurable
    superlative list. Plus whatever the operator typed in by hand, which
    always wins -- the heuristic is a floor, not a ceiling.

    A capital at the start of a sentence is capitalisation, not a name, so
    the first word after a full stop is only taken when it is a number or
    on a list."""
    hit = set()
    sentence_start = True
    for i, w in enumerate(words):
        raw = w['text']
        bare = raw.strip('.,;:!?"\'()').lower()
        is_kw = False
        if bare in manual or raw.lower() in manual:
            is_kw = True
        elif auto:
            if any(c.isdigit() for c in raw):
                is_kw = True
            elif bare in NUMBER_WORDS:
                is_kw = True
            elif bare.split('-')[0] in CARDINALS:
                # "fifty-five-year-old", "twenty-seventh". Only a cardinal
                # may open a compound: "first-hand" is not a figure, and
                # the ordinals are what tell the two apart.
                is_kw = True
            elif bare in superlatives:
                is_kw = True
            elif raw[:1].isupper() and not sentence_start:
                is_kw = True          # proper noun
        if is_kw:
            hit.add(i)
        sentence_start = raw.rstrip('"\'').endswith(('.', '!', '?', ':'))

    # The verdict: the script's last sentence is the payoff, and it is the
    # one line that earns the accent whether or not a heuristic fires.
    if verdict_words:
        for i in range(max(0, len(words) - verdict_words), len(words)):
            hit.add(i)
    return hit


def verdict_span(words):
    """How many trailing words make up the final sentence."""
    n = 0
    for i in range(len(words) - 1, -1, -1):
        n += 1
        if i > 0 and _ends_sentence(words[i - 1]):
            break
    return n


def hex_to_ass(h):
    """#RRGGBB -> ASS's &HBBGGRR& byte order."""
    h = h.lstrip('#')
    return f'&H00{h[4:6]}{h[2:4]}{h[0:2]}'.upper() + '&'


def relative_luminance(rgb):
    def ch(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(x) for x in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(l1, l2):
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


# --- contrast check -------------------------------------------------------
#
# The accent only works if it reads as a different colour from what is
# behind it. Yellow on a white wall does not: #FFD60A has a relative
# luminance of 0.69, which against white is a contrast ratio of 1.4. The
# black outline still holds the letter shapes, so the card stays legible --
# but the accent has stopped meaning anything, and a word the writer picked
# out is now just a word. So it gets measured, per card, against the frames
# it actually sits on, and falls back to plain white when it loses.

GRAY_W, GRAY_H = 108, 192       # a tenth of the frame; luminance survives it


def caption_band(align, margin_v, size, height, lines=1):
    """The vertical strip the text occupies, in full-frame pixels."""
    band = int(size * 1.35 * lines)
    if align == 8:
        return margin_v, min(height, margin_v + band)
    if align == 5:
        c = height // 2
        return max(0, c - band // 2), min(height, c + band // 2)
    return max(0, height - margin_v - band), height - margin_v


def luma_track(video, y0, y1, x0, x1, width, height, fps=4.0):
    """Per-frame brightness of the caption strip, worst case within it.

    One decode. Seeking per card is dozens of ffmpeg launches on a
    hundred-card read, and the frames are wanted at a tenth of the size
    anyway. The 90th percentile rather than the mean, because a bright
    patch under one accent word kills that word whatever the rest of the
    strip is doing.

    ffmpeg's gray plane is gamma-encoded luma, so it goes through the sRGB
    transfer to get to the linear quantity WCAG's ratio is defined on. Luma
    is not luminance for saturated colour, but it is close enough to decide
    a fallback, and it is one decode instead of three planes."""
    out = subprocess.run(
        ['ffmpeg', '-nostdin', '-v', 'error', '-i', video,
         '-vf', f'fps={fps},scale={GRAY_W}:{GRAY_H},format=gray',
         '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
        capture_output=True, check=True).stdout
    px = GRAY_W * GRAY_H
    n = len(out) // px
    if n == 0:
        return np.zeros(0), fps
    f = np.frombuffer(out[:n * px], dtype=np.uint8).reshape(n, GRAY_H, GRAY_W)
    ys = slice(int(y0 * GRAY_H / height), max(1, round(y1 * GRAY_H / height)))
    xs = slice(int(x0 * GRAY_W / width), max(1, round(x1 * GRAY_W / width)))
    crop = f[:, ys, xs].reshape(n, -1).astype(np.float32) / 255.0
    lin = np.where(crop <= 0.03928, crop / 12.92,
                   ((crop + 0.055) / 1.055) ** 2.4)
    return np.percentile(lin, 90, axis=1), fps


def card_contrast(track, fps, start, end, accent_lum):
    """Worst accent-vs-background ratio over the card's own frames."""
    if track.size == 0:
        return 0.0                      # no frames read: fail closed
    i0 = max(0, int(start * fps))
    i1 = min(track.size, max(i0 + 1, int(end * fps) + 1))
    bg = float(track[i0:i1].max())
    return contrast_ratio(accent_lum, bg)


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


def _sanitise(t):
    """Keep the writer's text out of ASS's own syntax."""
    return (t.replace('\\', '/').replace('{', '(')
             .replace('}', ')').replace('\n', ' '))


def card_times(groups):
    """Start and end of every card.

    The start is the word's own start, untouched -- that is the whole
    point of aligning the read. The end holds until the next card so the
    captions never blink off between words, but not so far past the voice
    that a caption outstays a pause."""
    out = []
    for i, g in enumerate(groups):
        start = g[0]['start']
        own_end = g[-1]['end']
        nxt = groups[i + 1][0]['start'] if i + 1 < len(groups) else None
        end = min(nxt, own_end + 0.6) if nxt is not None else own_end + 0.35
        out.append((start, max(end, start + 0.2)))
    return out


def build_ass(groups, width, height, style, align, margin_v, upper,
              avoid=(), keywords=(), accent=ACCENT_DEFAULT, plain=()):
    """The subtitle file.

    `keywords` is a set of indices into the flat word list -- the words
    that get the accent. `plain` is a set of card indices where the
    contrast check said the accent would not read, so those cards go out
    in white."""
    accent_ass = hex_to_ass(accent)
    # Symmetric, and wide enough to clear the action rail -- the like and
    # share buttons sit above the bottom strip, so clearing UI_BOTTOM is not
    # enough on its own. Asymmetric margins would shift centred text off
    # centre, so both sides give up the same amount.
    margin_h = UI_RIGHT
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Pop,{style['font']},{style['size']},&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,1,0,1,{style['outline']},{style['shadow']},{align},{margin_h},{margin_h},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    for i, (g, (start, end)) in enumerate(zip(groups, card_times(groups))):
        parts = []
        for w in g:
            t = _sanitise(w['text'])
            if upper:
                t = t.upper()
            if w.get('_i') in keywords and i not in plain:
                t = '{\\c' + accent_ass + '}' + t + '{\\c' + WHITE + '}'
            parts.append(t)
        text = ' '.join(parts)
        mv = 0
        mid = (start + end) / 2
        for a0, b0, m in avoid:
            if a0 <= mid <= b0:
                mv = m
                break
        lines.append(
            f'Dialogue: 0,{ass_time(start)},{ass_time(end)},Pop,,0,0,{mv},,{text}')
    return head + '\n'.join(lines) + '\n'


MAX_WORDS_CAP = 4       # hard ceiling: past four words it is a subtitle


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--video', required=True)
    p.add_argument('--words', required=True, help='words.json from align_from_srt.py')
    p.add_argument('--out', required=True)
    p.add_argument('--style', choices=sorted(STYLES), default='bold-impact')
    p.add_argument('--position', choices=sorted(POSITIONS), default='lower-third')
    p.add_argument('--font', default=None, help='Override the preset font')
    p.add_argument('--fontsdir', default='/usr/share/fonts')
    p.add_argument('--size', type=int, default=None, help='Override the preset size')
    p.add_argument('--max-words', type=int, default=3,
                   help=f'Words per card (hard ceiling {MAX_WORDS_CAP})')
    p.add_argument('--upper', action='store_true', help='Set the captions in capitals')
    p.add_argument('--accent', default=ACCENT_DEFAULT,
                   help=f'The one accent colour for the episode (default '
                        f'{ACCENT_DEFAULT}). One per episode, never more.')
    p.add_argument('--keywords', default=None, metavar='FILE',
                   help='Manual keyword list, one word or phrase per line. '
                        'Always wins over the heuristic.')
    p.add_argument('--no-auto-keywords', action='store_true',
                   help='Use only the manual list, no heuristic detection')
    p.add_argument('--no-verdict', action='store_true',
                   help="Do not accent the script's closing sentence")
    p.add_argument('--contrast-min', type=float, default=3.0,
                   help='WCAG ratio the accent must clear against the frame '
                        'behind it (default 3.0, the large-text bar). Cards '
                        'that fail go out in plain white.')
    p.add_argument('--no-contrast-check', action='store_true')
    p.add_argument('--margin-v', type=int, default=None,
                   help='Override the position preset, in pixels from the '
                        f'nearer edge (the Shorts interface needs '
                        f'{UI_BOTTOM} at the bottom, {UI_TOP} at the top)')
    p.add_argument('--avoid', default=None, metavar='A-B:MARGIN,...',
                   help='Time ranges where the shot carries its own text, with '
                        'the margin to use there, e.g. "52.9-64.8:300". A '
                        'caption landing on a prop\'s lettering is the one '
                        'collision a viewer always notices.')
    p.add_argument('--crf', type=int, default=18)
    p.add_argument('--keep-ass', action='store_true')
    p.add_argument('--ass-only', action='store_true',
                   help='Write the subtitle file and stop, for checking the '
                        'chunking and the accent without a four-minute encode')
    a = p.parse_args()

    style = dict(STYLES[a.style])
    if a.font:
        style['font'] = a.font
    if a.size:
        style['size'] = a.size
        style['outline'] = max(4, a.size // 14)
    align, preset_margin = POSITIONS[a.position]
    margin_v = a.margin_v if a.margin_v is not None else preset_margin

    words = json.load(open(a.words))['words']
    for i, w in enumerate(words):
        w['_i'] = i

    max_words = min(a.max_words, MAX_WORDS_CAP)
    if max_words != a.max_words:
        print(f'--max-words {a.max_words} clamped to {max_words}')
    groups = chunk(words, max_words=max_words)
    lens = [len(g) for g in groups]
    print(f'{len(words)} words -> {len(groups)} captions '
          f'({min(lens)}-{max(lens)} words each, {sum(lens)/len(lens):.1f} avg)')
    assert max(lens) <= MAX_WORDS_CAP

    manual = load_keywords(a.keywords)
    kw = detect_keywords(
        words, manual=manual,
        verdict_words=0 if a.no_verdict else verdict_span(words),
        auto=not a.no_auto_keywords)
    print(f'accent {a.accent} on {len(kw)}/{len(words)} words'
          + (f' ({len(manual)} manual)' if manual else ''))

    probe = subprocess.run(
        ['ffmpeg', '-nostdin', '-hide_banner', '-i', a.video],
        capture_output=True, text=True).stderr
    import re
    m = re.search(r', (\d+)x(\d+)', probe)
    w, h = (int(m.group(1)), int(m.group(2))) if m else (1080, 1920)

    # Contrast: measure the strip the text will sit in, then decide per card.
    plain = set()
    if not a.no_contrast_check and kw:
        y0, y1 = caption_band(align, margin_v, style['size'], h)
        track, fps = luma_track(a.video, y0, y1, UI_RIGHT, w - UI_RIGHT, w, h)
        accent_lum = relative_luminance(
            tuple(int(a.accent.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)))
        ratios = []
        for i, (s, e) in enumerate(card_times(groups)):
            if not any(x.get('_i') in kw for x in groups[i]):
                continue
            r = card_contrast(track, fps, s, e, accent_lum)
            ratios.append(r)
            if r < a.contrast_min:
                plain.add(i)
        if ratios:
            print(f'contrast: {len(ratios)} accented cards, '
                  f'{min(ratios):.2f}-{max(ratios):.2f}:1, '
                  f'{len(plain)} below {a.contrast_min:.1f} -> white')

    ass_path = os.path.splitext(a.out)[0] + '.ass'
    avoid = parse_avoid(a.avoid)
    open(ass_path, 'w').write(
        build_ass(groups, w, h, style, align, margin_v, a.upper,
                  avoid, kw, a.accent, plain))
    for a0, b0, m in avoid:
        print(f'  {a0:.1f}-{b0:.1f}s moved to {m}px (shot carries its own text)')
    edge = 'top' if align == 8 else 'centre' if align == 5 else 'bottom'
    print(f'{w}x{h}, {a.style} at {a.position} '
          f'({margin_v}px off the {edge}; interface needs {UI_BOTTOM})')

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
