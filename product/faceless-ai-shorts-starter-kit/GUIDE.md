# The Faceless AI Shorts Playbook

The complete system for launching and growing a faceless, AI-generated YouTube
Shorts channel. Read it once end to end, then use it as a reference.

> **The core promise of faceless AI:** you can produce a week of content in one
> sitting, with no camera and no on-screen presence — *if* you build a repeatable
> pipeline. This guide is that pipeline.

---

## 1. Pick a niche that can actually win

Faceless AI works best in niches that are **visual, curiosity-driven, evergreen,
and advertiser-friendly.** Score any niche idea against these five:

1. **AI-visual-native** — can stunning visuals be *generated*, not filmed? (Space, mythology, history, nature, sci-fi: yes. Daily vlogs: no.)
2. **Curiosity hooks** — does every topic raise an instant "wait, what?" question?
3. **Evergreen** — will the videos still get views in a year? (Avoid pure trend-chasing.)
4. **Bingeable** — can you make 100+ videos in it without running dry?
5. **Monetizable & safe** — advertiser-friendly, not a YouTube-policy minefield.

**Strong faceless-AI niches** (all five boxes): cosmic/space mysteries,
mythology & ancient gods, unsolved mysteries & deep ocean, speculative
science/future evolution, history's dark stories, psychology/"why you do X",
animal facts & "what if" biology.

**Validate before committing:** search the niche on YouTube Shorts. You want to
see channels getting views (proof of demand) but room to do it better (better
hooks, a sharper angle). No competition = no audience; total saturation by
high-quality channels = hard to break in. You want the middle.

**Pick ONE angle and name it.** "Space" is too broad. "The universe is
terrifying — cosmic facts that mess with your head" is a channel. The sharper
the angle, the faster you build a recognizable identity.

➡️ Once chosen, fill in the niche config (`TEMPLATES.md` → Channel Config) and
drop it into `tools/niche.json`. Every tool in this kit now works for your niche.

---

## 2. The first 2 seconds are 80% of the game

Shorts succeed or fail on **swipe-away rate**. YouTube shows your Short to a
small test batch; if they don't swipe away, it widens the audience. Everything
else is secondary to surviving the first ~2 seconds.

**Rules of the hook:**
- **Open with the payoff, not a build-up.** Show the most striking visual and
  state the stakes in frame 1. Never "Hi, today we'll look at…".
- **Restate the hook as on-screen text** (most people watch muted first). Big,
  high-contrast, top third of the frame.
- **Create a curiosity gap** — promise an answer you only deliver at the end.

Universal hook formulas (swap in your niche):
- "This is what happens when {X}…"
- "Scientists discovered {Y}. The result is terrifying."
- "What if {scenario}? Here's the answer."
- "Nobody talks about {X}. Here's why they should."
- "The {thing} you were never told about."
- "{Number} {things} that shouldn't be possible."

➡️ The kit's **Hook Vault** (`TEMPLATES.md`) gives you 100+ of these. The idea
generator (`tools/generate_ideas.py`) fills them with your niche automatically.

---

## 3. The AI production pipeline (build it once)

A faceless Short is four layers: **script → visuals → voiceover → edit.** Your
job is to make each layer fast and repeatable. Recommended tool categories
(pick one per layer and stick with it — consistency is a feature):

| Layer | What you need | Notes |
|---|---|---|
| **Script** | This kit's templates + idea generator | Write 10 at a time, not one. |
| **Visuals** | An AI image generator (Midjourney, DAL·E, Leonardo, Flux, etc.) and/or AI video (Runway, Kling, Sora-class, Pika) | Generate a consistent *style* — same palette, lighting, mood across every Short. That visual signature is your brand. |
| **Voiceover** | An AI voice (ElevenLabs and similar) or your own mic | Pick ONE voice and keep it. Slow it ~10% for a documentary feel. |
| **Edit** | CapCut, Premiere, or any editor | One music bed, fast cuts (1.5–3s), captions burned in. |

**The batching workflow (this is the whole trick):**
1. **Ideate:** generate 15–20 ideas in one session.
2. **Script:** write all of them using the template (an afternoon).
3. **Visuals:** generate every Short's images/clips back to back.
4. **Voice:** record all voiceovers in one sitting.
5. **Edit + schedule:** assemble and schedule one per day for the next 1–2 weeks.

Producing one video at a time is how channels die. Batch, schedule, repeat.

**Stay on the right side of YouTube's reused-content / AI policy:** YouTube
removes and demonetizes low-effort, mass-produced AI "slideshow spam." The fix
is built into this system — **original scripts and a coherent narrative voice**,
so the AI visuals serve a real story. Make it intentional, not a slideshow.

---

## 4. Packaging: title, first frame, hashtags

For Shorts, the **first frame is your thumbnail** in the feed, grid, and search.
Treat it as one. (Also set a custom thumbnail for the grid.)

- **Title:** under ~60 chars, opens with a hook word, contains a niche keyword,
  no hashtags in the title.
- **First frame:** your single most arresting visual + ≤4 words of high-contrast
  text in the top third (the Shorts UI covers the bottom/right).
- **Description:** 2–3 lines of context + a subscribe CTA + hashtags (always
  include `#shorts` plus your niche set).
- **Tags:** 10–15, mixing broad and specific.

➡️ Run every upload through `tools/optimize_metadata.py` before posting. The full
first-frame checklist is in `docs/THUMBNAIL_CHECKLIST.md`.

---

## 5. Build series, not one-offs

Random videos don't compound; **named series do.** They train viewers to binge
and subscribe. Build 3–4 recurring formats, badge each Short with the series
name, and give each its own playlist. Example shapes that work in any niche:

- **"The [X] Files"** — one mystery/subject per episode.
- **"What if…"** — a hypothetical, answered.
- **"Ranked / Top N"** — escalating countdowns.
- **"Explained in 30s"** — one concept, fast.

Also publish **1–2 long-form videos per month** (3–8 min) compiling a series.
Shorts win subscribers; long-form wins watch-time and bigger ad revenue, and
gives the algorithm a reason to recommend your *channel*. Pin a Short that
funnels to your best long-form.

---

## 6. Cadence & growth

- **Post daily, or at minimum 4–5×/week.** Frequency buys algorithmic at-bats
  while you're small — and your AI pipeline makes daily feasible.
- **Consistent look + voice** across every Short = recognition = subscribers.
- **Reply to early comments** in the first hour (boosts the comment signal while
  the Short is in its test batch).
- **End on a loop or a question** to drive re-watches and comments.
- **Double down on winners.** Re-run `tools/analyze_channel.py` weekly; whatever
  over-performs, make more in that *exact* format.

**Watch these metrics in order** (don't chase subs first):
1. Swipe-away rate ↓ (YouTube Studio)
2. Average views per Short ↑
3. Comments per Short ↑
4. Subscribers ↑ (follows from the first three)

Pick ONE as the month's focus and optimize only for it.

---

## 7. The 30-day launch plan

- **Week 1 — Foundation.** Choose + name your niche and angle. Fill the config.
  Set up your 4-layer pipeline (one tool each). Define 3–4 series + a consistent
  template (font, voice, outro). Batch-generate 20 ideas.
- **Week 2 — Volume.** Post daily. Every upload goes through the metadata linter
  first. Reply to every comment.
- **Week 3 — Double down.** Re-run the analyzer. Whatever over-performed, make
  more in that exact format. Tighten your hooks.
- **Week 4 — Expand.** Publish your first long-form compilation. Pin a Short that
  points to it. Review the month and set next month's single focus metric.

---

## 8. Monetization (where the money actually comes from)

Ad revenue on a new channel is slow. Stack these instead:

1. **YouTube Partner Program** — Shorts monetization kicks in once eligible; treat it as a bonus, not the plan.
2. **Digital products to your audience** — wallpaper/art packs, an illustrated
   "lore" ebook, posters. Cheap impulse buys, linked in your bio (Gumroad/Etsy/Ko-fi)
   and pinned comments.
3. **Digital products to other creators** — prompt packs, templates, a starter
   kit like this one. The "faceless AI" market is hot and buys *before* you have
   a big audience.
4. **Affiliate links** — the AI tools you use (voice, image, video) often pay
   referral commissions. Put them in your bio.
5. **Sponsorships** — once you have traction, AI/tech tools sponsor faceless
   channels in their exact niche.

Build the channel as the funnel; build the product as the payout. One feeds the
other.

---

### The whole system in one line

**Pick a sharp niche → build a 4-layer AI pipeline → batch content weekly →
win the first 2 seconds → post daily → double down on winners → sell a product
to the audience you build.** That's it. Now go feed the system.
