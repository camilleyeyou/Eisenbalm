---
phase: 32-native-galley-read-only-span-resolver
plan: 05
subsystem: ui
tags: [portabletext, review-desk, galley, annotations, css]

# Dependency graph
requires:
  - phase: 32-01
    provides: RED UnresolvedFindingCard.test.tsx jsdom spec
  - phase: 32-03
    provides: spanResolver.ts UnresolvedFinding type
  - phase: 32-04
    provides: syntheticPortableText.ts AnnotationMarkDef markDef shape (mirrored, not imported, in AnnotationMark.tsx)
provides:
  - AnnotationMark.tsx — @portabletext/react marks.annotation component (severity underline + read-only popover)
  - UnresolvedFindingCard.tsx — D-09 section-end unresolved-finding card
  - Galley CSS primitives in globals.css (.galley-anno, .galley-popover, .galley-unresolved, .galley-headline/-deck/-body/-h2/-pullquote, .galley-root)
affects: [32-06-galley-assembly, 32-07-chip-counts-and-page-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only popover component pattern: local open/close state + outside-click/Escape listeners, single reusable component that Phase 33 extends in place with an action row rather than replacing"
    - "Split quoted-text child element (bare quote marks as sibling text nodes around a dedicated <span>) so testing-library getByText(exact-string) matches the inner element while punctuation stays visually attached"

key-files:
  created:
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AnnotationMark.tsx"
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/UnresolvedFindingCard.tsx"
  modified:
    - apps/dispatch-control/app/globals.css

key-decisions:
  - "AnnotationMarkDef type is declared and exported locally in AnnotationMark.tsx per the plan's explicit instruction, rather than importing the structurally-identical type from syntheticPortableText.ts — keeps this plan's component free of a hard dependency on Plan 32-04's module shape; Plan 32-06 is responsible for the trivial shape reconciliation at the composition point."
  - "Quoted-span text in UnresolvedFindingCard is wrapped in its own <span> with the curly quote marks as separate sibling text/entity nodes (not concatenated into one text run) so getByText(exact quotedSpan string) matches — visually identical output, but structurally necessary for the RED test's exact-string assertion to pass."

requirements-completed: [GLY-02]

# Metrics
duration: 12min
completed: 2026-07-07
---

# Phase 32 Plan 05: Annotation Primitives Summary

**The two GLY-02 annotation-render primitives — an inline `@portabletext/react` marks component with severity-tiered underlines and a read-only finding popover, plus a D-09 section-end "unresolved" card — backed by the D-07 severity color CSS and the D-04 galley type scale appended to `globals.css`.**

## Performance

- **Duration:** 12 min
- **Completed:** 2026-07-07
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 appended-only)

## Accomplishments

- Appended a `/* Phase 32: Native Galley */` block to `globals.css` (append-only — the existing `:root`/`@theme` token block is byte-unchanged) defining `.galley-anno[data-severity="error"|"warning"|"info"]` (D-07 vermilion/marigold/cobalt-dotted underline tiers, error additionally tinted), `.galley-popover` + its label sub-classes (D-10), `.galley-unresolved` + label/quote sub-classes (D-09), and the D-04 type scale (`.galley-headline` 52px clamp/.98 line-height, `.galley-deck` italic 22px, `.galley-body` 16.5px/1.7, `.galley-h2`, `.galley-pullquote`), plus an explicit `.galley-root { background: var(--background) }` paper-background rule
- `AnnotationMark.tsx`: a `'use client'` component built for `@portabletext/react`'s `marks.annotation` slot — wraps `children` in a `<mark className="galley-anno" data-severity={value.severity}>`, keyboard-openable (`tabIndex`, Enter/Space), and toggles a `.galley-popover` showing severity/axis/reason/suggested-fix; closes on Escape, outside-click, or re-click. Exports the `AnnotationMarkDef` prop type. Deliberately renders **no** Accept/Edit/Dismiss buttons this phase (D-10) — a `{/* Phase 33 (EDT-04) ... */}` comment marks exactly where those mount next phase
- `UnresolvedFindingCard.tsx`: pure presentational D-09 card — `.galley-unresolved` container with `data-severity`, an uppercase "Unresolved · {severity}" label, the full `reason` text, the original `quotedSpan` in curly quotes when present, and `suggestedFix` when present. `UnresolvedFindingCard.test.tsx` (Plan 32-01's RED scaffold) now passes 4/4 green

## Task Commits

Each task was committed atomically:

1. **Task 1: Galley annotation + unresolved CSS in globals.css** - `2c733a5` (feat)
2. **Task 2: AnnotationMark.tsx — inline severity underline + read-only popover** - `5cdcaf8` (feat)
3. **Task 3: UnresolvedFindingCard.tsx — D-09 section-end card** - `e70ab95` (feat)

## Files Created/Modified

- `apps/dispatch-control/app/globals.css` - appended Phase 32 galley CSS block (severity underline tiers, popover, unresolved card, type scale, paper-background rule); pre-existing `:root`/`@theme` token block untouched
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AnnotationMark.tsx` (new) - `marks.annotation` component + exported `AnnotationMarkDef` type
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/UnresolvedFindingCard.tsx` (new) - D-09 unresolved card, imports `UnresolvedFinding` from `@/lib/galley/spanResolver`

## Decisions Made

- Declared `AnnotationMarkDef` locally in `AnnotationMark.tsx` (exported) rather than importing the structurally-identical type already declared in `syntheticPortableText.ts` (Plan 32-04) — the plan explicitly calls for defining/exporting the type in this file; Plan 32-06 (galley assembly, where both modules are wired together) is the natural place to confirm/adapt the two independently-declared shapes if they ever drift.
- In `UnresolvedFindingCard`, wrapped the quoted span text in its own `<span>` element with the curly-quote characters as separate sibling nodes (rather than one concatenated JSX text expression) — visually identical rendering, but required so `getByText(finding.quotedSpan)` (an exact-string matcher) resolves against an element whose `textContent` is exactly the quoted text, not the quote-plus-punctuation string.

## Deviations from Plan

None — plan executed as written. One test-implementation detail (the quote-wrapping fix above) was needed to make the RED spec pass exactly as authored; this is normal TDD GREEN-phase iteration, not a deviation from the plan's instructions.

## Known Stubs

None — all three artifacts are fully wired to their real props/types; no placeholder data paths.

## Issues Encountered

- Running the full `apps/dispatch-control` vitest suite surfaces 2 pre-existing RED tests in `SectionChipList.test.tsx` under a "Phase 32 GLY-05 upgrade" describe block (numeric open-finding count on a chip; `data-unresolved` marker). These were authored in Plan 32-01's Wave 0 RED scaffold and are explicitly scoped to Plan 32-07 (chip-counts-and-page-wiring), not this plan's annotation-primitives scope. Logged to `deferred-items.md` per the SCOPE BOUNDARY rule; not fixed here.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `AnnotationMark.tsx` and `UnresolvedFindingCard.tsx` are ready for Plan 32-06 (`Galley.tsx` assembly) to import and wire against `toSyntheticBlocks`'s markDef output and `spanResolver.ts`'s `unresolved[]` array respectively.
- The galley CSS classes (`.galley-anno`, `.galley-popover`, `.galley-unresolved`, `.galley-headline`/`-deck`/`-body`/`-h2`/`-pullquote`, `.galley-root`) are available for Plan 32-06's section rendering.
- `Galley.test.tsx` (Plan 32-01's RED scaffold) still fails at the `Galley` component import — expected, as `Galley.tsx` itself is Plan 32-06/32-07's deliverable, not this plan's.

---
*Phase: 32-native-galley-read-only-span-resolver*
*Completed: 2026-07-07*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AnnotationMark.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/UnresolvedFindingCard.tsx
- FOUND: 2c733a5
- FOUND: 5cdcaf8
- FOUND: e70ab95
