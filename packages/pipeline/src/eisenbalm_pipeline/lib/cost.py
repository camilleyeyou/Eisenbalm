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

import asyncio
import json
import logging
import os
import threading
import time
from typing import Optional, TypedDict

from eisenbalm_pipeline.lib.errors import CostCapExceeded

log = logging.getLogger(__name__)

__all__ = [
    "AgentCost",
    "CostRecorder",
    "CostCapExceeded",  # re-exported from lib.errors for caller convenience
    "begin_run",
    "record_cost",
    "get_cost_payload",
    "get_duration_ms",
    "end_run",
    "cost_payload_to_json",
    "get_recorder",
    "set_run_cap",
    "emit_monthly_alert",
]


class AgentCost(TypedDict):
    tokens_in: int
    tokens_out: int
    usd: float
    duration_ms: int
    retries: int


# Module-level in-memory store keyed by run_id (mirrors convex_client._CLIENT
# singleton pattern). Thread-safe via a lock — FastAPI runs concurrent
# requests on a single event loop, but tests may exercise multiple runs.
_store: dict[str, dict[str, AgentCost]] = {}
_store_lock = threading.Lock()

# Wall-clock start times keyed by run_id (CONTEXT D-23).
_start_times: dict[str, float] = {}

# Module-level dedup for cost-warning emissions (D-08 — one warn per run).
_warned_runs: set[str] = set()

# ── Phase 25 (RUN-06) per-run cap registry ────────────────────────────────────
# Keyed by run_id. Populated once at run start from RunConfig.per_run_cap_usd
# (DB-sourced). check_cap reads from here to avoid any Convex call in the hot
# acomplete path (RESEARCH Pattern 4). Falls back to env var when absent.
_run_caps: dict[str, float] = {}


def set_run_cap(run_id: str, cap_usd: float) -> None:
    """Snapshot the DB-sourced per-run cap for this run.

    Called once at run start (in _start_run, after load_run_config) before
    asyncio.create_task so check_cap can read from memory on every acomplete call.
    The resolved cap is RunConfig.per_run_cap_usd (from pipeline_config key
    'per_run_cap_usd'); it overrides the PIPELINE_COST_CAP_USD env var.

    Thread-safe: stores an immutable float keyed by run_id.
    """
    _run_caps[run_id] = cap_usd


async def emit_monthly_alert(
    run_id: str,
    mtd_usd: float,
    monthly_cap: float,
    threshold_pct: float,  # noqa: ARG001 — kept for caller symmetry; not stored
) -> None:
    """Fire-and-forget a cost-warning deliberationEvent with scope='monthly'.

    Reuses the existing 'cost-warning' eventType (frozen union — no new type
    added). Distinguishes monthly alerts from the per-run 70% warn via a
    ``scope`` field in the payload.

    Contract:
      - MUST NOT raise (swallows all exceptions — never blocks a run).
      - MUST NOT call record_cost (read-only; single-cost-writer rule preserved).
    """
    try:
        percent = (mtd_usd / monthly_cap) if monthly_cap > 0 else 0.0
        payload_json = json.dumps({
            "scope": "monthly",
            "mtdUsd": mtd_usd,
            "monthlyCapUsd": monthly_cap,
            "percentOfCap": percent,
        })
        from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
        asyncio.create_task(convex_mutation_safe(
            "deliberationEvents:insert",
            {
                "runId": run_id,
                "agentId": "cost-monitor",
                "eventType": "cost-warning",
                "payload": payload_json,
            },
        ))
    except Exception as exc:  # noqa: BLE001 — never let emit break a run
        log.warning("monthly cost-warning emission failed: %r", exc)


def get_recorder(run_id: str) -> "CostRecorder":
    """Return a CostRecorder bound to ``run_id``.

    Phase 5 ``lib.openrouter_client.acomplete`` calls this on every LLM
    invocation; the recorder shares the module-level ``_store`` keyed by
    run_id so token totals accumulate correctly across calls.
    """
    r = CostRecorder(run_id)
    r._warned = run_id in _warned_runs
    return r


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
    retries: int = 0,
) -> None:
    """Record one agent's cost contribution. Stub mode passes all 0s.

    Called by the ``@agent_node`` wrapper (Plan 06) after each successful
    agent execution. Multiple calls for the same ``(run_id, agent_name)``
    pair are additive — useful when an agent makes multiple tool calls.

    ``retries`` (Phase 37 §37.1): count of genuine LLM regenerate-retries
    ``acomplete()`` performed for this call (invoke-error retry or
    schema-miss regenerate, each capped at one). Defaults to 0 — legacy
    call sites that never pass it accumulate no retries.
    """
    with _store_lock:
        agents = _store.setdefault(run_id, {})
        existing = agents.get(
            agent_name,
            AgentCost(tokens_in=0, tokens_out=0, usd=0.0, duration_ms=0, retries=0),
        )
        agents[agent_name] = AgentCost(
            tokens_in=existing["tokens_in"] + tokens_in,
            tokens_out=existing["tokens_out"] + tokens_out,
            usd=existing["usd"] + usd,
            duration_ms=existing["duration_ms"] + duration_ms,
            retries=existing.get("retries", 0) + retries,
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
        # Phase 5 D-08 additions
        self._warned: bool = False
        self._last_agent: str = "unknown"

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
        self._last_agent = agent_name
        record_cost(
            self.run_id,
            agent_name,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            usd=usd,
            duration_ms=duration_ms,
        )

    async def check_cap(self) -> None:
        """Soft-warn at 70% of the per-run cap; hard-raise at 100% (D-08).

        Cap resolution order (no Convex read in this hot path — RESEARCH Pattern 4):
          1. In-memory per-run cap set via ``set_run_cap(run_id, cap)`` at run start
             (DB-sourced from RunConfig.per_run_cap_usd). This overrides the env var.
          2. ``PIPELINE_COST_CAP_USD`` env var (fallback for runs that pre-date RUN-06
             or whose cap was not snapshotted).

        Called by ``lib.openrouter_client.acomplete`` after every LLM call.

        Raises:
            CostCapExceeded: when cumulative USD >= cap. Caller's
                ``@agent_node`` wrapper translates this into
                ``pipelineRuns.status='failed'``.
        """
        # DB-sourced cap takes precedence (snapshotted once at run start via set_run_cap).
        cap = _run_caps.get(self.run_id, float(os.environ.get("PIPELINE_COST_CAP_USD", "10.0")))
        warn_pct = float(os.environ.get("PIPELINE_COST_WARN_PCT", "0.7"))

        # Total USD = sum across all per-agent records for this run_id.
        payload = get_cost_payload(self.run_id)
        total = payload.get("total", 0.0)

        if total >= cap:
            # 3-arg constructor (Plan 05-03 Task 1) — preserves total/cap/agent
            # as introspectable attributes on the exception.
            raise CostCapExceeded(total, cap, self._last_agent)

        if total >= cap * warn_pct and not self._warned:
            self._warned = True
            _warned_runs.add(self.run_id)
            # Fire-and-forget Convex emit. Import inline to avoid circular
            # dependency between lib.cost and lib.convex_client at module-load.
            try:
                from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
                payload_json = json.dumps({
                    "totalUsd": total,
                    "percentOfCap": (total / cap) if cap > 0 else 0.0,
                    "perAgent": payload.get("agents", {}),
                    "capUsd": cap,
                })
                # Don't await — the warn shouldn't slow the LLM call path.
                asyncio.create_task(convex_mutation_safe(
                    "deliberationEvents:insert",
                    {
                        "runId": self.run_id,
                        "agentId": "cost-monitor",
                        "eventType": "cost-warning",
                        "payload": payload_json,
                    },
                ))
            except Exception as exc:  # noqa: BLE001 — never let warn emission break the call
                log.warning("cost-warning emission failed: %r", exc)

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.payload, self.duration_ms = end_run(self.run_id)
        # Don't suppress exceptions.
        return None
