---
phase: 48-brief-entry-point
plan: 04
subsystem: api
tags: [fastapi, pydantic, clerk-auth, brief-entry, langgraph]

# Dependency graph
requires:
  - phase: 48-brief-entry-point
    provides: "Plan 48-03's entry_mode-extended _start_run (winning_charity/brief/source_material/agent_keys_override kwargs) + the graph fork (calibrator/verify_candidates conditional edges) this endpoint triggers"
provides:
  - "POST /pipeline/run/brief — Clerk-guarded brief-trigger endpoint in api/control.py"
  - "BriefRunBody/OrganizationInput Pydantic request models"
  - "_enforce_start_gates(http) shared helper (one-at-a-time + budget 409s), now used by both pipeline_run and pipeline_run_brief"
affects: [48-05-create-panel-brief-path, 48-06-stage1-brief-mode-render, 48-07-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared start-gate helper (_enforce_start_gates) extracted so multiple Clerk-guarded trigger endpoints reuse identical 409 logic instead of drifting copies"
    - "Human-supplied org mapped onto the existing D-14 synthetic-CharityCandidate shape (editor.py precedent) rather than inventing a new partial-candidate schema"

key-files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py

key-decisions:
  - "_enforce_start_gates extracted as Task 1 (not left as a duplicated copy) — RESEARCH.md's Open Question #1 recommended extraction as low-risk and directly serving D-15's 'all shared run-launch discipline is preserved' intent; done exactly as recommended"
  - "New endpoint inserted directly after pipeline_run and before the '# ── POST /pipeline/tick' section header — keeps the two Clerk-guarded manual-trigger endpoints (pipeline_run, pipeline_run_brief) grouped together, ahead of the cron-secret-guarded pipeline_tick"
  - "voiceIntention (and the other three unmapped Brief fields) seeded blank, per RESEARCH.md Pattern 3's reasoning: style_brief doesn't exist yet at request time (calibrator hasn't run), so defaulting from it is not mechanically possible without blocking the {runId} response"

patterns-established:
  - "Trigger endpoints that mint a new run (pipeline_run, pipeline_run_brief) call _enforce_start_gates(http) as their first side-effecting step, before any state is built — any future third trigger endpoint should follow the same call order"

requirements-completed: [ENT-02, ENT-04]

# Metrics
duration: ~6min
completed: 2026-07-16
---

# Phase 48 Plan 04: Brief Trigger Endpoint Summary

**Added the Clerk-guarded `POST /pipeline/run/brief` endpoint in `api/control.py`, backed by a new shared `_enforce_start_gates` helper so it reuses `pipeline_run`'s exact one-at-a-time and budget 409 gates, and wired it to the entry_mode-extended `_start_run` with a reduced brief-mode agent queue.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-16T08:36:00-07:00 (approx.)
- **Completed:** 2026-07-16T08:41:03-07:00
- **Tasks:** 2 completed
- **Files modified:** 1

## Accomplishments
- Extracted `pipeline_run`'s inline one-at-a-time (D-12) + budget (RUN-06) start-gate block into a new `_enforce_start_gates(http) -> None` helper — byte-equivalent behavior (same checks, same 409 detail strings, same order); `pipeline_run` now calls the helper. `pipeline_tick`'s inline gates were intentionally left untouched (different skip-not-raise semantics + an extra scheduled-publish sweep).
- Added `OrganizationInput`/`BriefRunBody` Pydantic models and `POST /pipeline/run/brief` (`pipeline_run_brief`), Clerk-guarded via the existing `_require_clerk_jwt_control` dependency, placed directly after `pipeline_run` in `api/control.py`.
- The endpoint 422s on an empty/whitespace `organization.name`, calls `_enforce_start_gates(http)` for the shared 409 reuse, builds a synthetic `CharityCandidate` for the human org (copying `editor.py`'s D-14 all-candidates-killed shape verbatim) and the 6-field Brief (premise/peg mapped, the other four fields — including `voiceIntention` — blank), then calls `_start_run(..., entry_mode="brief", winning_charity=..., brief=..., source_material=..., agent_keys_override=BRIEF_AGENT_KEYS)` where `BRIEF_AGENT_KEYS` excludes `signal_editor`/`scout`/`advocate`/`editor_gate_1`/`chronicler`.
- Emits a `run.triggered` audit row via `_emit_audit` with `after={"entryMode": "brief", "organization": <name>}`, mirroring `pipeline_run`'s audit call.
- `test_brief_run_endpoint.py` (Wave 0 skip-guarded scaffold) is now fully green: 422-empty-org, 409-one-at-a-time-reuse, 409-budget-reuse (conditional), 200-`{runId}`-with-correct-`_start_run`-kwargs, and audit-row assertions all pass.
- Full pipeline pytest suite: **679 passed, 38 skipped, 0 failed** (up from 675 passed / 42 skipped before this plan — the 4 previously-skipped brief-endpoint tests are now green, no other suite regressed).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract the start-gate block into a shared `_enforce_start_gates(http)` helper** - `493299f` (refactor)
2. **Task 2: Add `BriefRunBody`/`OrganizationInput` + `POST /pipeline/run/brief`** - `450525e` (feat)

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` - `_enforce_start_gates` helper (extracted from `pipeline_run`'s inline gate block, now shared); `OrganizationInput`/`BriefRunBody` models; `POST /pipeline/run/brief` (`pipeline_run_brief`) endpoint

## Decisions Made
- Extracted `_enforce_start_gates` as a real Task 1 deliverable rather than accepting the duplication RESEARCH.md flagged as an open question — the extraction was small, low-risk, and directly serves D-15's "all shared run-launch discipline is preserved" requirement, exactly as RESEARCH.md's own recommendation stated.
- Placed the new endpoint immediately after `pipeline_run` (before the `POST /pipeline/tick` section) rather than at the end of the file, keeping the two Clerk-guarded manual-trigger endpoints visually and logically grouped, ahead of the cron-secret-guarded tick endpoint.
- `voiceIntention` starts blank (not defaulted from `style_brief.visualDirection`) — `calibrator` has not run yet at request time, so `style_brief` does not exist; defaulting from it would require either blocking the `{runId}` response on an LLM call or adding brief-specific patch logic inside `calibrator` itself, both out of scope. The operator fills it later via the shipped BRF-06 strengthen.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria were satisfied literally: `_enforce_start_gates` is defined and called inside `pipeline_run`; `would_exceed_monthly_cap` now appears exactly once outside `pipeline_tick` (centralized, not duplicated); `/pipeline/run/brief`, `BriefRunBody`, `OrganizationInput`, `entry_mode="brief"`, and `BRIEF_AGENT_KEYS` (excluding the five discovery-only nodes) all match via grep; `test_brief_run_endpoint.py` and `test_control.py` are fully green; the full pipeline suite is green with 0 failures.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. No Convex schema/function changes in this plan (that was Plan 48-01's job); nothing needs a `dev:once` sync.

## Next Phase Readiness

- `POST /pipeline/run/brief` is live and route-registered — `test_brief_run_endpoint.py`'s skip-guard (which gated on route existence) is now permanently satisfied.
- Plans 48-05 (Create-panel brief path) and 48-06 (Stage 1 brief-mode render), which were executed earlier in this phase's wave sequence and reference `POST /pipeline/run/brief` as their target endpoint, now have a real, tested backend to call — the console's `triggerBriefRun` client (48-05) will reach a real endpoint rather than a 404 the next time the full stack is exercised end-to-end.
- Existing `pipeline_run`/`pipeline_tick`/`run_weekly` paths are behaviorally unchanged: `run_weekly` (in `api/runs.py`) was not touched by this plan; `pipeline_run` now delegates its gate logic to `_enforce_start_gates` but is byte-equivalent in behavior (confirmed via `test_control.py` + `test_budget_gate.py`, both green); `pipeline_tick`'s inline gates were deliberately left as-is.
- No blockers. 48-07 (integration gate) can now exercise the full brief-entry flow end-to-end against a real endpoint.

---
*Phase: 48-brief-entry-point*
*Completed: 2026-07-16*

## Self-Check: PASSED

- FOUND: packages/pipeline/src/eisenbalm_pipeline/api/control.py
- FOUND: 493299f (Task 1 commit)
- FOUND: 450525e (Task 2 commit)
