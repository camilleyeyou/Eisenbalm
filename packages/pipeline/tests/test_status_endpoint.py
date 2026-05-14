"""GET /run/{runId}/status (OPS-02 + CONTEXT D-07).

Two test functions, split by environment requirement:

  test_status_endpoint_nonexistent_runid
    The 404-on-unknown-runId case. Runs locally with ZERO external deps —
    it patches eisenbalm_pipeline.api.runs.convex_query to return None and
    mounts the runs router on a bare FastAPI app (no lifespan, so no
    Supabase / Convex / Sanity needed). This is the OPS-02 contract proof
    that does not depend on Plan 12 provisioning.

  test_status_endpoint_returns_current_state
    The full-lifecycle response-shape case. Drives a real run through the
    graph, so it needs the AsyncPostgresSaver checkpointer — guarded by the
    module-level skipif on SUPABASE_POSTGRES_URL (runs in Plan 12).

Source: 04-CONTEXT.md D-07 + D-34 + Plan 09 api/runs.py (raises 404 on
missing runId).
"""
from __future__ import annotations

import asyncio
import os
import time

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from eisenbalm_pipeline.api import runs


# ── 404 case — no external deps, always runs locally ──────────────────────


async def test_status_endpoint_nonexistent_runid(monkeypatch):
    """OPS-02: GET against an unknown runId returns 404 (CONTEXT D-07 + Plan 09).

    Fully self-contained: patches convex_query to return None and mounts the
    runs router on a lifespan-free app, so this exercises the real route
    handler without needing Supabase / Convex / Sanity provisioned.
    """

    async def _fake_convex_query(http, path, args):  # noqa: ANN001
        # Mirrors a Convex byRunId miss: the query succeeds, value is None.
        return None

    monkeypatch.setattr(runs, "convex_query", _fake_convex_query)

    app = FastAPI()
    app.include_router(runs.router)
    # The handler reads request.app.state.convex_http; our fake ignores it,
    # but the attribute must exist for getattr-free access paths.
    app.state.convex_http = None

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.get("/run/nonexistent-runid-test/status")

    assert r.status_code == 404, r.text
    assert "Run not found" in (r.json().get("detail") or "")


# ── Full-lifecycle response-shape case — needs the graph (Plan 12) ────────


_needs_supabase = pytest.mark.skipif(
    not os.environ.get("SUPABASE_POSTGRES_URL"),
    reason=(
        "SUPABASE_POSTGRES_URL not set — full-lifecycle status check drives "
        "the graph and needs the AsyncPostgresSaver checkpointer; Supabase is "
        "provisioned in Plan 12 (Andrew's manual step)."
    ),
)


def _unique_issue_number() -> int:
    return 999000 + (int(time.time()) % 100000)


@_needs_supabase
async def test_status_endpoint_returns_current_state(
    client, convex_query_fn, sanity_cleanup
):
    """OPS-02: GET /run/{runId}/status returns the canonical response shape."""
    issue_number = _unique_issue_number()
    try:
        r = await client.post(
            "/run/weekly", json={"issueNumber": issue_number}
        )
        run_id = r.json()["runId"]

        # Status shortly after trigger — 'running', or already advanced if the
        # stub graph completed extremely fast.
        await asyncio.sleep(0.2)
        r = await client.get(f"/run/{run_id}/status")
        assert r.status_code == 200, r.text
        body = r.json()
        # Required keys per CONTEXT D-07 + Plan 09 runs.py response shape.
        for key in (
            "runId",
            "status",
            "startedAt",
            "completedAt",
            "durationMs",
            "cost",
            "errorMessage",
        ):
            assert key in body, f"Missing key {key} in status response"
        assert body["runId"] == run_id
        assert body["status"] in {
            "running",
            "awaiting-review",
            "complete",
            "failed",
        }
        assert isinstance(body["startedAt"], (int, float))
    finally:
        await sanity_cleanup(issue_number)
