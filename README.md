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
2. **Idea Analysis** — a structured retention/pacing brief for the chosen idea. *(Next.)*
3. **Viral Script Generator** — a second-marked, human-voiced Shorts script. *(Next.)*
4. **Voiceover** — ElevenLabs TTS (confirm-before-generate; uses paid credits). *(Next.)*
5. **Visual Prompts + Generation** — Claude shot list → Leonardo images
   (confirm-before-generate; uses paid credits). *(Next.)*

Stages unlock only when the previous one is complete. You can **Export project**
to download every stage's output as one JSON file.

> **Build status:** the scaffold and **Stage 1 (the core)** are complete and
> runnable end to end. Stages 2–5 are wired into the stepper and land in the
> next build steps.

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
- `src/` — React app: stepper, stages, shared spinner/error components.

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
