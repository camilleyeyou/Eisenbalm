---
phase: quick-260608-fwd
plan: 01
subsystem: stripe-commerce
tags: [shipping, donation-ledger, convex, stripe, webhook]
dependency_graph:
  requires: []
  provides: [CMR-SHIP-01, CMR-DONATE-01]
  affects: [convex/schema.ts, convex/stripeOrders.ts, apps/web/lib/stripe/handlers.ts, apps/web/app/api/checkout/create-session/route.ts]
tech_stack:
  added: [convex/charityLedger.ts, apps/web/scripts/charity-ledger.mjs]
  patterns: [conditional-spread-env-guard, basil-safe-cast, convex-additive-schema, legacy-fallback-chain]
key_files:
  created:
    - convex/charityLedger.ts
    - apps/web/scripts/charity-ledger.mjs
  modified:
    - apps/web/.env.example
    - apps/web/app/api/checkout/create-session/route.ts
    - convex/schema.ts
    - convex/stripeOrders.ts
    - apps/web/lib/stripe/handlers.ts
    - apps/web/README.md
decisions:
  - donationAmount == amountSubtotal at write time (caller sets, schema stores verbatim)
  - basil-safe cast uses unknown double-cast to avoid TS type errors on SDK lag
  - charityLedger uses by_createdAt index for date-range queries, full scan for all-time
  - charity-ledger.mjs uses dynamic import for generated api with string-based fallback
metrics:
  duration: ~12 min
  completed: "2026-06-08"
  tasks: 4
  files: 8
---

# Quick Task 260608-fwd: Wire US Shipping Options + Charity Donation Ledger

**One-liner:** Flat $3 US shipping attached to every Stripe Checkout session via `STRIPE_SHIPPING_RATE_ID`, with product subtotal / shipping / donation stored as separate cents fields on each order and a Convex query + export script reporting per-charity donation totals (product subtotal only, shipping excluded).

## Tasks Completed

| Task | Name | Commit | Key files |
|------|------|--------|-----------|
| 1 | Env wiring + checkout shipping_options | 238e6eb | .env.example, create-session/route.ts |
| 2 | Convex schema + insert mutation (additive) | ff13893 | convex/schema.ts, convex/stripeOrders.ts |
| 3 | Webhook extraction in maybeRecordOrder | 34fe998 | apps/web/lib/stripe/handlers.ts |
| 4 | charityLedger query + export script + README | 55a61f9 | convex/charityLedger.ts, scripts/charity-ledger.mjs, README.md |

## What Was Built

### Task 1 — Env wiring + checkout shipping_options
- `apps/web/.env.local`: added `STRIPE_SHIPPING_RATE_ID=shr_1Tg7rtIA8FV5c3JmLjOZUbYO` (gitignored, not committed)
- `apps/web/.env.example`: documented blank `STRIPE_SHIPPING_RATE_ID=` placeholder after the `STRIPE_PRICE_ID` block, with comment explaining graceful no-op when unset
- `create-session/route.ts`: reads `shippingRateId = process.env.STRIPE_SHIPPING_RATE_ID` after priceId guard; conditionally spreads `shipping_options: [{ shipping_rate: shippingRateId }]` into `sessions.create`; all existing fields preserved (shipping_address_collection US, phone_number_collection, automatic_tax, metadata.charitySlug, success/cancel urls)

### Task 2 — Convex schema + insert mutation (additive)
- `convex/schema.ts`: added 6 optional fields to `stripeOrders` (`amountSubtotal`, `amountShipping`, `donationAmount`, `customerName`, `phone`, `shippingAddress` object) + `.index('by_createdAt', ['createdAt'])`; all existing fields and indexes preserved
- `convex/stripeOrders.ts`: extended `insert` mutation args to accept the 6 new optional fields; handler persists them into `ctx.db.insert`; `ctx.scheduler.runAfter(0, internal.emailFlow.enqueueEmailFlow)` try/catch + `return null` fully preserved
- Convex codegen confirmed via `convex dev --once`: `✔ Added table indexes: [+] stripeOrders.by_createdAt`

### Task 3 — Webhook extraction in maybeRecordOrder
- `apps/web/lib/stripe/handlers.ts`: inside the existing try block, before the insert call:
  - extracts `amountSubtotal` from `session.amount_subtotal ?? 0`
  - extracts `amountShipping` from `session.total_details?.amount_shipping ?? 0`
  - defensive basil-safe double-cast to reach `collected_information?.shipping_details` with fallback to legacy `shipping_details`
  - passes all new fields to `api.stripeOrders.insert`; `donationAmount = amountSubtotal` (shipping excluded)
- `STRIPE_RECORD_ORDERS` gate + best-effort catch (console.error + swallow) + `amountTotal` preserved unchanged
- All 3 stripe webhook test suites green: 13 tests passed (stripe-webhook.test.ts, stripe-webhook-idempotency.test.ts, stripe-webhook-source.test.ts)

### Task 4 — charityLedger query + export script + README
- `convex/charityLedger.ts`: runtime-safe Convex `query` (no Node imports); optional `startMs`/`endMs` args drive `by_createdAt` index range scan or full collect; groups by `charitySlug ?? 'unknown'`; donation fallback chain `donationAmount ?? amountSubtotal ?? amountTotal ?? 0`; sorted donation desc
- `apps/web/scripts/charity-ledger.mjs`: ESM, reads `NEXT_PUBLIC_CONVEX_URL` (exits 1 with clear message if unset); parses `--year YYYY`; calls `charityTotals`; prints aligned table (charitySlug | donation | shipping | orders | currency); writes `charity-ledger-<year|all>.csv`; `node --check` passes
- `apps/web/README.md`: "Charity donation ledger" section appended after Phase 10 Verifying block with both invocation forms and the subtotal-only clarification

## Verification

- `convex dev --once`: codegen clean on Tasks 2 and 4 (confirmed live against `modest-magpie-797`)
- `node --check apps/web/scripts/charity-ledger.mjs`: syntax valid (no output = pass)
- 3 stripe webhook suites: `Test Files 3 passed (3), Tests 13 passed (13)`
- typecheck: pre-existing errors in `__tests__/checkout-create-session.test.ts` and `__tests__/stripe-webhook-idempotency.test.ts` (TS2532 `Object is possibly 'undefined'` on `mock.calls[0][0]`). Confirmed pre-existing via `git stash` round-trip — not caused by any change in this task. Deferred per CLAUDE.md scope boundary (unrelated test files, out of scope).

## Deviations from Plan

None. Plan executed exactly as written.

## Known Stubs

None. All data flows from real Stripe session fields to Convex storage.

## Self-Check: PASSED

- convex/charityLedger.ts: FOUND
- apps/web/scripts/charity-ledger.mjs: FOUND
- convex/schema.ts contains `amountSubtotal`: CONFIRMED (line 142)
- convex/charityLedger.ts contains `charityTotals`: CONFIRMED (line 14)
- create-session/route.ts contains `shippingRateId`: CONFIRMED (lines 48, 92-94)
- handlers.ts contains `amountSubtotal`: CONFIRMED (lines 83, 106, 108)
- Commits 238e6eb, ff13893, 34fe998, 55a61f9: all present in git log
