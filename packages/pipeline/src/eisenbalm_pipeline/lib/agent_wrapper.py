"""LangGraph agent node wrapper — lifecycle + cost + I/O snapshot emission.

READ-ONLY cost: calls get_cost_payload only; never record_cost (Pitfall 1 —
double counting). The existing acomplete() → record_cost() path in
openrouter_client.py remains the sole writer. This module reads the already-
accumulated in-memory store after fn() returns.

Usage in graph/builder.py::

    from eisenbalm_pipeline.lib.agent_wrapper import wrap_agent_node
    builder.add_node("scout", wrap_agent_node("scout", scout))

Phase 23 OBS-03 (live progress), OBS-04 (cost surface), OBS-05 (I/O capture).
"""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Callable

from eisenbalm_pipeline.lib.cost import get_cost_payload
import eisenbalm_pipeline.lib.convex_client as _cc
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
from eisenbalm_pipeline.lib.errors import RunCancelled

log = logging.getLogger(__name__)

# ── Per-agent input key whitelist ─────────────────────────────────────────────
# Avoids sending multi-KB state blobs inline. Each entry is a small slice of
# DispatchState fields that the named agent actually consumes as input.
_INPUT_KEYS: dict[str, list[str]] = {
    "calibrator":    ["run_id"],
    "scout":         ["style_brief"],
    "advocate":      ["candidates"],
    "editor_gate_1": ["candidates"],
    "chronicler":    ["candidates", "winning_charity", "editor_decision"],
    "researcher":    ["winning_charity"],
    "verify_research": ["research"],
    "origin_story":  ["research", "winning_charity", "style_brief"],
    "problem":       ["research", "winning_charity", "style_brief"],
    "founder_bio":   ["research", "winning_charity", "style_brief"],
    "case_study":    ["research", "winning_charity", "style_brief"],
    "game":          ["research", "winning_charity", "style_brief"],
    "bonus":         ["research", "winning_charity", "style_brief"],
    "design":        ["research", "winning_charity", "style_brief"],
    "validate_sections": ["run_id"],
    "qa":            ["origin_story", "problem_statement", "founder_bio",
                      "case_study", "game", "bonus"],
    "editor_final":  ["qa_corrections", "winning_charity"],
    "publisher":     ["sanity_issue_id", "winning_charity"],
}


def _resolve_workspace(state: dict) -> str:
    """Resolve workspace_id from state > env > default 'eisenbalm'."""
    return (
        state.get("workspace_id")
        or os.environ.get("WORKSPACE_ID", "eisenbalm")
    )


def _truncate(s: str) -> str:
    """Truncate long strings to 2000 characters."""
    if len(s) <= 2000:
        return s
    return s[:2000] + "...[truncated]"


def _snapshot_input(agent_key: str, state: dict) -> str:
    """Capture a whitelist slice of state as a truncated JSON string.

    Falls back to '{"_snapshot_error": ...}' on json.dumps failure (e.g.
    non-serialisable objects in state values).
    """
    keys = _INPUT_KEYS.get(agent_key, ["run_id"])
    slice_: dict[str, Any] = {k: state.get(k) for k in keys if k in state}
    try:
        return _truncate(json.dumps(slice_, default=str))
    except Exception as exc:
        return json.dumps({"_snapshot_error": repr(exc)})


def _snapshot_output(result: Any) -> str:
    """Serialize fn() return value as a truncated JSON string.

    Falls back to '{"_snapshot_error": ...}' on json.dumps failure.
    """
    try:
        return _truncate(json.dumps(result, default=str))
    except Exception as exc:
        return json.dumps({"_snapshot_error": repr(exc)})


def wrap_agent_node(agent_key: str, fn: Callable) -> Callable:
    """Wrap a LangGraph node fn to emit lifecycle events to Convex agent_runs.

    Emitted mutations (via convex_mutation_safe — fire-and-forget):
      1. agentRuns:started   — before fn() runs
      2. agentRuns:completed — after fn() returns (reads cost read-only)
      3. agentRuns:savePayload — input/output snapshot (non-fatal on failure)

    On fn() raising any exception:
      agentRuns:failed is emitted with str(exc), then the exception is re-raised
      so LangGraph failure semantics are unchanged.

    Args:
        agent_key: The node key used in builder.add_node(). MUST match
            the key in cost.py._store (agent_name argument to record_cost).
        fn: The async LangGraph node function: async fn(state) -> dict.

    Returns:
        An async callable with the same signature as fn.
    """
    async def wrapped(state: dict) -> dict:
        run_id: str = state["run_id"]
        ws: str = _resolve_workspace(state)

        # 0. Cancel-flag check (RUN-04) — BEFORE started emit and BEFORE fn(state).
        # Cooperative-only: raises RunCancelled so the in-flight node never starts;
        # a node that has already begun executing is allowed to finish (D-02).
        # Uses _cc.convex_query_safe (module-level) so monkeypatch.setattr(_cc, ...)
        # in tests reaches this call site.
        cancel = await _cc.convex_query_safe("runs:isCancelRequested", {"runId": run_id})
        if cancel:
            raise RunCancelled(run_id)

        # 1. Emit started
        await convex_mutation_safe(
            "agentRuns:started",
            {
                "workspace_id": ws,
                "runId": run_id,
                "agentKey": agent_key,
                "startedAt": int(time.time() * 1000),
            },
        )

        try:
            result = await fn(state)
        except Exception as exc:
            # Emit failed, then re-raise — LangGraph semantics unchanged.
            await convex_mutation_safe(
                "agentRuns:failed",
                {
                    "workspace_id": ws,
                    "runId": run_id,
                    "agentKey": agent_key,
                    "error": str(exc),
                },
            )
            raise

        # 2. Read cost (read-only — never call record_cost here).
        agent_cost = get_cost_payload(run_id)["agents"].get(agent_key, {})

        # 3. Emit completed
        await convex_mutation_safe(
            "agentRuns:completed",
            {
                "workspace_id": ws,
                "runId": run_id,
                "agentKey": agent_key,
                "completedAt": int(time.time() * 1000),
                "costUsd": agent_cost.get("usd", 0.0),
                "durationMs": agent_cost.get("duration_ms", 0),
                "tokensIn": agent_cost.get("tokens_in", 0),
                "tokensOut": agent_cost.get("tokens_out", 0),
                # Phase 37 §37.1 — genuine acomplete() regenerate-retries, honest 0 default.
                "retryCount": agent_cost.get("retries", 0),
            },
        )

        # 4. Emit I/O snapshot (non-fatal — separate table, not subscribed live)
        await convex_mutation_safe(
            "agentRuns:savePayload",
            {
                "workspace_id": ws,
                "runId": run_id,
                "agentKey": agent_key,
                "inputSnapshot": _snapshot_input(agent_key, state),
                "outputSnapshot": _snapshot_output(result),
            },
        )

        return result

    wrapped.__name__ = fn.__name__ if hasattr(fn, "__name__") else agent_key
    wrapped.__qualname__ = getattr(fn, "__qualname__", agent_key)
    return wrapped
