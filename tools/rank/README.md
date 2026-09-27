# rank.sh

Builds a YouTube Shorts countdown video from five clips.

```bash
./rank.sh <folder>
```

## What goes in the folder

**Five clips**, named `<rank>_<label>.mp4`. The label is whatever should
appear on screen, spaces and all:

```
5_Raccoon Cashier.mp4
4_Goose Security.mp4
3_Pigeon Air Traffic Control.mp4
2_Otter Locksmith.mp4
1_Cat Surgeon.mp4
```

`.mov`, `.m4v`, `.webm` and `.mkv` work too.

**`title.txt`**, two lines:

```
RANKING ANIMALS
DOING HUMAN JOBS
```

**`trims.txt`** (optional) — one line per override, `rank start duration`:

```
5 1.5 6
3 0.2 4
```

Anything not listed uses the default: skip the first **1.0s**, keep **6.0s**.
A clip too short for its window is clamped to what it has, with a warning.

**`voiceover.mp3`** (optional) — mixed on top, with the clip audio dropped to
30% wherever the voiceover is actually speaking.

## What comes out

**`final.mp4`** — 1080×1920, 30fps, H.264 / yuv420p, AAC 192k, faststart,
normalised to −14 LUFS with a −1.5 dBTP ceiling.

**`contact.jpg`** — one overlaid frame from each clip, side by side. Look at
this before uploading. It exists so you can see whether the title bar or the
rank tracker is sitting on somebody's face, which is the one thing the script
can't judge for you.

## How it looks

- **Title bar** — solid white, y=60, full width, 225px tall. Line 1 black,
  line 2 `#E63946`, both 81px, centred. A title too wide to fit is shrunk
  rather than allowed to run off the edge, and the script says so.
- **Rank tracker** — rows `1.` to `5.` stacked top-down from y=318, 69px
  apart. Numbers 51px white with a 6px black border at x=33; labels 46px
  at x=99.
- **Reveal** — a label appears the moment its clip starts, in yellow
  `#FFD60A` while that clip plays, then white for the rest of the video.
  Ranks not yet reached show only their number.

Hard cuts throughout, no transitions.

## Two things worth knowing

**Labels get a black border too.** The brief only specified one on the
numbers, but the labels sit on moving video and are unreadable without it.
Set `LAB_STROKE=0` at the top of the script to take it off.

**Long labels are warned about, not fixed.** If a label overruns the frame
the script tells you by how many pixels. It won't shrink it, because a rank
tracker with five different text sizes looks broken — shorten the filename
instead.

## Knobs

All at the top of the script: `DEF_START`, `DEF_DUR`, colours, every
coordinate, `DUCK` (the 0.30), `LUFS`, `TRUE_PEAK`.

`KEEP_BUILD=1 ./rank.sh <folder>` leaves the intermediates in place if you
need to see what a stage produced.

## Requirements

`ffmpeg`, `ffprobe`, `python3` with Pillow.

Poppins Bold is downloaded to `tools/rank/fonts/` on first run. If the
download is blocked, drop the file there yourself and it will be used:

```
https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf
```

## What was tested

Five equal clips; unequal clips via `trims.txt`; a clip shorter than its
window; a voiceover with gaps; an over-long label; an over-wide title.

Verified by measurement rather than by eye: title bar lands at rows 60–285,
row spacing 67–70px against the specified 69, the yellow label tracks the
correct rank across all ten probes either side of every clip boundary
(including a clamped 3s clip), ducking measured at exactly −10.5 dB during
speech and full level in the gaps, output −14.0 LUFS.
