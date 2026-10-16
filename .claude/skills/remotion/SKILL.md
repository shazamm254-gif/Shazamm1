---
name: remotion
description: Building and rendering short-form videos programmatically with Remotion (React-based video creation). Use when the user wants to turn a script/voiceover/image-prompt pack (e.g. docs/FIRST_10_SHORTS.md, docs/PRODUCTION-PACK.md) into an actual rendered MP4, set up a Remotion project, create/edit Compositions, add captions/animations/transitions, or run `remotion render`/`remotion studio`.
---

# Remotion Skill

Remotion (https://www.remotion.dev) lets you build videos as React components and
render them to MP4/WebM/GIF/PNG sequences from the command line. In this repo it's
the natural tool to turn the scripts in `docs/FIRST_10_SHORTS.md` /
`docs/PRODUCTION-PACK.md` into actual rendered Shorts.

## Setup

Scaffold a new Remotion project (only if one doesn't already exist — check for a
`remotion.config.ts` or a `src/Root.tsx` first):

```bash
npx create-video@latest --template=blank my-video
cd my-video
npm install
```

Key structure of a Remotion project:

```
src/
  Root.tsx        # registers all <Composition> entries
  Video.tsx       # (or per-short files) the actual composition components
public/           # static assets — audio, images, fonts; use staticFile() to reference
remotion.config.ts
```

## Core concepts

- **`<Composition>`**: registered in `Root.tsx`, defines `id`, `component`,
  `durationInFrames`, `fps`, `width`, `height`. For 9:16 Shorts use
  `width={1080} height={1920}`; `fps` typically `30`.
- **`useCurrentFrame()`**: the only way to know "where" in the timeline you are —
  drive all animation off this, never off wall-clock time or React state/effects.
- **`interpolate(frame, inputRange, outputRange, options)`**: maps frame number to a
  value (opacity, translateY, scale). Pass `extrapolateLeft/Right: 'clamp'` to avoid
  overshoot.
- **`spring({ frame, fps, config })`**: physics-based easing, good for pop-in text
  and hook animations.
- **`<Sequence from={} durationInFrames={}>`**: time-shifts and clips its children —
  use it to lay out hook / body / CTA beats one after another on a single timeline.
- **`<AbsoluteFill>`**: a full-bleed positioned div, the standard root element for a
  composition or layer (background, captions, image).
- **`staticFile('name.png')`**: resolves a path into `public/` for `<Img>`, `<Audio>`,
  `<Video>` sources — never hardcode absolute filesystem paths.
- **`<Audio src={staticFile('vo.mp3')}>`**: attach the voiceover; get its duration
  with `getAudioDurationInSeconds` (from `@remotion/media-utils`) to size
  `durationInFrames` correctly instead of guessing.

## Typical workflow for this repo

1. Pick a script from `docs/FIRST_10_SHORTS.md` (hook / voiceover / on-screen text /
   visuals per beat).
2. Generate or drop the images referenced by the prompt pack
   (`product/cosmic-ai-prompt-pack/`) into `public/`.
3. Build one `<Composition>` per Short with `<Sequence>` beats matching the script's
   timing (hook ~0-3s, body, CTA).
4. Render captions as timed `<Sequence>`-wrapped text matching the on-screen text
   column, not a separate subtitle burn-in pass, so it's easy to iterate.
5. Preview with the Studio, then render:

```bash
npx remotion studio          # interactive preview + timeline scrubbing
npx remotion render src/index.ts <composition-id> out/<short-name>.mp4
```

Useful render flags: `--codec=h264` (default, YouTube-friendly), `--concurrency`,
`--frames=0-89` to render a range while iterating, `--props` to pass JSON data
(e.g. per-short script text) into the component instead of hardcoding it.

## Gotchas

- Never use `setTimeout`/`requestAnimationFrame`/CSS transitions — Remotion renders
  frame-by-frame out of order across workers, so animation must be a pure function
  of `useCurrentFrame()`.
- `durationInFrames` must be an integer and must cover the longest audio track;
  compute it from audio duration × fps, don't eyeball it.
- Keep expensive work (image decoding, large data parsing) out of the render path
  where possible — use `calculateMetadata` on the `<Composition>` to precompute
  duration/props once instead of on every frame.
- When rendering vertical 1080x1920 at 30fps for Shorts, keep individual videos
  under ~60s (1800 frames) per the growth strategy's format guidance.
