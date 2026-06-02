---
phase: 17-ui-ux-audit-follow-ups
plan: "02"
subsystem: ui
tags: [next/image, nextjs, react, performance, cls, tailwind]

# Dependency graph
requires:
  - phase: 17-01
    provides: "bonus-section-image.test.ts RED test scaffold (6 assertions) for P17-01"

provides:
  - "BonusSection.tsx storyboard grid renders via <Image fill> (next/image) instead of raw <img>"
  - "bonus-section-image.test.ts GREEN (7/7 assertions)"
  - "No raw <img> or @next/next/no-img-element eslint-disable in BonusSection.tsx"
  - "Storyboard wrapper div has `relative` positioning for fill containment"
  - "sizes= hint for responsive image optimization"

affects: [issue-page, bonus-section, cls-performance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "next/image fill inside relative aspect-video container pattern for CLS-safe image grids"

key-files:
  created: []
  modified:
    - apps/web/components/issue/BonusSection.tsx

key-decisions:
  - "Use next/image fill (not explicit width/height) so the existing aspect-video container fully controls dimensions — no width/height props needed"
  - "sizes hint '(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 430px' matches the 2-col sm:grid-cols-2 breakpoint and the 860px max-width editorial container"
  - "Add `relative` to wrapper className — fill requires a positioned ancestor or the absolute child escapes the aspect-ratio box"

patterns-established:
  - "Pattern: relative aspect-video wrapper + <Image fill sizes=...> for any CLS-sensitive image grid in the editorial layout"

requirements-completed: [P17-01, P17-02, P17-07]

# Metrics
duration: 2min
completed: "2026-06-02"
---

# Phase 17 Plan 02: Bonus Section next/image Summary

**BonusSection storyboard grid converted from raw `<img>` (CLS risk, eslint-disabled) to `<Image fill>` (next/image) with `relative` wrapper and `sizes=` hint — bonus-section-image.test.ts fully GREEN.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-06-02T03:24:56Z
- **Completed:** 2026-06-02T03:25:56Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Converted BigBudgetBonus storyboard image grid from `<img loading="lazy">` + eslint-disable to `<Image fill sizes="...">` (next/image)
- Added `relative` to the storyboard wrapper div — required for `fill` to stay inside the `aspect-video` bounding box
- Removed `/* next/image conversion is backlog 999.1 */` and `/* eslint-disable-next-line @next/next/no-img-element */` comments
- Updated LOCKED-constraints header comment to reflect P17-01 completion
- bonus-section-image.test.ts: **7/7 GREEN** (was 0/7 prior to this plan)
- 234 baseline tests remain GREEN; total passing 249 (10 pre-existing Wave 0 RED stubs for P17-03/04/05/06 unchanged)

## Task Commits

1. **Task 1: Convert storyboard grid to next/image fill** - `74c84c9` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `apps/web/components/issue/BonusSection.tsx` — BigBudgetBonus storyboard grid now uses `<Image fill sizes=...>` inside a `relative aspect-video` container; `import Image from 'next/image'` added; raw `<img>` and eslint-disable removed; header comment updated

## Decisions Made

- `fill` mode chosen over explicit `width`/`height` — the existing `aspect-video` container already controls the display dimensions; using `fill` lets next/image generate srcsets without imposing a fixed intrinsic size
- `sizes` value `"(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 430px"` chosen to match: 1-col at mobile (100vw), 2-col at `sm:` (half viewport), and the 860px max-width editorial container at desktop (430px per column)
- `relative` added to wrapper className inline (not as a separate utility class comment) to keep it adjacent to `aspect-video overflow-hidden`
- No change to `next.config.ts` — `cdn.sanity.io` was already in `remotePatterns`
- No new npm dependency — `next/image` is part of the `next` package already installed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- P17-03 (ArchiveList load-more pagination), P17-04 (loading.tsx skeletons), P17-05 (/about copy), P17-06 (_debug/convex no-`<main>`) are still Wave 0 RED stubs waiting for Wave 2 plans 17-03 through 17-06
- P17-07 (dep count = 17) remains GREEN — this plan added no dependencies

## Self-Check

- [x] `apps/web/components/issue/BonusSection.tsx` — file exists and contains `<Image fill>`
- [x] Commit `74c84c9` exists in git log
- [x] bonus-section-image.test.ts: 7/7 GREEN (confirmed by test run above)
- [x] 234 baseline + 7 new P17-02 assertions = 241 passing prior-baseline tests all GREEN

## Self-Check: PASSED

---
*Phase: 17-ui-ux-audit-follow-ups*
*Completed: 2026-06-02*
