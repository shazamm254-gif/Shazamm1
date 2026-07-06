# Money Decoded — YouTube Shorts Growth Playbook

A practical, channel-specific plan for **Money Decoded** — faceless,
AI-generated personal-finance Shorts: how money, debt, and wealth actually
work, and why nobody teaches you this, in 30-second hits.

> **Channel name is a placeholder.** "Money Decoded" is a strong, brandable
> starting point — if you change it, update `tools/niche-money.json` and every
> tool follows (pass `--niche-file niche-money.json`).

This is written to be acted on. Work top to bottom.

---

## 0. Why this niche wins

- **Universally relevant.** Everyone has a paycheck, a credit card, or debt —
  personal finance content has an audience of literally everyone with a bank
  account.
- **Anxiety + curiosity drive views.** Money is one of the biggest sources of
  stress people carry, and "here's the thing nobody explained to you" is an
  irresistible hook.
- **Endless material.** Debt mechanics, investing basics, scams, psychology,
  and how the financial system moves give you a bottomless well of real,
  explainable mechanisms. You'll never run dry.
- **Built-in tone.** Direct, myth-busting educator — calm but urgent, like a
  friend finally explaining the thing nobody told you. Consistent voice =
  instant brand.

The single biggest lever at your size is **consistency × hook quality.**
Everything below serves those two.

---

## 1. The one thing that matters most: the first 2 seconds

Shorts live or die on **swipe-away rate** in the first ~2 seconds. YouTube
shows your Short to a small test batch; if they don't swipe away, it widens
the audience. Money content is inherently high-stakes — the job is to
*promise* the "wait, what?" instantly.

**Open with the payoff, not a build-up.** State the surprising fact or number
in the first frame.

Bad open: "Hey everyone, today we're going to talk about credit cards…"
Good open: *"Pay only the minimum on a credit card, and here's how long a
small balance can actually take."*

Hook formulas that fit this niche (the idea generator uses these):
- "This is what happens if you carry {object} for 10 years."
- "Banks don't want you to know this about {object}."
- "Nobody explains {object} in school. And that's the scary part."
- "What if {event}? Here's what happens to your money."
- "There's {object} eating your paycheck and you don't see it."

**On-screen text** should restate the hook (most people watch muted). Big,
high-contrast, top third of the frame.

---

## 2. Packaging: title, first frame, hashtags

Run every upload through `tools/optimize_metadata.py` before posting.

- **Title** under ~60 chars, opens with a hook word, contains a niche keyword
  ("credit score", "compound interest", "index funds"), no hashtags in the
  title.
- **First frame = your thumbnail.** Make frame 1 your most arresting visual (a
  big number, a "gotcha" chart), never a logo or title card.
- **Description**: 2–3 lines + a subscribe CTA + hashtags. Always include
  `#shorts` plus your core set `#money #personalfinance #financialliteracy
  #debt #investing`, rotating in `#moneytips`, `#wealth`, `#budgeting`,
  `#creditscore`.
- **Tags**: 10–15, mixing broad (`money`, `personalfinance`) and specific
  (`creditscore`, `compoundinterest`, `indexfunds`).

---

## 3. Content system: series, not one-offs

Random one-offs don't compound. **Named series** train viewers to binge and
subscribe. Badge each Short with its pillar name in on-screen text:

| Series | Format | Why it works |
|---|---|---|
| **Psychology of Money** | Why smart people make dumb money decisions | Self-recognition drives comments and shares |
| **How Money Really Moves** | Banks, credit, the Fed — the invisible machinery | Curiosity gap; demystifies something everyone uses blind |
| **Debt & Interest Mechanics** | Compound interest, credit scores, debt traps | Directly actionable; high save/share rate |
| **Investing Explainers** | Stocks, index funds, timing vs. time in market | Evergreen search demand, aspirational |
| **Scams & Financial Traps** | Payday loans, MLMs, get-rich-quick schemes | Outrage + protectiveness drives shares ("send this to a friend") |

Each series = a playlist + a consistent intro style. Use
`tools/generate_ideas.py --niche-file niche-money.json` to fill the pipeline
(`--use-claude --theme "credit scores"` to batch one angle).

**Also post 1–2 long-form videos per month** (5–10 min) compiling a series or
going deep on one mechanism (e.g. "how compound interest actually works").
Shorts win subscribers; long-form wins watch-time and bigger ad revenue, and
gives the algorithm a reason to recommend your channel. Pin a Short that
funnels to your best long-form.

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

- **Pace cuts every 1.5–3 seconds.** A static chart kills retention — keep
  numbers animating in, bars filling, comparisons revealing.
- **No dead air at the start.** Cut straight to the hook visual/number.
- **One idea per Short.** One mechanism, one number, one takeaway.
- **End on a loop or a question.** "The minimum was never meant to help you."
  invites a re-watch and a comment.
- **Length:** 20–35 seconds is the sweet spot for one fact + one reveal.
- **Fact-check before posting.** Rates and stats shift over time — keep the
  mechanism accurate and round numbers rather than citing a stat you can't
  currently verify.

---

## 6. Turn viewers into a community

- **Ask one specific question** in the caption or final frame ("Which one
  caught you off guard — the minimum payment trap or the payday loan math?").
  Comments are a ranking signal *and* your best source of next ideas.
- **Reply to early comments** in the first hour — boosts the comment signal
  while the Short is in its test batch.
- **Pin a comment** with a bonus fact or a tease of the next episode.
- Mine "but what about…?" and "what about [my situation]?" comments — each is
  a ready-made next Short.

---

## 7. The 30-day starter plan

1. **Week 1 — Foundation.** Lock your channel name + the 5 pillars + a
   consistent template (palette, voice, music, outro). Run
   `analyze_channel.py` to baseline. Produce and schedule the 10 ready-made
   scripts in `FIRST_10_SHORTS_MONEY.md`.
2. **Week 2 — Volume.** Post daily. Every upload through
   `optimize_metadata.py` first. Reply to every comment.
3. **Week 3 — Double down.** Re-run `analyze_channel.py`. Whatever
   over-performed, make more in that exact format — same pillar, same hook
   shape, new mechanism.
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
| Baseline the channel, find best posting time | `python tools/analyze_channel.py --channel "@MoneyDecoded"` |
| Check a title/description/tags before posting | `python tools/optimize_metadata.py --file upload.json` |
| AI-rewrite a weak title | `python tools/optimize_metadata.py --title "…" --use-claude` |
| Fill the idea pipeline | `python tools/generate_ideas.py -n 20 --niche-file niche-money.json` |
| Batch a single series | `python tools/generate_ideas.py -n 10 --use-claude --theme "credit scores" --niche-file niche-money.json` |
