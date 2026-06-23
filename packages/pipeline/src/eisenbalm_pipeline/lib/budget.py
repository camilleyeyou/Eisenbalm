"""Phase 25 (RUN-06) — Budget projection helpers for the run start-gate.

Provides:
  - ``trailing_average(trailing_costs)`` — average of the last-N run costs
    returned by ``runs:monthToDateCost``; returns None when the list is empty
    (zero-history edge D-06: allow the run).
  - ``would_exceed_monthly_cap(http, *, monthly_cap_usd)`` — async start-gate
    predicate; returns ``(True, info)`` when the projected MTD + next run would
    exceed the monthly cap, ``(False, info)`` otherwise.

Design constraints (from RESEARCH Pattern 4 + Phase 23 Pitfall 3):
  - READ-ONLY: no record_cost calls, no cost writes of any kind.
  - No Convex reads inside the hot acomplete path — this module is called ONCE
    at run start (before asyncio.create_task), not during LLM calls.
  - Budget math reads actual recorded ``runs.cost`` ONLY (via
    ``runs:monthToDateCost``). Never derives from model_pricing.

Zero-history edge (D-06): when no completed runs exist (``trailingCosts`` is
empty), ``trailing_average`` returns None and ``would_exceed_monthly_cap``
returns ``(False, ...)`` — the first-ever run is always allowed.
"""
from __future__ import annotations

import logging
from typing import Any

import eisenbalm_pipeline.lib.convex_client as _cc

log = logging.getLogger(__name__)

# Workspace constant (mirrors config_loader.WORKSPACE_ID).
_WORKSPACE_ID = "eisenbalm"


def trailing_average(trailing_costs: list[float]) -> float | None:
    """Average of the provided trailing run costs.

    The caller passes the ``trailingCosts`` list from ``runs:monthToDateCost``
    (already limited to the last 4 completed runs by the Convex query).

    Returns:
        float: the mean cost when ``trailing_costs`` is non-empty.
        None: when the list is empty (zero-history edge — caller should allow
              the run; D-06 first-run edge).
    """
    if not trailing_costs:
        return None
    return sum(trailing_costs) / len(trailing_costs)


async def would_exceed_monthly_cap(
    http: Any,
    *,
    monthly_cap_usd: float,
) -> tuple[bool, dict]:
    """Start-gate predicate: would launching a run now exceed the monthly cap?

    Algorithm:
      1. If ``monthly_cap_usd <= 0`` → cap disabled → return ``(False, {...})``.
      2. Fetch ``runs:monthToDateCost`` (single round-trip — RESEARCH Pattern 4).
      3. ``trailing_average(rollup["trailingCosts"])``
           → None means zero history → return ``(False, {"reason":"no_history",...})``.
      4. Project: ``over = (mtd + projected) > monthly_cap_usd``.
      5. Return ``(over, {"mtd", "projected", "cap"})``.

    Args:
        http:             httpx AsyncClient for Convex HTTP calls.
        monthly_cap_usd:  Monthly cap in USD (from pipeline_config or RunConfig).
                          0 / negative = cap disabled.

    Returns:
        ``(False, info)`` when the cap is disabled, history is empty, or the
        projected spend is within the cap.
        ``(True, info)`` when MTD + trailing average would exceed the cap.
        ``info`` always contains at least ``{"mtdUsd": float}``.
    """
    if monthly_cap_usd <= 0:
        return False, {"reason": "cap_disabled", "mtdUsd": 0.0}

    rollup = await _cc.convex_query(
        http,
        "runs:monthToDateCost",
        {"workspace_id": _WORKSPACE_ID},
    )
    mtd = float(rollup.get("mtdUsd", 0.0)) if rollup else 0.0
    trailing = list(rollup.get("trailingCosts", [])) if rollup else []

    proj = trailing_average(trailing)
    if proj is None:
        # Zero completed-run history — allow the run (D-06 first-run edge).
        return False, {"reason": "no_history", "mtdUsd": mtd}

    over = (mtd + proj) > monthly_cap_usd
    return over, {
        "mtdUsd": mtd,
        "projected": proj,
        "cap": monthly_cap_usd,
    }
