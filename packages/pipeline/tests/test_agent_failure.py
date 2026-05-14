"""Agent failure path (OPS-01 + CONTEXT D-37).

Strategy: forceFailAgent='researcher' → the @agent_node wrapper raises a
RuntimeError → pipelineRuns:updateStatus writes status='failed' with
errorMessage='researcher: RuntimeError: ...' (CONTEXT D-27 format).

Environment reality (Plan 12 forward link):
  Drives the full LangGraph graph — needs a live AsyncPostgresSaver
  checkpointer. The module-level skipif below skips this file until Supabase
  is provisioned (Plan 12, Andrew's manual step).

Source: 04-CONTEXT.md D-37 + D-27.
"""
from __future__ import annotations

import asyncio
import os
import time

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("SUPABASE_POSTGRES_URL"),
    reason=(
        "SUPABASE_POSTGRES_URL not set — failure-path test drives the full "
        "graph and needs the AsyncPostgresSaver checkpointer; Supabase is "
        "provisioned in Plan 12 (Andrew's manual step)."
    ),
)


POLL_INTERVAL_S = 0.5
POLL_TIMEOUT_S = 60.0


def _unique_issue_number() -> int:
    return 999000 + (int(time.time()) % 100000)


async def test_forced_agent_failure_marks_run_failed(client, convex_query_fn):
    """OPS-01: forceFailAgent → status='failed' with agentId-prefixed errorMessage."""
    issue_number = _unique_issue_number()
    r = await client.post(
        "/run/weekly",
        json={"issueNumber": issue_number, "forceFailAgent": "researcher"},
    )
    assert r.status_code == 200, r.text
    run_id = r.json()["runId"]

    # Poll until failed (researcher runs after editor gate 1 — should fail fast).
    deadline = time.monotonic() + POLL_TIMEOUT_S
    final: dict = {}
    while time.monotonic() < deadline:
        r2 = await client.get(f"/run/{run_id}/status")
        final = r2.json()
        if final.get("status") == "failed":
            break
        await asyncio.sleep(POLL_INTERVAL_S)
    else:
        pytest.fail(
            f"Run {run_id} did not reach 'failed' in {POLL_TIMEOUT_S}s; "
            f"last={final}"
        )

    # CONTEXT D-27 format: f'{agentId}: {ExceptionClass}: {msg}'.
    err = final.get("errorMessage") or ""
    assert err.startswith("researcher:"), (
        f"errorMessage should start with 'researcher:'; got {err!r}"
    )
    assert "RuntimeError" in err, f"Expected RuntimeError in {err!r}"
    assert final.get("completedAt") is not None
