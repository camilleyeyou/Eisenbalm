"""Per-run cost + duration tracking. See CONTEXT D-22, D-23.

Stub mode records 0 tokens/usd but shape is real so Phase 5 only swaps
the values, not the structure.

``cost`` is JSON-stringified into:
  - Convex ``pipelineRuns.cost`` (``v.optional(v.string())`` — Plan 03 patches)
  - Sanity ``weeklyIssue.pipelineMetadata.cost`` (text field — Plan 04 patches)

``durationMs`` is plain int millis on Convex ``pipelineRuns.durationMs``
(``v.optional(v.number())`` — Plan 03 patches).
"""
from __future__ import annotations

import json
import threading
import time
from typing import Optional, TypedDict


class AgentCost(TypedDict):
    tokens_in: int
    tokens_out: int
    usd: float
    duration_ms: int


# Module-level in-memory store keyed by run_id (mirrors convex_client._CLIENT
# singleton pattern). Thread-safe via a lock — FastAPI runs concurrent
# requests on a single event loop, but tests may exercise multiple runs.
_store: dict[str, dict[str, AgentCost]] = {}
_store_lock = threading.Lock()

# Wall-clock start times keyed by run_id (CONTEXT D-23).
_start_times: dict[str, float] = {}


def begin_run(run_id: str) -> None:
    """Mark wall-clock start for a run.

    Called from FastAPI ``/run/weekly`` handler right after ``new_run_id()``.
    """
    _start_times[run_id] = time.monotonic()
    with _store_lock:
        _store[run_id] = {}


def record_cost(
    run_id: str,
    agent_name: str,
    *,
    tokens_in: int = 0,
    tokens_out: int = 0,
    usd: float = 0.0,
    duration_ms: int = 0,
) -> None:
    """Record one agent's cost contribution. Stub mode passes all 0s.

    Called by the ``@agent_node`` wrapper (Plan 06) after each successful
    agent execution. Multiple calls for the same ``(run_id, agent_name)``
    pair are additive — useful when an agent makes multiple tool calls.
    """
    with _store_lock:
        agents = _store.setdefault(run_id, {})
        existing = agents.get(
            agent_name,
            AgentCost(tokens_in=0, tokens_out=0, usd=0.0, duration_ms=0),
        )
        agents[agent_name] = AgentCost(
            tokens_in=existing["tokens_in"] + tokens_in,
            tokens_out=existing["tokens_out"] + tokens_out,
            usd=existing["usd"] + usd,
            duration_ms=existing["duration_ms"] + duration_ms,
        )


def get_cost_payload(run_id: str) -> dict:
    """Return the shape-locked cost payload for a run.

    Shape (matches what's JSON-stringified into Sanity + Convex)::

        {
          "total": <sum_of_usd>,
          "agents": {
            "calibrator": {
                "tokens_in": 0,
                "tokens_out": 0,
                "usd": 0.0,
                "duration_ms": 12
            },
            ...
          }
        }
    """
    with _store_lock:
        agents = dict(_store.get(run_id, {}))
    total = sum(a["usd"] for a in agents.values())
    return {"total": total, "agents": agents}


def get_duration_ms(run_id: str) -> Optional[int]:
    """Wall-clock duration in milliseconds.

    Returns ``None`` if ``begin_run()`` was not called for this run_id.
    """
    start = _start_times.get(run_id)
    if start is None:
        return None
    return int((time.monotonic() - start) * 1000)


def end_run(run_id: str) -> tuple[dict, Optional[int]]:
    """Return ``(cost_payload, duration_ms)`` AND clear in-memory state.

    Called by Publisher node (success path) or FastAPI handler (failure
    path).
    """
    payload = get_cost_payload(run_id)
    duration = get_duration_ms(run_id)
    with _store_lock:
        _store.pop(run_id, None)
    _start_times.pop(run_id, None)
    return payload, duration


def cost_payload_to_json(payload: dict) -> str:
    """JSON-stringify for Sanity ``pipelineMetadata.cost`` and
    Convex ``pipelineRuns.cost``.
    """
    return json.dumps(payload)


class CostRecorder:
    """Context manager wrapper bound to a run_id.

    Mirrors CONTEXT D-22 verbal description ("CostRecorder context manager
    bound to runId"). Light syntactic sugar over the module-level functions;
    Phase 5 may prefer the explicit calls or this CM form.

    Example::

        with CostRecorder(run_id) as cr:
            cr.record('calibrator', usd=0.001, duration_ms=120)
            ...
        # payload + duration available on exit via cr.payload, cr.duration_ms
    """

    def __init__(self, run_id: str) -> None:
        self.run_id = run_id
        self.payload: dict = {}
        self.duration_ms: Optional[int] = None

    def __enter__(self) -> "CostRecorder":
        begin_run(self.run_id)
        return self

    def record(
        self,
        agent_name: str,
        *,
        tokens_in: int = 0,
        tokens_out: int = 0,
        usd: float = 0.0,
        duration_ms: int = 0,
    ) -> None:
        record_cost(
            self.run_id,
            agent_name,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            usd=usd,
            duration_ms=duration_ms,
        )

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.payload, self.duration_ms = end_run(self.run_id)
        # Don't suppress exceptions.
        return None
