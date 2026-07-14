---
phase: 40-issue-entity-issues-home
plan: 03
subsystem: api
tags: [fastapi, convex, pipeline, backfill, deterministic]

# Dependency graph
requires:
  - phase: 40-issue-entity-issues-home
    provides: "§40.1/§40.2/§40.3/§40.4 contract in docs/API_CONTRACTS.md + the RED test_repetition_note.py scaffold (Plan 40-01); convex/issues.ts ensureByNumber/markPublished + pipelineRuns issue-keyed queries (Plan 40-02)"
  - phase: 39-registry-coverage-memory-strip
    provides: "GET /registry/coverage-strip pattern this plan's repetition-note endpoint mirrors (same Convex+Sanity join, same auth guard, same groq_query calling convention)"
provides:
  - "GET /registry/repetition-note — deterministic, no-LLM, no-run-required 'avoid X · avoid Y' note over the last-8 coverage-memory sample (D-10)"
  - "_start_run defensively calls issues:ensureByNumber before pipelineRuns:create on every trigger path (D-04)"
  - "scripts/backfill_issues.py — one-shot idempotent issues-table backfill from pipelineRuns + Sanity published state (D-05), not yet run"
  - "issues:ensureByNumber / issues:markPublished registered as pipeline-secret-guarded Convex mutation paths so the pipeline lane actually authenticates"
affects: [40-04, 40-05, 40-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deterministic derivation endpoint (no LLM, no run) mirroring an existing read-endpoint's Convex+Sanity join shape — same pattern as coverage-strip, second instance in registry.py"
    - "Central pipeline-secret injection registration: a Convex dual-lane mutation is invisible to the pipeline lane's auth unless its path is added to convex_client.py's _PIPELINE_SECRET_GUARDED_PATHS frozenset"

key-files:
  created:
    - packages/pipeline/scripts/backfill_issues.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/registry.py
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
    - packages/pipeline/tests/conftest.py

key-decisions:
  - "Added issues:ensureByNumber and issues:markPublished to convex_client.py's _PIPELINE_SECRET_GUARDED_PATHS (not in the plan's files_modified list) — without this, every pipeline-lane call to the dual-lane requireOperatorOrPipeline-guarded mutations would send no pipelineSecret and fail Unauthorized in any deployed environment, breaking every single run trigger. Rule 2 (auto-add missing critical functionality)."
  - "Routed the 'issues:' path prefix through the convex_runs_store test fixture in conftest.py (Rule 3 — blocking issue directly caused by Task 2's change: test_control.py's bare-app fixture has no convex_http, so the unrouted issues:ensureByNumber call fell through to the real network client and crashed on http=None)."
  - "backfill_issues.py mirrors backfill_charity_registry.py's SANITY_PROJECT_ID (not NEXT_PUBLIC_SANITY_PROJECT_ID) env var naming for structural fidelity with the explicitly-named precedent, per the plan's read_first instruction to mirror that file's structure exactly."

patterns-established:
  - "A dual-lane Convex mutation (requireOperatorOrPipeline) is only pipeline-callable in production once its path is added to convex_client.py's _PIPELINE_SECRET_GUARDED_PATHS — this is a required, easy-to-miss second step whenever future phases add a dual-lane mutation the pipeline calls directly (not just via convex_mutation_safe fire-and-forget)."

requirements-completed: [ISS-03, ISS-01]

# Metrics
duration: 20min
completed: 2026-07-14
---

# Phase 40 Plan 03: Repetition Note + Backfill + Pipeline Summary

**Deterministic GET /registry/repetition-note endpoint (no LLM, no run required), a defensive issues:ensureByNumber call wired into every pipeline run trigger, and the one-shot backfill_issues.py script — plus the pipeline-secret registration these dual-lane Convex mutations actually needed to authenticate.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-14
- **Tasks:** 3
- **Files modified:** 5 (3 files per the plan + 2 additional files for a Rule 2/Rule 3 deviation)

## Accomplishments

- `GET /registry/repetition-note` added to `packages/pipeline/src/eisenbalm_pipeline/api/registry.py`, alongside the existing `coverage_strip` handler: same auth guard, same Convex `charities:listRecentFeatured` + Sanity `groq_query` join, `REPETITION_THRESHOLD = 3`, geo-before-cause tie-break, at-most-2 cap, signal (`scoutNotes`) never counted. Turns all 5 cases in `packages/pipeline/tests/test_repetition_note.py` GREEN.
- `_start_run` in `api/runs.py` now calls `issues:ensureByNumber` immediately after issue-number resolution and before `pipelineRuns:create` — CFG-04 ordering preserved verbatim, no existing step reordered, no signature change.
- `packages/pipeline/scripts/backfill_issues.py` created: enumerates distinct `issueNumber`s via `runs:listForWorkspace` + `pipelineRuns:byRunId` (no new Convex query), calls `issues:ensureByNumber` per number, then `issues:markPublished` for every Sanity `weeklyIssue` with `status == 'published'`. Not run by this plan.
- Registered `issues:ensureByNumber` and `issues:markPublished` in `convex_client.py`'s `_PIPELINE_SECRET_GUARDED_PATHS` — without this the pipeline-lane calls to these `requireOperatorOrPipeline`-guarded mutations would send no secret and fail `Unauthorized` against a live Convex deployment.
- Fixed the `convex_runs_store` pytest fixture in `tests/conftest.py` to route `"issues:"` paths to its in-memory store's default no-op, so `test_control.py`'s bare-app test (no `convex_http` set) doesn't crash on the new `ensureByNumber` call falling through to the real network client.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GET /registry/repetition-note to api/registry.py** - `87a7ea0` (feat)
2. **Task 2: Defensive issues:ensureByNumber at run start** - `b1191e6` (feat) — includes the convex_client.py guarded-path registration and the conftest.py fixture fix (both required for Task 2 to actually work; see Deviations)
3. **Task 3: Create scripts/backfill_issues.py (D-05)** - `0c050dc` (feat)

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/api/registry.py` - New `REPETITION_THRESHOLD = 3` constant + `GET /registry/repetition-note` handler
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` - `_start_run` calls `issues:ensureByNumber` before `pipelineRuns:create`
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` - Added `issues:ensureByNumber` / `issues:markPublished` to `_PIPELINE_SECRET_GUARDED_PATHS`
- `packages/pipeline/tests/conftest.py` - `convex_runs_store` fixture now routes `"issues:"` mutation/query paths to its in-memory store
- `packages/pipeline/scripts/backfill_issues.py` - New one-shot D-05 backfill script

## Decisions Made

- See `key-decisions` in frontmatter — both deviations (convex_client.py registration, conftest.py fixture fix) were necessary for Task 2's stated behavior to actually function, not scope creep.
- `backfill_issues.py`'s optional `SANITY_PROJECT_ID` env var name (not `NEXT_PUBLIC_SANITY_PROJECT_ID`) intentionally mirrors `backfill_charity_registry.py`'s existing naming exactly, per the plan's explicit instruction to structurally mirror that file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Registered issues:ensureByNumber/markPublished as pipeline-secret-guarded**
- **Found during:** Task 2 (defensive ensureByNumber call)
- **Issue:** `convex/issues.ts`'s `ensureByNumber` and `markPublished` are dual-lane mutations guarded by `requireOperatorOrPipeline(ctx, pipelineSecret)`. The pipeline lane has no Clerk identity, so it depends entirely on `pipelineSecret` being present. `convex_client.py::convex_mutation` only injects that secret for paths listed in `_PIPELINE_SECRET_GUARDED_PATHS` — neither new path was in that set, so every pipeline-lane call (every run trigger, and the backfill script) would have sent no secret and failed `Unauthorized` against a live Convex deployment.
- **Fix:** Added `"issues:ensureByNumber"` and `"issues:markPublished"` to `_PIPELINE_SECRET_GUARDED_PATHS` in `convex_client.py`.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py`
- **Verification:** Full pipeline pytest suite (531 passed, 36 skipped) after the change; the guarded-path convention is exercised by the existing `test_findings_endpoints.py` precedent pattern.
- **Committed in:** `b1191e6` (part of Task 2 commit)

**2. [Rule 3 - Blocking] Routed "issues:" through the convex_runs_store test fixture**
- **Found during:** Task 2 verify step (`uv run pytest tests/test_control.py`)
- **Issue:** `test_manual_trigger_records_operator` mounts a bare FastAPI app with no `app.state.convex_http`. The `convex_runs_store`/`convex_config_store` fixtures monkeypatch `convex_mutation` but only route `"runs:"`, `"agentRuns:"`, `"pipelineRuns:"` (and `"pipelineConfig:"`/`"auditLog:"`) prefixes to their in-memory stores; the new `"issues:ensureByNumber"` call fell through to the real `convex_mutation` implementation, which tried `http.post(...)` on `http=None` and raised `AttributeError`.
- **Fix:** Added `"issues:"` to the prefix tuple `convex_runs_store` routes to its in-memory dispatcher (which already has a default no-op `{"status": "success"}` branch for unmatched paths within the store).
- **Files modified:** `packages/pipeline/tests/conftest.py`
- **Verification:** `uv run pytest tests/test_control.py tests/test_test_run.py` — 4/4 passed; full suite — 531 passed, 36 skipped, zero regressions.
- **Committed in:** `b1191e6` (part of Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both auto-fixes were required for Task 2's stated behavior ("Every run start now ensures its issues row exists") to be true in any deployed environment and to keep the existing test suite green. No scope creep — no new files beyond the plan's three, no behavior added beyond what D-04/D-05/D-10 specify.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None - no external service configuration required. `scripts/backfill_issues.py` is intentionally NOT run by this plan (per its own action text) — it needs the deployed Convex functions from Plan 40-02 plus Plan 40-10's live sync (`pnpm --filter @eisenbalm/convex dev:once` against `dev:modest-magpie-797`) before it can succeed against the real deployment.

## Next Phase Readiness

- `GET /registry/repetition-note` is live and pytest-verified; Plan 40-04's `apps/dispatch-control/lib/repetitionNoteClient.ts` (§40.5) can now be built against a real, deployed-when-synced endpoint.
- `_start_run`'s defensive `issues:ensureByNumber` call is wired for every trigger path (`/run/weekly`, `/pipeline/run`, `/pipeline/tick`) since they all funnel through the shared `_start_run` helper.
- `scripts/backfill_issues.py` exists, parses, and imports cleanly — ready to run once 40-02's Convex functions are live-synced (tracked as Plan 40-09's integration gate, not this plan's job).
- No blockers for Plan 40-04 (derived-state resolver libs) or Plan 40-05 (Issues home screen), both of which read from `issues`/`repetitionNoteClient` surfaces this plan completed.

---
*Phase: 40-issue-entity-issues-home*
*Completed: 2026-07-14*

## Self-Check: PASSED

All modified/created files confirmed present on disk (`registry.py`, `runs.py`, `convex_client.py`, `conftest.py`, `backfill_issues.py`); all three task commits (`87a7ea0`, `b1191e6`, `0c050dc`) confirmed in git history via `git log --oneline`.
