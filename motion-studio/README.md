# Motion Studio

Turn a still image into a 9:16 cinematic clip, **on your Android phone**, for free.

Upload an AI still → pick a motion → adjust → generate → download the MP4.
No account, no API key, no upload: the image never leaves the device.

<p align="center">
  <em>Upload · 9:16 preview · 32 motion presets · 1080×1920 MP4</em>
</p>

## Use it

The app is a static site. Open `frontend/index.html` from any HTTPS host and
it works — there is no build step and nothing to install.

**On your phone (easiest):** publish the `frontend/` folder to GitHub Pages,
Netlify, Cloudflare Pages or Vercel, then open the URL on Android and use
*Add to Home screen*. See [Deploying](#deploying).

**On your own machine:**

```sh
node backend/server.js          # http://localhost:8080
```

## What it does

| Step | |
|---|---|
| **Upload** | JPG, PNG or WEBP up to 25 MB, from the gallery, Files, or the camera. |
| **Reframe** | Drag inside the 9:16 preview to pan, pinch to zoom. The image is never stretched. |
| **Choose a motion** | 32 presets across Camera, Parallax, Environment, Particles and Atmosphere. |
| **Adjust** | Motion Strength (Subtle/Medium/Strong/Extreme), duration (3–8s), plus Smoothness, Camera Speed and Effect Intensity. |
| **Generate** | Rendered on the phone's GPU at 1080×1920, 24 or 30 fps. |
| **Download** | An MP4 straight into Downloads, or shared directly into TikTok/Reels. |

The live preview is the real renderer at a smaller size — what you see is
what you get.

### The motions

**Camera** — Cinematic Push In · Slow Zoom In / Out · Dramatic Zoom In / Out ·
Camera Push In · Camera Pull Back · Pan Left / Right · Tilt Up / Down ·
Diagonal Pan · Handheld · Cinematic Drift

**Parallax** — Orbit Parallax · Depth Sweep · 3D Push · Breathe

**Environment** — Heavy Rain · Lightning Storm · Snowfall · Fire & Embers ·
Smoke · Flying Debris

**Particles** — Floating Dust · Sparks · Bokeh Lights · Falling Ash

**Atmosphere** — Rolling Fog · God Rays · Heat Haze · Night Mist

## Why it looks like footage and not like a zoom

Every clip is built from four things, not one:

1. **Depth.** A depth map is estimated from the image (defocus, aerial
   perspective, ground plane, centre bias) and used to displace the frame
   per-pixel, so the foreground and background move by different amounts.
   The camera's *direction of travel* aims the displacement, and a push-in
   expands the near plane faster than the far one — the geometry of actually
   moving a camera forward.
2. **A camera, not a transform.** Moves ease in and out on cubic and
   smoothstep curves, with seeded value-noise handheld on top. Nothing moves
   linearly.
3. **Air.** Fog, mist, smoke and haze are weighted by depth, so they pool in
   the distance instead of sitting flat over the subject. Heat haze refracts
   the image rather than being painted onto it.
4. **Limits.** Displacement is capped at ~2.6% of frame width. Past roughly
   3% it starts bending straight edges, which is the "melting" look this tool
   exists to avoid. Extreme strength scales the *move*, never past the rails.

No generative video model is involved, which is precisely why faces and hands
survive.

## Architecture

Everything runs in the browser. There is no server in the render path.

```
image → depth estimate → WebGL2 (scene · atmosphere · particles · grade)
      → WebCodecs H.264 → MP4 muxer (in this repo) → Downloads
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for why, and for the
browser-only / server / GPU-inference trade-off that decided it.

```
frontend/          the app — no build step, no bundler, no dependencies
  config/          every tunable number
  models/          motion presets (pure data)
  components/      screens and touch controls
  utils/           image decode, download, seeded RNG, errors
  video-engine/    engine, renderer, shaders, depth, camera, effects, encoder
backend/           optional static host (not needed to use the app)
tests/             end-to-end browser test + visual contact sheet
docs/              architecture
```

### Adding a motion

Add one object to `frontend/models/presets.js`. Nothing else changes — it
appears in the UI, in the preview and in the export automatically.

```js
{
  id: 'storm_push', name: 'Storm Push', emoji: '⛈', category: 'environment',
  duration: 5, intensity: 0.6, parallax: 0.7,
  camera: { zoom: [1.0, 1.18], easing: 'dolly', handheld: { amp: 0.4, freq: 0.8 } },
  environment: [{ type: 'rain', amount: 0.7, angle: -0.2 }],
  atmosphere: [{ type: 'fog', amount: 0.3, depthBias: 0.8 }],
  lightning: { rate: 0.6, intensity: 0.7 },
  grade: { vignette: 0.32, warmth: -0.1, bloom: 0.25 },
}
```

`frontend/models/preset-schema.js` documents every field.

## Export

Encoders are tried in order, best first:

| | Container | Timing |
|---|---|---|
| **WebCodecs H.264** (Android Chrome) | MP4 | Exact constant frame rate, faster than real time |
| MediaRecorder H.264 | MP4 | Wall-clock paced |
| WebCodecs VP9 | MP4 | Exact constant frame rate |
| MediaRecorder VP9 | WebM | Wall-clock paced |

Force one with `?encoder=webcodecs-avc1` (or `webcodecs-vp9`,
`mediarecorder-mp4`, `mediarecorder-webm`) if a device's encoder misbehaves.

The MP4 writer is `frontend/video-engine/encoder/mp4-muxer.js` — about 300
lines of ISO-BMFF, so there is no dependency to fetch.

**On the wall-clock paths**, the clip's length comes from the real clock, so
a device that cannot render fast enough produces a correct-length clip at a
lower frame rate rather than a smooth clip of the wrong length. When that
happens the result screen says so and suggests lowering the quality.

## Deploying

The `frontend/` folder *is* the site.

- **GitHub Pages** — push the repo, then Settings → Pages → Deploy from
  branch, folder `/`. The app lives at `…/motion-studio/frontend/`.
- **Netlify / Cloudflare Pages / Vercel** — drag the folder in, or point the
  project at it. No build command, no output directory.

HTTPS matters: `VideoEncoder` is only exposed in a secure context, so an
`http://` LAN address quietly falls back to the MediaRecorder encoder.
`http://localhost` counts as secure.

## Tests

```sh
node tests/e2e.mjs                            # full workflow in a real browser
node tests/e2e.mjs --encoder webcodecs-vp9    # the exact constant-frame-rate path
node tests/contact-sheet.mjs                  # visual grid of presets × time
```

The end-to-end test drives the actual app at an Android viewport (412×915,
DPR 2.6): it uploads an image, checks the layout and the depth map, drags to
reframe, exports, and verifies the resulting file decodes at 9:16 with the
right duration. Artifacts land in `.test-output/`.

## Browser support

Chrome for Android, Samsung Internet, Firefox for Android, and desktop
Chrome/Edge/Firefox/Safari. Requires WebGL2. Best results on Chrome for
Android, which exposes the hardware H.264 encoder.

## Licence

MIT, same as the rest of this repository.
