#!/usr/bin/env python
"""Phase 25 (RUN-01..RUN-06) — idempotent live-Convex seed for run-control config.

Seeds five new ``pipeline_config`` keys required by Phase 25 run control.
All seeds use ``pipelineConfig:upsert`` which patches by ``by_workspace_key``
index, making this script **safe to re-run at any time** — existing values are
overwritten with the defaults only if the key is absent or stale.

Keys seeded (JSON-encoded values, stored as ``v.string()``):

  per_run_cap_usd         10.0           Hard-stop cap per run (USD, D-08)
  monthly_cap_usd         200.0          Monthly budget cap (USD, D-06/D-07)
  alert_threshold_pct     80             % of monthly cap that triggers alert (D-09)
  schedule_cadence        {...}          Structured Thursday 14:00 UTC cadence (D-10/D-11)
  schedule_next_run_at    0              Cursor (Unix ms UTC); 0 = never triggered (D-10)

The automation kill-switch key is intentionally NOT seeded here — it was
seeded by Phase 22 (``seed_phase22.py``) with a default of ``false``.
Automation remains off by default until the operator explicitly enables it
from the dashboard.

Run AFTER the Convex functions are deployed and the env is populated:

    cd packages/pipeline && uv run python scripts/seed_phase25_config.py

Requires ``NEXT_PUBLIC_CONVEX_URL`` + ``CONVEX_DEPLOY_KEY`` in the environment
(the same two vars the FastAPI lifespan uses to build its Convex client).

Source: 25-01-PLAN.md Task 2; 25-CONTEXT.md D-06/D-07/D-08/D-09/D-10/D-11;
25-RESEARCH.md Pattern 3 (cadence representation), Pattern 4 (budget start-gate).
"""
from __future__ import annotations

import asyncio
import json
import os

from httpx import AsyncClient

from eisenbalm_pipeline.lib.convex_client import convex_mutation

# workspace_id constant — matches WORKSPACE_ID in lib/config_loader.py
WORKSPACE_ID = "eisenbalm"

# Phase 25 run-control pipeline_config defaults.
# Values are JSON-encoded strings to match the pipelineConfig:upsert
# ``value: v.string()`` contract and the loader's ``json.loads(r["value"])`` read.
#
# NOTE: The automation kill-switch key is NOT here — already seeded by Phase 22
# with default False. Adding it here would reset any operator toggle.
_PHASE25_CONFIG_DEFAULTS: dict[str, object] = {
    "per_run_cap_usd": 10.0,
    "monthly_cap_usd": 200.0,
    "alert_threshold_pct": 80,
    "schedule_cadence": {
        "dayOfWeek": 4,   # Thursday (0=Mon ... 6=Sun, matching Python weekday)
        "hourUtc": 14,    # 14:00 UTC (matches cli.py cron 0 14 * * 4)
        "minuteUtc": 0,
    },
    "schedule_next_run_at": 0,  # 0 = never triggered; advance on first cron fire
}


def _build_client() -> AsyncClient:
    """Construct a standalone Convex AsyncClient (mirrors the FastAPI lifespan).

    Uses the same NEXT_PUBLIC_CONVEX_URL base_url + rstrip("/") the lifespan
    applies; ``convex_mutation`` adds the ``Authorization: Convex {key}`` header
    from CONVEX_DEPLOY_KEY per call.
    """
    return AsyncClient(
        base_url=os.environ["NEXT_PUBLIC_CONVEX_URL"].rstrip("/"),
        timeout=30.0,
    )


async def _seed_run_control_config(http: AsyncClient) -> int:
    """Upsert the five Phase 25 pipeline_config keys (idempotent)."""
    count = 0
    for key, value in _PHASE25_CONFIG_DEFAULTS.items():
        await convex_mutation(
            http,
            "pipelineConfig:upsert",
            {
                "workspace_id": WORKSPACE_ID,
                "key": key,
                "value": json.dumps(value),
            },
        )
        count += 1
        display_value = json.dumps(value) if isinstance(value, dict) else value
        print(f"  OK pipelineConfig:upsert {key:25s} = {display_value}")
    return count


async def main() -> None:
    """Seed Phase 25 run-control pipeline_config keys (idempotent, re-runnable)."""
    http = _build_client()
    try:
        print(f"Seeding Phase 25 run-control config for workspace={WORKSPACE_ID!r} …")
        print("pipeline_config (run-control keys):")
        n_config = await _seed_run_control_config(http)
    finally:
        await http.aclose()

    print(
        f"\nSeed complete — {n_config} pipeline_config keys seeded (idempotent; re-runnable)."
    )
    print("NOTE: automation kill-switch not seeded — it stays off by default (Phase 22 default).")


if __name__ == "__main__":
    asyncio.run(main())
