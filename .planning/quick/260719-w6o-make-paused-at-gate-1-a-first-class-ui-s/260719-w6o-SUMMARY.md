---
phase: quick-260719-w6o
plan: 01
subsystem: ui
tags: [dispatch-control, fastapi, convex-derived-state, run-monitor, story-brief, approval, recovery]

# Dependency graph
requires:
  - phase: quick-260718-51o
    provides: "the failed-run-terminal-state guard pattern (deriveTasks/deriveStageStates/Approval FailedRunPanel/RecoveryRail) this plan mirrors for the paused-at-Gate-1 shape"
provides:
  - "isPausedAtGate1(i) exported predicate in apps/dispatch-control/lib/derivedState.ts, shared by deriveStoryStage and deriveTasks"
  - "409 no_sanity_issue guard on POST /issues/{run_id}/sign-off covering both failed and paused-at-Gate-1 runs"
  - "PausedAtGate1Panel on the Approval route for a run paused at Gate 1"
  - "killed/killReason rendering on OrgOptionSlate and NeedsYourDecisionCard"
  - "reachable RecoveryRail /signal-desk recovery affordance for a genuinely paused run, mounted by RunDetail"
affects: [run-monitor, story-brief, approval, signoffs-endpoint, my-tasks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "shared boolean predicate exported from a pure selector module, reused by both the derived-state layer and (as an inline mirror against a differently-shaped run object) server components / RunDetail, rather than a cross-boundary helper"
    - "server-side content guard mirrored verbatim from an existing sibling guard (content.py::_resolve_sanity_id -> signoffs.py) to close the same defect class at a second call site"

key-files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py
    - packages/pipeline/tests/test_signoffs_endpoints.py
    - apps/dispatch-control/lib/derivedState.ts
    - apps/dispatch-control/__tests__/derivedState.test.ts
    - "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/page.tsx"
    - "apps/dispatch-control/app/(dashboard)/story-brief/_components/OrgOptionSlate.tsx"
    - "apps/dispatch-control/app/(dashboard)/story-brief/_components/NeedsYourDecisionCard.tsx"
    - apps/dispatch-control/__tests__/OrgOptions.test.tsx
    - apps/dispatch-control/__tests__/NeedsYourDecision.test.tsx
    - "apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx"
    - "apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RecoveryRail.tsx"
    - apps/dispatch-control/__tests__/RecoveryRail.test.tsx

key-decisions:
  - "Reused the existing no_sanity_issue reason (not a new one) for the sign-off guard, matching content.py/review.py's established contentless-run contract."
  - "isPausedAtGate1 lives once in derivedState.ts (DerivationInputs consumer); approval/page.tsx and RunDetail.tsx compute the same shape inline against their own run objects rather than importing a shared helper across the server/client boundary — deliberate, called out in the plan's scope_notes."
  - "RecoveryRail's paused branch is nested inside the existing `if (!failedAgentKey)` guard so a run with a real failed agent row (including the file's own artificial editor_gate_1 failed-row test) is completely unaffected."

requirements-completed: [PAUSED-GATE1-FIRST-CLASS]

# Metrics
duration: 9min
completed: 2026-07-19
---

# Quick Task 260719-w6o: Make paused-at-Gate-1 a first-class UI state Summary

**Closed the third incarnation of "a run masquerades as reviewable": a run paused at the Gate-1 interrupt now gets an honest My Tasks entry, an honest Approval panel, killed-candidate labeling on both org pickers, a reachable Run Monitor recovery affordance, and a server-side 409 that closes the sign-off hole for both failed AND paused runs.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-20T06:21:58Z
- **Completed:** 2026-07-20T06:30:49Z
- **Tasks:** 4
- **Files modified:** 11 (2 pipeline, 9 dispatch-control)

## Accomplishments
- `POST /issues/{run_id}/sign-off` now 409s `{reason:"no_sanity_issue"}` for ANY run lacking `sanityIssueId` (failed-early or paused-at-Gate-1), closing the exact hole the 2026-07-18 production incident exploited — every pre-existing sign-off test stays green (proving no over-gating of a genuinely reviewable run).
- Exported a single `isPausedAtGate1(i)` predicate in `derivedState.ts`, reused by `deriveStoryStage` (no behavior change there) and consumed by `deriveTasks`, which now emits exactly ONE "Choose the charity to continue" task for a paused run instead of two false "Must fix" sign-off tasks pointing at a dead Approval screen.
- The Approval route (`/issues/{n}/approval`) for a paused run now renders a `PausedAtGate1Panel` (linking to the Story stage and Signal Desk) instead of falling through to `DecisionRail`'s misleading "clear to publish" screen.
- `OrgOptionSlate` and `NeedsYourDecisionCard` now render a killed verification candidate AS killed, surfacing its `killReason` instead of silently showing "No concern flagged." / "—" as if nothing were wrong.
- `RecoveryRail` gained a nested paused branch (inside the existing `!failedAgentKey` guard) with real copy and a working `/signal-desk` restart link; `RunDetail` now computes `isPausedAtGate1` from the `runs` table and mounts `RecoveryRail` for a genuinely paused run — unhardcoding the dead `nomenclature.ts` `editor_gate_1` 'live' branch in the shipped app for the first time.

## Task Commits

Each task was committed atomically (RED test written and confirmed failing before every implementation edit, per the plan's critical reminders):

1. **Task 1: Harden the sign-off endpoint — 409 no_sanity_issue for contentless runs** - `3516ca3` (fix)
2. **Task 2: Shared isPausedAtGate1 predicate + paused-aware My Tasks** - `fe5263a` (fix)
3. **Task 3: Honest story-decision surfaces — Approval paused panel + killed/killReason** - `87c4f42` (fix)
4. **Task 4: Reachable Run Monitor recovery for a paused run** - `97d0be9` (fix)

_Note: this plan's `type="auto" tdd="true"` tasks each carry a single implementation commit, not separate RED/GREEN commits — the RED confirmation was run and observed pre-commit for every task, per the plan's tdd instructions and critical reminder #1, but only the passing GREEN state was committed._

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py` - added the `no_sanity_issue` 409 guard, mirrored from `content.py::_resolve_sanity_id`
- `packages/pipeline/tests/test_signoffs_endpoints.py` - added `test_sign_off_409_no_sanity_issue`
- `apps/dispatch-control/lib/derivedState.ts` - exported `isPausedAtGate1`; `deriveStoryStage` reuses it; `deriveTasks` emits one gate-1 task instead of two false sign-off tasks
- `apps/dispatch-control/__tests__/derivedState.test.ts` - added the `isPausedAtGate1` unit tests, the paused-run `deriveTasks` test, and the genuinely-reviewable regression guard
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/page.tsx` - added `PausedAtGate1Panel` + the `awaiting-review && completedAt==null` branch, mounted before `ApprovalStage`
- `apps/dispatch-control/app/(dashboard)/story-brief/_components/OrgOptionSlate.tsx` - added the killed banner + killReason-preferring Main concern
- `apps/dispatch-control/app/(dashboard)/story-brief/_components/NeedsYourDecisionCard.tsx` - added `killed?`/`killReason?` to the local `VerificationRecordRow` type; Risk cell now prefers the kill reason
- `apps/dispatch-control/__tests__/OrgOptions.test.tsx` / `__tests__/NeedsYourDecision.test.tsx` - added killed-candidate RED->GREEN tests
- `apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RecoveryRail.tsx` - nested a paused-at-Gate-1 branch inside `!failedAgentKey`, reusing `RestartAction`'s `editor_gate_1` LIVE branch
- `apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx` - computed `isPausedAtGate1` from the `runs` row and mounted a second `RecoveryRail` for a paused run
- `apps/dispatch-control/__tests__/RecoveryRail.test.tsx` - added the empty-`agentRuns`-paused RED->GREEN test

## Decisions Made
- Reused the `no_sanity_issue` reason rather than inventing a new one — matches the codebase's established contentless-run contract (`review.py:82/196`, `content.py:69`), so no new error-vocabulary needs to be plumbed through the dashboard's clients.
- `isPausedAtGate1` is exported once from `derivedState.ts` for `DerivationInputs` consumers; `approval/page.tsx` and `RunDetail.tsx` compute the identical boolean shape inline against their own run-row objects (server component / `runs`-table row) rather than importing a cross-module helper — this is the plan's explicit scope note, not accidental duplication.
- `RecoveryRail`'s paused branch is nested INSIDE the existing `if (!failedAgentKey)` block (not a sibling branch before it) specifically so the file's own pre-existing artificial-failed-`editor_gate_1`-row test (line 204) is left completely untouched.

## Deviations from Plan

None — plan executed exactly as written. All 4 tasks matched their specified file lists, RED gates, and implementation shapes verbatim (including the interfaces block's exact code snippets for the guard, the predicate, the panels, and the recovery branch).

## Issues Encountered
- The first draft of the RecoveryRail paused-branch test used `screen.getByText(/paused/i)`, which matched two elements (the section heading "Paused for your decision" AND the body copy containing "paused") and threw a multiple-elements error. Fixed by asserting the exact heading text `'Paused for your decision'` instead of a loose regex — a test-only correction, no production code affected.

## User Setup Required

None for the frontend changes (no external service configuration).

**The Task 1 pipeline change (signoffs.py) requires a Railway deploy to take effect in production** — the 409 guard is code-complete and pytest-verified locally, but the live Railway pipeline service will keep 200'ing `sounds-human`/`facts-cleared` against contentless runs until deployed. No Convex sync is needed (no `convex/*.ts` files were touched by this plan).

## Next Phase Readiness
- All 4 must-have truths verified: the server guard 409s for both failed and paused runs while leaving every existing sign-off test green; My Tasks shows exactly one task for a paused run; Approval never mounts DecisionRail for a paused run; both org pickers show killed candidates honestly; RunDetail mounts a reachable RecoveryRail with a working `/signal-desk` link.
- Manual verification against a live paused run (e.g. `b106e87a` or the current one) and a post-deploy 409 check on the sign-off endpoint remain the two verification steps a human still needs to perform in production — code-complete and test-verified locally, not yet observed live.
- No two-sign-off gate, `verify_candidates`, or `convex/*.ts` code was touched, per the plan's explicit scope boundary.

---
*Phase: quick-260719-w6o*
*Completed: 2026-07-19*

## Self-Check: PASSED

All 12 modified/created source and test files verified present on disk; all 4 task commit hashes (3516ca3, fe5263a, 87c4f42, 97d0be9) verified present in git history.
