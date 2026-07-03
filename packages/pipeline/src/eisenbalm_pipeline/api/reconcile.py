"""Startup reconciliation sweep (Phase 29 D-4): unstick runs orphaned by a
Railway restart.

A run executes as an in-process ``asyncio.create_task`` (api/runs.py
``_execute_run``), strong-ref'd into ``app.state.background_tasks`` — a set
rebuilt EMPTY on every process boot. A Railway restart/redeploy kills the
whole Python process; the next boot has no memory of what was running.
Convex's ``runs.status`` / ``pipelineRuns.status`` stay ``"running"`` forever
once orphaned this way, and the one-at-a-time gate
(``control.py::pipeline_run`` / ``pipeline_tick``, both check
``runs:latest`` for ``status == "running"``) then blocks every future run
permanently.

Confirmed architecture fact (29-RESEARCH.md "Pipeline Restart
Reconciliation"): this is a single-process architecture with no distributed
workers or task queue — ANY Convex run with ``status == "running"`` at boot
is, by definition, orphaned. Nothing can genuinely still be running
immediately after a fresh lifespan starts.

Reuses the SAME termination mutation pair the RunCancelled/CostCapExceeded
path in ``api/runs.py::_execute_run`` already calls (``runs:updateStatus`` +
``pipelineRuns:updateStatus``) — no new Convex table or function is added
anywhere. Both mutations are Plan-01 secret-guarded; relies on
``convex_client.convex_mutation``'s central ``pipelineSecret`` injection —
no secret handling needed here.

Does NOT attempt checkpointer resume (explicitly deferred, 29-CONTEXT D-4) —
marks the run terminal only; a human must manually re-trigger a fresh run for
that issue number if content was lost mid-run.
"""
from __future__ import annotations

import logging
import time
from typing import Any

from eisenbalm_pipeline.lib.convex_client import convex_mutation, convex_query

log = logging.getLogger(__name__)

WORKSPACE_ID = "eisenbalm"

_ORPHAN_ERROR_MESSAGE = "Orphaned by service restart — no live task after reboot"


async def reconcile_orphaned_runs(convex_http: Any) -> int:
    """Mark any Convex run stuck 'running' at boot as terminal ('failed').

    Called from api/main.py's lifespan on the CLEAN-boot path only, AFTER
    ``convex_client.set_client(convex_http)`` and BEFORE ``yield``.

    Returns:
        The number of runs reconciled. Never raises — a Convex failure during
        the sweep is logged as a warning and treated as 0 reconciled, so a
        transient Convex outage cannot prevent the pipeline from booting
        (mirrors the rest of lifespan's degrade-don't-crash posture).
    """
    try:
        rows = (
            await convex_query(
                convex_http,
                "runs:listForWorkspace",
                {"workspace_id": WORKSPACE_ID},
            )
            or []
        )
    except Exception as exc:  # noqa: BLE001 — never block boot on a Convex blip
        log.warning("reconcile_orphaned_runs: listForWorkspace failed: %r", exc)
        return 0

    orphaned = [row for row in rows if row.get("status") == "running"]
    if not orphaned:
        log.info("reconcile_orphaned_runs: no orphaned runs found at boot.")
        return 0

    now_ms = int(time.time() * 1000)
    reconciled = 0
    for row in orphaned:
        run_id = row.get("runId")
        if not run_id:
            continue
        try:
            await convex_mutation(
                convex_http,
                "runs:updateStatus",
                {"runId": run_id, "status": "failed", "completedAt": now_ms},
            )
            await convex_mutation(
                convex_http,
                "pipelineRuns:updateStatus",
                {
                    "runId": run_id,
                    "status": "failed",
                    "errorMessage": _ORPHAN_ERROR_MESSAGE,
                    "completedAt": now_ms,
                },
            )
            reconciled += 1
        except Exception as exc:  # noqa: BLE001 — one bad row must not abort the sweep
            log.warning(
                "reconcile_orphaned_runs: failed to reconcile run %r: %r",
                run_id,
                exc,
            )

    log.warning(
        "reconcile_orphaned_runs: marked %d orphaned run(s) as failed after restart.",
        reconciled,
    )
    return reconciled
