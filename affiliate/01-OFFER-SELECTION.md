# Offer Selection

The offer decides most of your outcome. A brilliant video pointed at a bad
offer earns nothing. An average video pointed at a proven offer earns money.
Spend real time here — it pays better per hour than anything else you'll do.

---

## The categories that pay

Affiliate money concentrates in problems people are **emotionally urgent**
about and will **pay to solve today**:

| Category | Why it works | Watch out for |
|---|---|---|
| **Health & Fitness** | Urgent, emotional, huge payouts ($80–150/sale) | Heavy compliance rules — see `06-COMPLIANCE.md`. Never make medical claims. |
| **E-Business / Make Money** | Buyers are already in buying mode | Saturated; refund rates run high |
| **Spirituality / New Age** | Loyal audience, low competition, cheap traffic | Small per-sale payouts sometimes |
| **Self-Help** | Broad appeal, evergreen | Vague problems convert worse than specific ones |
| **Survival / Preparedness** | Intense buyers, seasonal spikes | Narrow audience |
| **Pets** | Emotional, rising, underserved | Lower payouts |

**Pick the one you can stand to talk about for 90 days.** You're going to make
200+ pieces of content in this niche. Boredom is a real business risk.

---

## Reading the ClickBank numbers

**Gravity** — roughly, how many distinct affiliates got paid for this product
recently. It's a *proof* metric, not a quality metric.

| Gravity | Read it as |
|---|---|
| 0–8 | Nobody is making sales. Avoid unless it's a brand-new launch you have inside info on. |
| 8–20 | Early. Risky but less crowded. |
| **20–120** | **The sweet spot.** Proven to convert, still room for a small affiliate. |
| 120+ | Proven and crowded. You're competing with media buyers spending thousands a day. Fine if your traffic is unique — which yours is, since you make original content. |

**Avg $/conversion** — your actual average commission including upsells. This
is the number that matters, not the commission percentage. 75% of $37 is
worse than 50% of $200.

**Avg Rebill Total** — lifetime value of a subscription. An offer with a $20
front end and $74 rebill total is a $94 offer. Recurring offers are how
affiliate income becomes stable instead of a sawtooth.

**Initial $/conversion vs Avg $/conversion** — if Avg is much higher than
Initial, there's a real upsell funnel behind it. Good: the vendor monetizes
harder than you could, and you get paid on it.

---

## Reading the Digistore24 numbers

Digistore24 shows **earnings per sale**, **cancellation rate**, and a
marketplace rating rather than Gravity. Two things matter more here:

- **180-day cookie** (vs ClickBank's 60). Someone who clicks today and buys in
  four months still pays you. This makes list-building disproportionately
  valuable on Digistore24 offers.
- **Cancellation rate** is shown honestly. Anything above 20% is a commission
  shredder — you get paid, then it's taken back.

Digistore24 is also stronger in European markets. If your content pulls
non-US traffic, that's a real advantage.

---

## The seven checks (do these on your phone, in order)

1. **Gravity / rating in range?** 20–120 on ClickBank.
2. **Avg $/conversion $40+?** Below that, organic volume can't carry you.
   Under $15 with no rebills, don't bother.
3. **Open the sales page on your phone.** Slow load? Broken layout? Checkout
   that fails on mobile? Your traffic is ~95% phones — a desktop-only funnel
   is a dead offer for you.
4. **Is there an affiliate/JV page?** It means swipe copy, approved claims,
   banners, and a human to email. No page = you're on your own.
5. **Refund rate.** If the vendor won't say, assume 10–15% for supplements,
   higher for make-money offers.
6. **Would you send it to a friend?** If the page insults your intelligence,
   it will insult your audience's. Your credibility is the whole asset.
7. **Can you reach these buyers for free?** A great offer for an audience you
   can't touch is worth zero. This is the check people skip.

---

## Then let the scorer decide

Don't argue with yourself about which one. Paste the numbers to me:

> *"Score these offers"* + the marketplace rows

I'll add them to `tools/offers.json` and run:

```
python tools/offer_scorer.py
python tools/offer_scorer.py --explain <offer>
```

You get a 0–100 score across seven weighted dimensions, hard flags for
deal-breakers, your net commission after refunds, and how many sales a day
you need for $100.

| Verdict | What to do |
|---|---|
| **PROMOTE** (72+) | Make it your core offer. |
| **PROMOTE\*** | Strong, but clear the flags before scaling. |
| **TEST** (55–71) | Worth 100 tracked clicks. Then let the data decide. |
| **SKIP** | Don't spend the hours. |

---

## How many offers

**One.** For the first 30 days, one offer.

Then:
- **A proven winner** gets everything — every channel, every format.
- **One challenger** at a time, tested against it.
- A second *complementary* offer only once the first is producing steadily —
  ideally a lower-priced front end or a recurring offer you can mail to buyers.

---

## When to drop an offer

Kill rules, so you're not deciding emotionally at 11pm:

- **150+ tracked clicks, zero sales** → the offer/traffic pair is wrong. Try
  the same audience with a different offer before you blame your content.
- **EPC under $0.15 after 200 clicks** → dead. 1,000 clicks would make $150.
- **Refund rate above 25%** → you're doing the work and giving the money back.
- **Sales page changed for the worse, or the offer went dark** → check monthly.
  Vendors pull offers and your links go to a 404 while you keep posting them.

Ask me any Sunday: *"What should I kill?"* — `campaign_tracker.py decide`
applies these rules to your real numbers.
