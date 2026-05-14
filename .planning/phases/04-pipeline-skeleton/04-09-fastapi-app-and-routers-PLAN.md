---
phase: 04-pipeline-skeleton
plan: 09
type: execute
wave: 3
depends_on:
  - "04-02"
  - "04-06"
  - "04-07"
  - "04-08"
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/api/__init__.py
  - packages/pipeline/src/eisenbalm_pipeline/api/main.py
  - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
  - packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py
  - packages/pipeline/src/eisenbalm_pipeline/api/health.py
autonomous: true
requirements:
  - PIP-02
  - PIP-10
  - OPS-02
must_haves:
  truths:
    - "FastAPI app composes graph + checkpointer + httpx clients in a lifespan context manager (research §1 Pattern 1 verbatim)"
    - "`POST /run/weekly` generates run_id ONCE via new_run_id(), writes Convex pipelineRuns:create, launches an asyncio.create_task that runs graph.ainvoke (research §3 + Pattern 3 — strong-ref'd to survive client disconnect), returns {runId} immediately"
    - "`POST /run/{runId}/resume` calls graph.ainvoke(Command(resume=...), config={thread_id: runId}) per research §2 + Example 1; verifies state.next is non-empty (409 otherwise)"
    - "`GET /run/{runId}/status` reads Convex pipelineRuns:byRunId (CONTEXT D-07), returns the canonical response shape with optional lastEvent enrichment"
    - "`POST /run/{runId}/publish` is the manual fallback endpoint stub (Phase 6 wires real PDF logic); Phase 4 returns {ok: true} placeholder"
    - "`POST /webhook/sanity-publish` returns 200 immediately (Phase 6 hardens HMAC + idempotency)"
    - "`GET /healthz` returns 200 + {ok, checkpointer, stubMode} per CONTEXT D-34"
    - "All endpoints requiring auth honor X-Pipeline-Trigger-Secret header (CONTEXT D-31)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/main.py"
      provides: "FastAPI app + lifespan owning pool/checkpointer/graph/httpx clients"
      contains: "lifespan"
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/runs.py"
      provides: "POST /run/weekly, GET /run/{runId}/status, POST /run/{runId}/resume, POST /run/{runId}/publish"
      contains: "asyncio.create_task"
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py"
      provides: "POST /webhook/sanity-publish (Phase 4 stub, Phase 6 hardens)"
      contains: "/webhook/sanity-publish"
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/health.py"
      provides: "GET /healthz"
      contains: "/healthz"
  key_links:
    - from: "api/main.py lifespan"
      to: "graph/checkpointer.py + graph/builder.py + lib/sanity_client.py + lib/convex_client.py"
      via: "create_pool → assert_tables_exist → create_checkpointer → build_graph; set_client for sanity+convex"
      pattern: "build_graph"
    - from: "api/runs.py POST /run/weekly"
      to: "asyncio.create_task(_execute_run(...))"
      via: "Strong-ref'd in app.state.background_tasks set (research Pattern 3)"
      pattern: "background_tasks.add"
    - from: "api/runs.py POST /run/{runId}/resume"
      to: "graph.ainvoke(Command(resume=...), config={'configurable': {'thread_id': runId}})"
      via: "Re-runs the interrupted Editor gate 1 node (research §2)"
      pattern: "Command(resume="
---

<objective>
Compose the FastAPI app — lifespan-managed graph + checkpointer + httpx clients (research §1 Pattern 1), four routers (runs, webhooks, health, plus the main router include block), the asyncio.create_task background execution pattern (research §3 Pattern 3 — strongly preferred over CONTEXT D-06's BackgroundTasks), and full request body validation via Pydantic.

The two most critical correctness points:
1. **Run_id generated EXACTLY ONCE** inside POST /run/weekly via `new_run_id()` (CONTEXT D-09), then `pipelineRuns:create` mutation BEFORE the background task launches (research Anti-Patterns: "Forgetting to mark pipelineRuns:create BEFORE graph.ainvoke" — otherwise updateStatus on failure throws Run not found).
2. **Resume uses Command(resume=...) + thread_id == run_id** (research §2 + Example 1). The same Postgres checkpoint is loaded; the suspended editor node re-runs from the top.

Purpose: PIP-02 (`/run/weekly` returns {runId}), PIP-10 (Editor gate 1 interrupt/resume cycle), OPS-02 (GET /run/{runId}/status).
Output: A live FastAPI app that — given Supabase + Sanity + Convex env vars and the LangGraph checkpoint tables — runs an end-to-end stub pipeline locally via `uv run uvicorn eisenbalm_pipeline.api.main:app`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-pipeline-skeleton/04-CONTEXT.md
@.planning/phases/04-pipeline-skeleton/04-RESEARCH.md
@docs/API_CONTRACTS.md
@packages/pipeline/src/eisenbalm_pipeline/graph/state.py
@packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
@packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py
@packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
@packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
@packages/pipeline/src/eisenbalm_pipeline/lib/cost.py
@packages/pipeline/src/eisenbalm_pipeline/lib/ids.py
</context>

<tasks>

<task type="auto">
  <name>Task 1: api/__init__.py + api/main.py (lifespan + router includes — research Pattern 1)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/__init__.py, packages/pipeline/src/eisenbalm_pipeline/api/main.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Pattern 1" lines 198-289 — full lifespan reference (COPY VERBATIM, adapt env var names + module imports)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-33 (lifespan owns AsyncPostgresSaver, graph compile, httpx client pools, app.state.background_tasks set; shutdown disposes everything)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-34 (/healthz returns {ok, checkpointer, stubMode})
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-31 (env vars list — especially NEXT_PUBLIC_SANITY_PROJECT_ID and CONVEX_DEPLOY_KEY)
    - packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py (Plan 08 — create_pool, create_checkpointer, assert_tables_exist)
    - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py (Plan 08 — build_graph)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py + sanity_client.py (set_client functions from Plan 02 + Plan 07 Task 1)
  </read_first>
  <action>
    **`packages/pipeline/src/eisenbalm_pipeline/api/__init__.py`**: one docstring line: `"""FastAPI app + routers."""`

    **`packages/pipeline/src/eisenbalm_pipeline/api/main.py`** — research Pattern 1 adapted to call the Plan 08 factory functions:

    ```python
    """Eisenbalm Pipeline FastAPI app — lifespan composes everything.

    Source: 04-RESEARCH.md Pattern 1.
    """
    from __future__ import annotations
    import logging
    import os
    from contextlib import asynccontextmanager

    from fastapi import FastAPI
    from httpx import AsyncClient

    from eisenbalm_pipeline.graph.builder import build_graph
    from eisenbalm_pipeline.graph.checkpointer import (
        assert_tables_exist,
        create_checkpointer,
        create_pool,
    )
    from eisenbalm_pipeline.lib import convex_client, sanity_client
    from eisenbalm_pipeline.api import health, runs, webhooks

    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO"),
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    )
    log = logging.getLogger(__name__)


    @asynccontextmanager
    async def lifespan(app: FastAPI):
        log.info("Lifespan start: opening Postgres pool…")

        pool = create_pool(max_size=10)
        await pool.open()

        # Fail fast if setup-checkpointer hasn't been run (research Pitfall 3).
        await assert_tables_exist(pool)

        checkpointer = create_checkpointer(pool)
        graph = build_graph(checkpointer=checkpointer)

        # Shared httpx clients (one per process).
        convex_http = AsyncClient(
            base_url=os.environ["NEXT_PUBLIC_CONVEX_URL"].rstrip("/"),
            timeout=10.0,
        )
        sanity_project = os.environ["NEXT_PUBLIC_SANITY_PROJECT_ID"]
        sanity_http = AsyncClient(
            base_url=f"https://{sanity_project}.api.sanity.io",
            timeout=30.0,
        )

        # Register module-level singletons for agents to retrieve via get_client().
        convex_client.set_client(convex_http)
        sanity_client.set_client(sanity_http)

        app.state.graph = graph
        app.state.checkpointer = checkpointer
        app.state.pool = pool
        app.state.convex_http = convex_http
        app.state.sanity_http = sanity_http
        # Strong-ref set for asyncio.create_task'd background runs
        # (research Pattern 3 — prevents GC of fire-and-forget tasks).
        app.state.background_tasks = set()

        log.info("Lifespan ready: graph compiled, pools open, clients registered.")
        yield

        log.info("Lifespan shutdown…")
        for task in app.state.background_tasks:
            task.cancel()
        await convex_http.aclose()
        await sanity_http.aclose()
        await pool.close()
        log.info("Lifespan shutdown complete.")


    app = FastAPI(lifespan=lifespan, title="Eisenbalm Pipeline")
    app.include_router(runs.router)
    app.include_router(webhooks.router)
    app.include_router(health.router)
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.api.main import app, lifespan; import inspect; src = inspect.getsource(lifespan); assert 'create_pool' in src; assert 'assert_tables_exist' in src; assert 'build_graph' in src; assert 'background_tasks = set()' in src; assert 'convex_client.set_client' in src; assert 'sanity_client.set_client' in src; print('OK')"</automated>
  </verify>
  <done>
    - `api/main.py` defines `lifespan` async context manager that opens the pool, asserts tables, creates checkpointer, builds graph, constructs httpx clients, registers module-level singletons, and disposes everything on shutdown
    - `app.state.background_tasks: set` initialized (research Pattern 3 strong-ref set)
    - Three routers included: `runs.router`, `webhooks.router`, `health.router`
  </done>
</task>

<task type="auto">
  <name>Task 2: api/health.py — GET /healthz</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/health.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-34 (/healthz returns 200 with {ok: true, checkpointer: 'connected', stubMode: true})
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §9 "Healthcheck contract" (Railway expects 200 within 60s; failing healthcheck triggers restart loop)
    - packages/pipeline/src/eisenbalm_pipeline/stubs/fake_openrouter.py:is_stub_mode (Plan 06 — reads EISENBALM_STUB_MODE env var)
  </read_first>
  <action>
    Write `packages/pipeline/src/eisenbalm_pipeline/api/health.py`:

    ```python
    """GET /healthz — Railway healthcheck (CONTEXT D-34)."""
    from __future__ import annotations
    from fastapi import APIRouter, Request

    from eisenbalm_pipeline.stubs.fake_openrouter import is_stub_mode

    router = APIRouter()


    @router.get("/healthz")
    async def healthz(request: Request) -> dict:
        """Return 200 with lifespan health summary.

        CONTEXT D-34: {ok, checkpointer, stubMode}.
        """
        # Lifespan registered app.state.pool — if it's None, the lifespan
        # failed (probably env vars missing or Supabase unreachable).
        checkpointer_state = (
            "connected"
            if getattr(request.app.state, "checkpointer", None) is not None
            else "missing"
        )
        return {
            "ok": checkpointer_state == "connected",
            "checkpointer": checkpointer_state,
            "stubMode": is_stub_mode(),
        }
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.api.health import router; import inspect; src = inspect.getsource(router); print('OK router defined')"</automated>
  </verify>
  <done>
    - `api/health.py` exports `router: APIRouter`
    - `GET /healthz` returns `{ok: bool, checkpointer: str, stubMode: bool}` per CONTEXT D-34
    - Returns `ok=False` if the lifespan didn't initialize the checkpointer (degraded mode)
  </done>
</task>

<task type="auto">
  <name>Task 3: api/runs.py — POST /run/weekly, GET /run/{runId}/status, POST /run/{runId}/resume, POST /run/{runId}/publish</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/runs.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Pattern 3" lines 296-373 (asyncio.create_task with strong-ref set — COPY VERBATIM)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Example 1" lines ~770-810 (resume endpoint code — COPY VERBATIM)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-06 (BackgroundTasks vs create_task — research recommends create_task; CONTEXT lets planner choose; we pick create_task per research §3 recommendation since BackgroundTasks may be cancelled mid-failure-handling per Pitfall 4)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-07 (GET /run/{runId}/status reads Convex pipelineRuns:byRunId)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-08 (POST /run/{runId}/resume body shape: {selection: {charityName: str}})
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-09 (run_id generated exactly once)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-31 (X-Pipeline-Trigger-Secret header auth)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Anti-Patterns" ("Forgetting to mark pipelineRuns:create BEFORE graph.ainvoke" — CREATE must happen in the handler before the background task)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §2 (Command(resume=...) + graph.aget_state(config).next non-empty check for 409)
    - docs/API_CONTRACTS.md §3.1 pipelineRuns:create (args: runId, issueNumber, startedAt)
  </read_first>
  <action>
    Write `packages/pipeline/src/eisenbalm_pipeline/api/runs.py`:

    ```python
    """Pipeline run endpoints (CONTEXT D-06/07/08/09/31 + research §3 + §2 + Example 1)."""
    from __future__ import annotations
    import asyncio
    import logging
    import os
    import time
    from datetime import date, datetime, timezone
    from typing import Any, Optional

    from fastapi import APIRouter, HTTPException, Request, status
    from langgraph.types import Command
    from pydantic import BaseModel

    from eisenbalm_pipeline.lib.convex_client import convex_mutation, convex_query
    from eisenbalm_pipeline.lib.cost import begin_run
    from eisenbalm_pipeline.lib.ids import new_run_id

    log = logging.getLogger(__name__)
    router = APIRouter()


    # ── Request models (CONTEXT "Claude's Discretion" — BaseModel for /run/weekly) ──

    class RunWeeklyBody(BaseModel):
        issueNumber: int = 999  # CONTEXT D-16 default
        forceNoWinner: bool = False        # stub-mode toggle (D-36 test)
        forceFailAgent: Optional[str] = None  # stub-mode toggle (D-37 test)


    class ResumeSelection(BaseModel):
        charityName: str


    class ResumeBody(BaseModel):
        selection: ResumeSelection


    # ── Auth helper ────────────────────────────────────────────────────────────

    def _require_trigger_secret(request: Request) -> None:
        provided = request.headers.get("X-Pipeline-Trigger-Secret")
        expected = os.environ.get("PIPELINE_TRIGGER_SECRET")
        if not expected or not provided or provided != expected:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid X-Pipeline-Trigger-Secret",
            )


    # ── Background task wrapper (research Pattern 3) ──────────────────────────

    async def _execute_run(
        app: Any, run_id: str, initial_state: dict, config: dict
    ) -> None:
        """Background coroutine. Strong-ref'd in app.state.background_tasks
        so it survives client disconnect (research §3 + Pitfall 4)."""
        try:
            result = await app.state.graph.ainvoke(initial_state, config=config)
            # On interrupt: result contains __interrupt__. The Editor node already
            # wrote 'awaiting-review' to Convex (CONTEXT D-13). Nothing more here.
            # On clean completion: Publisher already wrote 'awaiting-review' (D-18 step 12).
            log.info(
                "Run %s background task complete (state.keys=%d)",
                run_id, len(result or {}),
            )
        except Exception:
            # The @agent_node wrapper already wrote 'failed' to Convex.
            # Let the task die quietly.
            log.exception("Run %s background task raised", run_id)


    # ── POST /run/weekly ──────────────────────────────────────────────────────

    @router.post("/run/weekly")
    async def run_weekly(request: Request, body: RunWeeklyBody) -> dict:
        """Trigger a new pipeline run. Returns {runId} immediately.

        Run continues in background (strong-ref'd asyncio.create_task).
        Poll GET /run/{runId}/status for terminal state.
        """
        _require_trigger_secret(request)

        # CONTEXT D-09: generated EXACTLY ONCE.
        run_id = new_run_id()
        started_at_ms = int(time.time() * 1000)

        # Mark cost-recording start (lib/cost — CONTEXT D-23).
        begin_run(run_id)

        # CRITICAL: insert pipelineRuns row BEFORE launching the graph (research
        # Anti-Patterns — otherwise the wrapper's failure path would call
        # updateStatus on a missing row, which throws "Run not found").
        await convex_mutation(
            request.app.state.convex_http,
            "pipelineRuns:create",
            {
                "runId": run_id,
                "issueNumber": body.issueNumber,
                "startedAt": started_at_ms,
            },
        )

        # Build initial DispatchState. Underscore-prefixed test toggles
        # carry the forceNoWinner / forceFailAgent flags through state.
        initial_state: dict = {
            "run_id": run_id,
            "issue_number": body.issueNumber,
            "publish_date": date.today().isoformat(),
            "pipeline_started_at": datetime.now(timezone.utc)
                .isoformat()
                .replace("+00:00", "Z"),
            "_force_no_winner": body.forceNoWinner,
            "_force_fail_agent": body.forceFailAgent,
        }
        config = {"configurable": {"thread_id": run_id}}

        # Pattern 3: strong-ref'd background task (research §3).
        task = asyncio.create_task(
            _execute_run(request.app, run_id, initial_state, config)
        )
        request.app.state.background_tasks.add(task)
        task.add_done_callback(request.app.state.background_tasks.discard)

        return {"runId": run_id}


    # ── GET /run/{run_id}/status ─────────────────────────────────────────────

    @router.get("/run/{run_id}/status")
    async def run_status(request: Request, run_id: str) -> dict:
        """Return current pipeline state (CONTEXT D-07 + OPS-02).

        Reads Convex pipelineRuns:byRunId. Optionally enriches with the latest
        deliberationEvents event for visibility.
        """
        # Anyone can call status (no trigger-secret) — public-ish read endpoint
        # behind Railway URL obscurity (CONTEXT "v1 has no users").

        # CONTEXT D-07: Convex is the canonical source for run status.
        row = await convex_query(
            request.app.state.convex_http,
            "pipelineRuns:byRunId",
            {"runId": run_id},
        )
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Run not found: {run_id}",
            )

        response = {
            "runId": row.get("runId"),
            "status": row.get("status"),
            "startedAt": row.get("startedAt"),
            "completedAt": row.get("completedAt"),
            "durationMs": row.get("durationMs"),
            "errorMessage": row.get("errorMessage"),
        }
        return response


    # ── POST /run/{run_id}/resume — research §2 + Example 1 ─────────────────

    @router.post("/run/{run_id}/resume")
    async def resume_run(
        request: Request, run_id: str, body: ResumeBody
    ) -> dict:
        """Resume a paused (interrupted) pipeline run.

        The graph for this run_id was paused inside Editor gate 1 via
        interrupt(). This endpoint passes Command(resume=...) into a fresh
        graph.ainvoke with the SAME thread_id, which causes LangGraph to
        load the checkpoint and re-run the editor node — interrupt() returns
        the resume value this time (research §2).
        """
        _require_trigger_secret(request)

        config = {"configurable": {"thread_id": run_id}}

        # Sanity check: is this thread actually paused? (research §2 race-cond
        # mitigation — empty state.next means the graph has moved past the
        # interrupt and a resume would be a no-op-or-worse.)
        state = await request.app.state.graph.aget_state(config)
        if not state or not state.next:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Run {run_id} is not paused (state.next is empty)",
            )

        resume_payload = {"editorSelection": body.selection.charityName}

        async def _resume_run_task() -> None:
            try:
                await request.app.state.graph.ainvoke(
                    Command(resume=resume_payload),
                    config=config,
                )
            except Exception:
                log.exception("Resume task for %s raised", run_id)

        task = asyncio.create_task(_resume_run_task())
        request.app.state.background_tasks.add(task)
        task.add_done_callback(request.app.state.background_tasks.discard)

        return {"runId": run_id, "resumed": True}


    # ── POST /run/{run_id}/publish — manual fallback stub (Phase 6 hardens) ──

    @router.post("/run/{run_id}/publish")
    async def manual_publish(request: Request, run_id: str) -> dict:
        """Manual fallback re-trigger (CONTEXT D-05 + WHK-08).

        Phase 4 stub: returns 200 with a marker payload. Phase 6 wires this
        to invoke the Publisher node directly (re-runs PDF generation +
        Vercel deploy hook fire even when the Sanity webhook fails to fire).
        """
        _require_trigger_secret(request)
        log.info("Manual publish requested for runId=%s — Phase 6 stub", run_id)
        return {
            "runId": run_id,
            "phase4Stub": True,
            "note": (
                "POST /run/{runId}/publish is a Phase 4 endpoint stub. "
                "Phase 6 wires the real PDF generation + Vercel deploy hook."
            ),
        }
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.api.runs import router, _execute_run, RunWeeklyBody, ResumeBody, ResumeSelection; import inspect; src = inspect.getsource(_execute_run); assert 'ainvoke' in src; src2 = inspect.getsource(router); print('OK'); from fastapi import FastAPI; app = FastAPI(); app.include_router(router); routes = [r.path for r in app.routes if hasattr(r, 'path')]; assert '/run/weekly' in routes; assert '/run/{run_id}/status' in routes; assert '/run/{run_id}/resume' in routes; assert '/run/{run_id}/publish' in routes; print('all 4 routes registered')"</automated>
  </verify>
  <done>
    - `api/runs.py` exports `router` with 4 routes: `/run/weekly`, `/run/{run_id}/status`, `/run/{run_id}/resume`, `/run/{run_id}/publish`
    - `POST /run/weekly`: generates run_id via `new_run_id()`, calls `begin_run(run_id)`, inserts Convex `pipelineRuns:create` BEFORE the background task, returns `{runId}` immediately
    - `POST /run/{runId}/resume`: validates `state.next` is non-empty (409 otherwise), calls `graph.ainvoke(Command(resume={editorSelection: ...}), config={thread_id: run_id})`
    - `GET /run/{runId}/status`: reads Convex `pipelineRuns:byRunId`, returns 404 if no row
    - `POST /run/{runId}/publish`: Phase 4 stub returning placeholder payload (Phase 6 hardens)
    - Trigger-secret auth on weekly/resume/publish; status endpoint is public-read
  </done>
</task>

<task type="auto">
  <name>Task 4: api/webhooks.py — POST /webhook/sanity-publish (Phase 4 stub, Phase 6 hardens)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md "Strictly NOT in this phase" (Phase 4 only ships the endpoint stub — Phase 6 wires HMAC + age check + idempotency + 30s delay)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md "Phase 6 forward link" (POST /webhook/sanity-publish endpoint stub at api/webhooks.py returning {ok: true})
    - docs/API_CONTRACTS.md §5.3 (FastAPI handler signature — for Phase 6's reference)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Phase 6 forward link" (Plan 4 ships the route stub so Phase 6 doesn't churn the router)
  </read_first>
  <action>
    Write `packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py`:

    ```python
    """Sanity webhook receiver (Phase 4 stub; Phase 6 hardens).

    Phase 4 endpoint shape only — returns 200 with a marker payload so:
      1. Sanity webhook configuration tests against this URL pass.
      2. The route lives at the correct path for Phase 6 to wire.

    Phase 6 will add HMAC verification, sanity-transaction-time age check,
    idempotency-key deduplication via Supabase, 30s delay before Vercel
    deploy hook, and actual Publisher trigger. See API_CONTRACTS §5.3.
    """
    from __future__ import annotations
    import logging

    from fastapi import APIRouter, Request

    log = logging.getLogger(__name__)
    router = APIRouter()


    @router.post("/webhook/sanity-publish")
    async def sanity_publish(request: Request) -> dict:
        """Phase 4 stub — returns 200 immediately.

        Phase 6 will:
          - Verify HMAC against SANITY_WEBHOOK_SECRET using request.body() raw
          - Reject if sanity-transaction-time is older than 5 minutes
          - Deduplicate via idempotency-key header
          - Wait 30 seconds before triggering Vercel deploy hook
          - Invoke Publisher node for the runId in payload
        """
        log.info(
            "POST /webhook/sanity-publish (Phase 4 stub) — headers=%s",
            dict(request.headers),
        )
        return {
            "ok": True,
            "phase4Stub": True,
            "note": (
                "POST /webhook/sanity-publish is a Phase 4 endpoint stub. "
                "Phase 6 wires the full HMAC + idempotency + Vercel deploy chain."
            ),
        }
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.api.webhooks import router; from fastapi import FastAPI; app = FastAPI(); app.include_router(router); routes = [r.path for r in app.routes if hasattr(r, 'path')]; assert '/webhook/sanity-publish' in routes; print('OK')"</automated>
  </verify>
  <done>
    - `api/webhooks.py` exports `router` with `POST /webhook/sanity-publish`
    - Phase 4 stub returns 200 with `{ok: true, phase4Stub: true, note: ...}`
    - Comments document the Phase 6 hardening contract (HMAC, age, idempotency, delay)
  </done>
</task>

</tasks>

<verification>
After all four tasks:

1. `cd packages/pipeline && uv run python -c "
from eisenbalm_pipeline.api.main import app
routes = sorted(r.path for r in app.routes if hasattr(r, 'path'))
print('Routes:', routes)
assert '/run/weekly' in routes
assert '/run/{run_id}/status' in routes
assert '/run/{run_id}/resume' in routes
assert '/run/{run_id}/publish' in routes
assert '/webhook/sanity-publish' in routes
assert '/healthz' in routes
print('all 6 routes registered')
"` succeeds.

2. `grep -F "asyncio.create_task" packages/pipeline/src/eisenbalm_pipeline/api/runs.py` succeeds (research Pattern 3).

3. `grep -F "Command(resume=" packages/pipeline/src/eisenbalm_pipeline/api/runs.py` succeeds (research §2).

4. `grep -F "pipelineRuns:create" packages/pipeline/src/eisenbalm_pipeline/api/runs.py` succeeds (Anti-Patterns — create before background task).

5. `cd packages/pipeline && uv run pytest -v` still exits 0 (Plan 05 tests still skipped; no regression).

Note: importing `eisenbalm_pipeline.api.main` will now succeed at import time, but the lifespan body won't execute until uvicorn starts. The Plan 05 `client` fixture's `pytest.skip` guard on missing env vars + the ImportError catch are both still relevant — the import succeeds, but the lifespan will fail if env vars aren't set.
</verification>

<success_criteria>
- PIP-02 evidence: `POST /run/weekly` returns `{runId}` (verified by route registration test; Plan 10 integration test executes against the live app).
- PIP-10 evidence: `POST /run/{runId}/resume` uses `Command(resume=...)` with `thread_id=run_id` (research §2 + Example 1).
- OPS-02 evidence: `GET /run/{runId}/status` reads Convex `pipelineRuns:byRunId` and returns the canonical response shape.
- Lifespan composes Plan 02 + Plan 08 cleanly: pool → assert_tables_exist → checkpointer → graph; httpx clients + module-level singletons; strong-ref background_tasks set.
- `asyncio.create_task` chosen over `BackgroundTasks` per research §3 recommendation (CONTEXT D-06 allowed planner discretion; documented in SUMMARY).
- Phase 6 forward stub: `POST /webhook/sanity-publish` exists at the canonical path.
</success_criteria>

<output>
Create `.planning/phases/04-pipeline-skeleton/04-09-fastapi-app-and-routers-SUMMARY.md` recording:
- The decision to use `asyncio.create_task` over `BackgroundTasks` (planner discretion per CONTEXT D-06; rationale from research §3 + Pitfall 4)
- All 6 registered routes (verified by route enumeration test)
- Forward link to Plan 10 (integration tests replace `@pytest.mark.skip` decorators in Plan 05's scaffolds and exercise these endpoints in-process via ASGITransport)
</output>
