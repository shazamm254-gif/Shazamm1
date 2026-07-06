# Dream What-Ifs — YouTube Shorts Growth Playbook

A practical, channel-specific plan for **Dream What-Ifs** — faceless,
AI-generated sleep-science Shorts: the unexplained science of sleep, dreams,
and the sleeping brain, told through vivid hypotheticals, in 30-second hits.

> **Channel name is a placeholder.** "Dream What-Ifs" was generated and
> scored by `tools/niche_generator.py` (Sleep & Dreams × What-If Scenarios,
> 78/100). If you change it, update `tools/niche-dreams.json` and every tool
> follows (pass `--niche-file niche-dreams.json`).

This is written to be acted on. Work top to bottom.

---

## 0. Why this niche wins

- **Universally relatable.** Everyone sleeps and dreams — this is one of the
  few topics where literally every viewer has personal, first-hand material
  to compare against.
- **Built-in hook formula.** The "What if…" framing is one of the strongest
  curiosity-gap formats on Shorts, and it fits sleep science perfectly —
  every phenomenon (sleep paralysis, lucid dreaming, microsleeps) is already
  a real-life "what if this happened to you."
- **Deep, credible material.** Real sleep science — REM cycles, parasomnias,
  circadian rhythm disorders — gives you a bottomless, fact-checkable well of
  content, and it's under-covered relative to how relatable it is.
- **Built-in tone.** Curious, a little eerie, always grounded in something
  true. Consistent voice = instant brand.

The single biggest lever at your size is **consistency × hook quality.**
Everything below serves those two.

---

## 1. The one thing that matters most: the first 2 seconds

Shorts live or die on **swipe-away rate** in the first ~2 seconds. YouTube
shows your Short to a small test batch; if they don't swipe away, it widens
the audience. This niche's advantage is that almost everyone has *personally*
brushed up against sleep paralysis, a recurring dream, or a microsleep — the
job is to make them feel personally implicated instantly.

**Open with the hypothetical, not a build-up.** State the "what if" as if it
could happen to the viewer tonight.

Bad open: "Hey everyone, today we're going to talk about sleep paralysis…"
Good open: *"What if you woke up completely unable to move?"*

Hook formulas that fit this niche (the idea generator uses these):
- "What if {x} happened tomorrow? Here's what would actually happen."
- "What if {x}? Scientists ran the numbers."
- "This is what {x} would actually look like."
- "Nobody's ready for what happens if {x}."
- "Here's exactly what happens when {x}."

**On-screen text** should restate the hook (most people watch muted). Big,
high-contrast, top third of the frame.

---

## 2. Packaging: title, first frame, hashtags

Run every upload through `tools/optimize_metadata.py` before posting.

- **Title** under ~60 chars, opens with a hook word ("What if…", "What
  happens…"), contains a niche keyword ("sleep paralysis", "lucid dreaming",
  "REM sleep"), no hashtags in the title.
- **First frame = your thumbnail.** Make frame 1 your most arresting visual
  (a shadow figure, a brain diagram lighting up), never a logo or title card.
- **Description**: 2–3 lines + a subscribe CTA + hashtags. Always include
  `#shorts` plus your core set `#sleep #dreams #luciddreaming #sleepparalysis
  #psychology`.
- **Tags**: 10–15, mixing broad (`sleep`, `dreams`) and specific
  (`sleepparalysis`, `luciddreaming`, `remsleep`, `circadianrhythm`).

---

## 3. Content system: series, not one-offs

Random one-offs don't compound. **Named series** train viewers to binge and
subscribe. Badge each Short with its pillar name in on-screen text:

| Series | Format | Why it works |
|---|---|---|
| **Lucid Dreaming & Dream Control** | Techniques and the neuroscience of taking control mid-dream | Aspirational + actionable; high save/share rate |
| **Sleep Paralysis & Parasomnias** | Sleep paralysis, sleepwalking, and other things the sleeping body does | Fear + personal recognition is the strongest scroll-stopper |
| **Dream Interpretation Theories** | What dreams might (or might not) mean, argued honestly | Curiosity gap; invites debate in the comments |
| **Sleep Science & Disorders** | REM cycles, circadian rhythm disorders, sleep deprivation effects | Evergreen search demand, directly relatable |
| **Unexplained Sleep Phenomena** | Shadow figures, microsleeps, and other strange edge cases | Mystery + "wait, that happened to me" drives comments |

Each series = a playlist + a consistent intro style. Use
`tools/generate_ideas.py --niche-file niche-dreams.json` to fill the pipeline
(`--use-claude --theme "sleep paralysis"` to batch one angle).

**Also post 1–2 long-form videos per month** (5–10 min) compiling a series or
going deep on one mechanism (e.g. "everything we know about sleep
paralysis"). Shorts win subscribers; long-form wins watch-time and bigger ad
revenue, and gives the algorithm a reason to recommend your channel. Pin a
Short that funnels to your best long-form.

---

## 4. Cadence: the realistic schedule

- **Target: 1 Short/day, or at minimum 4–5/week.** Frequency buys algorithmic
  at-bats while you're small — and your AI pipeline makes daily feasible.
- **Batch production.** Generate 15–20 ideas at once, script/produce in one
  session, schedule them out. Never produce one at a time — that's where
  consistency dies.
- **Posting time:** start from whatever `analyze_channel.py` reports, then
  confirm against YouTube Studio's "when your viewers are online." Late
  evening posting times may over-index for this niche — test it.
- Hold a consistent look (palette, narration voice, music bed, outro).

---

## 5. Retention craft (the editing rules)

- **Pace cuts every 1.5–3 seconds.** A static diagram kills retention — keep
  the dream imagery drifting, morphing, or revealing.
- **No dead air at the start.** Cut straight to the hypothetical/hook visual.
- **One idea per Short.** One phenomenon, one mechanism, one "wait, really?"
  moment.
- **End on a loop or a question.** "Your mind wakes up first. Your body
  catches up later." invites a re-watch and a comment.
- **Length:** 20–35 seconds is the sweet spot for one fact + one reveal.
- **Be honest about contested science.** Dream-meaning theories are genuinely
  debated among researchers — flag it rather than presenting one theory as
  settled fact. Credibility compounds subscriber trust.

---

## 6. Turn viewers into a community

- **Ask one specific, personal question** in the caption or final frame
  ("Have you ever had sleep paralysis? Tell me what you saw."). This niche's
  biggest edge is that viewers have their own stories — mine them.
- **Reply to early comments** in the first hour — boosts the comment signal
  while the Short is in its test batch.
- **Pin a comment** with a bonus fact or a tease of the next episode.
- Mine "this happened to me too" and "what about X?" comments — each is a
  ready-made next Short.

---

## 7. The 30-day starter plan

1. **Week 1 — Foundation.** Lock your channel name + the 5 pillars + a
   consistent template (palette, voice, music, outro). Run
   `analyze_channel.py` to baseline. Produce and schedule the 10 ready-made
   scripts in `FIRST_10_SHORTS_DREAMS.md`.
2. **Week 2 — Volume.** Post daily. Every upload through
   `optimize_metadata.py` first. Reply to every comment.
3. **Week 3 — Double down.** Re-run `analyze_channel.py`. Whatever
   over-performed, make more in that exact format — same pillar, same hook
   shape, new phenomenon.
4. **Week 4 — Expand.** Publish your first long-form compilation. Pin a Short
   that points to it. Review the month and set next month's single focus
   metric.

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
| Baseline the channel, find best posting time | `python tools/analyze_channel.py --channel "@dreamwhatifs"` |
| Check a title/description/tags before posting | `python tools/optimize_metadata.py --file upload.json` |
| AI-rewrite a weak title | `python tools/optimize_metadata.py --title "…" --use-claude` |
| Fill the idea pipeline | `python tools/generate_ideas.py -n 20 --niche-file niche-dreams.json` |
| Batch a single series | `python tools/generate_ideas.py -n 10 --use-claude --theme "sleep paralysis" --niche-file niche-dreams.json` |
| Explore more niche options / re-score this one | `python tools/niche_generator.py --parent "sleep" -n 12` |
