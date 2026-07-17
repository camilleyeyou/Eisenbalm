---
phase: 50-workbench-nomenclature
plan: 05
subsystem: ui
tags: [nextjs, fastapi, clerk, convex, run-monitor, prompt-lab, honesty-matrix]

# Dependency graph
requires:
  - phase: 50-02
    provides: "lib/nomenclature.ts's runStepFor()/RUN_STEP_MAP (§7 action-name map) + pipelineTopology.ts's PIPELINE_NODES/GATE_KEYS — the 20-node topology + §7 step-state vocabulary RecoveryRail groups steps against"
  - phase: 50-04
    provides: "InspectorFooter.tsx's promptKey/sectionName/excerpt origin-param wiring and lib/inspectorArtifact.ts's runKeyToPromptKey resolver — reused verbatim by RecoveryRail's Improve-this-agent link"
  - phase: 37-run-monitor-v2-signal-desk
    provides: "the adjudicate bridge pattern (_require_clerk_jwt_control, _resume_paused_run) mirrored by the new publish-manual bridge; Signal Desk's adjudication surface, linked to for the paused-Gate-1 restart case"
  - phase: 49-roles-permissions
    provides: "_require_editor / the six-action editor gate precedent extended to a 7th action; the role-gate source-scan tripwire pattern updated in this plan"
provides:
  - "POST /issues/{run_id}/publish-manual — Editor-in-chief Clerk-guarded bridge re-invoking _run_publisher (docs/API_CONTRACTS.md §50.1)"
  - "RecoveryRail.tsx — the failed-run 4-part plain-language recovery rail, mounted in RunDetail.tsx"
  - "lib/nomenclature.ts::restartAvailabilityFor — the single 'Restart from this step' honesty-matrix source of truth (3-of-11 LIVE / 8-of-11 RESERVED), consumed by both RecoveryRail and InspectorFooter"
  - "lib/pipelineControlClient.ts::publishManual — the client wrapper for the new bridge"
  - "InspectorFooter.tsx's 'Restart from this step' upgraded from blanket-reserved to the same honesty matrix"
affects: [run-monitor, prompt-lab, inspector, api-contracts]

tech-stack:
  added: []
  patterns:
    - "Restart-honesty matrix as a single pure function (restartAvailabilityFor) consumed by two independent UI surfaces (RecoveryRail, InspectorFooter) rather than duplicated per-component logic"
    - "Editor-only Clerk bridge mirroring an existing trigger-secret-guarded server-to-server endpoint (publish-manual mirrors manual_publish, same pattern as adjudicate mirroring resume)"

key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RecoveryRail.tsx
    - apps/dispatch-control/__tests__/RecoveryRail.test.tsx
    - apps/dispatch-control/__tests__/InspectorFooter.test.tsx
    - packages/pipeline/tests/test_publish_bridge.py
  modified:
    - docs/API_CONTRACTS.md
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx
    - apps/dispatch-control/components/inspector/InspectorFooter.tsx
    - apps/dispatch-control/lib/nomenclature.ts
    - apps/dispatch-control/lib/pipelineControlClient.ts
    - apps/dispatch-control/__tests__/roleGateInventory.test.ts
    - apps/dispatch-control/__tests__/InspectorPanel.test.tsx
    - apps/dispatch-control/__tests__/promptVersionOrigin.test.ts

key-decisions:
  - "The Publisher-restart bridge (POST /issues/{run_id}/publish-manual) is Editor-in-chief gated via _require_editor, not the weaker _require_clerk_jwt_control adjudicate uses — Publisher does irreversible real work (PDF + Vercel deploy + Sanity publish), matching the other six §49.4 editor-only actions."
  - "editor_gate_1's 'Restart from this step' is LIVE only when the caller explicitly asserts isPausedAtGate1=true (never inferred by the component) — a failed run and a paused run are mutually exclusive states, so RecoveryRail (mounted only on run.status==='failed') always passes false; InspectorFooter has no run-status signal at all and always resolves editor_gate_1 to RESERVED."
  - "The 'completed steps are reused, not re-paid' claim was rewritten out of the RESERVED-branch copy in both RecoveryRail and InspectorFooter (the old Phase-44 RESTART_TITLE embedded that phrase even while blanket-reserved) — it now appears ONLY inside the 3 LIVE branches, per the plan's must-have."
  - "RecoveryRail's editor_gate_1-paused LIVE action links to /signal-desk (the real adjudication picker) rather than re-implementing a charity-selection UI inline."

requirements-completed: [WBN-03]

duration: 33min
completed: 2026-07-16
---

# Phase 50 Plan 05: Failed-Run Recovery Rail & Honest Restart Summary

**A 4-part plain-language failed-run recovery rail with a genuinely 3-of-11 honest "Restart from this step" (writers, Gate-1 pause, and a new Editor-gated Publisher-restart bridge), reused verbatim by both RunDetail and the inspector footer.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-07-16T19:20:39-07:00 (context read start)
- **Completed:** 2026-07-16T19:54:48-07:00
- **Tasks:** 3
- **Files modified:** 13 (4 created, 9 modified)

## Accomplishments

- Contract-first: `docs/API_CONTRACTS.md` §50.1 documents `POST /issues/{run_id}/publish-manual` before it existed in code, then `api/control.py::publish_manual` implements it — an Editor-in-chief Clerk-guarded sibling of the trigger-secret-guarded `manual_publish` (WHK-08), re-invoking the same `_run_publisher` coroutine and audit-logging before scheduling.
- `RecoveryRail.tsx` renders the exact §7 failed-run explanation — what happened (vermilion) / what completed successfully / what did not happen (downstream steps dimmed, labeled "Skipped", never blank) / recommended recovery — mounted in `RunDetail.tsx` whenever `run.status === 'failed'`.
- The "Restart from this step" honesty matrix (`lib/nomenclature.ts::restartAvailabilityFor`) is now a single pure function: LIVE for exactly 3 of the 11 §7 step-types (the 7 section writers via `rerollAgent`, `editor_gate_1` only when genuinely paused at the Gate-1 interrupt, `publisher` via the new bridge); RESERVED with an honest, no-reuse-claim explanation for the other 8. Both `RecoveryRail.tsx` and `InspectorFooter.tsx` consume the SAME function, so the two surfaces can never drift.
- `InspectorFooter.tsx`'s "Restart from this step" — Phase-44's Always-RESERVED-for-all-artifact-types posture — is upgraded to the same matrix, performing a real mutation (confirm → `rerollAgent`/`publishManual`) for the 3 live step-types it can see, while keeping the 50-04 "Improve this agent →" origin-param wiring intact.

## Task Commits

1. **Task 1: Add the Clerk-guarded Publisher-restart bridge (contract-first)** - `b7f7373` (docs) + `fb45299` (feat)
2. **Task 2: Build the RecoveryRail + wire into failed RunDetail** - `d81e3dc` (feat)
3. **Task 3: Upgrade InspectorFooter Restart to per-step honesty** - `def714ae` (feat)

_No TDD tasks this plan — all three were `type="auto"`._

## Files Created/Modified

- `docs/API_CONTRACTS.md` - §50.1 (new endpoint contract) + a §49.4 addendum documenting the 7th editor-gated action
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` - `publish_manual` endpoint (`POST /issues/{run_id}/publish-manual`)
- `packages/pipeline/tests/test_publish_bridge.py` - 6 tests: 401/403 auth, editor invokes publisher + audits, 404, sentinel regression, no-trigger-secret source guard
- `apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RecoveryRail.tsx` - the 4-part recovery rail component
- `apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx` - mounts `RecoveryRail` when `run.status === 'failed'`
- `apps/dispatch-control/__tests__/RecoveryRail.test.tsx` - 13 tests: 4 sections, Skipped dimming, the pure honesty-matrix enumeration, per-step Restart/Improve DOM checks
- `apps/dispatch-control/lib/nomenclature.ts` - `restartAvailabilityFor`/`RESTART_LIVE_WRITER_KEYS` (the honesty-matrix source of truth)
- `apps/dispatch-control/lib/pipelineControlClient.ts` - `publishManual` client wrapper
- `apps/dispatch-control/components/inspector/InspectorFooter.tsx` - `RestartFooterAction` replacing the blanket-reserved control
- `apps/dispatch-control/__tests__/InspectorFooter.test.tsx` - 6 tests: LIVE writer/publisher invoking real client calls, RESERVED qa/editor_gate_1, origin-param regression
- `apps/dispatch-control/__tests__/roleGateInventory.test.ts` - updated ROL-02 tripwire from 3 to 4 FastAPI editor-gated files
- `apps/dispatch-control/__tests__/InspectorPanel.test.tsx` - Clerk/pipelineControlClient mocks added; the outdated "disabled for all artifact types" Restart test split into RESERVED (qa) + LIVE (default writer) cases
- `apps/dispatch-control/__tests__/promptVersionOrigin.test.ts` - Clerk/pipelineControlClient mocks added (InspectorFooter now calls `useAuth()` unconditionally)

## Decisions Made

- Publisher-restart bridge gated by `_require_editor` (Editor-in-chief), not the weaker `_require_clerk_jwt_control` — matches Publisher's irreversible real-world consequences, consistent with §49.4's other five editor-only actions.
- `editor_gate_1`'s paused-case honesty is an explicit, caller-supplied boolean (`isPausedAtGate1`), never inferred — keeps the matrix testable in isolation and prevents either surface from silently guessing at a live/paused state it can't actually observe.
- The "reused, not re-paid" reuse claim was removed from both components' RESERVED-branch copy (it had leaked into the old Phase-44 blanket-RESERVED title) so it appears only where a real primitive backs it, per the plan's must-have.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] roleGateInventory.test.ts tripwire broke after adding the 4th `_require_editor` call site**
- **Found during:** Task 2 (after Task 1 added `control.py`'s `Depends(_require_editor)`)
- **Issue:** Phase 49's `roleGateInventory.test.ts` source-scan tripwire asserted EXACTLY 3 FastAPI files use `Depends(_require_editor)`; adding the Publisher-restart bridge (Task 1) legitimately makes it 4.
- **Fix:** Updated `EXPECTED_FASTAPI_EDITOR_FILES` to include `control.py`, updated the count/docstring, and added a `§49.4` addendum in `docs/API_CONTRACTS.md` documenting the 7th gated action — per the test's own docstring instruction ("update §49.4 first, contract-first").
- **Files modified:** `apps/dispatch-control/__tests__/roleGateInventory.test.ts`, `docs/API_CONTRACTS.md`
- **Verification:** `pnpm --filter dispatch-control test -- --run roleGateInventory` green (4 tests).
- **Committed in:** `d81e3dc` (Task 2 commit)

**2. [Rule 1 - Bug] InspectorFooter's new unconditional `useAuth()` call broke two pre-existing test files**
- **Found during:** Task 3 (full-suite run after wiring `RestartFooterAction`)
- **Issue:** `RestartFooterAction` calls `useAuth()` on every render (Rules of Hooks — must be unconditional). `InspectorPanel.test.tsx` and `promptVersionOrigin.test.ts` render `InspectorFooter`/`InspectorPanel` without mocking `@clerk/nextjs`, crashing both suites (14 failing tests).
- **Fix:** Added the same `@clerk/nextjs`/`@/lib/pipelineControlClient` mocks used elsewhere in the suite (e.g. `DecisionRail.test.tsx`) to both files.
- **Files modified:** `apps/dispatch-control/__tests__/InspectorPanel.test.tsx`, `apps/dispatch-control/__tests__/promptVersionOrigin.test.ts`
- **Verification:** `pnpm --filter dispatch-control test -- --run` — 1023 passed, 0 failed.
- **Committed in:** `def714ae` (Task 3 commit)

**3. [Rule 1 - Bug] InspectorPanel.test.tsx's "Restart from this step is disabled for all artifact types" test contradicted this plan's own goal**
- **Found during:** Task 3
- **Issue:** That test rendered `makeProps()`'s default `agentKey: 'founder_bio'` (one of the 7 LIVE writer keys) and asserted the button was disabled — a premise this plan deliberately invalidates.
- **Fix:** Split into two tests: RESERVED with an explicit `agentKey: 'qa'` override, and a new LIVE assertion using the default `founder_bio` props (proving `InspectorPanel`'s wiring didn't regress in either direction).
- **Files modified:** `apps/dispatch-control/__tests__/InspectorPanel.test.tsx`
- **Verification:** Included in the same full-suite run above.
- **Committed in:** `def714ae` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs surfaced by the plan's own scope change)
**Impact on plan:** All three were direct, necessary consequences of the plan's intended changes (a 7th editor-gated action; a footer action that now performs real mutations). No scope creep — no unrelated files touched.

## Issues Encountered

- jest-dom's `toBeDisabled`/`toBeTruthy`-style matchers are not extended in this project's vitest setup (`Invalid Chai property: toBeDisabled`) — used `.disabled` property assertions directly (`(btn as HTMLButtonElement).disabled`), matching the existing `LockedControl.test.tsx` convention.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `docs/API_CONTRACTS.md` §50.1 and the `roleGateInventory` tripwire are both up to date for any future phase that audits Editor-in-chief-gated actions.
- The `restartAvailabilityFor` honesty matrix is now the canonical place to extend if a 4th step-type ever gains a real reuse primitive — both consuming surfaces (RecoveryRail, InspectorFooter) update automatically.
- Full dispatch-control suite (1023 passed) and pipeline pytest (698 passed) both green; `pnpm --filter dispatch-control build` exits 0.
- No blockers for the remaining Phase 50 plans (50-06 nomenclature sweep / phase gate).

---
*Phase: 50-workbench-nomenclature*
*Completed: 2026-07-16*

## Self-Check: PASSED

All 13 claimed files found on disk; all 4 task commit hashes (`b7f7373`, `fb45299`, `d81e3dc`, `def714ae`) found in git history.
