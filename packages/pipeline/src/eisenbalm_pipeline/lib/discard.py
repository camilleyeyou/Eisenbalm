"""Quick 261022-x8y — discard an unpublished issue.

Kept apart from api/runs.py and api/control.py to avoid an import cycle.
All Sanity/Convex calls go through module attributes so tests can patch them.
"""
from __future__ import annotations

import logging
import time
from typing import Any

import eisenbalm_pipeline.lib.convex_client as _cc
import eisenbalm_pipeline.lib.sanity_client as _sc

log = logging.getLogger(__name__)

DISCARD_MESSAGE = "Discarded by the editor"


class IssuePublished(Exception):
    """The issue was published; nothing may be deleted."""


def pending(app: Any) -> dict:
    if not hasattr(app.state, "pending_discards"):
        app.state.pending_discards = {}
    return app.state.pending_discards


def has_live_task(app: Any, run_id: str) -> bool:
    names = {f"run:{run_id}", f"resume:{run_id}"}
    tasks = getattr(app.state, "background_tasks", None) or ()
    return any(t.get_name() in names and not t.done() for t in tasks)


async def land_discarded(http: Any, run_id: str) -> None:
    now = int(time.time() * 1000)
    await _cc.convex_mutation(
        http, "runs:updateStatus", {"runId": run_id, "status": "cancelled", "completedAt": now}
    )
    try:
        await _cc.convex_mutation(
            http,
            "pipelineRuns:updateStatus",
            {"runId": run_id, "status": "failed", "completedAt": now, "errorMessage": DISCARD_MESSAGE},
        )
    except Exception:  # noqa: BLE001 — legacy rows may lack a pipelineRuns twin
        log.warning("discard: pipelineRuns update failed for %s", run_id, exc_info=True)


async def discard_issue_docs(
    run_id: str, issue_number: int | None, *, check_published: bool = True
) -> None:
    if issue_number is None:
        return
    http = getattr(_sc, "_CLIENT", None)
    docs = await _sc.find_issue_docs(http, issue_number)
    checked = docs if check_published else [d for d in docs if d.get("runId") == run_id]
    if _sc.issue_docs_published(checked):
        raise IssuePublished(f"issue {issue_number} is published")
    await _sc.delete_run_issue_docs(http, issue_number, run_id)


async def finish_pending_discard(app: Any, run_id: str) -> None:
    """Called in ``finally`` once the graph has stopped. Never raises."""
    if run_id not in pending(app):
        return
    issue_number = pending(app).pop(run_id)
    http = getattr(app.state, "convex_http", None)
    try:
        await land_discarded(http, run_id)
    except Exception:  # noqa: BLE001
        log.exception("discard: could not land cancelled status for %s", run_id)
    try:
        await discard_issue_docs(run_id, issue_number)
    except IssuePublished:
        log.error("discard refused for %s: issue is published", run_id)
    except Exception:  # noqa: BLE001
        log.exception("discard: delete failed for %s", run_id)
