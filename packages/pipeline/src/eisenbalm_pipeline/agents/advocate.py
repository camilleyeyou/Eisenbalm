"""Stub Advocate — scores each Scout candidate and writes per-candidate events.

CONTEXT D-18 step 4 (canonical write order). For each scored candidate:

  1. Convex ``agentVotes:insert`` (vote='for', reasoning=advocateArgument)
  2. Convex ``deliberationEvents:insert`` (eventType='advocate-argument',
     payload={charityName, argument, score})

Because the wrapper's ``emit_event`` mechanism emits ONE deliberation event
per agent execution (not per candidate), Advocate emits per-candidate events
EXPLICITLY inside the body and sets ``emit_event=None`` on the wrapper.
Phase 5 may revisit if a single summary event becomes preferable for the UX.
"""
from __future__ import annotations

import json

from slugify import slugify

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
from eisenbalm_pipeline.stubs import fixtures


def _charity_id_for(name: str) -> str:
    """Deterministic Sanity charity _id (matches lib/sanity_client:write_charity)."""
    return f"charity-{slugify(name)}"


@agent_node(name="advocate", emit_event=None)
async def advocate(state: DispatchState) -> DispatchState:
    candidates_in = state.get("candidates") or []
    run_id = state["run_id"]

    # fixtures.advocate_scored mutates candidates with advocateScore +
    # advocateArgument fields filled in.
    update = fixtures.advocate_scored(candidates_in)
    scored = update["candidates"]

    for candidate in scored:
        charity_id = _charity_id_for(candidate["name"])

        # 1. agentVotes:insert (API_CONTRACTS §3.5)
        await convex_mutation_safe(
            "agentVotes:insert",
            {
                "runId": run_id,
                "agentId": "advocate",
                "charityId": charity_id,
                "charityName": candidate["name"],
                "vote": "for",
                "reasoning": candidate["advocateArgument"],
            },
        )

        # 2. deliberationEvents:insert (API_CONTRACTS §3.4 — advocate-argument)
        await convex_mutation_safe(
            "deliberationEvents:insert",
            {
                "runId": run_id,
                "agentId": "advocate",
                "eventType": "advocate-argument",
                "charityId": charity_id,
                "payload": json.dumps(
                    {
                        "charityName": candidate["name"],
                        "argument": candidate["advocateArgument"],
                        "score": candidate["advocateScore"],
                    }
                ),
            },
        )

    return {**state, **update}
