---
phase: 55-public-site-redesign
plan: 04
subsystem: convex-backend
tags: [convex, newsletter, stripe, aggregate]
requires: []
provides:
  - api.stripeOrders.balmsForCharity
  - api.emailSubscribers.subscribeNewsletter
  - POST /api/email/subscribe
affects: [55-07, 55-08]
key-files:
  created:
    - apps/web/app/api/email/subscribe/route.ts
    - apps/web/__tests__/newsletter-route.test.ts
  modified:
    - convex/stripeOrders.ts
    - convex/emailSubscribers.ts
decisions:
  - "Newsletter mutation uses the existing STRIPE_TO_CONVEX_SECRET webhook-secret lane (no new env var)"
metrics:
  completed: 2026-10-17
---

# Phase 55 Plan 04: Convex Newsletter Backend Summary

Aggregate-only `balmsForCharity` query, secret-guarded `subscribeNewsletter` mutation (idempotent via `upsertSubscriber`, source `newsletter-optin`), and a non-enumerating, honeypot-aware `POST /api/email/subscribe` route; both Convex functions synced to dev:modest-magpie-797.

## Commits
- 2ebc844a: Convex query + mutation
- 8fec7f25: subscribe route + tests

## Verification
- `pnpm --filter @eisenbalm/convex typecheck`: clean
- `pnpm --filter web test -- newsletter-route`: 8/8 pass; `pnpm --filter web typecheck`: clean
- `convex dev:once`: succeeded (no auth issue)
- `convex run stripeOrders:balmsForCharity '{"charitySlug":"phase55-verify-no-orders"}'` -> `{ "balms": 0, "donationCents": 0, "orders": 0 }`
- `convex run emailSubscribers:subscribeNewsletter` with wrong secret -> exit 1, `Uncaught Error: Unauthorized at requireWebhookSecret (emailSubscribers.ts:172)`; no row written

## Deviations from Plan
None. `convex/_generated/api.d.ts` did not change (module-keyed), so nothing to commit there.

## User setup required
No new env vars. `STRIPE_TO_CONVEX_SECRET` must already be set on Vercel production and the target Convex deployment (checked in Plan 13). Production Convex has NOT been deployed; only dev was synced.

## Known Stubs
None.

## Self-Check: PASSED
