---
phase: 08-stripe-commerce
verified: 2026-05-28T10:15:00Z
status: human_needed
score: 10/10 CMR requirements verified at code + unit-test level
human_verification:
  - test: "Swap .env.local to sk_test_ keys and run a real test-mode purchase with Stripe card 4242 4242 4242 4242"
    expected: "Browser redirects to Stripe Checkout, payment completes, lands on /shop/thank-you with 'Your lip balm is on the way.' — no DB query on that page"
    why_human: "Unit tests mock Stripe. No live Stripe call was made during this build. sk_live_* keys are present in .env.local; safe smoke requires sk_test_* first. Deferred per user decision 2026-05-27."
  - test: "Run forged-signature curl against deployed endpoint: curl -X POST https://<host>/api/stripe/webhook -H 'stripe-signature: t=0,v1=forged_garbage' -d '{\"id\":\"evt_test\"}'"
    expected: "HTTP 400 with {\"error\":\"Invalid signature\"}"
    why_human: "Unit tests verify this with mocked Stripe SDK. Deployed-endpoint confirmation requires live keys + network."
  - test: "Use Stripe CLI to replay a checkout.session.completed event twice: stripe trigger checkout.session.completed (twice)"
    expected: "First delivery: Convex stripeEvents row inserted, stripeOrders row inserted. Second delivery: webhook returns 200 and logs 'replay ignored: evt_... (checkout.session.completed)' — stripeOrders NOT inserted twice."
    why_human: "CMR-06 idempotency is verified via Vitest mocks. Live dedup confirmation requires Stripe CLI + deployed Convex."
  - test: "Visit /legal/privacy and /legal/terms; confirm pages load (no 404) and placeholder text is present"
    expected: "Both pages render with 'Last updated: placeholder pending Andrew's review.' — confirmed not 404"
    why_human: "File-existence verified by Vitest. Runtime route test requires a running server."
  - test: "Andrew reviews and replaces placeholder legal copy in /legal/privacy and /legal/terms before public launch"
    expected: "Both pages contain reviewed, accurate privacy policy and terms of service (not placeholder prose)"
    why_human: "This is Andrew's editorial decision. Placeholder copy with TODO(Andrew) markers is intentional for v1 code-completeness. Tracked in .planning/STATE.md Blockers/Concerns."
  - test: "Stripe Dashboard checkpoint (08-02): verify sk_test_ keys are swapped in before any live smoke"
    expected: "apps/web/.env.local has STRIPE_SECRET_KEY=sk_test_... and STRIPE_WEBHOOK_SECRET=whsec_... from a test-mode webhook endpoint"
    why_human: "08-02 is a human-action plan (autonomous: false). Currently .env.local holds sk_live_* keys. This must happen before items 1-3 above."
---

# Phase 8: Stripe / Commerce Verification Report

**Phase Goal:** A reader can view the lip balm product at `/shop` (server-rendered, no client flicker), complete a Stripe Checkout purchase, and land on `/shop/thank-you`; the webhook handler verifies signatures unconditionally with raw body, deduplicates on `event.id`, and the persistent shop callout appears on every issue page.

**Verified:** 2026-05-28T10:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Summary

The automated portion of Phase 8 is **fully green**: 215/215 Vitest tests pass, `pnpm --filter web build` exits 0, all 10 CMR requirements are satisfied at the code + mocked-unit-test level. Two plans remain deliberately deferred per user decision 2026-05-27: **08-02** (Stripe Dashboard key swap, Andrew checkpoint) and **08-08** (manual UAT real purchase). These are tracked human work, not code defects.

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/shop` is server-rendered with charity callout; clicking through creates a Stripe Checkout session; `/shop/thank-you` has no DB query | VERIFIED | `shop-page.test.ts` 6/6 green; `thank-you-source.test.ts` 5/5 green; `checkout-create-session.test.ts` 6/6 green; build shows `/shop` at 2.05 kB with `revalidate=60`, `/shop/thank-you` as dynamic (ƒ) |
| 2 | Forged signature returns non-200; same `event.id` twice triggers fulfillment exactly once; no code path bypasses signature verification in any environment | VERIFIED (code+mocks) / DEFERRED (live) | `stripe-webhook.test.ts` 4/4 green (valid/forged/missing/no-secret); `stripe-webhook-idempotency.test.ts` 3/3 green (firstTime=true/false/args); `stripe-webhook-source.test.ts` 6/6 green (FORBIDDEN_BYPASS scan); live end-to-end deferred to 08-08 |
| 3 | Shop callout (one sentence + button) on every issue page — no banner/modal/popup/countdown; `/legal/privacy` and `/legal/terms` load without 404 | VERIFIED | `issue-page-shop-callout.test.ts` 5/5 green; `legal-pages.test.ts` 4/4 green; build output shows `/legal/privacy` and `/legal/terms` as Static (○) routes |

**Score:** 3/3 truths verified at automated level; 2/3 truths have deferred live-environment confirmation.

---

## Required Artifacts

| Artifact | CMR | Status | Details |
|----------|-----|--------|---------|
| `apps/web/app/shop/page.tsx` | CMR-01 | VERIFIED | Async server component; `'use client'` absent; imports `sanityClient`; renders `<BuyButton />`; `export const revalidate = 60` |
| `apps/web/app/api/checkout/create-session/route.ts` | CMR-02, CMR-10 | VERIFIED | `runtime='nodejs'`; `mode:'payment'`; `line_items:[{price:priceId, quantity:1}]`; `shipping_address_collection:{allowed_countries:['US']}`; `success_url` with `{CHECKOUT_SESSION_ID}`; `cancel_url=/shop` |
| `apps/web/app/shop/thank-you/page.tsx` | CMR-03 | VERIFIED | No Sanity/Convex/fetch/stripe imports; resolves but discards `searchParams`; `robots:{index:false,follow:false}` |
| `apps/web/app/api/stripe/webhook/route.ts` | CMR-04, CMR-05 | VERIFIED | `await req.text()` before parse; `constructEvent(rawBody, sig, secret)` always called; `runtime='nodejs'`; no FORBIDDEN_BYPASS patterns; no edge runtime |
| `apps/web/lib/stripe/handlers.ts` | CMR-06 | VERIFIED | Calls `api.stripeEvents.claim` before any fulfillment; early-returns on `firstTime=false`; best-effort `stripeOrders.insert` in try/catch |
| `apps/web/app/legal/privacy/page.tsx` | CMR-07 | VERIFIED | File exists; `export default function PrivacyPage()`; placeholder copy with `TODO(Andrew)` — intentional, tracked in STATE.md |
| `apps/web/app/legal/terms/page.tsx` | CMR-08 | VERIFIED | File exists; `export default function TermsPage()`; placeholder copy with `TODO(Andrew)` — intentional, tracked in STATE.md |
| `apps/web/components/issue/ShopCallout.tsx` | CMR-09 | VERIFIED | Exists (Phase 2 artifact); imported and rendered in `apps/web/app/issue/[slug]/page.tsx`; code-only scan confirms no banner/modal/popup/countdown behavior |
| `apps/web/components/marketing/BuyButton.tsx` | CMR-02 | VERIFIED | `'use client'`; `useState(loading)` guard; `window.location.href = body.url`; `console.error` only (no toast/modal/banner) |
| `apps/web/lib/stripe/server.ts` | CMR-02, CMR-04 | VERIFIED | Lazy singleton; throws on missing `STRIPE_SECRET_KEY`; `apiVersion: STRIPE_API_VERSION` pinned |
| `apps/web/lib/stripe/constants.ts` | CMR-02, CMR-10 | VERIFIED | `STRIPE_API_VERSION = '2025-04-30.basil'`; `buildSuccessUrl()` includes `{CHECKOUT_SESSION_ID}`; `buildCancelUrl()` returns `/shop` |
| `convex/stripeEvents.ts` | CMR-06 | VERIFIED | `claim` mutation with `withIndex('by_eventId').first()` + conditional insert; returns `{firstTime: true as const}` / `{firstTime: false as const}` |
| `convex/stripeOrders.ts` | CMR-06 | VERIFIED | `insert` mutation with `createdAt: Date.now()`; server-side timestamp per Phase 3 D-12 convention |
| `convex/schema.ts` | CMR-06 | VERIFIED | `stripeEvents` table with `by_eventId` index; `stripeOrders` table with `by_sessionId` and `by_charitySlug_createdAt` indexes; 7 tables total (5 pipeline + 2 new) |
| `apps/web/package.json` | CMR-02 | VERIFIED | `"stripe": "^21.0.0"` — pinned per RESEARCH 30-day stability rule |
| `apps/web/.env.example` | — | VERIFIED | Documents `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `STRIPE_RECORD_ORDERS`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (RESERVED) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `BuyButton.tsx` | `/api/checkout/create-session` | `fetch('/api/checkout/create-session', {method:'POST'})` | WIRED | Line 25 of BuyButton.tsx; response `body.url` used for redirect |
| `create-session/route.ts` | Stripe API | `stripe.checkout.sessions.create(...)` | WIRED | Line 65; returns `{url: session.url}` |
| `create-session/route.ts` | Sanity | `sanityClient.fetch(QUERY_CURRENT_CHARITY_SLUG)` | WIRED (best-effort) | Lines 45-52; try/catch fallback to `''` |
| `webhook/route.ts` | `lib/stripe/handlers.ts` | `handleStripeEvent(event)` | WIRED | Line 65 of webhook route |
| `handlers.ts` | `convex/stripeEvents.ts` | `convex.mutation(api.stripeEvents.claim, {...})` | WIRED | Line 34; re-throws on Convex failure |
| `handlers.ts` | `convex/stripeOrders.ts` | `convex.mutation(api.stripeOrders.insert, {...})` | WIRED (best-effort) | Lines 83-93; errors caught and swallowed per Pitfall 7 |
| `webhook/route.ts` | `lib/stripe/server.ts` | `getStripeServer()` | WIRED | Line 51; throws → 500 on missing secret |
| `shop/page.tsx` | `BuyButton.tsx` | `import {BuyButton}` + `<BuyButton />` | WIRED | Lines 6 + 94 |
| `issue/[slug]/page.tsx` | `issue/ShopCallout.tsx` | `import {ShopCallout}` + `<ShopCallout />` | WIRED | Lines 43 + 252 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `shop/page.tsx` | `charityName` | `sanityClient.fetch(QUERY_LATEST_CHARITY_NAME)` → Sanity CDN | Yes (GROQ query against live Sanity) | FLOWING |
| `create-session/route.ts` | `charitySlug` | `sanityClient.fetch(QUERY_CURRENT_CHARITY_SLUG)` → Sanity CDN | Yes (best-effort; falls back to `''`) | FLOWING |
| `webhook/route.ts` | `event` | `stripe.webhooks.constructEvent(rawBody, sig, secret)` | Yes (raw Stripe payload) | FLOWING |
| `handlers.ts` | `claim.firstTime` | `convex.mutation(api.stripeEvents.claim, ...)` | Yes (Convex atomic check-and-insert) | FLOWING |

All data variables flow from real sources. No hardcoded empty arrays or disconnected props found.

---

## Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `/shop/page.tsx` is a server component (no `'use client'`) | `grep "'use client'" apps/web/app/shop/page.tsx` | No match | PASS |
| Webhook route reads raw body before any parse | `grep "await req.text()" apps/web/app/api/stripe/webhook/route.ts` | Line 47 | PASS |
| constructEvent always called in webhook | `grep "constructEvent" apps/web/app/api/stripe/webhook/route.ts` | Line 58 | PASS |
| FORBIDDEN_BYPASS patterns absent from webhook | `stripe-webhook-source.test.ts` 5 FORBIDDEN_BYPASS patterns, all `.not.toMatch` pass | All 5 absent | PASS |
| `/legal/privacy` file exists and exports default function | `existsSync + export default function` pattern | Both true | PASS |
| `/legal/terms` file exists and exports default function | `existsSync + export default function` pattern | Both true | PASS |
| thank-you page has no DB imports | `thank-you-source.test.ts` 5/5 assertions | No Sanity/Convex/fetch/stripe | PASS |
| Build produces all 8 commerce routes | `pnpm --filter web build` exit 0 | `/shop`, `/shop/thank-you`, `/api/checkout/create-session`, `/api/stripe/webhook`, `/legal/privacy`, `/legal/terms` all present | PASS |
| Live Stripe purchase | DEFERRED (08-08) | Not run — sk_live_* in .env.local | DEFERRED |
| Forged-sig curl against deployed endpoint | DEFERRED (08-08) | Not run — needs live/test keys | DEFERRED |
| Stripe CLI replay dedup | DEFERRED (08-08) | Not run — needs Stripe CLI | DEFERRED |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CMR-01 | 08-06 | `/shop` server-rendered with charity callout | SATISFIED | `shop-page.test.ts` 6/6; shop/page.tsx confirmed server component + BuyButton + ISR |
| CMR-02 | 08-04 | Stripe Checkout via `checkout.sessions.create()` | SATISFIED (code+mock) / DEFERRED (live) | `checkout-create-session.test.ts` 6/6; route calls `mode:'payment'`, `line_items`, `success_url`, `cancel_url` |
| CMR-03 | 08-07 | `/shop/thank-you` static, no DB query | SATISFIED | `thank-you-source.test.ts` 5/5; page imports only `next/link`; no Sanity/Convex/fetch |
| CMR-04 | 08-05 | Webhook verifies signature via raw body | SATISFIED (code+mock) / DEFERRED (live) | `stripe-webhook.test.ts` 4/4; `await req.text()` before parse; `constructEvent(rawBody, sig, secret)` |
| CMR-05 | 08-05 | No dev-mode bypass for signature verification | SATISFIED + PERMANENT GUARD | `stripe-webhook-source.test.ts` 6/6; FORBIDDEN_BYPASS regex list matches RESEARCH §Pattern 7 verbatim; scan is a permanent Vitest tripwire |
| CMR-06 | 08-05 | Webhook idempotent on `event.id` | SATISFIED (code+mock) / DEFERRED (live Stripe CLI replay) | `stripe-webhook-idempotency.test.ts` 3/3; `stripeEvents.claim` atomic check-and-insert; early return on `firstTime=false`; `stripeOrders.insert` skipped on replay |
| CMR-07 | 08-07 | `/legal/privacy` page exists (no 404) | SATISFIED | `legal-pages.test.ts` 2/2; file exists; build output shows Static route |
| CMR-08 | 08-07 | `/legal/terms` page exists (no 404) | SATISFIED | `legal-pages.test.ts` 2/2; file exists; build output shows Static route |
| CMR-09 | 08-01 (Phase 2 inheritance) | Persistent shop callout on every issue page | SATISFIED | `issue-page-shop-callout.test.ts` 5/5; `ShopCallout` imported + rendered in `issue/[slug]/page.tsx`; no banner/modal/popup/countdown in code |
| CMR-10 | 08-04 | Shipping address collection enabled at checkout | SATISFIED (code+mock) / DEFERRED (Dashboard config) | `checkout-create-session.test.ts` test 3 (`shipping_address_collection.allowed_countries` non-empty); `allowed_countries: ['US']` in route; Stripe Dashboard rate configuration is 08-02 |

### CMR Satisfaction Tiers

**Fully automated + code-complete (no live Stripe required):** CMR-01, CMR-03, CMR-05, CMR-07, CMR-08, CMR-09

**Code-complete + mocked unit tests pass; live confirmation deferred to 08-08:** CMR-02, CMR-04, CMR-06, CMR-10

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact | Classification |
|------|---------|----------|--------|----------------|
| `apps/web/app/legal/privacy/page.tsx` | `TODO(Andrew)` in JSDoc; "Last updated: placeholder pending Andrew's review." in rendered HTML | Info | Intentional tracked pending — legal copy requires Andrew's review before public launch. Tracked in `.planning/STATE.md`. | TRACKED PENDING, NOT A DEFECT |
| `apps/web/app/legal/terms/page.tsx` | `TODO(Andrew)` in JSDoc; "Last updated: placeholder pending Andrew's review." in rendered HTML | Info | Same as above. | TRACKED PENDING, NOT A DEFECT |

No `return null`, `return {}`, `return []`, or `=> {}` stub patterns found in any Phase 8 production code. No hardcoded empty arrays or objects flowing to user-visible render paths. No `SKIP_SIGNATURE`, `BYPASS_SIGNATURE`, `STRIPE_SKIP_VERIFY`, `SKIP_STRIPE_VERIFY`, or `NODE_ENV !== 'production'` guard around `constructEvent`.

---

## Human Verification Required

### 1. Stripe Dashboard Key Swap (08-02 prerequisite)

**Test:** Open `apps/web/.env.local` and replace `STRIPE_SECRET_KEY=sk_live_...` and `STRIPE_WEBHOOK_SECRET=whsec_...` with values from a Stripe test-mode API key and a test-mode webhook endpoint signing secret.
**Expected:** `.env.local` has `sk_test_...` and `whsec_...` from test-mode.
**Why human:** `apps/web/.env.local` currently holds production (`sk_live_*`) keys. The autonomous build deliberately made no live Stripe calls. This swap is the gate before items 2-4 below.

### 2. Real Test-Mode Purchase (08-08 UAT item 1)

**Test:** Start `pnpm --filter web dev`; navigate to `/shop`; click "Buy the lip balm"; complete Stripe Checkout with test card `4242 4242 4242 4242`; observe redirect.
**Expected:** Stripe Checkout page loads, accepts the test card, redirects to `/shop/thank-you` with message "Your lip balm is on the way." The `thank-you` page shows no loading state and makes no DB calls.
**Why human:** Unit tests mock Stripe. Actual Checkout redirect requires a running Next.js server + valid `sk_test_*` key + Stripe-reachable environment.

### 3. Forged-Signature Rejection at Deployed Endpoint (08-08 UAT item 2)

**Test:** `curl -s -X POST <deployed-or-localhost>/api/stripe/webhook -H "Content-Type: application/json" -H "stripe-signature: t=0,v1=forged_garbage" -d '{"id":"evt_test","type":"checkout.session.completed"}' | jq .`
**Expected:** HTTP 400 with `{"error":"Invalid signature"}`.
**Why human:** Verifies the live deployed handler (not a mocked unit test). Requires a running server at a reachable URL.

### 4. Stripe CLI Replay / Idempotency (08-08 UAT item 3)

**Test:** Run `stripe listen --forward-to localhost:3000/api/stripe/webhook`; then `stripe trigger checkout.session.completed` twice. Observe server logs.
**Expected:** First delivery: logs include no "replay ignored" message; Convex `stripeEvents` row inserted; `stripeOrders` row inserted. Second delivery: logs contain "replay ignored: evt_... (checkout.session.completed)"; no second `stripeOrders` row inserted.
**Why human:** Requires Stripe CLI, running Next.js server with test-mode keys, and access to Convex dashboard to verify row counts.

### 5. Legal Page Visual Spot-Check

**Test:** Visit `/legal/privacy` and `/legal/terms` in a browser.
**Expected:** Pages load (no 404), show placeholder text with "Last updated: placeholder pending Andrew's review.", and contact email `hello@eisenbalm.com` is visible. Andrew must replace placeholder copy before public launch.
**Why human:** Route existence is verified by Vitest file-scan. Content quality and final copy are Andrew's editorial decision.

---

## Deferred Plans (NOT Phase 8 defects)

| Plan | Status | Owner | Gate |
|------|--------|-------|------|
| **08-02: Stripe Dashboard Checkpoint** | Deferred — autonomous: false | Andrew | Must happen before any live smoke; requires creating Stripe Product/Price/Shipping Rate/Webhook Endpoint in Dashboard and populating `.env.local` with `sk_test_*` keys |
| **08-08: README + Manual UAT** | Deferred — autonomous: false | Andrew (with Claude) | Blocked by 08-02. Requires running server + Stripe CLI. Will produce `apps/web/README.md` Phase 8 section + SUMMARY recording smoke outcomes. |

Per user decision 2026-05-27: the autonomous code build is complete and verified against mocked Stripe; the above two plans are explicitly deferred. Phase 8 will not be marked fully `passed` until Andrew completes 08-02 + 08-08.

---

## Test Suite State

| Test file | CMR | Tests | Status |
|-----------|-----|-------|--------|
| `stripe-webhook-source.test.ts` | CMR-05 | 6/6 | green |
| `stripe-webhook.test.ts` | CMR-04 | 4/4 | green |
| `stripe-webhook-idempotency.test.ts` | CMR-06 | 3/3 | green |
| `checkout-create-session.test.ts` | CMR-02, CMR-10 | 6/6 | green |
| `shop-page.test.ts` | CMR-01 | 6/6 | green |
| `thank-you-source.test.ts` | CMR-03 | 5/5 | green |
| `legal-pages.test.ts` | CMR-07, CMR-08 | 4/4 | green |
| `issue-page-shop-callout.test.ts` | CMR-09 | 5/5 | green |
| **Phase 8 subtotal** | CMR-01..10 | **39/39** | **all green** |
| Full suite (all phases) | — | **215/215** | **all green** |

`pnpm --filter web build` exit code: **0**. All 8 commerce routes present in build output.

---

_Verified: 2026-05-28T10:15:00Z_
_Verifier: Claude (gsd-verifier)_
