---
phase: 48-brief-entry-point
plan: 01
subsystem: api
tags: [contracts, convex, langgraph, dispatchstate, brief-entry]

# Dependency graph
requires:
  - phase: 47-story-brief-stage
    provides: "The Brief TypedDict (6 fields) + briefs Convex table this entry point's human input maps to"
  - phase: 46-signal-editor-candidate-verification
    provides: "verify_candidates node + VerificationRecord shape this phase invokes on a human-supplied org"
provides:
  - "docs/API_CONTRACTS.md §7 amendment (entry_mode + source_material DispatchState fields)"
  - "docs/API_CONTRACTS.md new §48 (POST /pipeline/run/brief contract, _start_run brief-seed shape, reduced agentRuns:queueForRun set, runs.entryMode Convex field)"
  - "graph/state.py DispatchState.entry_mode + DispatchState.source_material fields"
  - "convex/schema.ts runs.entryMode additive field"
  - "convex/runs.ts::create entryMode arg, live-synced to dev:modest-magpie-797"
affects: [48-02-wave0-test-scaffolds, 48-03-pipeline-entry-seam, 48-04-brief-trigger-endpoint, 48-05-create-panel-brief-path, 48-06-stage1-brief-mode-render, 48-07-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contract-first gate: cross-boundary shapes documented in API_CONTRACTS.md before any producer/consumer code touches them (CLAUDE.md hard rule)"
    - "NotRequired/Optional DispatchState field addition mirroring the existing `config` field precedent for pre-phase test-fixture back-compat"
    - "Convex schema field addition + live-sync as a discrete, verifiable plan step (not assumed to happen via commit alone)"

key-files:
  created: []
  modified:
    - docs/API_CONTRACTS.md
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py
    - convex/schema.ts
    - convex/runs.ts

key-decisions:
  - "entry_mode/source_material placed alongside the Phase 47 brief field (both in API_CONTRACTS.md §7 and state.py) rather than at the top of the Identity block — keeps the Story & Brief-stage-adjacent fields grouped, matches the plan's explicit 'after winning_charity or alongside brief' placement option"
  - "§48 documents the graph topology as TWO add_conditional_edges conversions (after calibrator, after verify_candidates) — NOT a literal conditional edge at START — per the RESEARCH.md correction to CONTEXT D-01's literal wording (both chains begin identically at calibrator, D-02)"
  - "§48.3 documents briefs:insert happening INSIDE _start_run immediately after runs:create (not console-side, not the endpoint) to avoid a partial-failure window, since _start_run mints run_id internally"

patterns-established:
  - "Additive-only Convex schema changes are followed immediately by `pnpm --filter @eisenbalm/convex dev:once` as a plan task, with the exit code and 'Convex functions ready' output captured as the acceptance artifact — not deferred to a later verification pass"

requirements-completed: [ENT-01, ENT-02, ENT-03, ENT-04]

# Metrics
duration: 17min
completed: 2026-07-16
---

# Phase 48 Plan 01: Contracts + Convex Schema + DispatchState Summary

**Froze the four cross-boundary shapes Phase 48's brief-entry seam depends on — DispatchState `entry_mode`/`source_material`, the `POST /pipeline/run/brief` endpoint contract, the `_start_run` brief-seed shape, and Convex `runs.entryMode` (schema + mutation + live deployment) — before any producer/consumer code exists.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-07-16T07:11:42-07:00 (plan creation commit timestamp; execution began immediately after)
- **Completed:** 2026-07-16T07:27:58-07:00
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments
- `docs/API_CONTRACTS.md` §7 amended with `entry_mode: NotRequired[Optional[Literal['discovery', 'brief']]]` and `source_material: NotRequired[Optional[str]]` on `DispatchState`, placed alongside the Phase 47 `brief` field
- New `## §48 — Brief Entry Point (Phase 48)` section appended (5 subsections: §48.1 graph topology, §48.2 the `POST /pipeline/run/brief` endpoint + `BriefRunBody`/`OrganizationInput`, §48.3 the `_start_run` extension + brief-run seed + reduced `agentRuns:queueForRun` set, §48.4 `runs.entryMode`, §48.5 additive-only summary) — documenting every shape 48-03 through 48-06 will consume
- `graph/state.py`'s `DispatchState` TypedDict carries the same two fields, byte-mirrored from the contract, and the module imports cleanly
- `convex/schema.ts` `runs` table gains an additive optional `entryMode` field (`'discovery' | 'brief'`, absent = discovery); the frozen `pipelineRuns` table is untouched (confirmed via targeted diff)
- `convex/runs.ts::create` accepts + persists `entryMode`; existing idempotent `by_runId` guard and every other arg (`workspace_id`, `runId`, `triggerSource`, `triggeredBy`, `pipelineSecret`) byte-unchanged
- Convex schema/mutation change live-synced to `dev:modest-magpie-797` via `pnpm --filter @eisenbalm/convex dev:once` (exit 0, "Convex functions ready!", re-verified twice, no schema-validation error)

## Task Commits

Each task was committed atomically:

1. **Task 1: Amend API_CONTRACTS §7 + add new §48 + add DispatchState fields to state.py** - `6ae77f8` (docs)
2. **Task 2: Add runs.entryMode to convex/schema.ts + convex/runs.ts::create arg, then live-sync Convex** - `54082e6` (feat)

_No plan-metadata commit prior to this SUMMARY — this commit sequence follows the standard two-task-then-summary flow for this plan._

## Files Created/Modified
- `docs/API_CONTRACTS.md` - §7 amendment (entry_mode/source_material) + new §48 (endpoint, seed shape, reduced agent queue, runs.entryMode)
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` - DispatchState gains entry_mode + source_material fields, placed alongside the Phase 47 brief field
- `convex/schema.ts` - runs table gains additive optional entryMode field
- `convex/runs.ts` - create mutation accepts + persists entryMode

## Decisions Made
- Placed `entry_mode`/`source_material` alongside the Phase 47 `brief` field (both in the contract and in state.py) rather than near `run_id`/`issue_number` at the top of the Identity block — the plan explicitly allowed either placement ("after `winning_charity` or alongside `brief`"), and grouping with `brief` keeps all Story & Brief-stage-adjacent fields together.
- §48.1 documents the graph fork as two `add_conditional_edges` conversions (`calibrator→{signal_editor|verify_candidates}`, `verify_candidates→{advocate|researcher}`) with `add_edge(START, "calibrator")` staying unconditional — this corrects CONTEXT D-01's literal "conditional edge at START" wording per RESEARCH.md's finding that both chains begin identically at calibrator (D-02), making a START-level branch a no-op. This is documentation-only in this plan (no builder.py code changed here — that's 48-03's job); §48.1 exists so 48-03 has the frozen mechanism to implement against.
- §48.3 documents that `briefs:insert` happens INSIDE `_start_run` immediately after `runs:create`, not console-side or in the endpoint handler — because `_start_run` mints `run_id` internally, this is the only placement that avoids a partial-failure window (a run that starts but never gets its Brief row).

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria were satisfied literally: `grep -c "## §48"` returns 1 (with 5 numbered subsections), `POST /pipeline/run/brief` and `BriefRunBody` both match, `entry_mode`/`source_material` appear in §7's DispatchState block and in state.py, the Python module imports cleanly, `entryMode` appears in both `convex/schema.ts`'s runs table and `convex/runs.ts` (args + destructure + insert), and `pnpm --filter @eisenbalm/convex dev:once` exits 0 with no validation error.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. The Convex live-sync was executed as part of this plan's Task 2 and confirmed successful (exit 0).

## Next Phase Readiness

- 48-02 (Wave 0 test scaffolds) can now write source-scan tests against the frozen `entry_mode`/`source_material` field names and the §48 endpoint/seed shapes without inventing anything.
- 48-03 (pipeline entry seam) has the exact `route_by_entry_mode` mechanism, edge placement, and `_start_run` parameter signature frozen in §48.1/§48.3 to implement against.
- 48-04 (brief-trigger endpoint) has `BriefRunBody`/`OrganizationInput`, the 422/409/200 response contract, and the audit-row shape frozen in §48.2.
- 48-06 (Stage 1 brief-mode render) can read `runRow.entryMode` — the field is live in `dev:modest-magpie-797` today, no further Convex sync needed for this field.
- No blockers. All four requirements' contract-layer prerequisites (ENT-01..04) are satisfied at the documentation/schema level; behavioral implementation is Waves 2-4 (Plans 48-03 through 48-07).

---
*Phase: 48-brief-entry-point*
*Completed: 2026-07-16*

## Self-Check: PASSED

- FOUND: docs/API_CONTRACTS.md
- FOUND: packages/pipeline/src/eisenbalm_pipeline/graph/state.py
- FOUND: convex/schema.ts
- FOUND: convex/runs.ts
- FOUND: 6ae77f8 (Task 1 commit)
- FOUND: 54082e6 (Task 2 commit)
