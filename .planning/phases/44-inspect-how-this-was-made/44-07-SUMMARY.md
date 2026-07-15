---
phase: 44-inspect-how-this-was-made
plan: 07
subsystem: ui
tags: [react, nextjs, convex, inspector, dispatch-control, galley, portabletext, fact-check]

# Dependency graph
requires:
  - phase: 44-06
    provides: "components/inspector/InspectorProvider.tsx's useInspector()/openInspector, mounted once at the (dashboard) root layout -- the opener every entry point below calls"
  - phase: 44-03
    provides: "lib/inspectorArtifact.ts's resolveInspectorStep -- the 'founder'/'claim' artifact-type resolution the opened panel runs against the locator supplied here"
provides:
  - "AnnotationMark.tsx + UnresolvedFindingCard.tsx onInspect? prop -- the shared finding action-row entry point covering BOTH the draft passage (Review Desk) and voice finding (Voice Pass) surfaces with one change"
  - "GallerySection.tsx per-section 'Inspect how this was made' header affordance -- covers sections with no open finding to hang the action off"
  - "Galley.tsx onInspect? forwarding to both GallerySection mount points (long-read sections + specAd bonus)"
  - "ReviewDeskRunView.tsx (Draft stage) and VoicePassRunView.tsx (Voice stage) wired to openInspector({ type: 'founder', runId, locator: sectionId })"
  - "FactCheckScreen.tsx supplies ClaimProvenanceCard's already-present onInspect callback -> openInspector({ type: 'claim', runId, locator: claimIndex })"
affects: [44-08-entry-points-approval-mytasks-org, 44-09-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One shared finding component, two entry points: AnnotationMark is the SAME popover Review Desk (draft passages) and Voice Pass (machine tells) both render, so a single onInspect? prop addition satisfies two of the phase's six required entry points at once"
    - "onInspect? conditional-render convention: identical to the pre-existing onEditSection?/sectionId gate (Boolean(onInspect) or Boolean(onInspect && sectionId)) -- no new prop-gating pattern invented"
    - "Zero-fork reuse: ClaimProvenanceCard.tsx is untouched (git diff confirms) -- its Phase 42 onInspect? prop just gets a real callback supplied at the mount site"
    - "Test screens that now call useInspector() are wrapped in <InspectorProvider> at render time, mirroring InspectorProvider.test.tsx's own wrapping convention -- activeKey stays null in every test (no test clicks Inspect), so no new Convex reads are exercised"

key-files:
  created: []
  modified:
    - apps/dispatch-control/components/galley/AnnotationMark.tsx
    - apps/dispatch-control/components/galley/UnresolvedFindingCard.tsx
    - apps/dispatch-control/components/galley/GallerySection.tsx
    - apps/dispatch-control/components/galley/Galley.tsx
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx"
    - "apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx"
    - "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx"
    - apps/dispatch-control/__tests__/AnnotationMark.test.tsx
    - apps/dispatch-control/__tests__/UnresolvedFindingCard.test.tsx
    - apps/dispatch-control/__tests__/VoicePassScreen.test.tsx
    - apps/dispatch-control/__tests__/FactCheckScreen.test.tsx

key-decisions:
  - "Wired the two screen-level callers (ReviewDeskRunView.tsx, VoicePassRunView.tsx) even though they were not listed in the plan's frontmatter files_modified. The plan's own Task 1 <action> text explicitly requires it ('In the DRAFT stage screen that renders Galley and the VOICE stage view that renders Galley/AnnotationMark, pass onInspect={...}') -- the frontmatter list was an incomplete summary of the task's own instructions, not a scope boundary. Both files are the only screens that mount <Galley>, so no other caller needed the wiring."
  - "Fact Check's claim locator is the claim's claimIndex (stable, always-present ordinal), not the Phase 35 claimId provenance field. claimId is v.optional -- present only for writer-bound (sourced) rows -- and would silently omit the Inspect action for the majority of legacy/unsourced claims. claimIndex is the same identifier every other action on this screen already keys off (selectedClaimIndex, patchClaim, removeClaim, replaceSource), so using it keeps the new callback consistent with the rest of the screen and never drops the action for a claim lacking sourced provenance."
  - "Placed the 'Inspect how this was made' action after 'Edit inline' in both AnnotationMark's popover and UnresolvedFindingCard's action row (before Dismiss) -- matches the existing left-to-right severity of actions (fix/edit the content first, dismiss/inspect last) and keeps the new button visually adjacent to the other section-scoped action (Edit inline) rather than the finding-scoped ones (Accept/Dismiss)."
  - "GallerySection's header affordance renders whenever onInspect is supplied, regardless of whether the section has a headline -- a section with an empty headline but a caller-supplied onInspect still gets an actionable header row (flex row with the button right-aligned), so 'no open finding' sections (the case D-02/RESEARCH #2 called out) are never left without an Inspect entry point."

patterns-established: []

requirements-completed: [INS-01]

# Metrics
duration: ~20min
completed: 2026-07-15
---

# Phase 44 Plan 07: Entry Points — Draft, Voice, Fact Check Summary

**Wired three of the six "Inspect how this was made" entry points (draft passage, voice finding, fact-check claim) to the single shared `openInspector` — the draft+voice pair collapses into one `onInspect?` prop on the shared `AnnotationMark`/`UnresolvedFindingCard` finding chain, and the claim entry point supplies `ClaimProvenanceCard`'s already-present-but-inert callback with zero changes to that file.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-15T20:47:44Z (approx, session start per STATE.md)
- **Completed:** 2026-07-15
- **Tasks:** 2
- **Files modified:** 11 (7 source, 4 test)

## Accomplishments

- `AnnotationMark.tsx` and `UnresolvedFindingCard.tsx` both gained an optional `onInspect?: (sectionId: string) => void` prop, following the identical `onEditSection?`/`sectionId` conditional-render convention already established for "Edit inline" — since `AnnotationMark` is the SAME popover Review Desk's draft passages and Voice Pass's machine-tell findings both render, this single change satisfies two of the phase's six required entry points at once (44-RESEARCH.md's "Six entry points" #2/#4)
- `GallerySection.tsx` gained a per-section "Inspect how this was made" header affordance, gated on an optional `onInspect?` prop — covers sections with no open finding to hang the action off, per the plan's Task 1 requirement
- `Galley.tsx` forwards `onInspect?` unmodified to both `GallerySection` mount points (the four long-read sections and the specAd bonus section)
- `ReviewDeskRunView.tsx` (Draft stage) and `VoicePassRunView.tsx` (Voice stage) both call `useInspector()` and pass `onInspect={(sectionId) => openInspector({ type: 'founder', runId, locator: sectionId })}` into their `<Galley>` mount
- `FactCheckScreen.tsx` calls `useInspector()` and supplies `onInspect: () => openInspector({ type: 'claim', runId, locator: String(selectedRow.claimIndex) })` in the `actions` object already passed to `ClaimProvenanceCard` — flips its existing (Phase 42) Inspect button from disabled to live with **zero changes** to `ClaimProvenanceCard.tsx` itself (confirmed via `git diff --name-only`, satisfying the Phase 42 D-09 three-copies ban)
- Added render-gate + click-behavior tests for the new `onInspect` prop on `AnnotationMark` and `UnresolvedFindingCard`; wrapped `FactCheckScreen.test.tsx` and `VoicePassScreen.test.tsx` renders in `<InspectorProvider>` since both screens now call `useInspector()`
- Full `pnpm --filter dispatch-control build` and `pnpm --filter dispatch-control test` (96 files, 830 tests, 2 pre-existing unrelated `it.todo`s) both pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add onInspect to the shared galley finding chain (draft + voice)** - `85a9090` (feat)
2. **Task 2: Supply ClaimProvenanceCard's onInspect callback in the Fact Check stage** - `c03dacc` (feat)

## Files Created/Modified

- `apps/dispatch-control/components/galley/AnnotationMark.tsx` - `onInspect?` prop + "Inspect how this was made" popover action, gated on `Boolean(onInspect) && sectionId`
- `apps/dispatch-control/components/galley/UnresolvedFindingCard.tsx` - `onInspect?` prop + matching action in the card's action row
- `apps/dispatch-control/components/galley/GallerySection.tsx` - threads `onInspect` into every `AnnotationMark`/`UnresolvedFindingCard` this section mounts, plus a per-section header affordance
- `apps/dispatch-control/components/galley/Galley.tsx` - forwards `onInspect?` unmodified to both `GallerySection` mount points
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx` - Draft stage: `useInspector()` + `handleInspect` wired into the `<Galley>` mount
- `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx` - Voice stage: same wiring pattern as Draft
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx` - supplies `ClaimProvenanceCard`'s `onInspect` callback (claim artifact key, locator = `claimIndex`)
- `apps/dispatch-control/__tests__/AnnotationMark.test.tsx` - render-gate + click tests for `onInspect`
- `apps/dispatch-control/__tests__/UnresolvedFindingCard.test.tsx` - render-gate + click tests for `onInspect`
- `apps/dispatch-control/__tests__/VoicePassScreen.test.tsx` - wraps `renderScreen()` in `<InspectorProvider>`
- `apps/dispatch-control/__tests__/FactCheckScreen.test.tsx` - wraps all 5 render call sites in `<InspectorProvider>` via a new `renderScreen()` helper

## Decisions Made

- **Wired `ReviewDeskRunView.tsx`/`VoicePassRunView.tsx` even though the plan's frontmatter `files_modified` list omitted them.** The plan's Task 1 `<action>` text is explicit: "In the DRAFT stage screen that renders Galley and the VOICE stage view that renders Galley/AnnotationMark, pass `onInspect={...}`". These two files are the only screens that mount `<Galley>` (confirmed via `grep -rl "Galley"`), so wiring them was required to make the draft-passage and voice-finding entry points actually reachable — the frontmatter list was an incomplete restatement of the task, not a narrower scope boundary.
- **Claim locator is `claimIndex`, not the optional `claimId` provenance field.** `claim_checks.claimId` (`convex/schema.ts`) is `v.optional` and present only for writer-bound (sourced) rows; using it would silently drop the Inspect action for unsourced/legacy claims. `claimIndex` is always present and is the same identifier `handleConfirm`/`handleEdit`/`handleReplaceSource`/`handleRemove`/`handleKeep` on this screen already key off via `selectedClaimIndex`.
- **Action placement**: "Inspect how this was made" sits after "Edit inline" and before "Dismiss" in both `AnnotationMark`'s popover and `UnresolvedFindingCard`'s action row — grouped with the other section-scoped action rather than the finding-scoped ones.
- **`GallerySection`'s header row renders whenever `onInspect` is supplied**, independent of whether a `headline` is present, so sections with no open finding are never left without an entry point.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wrapped `FactCheckScreen.test.tsx` and `VoicePassScreen.test.tsx` renders in `<InspectorProvider>`**
- **Found during:** Task 1/2 verification (`pnpm --filter dispatch-control test`)
- **Issue:** Both screens now call `useInspector()` at render time (to supply `onInspect`), but their existing tests rendered the screens directly, outside any `<InspectorProvider>`. `useInspector()` throws `'useInspector must be used within an InspectorProvider'` when no provider is mounted, so both test files failed with 11 test failures total (5 in `FactCheckScreen.test.tsx`, 6 in `VoicePassScreen.test.tsx`) — a direct, unavoidable consequence of wiring `useInspector()` into these screens, not a pre-existing bug.
- **Fix:** Wrapped every `render(<FactCheckScreen ... />)` call in a new `renderScreen()` helper that mounts `<InspectorProvider>` around it (matching the existing `renderScreen()` helper already present in `VoicePassScreen.test.tsx`, extended the same way). `activeKey` stays `null` throughout every test (no test clicks Inspect), so no new Convex reads or panel renders are exercised.
- **Files modified:** `apps/dispatch-control/__tests__/FactCheckScreen.test.tsx`, `apps/dispatch-control/__tests__/VoicePassScreen.test.tsx`
- **Verification:** `pnpm --filter dispatch-control test` — 96 files, 830 tests passing (2 pre-existing unrelated `it.todo`s), zero failures
- **Committed in:** `85a9090` (VoicePassScreen.test.tsx, part of Task 1 commit), `c03dacc` (FactCheckScreen.test.tsx, part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary consequence of the plan's own required wiring — no scope creep. `ClaimProvenanceCard.tsx` remains completely unforked/untouched as required.

## Issues Encountered

None beyond the test-wrapping fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 3 of 6 required entry points (INS-01) are now live: draft passage, voice finding, fact-check claim detail — each calls the one shared `useInspector().openInspector` with the correct artifact key type (`founder`/`founder`/`claim`).
- The remaining 3 entry points (brief org card, approval recommendation, My Tasks) are Plan 44-08's scope — the same `openInspector` pattern applies directly; no new panel/provider work is needed.
- No blockers. `pnpm --filter dispatch-control build` and `pnpm --filter dispatch-control test` (96 files / 830 tests) both green.

---
*Phase: 44-inspect-how-this-was-made*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/components/galley/AnnotationMark.tsx
- FOUND: apps/dispatch-control/components/galley/UnresolvedFindingCard.tsx
- FOUND: apps/dispatch-control/components/galley/GallerySection.tsx
- FOUND: apps/dispatch-control/components/galley/Galley.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx
- FOUND: apps/dispatch-control/__tests__/AnnotationMark.test.tsx
- FOUND: apps/dispatch-control/__tests__/UnresolvedFindingCard.test.tsx
- FOUND: apps/dispatch-control/__tests__/VoicePassScreen.test.tsx
- FOUND: apps/dispatch-control/__tests__/FactCheckScreen.test.tsx
- FOUND: 85a9090 (Task 1 commit)
- FOUND: c03dacc (Task 2 commit)
