---
phase: 04-pipeline-skeleton
plan: 09
subsystem: api
tags: [fastapi, langgraph, asyncio, uvicorn, httpx, pydantic, lifespan]

# Dependency graph
requires:
  - phase: 04-pipeline-skeleton
    provides: "DispatchState, new_run_id, convex_client/sanity_client set_client, begin_run (Plan 02)"
  - phase: 04-pipeline-skeleton
    provides: "@agent_node wrapper + 14 stub agents incl. editor_gate_1 interrupt() (Plans 06/07)"
  - phase: 04-pipeline-skeleton
    provides: "build_graph(checkpointer), create_pool/create_checkpointer/assert_tables_exist (Plan 08)"
provides:
  - "FastAPI app importable as eisenbalm_pipeline.api.main:app (uvicorn entrypoint)"
  - "Lifespan composing pool -> assert_tables_exist -> checkpointer -> graph -> shared httpx clients -> app.state"
  - "POST /run/weekly — generates run_id, Convex pipelineRuns:create, asyncio.create_task background run, returns {runId}"
  - "GET /run/{runId}/status — reads Convex pipelineRuns:byRunId (OPS-02)"
  - "POST /run/{runId}/resume — Command(resume=...) into the paused graph with 409 race-guard (PIP-10)"
  - "POST /run/{runId}/publish — Phase 4 manual-fallback stub"
  - "POST /webhook/sanity-publish — Phase 4 endpoint stub"
  - "GET /healthz — Railway healthcheck reporting {ok, checkpointer, stubMode}"
affects: [04-10-integration-tests, 04-12-smoke-test, phase-05-real-agents, phase-06-publisher-webhook]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lifespan-owned graph + checkpointer + httpx clients (research §1 Pattern 1)"
    - "asyncio.create_task with strong-ref app.state.background_tasks set (research §3 Pattern 3)"
    - "Command(resume=...) + thread_id==run_id resume with aget_state().next 409 guard (research §2)"
    - "Graceful-degradation lifespan: degraded boot leaves app.state.graph=None instead of crashing"

key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/api/__init__.py
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
    - packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py
    - packages/pipeline/src/eisenbalm_pipeline/api/health.py
  modified: []

key-decisions:
  - "asyncio.create_task chosen over FastAPI BackgroundTasks (CONTEXT D-06 planner discretion; research §3 + Pitfall 4 rationale)"
  - "Lifespan degrades gracefully when SUPABASE_POSTGRES_URL is missing — boots with app.state.graph=None so /healthz responds and the test-suite import succeeds"
  - "_require_trigger_secret skips the check (logged warning) when PIPELINE_TRIGGER_SECRET is unset, so local dev works without provisioning the secret"
  - "_require_graph 503 guard surfaces degraded-mode boots on /run/weekly and /run/{runId}/resume instead of an opaque AttributeError"

patterns-established:
  - "Pattern 1: FastAPI lifespan owns pool/checkpointer/graph/httpx clients for the process lifetime; shutdown disposes in reverse order"
  - "Pattern 3: fire-and-forget graph runs via asyncio.create_task strong-ref'd in app.state.background_tasks with add_done_callback(discard)"
  - "Resume race-guard: aget_state(config).next must be non-empty or the endpoint returns 409"

requirements-completed: [PIP-02, PIP-10, OPS-02]

# Metrics
duration: 9min
completed: 2026-05-14
---

# Phase 4 Plan 09: FastAPI App and Routers Summary

**FastAPI app whose lifespan composes the Postgres-backed LangGraph + shared httpx clients, exposing /run/weekly (asyncio.create_task background run), /run/{runId}/resume (Command(resume=...) with 409 race-guard), /run/{runId}/status (Convex byRunId), plus publish/webhook stubs and /healthz.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-14T03:05:00Z
- **Completed:** 2026-05-14T03:14:00Z
- **Tasks:** 4
- **Files modified:** 5 (all created)

## Accomplishments

- FastAPI app importable as `eisenbalm_pipeline.api.main:app` — the conftest.py import that Plan 05 wrapped defensively now succeeds.
- Lifespan composes Plan 02 + Plan 08 cleanly: `create_pool` -> `assert_tables_exist` -> `create_checkpointer` -> `build_graph` -> shared Convex + Sanity `AsyncClient`s injected via `set_client` -> everything on `app.state` incl. the strong-ref `background_tasks` set.
- All 6 routes registered and verified: `/run/weekly`, `/run/{run_id}/status`, `/run/{run_id}/resume`, `/run/{run_id}/publish`, `/webhook/sanity-publish`, `/healthz`.
- `POST /run/weekly` generates `run_id` exactly once, writes `pipelineRuns:create` BEFORE the background task launches (research Anti-Pattern compliance), then spawns a strong-ref'd `asyncio.create_task`.
- `POST /run/{runId}/resume` uses `Command(resume={'editorSelection': ...})` with `thread_id == run_id` and the `aget_state().next` 409 race-guard.
- Pytest still green: 25 skipped, 0 failed (Plan 10 fills the assertions).

## Task Commits

Committed in dependency order (routers before main.py so each commit is internally consistent):

1. **Task 2: api/health.py** — `08fabb0` (feat)
2. **Task 3: api/runs.py** — `9ebcef0` (feat)
3. **Task 4: api/webhooks.py** — `496ba7f` (feat)
4. **Task 1: api/__init__.py + api/main.py** — committed after routers (feat)

**Plan metadata:** see final docs commit.

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/api/__init__.py` - One-line package docstring.
- `packages/pipeline/src/eisenbalm_pipeline/api/main.py` - FastAPI app + lifespan; composes pool/checkpointer/graph/httpx clients, includes the 3 routers, graceful degradation when Supabase env is missing.
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` - 4 run-lifecycle endpoints; `_execute_run` background coroutine, `_require_trigger_secret` + `_require_graph` guards, Pydantic `RunWeeklyBody`/`ResumeBody`/`ResumeSelection`.
- `packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` - `POST /webhook/sanity-publish` Phase 4 stub with `TODO(Phase 6)` hardening contract.
- `packages/pipeline/src/eisenbalm_pipeline/api/health.py` - `GET /healthz` returning `{ok, checkpointer, stubMode}` per CONTEXT D-34.

## Decisions Made

- **`asyncio.create_task` over `BackgroundTasks`** — CONTEXT D-06 explicitly defers this to the executor; research §3 + Pitfall 4 recommend `create_task` because `BackgroundTasks` is cancelled on client disconnect, which can strand `pipelineRuns.status='running'` forever. Tasks are strong-ref'd in `app.state.background_tasks` with `add_done_callback(discard)`.
- **Graceful-degradation lifespan** — the `important_notes` for this plan required that a missing `SUPABASE_POSTGRES_URL` not crash the app. The plan's Task 1 code block did not include this, so the lifespan was wrapped in try/except: on failure it logs a clear warning, best-effort cleans up partial resources, and boots with `app.state.graph = None`. This is what makes `from eisenbalm_pipeline.api.main import app` succeed in the test suite without provisioned env vars.
- **`_require_graph` 503 guard** — degraded-mode boots surface as a clean 503 on `/run/weekly` and `/run/{runId}/resume` rather than an `AttributeError` on `None.ainvoke`.
- **`_require_trigger_secret` skips when the env var is unset** — per `important_notes`, local dev without `PIPELINE_TRIGGER_SECRET` is allowed (logged warning); any environment that sets the secret still enforces it.
- **`/status` response includes `cost`** — `important_notes` listed `cost?` in the canonical shape; the row field is surfaced alongside `durationMs` and `errorMessage`.

## Deviations from Plan

The plan's Task code blocks were followed structurally; the deviations below are
additive functionality the plan's `important_notes` mandated but the inline code
blocks omitted.

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Graceful-degradation lifespan + `_require_graph` 503 guard**
- **Found during:** Task 1 (api/main.py) and Task 3 (api/runs.py)
- **Issue:** The plan's Task 1 code block opened the pool and read `os.environ[...]` unguarded — a missing `SUPABASE_POSTGRES_URL` (or any required env var) would raise inside the lifespan and crash the app at startup. The plan's own `important_notes` and `success_criteria` require that the app still boot in degraded mode so `/healthz` responds and the test suite's `from eisenbalm_pipeline.api.main import app` import succeeds.
- **Fix:** Wrapped the lifespan body in try/except: on failure, log a clear warning, best-effort close any partially-constructed httpx clients / pool, and set `app.state.graph = app.state.pool = app.state.checkpointer = None`. Added `_require_graph(request)` in `runs.py` that raises HTTP 503 when `app.state.graph is None`, called by `/run/weekly` and `/run/{runId}/resume`.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/api/main.py`, `packages/pipeline/src/eisenbalm_pipeline/api/runs.py`
- **Verification:** `uv run python -c "from eisenbalm_pipeline.api.main import app; print(type(app).__name__)"` prints `FastAPI` with no env vars set; `uv run pytest -v` exits 0 (25 skipped).
- **Committed in:** Task 1 + Task 3 commits.

**2. [Rule 2 - Missing Critical] `_require_trigger_secret` no-op when `PIPELINE_TRIGGER_SECRET` is unset**
- **Found during:** Task 3 (api/runs.py)
- **Issue:** The plan's Task 3 code block raised 401 whenever `expected` was falsy (`if not expected or ...`). The `important_notes` require that, in local dev where the env var is unset, the check be *skipped* (with a logged warning) so the app is usable without provisioning the secret.
- **Fix:** `_require_trigger_secret` returns early with a logged warning when `PIPELINE_TRIGGER_SECRET` is unset; only enforces the header (401 on mismatch/missing) when the secret is configured.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/api/runs.py`
- **Verification:** Route registration + import checks pass; pytest green.
- **Committed in:** Task 3 commit.

---

**Total deviations:** 2 auto-fixed (both Rule 2 — missing critical functionality the plan's `important_notes`/`success_criteria` mandated but the inline code blocks omitted).
**Impact on plan:** Both deviations are required by the plan's own stated success criteria. No scope creep — they make the documented behavior actually true.

## Issues Encountered

- The plan's Task 2 verification command `inspect.getsource(router)` raises `TypeError` because `inspect.getsource` cannot introspect an `APIRouter` instance (only modules/classes/functions/code). The router IS correctly defined; verified instead via `isinstance(router, APIRouter)` + route-registration enumeration. This is a flaw in the plan's verify command, not the code.

## Known Stubs

These are **intentional, plan-mandated Phase 4 endpoint stubs** with explicit
forward links to Phase 6 — not blocking gaps. The plan's `must_haves.truths` and
`important_notes` explicitly scope them as route-shape-only for Phase 4.

- `api/webhooks.py` `POST /webhook/sanity-publish` — returns `{ok: true, phase4Stub: true, note}`; no HMAC / age check / idempotency. `TODO(Phase 6)` comment marks the hardening contract. Resolved by Phase 6 (webhook handler).
- `api/runs.py` `POST /run/{runId}/publish` — returns `{runId, phase4Stub: true, note}`; does not invoke the Publisher node. Resolved by Phase 6 (real PDF generation + Vercel deploy hook).

## User Setup Required

None - no external service configuration required by this plan. (Railway + Supabase provisioning is the separate manual checkpoint covered by Plan 04-12 / CONTEXT D-29/D-30.)

## Next Phase Readiness

- **Plan 10 (integration tests):** the in-process `client` fixture in `tests/conftest.py` now activates — `from eisenbalm_pipeline.api.main import app` succeeds. Plan 10 replaces the `@pytest.mark.skip` scaffolds and exercises `/run/weekly`, `/run/{runId}/status`, `/run/{runId}/resume`, and the failure path in-process via `ASGITransport`.
- **Phase 5 (real agents):** the `@agent_node` wrapper and graph are untouched by this plan; Phase 5 only swaps agent bodies. The lifespan + endpoints are stable.
- **Phase 6 (publisher + webhook):** the two stub routes (`/run/{runId}/publish`, `/webhook/sanity-publish`) exist at their canonical paths so Phase 6 hardens bodies without churning the router.

## Self-Check: PASSED

- All 5 created files verified present on disk.
- Task commits verified in git history: `08fabb0` (health), `9ebcef0` (runs), `496ba7f` (webhooks), `4385af1` (main + __init__).

---
*Phase: 04-pipeline-skeleton*
*Completed: 2026-05-14*
