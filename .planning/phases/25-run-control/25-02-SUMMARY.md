---
phase: 25-run-control
plan: "02"
subsystem: pipeline-api
tags: [run-control, scheduler, clerk-jwt, cron-tick, kill-switch, tdd-green]
dependency_graph:
  requires:
    - 25-01 (conftest fixtures, RunCancelled, pipeline_config keys, API_CONTRACTS §3B)
  provides:
    - POST /pipeline/run (Clerk JWT, dev-mode sentinel, operator attribution)
    - POST /pipeline/tick (trigger-secret, 5-step kill-switch-first guard)
    - lib/scheduler.py (_is_due, compute_next_run_at — cron dayOfWeek convention)
    - auditLog:record (public Convex mutation callable from FastAPI)
    - _start_run (shared helper, CFG-04 ordering preserved)
  affects:
    - cli.py trigger-weekly (repointed from /run/weekly to /pipeline/tick)
    - api/main.py (control.router mounted)
    - conftest.py (fixture chaining dispatch for concurrent store use)
tech_stack:
  added: []
  patterns:
    - Module-level convex_client import (_cc.*) for monkeypatch compatibility
    - Fixture chaining dispatch (path-prefix routing instead of last-wins override)
    - Dev-mode JWT sentinel (HTTPBearer auto_error=False + CLERK_JWT_ISSUER_DOMAIN guard)
    - 5-step cron guard order (kill switch FIRST per Pitfall 4.2)
    - Pitfall 6 protection (compute_next_run_at returns strictly after now via +1 min)
key_files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/scheduler.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py (_start_run extracted, _cc.* import, _resolve_issue_number env guard)
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py (control.router mounted)
    - packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py (snapshot_config uses _cc.convex_mutation)
    - packages/pipeline/src/eisenbalm_pipeline/cli.py (trigger-weekly → /pipeline/tick, handles skipped response)
    - convex/auditLog.ts (public record mutation added)
    - packages/pipeline/tests/conftest.py (fixture chaining dispatch, _handle_mutation http arg)
    - packages/pipeline/tests/api/test_runs.py (NEXT_PUBLIC_SANITY_PROJECT_ID env setup for _resolve_issue_number tests)
    - packages/pipeline/tests/api/test_runs_config_snapshot.py (_cc.convex_mutation patch alongside runs module binding)
    - packages/pipeline/tests/test_cancel.py (_handle_mutation call updated for new http-first signature)
decisions:
  - "Module-level _cc.* import pattern adopted for all Convex calls in run-control path — ensures monkeypatch.setattr(_cc, ...) reaches all call sites including transitively-called helpers (snapshot_config, etc.)"
  - "Fixture chaining dispatch: each fixture captures previously-installed handler as prev_* and routes by path prefix (runs:*/agentRuns:*/pipelineRuns:* → runs store; pipelineConfig:*/auditLog:* → config store; fallthrough to prev). Eliminates last-wins override problem when both fixtures are used in a single test."
  - "_resolve_issue_number env guard: returns 1 when NEXT_PUBLIC_SANITY_PROJECT_ID is unset (dev/test), propagates real read failures when env is set — preserves fail-loud contract"
  - "control.py uses _optional_bearer = HTTPBearer(auto_error=False) + custom _require_clerk_jwt_control to allow dev-mode sentinel without Authorization header"
  - "auditLog:record is non-blocking in _emit_audit — audit failure logs a warning but never blocks a run trigger"
metrics:
  duration: "~90 min"
  completed: "2026-06-23"
  tasks_completed: 2
  files_modified: 11
---

# Phase 25 Plan 02: On-Demand Trigger + Scheduler Tick Summary

`POST /pipeline/run` (Clerk-authed manual trigger with operator attribution) + `POST /pipeline/tick` (trigger-secret-authed cron tick with kill-switch-first 5-step guard) + `lib/scheduler.py` cadence engine. Makes Wave 0 RED tests from Plan 01 green.

## What Was Built

### Task 1 — `_start_run` Helper + `lib/scheduler.py`

Factored `run_weekly`'s body into a reusable `_start_run` module-level coroutine. The CFG-04 launch ordering is preserved in one place:

1. `_resolve_issue_number` (Sanity-degraded when env unset)
2. `new_run_id / begin_run`
3. `convex_mutation pipelineRuns:create`
4. `convex_mutation runs:create` (with `triggeredBy` for operator attribution)
5. `convex_mutation agentRuns:queueForRun`
6. `load_run_config + snapshot_config` — BEFORE `asyncio.create_task`
7. `asyncio.create_task(_execute_run)`

`lib/scheduler.py` implements two cadence-engine functions:

- `_is_due(pc, now)`: returns True when `now_ms >= schedule_next_run_at`; treats 0/absent as "due immediately" (first-ever tick)
- `compute_next_run_at(cadence, now)`: returns next UTC datetime strictly after now matching `{dayOfWeek, hourUtc, minuteUtc}`; adds +1 min to now before searching (Pitfall 6 guard). Uses cron dayOfWeek convention (0=Sun…6=Sat) with conversion `python_weekday = (cron_day - 1) % 7`

### Task 2 — `api/control.py` Endpoints + Wiring

**POST /pipeline/run:**
- Clerk JWT auth via `_require_clerk_jwt_control` (dev-mode sentinel when `CLERK_JWT_ISSUER_DOMAIN` unset)
- One-at-a-time gate: `runs:latest` query → 409 if status=running
- Budget start-gate seam (Plan 04 placeholder)
- Delegates to `_start_run(trigger_source="manual", triggered_by=claims["sub"])`
- Emits `auditLog:record(action="run.triggered")` — non-blocking on failure

**POST /pipeline/tick:**
- Trigger-secret auth via `_require_trigger_secret`
- 5-step guard order (Pitfall 4.2: kill switch MUST be first):
  1. `schedule_enabled` check → `{"status":"skipped","reason":"schedule_disabled"}`
  2. `_is_due(pc, now_ms)` check → `{"status":"skipped","reason":"not_due"}`
  3. One-at-a-time → `{"status":"skipped","reason":"run_in_progress"}`
  4. Budget seam (Plan 04 placeholder)
  5. Fire: `_start_run(trigger_source="cron", triggered_by="cron")` + advance cursor + emit audit
- Cursor advance uses `compute_next_run_at` to set `schedule_next_run_at` strictly after now

**auditLog:record:** Public Convex mutation added alongside the existing `internalMutation write`. Same args, same `ctx.db.insert('audit_log', ...)` body. Enables direct HTTP API calls from FastAPI without going through an internal mutation chain.

**main.py:** `control.router` mounted after existing routers.

**cli.py:** `trigger-weekly` repointed from `/run/weekly` to `/pipeline/tick`. Handles both `{"status":"triggered","runId":"..."}` and `{"status":"skipped","reason":"..."}` response shapes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Python monkeypatch `from X import name` binding issue**
- **Found during:** Task 2 test execution
- **Issue:** `control.py` and `runs.py` imported `convex_mutation/convex_query` via `from ... import`, creating local bindings unaffected by `monkeypatch.setattr(_cc, "convex_mutation", ...)`. Tests saw the original real function (no HTTP client in tests → `AttributeError: 'NoneType' has no attribute 'post'`).
- **Fix:** Changed `_start_run`, `snapshot_config`, `pipeline_run`, `pipeline_tick` to use `_cc.convex_mutation(...)` / `_cc.convex_query(...)` (module-level attribute lookup). The direct `from ... import` lines kept for other callers that pre-date this change.
- **Files modified:** `api/runs.py`, `api/control.py`, `lib/config_loader.py`
- **Commits:** `373a526`

**2. [Rule 2 - Missing error handling] `_resolve_issue_number` raised when Sanity env unset**
- **Found during:** Task 2 first test run
- **Issue:** `_resolve_issue_number(None)` calls `groq_query` which raises `RuntimeError("NEXT_PUBLIC_SANITY_PROJECT_ID not set")` when env is absent. Tests fail before any Convex assertions.
- **Fix:** Added env guard: when `NEXT_PUBLIC_SANITY_PROJECT_ID` is unset, returns 1 immediately with a warning (local dev / test mode). When set, actual Sanity read failures propagate (fail-loud contract preserved). Updated `test_resolve_issue_number_*` tests to call `monkeypatch.setenv("NEXT_PUBLIC_SANITY_PROJECT_ID", "fake-project-id")` so they proceed past the guard and invoke the mocked `groq_query`.
- **Files modified:** `api/runs.py`, `tests/api/test_runs.py`
- **Commits:** `373a526`

**3. [Rule 1 - Bug] Conftest fixture last-wins override**
- **Found during:** Task 2 test execution (after monkeypatch binding fix)
- **Issue:** Both `convex_runs_store` and `convex_config_store` patched the SAME `_cc.convex_mutation`. When both are used in a test, the second fixture's handler completely overrides the first. `runs:create` calls went to `config_store._handle_mutation` (which has no `runs:*` routing), so `convex_runs_store.all_calls()` was always empty.
- **Fix:** Rewrote both fixtures to capture the previously-installed handler (`prev_mutation = _cc.convex_mutation`) and install a routing dispatcher that routes by path prefix: `runs:*/agentRuns:*/pipelineRuns:*` → runs store; `pipelineConfig:*/auditLog:*` → config store; fallthrough to `prev_mutation`. The chain is additive regardless of fixture application order.
- **Files modified:** `tests/conftest.py`
- **Commits:** `373a526`

**4. [Rule 2 - Missing error handling] `_handle_mutation` signature mismatch**
- **Found during:** Task 2 test execution (after fixture chaining fix)
- **Issue:** `_handle_mutation(self, path, args)` took 2 args (without `http`), but `_cc.convex_mutation(http, path, args)` passes 3. When the bound method was used as replacement, it received `(http, path, args)` → mismatched as `(path, args, <extra>)`.
- **Fix:** Updated `_handle_mutation(self, http, path, args)` in both `_ConvexRunsStore` and `_ConvexConfigStore`; updated `_handle_mutation_safe` to pass `None` as `http`; updated direct call in `test_cancel.py` to pass `None` as first arg.
- **Files modified:** `tests/conftest.py`, `tests/test_cancel.py`
- **Commits:** `373a526`

**5. [Rule 1 - Bug] `test_runs_config_snapshot.py` patched local binding only**
- **Found during:** Post-fix regression run
- **Issue:** `test_snapshot_before_task` patched `runs.convex_mutation` (local name in `runs` module). After `_start_run` was changed to use `_cc.convex_mutation`, this patch no longer intercepted calls → real `convex_mutation` called with `MagicMock()` as `http` → `KeyError: 'CONVEX_DEPLOY_KEY'`.
- **Fix:** Added `monkeypatch.setattr(_cc, "convex_mutation", _convex_mock)` alongside the existing `runs` patch.
- **Files modified:** `tests/api/test_runs_config_snapshot.py`
- **Commits:** `373a526`

## Self-Check: PASSED

Files created/modified:
- [x] `packages/pipeline/src/eisenbalm_pipeline/api/control.py` — exists, contains `/pipeline/run` and `/pipeline/tick`
- [x] `packages/pipeline/src/eisenbalm_pipeline/lib/scheduler.py` — exists, contains `_is_due` and `compute_next_run_at`
- [x] `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` — contains `_start_run` and `_cc.*` imports
- [x] `packages/pipeline/src/eisenbalm_pipeline/api/main.py` — contains `control.router` include
- [x] `packages/pipeline/src/eisenbalm_pipeline/cli.py` — references `/pipeline/tick`
- [x] `convex/auditLog.ts` — contains `export const record = mutation({...})`
- [x] `packages/pipeline/tests/conftest.py` — contains chaining dispatch in both fixtures

Commits:
- [x] `5f4037e` — feat(25-02): extract _start_run helper and add lib/scheduler.py cadence engine
- [x] `373a526` — feat(25-02): add control.py /pipeline/run + /pipeline/tick with 5-step guard

Tests:
- [x] `test_manual_trigger_records_operator` — PASSED
- [x] `test_tick_kill_switch_noop` — PASSED
- [x] `test_is_due_fires_when_due` — PASSED
- [x] `test_is_due_skips_not_due` — PASSED
- [x] `test_next_run_cursor_advances` — PASSED
- [x] 316 other tests — all passed (33 skipped for missing env)
