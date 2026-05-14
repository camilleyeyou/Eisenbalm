"""Stub Publisher — pipeline-end Sanity draft write + final Convex update.

CONTEXT D-18 steps 11 + 12 (canonical write order):

  1. Sanity ``write_issue_draft(state, cost_payload)`` — once, at pipeline end.
     ``pipelineMetadata.runId = state['run_id']`` (Pitfall 6 — nesting matters).
  2. Convex ``pipelineRuns:updateStatus`` with:
        - status='awaiting-review' (NOT 'complete' — Phase 6 webhook sets that)
        - completedAt = Unix ms now
        - durationMs (from lib.cost.end_run)
        - cost (JSON-stringified from end_run payload)
  3. Convex ``deliberationEvents:insert`` eventType='publisher-deploy' —
     emitted by the @agent_node wrapper via emit_event='publisher-deploy'.

CONTEXT D-20: Sanity failure halts the pipeline. The wrapper handles the
generic failure path (writes status='failed' on any exception); the
publisher body does NOT manually write a separate 'failed' status so as to
avoid the double-write per plan-checker NOTE-4. The wrapper's error message
prefix is ``f'{agentId}: {ExceptionClass}: {msg}'`` per CONTEXT D-27 —
sufficient for grep-by-agent observability.
"""
from __future__ import annotations

import time

from slugify import slugify

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
from eisenbalm_pipeline.lib.cost import cost_payload_to_json, end_run
from eisenbalm_pipeline.lib.sanity_client import (
    get_client as get_sanity_http,
    write_issue_draft,
)


def _publisher_payload(state: DispatchState) -> dict:
    return {
        "issueNumber": state["issue_number"],
        "sanityIssueId": state.get("sanity_issue_id"),
        # Phase 6 owns the real PDF generation.
        "stubPdfNote": "stub-pdf-not-yet-implemented",
    }


@agent_node(
    name="publisher",
    emit_event="publisher-deploy",
    payload_builder=_publisher_payload,
)
async def publisher(state: DispatchState) -> DispatchState:
    run_id = state["run_id"]
    sanity_http = get_sanity_http()

    # Flush cost + duration BEFORE the Sanity write so both go into
    # pipelineMetadata.cost (CONTEXT D-22) and the final Convex update.
    cost_payload, duration_ms = end_run(run_id)

    # Set winning_charity_sanity_id defensively. Scout's write_charity already
    # wrote the document with the deterministic _id; if pipeline state didn't
    # carry it forward, derive it the same way write_charity does so that
    # write_issue_draft's reference resolves.
    winning = state.get("winning_charity") or {}
    if winning and not state.get("winning_charity_sanity_id"):
        state = {
            **state,
            "winning_charity_sanity_id": f"charity-{slugify(winning['name'])}",
        }

    # Sanity write_issue_draft — pipeline-end Sanity write (CONTEXT D-18 step 11).
    # If this raises, the wrapper writes status='failed' with the standard
    # CONTEXT D-27 errorMessage prefix; we do NOT manually write a second
    # 'failed' status here (plan-checker NOTE-4 avoid double-write).
    issue_id = await write_issue_draft(sanity_http, state, cost_payload)

    # Convex final pipelineRuns:updateStatus (CONTEXT D-18 step 12 + D-22 + D-23).
    # status='awaiting-review' NOT 'complete' — Phase 6's webhook flips to
    # 'complete' when the issue is published in Sanity Studio.
    await convex_mutation_safe(
        "pipelineRuns:updateStatus",
        {
            "runId": run_id,
            "status": "awaiting-review",
            "completedAt": int(time.time() * 1000),
            "durationMs": duration_ms,
            "cost": cost_payload_to_json(cost_payload),
        },
    )

    return {
        **state,
        "sanity_issue_id": issue_id,
    }
