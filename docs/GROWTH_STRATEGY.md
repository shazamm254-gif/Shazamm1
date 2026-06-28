# Project 3000 — YouTube Shorts Growth Playbook

A practical, channel-specific plan for **@Project3000Official** — AI-generated
simulations of the future of evolution (speculative biology, future humans,
post-apocalyptic survival, Earth & Mars in the next millennium).

This is written to be acted on, not admired. Work top to bottom.

---

## 0. Where the channel is today

- **~15K total views**, channel created Jan 2017 (effectively a relaunch in the
  AI era — that's fine, the date doesn't matter to viewers).
- A **strong, specific niche** — speculative evolution is an under-served,
  high-curiosity topic with a built-in audience (fans of speculative-zoology
  creators, "future of humans" videos, sci-fi worldbuilding). This is your
  biggest asset. Do **not** dilute it.
- All content is AI-generated, which is a feature: it lets you produce volume
  and visualize things no camera could. Lean into it as a hook, not a disclaimer.

The single biggest lever at your size is **consistency × hook quality**. Everything
below serves those two.

---

## 1. The one thing that matters most: the first 2 seconds

Shorts live or die on **swipe-away rate** in the first ~2 seconds. The algorithm
shows your Short to a small test batch; if they don't swipe away, it widens the
audience. Your topic is inherently fascinating — the job is to *promise* that
fascination instantly.

**Open with the payoff, not a build-up.** Show the most striking creature/visual
and state the stakes in the first frame.

Bad open: "Hi, today we're going to look at how humans might evolve…"
Good open: *"In the year 3000, humans no longer have eyes. Here's why."*

Hook formulas that fit this niche (the idea generator uses these):
- "In the year 3000, {X} no longer exists. Here's what replaced it."
- "This is what humans will look like after 10,000 years on Mars."
- "Scientists simulated a million years of evolution. The result is terrifying."
- "If the oceans boiled tomorrow, this is the creature that survives."
- "The last human on Earth won't look human at all."

**On-screen text** should restate the hook (most people watch muted at first).
Big, high-contrast, top third of the frame, gone or evolving by second 3.

---

## 2. Packaging: title, thumbnail-frame, hashtags

Run any upload through `tools/optimize_metadata.py` before posting. The rules it
checks, summarized:

- **Title** under ~60 chars, opens with a hook word, contains a niche keyword
  (e.g. "future evolution", "post-human", "year 3000"), no hashtags in the title.
- **First frame matters even for Shorts** — the feed and your channel grid both
  show it. Make frame 1 your most arresting visual, not a logo or title card.
- **Description**: 2–3 lines of context + a subscribe CTA + hashtags. Always
  include `#shorts` plus your core set `#AI #Evolution #SciFi #Futurism
  #SpeculativeBiology`, and rotate in specifics like `#speculativezoology`,
  `#posthuman`, `#mars`, `#deeptime`.
- **Tags**: 10–15, mixing broad (`scifi`, `evolution`) and specific
  (`speculativezoology`, `futureevolution`).

---

## 3. Content system: series, not one-offs

Random one-offs don't compound. **Named series** do — they train viewers to
binge and subscribe. Build 3–4 recurring formats and badge each Short with the
series name in on-screen text:

| Series idea | Format | Why it works |
|---|---|---|
| **"Year 3000"** | Pick one familiar thing (the human hand, house cats, forests) → show its far-future form | Familiar → strange is the core curiosity loop |
| **"Last Survivor"** | A catastrophe (boiled oceans, frozen Earth, Mars) → the one creature that adapts | Built-in stakes and a "winner" reveal |
| **"Post-Human"** | How humans specifically change for Mars / deep sea / zero light | Self-relevance — people care about *their* species |
| **"Deep Time"** | Earth at +1M, +10M, +100M years, as a countdown | Scale and escalation are inherently gripping |

Each series = a playlist + a consistent intro style. Use `tools/generate_ideas.py`
to fill the pipeline (and `--theme "Last Survivor"` to batch a single series).

**Also post 1–2 long-form videos per month** (3–8 min) that compile a series or
go deeper. Shorts win subscribers; long-form is where watch-time and the bigger
ad money live, and it gives the algorithm a reason to recommend your channel,
not just individual Shorts. Pin a Short that funnels to your best long-form.

---

## 4. Cadence: the realistic schedule

- **Target: 1 Short/day, or at minimum 4–5/week.** Frequency is how you buy
  algorithmic at-bats while you're small. Your AI pipeline makes daily feasible.
- **Batch production.** Generate 15–20 ideas at once, script/produce in a single
  session, schedule them out. Don't produce one at a time — that's where
  consistency dies.
- **Posting time:** start from whatever `analyze_channel.py` reports as your best
  day/hour, then confirm against YouTube Studio's "when your viewers are online."
- Hold a consistent look (font, narration voice, color grade, outro). Recognition
  across Shorts is what converts a viewer into a subscriber.

---

## 5. Retention craft (the editing rules)

- **Pace cuts every 1.5–3 seconds.** Static shots kill Shorts.
- **No dead air at the start.** Cut straight to the hook; trim the first 0.5s.
- **One idea per Short.** If it needs two reveals, it's two Shorts.
- **End on a loop or a question.** A Short that loops cleanly gets re-watched,
  which inflates view-time. End with "…and that's just 1,000 years from now" to
  invite a re-watch or a comment.
- **Length:** 15–34 seconds is the sweet spot for a tight reveal. Longer only if
  every second earns its place.

---

## 6. Turn viewers into a community

- **Ask one specific question** in the caption or final frame ("Earth or Mars —
  which evolves the scarier human?"). Comments are a ranking signal *and* your
  best source of next ideas.
- **Reply to early comments** in the first hour — it boosts the comment count
  while the Short is in its test batch.
- **Pin a comment** that adds a fact or teases the next episode in the series.
- Mine comments for the "but what about ___?" questions — each is a ready-made
  next Short.

---

## 7. The 30-day starter plan

1. **Week 1 — Foundation.** Lock your 3–4 series names + a consistent template
   (font, voice, outro). Run `analyze_channel.py` to baseline your current
   top/bottom performers and best posting time. Batch-generate 20 ideas.
2. **Week 2 — Volume.** Post daily. Every upload goes through
   `optimize_metadata.py` first. Reply to every comment.
3. **Week 3 — Double down.** Re-run `analyze_channel.py`. Whatever 2–3 Shorts
   over-performed, make *more in that exact format* — same series, same hook
   shape, new subject.
4. **Week 4 — Expand.** Publish your first long-form compilation of a series. Pin
   a Short that points to it. Review the month's numbers and set next month's
   single focus metric (e.g. "average views per Short up 25%").

---

## 8. What success looks like, in order

Don't chase subscribers first — they're a lagging indicator. Watch these in order:

1. **Swipe-away rate** ↓ (YouTube Studio → audience retention on each Short)
2. **Average views per Short** ↑ (the toolkit reports this)
3. **Comments per Short** ↑
4. **Subscribers** ↑ (follows naturally from the first three)

Pick **one** of these as the month's focus and optimize only for it. Spreading
effort across all four at once is how small channels stall.

---

### Tooling quick reference

| Goal | Command |
|---|---|
| Baseline the channel, find best posting time | `python tools/analyze_channel.py --channel "@Project3000Official"` |
| Check a title/description/tags before posting | `python tools/optimize_metadata.py --file upload.json` |
| AI-rewrite a weak title | `python tools/optimize_metadata.py --title "…" --use-claude` |
| Fill the idea pipeline | `python tools/generate_ideas.py -n 20` |
| Batch a single series | `python tools/generate_ideas.py -n 10 --use-claude --theme "Last Survivor"` |
