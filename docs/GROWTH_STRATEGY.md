# Cosmic Dread — YouTube Shorts Growth Playbook

A practical, channel-specific plan for **Cosmic Dread** — faceless, AI-generated
cosmic-horror Shorts: the universe is bigger, stranger, and more terrifying than
you think, in 30-second hits.

> **Channel name is a placeholder.** "Cosmic Dread" is a strong, brandable
> starting point — if you change it, update `tools/niche.json` and every tool
> follows.

This is written to be acted on. Work top to bottom.

---

## 0. Why this niche wins

- **AI-visual-native.** Black holes, dying stars, rogue planets, cosmic voids —
  you can't film these, but you can *generate* them, and they look stunning. The
  AI generation is a feature, not a crutch.
- **Massive evergreen audience.** "The universe is terrifying" is one of the
  biggest curiosity lanes on YouTube. Space content gets views in any year.
- **Endless material.** Real astronomy gives you a bottomless well of true,
  jaw-dropping facts. You'll never run dry.
- **Built-in tone.** Ominous, awe-inducing, calm-narrator-describing-the-abyss.
  Consistent voice = instant brand.

The single biggest lever at your size is **consistency × hook quality.**
Everything below serves those two.

---

## 1. The one thing that matters most: the first 2 seconds

Shorts live or die on **swipe-away rate** in the first ~2 seconds. YouTube shows
your Short to a small test batch; if they don't swipe away, it widens the
audience. Cosmic content is inherently gripping — the job is to *promise* that
awe instantly.

**Open with the payoff, not a build-up.** Show the most striking visual and state
the stakes in the first frame.

Bad open: "Hey everyone, today we're going to talk about black holes…"
Good open: *"This is what happens if you fall into a black hole."*

Hook formulas that fit this niche (the idea generator uses these):
- "This is what happens if you fall into {object}."
- "This is the largest / loneliest / deadliest thing in the universe."
- "Something is pulling our galaxy toward it — and we can't see what."
- "What if the Sun vanished right now?"
- "There's a monster at the center of our galaxy."

**On-screen text** should restate the hook (most people watch muted). Big,
high-contrast, top third of the frame.

---

## 2. Packaging: title, first frame, hashtags

Run every upload through `tools/optimize_metadata.py` before posting.

- **Title** under ~60 chars, opens with a hook word, contains a niche keyword
  ("black hole", "universe", "galaxy"), no hashtags in the title.
- **First frame = your thumbnail.** Make frame 1 your most arresting visual (a
  glowing black hole, a dying star), never a logo or title card.
- **Description**: 2–3 lines + a subscribe CTA + hashtags. Always include
  `#shorts` plus your core set `#space #universe #cosmos #astronomy #blackhole`,
  rotating in `#cosmichorror`, `#spacefacts`, `#physics`.
- **Tags**: 10–15, mixing broad (`space`, `universe`) and specific (`blackhole`,
  `gammarayburst`, `roguePlanet`).

---

## 3. Content system: series, not one-offs

Random one-offs don't compound. **Named series** train viewers to binge and
subscribe. Badge each Short with its series name in on-screen text:

| Series | Format | Why it works |
|---|---|---|
| **Space Horror** | The genuinely terrifying real stuff — black holes, rogue planets, gamma-ray bursts | Fear + awe is the strongest scroll-stopper |
| **Cosmic Giants** | The biggest / densest / most extreme objects, with scale comparisons | Scale shock is inherently gripping |
| **The End** | Heat death, the dying Sun, the far future of everything | Existential stakes; deeply shareable |
| **What If** | Cosmic hypotheticals answered ("if the Sun vanished…") | Curiosity gap built into the premise |
| **Unexplained** | Things science can't fully explain (the Great Attractor, dark matter) | Mystery drives comments and re-watches |

Each series = a playlist + a consistent intro style. Use `tools/generate_ideas.py`
to fill the pipeline (`--use-claude --theme "rogue planets"` to batch one angle).

**Also post 1–2 long-form videos per month** (5–10 min) compiling a series or
going deep on one object. Shorts win subscribers; long-form wins watch-time and
bigger ad revenue, and gives the algorithm a reason to recommend your channel.
Pin a Short that funnels to your best long-form.

---

## 4. Cadence: the realistic schedule

- **Target: 1 Short/day, or at minimum 4–5/week.** Frequency buys algorithmic
  at-bats while you're small — and your AI pipeline makes daily feasible.
- **Batch production.** Generate 15–20 ideas at once, script/produce in one
  session, schedule them out. Never produce one at a time — that's where
  consistency dies.
- **Posting time:** start from whatever `analyze_channel.py` reports, then
  confirm against YouTube Studio's "when your viewers are online."
- Hold a consistent look (palette, narration voice, music bed, outro).

---

## 5. Retention craft (the editing rules)

- **Pace cuts every 1.5–3 seconds.** Static space shots kill retention — keep the
  camera drifting, zooming, or revealing.
- **No dead air at the start.** Cut straight to the hook visual.
- **One idea per Short.** One object, one mind-bending fact.
- **End on a loop or a question.** "You've been orbiting it your whole life."
  invites a re-watch and a comment.
- **Length:** 20–35 seconds is the sweet spot for one fact + one reveal.

---

## 6. Turn viewers into a community

- **Ask one specific question** in the caption or final frame ("Black holes or
  the Great Attractor — which keeps you up at night?"). Comments are a ranking
  signal *and* your best source of next ideas.
- **Reply to early comments** in the first hour — boosts the comment signal while
  the Short is in its test batch.
- **Pin a comment** with a bonus fact or a tease of the next episode.
- Mine "but what about…?" comments — each is a ready-made next Short.

---

## 7. The 30-day starter plan

1. **Week 1 — Foundation.** Lock your channel name + the 5 series + a consistent
   template (palette, voice, music, outro). Run `analyze_channel.py` to baseline.
   Produce and schedule the 10 ready-made scripts in `FIRST_10_SHORTS.md`.
2. **Week 2 — Volume.** Post daily. Every upload through `optimize_metadata.py`
   first. Reply to every comment.
3. **Week 3 — Double down.** Re-run `analyze_channel.py`. Whatever over-performed,
   make more in that exact format — same series, same hook shape, new object.
4. **Week 4 — Expand.** Publish your first long-form compilation. Pin a Short that
   points to it. Review the month and set next month's single focus metric.

---

## 8. What success looks like, in order

Don't chase subscribers first — they're a lagging indicator. Watch in order:

1. **Swipe-away rate** ↓ (YouTube Studio → retention on each Short)
2. **Average views per Short** ↑ (the toolkit reports this)
3. **Comments per Short** ↑
4. **Subscribers** ↑ (follows from the first three)

Pick **one** as the month's focus and optimize only for it.

---

### Tooling quick reference

| Goal | Command |
|---|---|
| Baseline the channel, find best posting time | `python tools/analyze_channel.py --channel "@CosmicDread"` |
| Check a title/description/tags before posting | `python tools/optimize_metadata.py --file upload.json` |
| AI-rewrite a weak title | `python tools/optimize_metadata.py --title "…" --use-claude` |
| Fill the idea pipeline | `python tools/generate_ideas.py -n 20` |
| Batch a single series | `python tools/generate_ideas.py -n 10 --use-claude --theme "The End"` |
