---
phase: 55-public-site-redesign
plan: 06
subsystem: web
tags: [dispatch, masthead, hero, nav, a11y]
requires: [55-01, 55-02, 55-03]
provides: [DispatchMasthead, Ticker, Hero, HowStrip, IssueNav]
affects: [55-11 composition]
key-files:
  created:
    - apps/web/components/dispatch/DispatchMasthead.tsx
    - apps/web/components/dispatch/Ticker.tsx
    - apps/web/components/dispatch/Hero.tsx
    - apps/web/components/dispatch/HowStrip.tsx
    - apps/web/components/dispatch/IssueNav.tsx
    - apps/web/components/dispatch/top.css
    - apps/web/__tests__/dispatch-top.test.tsx
metrics:
  completed: 2026-10-17
---

# Phase 55 Plan 06: Masthead, Hero, Nav Summary

Five prop-driven top-of-page Dispatch components (masthead, aria-hidden CSS ticker, accent hero with single h1 and geometric fallback art, How strip, sticky scroll-spy in-issue nav) with reduced-motion handling and a jsdom test file. Not yet mounted on any route (Plan 11).

## Commits
- 63bf7150: DispatchMasthead, Ticker, HowStrip, top.css, tests
- f16bb522: Hero, IssueNav

## Deviations from Plan
None. Both tasks were committed separately; top.css and the test file were written in one pass and landed in the first commit.

## Verification
Full web suite 579 passed (58 files); `pnpm --filter web typecheck` clean.

## Self-Check: PASSED
