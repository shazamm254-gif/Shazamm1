# The Algorithm Beater

A local web app — a **YouTube Shorts pipeline** that generates *proven* viral
ideas, scores them, analyzes them, writes engineered scripts, voices them, and
generates matching visuals.

It runs as a **Vite + React** frontend with a small **Node/Express** backend.
All four API keys stay **server-side** in `.env` — the backend proxies every API
call and the React frontend only ever talks to the backend. No keys ever reach
the browser.

> Looking for the original Cosmic Dread Python toolkit that used to live here?
> It moved to [`docs/SHORTS_TOOLKIT.md`](docs/SHORTS_TOOLKIT.md).

## The five stages

1. **Proven Idea Engine** — pulls top recent Shorts in your niche from YouTube,
   scores them by virality, and asks Claude to turn the proven *formats* into
   fresh ideas. *(Built.)*
2. **Idea Analysis** — a structured retention/pacing brief for the chosen idea. *(Built.)*
3. **Viral Script Generator** — a second-marked, human-voiced, editable Shorts script. *(Built.)*
4. **Voiceover** — ElevenLabs TTS (confirm-before-generate; uses paid credits). *(Built.)*
5. **Visual Prompts + Generation** — Claude shot list → Leonardo images, pick which
   scenes to render (confirm-before-generate; uses paid credits). *(Built.)*

Stages unlock only when the previous one is complete. You can **Export project**
to download every stage's output as one JSON file.

> **Build status:** all five stages are complete and runnable end to end.

---

## Setup (desktop)

```bash
npm install          # install dependencies
cp .env.example .env # then edit .env and fill in your four keys
npm run dev          # starts the Express backend + Vite frontend together
```

Open the printed Vite URL (default <http://localhost:5173>). The backend runs on
`PORT` (default **8787**) and the frontend proxies all `/api/*` calls to it.

### Healthcheck

Visit <http://localhost:8787/api/health> — it reports which keys are present
(never their values). The app also shows a key-status row at the top.

---

## Setup on Android (Termux)

1. Install **Termux** from **F-Droid** (the Play Store version is outdated — use
   F-Droid).
2. In Termux:
   ```
   pkg update && pkg upgrade
   pkg install nodejs git
   ```
3. Clone or create the project folder, then `cd` into it.
4. `npm install`
5. Create the `.env` file (see **Where the keys go** below) and fill in the four
   keys.
6. `npm run dev`
7. Open the printed `localhost` URL in your phone's browser (Chrome/Firefox).
   The backend runs on `PORT=8787`; Vite serves the frontend; both run inside
   Termux.

> **Note:** Termux must stay open in the foreground (or run `termux-wake-lock`)
> or Android may kill the server.

---

## Where the keys go

All four keys go in **one** file named `.env` in the project root (the same
folder as `package.json`). In Termux, create it with `nano .env`, paste the
block below, fill each value after the `=` with **no quotes and no spaces**, then
save (Ctrl+O, Enter, Ctrl+X):

```
YOUTUBE_API_KEY=your_youtube_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here
LEONARDO_API_KEY=your_leonardo_key_here
PORT=8787
```

- The **YouTube** key is the one you make in Google Cloud Console (enable
  **YouTube Data API v3** → Credentials → Create API key). It's read-only public
  data.
- The keys are read **only** by the backend, never sent to the browser.
- `.env` is listed in `.gitignore`, so it's never committed or shared.
- If a key is wrong or missing, the matching stage shows a clear
  **"invalid/missing key"** error instead of a generic crash.

---

## How it works (architecture)

```
React (Vite, :5173)  ──/api/*──▶  Express backend (:8787)  ──▶  YouTube / Anthropic / ElevenLabs / Leonardo
   no keys                          reads .env, proxies every call
```

- `server/index.js` — Express app, healthcheck, route mounting, central error handler.
- `server/lib/youtube.js` — `search.list` + `videos.list` + virality scoring.
- `server/lib/anthropic.js` — Claude helper (`claude-sonnet-4-6`) + JSON-fence stripping.
- `server/routes/ideas.js` — Stage 1 pipeline.
- `server/routes/analyze.js` — Stage 2 retention brief.
- `server/routes/script.js` — Stage 3 script writer.
- `server/routes/voice.js` + `server/lib/elevenlabs.js` — Stage 4 voices list + TTS (mp3).
- `server/routes/visuals.js` + `server/lib/leonardo.js` — Stage 5 shot list + image generation (with polling).
- `src/` — React app: stepper, stages, shared spinner/error components.

### Using OpenRouter instead of Anthropic (optional)

If you don't have Anthropic credits, you can route every "Claude" call through
[OpenRouter](https://openrouter.ai) (an OpenAI-compatible gateway with free
models). Add to `.env`:

```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=deepseek/deepseek-chat-v3-0324:free
```

When `OPENROUTER_API_KEY` is set it takes priority over `ANTHROPIC_API_KEY`;
nothing else changes. `OPENROUTER_MODEL` is optional — pick any model id from
<https://openrouter.ai/models> (ids ending in `:free` cost nothing; you can also
use `anthropic/claude-sonnet-4-6`, which draws OpenRouter credits). The key-status
row in the app shows which provider and model are active.

### Cost guards

- YouTube `search.list` is capped at **25** results (~100 quota units) and
  `videos.list` is a single ~1-unit call.
- Stages 4 and 5 (paid credits) require an explicit **"Generate (uses credits)"**
  confirmation before any request is sent.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run backend + frontend together (development). |
| `npm run dev:server` | Backend only. |
| `npm run dev:client` | Frontend only. |
| `npm run build` | Production build of the frontend. |
| `npm start` | Run the backend (serves `/api`). |
