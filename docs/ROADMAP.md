# Roadmap & Status — Phase 8 (continuous improvement)

This is a living startup. After each milestone: find the biggest bottleneck,
propose improvements, prioritize by business impact, keep building.

## Completed (this milestone)

- ✅ Market research + winner selection with reasoning (`docs/STRATEGY.md`).
- ✅ Validation: competitors, complaints, gaps, smallest paid product
  (`docs/STRATEGY.md`).
- ✅ Product design: brand, schema, API, security, scalability
  (`docs/PRODUCT.md`).
- ✅ **Working MVP**, type-checked and verified running:
  - Auth (signup/login/logout, scrypt + JWT), auth-gated app.
  - Company profile.
  - AI proposal generation (Claude, structured output) with free-tier quota.
  - Proposal editor (sections, pricing, totals), status, share link.
  - Public client proposal page + one-click accept.
  - Dashboard with usage metering.
  - Stripe-ready billing (Checkout + webhook), env-gated.
  - Marketing/sales/pricing/FAQ landing page (SEO metadata).
- ✅ Business assets: pricing, launch checklist, onboarding emails, growth
  engine (`docs/GROWTH.md`), automation plan (`docs/AUTOMATION.md`).

## Biggest current bottleneck

**Distribution, not product.** The core value loop works; nothing ships revenue
until there are users. The highest-impact next investments are the
compounding acquisition channels (SEO/content) and the conversion plumbing
(transactional email + analytics) — not more features.

## Prioritized next steps (by expected business impact)

1. **Production data layer** — implement the Postgres adapter behind the `db`
   interface in `src/lib/db.ts` (the only swap point). *Unblocks launch.*
2. **Transactional email + lifecycle sequence** — welcome, activation nudge,
   near-limit upgrade, accept celebration. *Drives activation + conversion.*
3. **Analytics on the activation funnel** — signup → first generation → send →
   accept → upgrade. *You can't improve what you can't see.*
4. **SEO foundation** — sitemap, 10 seed landing/blog pages targeting high-intent
   queries, programmatic industry pages. *Compounding acquisition.*
5. **PDF export + email send with view tracking** — top requested utility;
   strengthens the "send and close" loop.
6. **Templates** — save a generated proposal as a reusable template (Pro hook).
7. **Streaming generation UX** — stream the draft token-by-token for a faster
   perceived experience (SDK streaming is already available).
8. **E-signature + line-item editor polish**, then **CRM integrations** and
   **follow-up automation** (v2).

## Known limitations to address before scale

- File-backed store is single-process (dev/demo only) → Postgres (step 1).
- No rate limiting on auth/generate endpoints yet → add per-IP/user limits.
- No email verification / password reset yet → add with the email provider.
- Add automated tests (auth, quota enforcement, ownership checks) + CI.

## Operating principle

Optimize for MRR, retention, and margin. Ship the smallest thing that moves an
activation or conversion metric, measure, then iterate. Continue from step 1
above in the next session.
