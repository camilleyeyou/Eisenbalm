---
phase: 41-issue-workspace-frame
plan: 03
subsystem: ui
tags: [react, accessibility, focus-visible, galley, portabletext, vitest]

# Dependency graph
requires:
  - phase: 35-review-gate-charity-registry-provenance-claims
    provides: "ClaimMark.tsx (claimSpan mark component), .galley-claim CSS wash, claim_checks Convex table"
provides:
  - "ClaimMark keyboard-focus source reveal (onFocus/onBlur + focusOpen state OR-ed with click-driven open)"
  - ".galley-claim:focus-visible outline rule, mirroring .galley-anno"
  - "onUnsourcedClaimClick(claimIndex) callback threaded Galley -> GallerySection -> ClaimMark"
  - "net-new __tests__/ClaimMark.test.tsx (5 tests) — first direct unit coverage for ClaimMark"
affects: [41-08-stage2-draft-recomposition]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual boolean popover visibility (open || focusOpen) so a click-opened popover survives an unrelated blur, while a separate focus-only state gives keyboard-Tab parity with hover/click"
    - "Optional callback prop threaded through 3 component layers with undefined-safe default (back-compat for every existing caller: Review Desk, Voice Pass)"

key-files:
  created:
    - apps/dispatch-control/__tests__/ClaimMark.test.tsx
  modified:
    - apps/dispatch-control/components/galley/ClaimMark.tsx
    - apps/dispatch-control/components/galley/GallerySection.tsx
    - apps/dispatch-control/components/galley/Galley.tsx
    - apps/dispatch-control/app/globals.css

key-decisions:
  - "focusOpen is a separate state from open (not merged) so a click-opened popover is never force-closed by an unrelated blur event"
  - "Click-through (onUnsourcedClaimClick) only fires for status === 'pending' claims; a checked/skipped claim always toggles the popover even when the callback is provided"

patterns-established:
  - "Optional-callback threading through Galley -> GallerySection -> ClaimMark, undefined-safe at every layer"

requirements-completed: [WSP-04]

# Metrics
duration: 6min
completed: 2026-07-14
---

# Phase 41 Plan 03: Galley Claim Focus-Parity + Click-Through Summary

**Added keyboard-focus source reveal to `.galley-claim` marks and threaded an optional `onUnsourcedClaimClick` callback through Galley → GallerySection → ClaimMark for Stage 2's future Fact-Check hand-off.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-14T22:43Z (immediately after 41-02 commit)
- **Completed:** 2026-07-14T22:48:44-07:00
- **Tasks:** 2
- **Files modified:** 4 (+ 1 created)

## Accomplishments

- `.galley-claim` now has keyboard-focus parity with `.galley-anno`: Tab-focusing a claim mark opens its source popover (`onFocus`/`onBlur` toggling a new `focusOpen` state), and the popover renders on `open || focusOpen` so a click-opened popover is never force-closed by an unrelated blur.
- Added `.galley-claim:focus-visible { outline: 2px solid var(--color-ink); outline-offset: 1px; }` to `globals.css`, mirroring the existing `.galley-anno:focus-visible` rule.
- Added an optional `onUnsourcedClaimClick?: (claimIndex: number) => void` prop threaded through all three files in the claim-rendering chain (`Galley.tsx` → `GallerySection.tsx` → `ClaimMark.tsx`). A pending (unchecked) claim click calls the callback instead of toggling the popover when the callback is provided; every other case (checked claim, or callback undefined) preserves today's toggle-popover behavior exactly.
- Created the net-new `apps/dispatch-control/__tests__/ClaimMark.test.tsx` (5 tests) — the first direct unit-test coverage for `ClaimMark`, closing a pre-existing gap (previously only exercised indirectly via `Galley.test.tsx`).

## Task Commits

Each task was committed atomically:

1. **Task 1: ClaimMark focus-parity + click-through prop + CSS (WSP-04)** - `5246c57` (feat)
2. **Task 2: Thread onUnsourcedClaimClick through GallerySection and Galley** - `cff119f` (feat)

**Plan metadata:** (this commit) — docs: complete plan

## Files Created/Modified

- `apps/dispatch-control/components/galley/ClaimMark.tsx` - Added `onUnsourcedClaimClick` prop, `focusOpen` state, `onFocus`/`onBlur` handlers, click-handler branch for pending+callback, popover render condition `open || focusOpen`
- `apps/dispatch-control/app/globals.css` - Added `.galley-claim:focus-visible` outline rule
- `apps/dispatch-control/__tests__/ClaimMark.test.tsx` - New test file: focus opens/closes popover, click-open survives blur, click-through with/without callback, checked-claim toggle precedence over click-through
- `apps/dispatch-control/components/galley/GallerySection.tsx` - Added optional `onUnsourcedClaimClick` prop to `GallerySectionProps`, passed into the `claimSpan` mark's `ClaimMark`, added to the `components` `useMemo` dependency array
- `apps/dispatch-control/components/galley/Galley.tsx` - Added optional `onUnsourcedClaimClick` prop to `GalleyProps`, forwarded unmodified to both `GallerySection` mount sites (the `LONG_READ_SECTIONS` map and the `specAd` bonus section)

## Decisions Made

- Kept `focusOpen` as an independent `useState` rather than merging into the existing `open` state, per the plan's explicit instruction — this is what lets a click-opened popover survive a stray blur (e.g., tabbing away after clicking "Open source").
- Click-through gating uses `value.status === 'pending'` (not `!isChecked`, though those are currently equivalent) to read directly against the plan's stated condition and avoid coupling to `isChecked`'s definition if it ever changes.

## Deviations from Plan

None - plan executed exactly as written.

One out-of-scope discovery was logged (not fixed, per the Scope Boundary rule) to `.planning/phases/41-issue-workspace-frame/deferred-items.md`: pre-existing `tsc --noEmit` failures in three unrelated test files (`syntheticPortableText.test.ts`, `voicePassAxis.test.ts`, `WriterExpansion.test.tsx`) that predate this plan and do not touch any of the four files this plan modified (`ClaimMark.tsx`, `GallerySection.tsx`, `Galley.tsx`, `globals.css` all typecheck clean).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The `onUnsourcedClaimClick` primitive is now available on `Galley`/`GallerySection`/`ClaimMark` for Plan 41-08 (Stage 2 Draft recomposition) to wire into a Fact-Check tab navigation, per D-12.
- Note for 41-08: `Galley.tsx` is modified again in that later wave (41-08 `depends_on` 41-03) — this plan's changes were kept to the exact additive scope in its `<action>` blocks (new optional prop + CSS + forwarding) so 41-08's Stage-2 work composes cleanly without touching the same lines.

---
*Phase: 41-issue-workspace-frame*
*Completed: 2026-07-14*

## Self-Check: PASSED

All created/modified files confirmed present on disk; both task commits (`5246c57`, `cff119f`) confirmed in git log.
