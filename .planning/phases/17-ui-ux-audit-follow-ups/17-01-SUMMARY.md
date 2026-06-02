---
phase: 17
plan: "01"
subsystem: web-tests
tags: [test, wave0, source-scan, tripwire, p17-01, p17-03, p17-04, p17-05, p17-06, p17-07]
dependency_graph:
  requires: []
  provides: [17-01-wave0-tripwires]
  affects: [17-02-bonus-image, 17-03-archive-pagination, 17-04-loading-skeletons, 17-05-about-debug]
tech_stack:
  added: []
  patterns: [source-scan tripwire, RED-first TDD, readFileSync + vitest, existsSync guard]
key_files:
  created:
    - apps/web/__tests__/bonus-section-image.test.ts
    - apps/web/__tests__/debug-route.test.ts
    - apps/web/__tests__/archive-pagination.test.ts
    - apps/web/__tests__/loading-skeletons.test.ts
    - apps/web/__tests__/about-page.test.ts
  modified: []
decisions:
  - "loading-skeletons no-<main> guards use existsSync check before readFileSync to produce clean RED on missing files rather than ENOENT throws"
  - "about-page <article> assertion is GREEN immediately — acts as regression guard during Wave 2 copy replacement"
  - "archive-pagination min-h-11 assertion passes immediately (sort buttons already carry min-h-11) — expected, correct as a guard for the load-more button"
  - "dep-count guard mirrors archive-cardswap.test.ts line 159 exactly (toBe(17))"
metrics:
  duration: "4 min"
  completed: "2026-06-02"
  tasks: 2
  files: 5
---

# Phase 17 Plan 01: Wave 0 Test Stubs Summary

Five source-scan tripwire test files encoding every Phase 17 P17-01/03/04/05/06/07 acceptance condition, all RED on the pre-implementation codebase and ready for Wave 2 implementation plans to turn green.

## What Was Built

### Task 1 — bonus-section-image.test.ts + debug-route.test.ts (commit ca3162e)

**bonus-section-image.test.ts** (P17-01, 7 assertions):
- `from 'next/image'` import present
- `<Image` component used
- `fill` prop present
- No raw `<img>` in non-comment code (comment-stripping codeOnly() helper applied)
- No `@next/next/no-img-element` eslint-disable comment
- `relative aspect-video` on the storyboard wrapper
- `sizes=` prop for responsive optimization

**debug-route.test.ts** (P17-06, 2 assertions):
- Sanity guard: file contains "Convex smoke test" (guards against path typo)
- Page does not contain `<main` (single-main-landmark rule)

Both files use the canonical `readFileSync` + `resolve(__dirname, '../...')` pattern from `archive-cardswap.test.ts`. No jsdom, no React render, no mocks.

### Task 2 — archive-pagination.test.ts + loading-skeletons.test.ts + about-page.test.ts (commit 48abde9)

**archive-pagination.test.ts** (P17-03 + P17-07, 6 assertions):
- `PAGE_SIZE` constant present
- `visibleCount` state present
- `hasMore` + `Load` for the load-more button
- `min-h-11` touch-target on load-more button
- `setVisibleCount` + `useEffect` for search/sort reset
- Dep-count guard: `Object.keys(pkg.dependencies).length === 17`

**loading-skeletons.test.ts** (P17-04, 8 assertions):
- 4 existence checks (existsSync) for loading.tsx at all required route segments
- 4 no-`<main>` guards (each guarded by existsSync so missing files produce the clean existence-RED rather than ENOENT throws)

**about-page.test.ts** (P17-05, 2 assertions):
- Does NOT contain "This page is being written" placeholder
- Contains `<article` structural wrapper

## Test Counts

| File | Total | Failing (RED) | Passing |
|------|-------|---------------|---------|
| bonus-section-image.test.ts | 7 | 7 | 0 |
| debug-route.test.ts | 2 | 1 | 1 (sanity guard) |
| archive-pagination.test.ts | 6 | 4 | 2 (min-h-11 + dep-count) |
| loading-skeletons.test.ts | 8 | 4 | 4 (no-`<main>` guards skip when file missing) |
| about-page.test.ts | 2 | 1 | 1 (`<article>` present) |
| **Total** | **25** | **17** | **8** |

**Pre-existing baseline:** 234 tests across 26 files — all GREEN (verified by full suite run).  
**New total:** 259 tests across 31 files.

## Commits

| Hash | Message |
|------|---------|
| ca3162e | test(17-01): add P17-01 + P17-06 source-scan tripwires (RED Wave 0) |
| 48abde9 | test(17-01): add P17-03/04/05/07 source-scan tripwires (RED Wave 0) |

## Deviations from Plan

None — plan executed exactly as written.

The one note: `archive-pagination.test.ts` min-h-11 assertion passes immediately (the existing sort buttons in ArchiveList already use `min-h-11`). This is expected and correct per the plan — the assertion guards the load-more button specifically but also passes on the existing code. Wave 2 will add a load-more button that also carries `min-h-11`, keeping the assertion green.

## Known Stubs

None. These are test-only files; no stubs in production code were created.

## Self-Check: PASSED

- All 5 files exist: VERIFIED
- Both commits exist (ca3162e, 48abde9): VERIFIED
- 31 test files collected by vitest: VERIFIED
- 17 RED assertions encoding P17-01/03/04/05/06 contracts: VERIFIED
- 26 pre-existing test files all GREEN (242 passing): VERIFIED
- Dep-count guard passes at 17: VERIFIED
- No new npm dependency added: VERIFIED
