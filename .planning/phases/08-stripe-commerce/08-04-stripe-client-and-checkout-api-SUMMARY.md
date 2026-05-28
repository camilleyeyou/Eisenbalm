---
phase: 08-stripe-commerce
plan: "04"
subsystem: commerce
tags: [stripe, checkout, api-route, client-component, cmr-02, cmr-10]
dependency_graph:
  requires: [08-01, 08-03]
  provides: [stripe-singleton, checkout-session-route, buy-button]
  affects: [08-05-webhook, 08-06-shop-page, 08-08-smoke-test]
tech_stack:
  added: []
  patterns:
    - Lazy singleton factory (getStripeServer) for server-only SDK init
    - Stripe apiVersion pinned via constant (STRIPE_API_VERSION)
    - GROQ best-effort charity slug lock at checkout click time (Open Question 1)
    - window.location.href redirect to Stripe-hosted Checkout (no @stripe/stripe-js)
    - 'use client' BuyButton with loading state guard
key_files:
  created:
    - apps/web/lib/stripe/server.ts
    - apps/web/lib/stripe/constants.ts
    - apps/web/app/api/checkout/create-session/route.ts
    - apps/web/components/marketing/BuyButton.tsx
  modified: []
decisions:
  - STRIPE_API_VERSION pinned to '2025-04-30.basil' (stripe@21.0.1 default; cross-references Plan 08-03 SUMMARY which records the SDK at ^21.0.0 resolved 21.0.1)
  - quantity locked at 1 (API_CONTRACTS §6.1 sketch superseded by RESEARCH v1 lock; docs update deferred)
  - automatic_tax disabled pending Andrew's Stripe Tax configuration
  - allowed_countries ['US'] only in v1; expand when Andrew configures more shipping rates
  - charitySlug lock is best-effort (try/catch) — Sanity outage must not block checkout
  - Live Stripe smoke deferred to Plan 08-08 UAT (STRIPE_SECRET_KEY is sk_live_* in .env.local; test mocks only in unit tests)
metrics:
  duration: "~7 min"
  completed: "2026-05-28T16:21:36Z"
  tasks_completed: 3
  files_changed: 4
---

# Phase 8 Plan 04: Stripe Client and Checkout API Summary

Stripe SDK singleton, checkout-session API route, and BuyButton Client Component. Wave 0 unit test (checkout-create-session.test.ts) turns green from 0/6 to 6/6.

## What Was Built

### apps/web/lib/stripe/constants.ts
- `STRIPE_API_VERSION = '2025-04-30.basil' as const` — pins the apiVersion used when constructing the Stripe client (RESEARCH Pitfall 6 — prevents silent API contract drift on SDK bumps)
- `buildSuccessUrl()` — returns `${getSiteUrl()}/shop/thank-you?session_id={CHECKOUT_SESSION_ID}` (Stripe substitutes the literal template at redirect time)
- `buildCancelUrl()` — returns `${getSiteUrl()}/shop`

### apps/web/lib/stripe/server.ts
- `getStripeServer()` — lazy singleton factory; throws `Error('STRIPE_SECRET_KEY is not set…')` when env var absent; caches instance in module-scoped `_stripe`
- `_resetStripeServerForTests()` — test-only helper to clear singleton between cases
- `apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion` cast — avoids TypeScript type error on pinned version string with evolving SDK union type

### apps/web/app/api/checkout/create-session/route.ts
- `export const runtime = 'nodejs'` — Stripe SDK uses Node crypto, incompatible with Edge runtime
- `export const dynamic = 'force-dynamic'` — prevents response caching
- `POST` handler:
  - Returns 500 `{ error }` when `STRIPE_PRICE_ID` is unset
  - Best-effort GROQ query for current charity slug (try/catch; falls back to `''`)
  - `stripe.checkout.sessions.create` called with `mode: 'payment'`, `line_items: [{ price: priceId, quantity: 1 }]`, `shipping_address_collection: { allowed_countries: ['US'] }`, `phone_number_collection`, `success_url`, `cancel_url`, `metadata.charitySlug`
  - Returns `{ url: session.url }` on success

### apps/web/components/marketing/BuyButton.tsx
- `'use client'` on line 1
- `useState(loading)` loading guard; disables button and shows 'Redirecting…' while in-flight
- `window.location.href = body.url` redirect (external Stripe domain — no useRouter)
- `console.error` only on failure (no toast/Sonner/modal per voice rules)
- Uses shadcn `Button` with `--color-*` CSS tokens (WCAG AA on light base, ≥44px touch target via `size="lg"`)
- Button copy: 'Buy the lip balm' (matches ShopCallout verbatim per UI-SPEC)

## Test Results

```
apps/web/__tests__/checkout-create-session.test.ts (6 tests) — ALL PASS

✓ returns 200 with { url } pointing at Stripe-hosted checkout
✓ passes mode: 'payment', quantity=1, and STRIPE_PRICE_ID to Stripe
✓ enables shipping_address_collection (CMR-10)
✓ sets success_url to /shop/thank-you with {CHECKOUT_SESSION_ID} placeholder
✓ sets cancel_url to /shop
✓ returns 500 when STRIPE_PRICE_ID is unset
```

`pnpm --filter web build` exits 0. Route appears as `ƒ /api/checkout/create-session` (dynamic server-rendered).

## Requirements Satisfied

- **CMR-02**: `stripe.checkout.sessions.create()` called with `mode: 'payment'` and correct `line_items` — verified in unit tests
- **CMR-10**: `shipping_address_collection.allowed_countries` is non-empty array — verified in unit tests
- **Open Question 1 (closed)**: `charitySlug` locked into `session.metadata` at click time, not webhook time — prevents race with mid-week issue publishing
- **RESEARCH Pitfall 6**: `STRIPE_API_VERSION` constant pins `'2025-04-30.basil'` — single place to update on SDK major bump

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| STRIPE_API_VERSION | `'2025-04-30.basil'` | Matches stripe@21.0.1 (resolved in Plan 08-03); single-point pin per RESEARCH Pitfall 6 |
| quantity | Locked at 1 | RESEARCH v1 spec; no cart UI; API_CONTRACTS §6.1 sketch superseded |
| automatic_tax | `{ enabled: false }` | Requires Andrew to configure Stripe Tax in Dashboard; deferred to Phase 8.x |
| allowed_countries | `['US']` | v1 US-only; expand when Andrew adds international shipping rates |
| charitySlug fallback | `''` (empty string) | Sanity outage must not block checkout; webhook handler handles empty slug |
| Live smoke | Deferred to 08-08 | `.env.local` has sk_live_* key; unit tests mock Stripe; no live calls executed |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all 4 files implement their full v1 behavior. BuyButton is ready for Plan 08-06 to import into the /shop page.

## Deferred Items

- Live Stripe smoke test (verify session.url resolves in browser): deferred to Plan 08-08 manual UAT. Andrew must swap `.env.local` to test keys (`sk_test_*`) before running smoke, as documented in Plan 08-08.
- `automatic_tax: { enabled: false }` → requires Andrew to configure Stripe Tax in Dashboard; flip to `{ enabled: true }` when ready.
- `allowed_countries: ['US']` → expand to additional countries when Andrew configures international shipping rates.

## Self-Check

Files exist:

- `apps/web/lib/stripe/server.ts` — FOUND
- `apps/web/lib/stripe/constants.ts` — FOUND
- `apps/web/app/api/checkout/create-session/route.ts` — FOUND
- `apps/web/components/marketing/BuyButton.tsx` — FOUND

Commits exist:

- `3e6bc52` feat(08-04): Stripe SDK singleton + URL constant builders — FOUND
- `bbfedb8` feat(08-04): POST /api/checkout/create-session route (CMR-02 + CMR-10) — FOUND
- `0a6e3a6` feat(08-04): BuyButton Client Component for Stripe Checkout redirect — FOUND

## Self-Check: PASSED
