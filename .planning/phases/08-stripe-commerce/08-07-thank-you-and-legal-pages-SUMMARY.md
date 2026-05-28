---
phase: "08-stripe-commerce"
plan: "07"
subsystem: "web-frontend"
tags: ["stripe", "static-pages", "legal", "cmr-03", "cmr-07", "cmr-08", "cmr-09"]
dependency_graph:
  requires: ["08-01"]
  provides: ["CMR-03", "CMR-07", "CMR-08"]
  affects: ["apps/web/app/shop/thank-you/page.tsx", "apps/web/app/legal/privacy/page.tsx", "apps/web/app/legal/terms/page.tsx"]
tech_stack:
  added: []
  patterns: ["static-server-component", "metadata-noindex", "placeholder-copy-with-todo"]
key_files:
  created:
    - apps/web/app/shop/thank-you/page.tsx
    - apps/web/app/legal/privacy/page.tsx
    - apps/web/app/legal/terms/page.tsx
  modified:
    - .planning/STATE.md
decisions:
  - "Thank-you page comment block must NOT contain literal forbidden regex strings (sanityClient.fetch, ConvexHttpClient, etc.) — Vitest readFileSync scans the entire file including comments; described forbidden patterns by reference to the test file instead"
  - "Used existing text-[color:var(--color-*)] form for Tailwind classes to match Phase 2 /about/page.tsx convention — Tailwind canonical-class warnings are advisory only"
  - "hello@eisenbalm.com used as placeholder contact in both legal pages — TODO(Andrew) in JSDoc if this differs from actual contact"
metrics:
  duration: "~3 min"
  completed: "2026-05-28T16:42:07Z"
  tasks: 3
  files: 4
---

# Phase 8 Plan 07: Thank-You and Legal Pages Summary

Three static pages shipped to satisfy CMR-03 (thank-you with no DB query), CMR-07 (privacy placeholder), CMR-08 (terms placeholder), and CMR-09 re-confirmed (ShopCallout source-scan still green).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create /shop/thank-you page (CMR-03) | 84f8717 | apps/web/app/shop/thank-you/page.tsx |
| 2 | Create /legal/privacy + /legal/terms pages (CMR-07, CMR-08) | 0f3dfe5 | apps/web/app/legal/privacy/page.tsx, apps/web/app/legal/terms/page.tsx |
| 3 | Add legal-copy blocker to STATE.md | b6391df | .planning/STATE.md |

## What Was Built

### /shop/thank-you (CMR-03)

Purely static post-purchase confirmation page. Stripe redirects here after successful checkout (success_url includes `?session_id={CHECKOUT_SESSION_ID}`). The page:

- Resolves the Next.js 15 `searchParams` Promise but discards the value — the session_id is never used for any lookup
- Has `metadata.robots = { index: false, follow: false }` — post-purchase page, not public marketing
- Contains no Sanity, Convex, Stripe SDK, or arbitrary `fetch()` calls — the source-scan tripwire (`__tests__/thank-you-source.test.ts`) enforces this
- Jesse voice: "Your lip balm is on the way." Period. No exclamation marks.
- Links back to `/` (latest issue)

### /legal/privacy (CMR-07)

Placeholder privacy page. Mentions: Stripe payment processing, no marketing lists, no data selling, contact email. TODO(Andrew) in JSDoc for reviewed copy.

### /legal/terms (CMR-08)

Placeholder terms page. Mentions: single-product model, 100% donation model, Stripe payment processing, 30-day refund request window, editorial disclaimer. TODO(Andrew) in JSDoc for reviewed copy.

Both legal pages are pure Server Components (no `'use client'`), use `--color-*` tokens and `font-display`/`font-body` CSS custom property classes, and match the Phase 2 `/about/page.tsx` typography conventions.

## Test Results

| Test file | Tests | Status |
|-----------|-------|--------|
| `__tests__/thank-you-source.test.ts` | 5 | green |
| `__tests__/legal-pages.test.ts` | 4 | green |
| `__tests__/issue-page-shop-callout.test.ts` | 5 | green (CMR-09 re-confirmed) |

All 14 tests pass. `pnpm --filter web build` exits 0; all three routes appear in build output:
- `/legal/privacy` — Static (○)
- `/legal/terms` — Static (○)
- `/shop/thank-you` — Dynamic (ƒ, due to searchParams)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed literal forbidden strings from JSDoc comment block**

- **Found during:** Task 1 verification (first test run)
- **Issue:** The plan's suggested JSDoc listed the forbidden regex patterns verbatim (e.g., `sanityClient.fetch`, `ConvexHttpClient`, `fetch(`, `sessions.retrieve`). Vitest's `readFileSync` scans the entire file source including comments, so these literals tripped the CMR-03 source-scan assertions.
- **Fix:** Rewrote the comment to describe forbidden patterns by reference to the test file, not by embedding the literal strings. Same pattern documented in Phase 8 CLAUDE.md decision: "CMR-05 source-scan tripwire: JSDoc forbidden-pattern strings must be described without embedding the literal strings."
- **Files modified:** `apps/web/app/shop/thank-you/page.tsx`
- **Commit:** 84f8717

## Known Stubs

### Legal page placeholder copy

Both `/legal/privacy` and `/legal/terms` contain placeholder prose with `TODO(Andrew)` markers in JSDoc and "Last updated: placeholder pending Andrew's review." visible to readers. This is intentional — the pages satisfy "no 404" (CMR-07 + CMR-08) for code-completeness; the actual reviewed text is Andrew's responsibility before public launch. Tracked in STATE.md Blockers/Concerns.

**Placeholder contact email:** Both pages reference `hello@eisenbalm.com`. If Andrew's actual contact email differs, this needs updating when he replaces the placeholder copy.

**STATE.md edit:** Blocker entry appended at line 341. The existing Phase 2 `/about` blocker (line 338) and Phase 6 Stripe Dashboard blocker (line 337) were not modified.

## Self-Check: PASSED

- `apps/web/app/shop/thank-you/page.tsx` exists: FOUND
- `apps/web/app/legal/privacy/page.tsx` exists: FOUND
- `apps/web/app/legal/terms/page.tsx` exists: FOUND
- Commit 84f8717 exists: FOUND
- Commit 0f3dfe5 exists: FOUND
- Commit b6391df exists: FOUND
