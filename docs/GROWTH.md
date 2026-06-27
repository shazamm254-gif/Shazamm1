# Business & Growth — Phases 5 & 6

## Pricing strategy

| Plan | Price | Limits | Goal |
|---|---|---|---|
| Free | $0 | 3 AI proposals, 1 user | Frictionless activation; prove the "aha" |
| Pro | $39/mo | Unlimited proposals, branding, accept tracking | Core monetization |
| Team (future) | $79/mo | 3 seats, shared templates, analytics | Expansion revenue |

Rationale: flat pricing (not per-seat) removes the #1 SMB complaint about
incumbents. $39 anchors below PandaDoc/Proposify while the value (drafting, not
just formatting) is higher. The free tier is capped by *value delivered*
(proposals generated), so heavy users convert.

**Path to $1M ARR:** $1M / $39 ≈ **2,140 paying accounts** (less with Team
plans). At a 4% free→paid conversion that's ~53k signups — achievable over
12–24 months via the channels below, given a strong SEO + content motion in a
high-intent category.

## Brand assets

- **Name/wordmark:** ProposalForge (indigo + amber spark mark — see
  `src/components/Logo.tsx`).
- **Tagline:** *Win more deals. Write proposals in minutes, not hours.*
- **Landing/sales/pricing/FAQ:** implemented at `/` (`src/app/page.tsx`).

## Email onboarding sequence

1. **Day 0 — Welcome.** "Your first proposal is 2 minutes away." One CTA: set up
   your company profile, then generate. Link to `/app/new`.
2. **Day 1 — Activation nudge (if no proposal yet).** "Paste any past project
   brief — see what ProposalForge writes." Include a sample brief.
3. **Day 3 — Value reinforcement.** Share a tip: "Add your value props to the
   profile for sharper, more persuasive drafts."
4. **Day 5 — Social proof + use case.** Show a before/after (hours → minutes).
5. **Day 7 — Upgrade (near free-tier limit).** "You've used your free
   proposals. Go unlimited for $39/mo." Link to `/app/billing`.
6. **Post-accept — Win celebration.** When a client accepts: "🎉 Deal won.
   Want to send the next one faster? Save this as a template (Pro)."

## Customer documentation (help center outline)

- Getting started: create account → company profile → first proposal.
- Writing great briefs (the better the input, the better the draft).
- Editing & sending proposals; sharing the client link.
- Tracking acceptance & statuses.
- Billing & plans.
- Security & data handling.

## Launch checklist

- [ ] Domain + production deploy (Vercel/Render), Postgres provisioned.
- [ ] `AUTH_SECRET`, `ANTHROPIC_API_KEY`, Stripe keys + webhook configured.
- [ ] Swap `src/lib/db.ts` file adapter for Postgres implementation.
- [ ] Transactional email provider wired (welcome + onboarding + accept).
- [ ] Stripe products/prices created; `STRIPE_PRICE_ID_PRO` set; webhook tested.
- [ ] Analytics + error monitoring installed.
- [ ] SEO: sitemap, meta/OpenGraph (in `layout.tsx`), 10 seed blog/landing pages.
- [ ] Legal: Terms, Privacy, DPA.
- [ ] 5–10 beta users; collect first testimonials.
- [ ] Product Hunt + relevant community launch.

## Phase 6 — Customer acquisition (growth engine)

Prioritized by long-term ROI for a bootstrapped B2B SaaS:

1. **SEO (highest ROI).** High-intent, high-volume queries the ICP already
   searches: "proposal template [industry]", "how to write a [service]
   proposal", "[competitor] alternative". Programmatic landing pages per
   industry/use case. The product itself produces shareable proposals branded
   "Powered by ProposalForge" — a built-in distribution surface.
2. **Content marketing.** Practical guides on winning proposals, pricing,
   scoping — each mapping to a product feature. Free tools (proposal checklist,
   pricing calculator) as link magnets.
3. **Product-led growth.** Generous free tier, instant value in session one, the
   public proposal page as a viral surface (every recipient sees the product).
4. **AI-assisted outreach.** Targeted, *personalized* cold email to agencies and
   consultancies (relevant, low-volume, compliant — not spray-and-pray).
5. **Referral program.** "Give a month, get a month" — fits the network of
   service providers who know other service providers.
6. **Affiliate program.** For agency-tooling reviewers and freelance
   communities.
7. **Partnerships.** Freelance marketplaces, agency networks, accounting/CRM
   tools that touch the proposal-to-invoice flow.
8. **Social.** LinkedIn (where the B2B ICP lives) with proposal teardowns and
   tips; repurpose content.

**Channel sequencing:** start with SEO + content (compounding) and PLG (the free
tier), layer referral once there's a paid base, then partnerships for scale.
