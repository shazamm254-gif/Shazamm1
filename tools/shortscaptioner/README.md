# ShortsCaptioner

Burn viral-style animated captions onto a vertical 9:16 video — the look used
across YouTube Shorts, Reels and TikTok: 2-4 words on screen at a time, heavy
all-caps font, thick black outline, and the word currently being spoken flipping
to a bright highlight colour as it's said.

Cards **spring in** with a scale-and-fade, and each word **kicks above its
resting size** the instant it's spoken. Feed it several clips and it joins them
with a **crossfade** first, then captions the result as one timeline.

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
| `renderer.py` | Groups words into caption cards, draws and animates each card with Pillow, joins multiple clips with transitions, and streams frames through ffmpeg to an MP4 with the original audio re-attached. |

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

# Check the *motion* — a contact sheet of the card springing in
python app.py -f BebasNeue-Regular.ttf --still motion.png --still-frames 6

# Several clips, joined with a crossfade, then captioned as one timeline
python app.py -i hook.mp4 body.mp4 cta.mp4 -f Anton-Regular.ttf \
              --transition crossfade --transition-duration 0.4 -o final.mp4

# Better accuracy on fast or accented speech
python app.py -i clip.mp4 -f Montserrat-Black.ttf --model small --language en
```

### Presets

`--preset` sets a starting look; any flag you pass explicitly overrides it.

| Preset | Highlight | Look | Motion |
|---|---|---|---|
| `hormozi` *(default)* | `#FFDE59` yellow | Recolour the active word. | Card springs from 0.72×; word rests at 1.12×, peaks at 1.20×. |
| `neon` | `#39FF14` green | Same, louder. | Card springs from 0.62×; word rests at 1.15×, peaks at 1.26×. |
| `boxed` | `#39FF14` green | Active word sits in a filled rounded box, text knocked out to black. | Restrained — a moving box is busy enough. |
| `clean` | white | No colour swap, sits lower on the frame. Plain subtitles. | Barely any: a gentle fade in, no word bounce. |

## Motion

Two animations run on every card, both driven off the audio timestamps rather
than a frame counter, so they look identical at 24, 30 or 60 fps.

**Card pop-in.** A new card scales up from `--pop-in-from` (0.72 by default)
over `--pop-in-duration`, on an ease-out-back curve that carries it just past
full size before it settles. It fades in at the same time, over the first half
of the pop. The whole card scales about the caption anchor, so a two-line card
doesn't drift sideways on its way in.

**Word bounce.** The moment a word goes active it jumps to
`--pop-scale` **+** `--word-bounce` and decays back to `--pop-scale` over
`--word-bounce-duration`. The resting scale is the 10-15% size jump that makes
the active word read; the bounce is the short transient on top that makes the
jump feel like a bounce rather than a step. Push `--word-bounce` much past 0.10
and it goes cartoonish.

Tune it against a contact sheet instead of re-encoding video each time:

```bash
python app.py -f Anton-Regular.ttf --still motion.png --still-frames 6 \
              --pop-in-from 0.5 --word-bounce 0.12
```

`--no-animation` renders the old static captions; `--no-pop-in` keeps the word
bounce but drops the card entrance.

## Joining several clips

Pass more than one `--input` and they're concatenated *before* captioning, so
the transcript covers one continuous timeline. Captioning each clip separately
would restart word timings at every cut and lose any sentence that straddles
one.

```bash
python app.py -i a.mp4 b.mp4 c.mp4 -f Anton-Regular.ttf \
              --transition fadeblack --transition-duration 0.3 -o out.mp4
```

Clips are normalised to one size, frame rate and audio format first — xfade and
concat both refuse mismatched inputs, and clips shot on different devices
essentially never match. Mismatched clips are letterboxed rather than stretched,
and a clip with no audio track gets a silent one so the audio graph stays
uniform.

`--transition` takes `cut` (a hard cut, no blending), `crossfade`, `fadeblack`,
`fadewhite`, `dissolve`, `slideleft`, `slideright`, `wipeleft`, `wipeup`,
`circleopen` or `smoothleft`. A transition longer than the shortest clip is
trimmed to fit, with a warning. Add `--keep-joined` to keep the joined-but-
uncaptioned video for inspection.

### Flags worth knowing

| Flag | Default | Notes |
|---|---|---|
| `--highlight-color` | `#FFDE59` | `#RRGGBB`, `R,G,B`, or a name (`yellow`, `neon`, `pink`, `cyan`, …). |
| `--max-words` | 3 | Words per caption card. 2 for punchy hooks, 4 for dense narration. |
| `--position` | 0.55 | Vertical centre as a fraction of height. `0.5` is dead centre; keep it under ~0.75 so the platform UI doesn't cover it. |
| `--font-size` | auto | Auto is ~9.5% of frame width (≈103px at 1080p). |
| `--stroke-width` | auto | Auto is ~4.5% of the font size (≈5px at 1080p). |
| `--pop-scale` | 1.12 | Resting size of the active word. `1.0` disables it. |
| `--word-bounce` | 0.08 | Extra scale kicked on at the moment a word goes active, on top of `--pop-scale`. `0` disables the bounce. |
| `--pop-in-from` | 0.72 | Scale a new card starts at. Lower is a bigger entrance. |
| `--pop-in-duration` | 0.18 | Seconds for a card to spring to full size. |
| `--no-animation` | — | Static captions — no pop-in, no bounce. |
| `--transition` | `crossfade` | How to join multiple `--input` clips. `cut` for hard cuts. |
| `--transition-duration` | 0.5 | Transition length in seconds. |
| `--still-frames N` | 1 | Make `--still` a contact sheet of N frames across the animation. |
| `--model` | `base` | `tiny` → `large-v3`. `base` is fine for clear speech; `small` is the best accuracy-per-second trade. |
| `--transcript` | — | Loads this JSON if it exists, writes it if it doesn't. Use it on every run. |
| `--preview N` | — | Render only the first N seconds. |
| `--no-uppercase` | — | Keep the original casing. |
| `--crf` | 18 | x264 quality, lower is better. 18 is visually lossless-ish; 23 halves the file. |

Full list: `python app.py --help`.

## Performance

Roughly real-time at 1080×1920 on a laptop CPU — a 60-second Short takes about a
minute to render, plus transcription. Animation costs about 20% of that
throughput; `--no-animation` buys it back. Four things keep it fast:

- Animation phases are **quantised and cached**, keyed by (card, active word,
  bounce phase, pop-in phase). A card that sits on screen for 40 frames still
  only rasterises a handful of distinct images.
- The number of phases is capped by **how many frames the animation actually
  spans**. A 0.13s bounce at 30 fps is 4 frames, so it renders 4 phases —
  rendering 6 would mean throwing two away.
- The drop shadow is drawn and blurred as a **single-channel mask** rather than
  full RGBA. The shadow is pure black, so only its alpha carries information,
  and blurring is the most expensive step in rasterising a card. Worth ~3×.
- Frames stream through ffmpeg over pipes rather than being decoded into memory,
  so peak memory doesn't grow with clip length. Overlay caches are bounded, so
  neither does the cache.

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

**The motion looks twitchy** — most often `--word-bounce` is too high for the
font. Heavy wide faces (Anton, Montserrat Black) carry less bounce than
condensed ones. Drop it to 0.05, or set it to 0 and let `--pop-scale` alone do
the work. Check with `--still-frames 6` before re-encoding.

**Words are spaced too far apart** — the layout reserves room for the bounce
peak so a growing word never collides with its neighbour, which widens the gaps.
Lower `--word-bounce` and `--pop-scale` and the gaps close up.

**Joining clips fails or the transition lands in the wrong place** — the offsets
are computed from each clip's duration, so a file with no readable duration is
rejected with the ffmpeg command to fix it. Variable-frame-rate clips are the
usual culprit; re-encode them to CFR first.

## Notes

- The tool captions whatever aspect ratio you give it, but warns if the source
  isn't 9:16 — crop to 1080×1920 before captioning so the text lands where you
  expect.
- Audio is copied through and re-encoded to AAC 192k. A source with no audio
  track renders fine, silently.
- Output is H.264 in an MP4 with `+faststart`, which is what every short-form
  platform wants.
