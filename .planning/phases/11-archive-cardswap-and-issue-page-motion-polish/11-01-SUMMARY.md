---
phase: 11
plan: 01
subsystem: web/tests
tags: [tdd, source-scan, wave0, arc-01, mot-01, mot-02, mot-03]
dependency_graph:
  requires: []
  provides: [arc-01-test-contract, mot-01-test-contract, mot-02-test-contract, mot-03-test-contract]
  affects: [apps/web/__tests__/]
tech_stack:
  added: []
  patterns: [readFileSync-source-scan, codeOnly-comment-strip, lazy-reader-helper]
key_files:
  created:
    - apps/web/__tests__/archive-cardswap.test.ts
    - apps/web/__tests__/issue-hero-motion.test.ts
    - apps/web/__tests__/motion-polish.test.ts
  modified: []
decisions:
  - opacity-regex-precision: Used /opacity:\s*0(?!\.\d)/ regex (not toContain) to avoid false positive from ghost numeral opacity:0.025 in current IssueHero
  - readCardSwap-lazy-helper: CardSwap.tsx reads deferred to it() body via readCardSwap() function per STATE.md Ph9 pattern (Vitest evaluates describe bodies at collection time)
  - split-assertion-incidental-pass: .split( assertion passes now via dateStr.split('-') in IssueHero; remains valid after Plan 03 adds charity.name.split(' ')
metrics:
  duration: "~5 min"
  completed: "2026-05-22"
  tasks: 2
  files: 3
---

# Phase 11 Plan 01: Wave 0 Test Stubs Summary

Three Phase 11 acceptance-contract test files authored as source-scan tripwires. All ARC-01/MOT-01/MOT-02/MOT-03 implementation assertions are RED (Wave 2 turns them green). The five existing tripwire tests remain GREEN.

## What Was Built

**Task 1: `apps/web/__tests__/archive-cardswap.test.ts`** (ARC-01 + FONT_WHITELIST + no-new-dep)

- 9 CardSwap.tsx assertions deferred via `readCardSwap()` helper (RED — ENOENT until Plan 02)
- 2 archive/page.tsx wiring assertions (RED — CardSwap not imported yet)
- 2 no-new-dep assertions: no gsap/framer-motion/@iconify, baseline dep count = 17 (GREEN)
- 4 FONT_WHITELIST assertions: 6 entries present, Spectral/IBM Plex Mono absent (GREEN)

**Task 2: `apps/web/__tests__/issue-hero-motion.test.ts`** (MOT-01)

- `splits the charity name` — incidentally GREEN (dateStr.split exists); remains valid after Plan 03 adds charity.name.split
- `animationDelay` — RED until Plan 03
- `@keyframes heroWordReveal` — RED until Plan 03
- opacity/clip-path pitfall guards — GREEN now (no such base styles in current IssueHero)
- eyebrow ≥2 usages — GREEN (DES-04 inheritance, currently 10 usages)
- no-use-client guard — GREEN (IssueHero is a Server Component)

**Task 2: `apps/web/__tests__/motion-polish.test.ts`** (MOT-02 + MOT-03)

- `.section-card:hover translateY` — RED until Plan 04
- `SectionNavigator prefersReducedMotion early-return` — GREEN (already present at line ~100)
- `IntersectionObserver` — RED until Plan 04
- `setDisplayValue` — RED until Plan 04
- `setDisplayValue(target)` reduced-motion Pitfall 4 guard — RED until Plan 04
- DEL-04 no-model-names — GREEN (DeliberationSlot.tsx clean)
- `.pitch-card-list scroll-snap-type` — RED until Plan 04
- `pitch-card-list` class in DeliberationSlot — RED until Plan 04

## Test Counts

| File | Tests | Pass | Fail | Notes |
|------|-------|------|------|-------|
| archive-cardswap.test.ts | 15 | 4 | 11 | CardSwap ENOENT + wiring RED, dep/FONT GREEN |
| issue-hero-motion.test.ts | 7 | 5 | 2 | animationDelay + @keyframes RED |
| motion-polish.test.ts | 9 | 3 | 6 | translateY + count-up + pitch-card RED |
| **Total new** | **31** | **12** | **19** | Expected Wave 0 state |
| Pre-existing Phase 8 | 29 | 0 | 29 | Unchanged — out of scope |
| 5 tripwires | 61 | 61 | 0 | All GREEN — no regressions |

Overall: 23 test files collected (was 21), 197 tests, 149 pass / 48 fail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] opacity:0 assertion false-positive on ghost numeral**
- **Found during:** Task 2 verification run
- **Issue:** Plan specified `not.toContain('opacity: 0')` but IssueHero.tsx has `opacity: 0.025` for the ghost numeral, causing the pitfall-guard assertion to fail immediately (it should be GREEN pre-implementation)
- **Fix:** Replaced `toContain('opacity: 0')` with `not.toMatch(/opacity:\s*0(?!\.\d)/)` — negative lookahead excludes decimal values
- **Files modified:** `apps/web/__tests__/issue-hero-motion.test.ts`
- **Commit:** included in 678ed6b

## Self-Check: PASSED
