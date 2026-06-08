---
phase: quick-260608-iu7
plan: 01
subsystem: web/shop
tags: [jesse-voice, thank-you, sanity, cmr-03, tripwire]
dependency_graph:
  requires: []
  provides: [shop/thank-you Jesse-voice copy with live charity name]
  affects: [apps/web/app/shop/thank-you/page.tsx, apps/web/__tests__/thank-you-source.test.ts]
tech_stack:
  added: []
  patterns: [async server component, sanityClient.fetch try/catch → null, ISR revalidate 60]
key_files:
  created: []
  modified:
    - apps/web/app/shop/thank-you/page.tsx
    - apps/web/__tests__/thank-you-source.test.ts
decisions:
  - D-01: session_id reference removed from docblock entirely so CMR-03 source-scan passes cleanly
  - D-02: ISR revalidate = 60 mirrored from shop/page.tsx so charity name refreshes within 60s of new issue publish
metrics:
  duration: ~5 min
  completed: "2026-06-08T20:38:59Z"
  tasks: 2
  files: 2
---

# Phase quick-260608-iu7 Plan 01: Rewrite shop/thank-you in Jesse voice + live charity name

One-liner: Async server component fetches latest published charity via Sanity GROQ and renders Jesse-voice locked copy; CMR-03 tripwire refined to permit the Sanity read while forbidding Convex, Stripe, and URL-param lookups.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite thank-you page as async server component | 0727259 | apps/web/app/shop/thank-you/page.tsx |
| 2 | Refine CMR-03 tripwire to the new contract | c0e7052 | apps/web/__tests__/thank-you-source.test.ts |

## What Was Built

### Task 1 — thank-you page rewrite

`apps/web/app/shop/thank-you/page.tsx` is now an async server component that:

- Imports `groq` from `next-sanity` and `sanityClient` from `@/lib/sanity/client`, mirroring `shop/page.tsx` exactly.
- Defines `QUERY_LATEST_CHARITY_NAME` inline (same GROQ projection as the shop page).
- Fetches the charity name with the `try/catch → null` fallback pattern from `shop/page.tsx`.
- Sets `export const revalidate = 60` for ISR parity with the shop page.
- Removes the `PageProps` interface and `searchParams` param entirely — the cleanest guarantee against any downstream session_id use.
- Renders the locked Jesse-voice copy:
  - Eyebrow: `Order received`
  - h1: `Your lip balm is on its way.`
  - Body: `This week, every dollar of proceeds goes to {charityName ?? "this week's featured charity"} — not the margin, the proceeds, in full. A small purchase pointed at a serious end. Thank you for pointing it there.`
  - Muted receipt line: `A receipt will follow by email.`
  - Return link: `Return to the latest issue.`
- Preserves all existing `className` strings and CSS-var structure verbatim.

### Task 2 — CMR-03 tripwire refinement

`apps/web/__tests__/thank-you-source.test.ts` now encodes the refined contract:

- **Removed:** the Sanity-ban test (a server-side Sanity read of the charity name is now permitted).
- **Kept:** Convex-ban test (verbatim).
- **Kept:** Stripe-ban test (verbatim).
- **Replaced:** bare-`fetch(` ban with a negative-lookbehind regex (`/(?<![.\w])fetch\s*\(/`) that bans global `fetch()` while allowing `sanityClient.fetch()`.
- **Added:** `session_id` ban — asserts the source does not contain the substring at all; session_id lookups invite enumeration attacks and the param is now dropped at the component signature level.
- Updated header docblock to document the refined contract.

## Verification

All four target suites green (18/18 tests):

```
✓ __tests__/thank-you-source.test.ts       (5 tests)
✓ __tests__/stripe-webhook-source.test.ts  (6 tests)
✓ __tests__/stripe-webhook.test.ts         (4 tests)
✓ __tests__/stripe-webhook-idempotency.test.ts (3 tests)
```

`pnpm --filter web typecheck` — TS2532 errors in `checkout-create-session.test.ts` and `stripe-webhook-idempotency.test.ts` are pre-existing and out of scope per the scope-boundary rule. No new type errors introduced by the thank-you page changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed `session_id` from docblock comment**
- **Found during:** Task 2 verification — the CMR-03 source-scan `session_id` test failed because the page's own docblock contained `use session_id for any lookup (the param is silently ignored)`.
- **Fix:** Replaced the specific mention with the generic `look up anything via URL parameters (no enumeration risk)` — preserves the security intent without triggering the scan.
- **Files modified:** apps/web/app/shop/thank-you/page.tsx
- **Commit:** 0727259 (fixed inline before commit)

## Known Stubs

None. The charity name is live-fetched from Sanity with a null-safe fallback; no placeholder data flows to the rendered output.

## Self-Check: PASSED

- `apps/web/app/shop/thank-you/page.tsx` — file present and contains `QUERY_LATEST_CHARITY_NAME`, `sanityClient.fetch`, no `session_id`.
- `apps/web/__tests__/thank-you-source.test.ts` — file present, 5 tests all green.
- Commits `0727259` and `c0e7052` confirmed in git log.
