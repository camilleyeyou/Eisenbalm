---
phase: 11-archive-cardswap-and-issue-page-motion-polish
plan: "04"
subsystem: apps/web
tags: [motion-polish, css, react, intersection-observer, scroll-snap, accessibility]
dependency_graph:
  requires: ["11-01"]
  provides: [MOT-02, MOT-03]
  affects: [globals.css, DeliberationSlot, SectionNavigator]
tech_stack:
  added: []
  patterns:
    - IntersectionObserver + requestAnimationFrame count-up pattern
    - CSS scroll-snap mobile carousel with min-width desktop override
    - Module-scope prefersReducedMotion guard reuse
key_files:
  created: []
  modified:
    - apps/web/app/globals.css
    - apps/web/components/issue/DeliberationSlot.tsx
decisions:
  - "CSS scroll-snap structure: base .pitch-card-list rule carries scroll-snap-type so the test regex /\\.pitch-card-list\\s*\\{[\\s\\S]*?\\}/ (non-greedy) matches the scroll-snap declaration in the first block; desktop override uses min-width: 960px to restore vertical flex layout"
  - "prefersReducedMotion omitted from useEffect deps (it is module-scope non-reactive — intentional)"
  - "SectionNavigator.tsx left byte-unchanged — MOT-02 is entirely a globals.css edit"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-22T03:48:51Z"
  tasks: 3
  files_modified: 2
---

# Phase 11 Plan 04: Navigator and Deliberation Motion Summary

MOT-02 + MOT-03 motion polish: section-card hover lift via globals.css + confidence count-up via IntersectionObserver/rAF + pitch-card mobile scroll-snap carousel in DeliberationSlot.

## What Was Built

### MOT-02: Section-Card Hover Translate (globals.css)

Added `transform: translateY(-4px)` to the existing `.section-card:hover` rule (modified in place, no duplicate). The base `.section-card` already had `transition: ... transform 0.3s ...` so no new transition rule was needed. The global reduced-motion guard at lines 293-302 collapses the transition to `0.01ms` — the lift is instant under reduced-motion. SectionNavigator.tsx was left byte-unchanged; the magnetic-glow `prefersReducedMotion` early-return at line ~100 is preserved verbatim.

### MOT-03a: Confidence Count-Up (DeliberationSlot.tsx)

Added `useState`, `useEffect`, `useRef` React imports. Added `confidenceSectionRef`, `displayValue` state (0), and `animatedRef` one-shot guard. The `useEffect` fires when `editorConfidence` changes:

- **Reduced-motion path:** `setDisplayValue(target)` immediately (Pitfall-4 guard — never shows 0)
- **Normal path:** `IntersectionObserver` with `threshold: 0.4` fires on scroll-into-view; `observer.disconnect()` after first fire (Pitfall-3 guard); `requestAnimationFrame` tick loop over 1200ms animates 0→target

The confidence value span changed from `{Math.round(editorConfidence * 100)}%` to `{displayValue}%` with `aria-live="polite"`. The bar fill width also uses `displayValue`. The `editorConfidence < 0.70` threshold check retains the real value (not `displayValue`) so the warning note does not flicker during animation.

### MOT-03b: Pitch-Card Scroll-Snap Carousel (globals.css + DeliberationSlot.tsx)

Added Phase 11 section to globals.css. The base `.pitch-card-list` rule carries `scroll-snap-type: x mandatory` + `flex-direction: row` + `overflow-x: auto` for mobile. A `@media (min-width: 960px)` override restores the vertical desktop layout (`flex-direction: column`, `scroll-snap-type: none`). This mobile-first structure ensures the test regex `/\.pitch-card-list\s*\{[\s\S]*?\}/` finds `scroll-snap-type` in the first matched block.

In DeliberationSlot.tsx: pitch container changed from `className="flex flex-col gap-4"` to `className="pitch-card-list" role="list"`; each pitch card gained `role="listitem"` and `tabIndex={0}` for keyboard accessibility; `sr-only` hint added after the container.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Implementation Adjustment] CSS mobile-first instead of max-width breakpoint**

- **Found during:** Task 1
- **Issue:** Plan specified `@media (max-width: 959px)` for the scroll-snap carousel with a base `flex-direction: column` rule. However the test regex `/\.pitch-card-list\s*\{[\s\S]*?\}/` is non-greedy and would match the first `.pitch-card-list {` block — the base rule. If `scroll-snap-type` was only in the `max-width: 959px` media query, the test assertion `pitchCardListBlock.toContain('scroll-snap-type')` would fail.
- **Fix:** Restructured to mobile-first: base `.pitch-card-list` rule carries `scroll-snap-type: x mandatory` + horizontal layout; `@media (min-width: 960px)` override restores the vertical desktop layout. Behavior is identical on all screen sizes.
- **Files modified:** `apps/web/app/globals.css`
- **Commit:** 4eb3e29

## Verification

All motion-polish.test.ts assertions (9 tests) GREEN. deliberation-no-model-names.test.ts (3 tests) GREEN. theme-aa-tones.test.ts (8 tests) GREEN. `pnpm build` exits 0. 5 Convex subscriptions byte-unchanged. No new `:root` hex values. No DEL-04 forbidden strings. No new npm dependencies.

Pre-existing 29 Phase 8 Wave 0 sentinel failures unchanged (expected — Phase 8 plans not yet executed).

## Self-Check: PASSED

- apps/web/app/globals.css — FOUND
- apps/web/components/issue/DeliberationSlot.tsx — FOUND
- Commit 4eb3e29 — FOUND
- Commit dbe19c2 — FOUND
