# Deployment Guide — launching ProposalForge to paying customers

This guide takes the app from this repo to a live product that accepts real
signups, sends real email, charges real money, and reports real analytics.

The stack is a single Next.js app. It runs anywhere Node 20+ runs — Vercel,
Render, Railway, Fly.io, a VM, or a container.

---

## 1. Prerequisites (accounts to create)

| Service | Why | Notes |
|---|---|---|
| **PostgreSQL** | Production database | Neon, Supabase, Railway, RDS — any managed Postgres. |
| **Anthropic** | AI proposal generation | API key from <https://console.anthropic.com>. |
| **Resend** | Transactional email | Verify a sending domain; get an API key. (Any provider works — swap `deliver()` in `src/lib/email.ts`.) |
| **Stripe** | Subscriptions | One product + recurring price; a webhook endpoint. |
| **Host** | Run the app | Vercel is the simplest for Next.js. |

---

## 2. Environment variables

Set these in your host's environment (and locally in `.env`). See
[`.env.example`](../.env.example).

| Variable | Required | Purpose |
|---|---|---|
| `AUTH_SECRET` | ✅ | Signs session JWTs. Generate: `openssl rand -base64 32`. |
| `DATABASE_URL` | ✅ (prod) | Postgres connection string. **Its presence switches the app from the file adapter to Postgres.** |
| `DATABASE_SSL` | prod often | `true` for managed Postgres that requires SSL. |
| `ANTHROPIC_API_KEY` | ✅ | Enables proposal generation. |
| `NEXT_PUBLIC_APP_URL` | ✅ | Your public URL, e.g. `https://app.proposalforge.com`. **Build-time** — see the note below. |
| `RESEND_API_KEY` | ✅ (email) | Sends real email; if unset, email is logged to the server console. |
| `EMAIL_FROM` | ✅ (email) | Verified sender, e.g. `ProposalForge <noreply@yourdomain.com>`. |
| `STRIPE_SECRET_KEY` | ✅ (billing) | Enables checkout/upgrades. |
| `STRIPE_PRICE_ID_PRO` | ✅ (billing) | The recurring Price ID for the Pro plan. |
| `STRIPE_WEBHOOK_SECRET` | ✅ (billing) | Verifies webhook signatures. |
| `DATABASE_POOL_MAX` | optional | PG pool size (default 10). |

> ⚠️ **`NEXT_PUBLIC_APP_URL` is inlined at build time** (it's a `NEXT_PUBLIC_*`
> var). It must be set **before `npm run build`**, or email links and redirects
> will point at the wrong host. On Vercel, set it as a project env var before
> deploying; in Docker, pass it as a build arg/env at build time.

---

## 3. Database

The Postgres adapter **creates its schema automatically** on first query
(idempotent `CREATE TABLE IF NOT EXISTS`), so there is no separate migration
step for the initial deploy.

1. Provision a Postgres database; copy its connection string into `DATABASE_URL`.
2. If your provider requires SSL, set `DATABASE_SSL=true`.
3. (Optional) Verify connectivity locally:
   `DATABASE_URL=... node -e "require('pg')"` or just boot the app — tables
   appear on first request.

Tables created: `users`, `companies`, `proposals`, `tokens`, `events`.

> For schema changes after launch, apply SQL migrations with your preferred tool
> (the schema lives in `src/lib/db-postgres.ts`). The auto-init only creates
> missing tables; it never alters existing ones.

---

## 4. Stripe (billing)

1. Create a **Product** ("ProposalForge Pro") with a **recurring monthly
   Price** ($39/mo). Copy the **Price ID** (`price_…`) → `STRIPE_PRICE_ID_PRO`.
2. Copy your **Secret key** (`sk_live_…`) → `STRIPE_SECRET_KEY`.
3. Create a **Webhook endpoint** pointing at
   `https://<your-domain>/api/billing/webhook`, subscribed to:
   - `checkout.session.completed` (upgrades user → Pro)
   - `customer.subscription.deleted` (downgrades user → Free)
   Copy the endpoint's **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`.
4. Test with Stripe CLI: `stripe listen --forward-to localhost:3000/api/billing/webhook`
   then `stripe trigger checkout.session.completed`.

Billing is **gated**: with these unset, the upgrade button shows an inactive
state and no charges occur — safe to deploy before billing is configured.

---

## 5. Email (Resend)

1. Add and **verify your sending domain** in Resend (DNS records).
2. Create an API key → `RESEND_API_KEY`.
3. Set `EMAIL_FROM` to a verified address.

Emails sent: verification, welcome, password reset, proposal-accepted
notification, billing upgrade/downgrade. With keys unset, all emails are logged
to the server console (so staging works without a provider).

---

## 6. Deploy

### Option A — Vercel (recommended)

1. Push this repo to GitHub and import it in Vercel.
2. Add all env vars from §2 (especially `NEXT_PUBLIC_APP_URL`).
3. Deploy. Vercel runs `npm run build` automatically.
4. Add your Stripe webhook + Resend domain using the deployed URL.

### Option B — Node server / container

```bash
npm ci
npm run build
npm run start           # serves on $PORT (default 3000)
```

Minimal Dockerfile:

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
```

Run behind a reverse proxy with TLS. Set all runtime env vars on the container.

---

## 7. Post-deploy smoke test

Run through this on the live site:

- [ ] Landing page loads; visit shows up in **Analytics → Visitors**.
- [ ] Sign up → receive verification email → click link → banner clears.
- [ ] Forgot password → receive reset email → reset → log in with new password.
- [ ] Save company profile.
- [ ] Generate a proposal (requires `ANTHROPIC_API_KEY`).
- [ ] Open the share link in an incognito window → **Analytics → Proposal views** increments.
- [ ] Accept the proposal → owner gets the "accepted" email; **Acceptances** increments.
- [ ] Upgrade via Stripe test card `4242 4242 4242 4242` → webhook flips plan to Pro; upgrade email arrives; **Subscriptions** increments.
- [ ] Free-tier limit: a free account is blocked after 3 generations.

---

## 8. Security & operations checklist

- [ ] `AUTH_SECRET` is a strong, unique secret (not the example value).
- [ ] HTTPS everywhere (cookies are `Secure` in production automatically).
- [ ] Postgres has automated backups enabled.
- [ ] Add rate limiting at the edge/proxy for `/api/auth/*`, `/api/generate`,
      and `/api/track` (see ROADMAP — app-level limiter is a fast follow).
- [ ] Add error monitoring (e.g. Sentry) and uptime checks.
- [ ] Restrict the Stripe webhook to Stripe IPs if your host supports it.
- [ ] Rotate API keys via your host's secret manager; never commit `.env`.

---

## 9. Scaling notes

- API routes are stateless — scale horizontally behind a load balancer.
- The only heavy per-request operation is the Claude call (seconds, cents).
- Postgres is the shared state; use a connection pooler (PgBouncer / provider
  pooling) and tune `DATABASE_POOL_MAX` for serverless concurrency.
- Marketing pages are statically rendered for fast, cacheable SEO.
- The `events` table grows with traffic; add a retention/rollup job once volume
  is high (the summary query is indexed on `(type, created_at)`).

You're ready to launch. 🚀
