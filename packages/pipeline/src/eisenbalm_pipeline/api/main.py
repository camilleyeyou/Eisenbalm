"""Eisenbalm Pipeline FastAPI app — lifespan composes everything.

Source: 04-RESEARCH.md Pattern 1.

Lifespan startup order (CONTEXT D-33 + research §1 Pattern 1):
  1. create_pool(...) + pool.open()        — Supabase Postgres connection pool
  2. assert_tables_exist(pool)             — fail-fast if setup-checkpointer skipped
  3. create_checkpointer(pool)             — AsyncPostgresSaver(pool)
  4. build_graph(checkpointer)             — compile ONCE, reuse across requests
  5. httpx.AsyncClient(...) x2             — shared Convex + Sanity clients,
                                             injected via set_client()
  6. store everything on app.state         — graph, pool, http clients,
                                             background_tasks set

Graceful degradation: if SUPABASE_POSTGRES_URL is unset (local dev without
provisioning), the lifespan logs a clear warning and starts anyway with
app.state.graph = None — so /healthz still responds and the test suite's
`from eisenbalm_pipeline.api.main import app` import does not crash.
/run/weekly returns 503 when app.state.graph is None.
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from httpx import AsyncClient

from eisenbalm_pipeline.api import agents, control, health, review, runs, webhooks
from eisenbalm_pipeline.graph.builder import build_graph
from eisenbalm_pipeline.graph.checkpointer import (
    assert_tables_exist,
    create_checkpointer,
    create_pool,
)
from eisenbalm_pipeline.lib import convex_client, sanity_client

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Compose graph + checkpointer + httpx clients for the process lifetime.

    On clean startup app.state.graph is the compiled StateGraph. On degraded
    startup (no SUPABASE_POSTGRES_URL, or Supabase unreachable) app.state.graph
    is None and app.state.pool is None — the app still boots so /healthz can
    report the degraded state and the test suite's module import succeeds.
    """
    # Defaults for the degraded path — overwritten below on clean startup.
    pool = None
    checkpointer = None
    graph = None
    convex_http: AsyncClient | None = None
    sanity_http: AsyncClient | None = None

    try:
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

        # Register module-level singletons for agents to retrieve via
        # get_client() — convex_client + sanity_client own the _CLIENT global.
        convex_client.set_client(convex_http)
        sanity_client.set_client(sanity_http)

        log.info(
            "Lifespan ready: graph compiled, pools open, clients registered."
        )
    except Exception as exc:  # noqa: BLE001 — degraded boot is intentional
        # Degraded mode: log loudly, leave app.state.graph = None, keep booting.
        # /healthz reports checkpointer='missing'; /run/weekly returns 503.
        log.warning(
            "Lifespan degraded — pipeline graph NOT available "
            "(env vars missing or Supabase unreachable): %r. "
            "/healthz will report degraded; /run/weekly will return 503. "
            "This is expected for local dev without provisioning.",
            exc,
        )
        # Best-effort cleanup of anything partially constructed.
        if convex_http is not None:
            await convex_http.aclose()
            convex_http = None
        if sanity_http is not None:
            await sanity_http.aclose()
            sanity_http = None
        if pool is not None:
            try:
                await pool.close()
            except Exception:  # noqa: BLE001
                pass
            pool = None
        checkpointer = None
        graph = None

    app.state.graph = graph
    app.state.checkpointer = checkpointer
    app.state.pool = pool
    app.state.convex_http = convex_http
    app.state.sanity_http = sanity_http
    # Strong-ref set for asyncio.create_task'd background runs
    # (research Pattern 3 — prevents GC of fire-and-forget tasks).
    app.state.background_tasks = set()

    yield

    log.info("Lifespan shutdown…")
    for task in app.state.background_tasks:
        task.cancel()
    if convex_http is not None:
        await convex_http.aclose()
    if sanity_http is not None:
        await sanity_http.aclose()
    if pool is not None:
        await pool.close()
    log.info("Lifespan shutdown complete.")


app = FastAPI(lifespan=lifespan, title="Eisenbalm Pipeline")

# CORS for the dispatch-control dashboard (a browser app on a different Vercel
# origin) calling /agents/{key}/test-run, /agents/{key}/score, /pipeline/run,
# /runs/*, and /review with a Clerk `Authorization: Bearer` token.
#
# allow_credentials=True forbids a wildcard "*" origin — Starlette will NOT echo
# "*" when credentials are allowed — so allow_origins MUST be an explicit list.
# The dashboard sends an Authorization: Bearer Clerk token, hence
# allow_headers=["*"]. Origins are read from DASHBOARD_ALLOWED_ORIGINS
# (comma-separated), defaulting to http://localhost:3000 when unset/blank.
_dashboard_origins = [
    origin.strip()
    for origin in os.environ.get("DASHBOARD_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
if not _dashboard_origins:
    _dashboard_origins = ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_dashboard_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(runs.router)
app.include_router(webhooks.router)
app.include_router(health.router)
app.include_router(agents.router)
app.include_router(control.router)
app.include_router(review.router)
