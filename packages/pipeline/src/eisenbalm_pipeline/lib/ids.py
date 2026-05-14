"""Run-ID generation. See CONTEXT D-09."""
from __future__ import annotations

import uuid


def new_run_id() -> str:
    """Return a fresh run_id as uuid4 hex (32 chars, no dashes).

    Generated exactly ONCE per /run/weekly request (CONTEXT D-09).
    Used as both the pipelineRuns.runId in Convex AND the LangGraph
    thread_id for AsyncPostgresSaver (CONTEXT D-10).
    """
    return uuid.uuid4().hex
