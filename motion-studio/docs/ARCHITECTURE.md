# Motion Studio — Architecture

A free, mobile-first image-to-video motion tool. Upload an AI still, pick a
motion preset, get a 1080×1920 MP4 on your Android phone.

## The decision: everything runs in the browser

Three candidate architectures were evaluated against the "free first,
Android first" constraint:

| Option | What it buys | What it costs | Verdict |
|---|---|---|---|
| **A. Browser-only** (WebGL2 + WebCodecs) | Depth parallax, camera moves, particles, atmosphere, H.264 export. Hardware-encoded on-device. | Nothing. No server, no upload, no queue. | **Chosen for the whole MVP.** |
| **B. Lightweight server** (Node + ffmpeg) | Remux/transcode, format rescue for old browsers. | A host, an upload of the user's image, bandwidth. | Optional, off by default (`backend/`). |
| **C. GPU AI inference** (SVD / AnimateDiff / CogVideoX) | True generative subject motion. | A GPU box (~$0.40–1.20/hr) or a shared free Space with a queue. Also warps faces and hands — the exact failure the brief forbids. | Deliberately **not** in the MVP. Hook is documented below. |

The decisive facts:

1. Every Android phone from the last ~5 years has a **hardware H.264 encoder**
   exposed to Chrome through `VideoEncoder` (WebCodecs). A 6-second
   1080×1920 clip encodes in a few seconds, on the device, for free.
2. **WebGL2** is universal on Android. A per-pixel depth-displacement shader,
   50k instanced particles and a grade pass all run at well over 30 fps at
   1080×1920.
3. The motion the brief actually asks for — parallax, camera movement,
   rain/snow/fog/fire/lightning, cinematic easing — is **deterministic
   compositing**, not generative video. It does not need a diffusion model,
   and it cannot melt a face.

So: no server, no upload, no API key, no account. The image never leaves
the phone.

## What generates the motion

```
   image file
        │
        ▼
  ┌───────────────┐   validate, EXIF-safe decode, working copy at ≤2560px
  │ utils/image   │
  └───────┬───────┘
          ▼
  ┌───────────────┐   heuristic monocular depth: defocus energy + aerial
  │ video-engine  │   perspective + ground-plane prior + center prior,
  │ /depth.js     │   percentile-stretched and heavily smoothed
  └───────┬───────┘
          ▼
  ┌──────────────────────────────────────────────────────────┐
  │ renderer.js (WebGL2)                                     │
  │                                                          │
  │  pass 1  image + depth displacement + camera transform   │
  │  pass 2  atmosphere (FBM fog / haze / god rays)          │
  │  pass 3  particles (instanced, GPU-evaluated, seeded)    │
  │  pass 4  grade (vignette, grain, bloom-from-mip, flash)  │
  └───────┬──────────────────────────────────────────────────┘
          ▼
  ┌───────────────┐   fixed-timestep frame loop, exact CFR timestamps
  │ engine.js     │
  └───────┬───────┘
          ▼
  ┌───────────────┐   VideoEncoder(avc1) → mp4-muxer.js  → .mp4
  │ encoder/      │   or MediaRecorder(video/mp4)        → .mp4
  └───────┬───────┘   or MediaRecorder(webm)             → .webm
          ▼
      Downloads/
```

### Depth (the "2.5D" step)

Full monocular depth networks (MiDaS, Depth Anything) are 25–100 MB and need
ONNX Runtime Web — a slow first load on mobile data, for a map that is then
blurred to near-uselessness by the small parallax budget this tool uses.

Instead `depth.js` computes a depth map from four classic cues, entirely on a
downsampled canvas in ~15 ms:

- **defocus / detail energy** — Sobel magnitude, box-blurred. Sharp regions
  read as near, soft regions as far.
- **aerial perspective** — low saturation + raised black level reads as far.
- **ground-plane prior** — a gentle vertical ramp; the bottom of a frame is
  usually nearer than the top.
- **center prior** — a soft radial term; AI stills put the subject mid-frame.

The result is percentile-normalised and smoothed with three box-blur passes,
which is what keeps edges from tearing when displaced. `depth.js` exposes a
`DepthProvider` interface, so a real network can be dropped in later without
touching the renderer.

Parallax is then **capped at ~3.5% of frame width**. That is the difference
between "this feels like a camera moved" and "this is melting". The cap is a
constant in `config/app.config.js`, not a slider the user can wreck.

### Camera

`camera.js` evaluates a preset's camera spec at normalised time `t ∈ [0,1]`
and returns `{zoom, tx, ty, roll}`. Motion is never linear: the default is
`easeInOutCubic`, with `smoothstep`, `easeOutQuint` and a critically-damped
`settle` curve available per preset. Handheld adds seeded value-noise on
three octaves — no `Math.random()` anywhere in the render path, so the same
settings always produce the same clip.

### Effects

Particles are **evaluated in the vertex shader** from a per-instance seed and
a time uniform. The CPU uploads one static buffer at setup and then touches
nothing per frame, which is what makes 40k rain streaks free. Each system has
a depth band, so near particles are larger, faster and softer than far ones.

Atmosphere (fog, haze, smoke, god rays) is a fullscreen FBM pass that is
**weighted by the depth map** — fog accumulates in the distance, the way it
does in real air, instead of sitting flat over the subject.

Lightning is a seeded strike schedule: an exposure flash curve plus a
recursive noise-perturbed bolt polyline, so no two strikes look alike but a
given seed always repeats.

### Export

Capability-detected, best first:

1. `VideoEncoder` + `avc1.42E0xx` → **`mp4-muxer.js`** (an ISO-BMFF writer in
   this repo, no dependency) → H.264 MP4. Exact constant frame rate, chosen
   bitrate, renders faster than real time.
2. `MediaRecorder` with `video/mp4;codecs=avc1` → MP4. Paced to real time.
3. `MediaRecorder` with `video/webm` → WebM, with a visible note that the file
   is fine for YouTube but should be converted for TikTok/Reels.

Resolution auto-steps down (1080×1920 → 864×1536 → 720×1280) if the device
reports a small `deviceMemory` or fails to allocate, and the user can force a
tier in Quality.

## Where a server *would* help (and why it is optional)

`backend/` is a dependency-free Node static server for hosting the app on a
LAN or a free tier. It is not required to use the app and holds no secrets.

If real generative subject motion is ever wanted, the seam is
`video-engine/engine.js::render()`: it already returns frames through an
encoder interface, so a remote renderer would implement the same contract.
That work belongs behind a queue on a GPU host and is out of MVP scope.

## Layout

```
motion-studio/
  frontend/
    index.html            single entry, no build step, no bundler
    app.js                screen router + state
    config/               tunables: resolutions, durations, caps, limits
    models/               motion presets + categories (pure data)
    components/           upload / studio / render / result screens, sheet, slider
    utils/                image decode+validate, download, seeded rng, errors, dom
    video-engine/
      engine.js           frame scheduler, preview loop, export loop
      renderer.js         WebGL2 pipeline
      shaders.js          GLSL sources
      depth.js            heuristic depth provider
      camera.js           preset → camera state at time t
      easing.js           easing curves + value noise
      effects/            particles, atmosphere, lightning, grade
      encoder/            encoder.js (capability chain), mp4-muxer.js
  backend/                optional zero-dependency static host
  docs/                   this file
```

No file in the render path imports anything from the network.
