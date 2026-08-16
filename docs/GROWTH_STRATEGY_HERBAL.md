# Herbs Decoded — YouTube Shorts Growth Playbook

A practical, channel-specific plan for **Herbs Decoded** — faceless herbal
explainer Shorts: the real chemistry, history, and honest evidence behind the
plants in your kitchen, in 30-second hits.

> **Channel name is a placeholder.** If you change it, update
> `tools/niche-herbal.json` and every tool follows (pass
> `--niche-file niche-herbal.json`).

This is written to be acted on. Work top to bottom.

---

## 0. Why this niche wins

- **Everyone owns the props.** Mint, garlic, ginger, chamomile tea — viewers
  have the subject of the video in their kitchen right now. "The thing you
  already own is secretly interesting" is one of the most reliable Shorts
  angles there is.
- **The honesty gap is wide open.** The herbal/wellness space is saturated
  with overclaiming ("this root cures everything"). A channel whose whole
  brand is *"here's what the studies actually say"* stands out instantly, and
  earns the trust that converts views into subscribers.
- **Mechanism = payoff.** Every herb hides a genuine "wait, really?" — mint
  hacks cold receptors, garlic's compound doesn't exist until you crush it,
  aspirin started as bark. Real chemistry delivers the reveal a hook promises.
- **Cheap, beautiful footage.** Macro shots of real herbs, steam off a mug,
  a clove being crushed — shot on a phone, this niche looks premium for free.

The single biggest lever at your size is **consistency × hook quality.**
Everything below serves those two.

**The standing rule (non-negotiable):** never claim an herb *cures, treats,
heals, or prevents* anything — not in titles, thumbnails, on-screen text, or
voiceover. YouTube suppresses and can strike medical misinformation, and one
overclaim undoes the honesty brand. Every description carries
*"Educational only — not medical advice."*

---

## 1. The one thing that matters most: the first 2 seconds

Shorts live or die on **swipe-away rate** in the first ~2 seconds. YouTube
shows your Short to a small test batch; if they don't swipe away, it widens
the audience. This niche's advantage: the viewer *owns* the subject — so make
the hook about the thing in their kitchen, not about "herbalism."

**Open with the contradiction, not a build-up.** The strongest hooks here
flip something the viewer assumes about a familiar plant.

Bad open: "Hey everyone, today let's talk about the benefits of peppermint…"
Good open: *"Mint doesn't cool your mouth. It hacks your nerves."*

Hook formulas that fit this niche (the idea generator uses these):
- "Here's what {x} actually does inside your body."
- "Everyone believes this about {x}. The studies say otherwise."
- "{x} is not what you think it is."
- "Why {x} works — and when it doesn't."
- "The real story behind {x} nobody tells you."

**On-screen text** should restate the hook (most people watch muted). Big,
high-contrast, top third of the frame.

---

## 2. Packaging: title, first frame, hashtags

Run every upload through `tools/optimize_metadata.py` before posting.

- **Title** under ~60 chars, opens with the contradiction or question ("Mint
  doesn't actually…", "Does echinacea actually work?"), contains a niche
  keyword (the herb's name — it *is* the search term), no hashtags in the
  title. Never a cure/treat/prevent claim.
- **First frame = your thumbnail.** One herb, huge in frame, on a dark
  background — never a logo or title card.
- **Description**: 2–3 lines + the disclaimer line + a subscribe CTA +
  hashtags. Always include `#shorts` plus your core set
  `#herbs #herbalism #plantscience #tea #foodscience`.
- **Tags**: 10–15, mixing broad (`herbs`, `foodscience`) and specific — the
  herb and compound names (`peppermint`, `menthol`, `turmeric`, `curcumin`,
  `allicin`). Compound names catch the search traffic competitors miss.

---

## 3. Content system: series, not one-offs

Random one-offs don't compound. **Named series** train viewers to binge and
subscribe. Badge each Short with its pillar name in on-screen text:

| Series | Format | Why it works |
|---|---|---|
| **Kitchen Herbs Explained** | The surprising science of one everyday herb or spice | Viewer owns the prop; instant relevance |
| **How It Actually Works** | One compound, one mechanism, one reveal (menthol, allicin, linalool) | The "wait, really?" payoff drives shares |
| **The Honest Answer** | One herb, what the studies actually show, verdict in one line | The differentiator — trust converts to subs |
| **Plants That Became Medicine** | History: willow → aspirin, cinchona → quinine, foxglove → heart drugs | Story format; high watch-through |
| **Never Buy It Again** | Grow-it-from-a-cutting basics (mint, basil, green onions) | Highest share/save rate; comment-bait ("day 7 update") |

Each series = a playlist + a consistent intro style. Use
`tools/generate_ideas.py --niche-file niche-herbal.json` to fill the pipeline
(`--use-claude --theme "kitchen spices"` to batch one angle).

**Also post 1–2 long-form videos per month** (5–10 min) compiling a series or
going deep on one story (e.g. "every modern drug that started as a plant").
Shorts win subscribers; long-form wins watch-time and bigger ad revenue. Pin
a Short that funnels to your best long-form.

---

## 4. Cadence: the realistic schedule

- **Target: 1 Short/day, or at minimum 4–5/week.** Frequency buys algorithmic
  at-bats while you're small.
- **Batch production.** Generate 15–20 ideas at once, script/produce in one
  session, schedule them out. Herbs make this easy: one trip to the market =
  b-roll for ten episodes. Never produce one at a time.
- **Posting time:** start from whatever `analyze_channel.py` reports, then
  confirm against YouTube Studio's "when your viewers are online." Wellness
  audiences often over-index mornings and Sunday evenings — test it.
- Hold a consistent look (palette, narration voice, music bed, outro).

---

## 5. Retention craft (the editing rules)

- **Pace cuts every 1.5–3 seconds.** Macro herb footage is gorgeous but
  static — keep hands moving, steam rising, diagrams building.
- **No dead air at the start.** Cut straight to the contradiction + the herb
  in frame.
- **One idea per Short.** One herb, one compound, one mechanism. "Ginger and
  nausea" is an episode; "ginger's benefits" is a swipe-away.
- **End on a loop or a question.** "You're not chopping garlic. You're
  triggering it." invites a re-watch; "what smell calms you instantly?"
  invites a comment.
- **Length:** 20–35 seconds is the sweet spot for one fact + one reveal.
- **State the evidence level, always.** "Trial after trial keeps passing" vs.
  "smaller, promising studies" vs. "the research is genuinely mixed." This is
  the brand — precision *is* the personality. Credibility compounds.

---

## 6. Turn viewers into a community

- **Ask one specific, personal question** in the caption or final frame
  ("What's the one herb your family swears by? I'll test the claim."). Every
  household has herbal folklore — mine it.
- **Reply to early comments** in the first hour — boosts the comment signal
  while the Short is in its test batch.
- **Pin a comment** with a source or a bonus fact — receipts reinforce the
  honest-explainer brand.
- Mine "my grandmother always said…" and "do one on X" comments — each is a
  ready-made next Short, and "The Honest Answer" format can take *any*
  claim viewers submit.
- **Grow-along formats** (#10-style rooting experiments) create return
  visits: "day 7 update in comments" brings viewers back on a schedule.

---

## 7. The 30-day starter plan

1. **Week 1 — Foundation.** Lock your channel name + the 5 pillars + a
   consistent template (palette, voice, music, outro). Run
   `analyze_channel.py` to baseline. Produce and schedule the 10 ready-made
   scripts in `FIRST_10_SHORTS_HERBAL.md`.
2. **Week 2 — Volume.** Post daily. Every upload through
   `optimize_metadata.py` first. Reply to every comment.
3. **Week 3 — Double down.** Re-run `analyze_channel.py`. Whatever
   over-performed, make more in that exact format — same pillar, same hook
   shape, new herb.
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
| Baseline the channel, find best posting time | `python tools/analyze_channel.py --channel "@herbsdecoded"` |
| Check a title/description/tags before posting | `python tools/optimize_metadata.py --file upload.json` |
| AI-rewrite a weak title | `python tools/optimize_metadata.py --title "…" --use-claude` |
| Fill the idea pipeline | `python tools/generate_ideas.py -n 20 --niche-file niche-herbal.json` |
| Batch a single series | `python tools/generate_ideas.py -n 10 --use-claude --theme "kitchen spices" --niche-file niche-herbal.json` |
| Explore more niche options / sub-niches | `python tools/niche_generator.py --parent "herbal" -n 12` |
