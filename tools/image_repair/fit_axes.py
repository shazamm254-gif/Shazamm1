"""Pick the variable-font axes that match type already in a photograph.

Width and weight trade off against each other once the render is forced
to the right box, so neither ink mass nor bbox alone can separate them.
Mask overlap can: it only scores well when the stems land where the
original's stems are."""
import numpy as np
from PIL import Image, ImageDraw, ImageFont
FONT = '/usr/share/fonts/Archivo-var.ttf'


def fit(gray, x0, x1, y0, y1, text, shear=0.0, wd_range=range(62, 126, 4),
        wg_range=range(300, 901, 50)):
    tgt = gray[y0:y1 + 1, x0:x1 + 1] < 110
    ys, xs = np.where(tgt)
    tgt = tgt[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    TH, TW = tgt.shape
    out = []
    for wd in wd_range:
        for wg in wg_range:
            f = ImageFont.truetype(FONT, 140)
            f.set_variation_by_axes([wg, wd])
            bb = f.getbbox(text)
            W, H = int(bb[2] - bb[0]) + 600, 560
            im = Image.new('L', (W, H), 0)
            ImageDraw.Draw(im).text((300 - bb[0], 380), text, font=f,
                                    fill=255, anchor='ls')
            if shear:
                im = im.transform((W, H), Image.AFFINE,
                                  (1, shear, -shear * 380, 0, 1, 0),
                                  resample=Image.BICUBIC)
            a = np.asarray(im)
            yy, xx = np.where(a > 40)
            c = im.crop((xx.min(), yy.min(), xx.max() + 1, yy.max() + 1))
            m = np.asarray(c.resize((TW, TH), Image.LANCZOS)) > 110
            out.append((round(float((m & tgt).sum() / (m | tgt).sum()), 4), wd, wg))
    out.sort()
    return out[-5:]
