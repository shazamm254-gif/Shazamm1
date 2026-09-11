# Tracking and Decisions

Affiliate marketing isn't a creativity contest. It's a **search problem**: run
many cheap tests, find the few that work, pour everything into those. That only
functions if you write down what happened.

---

## The five numbers

Ignore everything else. Especially follower count.

| Number | What it is | What "fine" looks like |
|---|---|---|
| **Clicks** | People who tapped your link | The only input you control |
| **CTR** | Clicks ÷ views | 0.5–2% from short-form |
| **Conversion** | Sales ÷ clicks | 1–3% on a decent offer |
| **EPC** | Revenue ÷ clicks | **The master number.** $0.50+ is workable, $1+ is good |
| **RPM** | Revenue per 1,000 views | Tells you what a view is worth to you |

**EPC is the one to watch.** It collapses offer quality, traffic quality, and
your copy into a single figure. If your EPC is $0.80, then every 1,000 clicks
is worth $800 — and now your only job is manufacturing clicks.

---

## How to log it (10 seconds a day)

Just tell me, in plain English:

> *"Log today: 12,400 views, 96 clicks, 1 sale, $87 — that was short07 on YouTube"*

I run:
```
python tools/campaign_tracker.py log --channel yt --offer <offer> \
    --campaign short07 --views 12400 --clicks 96 --sales 1 --revenue 87
```

It saves to `reports/campaigns.csv` — gitignored, because it's your business
data, not code.

**Where the numbers come from, all on your phone:**
- Views → the platform's app
- Clicks → ClickBank **Analytics** (filter by Tracking ID) / Digistore24
  **Reports → Transactions** (filter by campaign key)
- Sales + revenue → same place

This is why every link is tagged. Without tracking IDs, ClickBank tells you
"a sale happened" and nothing else, and you learn nothing.

---

## The weekly review (Sundays, 5 minutes)

> *"Run my weekly report and tell me what to kill"*

```
python tools/campaign_tracker.py report --by campaign --days 7
python tools/campaign_tracker.py decide
```

### The decision rules

Written down in advance, so you're not deciding emotionally at 11pm.

| Condition | Verdict | Action |
|---|---|---|
| Under **75 clicks** | **NOT ENOUGH DATA** | You're reading noise. Keep going. Do not change anything. |
| EPC **≥ $0.75** with 75+ clicks | **SCALE** | Make 5 more of this. Every channel behind it. |
| EPC **$0.15–$0.75** | **WATCH** | Profitable-ish. Keep running. Change one thing at a time. |
| EPC **< $0.15** with 75+ clicks | **KILL** | Stop. That traffic is worth more elsewhere. |

**The 75-click rule is the important one.** Nearly everyone kills winners too
early because three days of nothing felt like failure. Three days of nothing
is a normal sample size for a 1.5% conversion rate.

---

## Diagnosing a funnel that isn't converting

> *"Check my funnel: 42,000 views, 310 clicks, 58 opt-ins, 2 sales, $174"*

```
python tools/funnel_math.py check --views 42000 --clicks 310 --optins 58 \
    --sales 2 --revenue 174
```

It names the leaking stage and — importantly — **the order to fix them in**.
Fixing a late stage while an early one leaks is wasted work.

| Symptom | Real cause | Fix |
|---|---|---|
| Low views | Not enough posts, weak hooks | Volume. Post more before changing anything. |
| Views, no clicks | No open loop, vague CTA | Name what's behind the link and give one reason to go now |
| Clicks, no opt-ins | Lead magnet isn't worth an email | Make it solve step one completely, in 5 minutes |
| Clicks, no sales | Offer/traffic mismatch | **Change the offer before rewriting the video.** Usually it's the offer. |
| Sales, then refunds | Overselling, or a weak product | Stop overpromising. If the product is bad, drop it. |

---

## The trap: under 5,000 views total

If you have under ~5,000 views and no sales, **you do not have a conversion
problem.** You have a volume problem. Every hour spent optimizing a funnel
that 40 people have seen is an hour not spent making the content that would
give you a real sample.

The tool will say this to you. Believe it.

---

## What to do when something works

This is the part people fumble. A Short pops, they celebrate, and then post
something completely different the next day.

**When a piece of content wins:**
1. Tell me — *"short07 did 40k views and 3 sales"*
2. Make **five more of the same format** this week. Same structure, different
   angle. Not a sequel — the same *shape*.
3. Repost the winner to every platform it wasn't on.
4. Turn it into an email to your list.
5. Turn it into a Reddit/Quora answer.

One winner, milked properly, is worth fifty average posts. The whole discipline
is noticing the winner and then being boring about repeating it.
