---
phase: 39-registry-coverage-memory-strip
plan: 03
subsystem: ui
tags: [convex, react, dispatch-control, registry, corrections, append-only]

# Dependency graph
requires:
  - phase: 39-registry-coverage-memory-strip
    plan: 39-01
    provides: "api.charityCorrections.append (requireOperator + audit) and api.charityCorrections.listByCharityKey (unguarded, createdAt asc) on the charity_corrections Convex table"
provides:
  - "Per-charity 'Add correction' affordance + chronological read-only corrections list in the Registry, extending RegistryTable.tsx via row expansion"
  - "AddCorrectionDialog.tsx — append-only correction form keyed by the row's existing dedupKey (no client-side key re-derivation)"
  - "CorrectionsList.tsx — chronological (createdAt asc), read-only corrections log with loading/empty states"
affects: [39-04, 39-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Row-expansion detail panel in a table (React.Fragment-per-row + a colSpan detail <tr>) instead of a new page or modal"
    - "Client component disables its own form (rather than fabricating a key) when a required identity field is legacy-missing"

key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/registry/_components/AddCorrectionDialog.tsx
    - apps/dispatch-control/app/(dashboard)/registry/_components/CorrectionsList.tsx
    - apps/dispatch-control/__tests__/AddCorrectionDialog.test.tsx
    - apps/dispatch-control/__tests__/CorrectionsList.test.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx

key-decisions:
  - "charity.dedupKey is passed straight through as charityKey — never re-derived client-side, matching 39-01's Pitfall 5 guidance"
  - "Legacy charities without a dedupKey get a disabled form + explanatory note rather than a fabricated key or a crash"
  - "Row expansion (React.Fragment + a colSpan=6 detail <tr>) reuses the existing RegistryTable surface per D-07, instead of a new page or a modal dialog"

patterns-established:
  - "Table row-expansion detail pattern: Fragment-keyed row pairs (primary <tr> + conditional detail <tr colSpan={N}>) toggled by a single expandedId state var"

requirements-completed: [MEM-02]

# Metrics
duration: ~10min
completed: 2026-07-10
---

# Phase 39 Plan 03: Corrections Registry UI Summary

**Per-charity append-only corrections log surfaced via RegistryTable row expansion — an "Add correction" form (`AddCorrectionDialog.tsx`) keyed by the row's existing `dedupKey` and a chronological read-only list (`CorrectionsList.tsx`), both calling 39-01's `charityCorrections` Convex functions directly.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 3 completed
- **Files modified/created:** 5 (2 created components, 2 created test files, 1 modified table)

## Accomplishments
- `AddCorrectionDialog.tsx` — a textarea + submit form calling `useMutation(api.charityCorrections.append)` with `{ workspace_id, charityKey: charity.dedupKey, sanityCharityId: charity.sanityCharityId, text }`; guards empty/whitespace text, disables while pending, surfaces an error message on failure, clears the field on success. Legacy charities with no `dedupKey` get a disabled state with an explanatory note instead of a crash or a fabricated key.
- `CorrectionsList.tsx` — `useQuery(api.charityCorrections.listByCharityKey, ...)` rendered as a chronological (createdAt-ascending, not reversed) read-only list; honest loading (`"Loading corrections…"`) and empty (`"No corrections yet."`) states; no edit/delete/remove control anywhere.
- `RegistryTable.tsx` extended with an `expandedCharityId` toggle in the Actions cell ("Add correction" / "Hide corrections") that mounts both new components in a `colSpan={6}` detail row beneath the toggled charity's row — all existing blocklist/filter behavior preserved byte-for-byte.
- MEM-02 satisfied: the operator can append a guarded, audit-logged correction and see the full chronological log per charity, directly in the Registry surface.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing tests for AddCorrectionDialog + CorrectionsList** - `c9c03e3` (test)
2. **Task 2 (GREEN): AddCorrectionDialog + CorrectionsList components** - `bfa9c30` (feat)
3. **Task 3: wire row expansion into RegistryTable + strict build** - `c3a4c4a` (feat)

**Plan metadata:** (this commit) — docs: complete plan

_Task 1 is a TDD task; RED (Task 1, `c9c03e3`) confirmed both test files failed with "Cannot find module" before GREEN (Task 2, `bfa9c30`) made them pass._

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/registry/_components/AddCorrectionDialog.tsx` - Append-only correction form, dedupKey passthrough, legacy-row disable state
- `apps/dispatch-control/app/(dashboard)/registry/_components/CorrectionsList.tsx` - Chronological read-only corrections log with loading/empty states
- `apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx` - Row-expansion wiring (`expandedCharityId` state, Fragment-keyed row pairs, toggle button)
- `apps/dispatch-control/__tests__/AddCorrectionDialog.test.tsx` - Append-call-shape + empty-text + legacy-row-disable tests
- `apps/dispatch-control/__tests__/CorrectionsList.test.tsx` - Chronological-order + loading/empty + read-only tests

## Decisions Made
- Followed the plan's exact prop shapes and call signatures verbatim — `charityKey: charity.dedupKey` is a literal passthrough, never re-derived, per 39-01's Pitfall 5 and the plan's explicit interface note.
- Used `React.Fragment` (imported as `Fragment`) keyed per charity row to return a sibling pair of `<tr>` elements (the primary row + an optional detail row) from a single `.map()` iteration, rather than a separate state-driven modal or a new route — matches D-07's "reuse the existing Registry surface" instruction.
- Legacy charities lacking a `dedupKey` (pre-dedup-key rows) render a disabled note in `AddCorrectionDialog` instead of either crashing or fabricating a key client-side — an explicit defensive choice called out in the plan (Pitfall 5 / legacy note).

## Deviations from Plan

None - plan executed exactly as written. All acceptance-criteria greps, the RED→GREEN cycle, the strict `pnpm --filter dispatch-control build`, and the full vitest suite all passed on the first attempt with no auto-fixes required.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `AddCorrectionDialog.tsx` and `CorrectionsList.tsx` are self-contained and require no further wiring for MEM-02 itself.
- 39-04 (Researcher corrections read) can proceed independently — it reads the same `charityCorrections.listByCharityKey` Convex function from the pipeline side, not from this UI.
- 39-05 (coverage-strip UI) is unaffected by this plan's changes to `RegistryTable.tsx` (the coverage strip mounts separately on `registry/page.tsx`, per 39-CONTEXT D-01).
- No blockers.

---
*Phase: 39-registry-coverage-memory-strip*
*Completed: 2026-07-10*

## Self-Check: PASSED

All created/modified files verified present; all 3 task commit hashes (`c9c03e3`, `bfa9c30`, `c3a4c4a`) verified present in `git log --oneline --all`.
