---
phase: 46-signal-editor-candidate-verification
plan: 02
subsystem: pipeline-contracts
tags: [langgraph, typeddict, checkpoint, repetition, dedup]

# Dependency graph
requires:
  - phase: 46-01
    provides: "API_CONTRACTS.md §46 — StoryLead, VerificationRecord, story_leads/verification_records DispatchState field shapes (binding, contract-first)"
  - phase: 40-review-gate-charity-registry
    provides: "GET /registry/repetition-note + its REPETITION_THRESHOLD=3/geo-before-cause counting algorithm (§40.4), now the extraction source"
provides:
  - "graph/state.py: StoryLead + VerificationRecord TypedDicts, matching API_CONTRACTS §46 field names verbatim"
  - "graph/state.py: DispatchState.story_leads + DispatchState.verification_records — JSON-safe Optional[list[dict]] fields (SGE-04 checkpoint-safe)"
  - "lib/registry_repetition.compute_repetition_note(sanity_rows) -> dict — the shared SGE-05 repetition-warning algorithm, extracted verbatim from api/registry.py"
  - "api/registry.py::repetition_note delegates to compute_repetition_note (byte-stable sampleSize/note/avoid contract preserved)"
affects: [46-03, 46-04, 46-05, 46-06, 46-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared algorithm extraction: an existing endpoint's inline logic moved to lib/<name>.py as a pure function, with the endpoint delegating and overriding only the field whose semantics differ pre/post-join (sampleSize)"
    - "JSON-safe list[dict] DispatchState field precedent (featured_charity_keys/claims) reused for two more Phase 46 fields"

key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/lib/registry_repetition.py
    - packages/pipeline/tests/lib/test_registry_repetition.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py
    - packages/pipeline/src/eisenbalm_pipeline/api/registry.py

key-decisions:
  - "compute_repetition_note's own sampleSize is len(sanity_rows) (the rows it was actually given); api/registry.py overrides it with the pre-join Convex row count (len(rows)) via dict-spread to keep the shipped endpoint contract byte-stable, exactly as the plan specified"
  - "StoryLead/VerificationRecord added as plain (non-NotRequired) TypedDict fields since API_CONTRACTS §46.1/§46.3 declares every field mandatory at the Pydantic boundary — matches the CharityCandidate precedent, not the NotRequired ResearchOutput precedent"

requirements-completed: [SGE-01, SGE-03, SGE-04, SGE-05]

# Metrics
duration: ~12min
completed: 2026-07-16
---

# Phase 46 Plan 02: DispatchState Contract & Repetition Helper Summary

**DispatchState gains StoryLead + VerificationRecord TypedDicts and two JSON-safe list[dict] fields matching API_CONTRACTS §46 verbatim, and the Phase-40 repetition-note counting algorithm is extracted into lib/registry_repetition.compute_repetition_note so the Signal Editor can reuse it without reinventing it.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-16T07:30:00Z
- **Completed:** 2026-07-16T07:42:00Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `lib/registry_repetition.py::compute_repetition_note` holds the exact REPETITION_THRESHOLD=3, geo-before-cause tie-break, at-most-2-cap algorithm previously inlined in `api/registry.py::repetition_note` — moved verbatim, not reimplemented.
- `api/registry.py::repetition_note` now delegates to the helper and only overrides `sampleSize` (pre-Sanity-join Convex row count) to keep its shipped JSON contract byte-stable — zero behavior change, confirmed by the pre-existing `tests/test_repetition_note.py` suite passing unmodified.
- `graph/state.py` gains `StoryLead` (11 fields) and `VerificationRecord` (10 fields) TypedDicts, field names copied verbatim from `docs/API_CONTRACTS.md` §46.1/§46.3, plus `DispatchState.story_leads: Optional[list[StoryLead]]` and `DispatchState.verification_records: Optional[list[VerificationRecord]]` — both list[dict]-shaped (no sets/objects) so the Postgres checkpointer can resume across `signal_editor → scout → verify_candidates` (SGE-04).
- Full pipeline suite: 596 passed / 39 skipped / 0 failed (same skip count as the 46-01 baseline — zero regressions).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract compute_repetition_note into lib/registry_repetition.py** - `5431930` (test)
2. **Task 2: Add StoryLead + VerificationRecord TypedDicts + 2 DispatchState fields** - `cb6b8b1` (feat)

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/lib/registry_repetition.py` - New: `REPETITION_THRESHOLD`, `_REPETITION_DIMENSION_ORDER`, `compute_repetition_note(sanity_rows) -> dict`
- `packages/pipeline/tests/lib/test_registry_repetition.py` - New: 4 unit tests (empty input, over-represented geo+cause, below-threshold, tie-break + cap)
- `packages/pipeline/src/eisenbalm_pipeline/api/registry.py` - `repetition_note` endpoint delegates to the extracted helper; local `REPETITION_THRESHOLD`/`_REPETITION_DIMENSION_ORDER`/counting block removed
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` - `StoryLead` + `VerificationRecord` TypedDicts added before `DispatchState`; `story_leads` + `verification_records` fields added to the Phase 1 selection block

## Decisions Made
- Kept `compute_repetition_note`'s own `sampleSize` semantics (`len(sanity_rows)`) rather than threading the pre-join count through as a parameter — the plan explicitly calls for the endpoint to override via `{**compute_repetition_note(sanity_rows), "sampleSize": len(rows)}`, which keeps the helper a pure function of the rows it's given while preserving the shipped endpoint's historical contract.
- `StoryLead`/`VerificationRecord` fields are declared as plain (required) TypedDict keys, not `NotRequired` — every field in §46.1/§46.3 is documented as populated (with `Optional[str]` used only for genuinely nullable fields like `brandRiskReason`), matching the `CharityCandidate` precedent already in the same file rather than the `NotRequired` pattern used for `ResearchOutput`'s backward-compatible additions.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria passed on the first attempt; no auto-fixes, no blocking issues, no architectural questions.

## Issues Encountered

None. The existing `tests/test_repetition_note.py` endpoint test and the new `tests/lib/test_registry_repetition.py` unit tests both pass; `test_builder_wiring.py` and the full 596-test suite confirm zero regressions from adding the two new DispatchState fields.

## Next Phase Readiness

- Plan 46-03 (Signal Editor prompt + model registration) already landed independently (`46-03-SUMMARY.md`) and did not depend on this plan's TypedDicts.
- Plan 46-04 (signal_editor agent) can now write `StoryLead`-shaped dicts into `DispatchState.story_leads` and call `lib.registry_repetition.compute_repetition_note` directly for its Editorial Memory repetition-warning read (SGE-05), reusing the exact Phase-40 algorithm rather than reimplementing it.
- Plan 46-05 (verify_candidates agent) can now write `VerificationRecord`-shaped dicts into `DispatchState.verification_records`.
- Plan 46-07 (checkpoint resume + integration gate) has both new fields confirmed JSON-serializable (Optional[list[dict]], no sets/objects) ahead of its pause/resume test.

## Self-Check

- [x] `packages/pipeline/src/eisenbalm_pipeline/lib/registry_repetition.py` exists, contains `def compute_repetition_note`
- [x] `packages/pipeline/src/eisenbalm_pipeline/api/registry.py` contains `compute_repetition_note` (delegates)
- [x] `packages/pipeline/tests/lib/test_registry_repetition.py` exists, 4/4 pass
- [x] `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` contains `class StoryLead(TypedDict)` + `class VerificationRecord(TypedDict)` + `story_leads: Optional[list[StoryLead]]` + `verification_records: Optional[list[VerificationRecord]]`
- [x] Commits `5431930`, `cb6b8b1` both present in `git log`
- [x] Full pipeline suite: 596 passed / 39 skipped / 0 failed

## Self-Check: PASSED

All 4 created/modified files confirmed present on disk; both task commits (`5431930`, `cb6b8b1`) confirmed in `git log`; full pipeline suite green with zero regressions.

---
*Phase: 46-signal-editor-candidate-verification*
*Plan: 02-dispatchstate-contract-and-repetition-helper*
*Completed: 2026-07-16*
