# The Affiliate System

Your ClickBank + Digistore24 operation, built to run entirely from an Android
phone with Claude as the back office.

## Read this part first

You asked for sales from day one. Here is the honest version, because a
specialist who tells you what you want to hear is useless to you.

**Cold content traffic will not sell on day one.** If you post your first
Short today, it goes to a few hundred people who have never heard of you,
about a problem they weren't thinking about, and asks them to buy a $69
product from a stranger. That converts at roughly zero. Anyone promising
otherwise is selling you a course.

**Warm intent traffic can sell in days, sometimes day one.** Somewhere right
now, someone is typing "how do I stop my ears ringing at night" into a forum.
They have the problem, they are actively looking, and they will click a
genuinely helpful answer. That person buys. That's the difference between
*interruption* traffic (Shorts) and *intent* traffic (search, forums, comments).

So this system runs two engines at once:

| Engine | Starts paying | What it is |
|---|---|---|
| **Intent** (Days 1–14) | Days 1–10 | Helpful answers where people are already asking — Reddit, Quora, YouTube comments, Facebook groups. Low volume, high conversion, zero audience required. |
| **Content** (Days 1–90) | Weeks 3–8 | Your Shorts engine. Slow to start, then compounds forever and can't be taken from you. |

You start both on day one. The intent engine buys you proof and early cash
while the content engine warms up. Anyone who runs only the content engine
quits in week four; anyone who runs only the intent engine hits a ceiling and
gets banned from something.

**A realistic first 90 days:** first sale somewhere in days 3–21. First
$100 week somewhere in weeks 4–10. That's not a slow result — that's what
working looks like.

## The files

Read them in order. Each one is a job, not an essay.

| File | What it's for |
|---|---|
| [`00-QUICKSTART.md`](00-QUICKSTART.md) | **Start here.** Your first 48 hours, in order, on a phone. |
| [`01-OFFER-SELECTION.md`](01-OFFER-SELECTION.md) | Picking what to promote. This decides ~70% of your result. |
| [`02-TRAFFIC-PLAYBOOK.md`](02-TRAFFIC-PLAYBOOK.md) | Both engines: where clicks come from and how to not get banned. |
| [`03-FUNNEL-AND-EMAIL.md`](03-FUNNEL-AND-EMAIL.md) | The bridge page, the list, and 9 written emails you can paste in. |
| [`04-SHORTS-TO-OFFER.md`](04-SHORTS-TO-OFFER.md) | 10 Short scripts engineered to produce clicks, not just views. |
| [`05-TRACKING-AND-DECISIONS.md`](05-TRACKING-AND-DECISIONS.md) | The numbers that matter and the rules for killing and scaling. |
| [`06-COMPLIANCE.md`](06-COMPLIANCE.md) | FTC + network rules. Read it once; it protects the whole business. |
| [`bridge/`](bridge/) | A working bridge page. Deploy free from your phone. |

## The tools

You don't run these. **You ask me to run them**, in plain English, from the
Claude app. The right-hand column is literally what you type.

| Tool | What it does | Say to Claude |
|---|---|---|
| `tools/offer_scorer.py` | Scores offers 0–100 and gives a PROMOTE / TEST / SKIP verdict | *"Score these offers"* + paste marketplace rows |
| `tools/link_builder.py` | Builds tracked hoplinks for every channel | *"Build my links for the nerve offer"* |
| `tools/funnel_math.py` | Goal → traffic needed, or actuals → what's broken | *"How much traffic do I need for $100/day at $87 a sale?"* |
| `tools/campaign_tracker.py` | Logs results, then tells you what to kill and scale | *"Log yesterday: 12k views, 96 clicks, 1 sale, $87"* |

Your config lives in `tools/affiliate.json` (your nicknames) and
`tools/offers.json` (what you're promoting). Ask me to edit them — you
should never have to hand-edit JSON on a phone keyboard.

## Where this plugs into what you already have

This repo is already a Shorts production engine — niches, scripts, hooks,
visual packs. That was the hard part and it's built. This system points it at
money: the same pipeline that made cosmic-horror Shorts now makes Shorts for a
niche where a $90 commission exists at the end of the click.

`04-SHORTS-TO-OFFER.md` is the join between the two.

## The one rule

**Never post an untracked link.** Every link you put anywhere comes from
`link_builder.py` with a tracking ID on it. A sale you can't trace to a source
teaches you nothing, and this entire business is just finding out what works
and then doing far more of it.
