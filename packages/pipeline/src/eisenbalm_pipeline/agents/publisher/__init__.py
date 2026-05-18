"""Publisher package — Phase 4 stub body lives here.

Phase 6 promotes agents/publisher.py to agents/publisher/ (a package) so the
PDF renderer (pdf.py), font helpers (fonts.py), and Jinja2 templates can
co-locate with the @agent_node publisher entrypoint. This file's body is
VERBATIM from the Phase 4 stub publisher.py so:

  - graph/builder.py's `from eisenbalm_pipeline.agents.publisher import publisher`
    still resolves to the same callable.
  - Phase 4 PIP-* integration tests continue to pass without change.
  - Plan 06-07 replaces this stub body with the real Publisher webhook
    coroutine path — at which point the @agent_node here may either stay
    (still called by the graph for pipeline-end Sanity write) or be split
    further. Plan 06-07 decides.

CONTEXT D-18 steps 11 + 12 (canonical write order — Phase 4 lock):

  1. Sanity ``write_issue_draft(state, cost_payload)`` — once, at pipeline end.
     ``pipelineMetadata.runId = state['run_id']`` (Pitfall 6 — nesting matters).
  2. Convex ``pipelineRuns:updateStatus`` with status='awaiting-review' (NOT
     'complete' — Phase 6 webhook flips it to 'complete').
  3. Convex ``deliberationEvents:insert`` eventType='publisher-deploy' —
     emitted by the @agent_node wrapper via emit_event='publisher-deploy'.
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
        # Plan 06-07 replaces the stub note with real PDF generation.
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

    cost_payload, duration_ms = end_run(run_id)

    winning = state.get("winning_charity") or {}
    if winning and not state.get("winning_charity_sanity_id"):
        state = {
            **state,
            "winning_charity_sanity_id": f"charity-{slugify(winning['name'])}",
        }

    issue_id = await write_issue_draft(sanity_http, state, cost_payload)

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
