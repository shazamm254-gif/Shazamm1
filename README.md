# Cosmic Dread — Shorts Growth Toolkit

Tooling + strategy to launch and grow a faceless, AI-generated cosmic-horror
YouTube Shorts channel — **Cosmic Dread**: the universe is bigger, stranger, and
more terrifying than you think, in 30-second hits.

> The channel is currently configured for the **cosmic / space-horror** niche in
> `tools/niche.json`. Change that one file (name, pillars, hooks, vocabulary) and
> every tool retunes to any niche you want.

This repo can't post to YouTube for you, but it gives you the two things that
actually move a small channel: a **concrete growth plan** and **scripts** that
analyze what's working and help you package and ideate faster.

## What's here

| Path | What it does |
|---|---|
| [`docs/GROWTH_STRATEGY.md`](docs/GROWTH_STRATEGY.md) | The playbook — hooks, series, cadence, a 30-day plan, all tuned to this niche. **Start here.** |
| [`docs/PRODUCTION-PACK.md`](docs/PRODUCTION-PACK.md) | **All-in-one** — every script's voiceover + the 4 ready-to-paste image prompts together. Make all 10 Shorts from this one file (phone-friendly). |
| [`docs/FIRST_10_SHORTS.md`](docs/FIRST_10_SHORTS.md) | 10 ready-to-produce Short scripts — hook, full voiceover, on-screen text, visuals, and paste-ready titles/descriptions. |
| [`docs/THUMBNAIL_CHECKLIST.md`](docs/THUMBNAIL_CHECKLIST.md) | First-frame / thumbnail checklist to win the swipe, tuned to this niche. |
| `tools/analyze_channel.py` | Pulls your public stats, finds your top/bottom performers and best posting time. |
| `tools/optimize_metadata.py` | Scores a title/description/tags against Shorts best practices (offline), with optional AI rewrites. |
| `tools/generate_ideas.py` | Generates Short ideas + hooks for your niche (offline, or richer with AI). |
| `tools/generate_voiceover.py` | Renders the VO lines from `docs/FIRST_10_SHORTS.md` to audio via a local text-to-speech server. |
| `tools/niche.json` | Your channel's niche, pillars, voice, and hook templates — edit this to retune every tool. |
| [`video/`](video/) | A [Remotion](https://remotion.dev) project (React-based video rendering) — scaffold for assembling the AI images + voiceovers into final Shorts programmatically. |
| [`product/faceless-ai-shorts-starter-kit/`](product/faceless-ai-shorts-starter-kit/) | A **sellable digital product** — packages the system into a faceless-channel starter kit, with paste-ready sales copy and pricing. |
| [`product/cosmic-ai-prompt-pack/`](product/cosmic-ai-prompt-pack/) | **300+ cosmic AI image/video prompts** with a cohesive style system + shot lists for the 10 scripts. A standalone product, the Pro-tier upsell, and your own production shortcut. |

## Setup

```bash
pip install -r requirements.txt      # only `requests` is required
cp .env.example .env                 # then edit .env with your key(s)
source .env
```

You need a free **YouTube Data API key** for the analytics (read-only public
data — it can't change your channel). The AI features in the optimizer and idea
generator are optional and need an Anthropic API key. See `.env.example`.

## Quick start

```bash
# 1. Baseline a channel — what's working, and when to post
python tools/analyze_channel.py --channel "@CosmicDread"

# 2. Fill your idea pipeline
python tools/generate_ideas.py -n 20

# 3. Check an upload's packaging before you publish
python tools/optimize_metadata.py --title "What happens if you fall into a black hole"

# 4. Generate voiceover audio for a script
python tools/generate_voiceover.py --short 1
```

Add `--use-claude` to the optimizer or idea generator for AI-written titles and
full hook/concept/title ideas (needs `ANTHROPIC_API_KEY`).

### Voiceovers

`tools/generate_voiceover.py` reads the VO lines straight out of
`docs/FIRST_10_SHORTS.md` and renders them to audio using a free,
self-hosted, OpenAI-compatible text-to-speech server
([travisvn/openai-edge-tts](https://github.com/travisvn/openai-edge-tts)):

```bash
docker run -d -p 5050:5050 travisvn/openai-edge-tts:latest

python tools/generate_voiceover.py --list        # see what's available
python tools/generate_voiceover.py --short 1      # render one Short
python tools/generate_voiceover.py --all          # render all of them
python tools/generate_voiceover.py --text "Custom line" -o clip.mp3
```

Files are written to `voiceovers/` (git-ignored). Configure the server URL,
key, voice, format, and speed via `TTS_API_URL` / `TTS_API_KEY` / `TTS_VOICE`
/ `TTS_FORMAT` / `TTS_SPEED` (see `.env.example`) or the matching CLI flags.

### Video assembly

`video/` is a blank [Remotion](https://remotion.dev) project (scaffolded with
`npx create-video@latest`) for turning the AI-generated images and voiceovers
into a finished vertical video in code, instead of a manual editor:

```bash
cd video
npm install
npm run dev      # opens the Remotion Studio to preview/edit compositions
npx remotion render MyComp out.mp4   # renders a composition to a video file
```

Rendering needs a headless Chromium, which Remotion downloads on first render
— make sure outbound access to `remotion.media` is allowed in restricted
network environments.

## How to actually use this

1. Read [`docs/GROWTH_STRATEGY.md`](docs/GROWTH_STRATEGY.md) once, end to end.
2. Run `analyze_channel.py` to get your starting numbers and best posting time.
3. Batch-generate a week of ideas, produce them, and run each through
   `optimize_metadata.py` before posting.
4. Re-run `analyze_channel.py` weekly. Make more of whatever over-performs.

Retune everything by editing `tools/niche.json` — change the pillars, voice, or
hook templates and every tool follows.

## Note

Public stats (views, likes) show *what* performed; the deeper Shorts signals
(swipe-away rate, average view duration) live in **YouTube Studio → Analytics**.
Use this toolkit to spot patterns fast, then confirm them in Studio.
