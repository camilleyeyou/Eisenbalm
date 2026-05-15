"""Stub Editor — gate 1 with interrupt + final approval.

Two functions, one module per CONTEXT D-05:
  - editor_gate_1: selects a winner OR pauses via interrupt() when no clear
    winner exists. CONTEXT D-13 + research §2 + research "Example 1".
  - editor_final: post-QA approval node. CONTEXT D-18 step 10.

CRITICAL: Code BEFORE interrupt() runs again on resume (research §2 +
"Anti-Patterns"). Only idempotent operations are allowed there. Specifically:

  - pipelineRuns:updateStatus IS idempotent (upsert by runId) — placed BEFORE
    interrupt() so the run is visibly 'awaiting-review' the moment the
    pipeline suspends.
  - pitchLog:markSelected is placed AFTER interrupt() returns so it only runs
    once (on the successful resume), preserving the no-double-write guarantee.
  - interrupt() is NOT wrapped in try/except — research "Anti-Patterns"
    forbids it (LangGraph 1.x uses exceptions for the suspend mechanism).

The wrapper's emit_event='editor-decision' fires after the function returns
successfully — i.e., AFTER interrupt() resolves on resume. The wrapper's emit
will NOT fire on the pre-interrupt pass because interrupt() raises a
BaseException out of the wrapper's try block (RESEARCH §2 + _wrapper.py
docstring).

Both editor_gate_1 and editor_final use name='editor' (the agentId is the
canonical Sanity profile id — Phase 1 D-17). The eventType differs.
"""
from __future__ import annotations

from langgraph.types import interrupt

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
from eisenbalm_pipeline.stubs import fixtures


# ── Helpers ──────────────────────────────────────────────────────────────


def _editor_decision_payload(state: DispatchState) -> dict:
    winning = state.get("winning_charity") or {}
    return {
        "winner": winning.get("name", "<unknown>"),
        "rationale": state.get("editor_decision", ""),
    }


def _editor_final_payload(state: DispatchState) -> dict:
    return {
        "approved": True,
        "notes": state.get("editor_final_notes", ""),
    }


def _no_clear_winner(state: DispatchState) -> bool:
    """No winner if forced (test toggle) OR no candidate has advocateScore >= 6.

    The threshold of 6 matches the Advocate stub fixture's scoring: the demo
    charity wins with 9, the other two get 6 — so the default path picks a
    winner. The `_force_no_winner` test toggle (CONTEXT D-27) overrides this
    to trigger the interrupt path for PIP-10 integration testing.
    """
    if state.get("_force_no_winner"):
        return True
    candidates = state.get("candidates") or []
    if not candidates:
        return True
    return max((c.get("advocateScore") or 0) for c in candidates) < 6


# ── Editor gate 1 ────────────────────────────────────────────────────────


@agent_node(
    name="editor",
    emit_event="editor-decision",
    payload_builder=_editor_decision_payload,
)
async def editor_gate_1(state: DispatchState) -> DispatchState:
    candidates = state.get("candidates") or []
    run_id = state["run_id"]

    if _no_clear_winner(state):
        # IDEMPOTENT — updateStatus is an upsert on runId. Safe to run again
        # when the node re-runs from the top on resume (research §2).
        await convex_mutation_safe(
            "pipelineRuns:updateStatus",
            {"runId": run_id, "status": "awaiting-review"},
        )

        # SUSPEND. Graph state is checkpointed to Postgres. On resume, this
        # node re-runs from the top; interrupt() returns the Command(resume=...)
        # value (research §2 — research "Example 1" copied verbatim).
        human_input = interrupt(
            {
                "reason": "no-clear-winner",
                "candidates": [c["name"] for c in candidates],
            }
        )

        # Code below runs on the SECOND invocation (post-resume) only.
        # The updateStatus call above ALSO runs on the second pass — safe
        # because it's an upsert.
        selected_name = human_input["editorSelection"]
        winning = next(
            c for c in candidates if c["name"] == selected_name
        )

        # Resume "running" status now that human input is in.
        await convex_mutation_safe(
            "pipelineRuns:updateStatus",
            {"runId": run_id, "status": "running"},
        )
    else:
        winning = max(candidates, key=lambda c: c.get("advocateScore") or 0)

    # Common path: pitchLog:markSelected is NOT idempotent in the same way
    # (it marks a specific runId+charity row as selected). Placing it AFTER
    # interrupt() resolves means it runs exactly once on the successful
    # resume, never on the pre-interrupt pass.
    await convex_mutation_safe(
        "pitchLog:markSelected",
        {"runId": run_id, "charityName": winning["name"]},
    )

    decision = fixtures.editor_decision_output(winning["name"])

    return {
        **state,
        "winning_charity": winning,
        "editor_decision": decision["editor_decision"],
        "runner_up_notes": decision["runner_up_notes"],
        "deliberation_transcript": decision["deliberation_transcript"],
    }


# ── Editor Final (post-QA) ──────────────────────────────────────────────


@agent_node(
    name="editor",
    emit_event="editor-final",
    payload_builder=_editor_final_payload,
)
async def editor_final(state: DispatchState) -> DispatchState:
    return fixtures.editor_final_output()
