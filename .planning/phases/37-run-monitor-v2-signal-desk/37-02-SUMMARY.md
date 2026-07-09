---
phase: 37-run-monitor-v2-signal-desk
plan: 02
subsystem: api
tags: [fastapi, langgraph, clerk-jwt, audit-log, gate1-interrupt]

# Dependency graph
requires:
  - phase: 37-run-monitor-v2-signal-desk
    provides: "§37.3 contract amendment (docs/API_CONTRACTS.md) defining the adjudication bridge endpoint shape (37-01)"
  - phase: 25-run-control
    provides: "_require_trigger_secret / _require_clerk_jwt_control auth guards, _emit_audit helper, control.py endpoint pattern"
provides:
  - "POST /issues/{run_id}/adjudicate — Clerk-guarded bridge: operator pick + reason → audit_log → server-side resume"
  - "Shared _resume_paused_run(app, run_id, charity_name) helper in runs.py — the single resume implementation reused by both the trigger-secret and Clerk-guarded entry points"
affects: [37-05-signal-desk]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-check-then-audit-then-act: paused-state guard runs BEFORE any audit/resume side effect, so a 409 on a non-paused run leaves zero trace"
    - "Single shared write-path helper: two differently-authed HTTP entry points (cron/CLI trigger-secret vs Clerk JWT dashboard) both delegate to one extracted async helper rather than duplicating resume logic"

key-files:
  created:
    - packages/pipeline/tests/test_adjudication_bridge.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py

key-decisions:
  - "_resume_paused_run(app, run_id, charity_name) takes the FastAPI app (not graph) and resolves app.state.graph itself, folding the 503-degraded-lifespan check into the shared helper — both resume_run and adjudicate get that guard for free rather than duplicating it"
  - "adjudicate pre-checks graph.aget_state().next BEFORE calling _emit_audit, rather than letting the 409 propagate from inside _resume_paused_run after an audit write — this is what makes the non-paused path have zero side effects (test_adjudicate_non_paused_no_side_effects)"
  - "The operator's reason is logged via audit_log's `after` JSON payload only — no new literal added to the deliberationEvents.eventType union (kept FROZEN per D-13), and `reason` is NOT threaded into Command(resume=...) sent to the graph"

requirements-completed: [SIG-03]

# Metrics
duration: 14min
completed: 2026-07-09
---

# Phase 37 Plan 02: Adjudication Bridge Summary

**Clerk-guarded `POST /issues/{run_id}/adjudicate` bridge that audit-logs the operator's Gate-1 pick + reason before invoking a newly-extracted shared `_resume_paused_run` helper — the same resume machinery the trigger-secret-guarded `/run/{run_id}/resume` uses — so the dashboard never handles the server-to-server trigger secret.**

## Performance

- **Duration:** ~14 min
- **Completed:** 2026-07-09
- **Tasks:** 2
- **Files modified:** 3 (2 source, 1 test — 1 new file)

## Accomplishments
- `runs.py`'s `resume_run` core (paused-state check via `state.next`, build `{"editorSelection": ...}`, schedule the background `Command(resume=...)` invoke, register/discard on `app.state.background_tasks`, return `{"runId", "resumed": True}`) is now a standalone `_resume_paused_run(app, run_id, charity_name)` helper — `resume_run` keeps its trigger-secret guard and delegates.
- `control.py` adds `POST /issues/{run_id}/adjudicate`, guarded by `_require_clerk_jwt_control` (Clerk JWT), which pre-checks the paused state, audit-logs the pick + reason (`action="gate1.adjudicate"`, `after` carries `{charityName, reason}`) BEFORE scheduling the resume, then delegates to the same `_resume_paused_run` helper.
- The operator can now resolve a Gate-1 interrupt from the dashboard without ever touching `PIPELINE_TRIGGER_SECRET`; the pick + reason is logged before the run resumes ("nothing silent"); there is exactly one resume implementation shared by both entry points.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract a shared `_resume_paused_run` helper in runs.py (interface-first)** - `16df8dc` (feat, TDD RED→GREEN)
2. **Task 2: Add `POST /issues/{run_id}/adjudicate` Clerk-guarded bridge** - `5e31fca` (feat, TDD RED→GREEN)

**Plan metadata:** (this commit) `docs: complete 37-02 plan`

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` - Extracted `_resume_paused_run(app, run_id, charity_name)`; `resume_run` now delegates to it after its `_require_trigger_secret` guard
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` - Added `AdjudicateBody` Pydantic model (reusing `ResumeSelection` from runs.py) and the `POST /issues/{run_id}/adjudicate` endpoint; imports `ResumeSelection` + `_resume_paused_run` from `runs.py` (the pre-existing `_require_graph` import, previously unused in this file, is now exercised by `adjudicate`'s paused pre-check)
- `packages/pipeline/tests/test_adjudication_bridge.py` (new) - 5 tests: 2 for the shared helper (409-when-not-paused, schedules-and-returns-when-paused), 3 for the bridge endpoint (audits-before-resume with call-order assertion, non-paused-run-has-zero-side-effects, source-level guard that `adjudicate` never references the trigger-secret check)

## Decisions Made
- `_resume_paused_run` resolves `app.state.graph` itself (rather than accepting a pre-fetched `graph` parameter) so it also owns the 503-degraded-lifespan guard — both call sites get that behavior automatically instead of duplicating it.
- `adjudicate` performs its own `graph.aget_state` pre-check ahead of `_emit_audit`, rather than relying on `_resume_paused_run`'s internal 409 to short-circuit after an audit write. This ordering is what guarantees a non-paused run has literally zero audit/resume side effects, matching the plan's "no side effects on 409" requirement.
- The operator-supplied `reason` is carried only in the `audit_log.after` JSON blob — it is never added to the `Command(resume=...)` payload sent into the graph and never introduces a new `deliberationEvents.eventType` literal, keeping that union frozen per D-13.

## Deviations from Plan

None - plan executed exactly as written. Both tasks, their `must_haves`, and their acceptance criteria were implemented verbatim per the plan's interfaces section. One minor self-correction during Task 2: the endpoint's initial docstring prose contained the literal string `_require_trigger_secret` (in an explanatory sentence, not a call), which tripped the source-level grep test (`inspect.getsource` includes docstrings) — reworded the docstring to describe the same fact without the literal token; no behavior change.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. This plan touches pipeline Python only (FastAPI routes); no new environment variables or dashboard configuration.

## Next Phase Readiness

- The adjudication bridge endpoint (`POST /issues/{run_id}/adjudicate`) is live and ready for Signal Desk (37-05, SIG-03) to call from the dashboard's Gate-1 interrupt UI.
- `_resume_paused_run` is the one authoritative resume implementation — any future write path needing to resume a paused run should call this helper rather than reimplementing the paused-check/Command(resume=...) logic.
- Full pipeline verification suite green: `cd packages/pipeline && uv run pytest -x -q` → 502 passed, 36 skipped (37-01 baseline was 497 passed — Plan 02 net +5 green, zero regressions).
- No blockers for Wave 2 continuation (37-03 run-monitor-spine-handoff) or Wave 3 (37-05 signal-desk, which depends on this plan's endpoint).

---
*Phase: 37-run-monitor-v2-signal-desk*
*Completed: 2026-07-09*

## Self-Check: PASSED

All 3 modified/created files confirmed present on disk; both task commit hashes (`16df8dc`, `5e31fca`) confirmed present in `git log`.
