#!/usr/bin/env python3
"""
Channel art for The Roman Machine: avatar and banner.

Drawn rather than generated. A generator gives you laurel wreaths, gold
filigree and a garbled Latin motto -- the exact look the channel exists to
avoid -- and it cannot hold a safe area or stay legible at 24 pixels.

Type is Anton, the same face burned into the video captions, so the channel
page and the videos read as one thing.
"""
import math, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ANTON = "shortscaptioner/fonts/Anton-Regular.ttf"
SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
IRON  = (18, 20, 22)
BRONZE = (95, 191, 166)      # same accent as the caption highlight
BONE  = (232, 229, 222)

def stone(w, h, seed=7):
    """A quiet aggregate texture, so the ground is not flat black."""
    random.seed(seed)
    img = Image.new("RGB", (w // 4, h // 4), IRON)
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            n = random.randint(-9, 9)
            px[x, y] = (max(0, IRON[0] + n), max(0, IRON[1] + n), max(0, IRON[2] + n))
    return img.resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.2))

def track(d, xy, text, font, fill, sp):
    """Draw letterspaced text; returns the width used."""
    x, y = xy
    for c in text:
        d.text((x, y), c, font=font, fill=fill)
        x += d.textlength(c, font=font) + sp
    return x - xy[0] - sp

def measure(d, text, font, sp):
    return sum(d.textlength(c, font=font) for c in text) + sp * (len(text) - 1)

# ---------- avatar: 800x800, cropped to a circle, shown as small as 24px ----------
# The first attempt set the monogram at 300pt with a bronze rule beneath it.
# At 24 pixels that reads as a smudge: the letters were too small a share of
# the frame and the rule disappeared entirely. Everything here is sized for
# the worst case, then checked at it.
A = 800
av = stone(A, A, seed=3)
d = ImageDraw.Draw(av)

# A ring just inside the circular crop. A ring survives downscaling; a short
# dash does not, because it stops being a shape and becomes three grey pixels.
d.ellipse([26, 26, A - 26, A - 26], outline=BRONZE, width=16)

# Fit the monogram to the INSCRIBED CIRCLE, not the square. Sized to the
# square it looked right in the file and had its M sliced off by the crop.
mono = "RM"
clear_r = A / 2 - 26 - 16 - 22          # inside the ring, with breathing room
size = 470
while size > 120:
    f = ImageFont.truetype(ANTON, size)
    w = measure(d, mono, f, 2)
    bb = d.textbbox((0, 0), mono, font=f)
    h = bb[3] - bb[1]
    if math.hypot(w / 2, h / 2) <= clear_r:
        break
    size -= 6
track(d, ((A - w) / 2, (A - h) / 2 - bb[1]), mono, f, BONE, 2)
print(f"  monogram fitted at {size}pt inside the circular crop")

# Show it as it will actually appear: masked to a circle.
mask = Image.new("L", (A, A), 0)
ImageDraw.Draw(mask).ellipse([0, 0, A, A], fill=255)
out = Image.new("RGB", (A, A), (0, 0, 0))
out.paste(av, (0, 0), mask)
out.save("brand/avatar_800.png")

# the hard check: two readable letters at comment size
sizes = (24, 48, 88)
pad = 16
strip = Image.new("RGB", (sum(sizes) + pad * (len(sizes) + 1), max(sizes) + pad * 2), (24, 24, 24))
x = pad
for px in sizes:
    t = out.resize((px, px), Image.LANCZOS)
    strip.paste(t, (x, (strip.height - px) // 2))
    x += px + pad
strip.resize((strip.width * 3, strip.height * 3), Image.NEAREST).save("brand/avatar_small_test.png")

# ---------- banner: 2048x1152, safe area 1235x338 centred ----------
W, H = 2048, 1152
bn = stone(W, H, seed=11)
d = ImageDraw.Draw(bn)

# a slow vignette so the centre carries the type
vig = Image.new("L", (W, H), 0)
vd = ImageDraw.Draw(vig)
vd.ellipse([-W*0.35, -H*0.9, W*1.35, H*1.9], fill=110)
bn = Image.composite(Image.new("RGB", (W, H), (34, 38, 41)), bn, vig.filter(ImageFilter.GaussianBlur(180)))
d = ImageDraw.Draw(bn)

SAFE_W, SAFE_H = 1235, 338
sx, sy = (W - SAFE_W) // 2, (H - SAFE_H) // 2

ft = ImageFont.truetype(ANTON, 132)
title = "THE ROMAN MACHINE"
tw = measure(d, title, ft, 6)
if tw > SAFE_W - 60:                       # never let the wordmark leave the safe area
    ft = ImageFont.truetype(ANTON, int(132 * (SAFE_W - 60) / tw))
    tw = measure(d, title, ft, 6)

fs = ImageFont.truetype(SERIF, 30)
sub = "HOW THE EMPIRE ACTUALLY WORKED — AND WHO PAID FOR IT"
sw = measure(d, sub, fs, 3.2)

# Lay the block out from its MEASURED height, not from guessed offsets. The
# first version put the tagline six pixels past the safe area, which on a
# phone means it is simply not there.
tb = d.textbbox((0, 0), title, font=ft)
sb = d.textbbox((0, 0), sub, font=fs)
t_h, s_h = tb[3] - tb[1], sb[3] - sb[1]
RULE_H, GAP1, GAP2 = 8, 40, 34
block = t_h + GAP1 + RULE_H + GAP2 + s_h
top = sy + (SAFE_H - block) / 2

ty = top - tb[1]
track(d, (sx + (SAFE_W - tw) / 2, ty), title, ft, BONE, 6)

ry = top + t_h + GAP1
d.rectangle([sx + SAFE_W/2 - 60, ry, sx + SAFE_W/2 + 60, ry + RULE_H], fill=BRONZE)

sy_ = ry + RULE_H + GAP2 - sb[1]
track(d, (sx + (SAFE_W - sw) / 2, sy_), sub, fs, (156, 166, 169), 3.2)

assert top >= sy and (ry + RULE_H + GAP2 + s_h) <= sy + SAFE_H, "block escapes the safe area"

bn.save("brand/banner_2048.png")

# what the phone/TV crops actually leave visible
prev = bn.copy()
pd = ImageDraw.Draw(prev, "RGBA")
pd.rectangle([0, 0, W, sy], fill=(210, 40, 40, 90))
pd.rectangle([0, sy + SAFE_H, W, H], fill=(210, 40, 40, 90))
pd.rectangle([0, sy, sx, sy + SAFE_H], fill=(210, 40, 40, 90))
pd.rectangle([sx + SAFE_W, sy, W, sy + SAFE_H], fill=(210, 40, 40, 90))
prev.save("brand/banner_safearea_check.png")
print("avatar 800x800, banner 2048x1152, safe area 1235x338 — written to brand/")
