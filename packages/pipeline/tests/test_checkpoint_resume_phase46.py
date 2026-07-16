"""Phase 46 — checkpoint pause/resume across the two new nodes (SGE-04).

Like ``test_editor_gate_1_resume.py``, this drives the full LangGraph graph
via the FastAPI app and needs a live AsyncPostgresSaver checkpointer. The
module-level skipif below skips this file with a descriptive reason until
``SUPABASE_POSTGRES_URL`` is set (matches the existing 04-CONTEXT.md D-36
skip pattern).

SGE-04's acceptance is that the Postgres checkpointer resumes correctly
across the D-01 chain (``calibrator -> signal_editor -> scout ->
verify_candidates -> advocate -> editor_gate_1``): the state
``signal_editor`` and ``verify_candidates`` write BEFORE the
``editor_gate_1`` interrupt (``story_leads`` / ``verification_records`` —
both JSON-safe ``list[dict]`` DispatchState fields per D-20) must survive
the pause/resume cycle intact, proving the checkpointed DispatchState
round-trips through Postgres rather than being lost or re-computed.

The HTTP-level resume harness (mirroring ``test_editor_gate_1_resume.py``)
only exposes run status + the eventual Sanity draft — it does not expose
the raw checkpointed DispatchState dict directly. Per 46-07-PLAN.md Task 1's
explicit fallback, this test instead reads back the two new Convex tables
(``storyLeads:byRunId`` / ``verificationRecords:byRunId``) for the run,
which ``signal_editor``/``verify_candidates`` populate as a side effect of
writing those same fields into DispatchState:

  1. Assert the rows exist BEFORE resume (proves the pre-fan-out spine —
     signal_editor -> scout -> verify_candidates — genuinely ran ahead of
     the editor_gate_1 interrupt).
  2. Assert the SAME rows (same count, same runId) are still present AFTER
     resume, and that the run reaches a genuine terminal signal
     (``completedAt`` populated) rather than crashing. If the Postgres
     checkpoint had failed to restore ``candidates``/``story_leads``/
     ``verification_records`` across the pause, the resumed run would
     either crash downstream (nodes after editor_gate_1 depend on
     ``candidates``/``winning_charity``) or silently re-run the pre-fan-out
     spine from scratch (which would double the Convex row counts, since
     signal_editor/verify_candidates insert one row per lead/candidate on
     every execution). Neither happens if the checkpoint round-trip holds.

NOTE (deferred — see phase deferred-items.md): the ``forceNoWinner`` /
``_force_no_winner`` toggle referenced below is the same trigger mechanism
``test_editor_gate_1_resume.py`` uses. It is a Phase-4-era dev toggle set
into initial state (``api/runs.py``) but not currently read by
``editor_gate_1`` (Phase 5's D-18 real-Opus implementation drives the
interrupt purely off ``score_gap`` / ``confidence`` / ``requiresHumanInput``
from the live LLM call). This is a pre-existing gap unrelated to Phase 46's
own changes — out of scope to fix here — logged to this phase's
``deferred-items.md``. The interrupt may therefore need a close top-two
Advocate score in real mode rather than being force-guaranteed by the flag;
this test mirrors the established precedent test's trigger mechanism as
instructed by 46-07-PLAN.md rather than inventing a new one.
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
        "AsyncPostgresSaver checkpointer, provisioned live (mirrors "
        "test_editor_gate_1_resume.py's skip pattern)."
    ),
)


POLL_INTERVAL_S = 0.5
POLL_TIMEOUT_S = 60.0


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


async def _poll_for_completion(client, run_id: str) -> dict:
    """Poll status until completedAt is populated (or timeout)."""
    deadline = time.monotonic() + POLL_TIMEOUT_S
    last: dict = {}
    while time.monotonic() < deadline:
        r = await client.get(f"/run/{run_id}/status")
        last = r.json() if r.status_code == 200 else {"status": "404"}
        if last.get("status") == "failed":
            return last
        if last.get("completedAt") is not None:
            return last
        await asyncio.sleep(POLL_INTERVAL_S)
    raise TimeoutError(
        f"Run {run_id} never reached completion (completedAt/failed); "
        f"last={last}"
    )


def _unique_issue_number() -> int:
    # Distinct offset from test_editor_gate_1_resume.py's 999000 range so
    # the two suites never collide on the same Sanity draft id if ever run
    # in the same session.
    return 998000 + (int(time.time()) % 100000)


async def test_story_leads_and_verification_records_survive_resume(
    client, convex_query_fn, sanity_cleanup
):
    """SGE-04: story_leads (signal_editor) + verification_records
    (verify_candidates) — both written pre-interrupt — survive the
    editor_gate_1 pause/resume cycle (Postgres checkpoint round-trip)."""
    issue_number = _unique_issue_number()
    try:
        # 1. Trigger a run. forceNoWinner mirrors test_editor_gate_1_resume.py's
        #    trigger mechanism (see module docstring re: its current wiring).
        r = await client.post(
            "/run/weekly",
            json={"issueNumber": issue_number, "forceNoWinner": True},
        )
        assert r.status_code == 200, r.text
        run_id = r.json()["runId"]

        # 2. Poll for the pause. Per D-01 (calibrator -> signal_editor ->
        #    scout -> verify_candidates -> advocate -> editor_gate_1), both
        #    new nodes have already executed and written their state by the
        #    time editor_gate_1 can possibly interrupt.
        mid = await _poll_for_status(
            client, run_id, {"awaiting-review", "failed"}
        )
        assert mid["status"] == "awaiting-review", (
            f"Expected awaiting-review on interrupt; got {mid}"
        )

        # 3. Pre-resume: story_leads + verification_records are already
        #    committed to Convex — proves the pre-fan-out spine ran BEFORE
        #    the interrupt fired.
        story_leads_before = await convex_query_fn(
            "storyLeads:byRunId", {"runId": run_id}
        )
        verification_records_before = await convex_query_fn(
            "verificationRecords:byRunId", {"runId": run_id}
        )
        assert story_leads_before, (
            f"expected non-empty story_leads pre-resume for run {run_id}"
        )
        assert verification_records_before, (
            f"expected non-empty verification_records pre-resume for run "
            f"{run_id}"
        )

        # 4. Resume past the interrupt (same resume-body shape as the
        #    existing editor_gate_1 interrupt contract).
        r = await client.post(
            f"/run/{run_id}/resume",
            json={"selection": {"charityName": "The Quiet Foundation"}},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("resumed") is True

        # 5. Poll to a genuine terminal signal. If the Postgres checkpoint
        #    failed to restore the pre-interrupt DispatchState, downstream
        #    nodes (which depend on candidates/winning_charity/story_leads/
        #    verification_records all living in the SAME checkpointed state
        #    dict) would crash rather than reach completion.
        final = await _poll_for_completion(client, run_id)
        assert final.get("status") != "failed", f"Run failed after resume: {final}"
        assert final.get("completedAt") is not None
        assert final.get("durationMs") is not None

        # 6. Post-resume: the SAME pre-interrupt Convex rows are still
        #    present, with unchanged counts — the resumed run continued from
        #    the checkpoint rather than losing state (rows disappearing) or
        #    silently re-running signal_editor/verify_candidates from
        #    scratch (rows doubling — each node inserts one row per lead/
        #    candidate on every execution).
        story_leads_after = await convex_query_fn(
            "storyLeads:byRunId", {"runId": run_id}
        )
        verification_records_after = await convex_query_fn(
            "verificationRecords:byRunId", {"runId": run_id}
        )
        assert len(story_leads_after) == len(story_leads_before), (
            "story_leads row count changed across resume — signal_editor "
            "may have re-run instead of resuming from the checkpoint "
            f"({len(story_leads_before)} -> {len(story_leads_after)})"
        )
        assert len(verification_records_after) == len(verification_records_before), (
            "verification_records row count changed across resume — "
            "verify_candidates may have re-run instead of resuming from "
            f"the checkpoint ({len(verification_records_before)} -> "
            f"{len(verification_records_after)})"
        )
    finally:
        await sanity_cleanup(issue_number)
