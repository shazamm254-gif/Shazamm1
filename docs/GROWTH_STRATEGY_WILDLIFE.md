# Wild Secrets — YouTube Shorts Growth Playbook

A practical, channel-specific plan for **Wild Secrets** — faceless,
AI-generated wildlife Shorts: BBC-Earth-level documentary storytelling about
the animal kingdom's most extreme adaptations, showdowns, and survival
tricks, in 45–60 second hits.

> **Channel name is a placeholder.** "Wild Secrets" pairs with the
> `animal_extremes` category `tools/niche_generator.py` already scores at
> demand 7 / competition 6 / evergreen 9 / feasibility 9. If you change the
> name, update `tools/niche-wildlife.json` and every tool follows (pass
> `--niche-file niche-wildlife.json`).

This is written to be acted on. Work top to bottom.

---

## 0. Why this niche wins

- **Bottomless, evergreen material.** Millions of species, each with
  adaptations stranger than fiction — you will never run out of verified
  facts, and none of them go stale.
- **Built-in visual spectacle.** Wildlife is inherently cinematic — this is
  the easiest niche to make AI-generated visuals look like a premium
  documentary rather than a stock-photo slideshow.
- **Trust compounds fast.** Because every fact is checkable, a channel that
  is consistently accurate builds credibility other niches can't match —
  and credibility drives subscriptions and shares.
- **Format is proven at massive scale.** "Nature is metal" wildlife content
  already dominates Shorts and TikTok; the opportunity is doing it with
  tighter curiosity-gap hooks and better narration than most accounts.

The single biggest lever at your size is **consistency × hook quality ×
factual credibility.** Everything below serves those three.

---

## 1. The one thing that matters most: the first 2 seconds

Shorts live or die on **swipe-away rate** in the first ~2 seconds. This
niche's advantage is that a genuinely strange, true animal fact is one of
the strongest scroll-stoppers that exists — the job is compressing the
"wait, what?" into the very first sentence.

**Open with the reveal's shadow, not a build-up.** Promise something
unbelievable and true, immediately.

Bad open: "Hey everyone, today we're talking about a cool ocean worm…"
Good open: *"This worm lives with fire on one end and ice on the other, at the same time."*

Hook formulas that fit this niche (the idea generator uses these):
- "This animal has outsmarted scientists for decades."
- "Scientists still can't fully explain what {x} does."
- "{x} should not be able to survive this. Here's how it does."
- "This predator has a secret nobody expected."
- "{x} just broke a rule biology said was impossible."

**On-screen text** should restate the hook in 3–5 words (most people watch
muted). Big, high-contrast, top third of the frame.

---

## 2. Packaging: title, first frame, hashtags

Run every upload through `tools/optimize_metadata.py` before posting.

- **Title** under ~60 chars, opens with the curiosity gap ("This shark
  could be…", "The fastest animal on Earth isn't…"), contains a niche
  keyword (the animal or phenomenon), no hashtags in the title.
- **First frame = your thumbnail.** Make frame 1 your most arresting
  visual (the extreme close-up, the mid-strike moment) — never a logo or
  title card.
- **Description**: 2–3 lines + a subscribe CTA + hashtags. Always include
  `#shorts` plus your core set `#wildlife #animals #nature #natureismetal
  #animalfacts`.
- **Tags**: 10–15, mixing broad (`wildlife`, `animals`, `nature`) and
  specific (`deepsea`, `venom`, `predator`, `matingritual`).

---

## 3. Content system: series, not one-offs

Random one-offs don't compound. **Named series** train viewers to binge and
subscribe. Badge each Short with its pillar name in on-screen text:

| Series | Format | Why it works |
|---|---|---|
| **Extreme Adaptations** | Animals surviving conditions that should kill them | Pure "wait, what?" — the clearest curiosity gap in the niche |
| **Predator vs. Prey Showdowns** | Hunting strategies, ambushes, and cooperative kills | High-energy, inherently visual, strong watch-to-completion |
| **Venom & Parasites** | Toxins, mind control, and biological warfare in nature | Fear + fascination; among the highest share/save rate formats |
| **Record-Holding Animals** | The fastest, oldest, deadliest, or largest, verified | Easy, evergreen search demand ("fastest animal on Earth") |
| **Bizarre Mating & Survival Rituals** | Courtship, sacrifice, and reproduction strategies | Emotional range from awe to heartbreak; strong comment driver |

Each series = a playlist + a consistent intro style. Use
`tools/generate_ideas.py --niche-file niche-wildlife.json` to fill the
pipeline (`--use-claude --theme "venom"` to batch one angle), or use the
full system prompt in `docs/WILDLIFE_AI_SYSTEM_PROMPT.md` for
production-ready scripts with complete shot lists.

**Also post 1–2 long-form videos per month** (5–10 min) compiling a series
or going deep on one animal (e.g. "everything we know about the Greenland
shark"). Shorts win subscribers; long-form wins watch-time and bigger ad
revenue. Pin a Short that funnels to your best long-form.

---

## 4. Cadence: the realistic schedule

- **Target: 1 Short/day, or at minimum 4–5/week.** Frequency buys
  algorithmic at-bats while you're small — and your AI pipeline makes daily
  feasible.
- **Batch production.** Generate 15–20 ideas at once, script/produce in one
  session, schedule them out. Never produce one at a time — that's where
  consistency dies.
- **Posting time:** start from whatever `analyze_channel.py` reports, then
  confirm against YouTube Studio's "when your viewers are online."
- Hold a consistent look (palette, narration voice, music bed, outro) —
  see `docs/WILDLIFE_AI_SYSTEM_PROMPT.md` for the shared visual language
  used across every prompt.

---

## 5. Retention craft (the editing rules)

- **Pace cuts every 1.5–3 seconds**, with a new reveal, twist, or
  escalation every 3–5 seconds. A static animal shot kills retention — keep
  finding the next beat (a new detail, a comparison, a consequence).
- **No dead air at the start.** Cut straight to the hook visual.
- **One animal, one mechanism, one "wait, really?" per Short.** Resist the
  urge to cram in three facts — depth on one beats a list of three.
- **End on a loop or a question.** "It's been down there since before your
  country had a name" invites a re-watch and a comment.
- **Length:** 45–60 seconds is this niche's sweet spot — long enough to
  build a real reveal, short enough to hold 90%+ retention.
- **Never invent or exaggerate a stat.** Flag contested or estimated
  science honestly in the narration itself. Credibility compounds
  subscriber trust in this niche faster than almost any other.

---

## 6. Turn viewers into a community

- **Ask one specific, concrete question** in the caption or final frame
  ("Which one of these would you least want to run into?"). Specific beats
  generic ("thoughts?").
- **Reply to early comments** in the first hour — boosts the comment signal
  while the Short is in its test batch.
- **Pin a comment** with a bonus fact or a tease of the next episode.
- Mine "what about X animal?" and "do a video on Y" comments — each is a
  ready-made next Short, and shows viewers you're listening.

---

## 7. The 30-day starter plan

1. **Week 1 — Foundation.** Lock your channel name + the 5 pillars + a
   consistent template (palette, voice, music, outro). Run
   `analyze_channel.py` to baseline. Produce and schedule the 10 ready-made
   scripts in `FIRST_10_SHORTS_WILDLIFE.md`.
2. **Week 2 — Volume.** Post daily. Every upload through
   `optimize_metadata.py` first. Reply to every comment.
3. **Week 3 — Double down.** Re-run `analyze_channel.py`. Whatever
   over-performed, make more in that exact format — same pillar, same hook
   shape, new animal.
4. **Week 4 — Expand.** Publish your first long-form compilation. Pin a
   Short that points to it. Review the month and set next month's single
   focus metric.

---

## 8. What success looks like, in order

Don't chase subscribers first — they're a lagging indicator. Watch in
order:

1. **Swipe-away rate** ↓ (YouTube Studio → retention on each Short)
2. **Average views per Short** ↑ (the toolkit reports this)
3. **Comments per Short** ↑
4. **Subscribers** ↑ (follows from the first three)

Pick **one** as the month's focus and optimize only for it.

---

### Tooling quick reference

| Goal | Command |
|---|---|
| Baseline the channel, find best posting time | `python tools/analyze_channel.py --channel "@wildsecrets"` |
| Check a title/description/tags before posting | `python tools/optimize_metadata.py --file upload.json` |
| AI-rewrite a weak title | `python tools/optimize_metadata.py --title "…" --use-claude` |
| Fill the idea pipeline | `python tools/generate_ideas.py -n 20 --niche-file niche-wildlife.json` |
| Batch a single series | `python tools/generate_ideas.py -n 10 --use-claude --theme "venom" --niche-file niche-wildlife.json` |
| Generate a full production-ready script | Paste `docs/WILDLIFE_AI_SYSTEM_PROMPT.md` into Claude with one verified fact |
| Explore more niche options / re-score this one | `python tools/niche_generator.py --parent "animal_extremes" -n 12` |
