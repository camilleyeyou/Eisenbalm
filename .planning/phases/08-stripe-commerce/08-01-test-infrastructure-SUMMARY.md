---
phase: 08-stripe-commerce
plan: 01
subsystem: testing
tags: [vitest, source-scan, stripe, webhooks, idempotency, nyquist, wave-0]

# Dependency graph
requires:
  - phase: 07-game-rendering
    provides: Vitest 3.x test infrastructure (apps/web/vitest.config.ts, pnpm --filter web test:unit), game-sandbox.test.ts source-scan tripwire pattern
  - phase: 02-web-shell-theme-engine
    provides: apps/web/components/issue/ShopCallout.tsx (CMR-09 already satisfied), apps/web/app/issue/[slug]/page.tsx (renders ShopCallout)
provides:
  - 8 Vitest test files in apps/web/__tests__/ covering CMR-01 through CMR-10
  - CMR-05 source-scan tripwire (stripe-webhook-source.test.ts) with FORBIDDEN_BYPASS regex list mirroring RESEARCH §Pattern 7
  - CMR-04 signature-verification unit tests using stripe.webhooks.generateTestHeaderString for synthetic valid/invalid pairs
  - CMR-06 idempotency unit tests with reference-routed ConvexHttpClient mock so first-time vs replay paths are independently observable
  - CMR-02 + CMR-10 session-create assertions on mode/line_items/shipping_address_collection/success_url/cancel_url
  - CMR-03 source-scan rejecting Sanity, Convex, fetch(), and stripe.checkout.sessions.retrieve in /shop/thank-you
  - CMR-07 + CMR-08 file-existence + default-export shape contract for legal pages
  - CMR-09 source-scan verifying ShopCallout import + render in issue page, with comment-stripping pre-pass for brand-voice pattern check
affects: [08-04-stripe-client-and-checkout-api, 08-05-webhook-handler-and-idempotency, 08-06-shop-page-rewrite, 08-07-thank-you-and-legal-pages]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 Nyquist sentinel: tests land BEFORE production code; subsequent plans drive them green"
    - "Source-scan tripwire with FORBIDDEN_BYPASS regex list (mirrors Phase 7 game-sandbox.test.ts)"
    - "Dynamic await import() inside it() bodies + vi.doMock so unit tests load when production source is absent"
    - "Comment-stripping pre-pass on source-scans where documentation prose would trip behavior-only regex (CMR-09)"

key-files:
  created:
    - apps/web/__tests__/stripe-webhook-source.test.ts
    - apps/web/__tests__/thank-you-source.test.ts
    - apps/web/__tests__/issue-page-shop-callout.test.ts
    - apps/web/__tests__/legal-pages.test.ts
    - apps/web/__tests__/shop-page.test.ts
    - apps/web/__tests__/stripe-webhook.test.ts
    - apps/web/__tests__/checkout-create-session.test.ts
    - apps/web/__tests__/stripe-webhook-idempotency.test.ts
  modified: []

key-decisions:
  - "CMR-09 banner/modal/popup/countdown scan strips block + line comments before matching — Phase 2 ShopCallout's anti-pattern docstring uses the word 'banner' as guidance, which would falsely trip a raw-source regex. The intent is to forbid behavior, not documentation prose."
  - "Stripe SDK is intentionally NOT imported at the top of unit test files — all stripe usage is wrapped in `await import('stripe')` inside it() bodies so the files load even before Plan 08-03 installs the package."
  - "Convex mocks distinguish 'claim' vs 'insert' references inside the mutation function (not just vi.fn) so the idempotency test can observe whether downstream fulfillment was attempted."

patterns-established:
  - "FORBIDDEN_BYPASS regex list as an array literal in the test body so future engineers can grep `FORBIDDEN_BYPASS` to find the canonical bypass-prevention contract"
  - "Wave 0 test files use existsSync as the first assertion so missing-target-file failures are obvious in test output (vs cryptic ENOENT later)"
  - "Test files reference their CMR-NN target in the describe() string AND a top-of-file docblock for grep discoverability"

requirements-completed: []  # Wave 0 plan: tests are created but the CMR-* requirements themselves are not satisfied until later plans drive the tests green. Mark complete only when the production code lands.

# Metrics
duration: ~25min
completed: 2026-05-19
---

# Phase 8 Plan 1: Test Infrastructure Summary

**Eight Vitest test files in apps/web/__tests__/ establish the Wave 0 sentinel for Phase 8 — CMR-05 source-scan tripwire with FORBIDDEN_BYPASS regex list, signature/idempotency unit tests via vi.doMock + dynamic await import(), and source-scan contracts for /shop, /shop/thank-you, /legal/*, and the issue-page ShopCallout.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-19T09:58:00Z (approx)
- **Completed:** 2026-05-19T10:04:00Z
- **Tasks:** 2
- **Files created:** 8

## Accomplishments

- **CMR-05 tripwire landed:** `stripe-webhook-source.test.ts` mirrors Phase 7's `game-sandbox.test.ts` shape verbatim — readFileSync + path.resolve + FORBIDDEN_BYPASS regex array. Five FORBIDDEN_BYPASS patterns match RESEARCH §Pattern 7: SKIP_SIGNATURE, SKIP_STRIPE_VERIFY, BYPASS_SIGNATURE, STRIPE_SKIP_VERIFY, and the NODE_ENV !== 'production' early-return composite.
- **CMR-04 signature unit tests built around `stripe.webhooks.generateTestHeaderString`:** synthesizes valid Stripe-Signature header pairs for the dummy secret; rejects forged/missing/no-secret cases.
- **CMR-06 idempotency observable via reference-routed mock:** `ConvexHttpClient.mutation` dispatches on the literal string 'claim' vs 'insert', so the test can independently assert `claimMutation.toHaveBeenCalledOnce()` AND `ordersInsert.not.toHaveBeenCalled()` on the replay path.
- **CMR-09 passes immediately (Phase 2 inheritance):** issue-page-shop-callout.test.ts confirms 5/5 assertions on the existing codebase — the Phase 2 ShopCallout already satisfies the contract.
- **CMR-02 + CMR-10 unified in a single test file** (`checkout-create-session.test.ts`) — six cases assert mode='payment', line_items[0] == {price, quantity:1}, shipping_address_collection.allowed_countries non-empty, success_url contains /shop/thank-you?session_id={CHECKOUT_SESSION_ID}, cancel_url ends with /shop, and 500 response when STRIPE_PRICE_ID is unset.

## Task Commits

Each task was committed atomically:

1. **Task 1: Source-scan + render test stubs (CMR-01/03/05/07/08/09)** — `18e4cee` (test)
2. **Task 2: Stripe SDK + Convex idempotency unit test stubs (CMR-02/04/06/10)** — `e71619f` (test)

## Files Created

- `apps/web/__tests__/stripe-webhook-source.test.ts` — CMR-05 source-scan tripwire with FORBIDDEN_BYPASS regex list (6 assertions; 5 currently fail because target route file doesn't exist)
- `apps/web/__tests__/thank-you-source.test.ts` — CMR-03 source-scan rejecting Sanity/Convex/fetch/stripe.checkout imports + calls (5 assertions; all fail because target page doesn't exist)
- `apps/web/__tests__/issue-page-shop-callout.test.ts` — CMR-09 source-scan asserting ShopCallout import + render in issue page (5 assertions; **all pass — Phase 2 inheritance**)
- `apps/web/__tests__/legal-pages.test.ts` — CMR-07 + CMR-08 existence + default-export shape contract (4 assertions; all fail because target pages don't exist)
- `apps/web/__tests__/shop-page.test.ts` — CMR-01 server-component shape contract (6 assertions; 5 pass because Phase 2 placeholder shop/page.tsx already conforms; the BuyButton render assertion fails)
- `apps/web/__tests__/stripe-webhook.test.ts` — CMR-04 signature-verification unit tests using `stripe.webhooks.generateTestHeaderString` (4 cases; all fail because route file and `stripe` SDK aren't installed yet)
- `apps/web/__tests__/checkout-create-session.test.ts` — CMR-02 + CMR-10 session-create assertions (6 cases; all fail because route file doesn't exist)
- `apps/web/__tests__/stripe-webhook-idempotency.test.ts` — CMR-06 idempotency unit tests with reference-routed Convex mock (3 cases; all fail because route file doesn't exist)

## Decisions Made

- **CMR-09 banner-pattern test strips comments before scanning.** Phase 2's `ShopCallout.tsx` includes the docstring line `*   - Never a banner (UI-SPEC §"The shop callout is a footnote, not a CTA")` — guidance documentation that uses the literal word "banner" to explain what NOT to do. A raw-source regex falsely trips on that prose. The fix strips block comments (`/* ... */`) and line comments (`// ...`, with a guard against URL `://` scheme) before applying the regex; the intent is to forbid banner/modal/popup/countdown **behavior**, not documentation of the anti-pattern. Without this pre-pass, the plan's stated "CMR-09 test passes immediately" wouldn't hold.
- **Production code is loaded via dynamic `await import()` inside `it()` bodies, not top-level imports.** This is the load-vs-collection split: the test file must compile and load (so Vitest can register the describe/it tree) even when the production code and the `stripe` npm package don't exist yet. Top-level `import Stripe from 'stripe'` would break collection; dynamic import defers the failure to runtime where it shows as a per-test failure rather than a global "0 tests collected" error.
- **vi.doMock placed inside `beforeEach()`/setup blocks plus `vi.resetModules()`** so each test runs against a freshly-resolved module graph with the current mock configuration. Otherwise Vitest caches the first-resolved module and later tests would see stale mocks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CMR-09 ShopCallout brand-voice scan tripped on Phase 2 docstring**

- **Found during:** Task 1 (verification of CMR-09 test against existing Phase 2 ShopCallout)
- **Issue:** Plan-specified test reads the raw ShopCallout source and asserts `expect(source).not.toMatch(/banner/i)`. Phase 2's ShopCallout.tsx contains the documentation line `*   - Never a banner (UI-SPEC §"The shop callout is a footnote, not a CTA")` — explicit anti-pattern guidance prose that uses the literal word "banner". The raw-source regex falsely fails on this comment, contradicting the plan's stated "CMR-09 test passes immediately" acceptance criterion.
- **Fix:** Strip block comments (`/\*[\s\S]*?\*\/`) and line comments (`(^|[^:])//.*$` — the negative lookbehind for `:` preserves URL `://` schemes) before applying the regex. The intent of CMR-09's brand-voice clause is to forbid banner/modal/popup/countdown **behavior** (JSX, className tokens, JS identifiers), not documentation that describes the anti-pattern. Comments are explanatory contract, not behavior.
- **Files modified:** apps/web/__tests__/issue-page-shop-callout.test.ts
- **Verification:** `npx vitest run __tests__/issue-page-shop-callout.test.ts` now passes 5/5.
- **Committed in:** `18e4cee` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — plan-vs-codebase regex mismatch)
**Impact on plan:** Necessary correctness fix. The plan's stated acceptance criterion ("CMR-09 test passes immediately because the Phase 2 issue page already imports + renders ShopCallout") would not have held without this adjustment. No scope creep — same five behavior-level assertions, just applied to the code portion of the source.

## Issues Encountered

None beyond the deviation documented above. Both tasks executed in a single pass; verification commands matched the plan's acceptance criteria.

## Wave 0 Sentinel State (Confirmed)

Full suite run (`pnpm --filter web test:unit`):

- **10 test files** (2 Phase 7 + 8 Phase 8)
- **66 tests total** — 37 passed, 29 failed
- **Phase 7 tests** still 100% green (no regression):
  - `game-sandbox.test.ts` — 3/3 pass
  - `game-validator.test.ts` — all pass
- **Phase 8 immediate pass** (Phase 2 inheritance):
  - `issue-page-shop-callout.test.ts` — 5/5 pass
- **Phase 8 partial pass** (Phase 2 placeholder satisfies most assertions):
  - `shop-page.test.ts` — 5/6 pass (only the `<BuyButton` render assertion fails; Plan 08-06 rewrites the page to add it)
- **Phase 8 expected failures** (Wave 0 sentinel — target source doesn't exist yet):
  - `stripe-webhook-source.test.ts` — 5/6 fail (file existence + content scans against non-existent route.ts)
  - `thank-you-source.test.ts` — 5/5 fail (file doesn't exist)
  - `legal-pages.test.ts` — 4/4 fail (files don't exist)
  - `stripe-webhook.test.ts` — 4/4 fail (dynamic import of route handler + stripe SDK fails)
  - `checkout-create-session.test.ts` — 6/6 fail (dynamic import of route handler fails)
  - `stripe-webhook-idempotency.test.ts` — 3/3 fail (dynamic import of route handler + stripe SDK fails)

These failures are the Wave 0 sentinel by design. Plans 08-03 (Stripe SDK install + schema patch), 08-04 (Stripe client + checkout API), 08-05 (webhook handler + idempotency), 08-06 (shop page rewrite), and 08-07 (thank-you + legal pages) drive each failure green one-by-one.

## FORBIDDEN_BYPASS List Provenance

Confirmation that `apps/web/__tests__/stripe-webhook-source.test.ts`'s `FORBIDDEN_BYPASS` array matches RESEARCH §Pattern 7 verbatim:

```
RESEARCH §Pattern 7 (Code Examples → Source-Scan Forbidden-Patterns List):
  /SKIP_SIGNATURE/i,
  /SKIP_STRIPE_VERIFY/i,
  /BYPASS_SIGNATURE/i,
  /STRIPE_SKIP_VERIFY/i,
  /NODE_ENV\s*!==?\s*['"]production['"]\s*\)[^]{0,150}(?:return|skip)/m,

apps/web/__tests__/stripe-webhook-source.test.ts (lines 53-59):
  /SKIP_SIGNATURE/i,
  /SKIP_STRIPE_VERIFY/i,
  /BYPASS_SIGNATURE/i,
  /STRIPE_SKIP_VERIFY/i,
  /NODE_ENV\s*!==?\s*['"]production['"]\s*\)[^]{0,150}(?:return|skip)/m,
```

Identical. The five patterns cover the four named env-var bypasses (SKIP_SIGNATURE, SKIP_STRIPE_VERIFY, BYPASS_SIGNATURE, STRIPE_SKIP_VERIFY) plus the structural anti-pattern of an early-return inside an `if (NODE_ENV !== 'production')` block within 150 chars of the constructEvent call site.

## User Setup Required

None - this is a test-infrastructure plan; no external service configuration required.

## Next Phase Readiness

- All 8 Wave 0 test files in place with Vitest collection succeeding (no syntax/import errors)
- Phase 7 test suite remains green (no regression)
- Plan 08-02 (Stripe dashboard checkpoint — Andrew checkpoint) is unblocked and can proceed
- Plan 08-03 (schema + deps) will install the `stripe` npm package and patch `convex/schema.ts` with `stripeEvents` + `stripeOrders` tables; this unblocks the dynamic `await import('stripe')` calls in the unit tests
- Plans 08-04 through 08-07 will land production code that drives the 7 currently-failing test files green

## Self-Check: PASSED

- All 8 test files exist at the expected paths under apps/web/__tests__/ ✓
- Task 1 commit `18e4cee` present in git log ✓
- Task 2 commit `e71619f` present in git log ✓
- FORBIDDEN_BYPASS literal present in stripe-webhook-source.test.ts ✓
- constructEvent literal present in stripe-webhook-source.test.ts ✓
- @sanity/client literal present in thank-you-source.test.ts (as a .not.toMatch arg) ✓
- ShopCallout literal present in issue-page-shop-callout.test.ts ✓
- generateTestHeaderString literal present in stripe-webhook.test.ts ✓
- shipping_address_collection literal present in checkout-create-session.test.ts ✓
- firstTime literal present in stripe-webhook-idempotency.test.ts ✓
- vi.doMock literal present in stripe-webhook-idempotency.test.ts ✓
- CMR-09 test (issue-page-shop-callout) passes 5/5 — Phase 2 inheritance confirmed ✓
- Other 6 Phase 8 test files fail at runtime as expected (Wave 0 sentinel) ✓
- Phase 7 tests still 100% green (no regression) ✓

---
*Phase: 08-stripe-commerce*
*Completed: 2026-05-19*
