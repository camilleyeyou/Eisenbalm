"""End-to-end pipeline test (PIP-02, PIP-05, PIP-06, PIP-07, PIP-08, PIP-11, PIP-12).

Strategy (research §10):
  - In-process via ASGITransport (client fixture from conftest.py)
  - Hit real production Sanity + Convex
  - Use unique issueNumber = 999000 + (time % 100000) to avoid clobbering demo
  - Stub Publisher leaves status='awaiting-review' (CONTEXT D-18 step 12)
  - Clean up via sanity_cleanup fixture; Convex rows stay (scoped to runId)

Environment reality (Plan 12 forward link):
  These tests drive the full LangGraph graph, which needs a live
  AsyncPostgresSaver checkpointer against Supabase Postgres. Supabase + Railway
  are provisioned manually in Plan 12 (Andrew's step). Until then the
  module-level skipif guard below skips this file with a descriptive reason —
  belt-and-suspenders on top of conftest's per-fixture env-var skip. When
  SUPABASE_POSTGRES_URL is present (Plan 12 smoke test, or a fully-provisioned
  local env) every assertion below runs for real.

Source: 04-CONTEXT.md D-35, 04-RESEARCH.md "Example 4", 04-VALIDATION.md.
"""
from __future__ import annotations

import asyncio
import json
import os
import time

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("SUPABASE_POSTGRES_URL"),
    reason=(
        "SUPABASE_POSTGRES_URL not set — full-graph e2e requires the "
        "AsyncPostgresSaver checkpointer; Supabase is provisioned in Plan 12 "
        "(Andrew's manual step). Runs green in Plan 12's smoke test."
    ),
)


POLL_INTERVAL_S = 0.5
# Plan-checker NOTE-7: 60s, not 30s — the stub graph fans out 7 writers and
# does ~15 Convex round-trips; 30s is tight on a cold connection pool.
POLL_TIMEOUT_S = 60.0
TERMINAL_STATES = {"awaiting-review", "complete", "failed"}


async def _poll_until_terminal(client, run_id: str) -> dict:
    """Poll GET /run/{run_id}/status until terminal or timeout. Returns final row."""
    deadline = time.monotonic() + POLL_TIMEOUT_S
    last_status: dict = {}
    while time.monotonic() < deadline:
        r = await client.get(f"/run/{run_id}/status")
        assert r.status_code == 200, f"status endpoint failed: {r.status_code}"
        last_status = r.json()
        if last_status.get("status") in TERMINAL_STATES:
            return last_status
        await asyncio.sleep(POLL_INTERVAL_S)
    raise TimeoutError(
        f"Run {run_id} did not reach terminal in {POLL_TIMEOUT_S}s; "
        f"last_status={last_status}"
    )


def _unique_issue_number() -> int:
    # CONTEXT D-35: 999000 + (int(time.time()) % 100000) — cheap unique
    return 999000 + (int(time.time()) % 100000)


async def test_returns_runId(client):
    """PIP-02: POST /run/weekly returns a 32-char hex runId."""
    r = await client.post(
        "/run/weekly", json={"issueNumber": _unique_issue_number()}
    )
    assert r.status_code == 200, r.text
    run_id = r.json().get("runId")
    assert isinstance(run_id, str), "runId must be a string"
    assert len(run_id) == 32, f"runId must be 32-char hex (uuid4().hex); got {run_id}"
    assert "-" not in run_id, "runId must not contain dashes"
    int(run_id, 16)  # raises ValueError if not hex


async def test_pipeline_e2e_runId_threaded_to_all_datastores(
    client, convex_query_fn, sanity_get_issue, sanity_cleanup
):
    """PIP-05 + PIP-06 + PIP-07: runId threaded across Sanity + every Convex table."""
    issue_number = _unique_issue_number()
    try:
        r = await client.post(
            "/run/weekly", json={"issueNumber": issue_number}
        )
        assert r.status_code == 200, r.text
        run_id = r.json()["runId"]

        final = await _poll_until_terminal(client, run_id)
        # CONTEXT D-18 step 12: stub Publisher leaves status='awaiting-review'.
        assert final["status"] == "awaiting-review", final

        # PIP-07: Sanity draft exists with pipelineMetadata.runId == run_id
        doc = await sanity_get_issue(issue_number)
        assert doc is not None, f"Sanity draft issue-{issue_number} not found"
        assert doc["pipelineMetadata"]["runId"] == run_id, (
            f"Sanity pipelineMetadata.runId mismatch: "
            f"{doc['pipelineMetadata'].get('runId')} != {run_id}"
        )

        # PIP-06: every Convex table row carries the same runId
        pipeline_run = await convex_query_fn(
            "pipelineRuns:byRunId", {"runId": run_id}
        )
        assert pipeline_run is not None
        assert pipeline_run["runId"] == run_id

        for query_path in (
            "pitchLog:byRunId",
            "deliberationEvents:byRunId",
            "agentVotes:byRunId",
            "qaCorrections:byRunId",
        ):
            rows = await convex_query_fn(query_path, {"runId": run_id})
            assert isinstance(rows, list), f"{query_path} did not return a list"
            for row in rows:
                assert row.get("runId") == run_id, (
                    f"{query_path}: row.runId != {run_id}: {row}"
                )
    finally:
        await sanity_cleanup(issue_number)


async def test_all_event_types_emitted(client, convex_query_fn, sanity_cleanup):
    """PIP-08: every expected deliberationEvents eventType fires during the stub run.

    Phase 4 stub emits: advocate-argument, editor-decision, section-draft (7x),
    qa-correction, editor-final, publisher-deploy. Calibrator + Scout +
    Researcher do NOT emit via the wrapper in Phase 4 (CONTEXT D-18 + Plan 07).
    """
    issue_number = _unique_issue_number()
    try:
        r = await client.post(
            "/run/weekly", json={"issueNumber": issue_number}
        )
        run_id = r.json()["runId"]
        await _poll_until_terminal(client, run_id)

        events = await convex_query_fn(
            "deliberationEvents:byRunId", {"runId": run_id}
        )
        event_types = {e["eventType"] for e in events}
        for required in (
            "advocate-argument",
            "editor-decision",
            "section-draft",
            "qa-correction",
            "editor-final",
            "publisher-deploy",
        ):
            assert required in event_types, (
                f"Missing eventType {required}; got {event_types}"
            )
    finally:
        await sanity_cleanup(issue_number)


async def test_cost_shape(client, convex_query_fn, sanity_cleanup):
    """PIP-11: pipelineRuns.cost is JSON-parseable with shape {total, agents}."""
    issue_number = _unique_issue_number()
    try:
        r = await client.post(
            "/run/weekly", json={"issueNumber": issue_number}
        )
        run_id = r.json()["runId"]
        await _poll_until_terminal(client, run_id)

        pr = await convex_query_fn("pipelineRuns:byRunId", {"runId": run_id})
        cost_str = pr.get("cost")
        assert cost_str is not None, "pipelineRuns.cost was not written"
        cost = json.loads(cost_str)
        assert "total" in cost, f"cost missing 'total': {cost}"
        assert "agents" in cost, f"cost missing 'agents': {cost}"
        assert isinstance(cost["total"], (int, float))
        assert isinstance(cost["agents"], dict)
        # Stub mode: every agent records 0 USD; total should be 0.0.
        assert cost["total"] == 0.0, f"stub-mode total should be 0.0; got {cost['total']}"
    finally:
        await sanity_cleanup(issue_number)


async def test_duration_ms(client, convex_query_fn, sanity_cleanup):
    """PIP-12: pipelineRuns.durationMs is populated and > 0."""
    issue_number = _unique_issue_number()
    try:
        r = await client.post(
            "/run/weekly", json={"issueNumber": issue_number}
        )
        run_id = r.json()["runId"]
        await _poll_until_terminal(client, run_id)

        pr = await convex_query_fn("pipelineRuns:byRunId", {"runId": run_id})
        duration = pr.get("durationMs")
        assert duration is not None, "pipelineRuns.durationMs was not written"
        assert isinstance(duration, (int, float))
        assert duration > 0, f"durationMs should be > 0; got {duration}"
    finally:
        await sanity_cleanup(issue_number)
