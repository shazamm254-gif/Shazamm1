#!/usr/bin/env python3
"""
Replace text that is baked into a photograph, measured rather than guessed.

Generated "evidence" images invent every checkable detail, and on a
channel whose whole premise is that the case is real, a wrong date or a
wrong figure is worse than an ugly one. This repaints such a line in
place so the correction is invisible.

Four things make the difference between a repair and a sticker:

  TILT. Text sits on planes at their own angles, so nothing is
  axis-aligned. Each plane is straightened ONCE, every line on it is
  edited in that square space, and the result is turned back and
  composited through a mask built only from the edit boxes -- so the
  rest of the photograph never goes through a resample at all.

  WIDTH. Generated signage is often set in a face narrower than
  anything a real font family offers. Rather than approximate, the type
  is set at the narrowest width the variable font has and squeezed the
  rest of the way by the exact factor that makes the OLD string render
  at the width it actually occupies. Slanted lettering is sheared by
  the slant measured off the glyphs it replaces.

  ERASING. A flat fill of the average paper colour reads as a patch,
  because paper has a gradient across it. Each lit pixel is rebuilt by
  interpolating across its own row from the clean paper either side.

  WEIGHT. The original type has black cores with grey anti-aliased
  rims; a flat mid-grey fill reads as washed out however well it is
  blurred. Fill and blur are therefore chosen together, by search,
  against the ink mass, mean tone and variance-of-Laplacian of the type
  the replacement is joining.

Two placement modes. 'baseline' sets the new string on the measured
baseline at the measured cap height, which is right when the old and
new strings have different shapes. 'bbox' fits the new ink box straight
onto the old one, which is more exact when the two strings share a
pattern -- dd/dd/dddd before and after puts the slashes that set the
box's top and bottom in the same places.
"""

import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONT = '/usr/share/fonts/Archivo-var.ttf'
SS = 4                      # supersample before the squeeze
PAD = 7                     # paper either side, for the erase to draw on


def sharpness(gray):
    from numpy.lib.stride_tricks import sliding_window_view
    k = np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]], float)
    if min(gray.shape) < 4:
        return 0.0
    return float(((sliding_window_view(gray, (3, 3)) * k).sum(axis=(2, 3))).var())


def measure(gray, x0, x1, y0, y1):
    """Cap height, baseline, extent and ink tone of a token, from pixels.

    Per-column extremes, not the box's outer bounds: a comma or a slash
    dips below the baseline, and letting it set the baseline would push
    the whole replacement up by its own descender."""
    sub = gray[y0:y1 + 1, x0:x1 + 1]
    ink = sub < 110
    tops, bots = [], []
    for c in range(ink.shape[1]):
        rs = np.where(ink[:, c])[0]
        if rs.size:
            tops.append(rs[0]); bots.append(rs[-1])
    xs = np.where(ink.any(axis=0))[0]
    base = y0 + int(np.percentile(bots, 75))
    ys = np.where(ink.any(axis=1))[0]
    return dict(top=y0 + int(np.percentile(tops, 10)), base=base,
                cap=base - y0 - int(np.percentile(tops, 10)),
                left=x0 + xs.min(), width=xs.max() - xs.min() + 1,
                ink_top=y0 + ys.min(), ink_h=ys.max() - ys.min() + 1,
                ink=int(round(sub[ink].mean())))


def limits(gray, x0, x1, y0, y1, reach=60):
    """How far either side of a token the erase may go.

    Two things stop it. The neighbouring word: rubbing out three pixels
    of the em dash next to "PM" and not drawing them back leaves a
    shortened dash. And the edge of the paper: "WV" is wider than the
    "PA" it replaces, and left to itself the erase runs off the ticket
    and paints paper tone over the red string behind it."""
    def scan(step):
        edge = x1 if step > 0 else x0
        lim = edge
        for d in range(2, reach):
            x = edge + step * d
            if not 0 <= x < gray.shape[1]:
                break
            col = gray[y0:y1 + 1, x]
            if col.min() < 110 or np.median(col) < 150:
                break
            lim = x
        return lim - 2 if step > 0 else lim + 2
    return scan(-1), scan(1)


def _font(cap_px, axes):
    fs = 8
    while fs < 600:
        f = ImageFont.truetype(FONT, fs + 1)
        f.set_variation_by_axes(list(axes))
        bb = f.getbbox('0')
        if bb[3] - bb[1] > cap_px:
            break
        fs += 1
    f = ImageFont.truetype(FONT, fs)
    f.set_variation_by_axes(list(axes))
    return f


def ink_box(text, shear, axes, size=140):
    """The text sheared and cropped to its own ink, at a generous size."""
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_axes(list(axes))
    bb = f.getbbox(text)
    W, H = int(bb[2] - bb[0]) + 600, size * 4
    im = Image.new('L', (W, H), 0)
    base = int(H * 0.6)
    ImageDraw.Draw(im).text((300 - bb[0], base), text, font=f,
                            fill=255, anchor='ls')
    if shear:
        im = im.transform((W, H), Image.AFFINE,
                          (1, shear, -shear * base, 0, 1, 0),
                          resample=Image.BICUBIC)
    a = np.asarray(im)
    ys, xs = np.where(a > 40)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def layer(text, cap, shear, squeeze, axes):
    """An alpha layer of `text`: cap height `cap`, sheared, then squeezed.

    Also returns where the ink starts and where the baseline sits inside
    it, so the caller can land it exactly on the line it joins."""
    f = _font(cap * SS, axes)
    bb = f.getbbox(text)
    pad = int(80 * SS + abs(shear) * cap * SS * 2)
    W = int(bb[2] - bb[0]) + pad * 2
    H = cap * SS * 3
    base_y = int(H * 0.72)
    im = Image.new('L', (W, H), 0)
    ImageDraw.Draw(im).text((pad - bb[0], base_y), text, font=f,
                            fill=255, anchor='ls')
    if shear:
        # Lean the glyphs about their own baseline, so the feet stay put.
        im = im.transform((W, H), Image.AFFINE,
                          (1, shear, -shear * base_y, 0, 1, 0),
                          resample=Image.BICUBIC)
    a = np.asarray(im)
    xs = np.where((a > 40).any(axis=0))[0]

    sx = squeeze / SS
    out = im.resize((max(1, round(W * sx)), max(1, round(H / SS))),
                    Image.LANCZOS)
    return out, (xs.max() - xs.min() + 1) / SS, xs.min() * sx, base_y / SS


def edit_plane(img, ang, centre, shear, mode, axes, edits):
    """Straighten one plane, rewrite its lines, and put it back."""
    D = img.rotate(ang, resample=Image.BICUBIC, center=centre)
    arr = np.asarray(D).astype(np.int16).copy()
    gray = np.asarray(D.convert('L')).astype(float)

    plan = []
    for x0, x1, by0, by1, old, new, *rest in edits:
        opt = rest[0] if rest else {}
        m = measure(gray, x0, x1, by0, by1)
        m['cap'] = max(4, round(m['cap'] * opt.get('cap_scale', 1.0)))
        m['lo'], m['hi'] = limits(gray, m['left'],
                                  m['left'] + m['width'] - 1, by0, by1)
        if mode == 'bbox':
            # Fit the new ink box onto the old one exactly.
            sq = 1.0
            box = ink_box(new, shear, axes)
            lay = box.resize((m['width'], m['ink_h']), Image.LANCZOS)
            ink_dx, base_dy, w_new = 0, m['ink_h'] - 1, m['width']
        else:
            # Normally the new string inherits the OLD string's
            # condensation, which keeps a two-digit swap identical in
            # width. But a reworded line is a different length, and
            # inheriting the old factor would just overflow: there,
            # squeeze so the NEW string fills the space instead.
            ref = new if opt.get('fit_width') else old
            _, nat_ref, _, _ = layer(ref, m['cap'], shear, 1.0, axes)
            sq = m['width'] / nat_ref
            lay, nat_new, ink_dx, base_dy = layer(new, m['cap'], shear,
                                                  sq, axes)
            w_new = round(nat_new * sq)
        room = m['hi'] - m['lo'] + 1
        if w_new > room:
            raise SystemExit(f'{new!r} needs {w_new}px, only {room}px free')
        plan.append(dict(m, by0=by0, by1=by1, new=new, lay=lay,
                         ink_dx=ink_dx, base_dy=base_dy, w_new=w_new))
        print(f"  {old!r:>14} -> {new!r:<14} cap {m['cap']:2d}px  "
              f"squeeze {sq:.2f}  width {m['width']:3d} -> {w_new:3d}  "
              f"room {room:3d}  ink {m['ink']:3d}")

    # Erase every box before drawing anything: a replacement running
    # wider than what it replaced must not be rubbed out by the erase
    # that follows it.
    boxes = []
    for p in plan:
        ex0 = max(p['left'] - PAD, p['lo'])
        ex1 = min(p['left'] + max(p['width'], p['w_new']) + PAD, p['hi'])
        ey0, ey1 = p['by0'] - 2, p['by1'] + 2
        boxes.append((ex0, ey0, ex1, ey1))
        sub = arr[ey0:ey1 + 1, ex0:ex1 + 1]
        L = sub.mean(axis=2)
        mask = L < np.percentile(L, 85) * 0.72
        for _ in range(2):                      # take the anti-aliased rim
            g = mask.copy()
            g[1:, :] |= mask[:-1, :]; g[:-1, :] |= mask[1:, :]
            g[:, 1:] |= mask[:, :-1]; g[:, :-1] |= mask[:, 1:]
            mask = g
        for r in range(sub.shape[0]):           # fill across the row, so the
            row = mask[r]                       # gradient of the paper carries
            if not row.any():                   # through instead of a flat
                continue                        # patch of the average colour
            clean = np.where(~row)[0]
            if clean.size < 2:
                continue
            bad = np.where(row)[0]
            for ch in range(3):
                sub[r, bad, ch] = np.interp(bad, clean, sub[r, clean, ch])
        arr[ey0:ey1 + 1, ex0:ex1 + 1] = sub

    D = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

    for p in plan:
        # What the type it joins actually looks like: how much ink, how
        # dark, how sharp. The original has black cores with grey
        # anti-aliased rims, so a flat mid-grey fill reads as washed out
        # however well it is blurred -- fill and blur have to be chosen
        # together, against all three numbers at once.
        o = gray[p['by0']:p['by1'] + 1, p['left']:p['left'] + p['width']]
        tgt_n = max(1, int((o < 110).sum()))
        tgt_m = float(o[o < 110].mean())
        tgt_s = sharpness(o.copy())

        x_ink = min(p['left'], p['hi'] - p['w_new'] + 1)
        px = round(x_ink - p['ink_dx'])
        py = (p['ink_top'] if mode == 'bbox'
              else round(p['base'] + 1 - p['base_dy']))

        wx0, wy0 = max(0, px - 12), max(0, py - 12)
        wx1 = min(D.size[0], px + p['lay'].size[0] + 12)
        wy1 = min(D.size[1], py + p['lay'].size[1] + 12)
        win = D.crop((wx0, wy0, wx1, wy1))
        alpha0 = Image.new('L', win.size, 0)
        alpha0.paste(p['lay'], (px - wx0, py - wy0))
        sx, sy = p['left'] - wx0, p['by0'] - wy0

        best = None
        for fill in range(0, 53, 4):
            colour = Image.new('RGB', win.size, (fill, fill, fill))
            for blur in [round(0.1 * i, 1) for i in range(1, 14)]:
                cand = Image.composite(
                    colour, win, alpha0.filter(ImageFilter.GaussianBlur(blur)))
                a = np.asarray(cand.convert('L')).astype(float)[
                    sy:sy + (p['by1'] - p['by0'] + 1), sx:sx + p['w_new']]
                ink = a < 110
                if not ink.any():
                    continue
                err = (abs(ink.sum() / tgt_n - 1)
                       + abs(a[ink].mean() - tgt_m) / 60.0
                       + abs(sharpness(a) / max(tgt_s, 1e-6) - 1))
                if best is None or err < best[0]:
                    best = (err, fill, blur, cand)
        err, fill, blur, cand = best
        D.paste(cand, (wx0, wy0))
        print(f"  drew {p['new']!r:<14} at x{px},y{py}  "
              f"fill {fill:2d}  blur {blur:.1f}  fit {err:.2f}")

    B = D.rotate(-ang, resample=Image.BICUBIC, center=centre)
    m = Image.new('L', img.size, 0)
    md = ImageDraw.Draw(m)
    for ex0, ey0, ex1, ey1 in boxes:
        md.rectangle([ex0, ey0 - 2, ex1, ey1 + 2], fill=255)
    m = m.rotate(-ang, resample=Image.BICUBIC, center=centre)

    out = img.copy()
    out.paste(B, (0, 0), m.filter(ImageFilter.GaussianBlur(1.0)))
    return out


def repaint(src, out, groups, quality=96):
    """Apply every group of edits to `src` and write `out`."""
    orig = Image.open(src).convert('RGB')
    img = orig
    for i, g in enumerate(groups, 1):
        print(f"plane {i}: tilt {g['ang']} deg, slant "
              f"{math.degrees(math.atan(g.get('shear', 0.0))):.0f} deg")
        img = edit_plane(img, g['ang'], g['centre'], g.get('shear', 0.0),
                         g.get('mode', 'baseline'),
                         (g.get('wght', 760), g.get('wdth', 62)), g['edits'])
    img.save(out, quality=quality, subsampling=0)

    changed = (np.abs(np.asarray(img).astype(int)
                      - np.asarray(orig).astype(int)).sum(axis=2) > 12)
    print(f"-> {out}  {changed.sum()} px changed "
          f"({100 * changed.mean():.2f}% of the frame)")
    return img
