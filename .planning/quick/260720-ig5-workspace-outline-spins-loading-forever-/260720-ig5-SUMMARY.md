---
phase: quick-260720-ig5
plan: 01
subsystem: ui
tags: [react, nextjs, vitest, dispatch-control, workspace-outline]

# Dependency graph
requires:
  - phase: quick-260719-w6o
    provides: "The Approval panel's 'Paused at the story decision' honest state for a run with no content"
provides:
  - "draftContentAbsent: boolean signal on WorkspaceStateValue (WorkspaceStateProvider)"
  - "A dedicated outline-empty state in WorkspaceOutline for definitively-contentless runs"
affects: [issue-workspace, workspace-outline, workspace-state-provider]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-way async-resource UI state (loading / loaded-with-data / loaded-and-definitively-empty) exposed as a dedicated boolean signal rather than overloading the existing undefined-derived-data check"

key-files:
  created:
    - apps/dispatch-control/__tests__/WorkspaceOutlineEmptyState.test.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceOutline.tsx

key-decisions:
  - "Option A (distinct draftContentAbsent signal) chosen over deriving an empty sectionStates map, to avoid producing a misleading wall of 'not generated' rows for a run that never got past Gate 1 (see PLAN.md design_decision)"
  - "Stabilized the test's mocked useAuth().getToken() to a module-scoped reference (diverges from WorkspaceLayout.test.tsx's per-call vi.fn()) after discovering the unstable mock caused the provider's draft-fetch effect to re-fire on every render and flap draftContentAbsent between renders — a test-harness bug, not a fix defect. Real Clerk's getToken is referentially stable."

patterns-established:
  - "When adding a definitive-negative-outcome signal alongside an existing loading-boolean pattern, reset the new signal explicitly at both the guard-clause return and the top of every live fetch to prevent state leaking across resource-id changes (here: runId)."

requirements-completed: [OUTLINE-CONTENTLESS-EMPTY-STATE]

# Metrics
duration: ~25min
completed: 2026-07-21
---

# Quick 260720-ig5: Workspace Outline Contentless Empty State Summary

**Added a `draftContentAbsent` provider signal + dedicated `outline-empty` UI state so a paused-at-Gate-1/contentless run's outline sidebar resolves to an honest empty message instead of spinning "Loading outline…" forever.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments

- `WorkspaceStateProvider` now distinguishes THREE draft-fetch outcomes instead of two: still loading, loaded-with-content, and definitively contentless (`ContentPatchError` with `reason === 'no_sanity_issue'`, a 409).
- New `draftContentAbsent: boolean` on `WorkspaceStateValue`, set true ONLY on that exact reason/status combination; false while loading, on success, and on every other error (network blip, generic `Error`, any other `ContentPatchError` reason) — preserving the pre-existing WSP-07 transient-failure guard.
- `WorkspaceOutline` renders a new `outline-empty` state ("No sections yet — this run paused before generating content.") ahead of the existing `outline-loading` branch, so the two states are mutually exclusive and correctly prioritized.
- Design comments in both files rewritten to document the new three-way behavior (previously asserted a stale two-way "undefined on load-or-fail" model).
- Fixed a genuine test-harness flake discovered while writing the RED-gated regression test (see Deviations below).

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — regression proving the contentless outline resolves to an empty state** - `1db8031` (test)
2. **Task 2: GREEN — draftContentAbsent provider signal + dedicated outline empty state** - `ac3b5aa` (fix)

_Note: Task 2's commit also includes the test-harness stabilization fix (Deviation 1 below) since it was required to make the GREEN gate observably pass; it does not touch WorkspaceStateProvider.tsx or WorkspaceOutline.tsx's production logic._

## Files Created/Modified

- `apps/dispatch-control/__tests__/WorkspaceOutlineEmptyState.test.tsx` - New RED-gated regression: renders the REAL `WorkspaceStateProvider` + `IssueWorkspaceLayout` (mirrors `WorkspaceLayout.test.tsx`'s mock harness) with a per-test-controllable `getDraft` mock; asserts the no_sanity_issue → outline-empty case, the two transient-guard cases (different reason / generic Error → outline-loading), and the happy path (content → real outline row)
- `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx` - Added `draftContentAbsent` state + `WorkspaceStateValue` field, scoped strictly to `ContentPatchError.reason === 'no_sanity_issue'`, reset at the guard clause and the top of every live fetch; rewrote the design-comment block and `sectionStates` doc comment to describe the three-way behavior
- `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceOutline.tsx` - Destructured `draftContentAbsent` from `useWorkspaceState()`; added the `outline-empty` branch checked before the `outline-loading` branch; updated the header comment

## Decisions Made

- Followed the plan's `design_decision` verbatim: a distinct `draftContentAbsent` boolean (Option A) rather than deriving an empty `sectionStates` map (Option B), because Option B would have produced nine misleading "not generated" rows indistinguishable from a real attempted-and-skipped state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test-harness flake from an unstable `useAuth().getToken()` mock reference**

- **Found during:** Task 2 verification (the GREEN gate's `no_sanity_issue → outline-empty` assertion intermittently failed with `outline-loading` still present in the DOM)
- **Issue:** The test's `@clerk/nextjs` mock (mirrored verbatim from `WorkspaceLayout.test.tsx`) created a brand-new `vi.fn()` `getToken` reference on every `useAuth()` call. `WorkspaceStateProvider`'s draft-fetch `useEffect` depends on `[runId, getToken]`, so the unstable reference re-fired the effect on every render. Each re-fire synchronously reset `draftContentAbsent` to `false` (the plan-required "reset at the start of every live fetch" logic) before its async `catch` set it back to `true`, producing a brief but real render where `outline-loading` and `outline-empty` alternated. `WorkspaceLayout.test.tsx` never surfaces this because its `getDraft` mock always resolves the same content — the resulting effect re-fires are idempotent no-ops there, so the instability is invisible in that file. Confirmed via a scoped rerun (`vitest -t "resolves to the honest"`) that the flapping DOM state, not a signal-derivation bug, was the root cause: the provider's fix logic (`e instanceof ContentPatchError && e.reason === 'no_sanity_issue'`) was already correct.
- **Fix:** Stabilized the test's `getToken` mock to a module-scoped `vi.fn()` reference shared across every `useAuth()` call, matching real Clerk's referentially-stable `getToken`. No production code (`WorkspaceStateProvider.tsx`/`WorkspaceOutline.tsx`) was changed for this.
- **Files modified:** `apps/dispatch-control/__tests__/WorkspaceOutlineEmptyState.test.tsx`
- **Verification:** Full `WorkspaceOutlineEmptyState.test.tsx` suite green (4/4) on repeated runs; full `pnpm --filter dispatch-control test` green (1052 passed, 2 todo, 1 skipped); `pnpm --filter dispatch-control build` exit 0.
- **Committed in:** `ac3b5aa` (part of the Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug fix, test-only)
**Impact on plan:** No scope creep. The fix is confined to the test file's mock setup and does not alter the plan's specified production-code behavior in `WorkspaceStateProvider.tsx` or `WorkspaceOutline.tsx`.

## Issues Encountered

None beyond the deviation documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Issue Workspace outline sidebar now matches the Approval panel's existing honest "Paused at the story decision" messaging for the same contentless-run case (quick 260719-w6o) — no further follow-up required for this specific inconsistency.
- `draftContentAbsent` is available on `useWorkspaceState()` for any future consumer that needs to distinguish a definitively-contentless run from a still-loading one.

---
*Phase: quick-260720-ig5*
*Completed: 2026-07-21*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/__tests__/WorkspaceOutlineEmptyState.test.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceOutline.tsx
- FOUND: .planning/quick/260720-ig5-workspace-outline-spins-loading-forever-/260720-ig5-SUMMARY.md
- FOUND: .planning/quick/260720-ig5-workspace-outline-spins-loading-forever-/260720-ig5-PLAN.md
- FOUND commit: 1db8031 (test — RED)
- FOUND commit: ac3b5aa (fix — GREEN)
