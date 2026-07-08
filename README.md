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
| `tools/niche_generator.py` | Discovers and scores new viral niches or sub-niches (offline or AI), explains why each one works, and can export a pick straight into the `niche.json` format. |
| `tools/niche.json` | Your channel's niche, pillars, voice, and hook templates — edit this to retune every tool. |
| `tools/assembler.py` | Stage 6 video assembler — renders a finished 1080x1920 Short (Ken Burns stills + burned-in captions + ducked music) from a voiceover, ElevenLabs word timestamps, and a folder of Leonardo stills. Headless, ffmpeg-based. See the module docstring for the expected job-folder layout and `python tools/assembler.py --job <folder> --preview` for a fast 5s test render. |
| [`product/faceless-ai-shorts-starter-kit/`](product/faceless-ai-shorts-starter-kit/) | A **sellable digital product** — packages the system into a faceless-channel starter kit, with paste-ready sales copy and pricing. |
| [`product/cosmic-ai-prompt-pack/`](product/cosmic-ai-prompt-pack/) | **300+ cosmic AI image/video prompts** with a cohesive style system + shot lists for the 10 scripts. A standalone product, the Pro-tier upsell, and your own production shortcut. |

### Money Decoded (personal-finance niche)

A second, ready-to-go niche — pass `--niche-file niche-money.json` to
`generate_ideas.py` to target it instead of Cosmic Dread.

| Path | What it does |
|---|---|
| [`docs/GROWTH_STRATEGY_MONEY.md`](docs/GROWTH_STRATEGY_MONEY.md) | The playbook for **Money Decoded** — hooks, series, cadence, a 30-day plan. |
| [`docs/FIRST_10_SHORTS_MONEY.md`](docs/FIRST_10_SHORTS_MONEY.md) | 10 ready-to-produce Short scripts across all 5 money pillars. |
| [`docs/THUMBNAIL_CHECKLIST_MONEY.md`](docs/THUMBNAIL_CHECKLIST_MONEY.md) | First-frame / thumbnail checklist tuned to the money niche. |
| `tools/niche-money.json` | The Money Decoded niche config — pillars, voice, and hook templates. |

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
# 0. Not sure what niche to run at all? Generate and score some options first
python tools/niche_generator.py -n 10

# 1. Baseline a channel — what's working, and when to post
python tools/analyze_channel.py --channel "@CosmicDread"

# 2. Fill your idea pipeline
python tools/generate_ideas.py -n 20

# 3. Check an upload's packaging before you publish
python tools/optimize_metadata.py --title "What happens if you fall into a black hole"
```

Add `--use-claude` to the optimizer or idea generator for AI-written titles and
full hook/concept/title ideas (needs `ANTHROPIC_API_KEY`).

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
