# Product Design — Phase 3

## Brand

- **Name:** **Proposls** (working brand: "ProposalForge" internally). Public
  product name used in the app: **ProposalForge**.
- **Tagline:** *Win more deals. Write proposals in minutes, not hours.*
- **Positioning:** The AI-native proposal tool for agencies, consultants, and
  service businesses. Describe the project; get a client-ready proposal.
- **Logo concept:** A bold anvil/spark mark ("forge") in deep indigo with an
  amber spark — conveys craftsmanship + speed. Wordmark in a clean grotesk.
- **Voice:** Confident, practical, time-respecting. No fluff (the same promise
  we make about the proposals it writes).

## Product vision

Every service business should be able to turn a rough brief into a persuasive,
correctly-scoped, on-brand proposal in minutes — and close faster. We start
with drafting (the painful 10x), then expand into the full deal lifecycle
(templates, e-sign, analytics, follow-up automation).

## Feature roadmap

- **MVP (this repo):** auth, company profile, AI generation from a brief,
  proposal editor, shareable public proposal + accept, dashboard, usage limits,
  Stripe-ready billing.
- **v1.1:** PDF export, email send + open/view tracking, proposal templates.
- **v1.2:** e-signature, pricing-table line items with totals, team seats.
- **v2:** CRM integrations (HubSpot/Pipedrive), follow-up email automation,
  analytics (win rate, time-to-accept), AI follow-up suggestions.

## Architecture

- **Stack:** Next.js (App Router) + TypeScript + Tailwind CSS — one codebase,
  SSR for SEO marketing pages, API routes for the backend. Low cost, scalable
  on serverless/Node.
- **AI:** Anthropic Claude via the official `@anthropic-ai/sdk`, model
  `claude-opus-4-8`, streaming for generation. Prompt assembles the company
  profile + brief into a structured proposal.
- **Data:** Prisma ORM. SQLite for local dev; Postgres in production via
  `DATABASE_URL` (no code change — just the datasource URL/provider).
- **Auth:** Email + password. Passwords hashed with `scrypt` (Node built-in,
  no native deps). Sessions are signed JWTs (`jose`) in an httpOnly cookie.
- **Billing:** Stripe Checkout + webhook, gated by `STRIPE_SECRET_KEY`. Plans
  and usage live in the DB; the free tier enforces a generation quota.

### Why these decisions

- **Single Next.js app** minimizes infra and lets marketing pages be statically
  fast for SEO while the app and API share types and auth.
- **Prisma + Postgres-ready** is the standard production pattern; SQLite keeps
  local dev zero-setup.
- **scrypt + jose** avoid native build pain (bcrypt) while staying secure.
- **Claude Opus 4.8** is the strongest model for persuasive, well-structured
  long-form writing — the core of the product's value.

## Database schema (Prisma)

- **User**: id, email (unique), passwordHash, name, plan (`free`|`pro`),
  stripeCustomerId, generationsUsed, createdAt.
- **Company** (1:1 with User): name, website, industry, services (text),
  tone, valueProps, defaultCurrency — the reusable AI context.
- **Proposal**: id, userId, title, clientName, clientCompany, brief, contentJson
  (structured sections), status (`draft`|`sent`|`accepted`|`declined`),
  shareId (public token), amount, currency, createdAt, updatedAt, acceptedAt,
  acceptedBy.

## API design

- `POST /api/auth/signup` — create user + session.
- `POST /api/auth/login` — authenticate + session.
- `POST /api/auth/logout` — clear session.
- `GET  /api/proposals` — list current user's proposals.
- `POST /api/proposals` — create a proposal (persists brief + generated content).
- `GET/PATCH/DELETE /api/proposals/:id` — read/update/delete.
- `POST /api/generate` — stream an AI-generated proposal from a brief +
  company profile (enforces free-tier quota).
- `POST /api/proposals/:id/send` — mark sent, return share link.
- `POST /api/public/:shareId/accept` — client accepts (public, no auth).
- `POST /api/billing/checkout` — create Stripe Checkout session (gated).
- `POST /api/billing/webhook` — Stripe events → upgrade plan (gated).

## Security

- httpOnly, SameSite=Lax, Secure cookies; signed JWT sessions.
- scrypt password hashing with per-user salt; constant-time compare.
- Authz checks on every proposal route (owner-only).
- Public proposal access only via unguessable `shareId`.
- Input validation with `zod` on all API bodies.
- No secrets in the repo; all keys via env (`.env.example` documents them).

## Mobile-first responsive UI

Tailwind, mobile-first breakpoints. The app and the client-facing proposal page
are designed to read well on phones (clients often open proposals on mobile).

## Scalability

Stateless API routes (horizontal scale), Postgres for prod, LLM calls are the
only heavy op and are per-request and cheap. Caching of marketing pages via
static rendering. Usage metering in the DB supports plan enforcement and future
analytics.
