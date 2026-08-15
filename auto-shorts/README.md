# AUTO SHORTS

An automation-first short-form video editor. Drop in your content, press one
button, review, export a finished 9:16 Short.

```
UPLOAD  ->  AUTO EDIT  ->  REVIEW  ->  EXPORT
```

It is not a timeline editor with AI bolted on. It is an editing machine that
happens to have a timeline: the AI writes an edit decision list from your actual
media, and the timeline exists so you can correct one thing without learning a
professional NLE.

Everything runs on your machine. No account, no upload, no per-video cost, and
no paid service is required for any feature.

---

## What it does when you press AUTO EDIT

Against a real recording, in one pass:

| Step | What actually happens |
|---|---|
| Analyses the voice | Decodes the audio to 16 kHz PCM and runs voice-activity detection over the samples — adaptive noise floor, hysteresis, hangover |
| Removes silence | Cuts dead air and long pauses at your chosen strictness, and **keeps** the short pauses that make delivery sound natural |
| Transcribes | Local Whisper if you have it; otherwise force-aligns the script you pasted against the speech it detected |
| Writes captions | Breaks cards at sentence ends and at your real pauses, inside the mobile safe area, with per-word timings |
| Picks emphasis | Scores every word for semantic weight — numbers, reversals, the word that lands the sentence. Budgeted and spaced, never sprayed |
| Moves the camera | Punch-ins on the emphasis beats and the hook, eased in and out, never overlapping |
| Finds B-roll | Identifies lines that describe something showable, and fills the slots from your own media library by matching filenames, tags and subject matter |
| Designs sound | Places synthesized impacts, whooshes and transitions on real beats, on a per-minute budget so they never pile up |
| Balances music | Drops your music under the narration and side-chains it to duck while you speak |
| Reports | Tells you in plain English exactly what it changed |

Then **RE-EDIT** reworks it — *more energetic*, *more cinematic*, *faster
pacing*, *cleaner*, and four more — without touching your media or script.

---

## Quick start

Requires **Node.js 18+**. Nothing else — FFmpeg is installed as a dependency.

```bash
cd auto-shorts
npm run setup          # installs backend + frontend deps and builds the UI
npm start              # http://localhost:5174
```

Open the URL, press **NEW SHORT**, and go.

To develop the interface with hot reload, run the backend and Vite side by side:

```bash
npm start              # terminal 1 — API on :5174
npm run frontend       # terminal 2 — UI on :5173, proxies /api to :5174
```

### Verify the install

```bash
npm run selftest       # 91 checks: analysis, alignment, edit, render, export, errors
```

It synthesizes its own test media, runs the whole pipeline, and probes the
exported MP4 to confirm it is 1080×1920 H.264/AAC at 30 fps with audible audio.

There is a browser test too, which drives the real UI in Chromium. Playwright is
not a dependency of the app, so install it only if you want to run this:

```bash
npm install --no-save playwright && npx playwright install chromium
npm start &
node scripts/uitest.js  # 45 checks, screenshots land in data/uitest/
```

---

## Folder structure

```
auto-shorts/
├── config.js                 # all configuration in one place
├── backend/                  # HTTP layer — thin shell over the engine
│   ├── server.js
│   ├── store.js              # projects are folders on disk, not a database
│   ├── jobs.js               # queue + progress for long operations
│   └── routes/               # projects, media, edit, render, system
├── video-engine/             # the reusable core
│   ├── engine.js             # createProject, importMedia, analyzeAudio, …
│   ├── ffmpeg.js             # process wrapper, progress parsing
│   ├── probe.js              # media identification, thumbnails, proxies
│   ├── filtergraph.js        # EDL  ->  a single FFmpeg filter graph
│   └── render.js             # preview + export
├── ai/                       # the analysis layer
│   ├── AIProvider.js         # provider abstraction + fallback
│   ├── providers/            # local (default), anthropic, openai
│   ├── autoEdit.js           # the AUTO EDIT pipeline
│   ├── presets.js            # the six editing styles
│   └── lexicon.js            # word lists behind the local analysis
├── captions/
│   ├── stt/                  # whisper, script-align, srt providers
│   ├── chunker.js            # word stream  ->  readable caption cards
│   ├── styles.js             # the six caption styles
│   └── ass.js                # caption cards  ->  animated ASS subtitles
├── audio/
│   ├── analyze.js            # PCM decode, VAD, silence policy, waveform
│   └── sfx.js                # procedural sound-effect synthesis
├── timeline/
│   ├── edl.js                # the edit decision list — the core contract
│   ├── ops.js                # split, trim, move, delete, duplicate, replace
│   └── timemap.js            # source time <-> edit time
├── export/presets.js         # 1080p / 720p targets
├── assets/sfx/               # synthesized on first boot
├── utils/                    # helpers + the structured error type
├── scripts/                  # selftest, uitest, test-media generator
└── frontend/
    └── src/
        ├── App.jsx           # workflow, undo/redo, job orchestration
        ├── api.js            # client, preserves what/why/fix on errors
        ├── lib/edl.js        # client-side EDL interpretation
        └── components/       # Preview, Timeline, Inspector, Panels, Home
```

---

## The edit decision list

Nothing manipulates pixels directly. The AI writes an EDL, the timeline edits
an EDL, the preview interprets an EDL, and the renderer compiles an EDL into
one FFmpeg invocation. That is why a "fix it" tap and a full re-edit are the
same kind of operation, and why undo is a plain history stack.

```jsonc
{
  "duration": 20.56,
  "timeline": [
    { "type": "video",   "source": "m_a1b2", "start": 0,    "end": 4.2,  "sourceIn": 0.31 },
    { "type": "caption", "text": "THIS IS WHY", "start": 1.2, "end": 2.1, "style": "kinetic",
      "words": [ { "word": "THIS", "start": 1.2, "end": 1.5, "emphasis": "strong" } ] },
    { "type": "zoom",    "start": 2.0,  "end": 3.5,  "scale": 1.08, "attack": 0.32 },
    { "type": "broll",   "start": 6.1,  "end": 8.4,  "source": null,
      "suggestions": ["credit card close-up", "suspicious transaction"] },
    { "type": "sfx",     "start": 6.0,  "end": 6.6,  "sfxName": "impact", "gain": 0.42 },
    { "type": "music",   "start": 0,    "end": 20.6, "gain": 0.16, "duck": true },
    { "type": "voice",   "start": 0,    "end": 20.6, "keepRanges": [ { "start": 0.4, "end": 9.1 } ] }
  ]
}
```

---

## Free and local components

| Job | What is used | Cost |
|---|---|---|
| Video processing | `ffmpeg-static` (FFmpeg 7 with libx264, libass, libvpx) | free, bundled |
| Caption rendering | libass, via generated ASS with per-word animation | free, bundled |
| Fonts | DejaVu Sans / Liberation Sans from the system | free |
| Speech to text | Local Whisper if installed, otherwise script alignment | free |
| AI analysis | Local heuristics (default) | free, offline |
| Sound effects | Synthesized in JavaScript at first boot | free |
| Rendering | Local, single-pass FFmpeg | free |
| Storage | Folders on disk | free |

Hosted AI (Anthropic or OpenAI) is strictly optional, off by default, and only
ever receives the transcript.

---

## Known limitations

These are real and worth knowing before you rely on them.

**Script alignment is proportional, not acoustic.** With no Whisper installed,
word timings are derived by distributing your script across the speech runs
found in the audio, weighted by syllable count and punctuation. Cards break on
real pauses, so captions track the delivery closely — but individual word
boundaries inside a continuous run are estimates, typically within a couple of
hundred milliseconds. Install Whisper and the engine prefers it automatically.

**Emphasis and B-roll are heuristic by default.** The local provider reads word
lists, sentence position, numbers and capitalisation. It is deliberately
conservative and it is right most of the time, but it does not understand your
subject. Setting an API key improves both, and every mark is one tap to change.

**B-roll matches against filenames and tags.** With no stock library, AUTO mode
searches your own media by name, tag, and subject group — so `credit-card.mp4`
gets found by a line about payments. Unmatched slots stay on the timeline as
real, correctly-timed suggestions with a Replace button rather than being
silently dropped.

**Transitions are cuts, dips and flashes.** Not cross-dissolves. Frame-exact
concatenation is what keeps the preview and the export in agreement; adding
overlap-based dissolves would shift every downstream timing.

**The live preview is close, not pixel-identical.** It shares its zoom, crop,
wrap and caption maths with the renderer, so it is accurate. Two things it
cannot reproduce in a browser: libass's exact glyph metrics (a long caption can
break one word differently) and the side-chain compressor (music ducking is
approximated with a gain envelope). Press **Render exact preview** to see the
real encoder output before exporting.

**Preview proxies are WebM, exports are MP4.** Exports are H.264/AAC as the
platforms require. The editor's proxies are VP8/Opus, because H.264 and AAC are
patent-encumbered and open-source Chromium builds ship without them — an MP4
proxy would play as a black rectangle there.

**Rendering is CPU-bound.** Roughly real-time for 1080p on a modern laptop; the
20-second test export takes about 20 seconds. There is no GPU path yet.

**Multi-clip projects are sequenced, not intelligently assembled.** With a
separate voiceover over several video clips, they are laid end to end to cover
the narration. Choosing *which* clip suits *which* line needs visual
understanding the local provider does not have.

**Single user, no auth.** It binds to your machine and assumes one person is
using it. Do not expose the port to the internet as-is.

---

## What to build next

1. **Speaker framing for punch-ins.** Face detection would let a punch-in centre
   on the speaker instead of the frame, which is the single biggest visual win
   left.
2. **Bundle a small Whisper model** behind an opt-in download, so exact word
   timings are one click rather than a manual install.
3. **Segmented render cache.** Re-render only the segments whose clips changed;
   most export time is currently spent re-encoding untouched picture.
4. **Beat-aware music.** Detect the tempo of the uploaded bed and nudge cuts and
   effects onto the beat.
5. **Vertical safe-area preview overlay** showing where each platform's UI will
   cover the frame.
6. **Batch mode.** A folder of narrations plus a folder of images, exported as a
   week of Shorts in one run.

---

## API

The HTTP layer is a thin shell over `video-engine/engine.js`; a CLI or desktop
shell could drive the same functions with no server at all.

```
GET    /api/capabilities                      what is available on this machine
GET    /api/projects                          list
POST   /api/projects                          create
GET    /api/projects/:id                      open
PATCH  /api/projects/:id                      rename, settings, script, srt
POST   /api/projects/:id/media                upload (multipart)
POST   /api/projects/:id/auto-edit            -> job
POST   /api/projects/:id/re-edit              -> job   { directives: [...] }
POST   /api/projects/:id/timeline/:op         split | trim | move | remove | …
PUT    /api/projects/:id/edl                  replace the EDL (undo/redo)
POST   /api/projects/:id/captions/regenerate  -> job
POST   /api/projects/:id/preview              -> job   render the exact proxy
POST   /api/projects/:id/export               -> job   { preset: "1080p" }
GET    /api/projects/jobs/:jobId              progress for any job
```

Every error response carries three fields — `what` happened, `why`, and how to
`fix` it — and the interface renders all three.

---

## Licence

MIT.
