# Fonts

Drop `.ttf` / `.otf` files in this folder and ShortsCaptioner will find them by
name — `--font Montserrat-Black.ttf` works once the file is here, no path
needed. You can also pass a full path to a font anywhere on disk, or a bare
family stem like `--font bebasneue`.

`python app.py --list-fonts` prints every font file the tool can currently see,
including your system fonts.

## What to use

Viral captions want a **heavy, condensed, all-caps-friendly** face. Thin fonts
disappear against video no matter how thick the outline is. These are all free
and all work well:

| Font | Where | Character |
|---|---|---|
| **Montserrat Black** | [Google Fonts](https://fonts.google.com/specimen/Montserrat) — pick the Black (900) weight | The default. Wide, geometric, extremely legible. The Hormozi look. |
| **Bebas Neue** | [Google Fonts](https://fonts.google.com/specimen/Bebas+Neue) | Tall and condensed — fits more words per line. Caps-only by design. |
| **Anton** | [Google Fonts](https://fonts.google.com/specimen/Anton) | Heaviest of the three. Great for 2-word cards and hard hooks. |
| **Poppins ExtraBold** | [Google Fonts](https://fonts.google.com/specimen/Poppins) | Rounder and friendlier. Good for lifestyle and talking-head content. |
| **Oswald Bold** | [Google Fonts](https://fonts.google.com/specimen/Oswald) | Condensed like Bebas but with lowercase, if you use `--no-uppercase`. |

Impact ships with Windows and macOS and needs no download, but it's tighter and
older-looking than the options above.

## Getting one quickly

From a Google Fonts download, the file you want is inside the `static/` folder
of the ZIP — `static/Montserrat-Black.ttf`, not the variable-font file at the
top level. Variable fonts (`Montserrat[wght].ttf`) load at their default weight,
which is Regular, so the captions come out far too thin.

```bash
cd tools/shortscaptioner/fonts
curl -L -o montserrat.zip "https://fonts.google.com/download?family=Montserrat"
unzip -j montserrat.zip "static/Montserrat-Black.ttf"
rm montserrat.zip
```

Font files are gitignored — they're large and most are licensed for use, not
redistribution. Everyone working on the repo downloads their own.
