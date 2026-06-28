# Project 3000 — Shorts Growth Toolkit

Tooling + strategy to grow the YouTube Shorts channel
**[@Project3000Official](https://www.youtube.com/@Project3000Official)** —
AI-generated simulations of the future of evolution (speculative biology, future
humans, post-apocalyptic survival, Earth & Mars in the next millennium).

This repo can't post to YouTube for you, but it gives you the two things that
actually move a small channel: a **concrete growth plan** and **scripts** that
analyze what's working and help you package and ideate faster.

## What's here

| Path | What it does |
|---|---|
| [`docs/GROWTH_STRATEGY.md`](docs/GROWTH_STRATEGY.md) | The playbook — hooks, series, cadence, a 30-day plan, all tuned to this niche. **Start here.** |
| `tools/analyze_channel.py` | Pulls your public stats, finds your top/bottom performers and best posting time. |
| `tools/optimize_metadata.py` | Scores a title/description/tags against Shorts best practices (offline), with optional AI rewrites. |
| `tools/generate_ideas.py` | Generates Short ideas + hooks for your niche (offline, or richer with AI). |
| `tools/niche.json` | Your channel's niche, pillars, voice, and hook templates — edit this to retune every tool. |

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
# 1. Baseline the channel — what's working, and when to post
python tools/analyze_channel.py --channel "@Project3000Official"

# 2. Fill your idea pipeline
python tools/generate_ideas.py -n 20

# 3. Check an upload's packaging before you publish
python tools/optimize_metadata.py --title "The last human on Earth won't look human"
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
