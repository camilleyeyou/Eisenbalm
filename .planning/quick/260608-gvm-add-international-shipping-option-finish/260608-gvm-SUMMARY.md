---
phase: quick-260608-gvm
plan: 01
subsystem: stripe-checkout
tags: [stripe, shipping, checkout, env-docs, readme]
dependency_graph:
  requires: [quick-260608-fwd]
  provides: [CMR-SHIP-INTL, CMR-10-widened-countries]
  affects: [apps/web/app/api/checkout/create-session/route.ts]
tech_stack:
  added: []
  patterns: [two-rate-shipping-options-array, graceful-no-op-on-missing-env]
key_files:
  created: []
  modified:
    - apps/web/app/api/checkout/create-session/route.ts
    - apps/web/.env.example
    - apps/web/README.md
decisions:
  - Both US ($3) and International ($12) shipping rates offered to all buyers (no per-country filtering — accepted per plan)
  - shippingOptions array built pre-session-create; only pushes ids that are set; spread omitted when array is empty
  - Pre-existing TS errors in test files (mock.calls[0][0] undefined) out of scope per scope-boundary rule — confirmed pre-existing before route.ts edit
metrics:
  duration: ~7min
  completed: "2026-06-08T19:17:50Z"
  tasks_completed: 3
  files_modified: 3
---

# Quick 260608-gvm: Add International Shipping Option — Summary

**One-liner:** Stripe Checkout now offers US ($3) + International ($12) shipping rates via a two-entry `shipping_options` array with `allowed_countries` widened to 9 countries (US/CA/GB/DE/FR/IE/NL/ES/IT); both README Stripe env tables completed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire STRIPE_SHIPPING_RATE_ID_INTL env | 91cb372 | apps/web/.env.example |
| 2 | Offer US + International shipping in checkout session | 0b06f45 | apps/web/app/api/checkout/create-session/route.ts |
| 3 | Finish Stripe env docs in README (both stale TODOs) | 7b92a71 | apps/web/README.md |

Note: `.env.local` was updated locally (gitignored) with the real `shr_1Tg8WzIA8FV5c3Jm9SMT0UJd` INTL rate id. Not committed per plan constraints.

## What Was Built

**Task 1 — Env wiring:**
- `apps/web/.env.local`: Added `STRIPE_SHIPPING_RATE_ID_INTL=shr_1Tg8WzIA8FV5c3Jm9SMT0UJd` immediately after the US rate line (gitignored, not committed).
- `apps/web/.env.example`: Added blank `STRIPE_SHIPPING_RATE_ID_INTL=` placeholder with a comment matching the existing US block style.

**Task 2 — Checkout route:**
- Reads `STRIPE_SHIPPING_RATE_ID_INTL` alongside the existing `STRIPE_SHIPPING_RATE_ID`.
- Builds a typed `shippingOptions: { shipping_rate: string }[]` array — US first, then INTL — pushing only set ids.
- `allowed_countries` widened from `['US']` to `['US','CA','GB','DE','FR','IE','NL','ES','IT']`.
- Replaces the inline `...(shippingRateId ? { shipping_options: [...] } : {})` spread with `...(shippingOptions.length > 0 ? { shipping_options: shippingOptions } : {})`.
- Graceful no-op: when both env ids are unset, `shipping_options` key is absent from the session — all 42 test suites (391 tests) stay green.

**Task 3 — README:**
- Environment variables table: added 6 Stripe rows (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID, STRIPE_SHIPPING_RATE_ID, STRIPE_SHIPPING_RATE_ID_INTL, STRIPE_RECORD_ORDERS); replaced "Phase 8 adds Stripe env vars to this list." with accurate note on secret placement.
- Deploying to Vercel table: added same 6 Stripe rows with non-secret placeholder descriptions; replaced "Phase 8 adds Stripe variables to this list." with "Set the Stripe variables above in the Vercel dashboard — never commit secret values."

## Verification

- `pnpm --filter web test:unit`: 42 test files passed, 391 tests passed, 0 failures.
- `! grep -q "Phase 8 adds Stripe" apps/web/README.md`: confirmed (both stale sentences gone).
- `grep -c "STRIPE_SHIPPING_RATE_ID_INTL" apps/web/README.md`: 2 (env table + Vercel table).
- `grep -q "STRIPE_SHIPPING_RATE_ID_INTL=" apps/web/.env.example`: confirmed.
- `grep -q "STRIPE_SHIPPING_RATE_ID_INTL=shr_1Tg8WzIA8FV5c3Jm9SMT0UJd" apps/web/.env.local`: confirmed.

## Deviations from Plan

**1. [Scope Boundary] Pre-existing typecheck errors in test files**
- **Found during:** Task 2 (`pnpm --filter web typecheck`)
- **Issue:** `__tests__/checkout-create-session.test.ts` and `__tests__/stripe-webhook-idempotency.test.ts` have pre-existing `TS2532: Object is possibly 'undefined'` errors on `mock.calls[0][0]` (Vitest mock typing). Confirmed pre-existing by stashing the route.ts change and re-running typecheck — identical errors.
- **Action:** Logged; not fixed per scope-boundary rule (unrelated to current task changes, pre-existing in test files not touched by this plan).
- **Impact:** `pnpm --filter web typecheck` exits non-zero. The vitest runtime suites (all 42) are green. The plan's verification criterion specifies vitest suites, not tsc on test files.

## Known Stubs

None. The international shipping option is fully wired from env to Stripe session. Human checkpoint (Task 4) verifies the live session shows both rates and the 9-country list — that remains for the orchestrator smoke test.

## Self-Check: PASSED

Files modified verified to exist:
- apps/web/app/api/checkout/create-session/route.ts: present
- apps/web/.env.example: present, contains STRIPE_SHIPPING_RATE_ID_INTL=
- apps/web/README.md: present, no "Phase 8 adds Stripe" occurrences

Commits verified:
- 91cb372: chore(quick-260608-gvm-01): document STRIPE_SHIPPING_RATE_ID_INTL in .env.example
- 0b06f45: feat(quick-260608-gvm-01): add international shipping option to checkout session
- 7b92a71: docs(quick-260608-gvm-01): complete Stripe env documentation in README
