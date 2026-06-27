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

## Completed (milestone 2)

- ✅ **Production PostgreSQL adapter** behind the existing `Repository` interface
  (`src/lib/db.ts` selects file vs Postgres by `DATABASE_URL`); verified
  end-to-end against a real Postgres 16 instance.
- ✅ **Transactional email** (Resend HTTP API, dev console fallback): email
  verification, welcome, password reset, proposal-accepted notification, and
  billing upgrade/downgrade notifications — with single-use hashed tokens.
- ✅ **Product analytics**: anonymous visitor + proposal-view beacons and
  server-side events (signup, generation, send, accept, subscription); an
  `/app/analytics` dashboard with visitors, signups, generations, views,
  acceptances, subscriptions, activation rate, free→paid conversion, and a
  full conversion funnel.
- ✅ **Deployment guide** (`docs/DEPLOYMENT.md`) covering Postgres, Stripe,
  Resend, env vars, hosting, and a post-deploy smoke test.

## Biggest current bottleneck

**Distribution, not product.** The core value loop works; nothing ships revenue
until there are users. The highest-impact next investments are the
compounding acquisition channels (SEO/content) and the conversion plumbing
(transactional email + analytics) — not more features.

## Prioritized next steps (by expected business impact)

1. **Launch** — deploy per `docs/DEPLOYMENT.md` (Postgres + Stripe + Resend +
   Anthropic), run the smoke test, go live. The three launch-blocking
   milestones (Postgres, email, analytics) are done.
2. **Lifecycle email sequence (scheduled)** — activation nudge if no proposal in
   24h, near-limit upgrade prompt. (Transactional emails already exist; this adds
   the time-based drip via a scheduled worker.)
3. **App-level rate limiting** — `/api/auth/*`, `/api/generate`, `/api/track`.
4. **SEO foundation** — sitemap, 10 seed landing/blog pages, programmatic
   industry pages. *Compounding acquisition.*
5. **PDF export + email send with view tracking**; **templates** (Pro hook).
6. **Streaming generation UX** (SDK streaming is available).
7. **E-signature + line-item polish**, then **CRM integrations** and
   **follow-up automation** (v2).

## Known limitations to address before scale

- No app-level rate limiting on auth/generate/track yet → add per-IP/user limits
  (mitigate at the edge/proxy in the meantime).
- Add automated tests (auth, quota enforcement, ownership checks, repository
  parity) + CI.
- `events` table needs a retention/rollup job at high volume.
- The file-backed adapter remains for local/dev only; production uses Postgres
  (selected automatically by `DATABASE_URL`).

## Operating principle

Optimize for MRR, retention, and margin. Ship the smallest thing that moves an
activation or conversion metric, measure, then iterate. Continue from step 1
above in the next session.
