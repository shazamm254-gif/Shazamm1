# Quickstart — Your First 48 Hours

Phone-only. No laptop needed at any step. Tick these off in order.

Total time: about 5 hours across two days.

---

## HOUR 1 — Get your accounts actually payable

Before anything else, make sure a sale can reach your bank.

**ClickBank**
1. Open ClickBank → **Accounts** → check your **nickname** (this is the ID in
   every link you'll build — write it down).
2. **Settings → My Account → Payment Information**: set payment method
   (direct deposit if available in your country, else wire/check), set the
   **payment threshold to $10** — the default is higher and it will sit on
   your money.
3. Fill in tax details. Unfinished tax info silently blocks payouts.
4. Note the **Customer Distribution Requirement**: ClickBank holds your first
   payout until you've made sales via **5+ different customers** using **2+
   payment methods**. This is normal and everyone hits it. Plan for your first
   payout to arrive after roughly your fifth sale, not your first.

**Digistore24**
1. Confirm your **Digistore24 ID** (Account → your ID).
2. Settings → payout details + tax info.
3. Set payout threshold to the minimum.
4. Note: Digistore24 cookies last **180 days**, which is far more generous
   than most networks. That matters for how you write emails later.

✅ **Done when:** both accounts can pay you and you've written down two things —
your ClickBank nickname and your Digistore24 ID.

**Then tell me:** *"My ClickBank nickname is X and my Digistore24 ID is Y"* —
I'll put them into `tools/affiliate.json` so every link builds correctly.

---

## HOUR 2 — Pick your niche and three offers

Full method in [`01-OFFER-SELECTION.md`](01-OFFER-SELECTION.md). The fast path:

1. Open the **ClickBank Marketplace** on your phone. Sort by **Gravity**.
2. Work in one of these categories — they're where the money reliably is:
   **Health & Fitness**, **E-Business & E-Marketing**, **Spirituality/New Age**,
   **Self-Help**, **Survival**.
3. Find offers with **Gravity 20–120** and **Avg $/conversion $40+**.
   - Under 20: unproven.
   - Over 120: proven but you're competing with people spending $10k/day on ads.
4. **Open each sales page on your phone.** Does it load fast? Does checkout
   work? Would *you* believe it? If the page is a 45-minute video with no
   skip and no text, expect low conversion from cold traffic.
5. Find the **affiliate/JV page** (usually linked in the marketplace listing
   or footer). No affiliate page = no swipe copy, no support. Downgrade it.
6. Do the same on the **Digistore24 Marketplace** for one offer.

Pick **3 candidates**: 2 ClickBank, 1 Digistore24.

**Then tell me:** *"Score these offers"* and paste the marketplace numbers for
each (name, gravity, avg $/conversion, commission %, price). I'll add them to
your catalog and run the scorer. **Promote the highest scorer. One offer.**

> Promoting one offer properly beats promoting six badly. You are trying to
> learn what makes *one* audience buy *one* thing. Six offers means six
> quarter-tests and no answers.

---

## HOUR 3 — Build your links and your capture page

**Links.** Tell me: *"Build my links for [offer]"*. You get a tracked link for
every channel, each one tagged so you'll know exactly which post sold.

**Email list.** Sign up for a free email tool — **MailerLite**, **Brevo** or
**Beehiiv** all have free tiers and phone-usable dashboards. Create one form,
copy its form URL.

> Why bother on day one: platforms ban accounts, offers get pulled, and the
> algorithm changes its mind. The list is the only asset in this business
> that is actually *yours*. Start it at zero subscribers, not at 10,000.

**Bridge page.** `affiliate/bridge/index.html` is ready to deploy free on
GitHub Pages from your phone:
1. github.com → your repo → **Settings → Pages**
2. Source: **Deploy from a branch** → branch `main` → folder `/ (root)` → Save
3. Two minutes later your page is live at
   `https://<you>.github.io/Shazamm1/affiliate/bridge/`

**Then tell me:** *"Set up my bridge page for [offer], my email form URL is
[paste]"* — I'll fill in the offer details, your headline, and the copy.

✅ **Done when:** you can open your bridge page on your phone, tap the button,
and land on the offer's sales page.

---

## HOUR 4 — The intent engine (this is the part that can pay this week)

This is where day-one-to-day-ten sales actually come from. Full detail in
[`02-TRAFFIC-PLAYBOOK.md`](02-TRAFFIC-PLAYBOOK.md).

Find people asking about your niche's problem **right now**:

- **Reddit** — search your problem keyword, sort by New.
- **Quora** — questions with views but weak answers.
- **YouTube comments** — on big videos about the problem. Comments are
  searchable and top comments get thousands of reads.
- **Facebook groups** — search the problem, join 3–5 groups.

Then, today, write **10 genuinely useful answers.** Not 10 link drops.

**The rule that makes this work and keeps you unbanned:**
> Give the complete answer in the comment itself. The person should be able
> to close the tab and be better off. Only *then*, if a link adds something
> the answer couldn't, mention it — and disclose it.

Most of your 10 answers should contain **no link at all**. You're building
account history and reading what the audience actually says — which becomes
your Short scripts. Links come after you have comment karma and post history.

✅ **Done when:** 10 real answers posted across 2–3 platforms.

---

## HOUR 5 (Day 2) — Start the content engine

You already own a Shorts production system — that's what the rest of this repo
is. Now point it at the offer.

1. Tell me: *"Make me a niche config for [your offer's niche]"* — I'll build
   the `niche-*.json` so all the existing tools retune to your money niche.
2. Open [`04-SHORTS-TO-OFFER.md`](04-SHORTS-TO-OFFER.md). Those 10 scripts are
   built to create clicks, not just views.
3. **Produce 3 Shorts today.** Not one. Three.
4. Put your bridge link in your bio, not in the caption — most platforms
   suppress reach on posts with outbound links.

✅ **Done when:** 3 Shorts posted and your bio link works.

---

## Then: the daily loop

Twenty to sixty minutes a day. Nothing else.

| Every day | Time |
|---|---|
| Post 1–3 Shorts (batch-produce on Sundays) | 20 min |
| 5 genuinely useful answers on intent platforms | 20 min |
| Send one email to your list (once you have 20+ subscribers) | 10 min |
| Tell me your numbers → *"Log today: X views, Y clicks, Z sales"* | 1 min |

**Every Sunday:** *"Run my weekly report and tell me what to kill."*

---

## What to expect, honestly

| When | What normally happens |
|---|---|
| Days 1–3 | Zero sales. Clicks maybe. This is not failure, it's the setup. |
| Days 3–21 | First sale — usually from an intent platform, not a Short. |
| Weeks 3–6 | Shorts start finding an audience. Clicks become steady. |
| Weeks 4–10 | First $100 week. |
| Month 3+ | The back catalogue earns while you sleep; the list compounds. |

The failure mode is not bad content. **The failure mode is stopping in week
three** because nothing happened yet — right before the part where it does.

If day 21 arrives with real traffic and zero sales, something specific is
broken and it's findable. Tell me your numbers and I'll tell you which stage
is leaking.
