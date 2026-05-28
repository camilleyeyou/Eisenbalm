---
phase: 08-stripe-commerce
plan: 05
subsystem: webhook-handler-and-idempotency
tags: [stripe, webhook, idempotency, convex, security, cmr-04, cmr-05, cmr-06]

# Dependency graph
requires:
  - phase: 08-stripe-commerce
    plan: 01
    provides: Wave 0 Vitest test files (stripe-webhook.test.ts, stripe-webhook-idempotency.test.ts, stripe-webhook-source.test.ts)
  - phase: 08-stripe-commerce
    plan: 03
    provides: convex/stripeEvents.ts claim mutation + convex/stripeOrders.ts insert mutation + stripe@^21.0.0
  - phase: 08-stripe-commerce
    plan: 04
    provides: apps/web/lib/stripe/server.ts getStripeServer() singleton
provides:
  - apps/web/app/api/stripe/webhook/route.ts — POST handler with raw-body signature verification, idempotency claim, runtime=nodejs
  - apps/web/lib/stripe/handlers.ts — handleStripeEvent(event) with atomic dedup + best-effort audit
affects: [08-08-readme-and-smoke-test]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Raw body via await req.text() before JSON parse — protects Stripe HMAC (CMR-04)"
    - "Source-scan tripwire in Vitest (mirrors Phase 7 game-sandbox pattern) — permanent CMR-05 guard"
    - "Atomic claim via Convex stripeEvents.claim — dedup on event.id before any fulfillment (CMR-06)"
    - "Best-effort audit write: stripeOrders.insert errors logged + swallowed; webhook returns 200 regardless (Pitfall 7)"
    - "STRIPE_RECORD_ORDERS=false disables audit write without disabling dedup (feature flag default true)"
    - "Double try/catch: getStripeServer throws on missing STRIPE_SECRET_KEY (500), constructEvent throws on bad sig (400) — distinct error surfaces"

key-files:
  created:
    - apps/web/app/api/stripe/webhook/route.ts
    - apps/web/lib/stripe/handlers.ts
  modified: []

decisions:
  - "Forbidden patterns in JSDoc comments: the source-scan tripwire reads raw file content, so comments listing the forbidden pattern strings by name would trip the test. The comment was rewritten to describe the constraint without embedding the literal forbidden strings."
  - "STRIPE_RECORD_ORDERS=false (string comparison NOT !=='true') — defaults to enabled when unset or any other value, per RESEARCH Open Question 2 conservative default."
  - "charitySlug empty string collapsed to undefined before Convex insert — avoids storing blank string when click-time Sanity read found no charity."
  - "Convex claim re-throws on failure (caller returns 5xx, Stripe retries) — audit write errors are swallowed (claim is the load-bearing atomic write, audit is observability)."

metrics:
  duration: ~5 min
  completed: 2026-05-28
  tasks: 2
  files: 2 (both created)
---

# Phase 8 Plan 05: Webhook Handler and Idempotency Summary

Landed the Stripe webhook handler with raw-body signature verification (CMR-04), atomic Convex-based idempotency (CMR-06), and a permanent source-scan tripwire that makes env-var bypass impossible without a failing test (CMR-05). Three Wave 0 test files that have been failing since Plan 08-01 are now green.

## What Shipped

### `apps/web/app/api/stripe/webhook/route.ts`

POST handler at `POST /api/stripe/webhook`. Key invariants:

| Invariant | Implementation |
|-----------|---------------|
| `runtime = 'nodejs'` | Exported constant — Stripe SDK uses Node crypto; edge runtime breaks it |
| Raw body before JSON | `await req.text()` called before any parse — HMAC is over raw bytes |
| Signature always verified | `stripe.webhooks.constructEvent(rawBody, sig, secret)` — no condition gates it |
| Missing secret → 500 | Misconfiguration; Stripe retries after deploy fix |
| Missing header → 400 | Returns immediately without reading body |
| Bad signature → 400 | constructEvent throws; we return 400 (attacker, not config) |
| Valid event → 200 | After handleStripeEvent completes (processed or replay) |

**Source-scan tripwire (CMR-05):** `apps/web/__tests__/stripe-webhook-source.test.ts` reads the route file from disk at test runtime and asserts 6 structural properties. This is a permanent guard — any future edit that introduces a bypass pattern will fail the Vitest suite.

### `apps/web/lib/stripe/handlers.ts`

`handleStripeEvent(event)` — the business logic layer called by the route handler:

1. **Atomic claim** via `api.stripeEvents.claim({ eventId, eventType, livemode })`. Re-throws on Convex failure (caller returns 5xx; Stripe retries; we have not yet committed to processing).
2. **Early return on replay** (`firstTime=false`): logs and returns 200 so Stripe stops retrying.
3. **checkout.session.completed**: calls `maybeRecordOrder()` — best-effort Convex write.
4. **payment_intent.payment_failed**: log-only.
5. **Unrecognized types**: defensive no-op.

`maybeRecordOrder()`:
- Gated by `STRIPE_RECORD_ORDERS !== 'false'` (defaults enabled if unset).
- Writes `{ sessionId, eventId, amountTotal, currency, customerEmail, charitySlug }` to `api.stripeOrders.insert`.
- Errors are caught and logged — **never re-thrown** (Pitfall 7: audit write failing should not cause Stripe to retry; the claim row already persists).

## Test Results

```
Test Files  3 passed (3)
     Tests  13 passed (13)
```

| Test file | Tests | Result |
|-----------|-------|--------|
| `stripe-webhook.test.ts` (CMR-04) | 4 | All pass |
| `stripe-webhook-idempotency.test.ts` (CMR-06) | 3 | All pass |
| `stripe-webhook-source.test.ts` (CMR-05 tripwire) | 6 | All pass |

`pnpm --filter web build` exits 0.

## STRIPE_RECORD_ORDERS Feature Flag

Default: **`true`** (enabled when env var is unset or any value other than `'false'`).

| Value | Behavior |
|-------|----------|
| `true` or unset | `stripeOrders.insert` called on first-time `checkout.session.completed` |
| `'false'` (exact string) | `stripeOrders.insert` skipped; Stripe Dashboard is sole order source |

Dedup via `stripeEvents.claim` is **always active** regardless of this flag.

## Deviations from Plan

### [Auto-fix — Rule 2] Rewrote JSDoc comment to avoid forbidden pattern strings

The source-scan tripwire reads the raw route.ts file (including comments) and asserts that the strings `SKIP_SIGNATURE`, `BYPASS_SIGNATURE`, `STRIPE_SKIP_VERIFY` are absent. The plan's template JSDoc listed these strings verbatim in the "Locked invariants" section, which caused the source-scan test to fail immediately.

Fixed by rewriting the comment to describe the constraints without embedding the forbidden literal strings.

## Note for Plan 08-08 Smoke Test

To verify signature rejection against the deployed webhook:

```bash
# Should return 400 (forged signature, valid body)
curl -s -X POST https://eisenbalm.com/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: t=0,v1=forged_garbage" \
  -d '{"id":"evt_test","type":"checkout.session.completed"}' \
  | jq .

# Expected: {"error":"Invalid signature"} with HTTP 400
```

For a real delivery test, use `stripe trigger checkout.session.completed` against the test-mode webhook CLI (requires Stripe CLI + `stripe listen` forwarding to localhost or deployed endpoint with test-mode keys).

## Commits

- `275f444` feat(08-05): add handleStripeEvent with Convex idempotency + best-effort audit
- `4241e1c` feat(08-05): Stripe webhook route — CMR-04/CMR-05/CMR-06 satisfied

## Self-Check: PASSED

- `apps/web/app/api/stripe/webhook/route.ts` exists on disk
- `apps/web/lib/stripe/handlers.ts` exists on disk
- Both commit hashes (`275f444`, `4241e1c`) present in `git log --oneline --all`
- 13/13 tests green across all 3 webhook test files
- `pnpm --filter web build` exits 0
- No known stubs that block plan goal (CMR-04/CMR-05/CMR-06 all satisfied with mocked tests)
