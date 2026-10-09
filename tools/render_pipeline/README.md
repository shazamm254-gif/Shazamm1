# The render pipeline

Everything that turns a script, a voiceover and a pile of generated assets
into a finished Short. Build order is roughly:

```
script ──> voiceover (yours) ──> master_vo ──> fill_dead_air
                                      │
       assets (yours) ────────────────┤
                                      v
                        make_video / make_video_clips  ──> .mp4 + .shots.json
                                      │
                      transitions plan ──> transitions apply
                                      │
                           burn_captions
                                      │
                           overlay_cards
```

Each stage is a separate script on purpose. A render is forty minutes of
encoding and the thing that goes wrong is never the stage you were working
on, so being able to redo the captions without rebuilding the picture is
the difference between an afternoon and a week.

## Verified, or just built

A tool is **verified** here only once it has run end to end on a real
episode that shipped or was delivered. Everything else is **built** — the
code exists and was tested as it was written, but no finished video has
been through it, so assume nothing about it.

This distinction is kept honest deliberately. A list that calls everything
"done" is a list you have to re-check from scratch the first time something
breaks.

### Verified

| Tool | What it does | Ran on |
|---|---|---|
| `make_video.py` | Builds a Short from stills and a voiceover. Ken Burns per shot, shot map from the SRT, music bed, loudness. | Money Autopsy 001, Gardner heist |
| `make_video_clips.py` | The same, from generated clips instead of stills. Cuts clips to the beat, holds the last frame rather than stretching, offsets repeat uses. Mixes stills in. | Lion vs Tiger |
| `master_vo.py` | Lands any read on 48 kHz / −14 LUFS / ≤ −1 dBTP, with the shortfall handed to the limiter over up to four measured passes. | Lion vs Tiger |
| `fill_dead_air.py` | Repairs the digital-silence splices a chunk-assembled TTS read has between segments, with room tone taken from the read itself. | Gardner heist |
| `make_music.py` | Generates an ambient, pulse or minimal bed in a given key, standard library only. | Gardner heist, Lion vs Tiger |
| `burn_captions.py` | Phrase-chunk captions through libass, break points solved by DP rather than counted, one accent colour on the power words, contrast measured against the frames behind them. | Gardner heist, Lion vs Tiger |
| `verify_captions.py` | Checks a caption pass: timing against the read, words per card, and where the glyphs actually landed. | Lion vs Tiger |
| `transitions.py` | Finds the act breaks in the voiceover, suggests one transition each, renders them without changing the running time. | Lion vs Tiger |
| `verify_transitions.py` | Checks a transition pass: placement on real pauses, count, runtime, and a per-pixel test for frame blending between generated clips. | Lion vs Tiger |
| `ffprobe_shim.py` | Stands in for ffprobe where only ffmpeg is installed. Answers the three queries the pipeline asks. | Every build in this container |
| `pipeline/assemble.py` | The shared library the builders call: segment prep, Ken Burns, concat, loudness, the shot list. | As above |

### Built, not verified

| Tool | What it is meant to do |
|---|---|
| `beat_grid.py` | Find a track's tempo and beat grid with numpy only. |
| `declick_pauses.py` | Remove the clicks a chunk-assembled voiceover has at every pause. (`fill_dead_air.py` exists because the Gardner read's defect turned out to be the *absence* of room tone, not a click — a different problem, and fades do not fix it.) |
| `level_lines.py` | Even out a voiceover whose lines were rendered at different levels. |
| `list_shots.py` | Build the folder skeleton and manifest for supplying your own images. |
| `make_captions.py` | Draft an SRT from a voiceover with the cuts on the breaths. |
| `overlay_cards.py` | Burn small source/context cards onto a finished video. |
| `render_all.py` | Render every unrendered row of a content-system xlsx in rank order. |
| `render_one.py` | Render a single row of that xlsx by rank. |

Word timings come from `../shortscaptioner_bridge/` — see its own README for
which of those are trustworthy on which voices.

## Captions

```bash
python3 burn_captions.py --video v.mp4 --words words.json --out v-cap.mp4 \
    --style bold-impact --position lower-third --accent '#FFD60A' --upper
python3 verify_captions.py --ass v-cap.ass --words words.json --video v-cap.mp4
```

Styles are `bold-impact` (Archivo Narrow, heavy, thick black stroke) and
`clean` (Archivo, medium, soft shadow plus a thinner stroke — a shadow
alone disappears against a bright frame). Positions are `lower-third`
(default), `center` and `upper-third`.

**One accent colour per episode.** Word-by-word colour is the fastest way
to make a caption unreadable; the accent works because it is rare. Which
words get it:

- anything with a digit in it;
- numbers spelled out, which is most of them — the scripts write every
  figure as words so the voice reads it correctly, so "four hundred and
  twenty pounds" has no digit anywhere, and "for thousands of years" is a
  figure too. A hyphenated compound counts when it *opens* with a cardinal:
  "fifty-five-year-old" is a number, "first-hand" is not;
- capitalised words away from a sentence start, so "into eastern India"
  is a name and "Lions are the only cat" is not;
- a configurable superlative list (`biggest`, `only`, `never`, `first`…);
- the script's closing sentence, the verdict, whether or not a heuristic
  fires on it;
- anything in `--keywords FILE`, one word or phrase per line, which always
  wins.

Every accented card is checked against the frames it sits on. #FFD60A has a
relative luminance of 0.69, so on a white wall it is a contrast ratio of
1.4 — the outline still holds the letter shapes, but the accent has stopped
meaning anything. Cards under `--contrast-min` (3.0, the WCAG large-text
bar) go out in plain white.

Hard rules the code enforces: four words a card maximum, and captions clear
the Shorts interface — 320px at the bottom, 90px at the top, and 150px at
the right for the like/share rail, which sits *above* the bottom strip and
is the one people forget.

## Transitions

```bash
python3 transitions.py plan  --words words.json --shots v.shots.json --out plan.json
#   ... edit plan.json by hand: pick from the library, or set hard-cut ...
python3 transitions.py apply --video v.mp4 --plan plan.json --out v-t.mp4
python3 verify_transitions.py --before v.mp4 --after v-t.mp4 \
    --plan plan.json --words words.json
```

The builders write `<out>.shots.json` next to the video: where every cut
landed, measured off the built segments, and whether each shot is a
generated clip or a still.

Act breaks are read off the voiceover, not chosen. A Short cuts twenty or
thirty times a minute and almost all of those cuts are just the picture
keeping up with the narration — dressing them up makes the viewer watch the
software instead of hearing the sentence. The places a script actually
turns are the places the voice stops, so a transition is only ever offered
where a pause of 0.6 s or more lines up with a cut that already exists.

The library, and nothing else:

| | |
|---|---|
| `hard-cut` | The default, and the right answer nearly everywhere. |
| `whip-pan` | Directional smear and slide, ≤ 8 frames. |
| `zoom-punch` | 110–118% on the incoming shot, settling, ≤ 6 frames. |
| `flash` | 2–3 frames toward white. For verdict reveals. |
| `masked-wipe` | Hard-edged directional wipe. The only transition allowed between two generated clips. |

Intensity is `off`, `subtle` (default) or `standard`.

**None of the five changes the running time.** The picture is locked to the
narration; a transition that borrowed six frames of overlap would walk
every later shot out of sync with the voice. So each one works on the
frames that are already there — the outgoing frames smear, or the incoming
arrive zoomed, or one held frame is wiped off the top. Frames in equals
frames out, and `verify_transitions.py` counts them.

**No cross-dissolve exists here at all.** Hold two generated frames on top
of each other at 50% and the hands and the fur stop being able to decide
where they are. Between two clips the only options are a hard cut and the
wipe, and the verifier proves it per pixel: every pixel of every frame in
the window has to match the held outgoing frame or the incoming one, whole.
A dissolve fails that on most of the frame.

Also enforced: never two transitions on consecutive cuts, and at most one
per act break.
