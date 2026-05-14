"""Stub Scout — writes each candidate to Sanity + Convex pitchLog incrementally.

CONTEXT D-18 step 3 (canonical write order). For each candidate in
``stubs.fixtures.scout_candidates()``:

  1. Sanity ``write_charity`` (createOrReplace; deterministic
     ``_id = charity-{slugify(name)}``; idempotent)
  2. Convex ``pitchLog:insert`` with the resolved Sanity ``_id`` + selected=False

Per CONTEXT D-20, Sanity failure halts the pipeline (content is canonical) —
re-raise so the ``@agent_node`` wrapper writes ``pipelineRuns.status='failed'``.
Convex failures use ``convex_mutation_safe`` which logs + continues per
CONTEXT D-20 + D-21.

Scout emits no separate deliberationEvents wrapper event in Phase 4: the
convex deliberationEvents.eventType union does include 'scout-finding', but
each pitchLog row IS the per-finding observable record for the deliberation
layer in stub mode. Phase 5 may add a 'scout-finding' event per candidate
through the wrapper — for now ``emit_event=None`` and per-candidate writes
happen explicitly inside the body. max_tool_calls=8 per CONTEXT D-25.
"""
from __future__ import annotations

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
from eisenbalm_pipeline.lib.sanity_client import (
    get_client as get_sanity_http,
    write_charity,
)
from eisenbalm_pipeline.stubs import fixtures


@agent_node(name="scout", emit_event=None, max_tool_calls=8)
async def scout(state: DispatchState) -> DispatchState:
    update = fixtures.scout_candidates()
    candidates = update["candidates"]
    run_id = state["run_id"]

    sanity_http = get_sanity_http()

    for candidate in candidates:
        # 1. Sanity write_charity (idempotent: deterministic _id =
        # charity-{slug}). Sanity failure halts the pipeline (CONTEXT D-20);
        # re-raise wrapped so the wrapper writes status='failed'.
        try:
            charity_id = await write_charity(sanity_http, candidate)
        except Exception as exc:
            raise RuntimeError(
                f"Sanity write_charity failed: {exc!r}"
            ) from exc

        # 2. Convex pitchLog:insert (per API_CONTRACTS §3.3).
        await convex_mutation_safe(
            "pitchLog:insert",
            {
                "runId": run_id,
                "charityId": charity_id,
                "charityName": candidate["name"],
                "charityLocation": candidate.get("location", ""),
                "charityWebsite": candidate.get("website"),
                "assetRange": candidate.get("assetRange"),
                "focusArea": candidate.get("focusArea"),
                "scoutSummary": candidate.get("scoutSummary", ""),
                "selected": False,
            },
        )

    return {**state, **update}
