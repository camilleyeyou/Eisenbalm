"""Editor gate 1 interrupt/resume cycle (PIP-10 + CONTEXT D-36).

Strategy:
  1. POST /run/weekly with forceNoWinner=true → triggers interrupt() in editor
  2. Poll status until 'awaiting-review' (the Editor wrote it BEFORE interrupt)
  3. POST /run/{runId}/resume with selection.charityName = 'The Quiet Foundation'
  4. Poll for the Sanity draft to appear (the Sanity write only happens AFTER
     the graph resumes past the interrupt — pre-resume there is no draft)
  5. Assert the draft references the resumed charity + the run reached terminal

Environment reality (Plan 12 forward link):
  Like test_pipeline_e2e.py, this drives the full LangGraph graph and needs a
  live AsyncPostgresSaver checkpointer. The module-level skipif below skips
  this file with a descriptive reason until Supabase is provisioned (Plan 12).

Source: 04-CONTEXT.md D-36 + D-13 + D-08 + 04-RESEARCH.md §2 + "Example 1".
"""
from __future__ import annotations

import asyncio
import os
import time

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("SUPABASE_POSTGRES_URL"),
    reason=(
        "SUPABASE_POSTGRES_URL not set — interrupt/resume requires the "
        "AsyncPostgresSaver checkpointer; Supabase is provisioned in Plan 12 "
        "(Andrew's manual step). Runs green in Plan 12's smoke test."
    ),
)


POLL_INTERVAL_S = 0.5
POLL_TIMEOUT_S = 60.0

# Phase 2 demo charity (CONTEXT D-16 + stubs/fixtures.QUIET_FOUNDATION_*).
QUIET_FOUNDATION_NAME = "The Quiet Foundation"
QUIET_FOUNDATION_SANITY_ID = "charity-the-quiet-foundation"


async def _poll_for_status(client, run_id: str, target_statuses: set) -> dict:
    deadline = time.monotonic() + POLL_TIMEOUT_S
    last: dict = {}
    while time.monotonic() < deadline:
        r = await client.get(f"/run/{run_id}/status")
        last = r.json() if r.status_code == 200 else {"status": "404"}
        if last.get("status") in target_statuses:
            return last
        await asyncio.sleep(POLL_INTERVAL_S)
    raise TimeoutError(
        f"Run {run_id} did not reach {target_statuses}; last={last}"
    )


def _unique_issue_number() -> int:
    return 999000 + (int(time.time()) % 100000)


async def test_editor_gate_1_interrupt_and_resume(
    client, convex_query_fn, sanity_get_issue, sanity_cleanup
):
    """PIP-10: forceNoWinner → interrupt → awaiting-review → resume → terminal."""
    issue_number = _unique_issue_number()
    try:
        # 1. Trigger with forceNoWinner=true — Editor gate 1 calls interrupt().
        r = await client.post(
            "/run/weekly",
            json={"issueNumber": issue_number, "forceNoWinner": True},
        )
        assert r.status_code == 200, r.text
        run_id = r.json()["runId"]

        # 2. Poll for 'awaiting-review' — the Editor node writes it to Convex
        #    BEFORE calling interrupt() (CONTEXT D-13).
        mid = await _poll_for_status(
            client, run_id, {"awaiting-review", "failed"}
        )
        assert mid["status"] == "awaiting-review", (
            f"Expected awaiting-review on interrupt; got {mid}"
        )

        # 3. Resume with the demo charity (CONTEXT D-08 resume body shape).
        r = await client.post(
            f"/run/{run_id}/resume",
            json={"selection": {"charityName": QUIET_FOUNDATION_NAME}},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("resumed") is True

        # 4. Poll for the Sanity draft to appear. Pre-resume the graph was
        #    paused at Editor gate 1, so the pipeline-end Sanity write had not
        #    run yet — the draft appearing IS the "resumed past the interrupt"
        #    signal (the stub Publisher leaves status='awaiting-review' both
        #    before AND after, so status alone can't distinguish — CONTEXT D-18
        #    step 12).
        deadline = time.monotonic() + POLL_TIMEOUT_S
        doc = None
        while time.monotonic() < deadline:
            doc = await sanity_get_issue(issue_number)
            if doc and doc.get("pipelineMetadata", {}).get("runId") == run_id:
                break
            await asyncio.sleep(POLL_INTERVAL_S)
        else:
            pytest.fail(
                f"Sanity draft for issue-{issue_number} never appeared "
                f"after resume of runId {run_id}"
            )

        # 5. The winning charity reference must be the resumed pick.
        assert doc["charity"]["_ref"] == QUIET_FOUNDATION_SANITY_ID, (
            f"resumed charity ref mismatch: {doc['charity']} "
            f"!= {QUIET_FOUNDATION_SANITY_ID}"
        )

        # 6. Final status is 'awaiting-review' with completedAt + durationMs set.
        final = await client.get(f"/run/{run_id}/status")
        final_data = final.json()
        assert final_data["status"] == "awaiting-review"
        assert final_data.get("completedAt") is not None
        assert final_data.get("durationMs") is not None
    finally:
        await sanity_cleanup(issue_number)
