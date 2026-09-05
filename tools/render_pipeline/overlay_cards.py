#!/usr/bin/env python3
"""
Burn small source/context cards onto a finished video.

  python3 overlay_cards.py --input in.mp4 --out out.mp4 \
      --card "9.8-15.4:PLUTARCH · LIFE OF CRASSUS"

These are NOT the spoken captions. They carry what the narration does not
say -- the source, the site, the date, a figure as digits -- and they are the
cheapest trust signal available: a named source separates a channel from the
ones inventing numbers, and it costs two seconds of screen time.

So they are styled to be believed rather than to shout: small letterspaced
caps in a plain face, a hairline rule above, sitting high in the frame. That
is deliberately the opposite of the heavy karaoke captions lower down --
same video, two different registers, and no chance of reading as one block
of text.

Placement defaults keep clear of both the Shorts top bar and the caption
band. Cards are drawn once and overlaid only between their own timestamps,
so this is cheap however long the video is.
"""

import argparse
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

# Matches the Shorts safe area used through the rest of the pipeline.
TOP_BAR = 90
RIGHT_COL = 150


def _find_font(*names):
    roots = ["/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/truetype/liberation",
             "/usr/share/fonts/truetype/freefont", "/System/Library/Fonts",
             os.path.expanduser("~/.fonts")]
    for n in names:
        if os.path.isfile(n):
            return n
        for r in roots:
            p = os.path.join(r, n)
            if os.path.isfile(p):
                return p
    return None


def draw_card(text, width, height, out_path, font_path, size=34,
              tracking=6, top=210, left=64, accent="#5FBFA6"):
    """
    One card: a hairline accent rule, then letterspaced caps beneath it.

    Pillow has no letter-spacing, so the glyphs are placed one at a time.
    Tracking is what makes small caps read as a caption rather than as body
    text, and it is the whole difference between this looking considered and
    looking like a mistake.
    """
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(font_path, size) if font_path else ImageFont.load_default()

    chars = list(text.upper())
    widths = [d.textlength(c, font=font) for c in chars]
    total = sum(widths) + tracking * max(len(chars) - 1, 0)

    max_w = width - left - RIGHT_COL - 20
    if total > max_w and len(chars) > 1:
        # Shrink to fit rather than run under the button column -- but say so.
        # A card that has been squeezed to fit is a card that was written too
        # long: past about 34 characters it stops reading as a caption and
        # starts reading as a subtitle nobody can see.
        scale = max_w / total
        font = ImageFont.truetype(font_path, max(int(size * scale), 16))
        widths = [d.textlength(c, font=font) for c in chars]
        tracking = max(int(tracking * scale), 2)
        total = sum(widths) + tracking * (len(chars) - 1)
        print(f"  NOTE: {len(chars)} chars is long for a card — shrunk to "
              f"{int(size * scale)}px to fit. Under ~34 characters reads better:"
              f"\n        {text!r}")

    # Hairline rule above the text, the width of a short dash.
    d.rectangle([left, top, left + 46, top + 3], fill=accent)

    y = top + 22

    # A soft dark halo behind the glyphs rather than a drop shadow or a box.
    # These cards land on whatever the shot happens to be -- night fire one
    # moment, a pale morning sky the next -- and a hard shadow that reads
    # fine on the first disappears on the second. Blurring a black copy of
    # the text itself keeps it legible on both without drawing a panel.
    halo = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    x = left
    for c, w in zip(chars, widths):
        hd.text((x, y), c, font=font, fill=(0, 0, 0, 255))
        x += w + tracking
    hd.rectangle([left, top, left + 46, top + 3], fill=(0, 0, 0, 255))
    from PIL import ImageFilter
    halo = halo.filter(ImageFilter.GaussianBlur(7))
    img = Image.alpha_composite(img, halo)
    img = Image.alpha_composite(img, halo)   # twice: one pass is too faint
    d = ImageDraw.Draw(img)
    d.rectangle([left, top, left + 46, top + 3], fill=accent)

    x = left
    for c, w in zip(chars, widths):
        d.text((x, y), c, font=font, fill=(255, 255, 255, 250))
        x += w + tracking

    img.save(out_path)
    return out_path


def parse_card(spec):
    """'START-END:TEXT' -> (start, end, text)."""
    try:
        times, text = spec.split(":", 1)
        a, b = times.split("-")
        return float(a), float(b), text.strip()
    except ValueError:
        print(f"Could not read --card {spec!r}. Use  START-END:TEXT  "
              f"e.g.  9.8-15.4:PLUTARCH · LIFE OF CRASSUS")
        sys.exit(1)


def main():
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--input", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--card", action="append", required=True, metavar="START-END:TEXT",
                   help="Repeatable. Times in seconds.")
    p.add_argument("--top", type=int, default=210,
                   help="Y position of the rule (default 210 — clear of the "
                        "Shorts top bar and well above the caption band)")
    p.add_argument("--size", type=int, default=34)
    p.add_argument("--accent", default="#5FBFA6")
    p.add_argument("--font", default=None, help="TTF path; a plain sans is the point")
    args = p.parse_args()

    if not os.path.isfile(args.input):
        print(f"Not found: {args.input}")
        sys.exit(1)

    font = args.font or _find_font("DejaVuSans.ttf", "LiberationSans-Regular.ttf",
                                   "FreeSans.ttf")
    if not font:
        print("No TrueType font found. Pass --font /path/to/a.ttf")
        sys.exit(1)

    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", args.input],
        capture_output=True, text=True, check=True).stdout.strip()
    w, h = (int(v) for v in probe.split("x"))

    cards = [parse_card(c) for c in args.card]
    import tempfile
    build = tempfile.mkdtemp(prefix="cards_")
    inputs, steps, prev = ["-i", args.input], [], "0:v"
    for i, (start, end, text) in enumerate(cards):
        png = draw_card(text, w, h, os.path.join(build, f"card_{i}.png"),
                        font, size=args.size, top=args.top, accent=args.accent)
        inputs += ["-i", png]
        lbl = f"c{i}"
        steps.append(f"[{prev}][{i+1}:v]overlay=0:0:format=auto:"
                     f"enable='between(t,{start:.3f},{end:.3f})'[{lbl}]")
        prev = lbl

    subprocess.run(
        ["ffmpeg", "-y", *inputs, "-filter_complex", ";".join(steps),
         "-map", f"[{prev}]", "-map", "0:a?", "-c:v", "libx264", "-pix_fmt", "yuv420p",
         "-preset", "medium", "-crf", "18", "-c:a", "copy", args.out],
        check=True, capture_output=True)

    for s, e, t in cards:
        print(f"  {s:6.2f}-{e:6.2f}  {t}")
    print(f"\nDone -> {args.out}")


if __name__ == "__main__":
    main()
