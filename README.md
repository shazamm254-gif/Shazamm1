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
| `tools/viral_script.py` | **Any-topic viral script generator** — give it any topic in any niche and it writes a script engineered to go viral *and* to sound like a human talking to a friend, not a robot. Hooks, open loops, re-hooks, curiosity gaps, payoff, loop ending — every beat labeled with the retention device it uses, plus per-beat timings, word targets, and delivery notes. Works from 15s Shorts to 10-minute videos, in 5 formats (explainer, storytime, countdown, hot take, how-to). Offline by default with a research checklist per script; `--use-claude` writes every word under strict sound-like-a-human rules. |
| `tools/viral_generator.py` | **End-to-end niche + script generator** — generates and ranks proven-viral niches, picks the winner, and writes complete ready-to-produce Short scripts for it (hook, timed VO beats, on-screen text, visuals, loop ending, title/desc). Also scripts any existing `niche*.json` via `--niche-file`, and exports markdown production packs with `--export-md`. |
| `tools/niche.json` | Your channel's niche, pillars, voice, and hook templates — edit this to retune every tool. |
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

### Dream What-Ifs (sleep-science niche)

A third niche, generated and scored by `tools/niche_generator.py` (Sleep &
Dreams × What-If Scenarios, 78/100) — pass `--niche-file niche-dreams.json`
to `generate_ideas.py` to target it.

| Path | What it does |
|---|---|
| [`docs/GROWTH_STRATEGY_DREAMS.md`](docs/GROWTH_STRATEGY_DREAMS.md) | The playbook for **Dream What-Ifs** — hooks, series, cadence, a 30-day plan. |
| [`docs/FIRST_10_SHORTS_DREAMS.md`](docs/FIRST_10_SHORTS_DREAMS.md) | 10 ready-to-produce Short scripts across all 5 sleep/dream pillars. |
| [`docs/THUMBNAIL_CHECKLIST_DREAMS.md`](docs/THUMBNAIL_CHECKLIST_DREAMS.md) | First-frame / thumbnail checklist tuned to the dreams niche. |
| `tools/niche-dreams.json` | The Dream What-Ifs niche config — pillars, voice, and hook templates. |

### Herbs Decoded (herbal explainer niche)

A fourth niche — honest, science-grounded herbal explainers ("how herbs
actually work") — pass `--niche-file niche-herbal.json` to
`generate_ideas.py` to target it.

| Path | What it does |
|---|---|
| [`docs/GROWTH_STRATEGY_HERBAL.md`](docs/GROWTH_STRATEGY_HERBAL.md) | The playbook for **Herbs Decoded** — hooks, series, cadence, a 30-day plan, and the no-health-claims ground rules. |
| [`docs/FIRST_10_SHORTS_HERBAL.md`](docs/FIRST_10_SHORTS_HERBAL.md) | 10 ready-to-produce herbal explainer Shorts across all 5 pillars, plus series spin-offs and niche-specific packaging/compliance notes. |
| [`docs/THUMBNAIL_CHECKLIST_HERBAL.md`](docs/THUMBNAIL_CHECKLIST_HERBAL.md) | First-frame / thumbnail checklist tuned to the herbal niche. |
| `tools/niche-herbal.json` | The Herbs Decoded niche config — pillars, voice, and hook templates. |

### Extreme Weather What-Ifs (disaster niche)

A fifth niche, generated end-to-end by `tools/viral_generator.py` (Extreme
Weather & Natural Disasters × What-If Scenarios, 76/100) — the first produced by
the one-shot niche + script pipeline, with voiceovers already written.

| Path | What it does |
|---|---|
| [`docs/SCRIPT_PACK_WEATHER.md`](docs/SCRIPT_PACK_WEATHER.md) | 5 ready-to-record Shorts with **fully written, fact-checked voiceovers** — hook, VO, on-screen text, shot timings, titles/descriptions. |
| [`docs/VISUAL_PACK_WEATHER.md`](docs/VISUAL_PACK_WEATHER.md) | **Ember edition** (default) — shot-by-shot AI image/video prompts for all 5 scripts: warm, kinetic, spectacle-forward, with master style suffix, motion notes, and thumbnail prompts. |
| [`docs/VISUAL_PACK_WEATHER_AFTERMATH.md`](docs/VISUAL_PACK_WEATHER_AFTERMATH.md) | **Aftermath edition** (variant) — the same 5 scripts re-shot in the Death channel's cold memento-mori language: the residue instead of the disaster. Ends with the trade-off analysis and an A/B recommendation. |

### Death What-Ifs (mortality science niche)

The **highest-scoring niche** the toolkit has generated (Death & the Afterlife ×
What-If Scenarios, 80/100) — 8/10 built-in demand, 9/10 content depth, 9/10
faceless feasibility. Run `python tools/viral_generator.py --parent death` to
generate more.

| Path | What it does |
|---|---|
| [`docs/SCRIPT_PACK_DEATH.md`](docs/SCRIPT_PACK_DEATH.md) | 6 ready-to-record Shorts with **fully written voiceovers and a source citation per script** — the dying brain's gamma surge (in two framings), hearing as the last sense, a 3-hour cardiac arrest survival, terminal lucidity, and Victorian safety coffins. |
| [`docs/VISUAL_PACK_DEATH.md`](docs/VISUAL_PACK_DEATH.md) | Shot-by-shot AI image/video prompts for all 6 scripts — master style suffix, motion notes, thumbnails, and a **restraint rule** (no bodies, no gore, no real faces) that keeps the channel monetized and the imagery stronger. |

> This niche is documentary and science framing only — never method, never
> instruction, never glorification. That's the ethical line and it's also
> YouTube's suicide & self-harm policy line; the script pack states it up front.

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

# 0b. Or do it all in one shot — find the best niche AND get ready-to-produce
#     scripts for it (add --use-claude for fully written voiceovers)
python tools/viral_generator.py --scripts 5
python tools/viral_generator.py --niche-file niche-money.json   # script an existing niche

# 0c. Already know your topic? Write a viral, human-sounding script for it —
#     any topic, any niche, any length (add --use-claude for fully written VO)
python tools/viral_script.py "why you can't remember being a baby"
python tools/viral_script.py "the housing market" --length 3min -n 3

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
