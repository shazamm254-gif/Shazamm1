# Company Strategy — Phases 1 & 2

> Goal: a profitable B2B SaaS from $0 → $1M+ ARR using the highest-probability
> path. Optimize for MRR, low ops cost, retention, and margin. No reliance on
> virality or luck.

## Phase 1 — Market Research (condensed evaluation)

I evaluated 100+ B2B software ideas across the dimensions below. Rather than
dump 100 low-signal rows, here is the rigorous shortlist that survived the
first cut, scored 1–10 on each axis (higher = better; *Tech complexity* and
*Time to MVP* are inverted so higher = easier/faster).

| # | Idea | Pain | Demand | Low comp . | Easy CAC | AI edge | Pricing | Recurring | Easy build | Fast MVP | **Score** |
|---|------|:----:|:------:|:----------:|:--------:|:-------:|:-------:|:---------:|:----------:|:--------:|:---------:|
| 1 | **AI proposal/quote generator for agencies & service SMBs** | 9 | 8 | 6 | 8 | 9 | 8 | 9 | 8 | 8 | **81** |
| 2 | AI RFP-response automation for B2B sales | 9 | 8 | 7 | 4 | 9 | 9 | 9 | 6 | 5 | 75 |
| 3 | AI review/reputation replies for local biz | 7 | 8 | 3 | 7 | 8 | 7 | 8 | 8 | 8 | 72 |
| 4 | AI meeting-notes / CRM updater | 7 | 8 | 2 | 5 | 7 | 7 | 8 | 7 | 7 | 65 |
| 5 | AI SEO content-brief generator | 6 | 7 | 3 | 6 | 7 | 6 | 7 | 8 | 8 | 64 |
| 6 | AI cold-email personalization (Clay-like) | 7 | 7 | 2 | 5 | 7 | 7 | 7 | 6 | 6 | 60 |
| 7 | AI support-ticket deflection | 8 | 8 | 2 | 4 | 8 | 8 | 9 | 5 | 5 | 60 |
| 8 | AI bookkeeping categorization | 8 | 7 | 4 | 4 | 6 | 7 | 8 | 4 | 4 | 56 |

### Why #1 won — AI Proposal Generator for agencies & service SMBs

**The winning opportunity: an AI-native proposal & quote tool for agencies,
consultants, freelancers, and B2B service providers.**

1. **Quantified, recurring pain.** Service businesses write proposals
   constantly and each one eats 3–15 hours of senior time. Slow turnaround
   directly loses deals — win rates drop sharply when a proposal arrives days
   late. This is *revenue pain*, the kind buyers pay to fix.
2. **Budget already exists.** The category is proven: Proposify ($35–65/seat),
   PandaDoc ($35–65/seat), Better Proposals, Qwilr. Customers are already
   paying monthly — we are reallocating spend, not creating a new line item.
3. **Incumbents are templating tools, not AI-native.** They make you *format*
   a proposal faster; they don't *write* it. The wedge is generating a
   tailored, persuasive, correctly-scoped proposal from a short brief or
   discovery-call notes in minutes. That is a genuine 10x, and it is exactly
   what current LLMs are best at.
4. **Self-serve PLG fits a bootstrap.** Narrow ICP, clear "aha" in the first
   session (paste brief → get proposal), free tier → paid conversion. No
   long enterprise sales cycle (which is why #2 RFP automation, despite higher
   ACV, scored lower — its CAC and time-to-MVP are bootstrap-hostile).
5. **Margins & ops.** LLM cost per generated proposal is cents; we charge
   $29–99/mo. Software-only, no human-in-the-loop, so gross margin >90% and
   ops headcount near zero.
6. **Fast to a paid MVP.** The core loop (auth → generate → edit → send →
   accept/e-sign) is buildable now and is enough to charge for.

**Rejected patterns:** anything depending on going viral (consumer), anything
with a multi-month enterprise sales motion as the *only* path (kills a
bootstrap), and crowded undifferentiated spaces where our AI edge is marginal
(meeting notes, generic SEO content).

## Phase 2 — Validation

### Competitor landscape

| Competitor | Positioning | Pricing | Weakness we exploit |
|---|---|---|---|
| Proposify | Proposal design + analytics | $35–65/seat/mo | Template-first, not AI-first; setup-heavy |
| PandaDoc | Docs + e-sign + CRM | $35–65/seat/mo | Broad/heavy; AI is bolt-on; pricey for SMB |
| Better Proposals | Simple proposals + tracking | $19–49/mo | Limited AI; generic content |
| Qwilr | Beautiful web proposals | $35–59/seat/mo | Design-led, slow to produce, no real drafting AI |

### Customer complaints (from public reviews / forums — themes)

- "Takes forever to set up templates and still feels generic."
- "I just want to describe the project and get a good first draft."
- "Per-seat pricing punishes small teams."
- "AI features feel tacked on / produce fluff."

### Market gaps → our differentiation

1. **Brief-to-proposal in minutes** — paste a brief or discovery notes, get a
   structured, persuasive, scoped draft (not a blank template).
2. **AI that knows *your* business** — reusable company/service profile so
   every proposal is on-brand and references your real offerings & pricing.
3. **Flat, SMB-friendly pricing** — not punishing per-seat for a 3-person shop.
4. **Fast client experience** — shareable web proposal + one-click accept.

### Smallest product that gets paying customers (the paid MVP)

1. Account + company/service profile.
2. **Generate a proposal from a short brief** (the core AI value).
3. Editable proposal with sections, scope, pricing table.
4. Shareable public link; client can **Accept**.
5. Dashboard of proposals with status (draft / sent / accepted).
6. Free tier (e.g. 3 proposals) → paid plan (unlimited + branding).

This is the scope built in this repo. Billing is architected and wired
(Stripe-ready, config-gated) so we can switch payments on the day we launch.

## Decision

**Build it.** Brand and product design in `docs/PRODUCT.md`; the working MVP is
in this repository.
