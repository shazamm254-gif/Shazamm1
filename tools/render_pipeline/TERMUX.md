# Running this on Android / Termux

**Honesty note up front:** the pipeline has been adapted for Termux and the
portability fixes are tested (font fallback, dependency check, low-power
settings), but it has **not been executed inside Termux itself** — that is a
different OS, CPU architecture, and package manager than the machine it was
built on. Package names below are from Termux's documented repositories.
Expect one or two things to need adjusting; the failure messages are written
to tell you what is wrong.

---

## 1. Install the system packages

```bash
pkg update && pkg upgrade
pkg install python ffmpeg espeak-ng
```

`ffmpeg` does the video work and `espeak-ng` is the free offline narrator.
If `espeak-ng` is unavailable in your repo, try `pkg install espeak` — the
provider calls the `espeak-ng` binary, so either symlink it or set
`TTS_PROVIDER` to a cloud voice instead.

## 2. Install the Python packages

```bash
pip install openpyxl Pillow python-dotenv requests
```

If `Pillow` fails to build, install its image libraries first:

```bash
pkg install libjpeg-turbo libpng zlib
pip install Pillow
```

**Skip `openai` unless you need it.** That package pulls in `pydantic-core`,
which is Rust and often has no prebuilt wheel for Termux — pip will try to
compile it, which needs `pkg install rust binutils` and can take a long time
on a phone. You only need it for `--image-provider openai` or
`--tts-provider openai`. **ElevenLabs is the lighter path on a phone**: it
uses plain `requests`, no compiled dependencies at all.

## 3. Get at your files

```bash
termux-setup-storage
```

Grant the permission prompt. Your phone's shared storage then appears at
`~/storage/shared`, so your own images and the finished videos are reachable
from normal Android apps:

```bash
# images you dropped in via your gallery/file manager
--image-dir ~/storage/shared/Download/my_images

# render somewhere your gallery can see
--video-dir ~/storage/shared/Movies/shorts
```

## 4. Use the low-power settings

```bash
export SUPERSAMPLE=1.0     # cheapest Ken Burns sampling
export FPS=24              # fewer frames to encode
```

Or put them in `.env`. Both are new knobs added specifically for phone use.

**What they actually buy you, measured honestly:** on a 4-core x86 box, one
video went from 62s to 51s — about **17% faster**, not the 2.4× that the
isolated zoom benchmark suggested. The zoom is only one stage of the
pipeline; narration, captions, compositing, and muxing are unaffected. At the
zoom range used here (max 1.18×) the quality difference is very hard to see,
so the setting is close to free — just don't expect it to transform the run
time.

## 5. Keep it alive during a batch

Android aggressively kills background processes, and a long render is
exactly the kind of thing it kills.

```bash
pkg install termux-api
termux-wake-lock              # prevents CPU sleep
# ... run your render ...
termux-wake-unlock
```

Keep Termux in the foreground, screen on, and the phone plugged in and cool.
Thermal throttling will slow a sustained render considerably, and a phone
that gets hot will slow itself down rather than fail loudly.

## 6. Render in small batches

This is the single most important piece of advice on this page.

```bash
python3 render_all.py --sheet YourSheet.xlsx --video-dir ~/storage/shared/Movies/shorts \
    --image-provider local --image-dir ~/storage/shared/Download/my_images \
    --fit contain --limit 5
```

**Use `--limit 5`, not `--limit 50`.** Rendering all fifty in one go took 45
minutes on a desktop; on a phone, expect it to take several times that, and
a single interruption — a call, the screen locking, Android reclaiming
memory — ends the run. `render_all.py` saves progress to the spreadsheet
after *every* video, so small batches resume exactly where they stopped. Run
`--limit 5` ten times over a couple of days and you lose nothing if one is
interrupted.

## 7. Storage

Intermediates are now deleted automatically after each video (~9.6MB per
video, so ~480MB across fifty if they were kept). Finished output is roughly
2.5MB per video plus a thumbnail.

Set `KEEP_BUILD=1` only when debugging a specific video's shots.

---

## If something breaks

**`ffmpeg: not found`** — the pipeline checks for this at startup and tells
you the install command. `pkg install ffmpeg`.

**Captions look plain/blocky** — no TrueType font was found, so Pillow's
built-in bitmap font is being used. The render still completes. To fix:

```bash
pkg install fontconfig
# or point at any .ttf you have:
export FONT_BOLD=~/storage/shared/Download/SomeFont-Bold.ttf
```

You can also drop font files at `render_pipeline/assets/fonts/DejaVuSans-Bold.ttf`
and `DejaVuSans.ttf` and they will be found automatically.

**A render dies partway through a batch** — nothing is lost. Rerun the same
`render_all.py` command; it skips everything already marked Rendered.

**`No image found for .../shot_04.<ext>`** — exactly what it says. Run
`python3 list_shots.py --sheet YourSheet.xlsx --image-dir ./my_images --check`
to see every missing slot before starting a batch.

---

## Using your own voiceover

If you already have a recording, skip the spreadsheet entirely:

```bash
python3 make_video.py \
    --images ~/storage/shared/Download/my_shots \
    --voiceover ~/storage/shared/Download/vo.mp3 \
    --captions script.txt \
    --out ~/storage/shared/Movies/video.mp4
```

This is far lighter than the full pipeline — no TTS, no script building, no
`openai` dependency. On a phone it is the fastest path to a finished video.

### Audio loudness

Every render normalises the finished audio to **-14 LUFS**, which is what
YouTube normalises toward. This matters more than it sounds: YouTube only
turns loud audio *down*, never quiet audio up, so a voiceover exported at
-24 LUFS stays quieter than everything around it in the feed permanently.
Pass `--loudness 0` to keep your source levels untouched.

### If your images already have text in them

Panels that come with their own burned-in text need two extra flags, and
without them the result looks fine on your computer and wrong on YouTube:

```bash
python3 make_video.py \
    --images ./panels --voiceover vo.mp3 \
    --srt beats.srt --no-captions \
    --fit contain --pad '#0b0b0d' --safe-area --gentle --sharpen 1.0 \
    --out video.mp4
```

**`--safe-area`** keeps the image out of the region the Shorts interface
covers — the title and description strip along the bottom, the like/comment
/share buttons down the right, and the top bar. Centring a panel in the full
1080x1920 frame puts its lowest line of text underneath the video title,
where nobody ever sees it. Measured on the first two videos built this way,
content was running **150px and 167px** under the interface before this flag
existed.

**`--gentle`** replaces the push-ins and pans with a very slight drift. Two
reasons. A hard zoom makes burned-in type crawl and shimmer, especially when
the source panel is small and being upscaled. More importantly it fights
`--safe-area`: the zoom enlarges the frame about its centre, so the image
has to start *smaller* to leave room to grow into. At the default 1.18x zoom
a 4:5 panel is capped at 788px wide; with `--gentle` it is 894px. Same
safety, noticeably bigger picture.

`--safe-area` requires `--fit contain` — with `cover` the image is cropped to
fill the frame, so there is no margin to keep clear. The script exits saying
so rather than silently ignoring the flag.

`--pad` is optional. Without it the margin fills with a heavily blurred,
dimmed copy of the panel, so its own colour continues to the frame edge and a
4:5 panel reads as a 9:16 composition instead of a letterboxed one. Use
`--pad '#0b0b0d'` only if you actually want flat bars.

**If your images are already 9:16**, skip all of this and use `--fit cover`:
they fill the frame exactly and nothing needs protecting except the captions,
which are lifted clear automatically.

Add `--no-captions` whenever the text is already in the images, or you will
have two layers of text on screen at once. Keep passing `--srt` even so: the
timings are still used to cut the shots on the spoken lines, and `--shot-map`
needs them.
