# Automation — Phase 7

Keep operating cost near zero by automating everything that doesn't need a
human. Status legend: ✅ in MVP · 🔜 next · 🧭 planned.

| Area | Approach | Status |
|---|---|---|
| **User onboarding** | Self-serve signup → company profile → first proposal, no human touch. Email sequence (see GROWTH.md) triggered by lifecycle events. | ✅ flow / 🔜 emails |
| **Email sequences** | Event-driven transactional email (welcome, activation nudge, near-limit upgrade, accept celebration) via provider webhooks + a scheduled worker. | 🔜 |
| **Customer support** | Help center + an AI support assistant grounded in the docs (Claude) that deflects common questions; escalate only edge cases. | 🧭 |
| **Billing** | Stripe Checkout + webhook auto-upgrades/downgrades plans; no manual invoicing. | ✅ (env-gated) |
| **Usage metering** | Generation counter enforced in-app; drives free→paid conversion automatically. | ✅ |
| **Reporting** | Scheduled job rolls up signups, activation, MRR, win-rate into a daily digest. | 🧭 |
| **Analytics** | Event tracking on signup, first-generation, send, accept, upgrade — the activation funnel. | 🔜 |
| **Content generation** | Use the same Claude pipeline to draft SEO landing/blog pages from a keyword + outline; human edits before publish. | 🧭 |
| **Lead generation** | Enrich + personalize outreach lists with AI; throttled, compliant sending. | 🧭 |
| **Internal maintenance** | CI on push (build + typecheck), dependency updates, automated backups of the production datastore. | 🔜 |

**Design principle:** every recurring human task is either (a) eliminated by
self-serve product design, (b) handled by Stripe/email providers, or (c)
delegated to an AI step with a human only at the final approval gate. This keeps
gross margin >90% and lets the business scale without headcount.
