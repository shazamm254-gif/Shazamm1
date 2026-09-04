# ShortsCaptioner

Burn viral-style animated captions onto a vertical 9:16 video — the look used
across YouTube Shorts, Reels and TikTok: 2-4 words on screen at a time, heavy
all-caps font, thick black outline, and the word currently being spoken flipping
to a bright highlight colour as it's said.

Everything runs locally. No API keys, no uploads, no per-minute captioning fee.

```
python app.py --input clip.mp4 --font Montserrat-Black.ttf \
              --highlight-color "#FFDE59" --output captioned.mp4
```

## How it works

| File | Job |
|---|---|
| `app.py` | The CLI. Parses flags, resolves the font and style, and drives the other two. |
| `whisper_helper.py` | Runs faster-whisper locally, returns a clean list of words with start/end floats. Repairs the overlapping and zero-length spans Whisper sometimes emits. |
| `renderer.py` | Groups words into caption cards, draws each card with Pillow, and streams frames through ffmpeg to an MP4 with the original audio re-attached. |

The three stages are independent: `whisper_helper.py` will dump a transcript on
its own, and `renderer.py` can be imported to draw cards from any word list you
can produce.

## Install

**1. Python packages**

```bash
pip install -r requirements.txt
```

That's `faster-whisper`, `pillow` and `numpy`. MoviePy is listed as an optional
extra and is commented out — the renderer pipes frames to ffmpeg directly and
doesn't need it.

**2. ffmpeg** (a system binary, not a pip package — both `ffmpeg` and `ffprobe`
must be on your `PATH`)

```bash
brew install ffmpeg                 # macOS
sudo apt install ffmpeg             # Debian / Ubuntu
winget install Gyan.FFmpeg          # Windows
```

Verify with `ffmpeg -version`.

**3. A font**

No font ships with this tool. Download a heavy TTF and drop it in `fonts/` —
see [`fonts/README.md`](fonts/README.md) for recommendations and a one-liner to
fetch Montserrat Black. Then check what's visible:

```bash
python app.py --list-fonts
```

The first run of the captioner also downloads the Whisper model weights
(~150 MB for `base`, cached in `~/.cache/huggingface`), so give it a minute.

## Usage

```bash
# The basics — output defaults to <input>-captioned.mp4
python app.py -i clip.mp4 -f Montserrat-Black.ttf

# Dial in a style fast: cache the transcript, render only the first 8 seconds
python app.py -i clip.mp4 -f Anton-Regular.ttf --transcript clip.json \
              --preview 8 -o test.mp4

# Re-render the whole thing in a different colour — no re-transcription,
# because the transcript JSON already exists
python app.py -i clip.mp4 -f Anton-Regular.ttf --transcript clip.json \
              --highlight-color neon -o final.mp4

# Check a style without touching a video at all (writes one PNG)
python app.py -f BebasNeue-Regular.ttf --preset boxed --still preview.png

# Better accuracy on fast or accented speech
python app.py -i clip.mp4 -f Montserrat-Black.ttf --model small --language en
```

### Presets

`--preset` sets a starting look; any flag you pass explicitly overrides it.

| Preset | Highlight | Look |
|---|---|---|
| `hormozi` *(default)* | `#FFDE59` yellow | Recolour + 1.12× pop on the active word. |
| `neon` | `#39FF14` green | Same, louder. |
| `boxed` | `#39FF14` green | Active word sits in a filled rounded box, text knocked out to black. |
| `clean` | white | No colour swap, no pop, sits lower on the frame. Plain subtitles. |

### Flags worth knowing

| Flag | Default | Notes |
|---|---|---|
| `--highlight-color` | `#FFDE59` | `#RRGGBB`, `R,G,B`, or a name (`yellow`, `neon`, `pink`, `cyan`, …). |
| `--max-words` | 3 | Words per caption card. 2 for punchy hooks, 4 for dense narration. |
| `--position` | 0.55 | Vertical centre as a fraction of height. `0.5` is dead centre; keep it under ~0.75 so the platform UI doesn't cover it. |
| `--font-size` | auto | Auto is ~9.5% of frame width (≈103px at 1080p). |
| `--stroke-width` | auto | Auto is ~4.5% of the font size (≈5px at 1080p). |
| `--pop-scale` | 1.12 | How much the active word grows. `1.0` disables it. |
| `--model` | `base` | `tiny` → `large-v3`. `base` is fine for clear speech; `small` is the best accuracy-per-second trade. |
| `--transcript` | — | Loads this JSON if it exists, writes it if it doesn't. Use it on every run. |
| `--preview N` | — | Render only the first N seconds. |
| `--no-uppercase` | — | Keep the original casing. |
| `--crf` | 18 | x264 quality, lower is better. 18 is visually lossless-ish; 23 halves the file. |

Full list: `python app.py --help`.

## Performance

Roughly real-time at 1080×1920 on a laptop CPU — a 60-second Short takes about a
minute to render, plus transcription. Two things keep it there:

- Overlays are cached per (card, active word), so a 60-second clip draws a few
  hundred overlays instead of 1800, and each frame is just an alpha blend over
  the caption's bounding box.
- Frames stream through ffmpeg over pipes rather than being decoded into memory,
  so peak memory doesn't grow with clip length.

Transcription dominates the wall clock on the larger models. Pass `--transcript`
once and every later restyle skips it entirely.

## Troubleshooting

**`Font 'X' not found`** — the error lists every font file the tool can see. Pass
a full path, or put the `.ttf` in `fonts/`. If you downloaded from Google Fonts,
use the file from the ZIP's `static/` folder: the variable font at the top level
loads at Regular weight and renders far too thin.

**`ffmpeg/ffprobe were not found on your PATH`** — install ffmpeg (above). On
Windows, reopen your terminal after installing so the `PATH` change takes.

**`Whisper returned no words`** — the audio is silent, music-only, or very noisy.
Try `--model small --no-vad`; the voice-activity filter can swallow quiet speech.

**Captions drift out of sync** — usually a variable-frame-rate source (screen
recordings and phone exports do this). Normalise it first:

```bash
ffmpeg -i clip.mp4 -vsync cfr -r 30 -c:a copy clip-cfr.mp4
```

**Words are wrong** — `base` guesses on names, jargon and fast speech. Step up to
`--model small` or `--model medium`, and pass `--language en` so it doesn't
mis-detect. You can also hand-edit the `--transcript` JSON (it's a plain list of
`{text, start, end}`) and re-render — the text is used verbatim.

**Text is too big / wrapping onto three lines** — lower `--max-words` to 2, or
set `--font-size` explicitly. The `--still` flag renders a style check in about a
second, which is much faster than re-rendering video to compare.

## Notes

- The tool captions whatever aspect ratio you give it, but warns if the source
  isn't 9:16 — crop to 1080×1920 before captioning so the text lands where you
  expect.
- Audio is copied through and re-encoded to AAC 192k. A source with no audio
  track renders fine, silently.
- Output is H.264 in an MP4 with `+faststart`, which is what every short-form
  platform wants.
