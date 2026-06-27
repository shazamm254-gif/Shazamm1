# ProposalForge

**Win more deals. Write proposals in minutes, not hours.**

ProposalForge is an AI-native proposal generator for agencies, consultants, and
B2B service businesses. Describe a project; get a tailored, persuasive,
correctly-scoped, on-brand proposal — with pricing — ready to send and accept.

This repository contains the strategy, product design, and a working MVP.

## Why this product

See [`docs/STRATEGY.md`](docs/STRATEGY.md) for the full market analysis and why
this opportunity won (quantified recurring pain, an existing budget,
AI-native differentiation vs. templating incumbents, self-serve PLG fit, >90%
margins, fast to a paid MVP). Product design is in
[`docs/PRODUCT.md`](docs/PRODUCT.md).

## What the MVP does

- Email/password auth (scrypt hashing, signed-JWT sessions).
- Reusable **company profile** that makes every proposal on-brand.
- **AI proposal generation** from a short brief (Claude, structured output).
- Full proposal **editor** — summary, sections, itemized pricing, totals.
- **Shareable client view** with one-click **Accept** + status tracking.
- Dashboard with free-tier usage metering.
- **Stripe-ready billing** (Checkout + webhook), gated on env keys.

## Tech stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS** — one codebase,
  SSR marketing pages for SEO, API routes for the backend.
- **Claude** via `@anthropic-ai/sdk` (`claude-opus-4-8`, adaptive thinking,
  structured outputs).
- **Data:** a typed, file-backed repository (`src/lib/db.ts`) so the MVP runs
  anywhere with zero native deps. The `db` interface is the single swap point —
  reimplement it against Postgres for production without touching call sites.
- **Auth:** `jose` JWTs + Node `scrypt` (no native build deps).
- **Billing:** Stripe REST API directly (no SDK dependency), env-gated.

## Getting started

```bash
npm install
cp .env.example .env        # then fill in AUTH_SECRET and ANTHROPIC_API_KEY
npm run dev                 # http://localhost:3000
```

Required env to use AI generation: `ANTHROPIC_API_KEY`. Required always:
`AUTH_SECRET` (a long random string). Billing is optional — set the Stripe keys
to enable upgrades. See [`.env.example`](.env.example).

```bash
npm run build && npm run start   # production build
```

## Project structure

```
src/
  app/
    page.tsx                 # marketing / sales / pricing / FAQ (SEO)
    login, signup            # auth pages
    app/                     # authenticated product (dashboard, new, editor, settings, billing)
    p/[shareId]/             # public client-facing proposal + accept
    api/                     # auth, company, generate, proposals, public accept, billing
  components/                # UI (editor, forms, buttons, logo)
  lib/                       # db (repository), auth, password, ai, billing, validation, types
docs/                        # strategy, product, growth, automation, roadmap
```

## Documentation

- [`docs/STRATEGY.md`](docs/STRATEGY.md) — market research + validation (Phases 1–2)
- [`docs/PRODUCT.md`](docs/PRODUCT.md) — brand, design, schema, API, security (Phase 3)
- [`docs/GROWTH.md`](docs/GROWTH.md) — pricing, launch checklist, onboarding emails, growth engine (Phases 5–6)
- [`docs/AUTOMATION.md`](docs/AUTOMATION.md) — operational automation (Phase 7)
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — status, bottlenecks, next steps (Phase 8)
