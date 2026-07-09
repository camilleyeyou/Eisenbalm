"""Phase 37 Plan 02 — Clerk-guarded adjudication bridge (SIG-03, D-12/D-13).

Task 1 (shared resume extraction, interface-first):
  test_resume_paused_run_raises_409_when_not_paused
    _resume_paused_run(app, run_id, charity_name) 409s when the graph's
    checkpoint state.next is empty (not paused).
  test_resume_paused_run_schedules_resume_and_returns
    On a paused graph, schedules the background Command(resume=...) invoke
    and returns {"runId", "resumed": True} immediately (fire-and-forget).

Task 2 (POST /issues/{run_id}/adjudicate bridge) tests are appended below
this docstring by the follow-up task.

Source: 37-02-adjudication-bridge-PLAN.md Tasks 1-2 + 37-CONTEXT.md D-12/D-13.
"""
from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from eisenbalm_pipeline.api import runs

pytestmark = pytest.mark.anyio


# ── Shared fakes ────────────────────────────────────────────────────────────

def _fake_graph(*, paused: bool) -> SimpleNamespace:
    next_value = ("editor_gate_1",) if paused else ()
    return SimpleNamespace(
        aget_state=AsyncMock(return_value=SimpleNamespace(next=next_value)),
        ainvoke=AsyncMock(return_value={}),
    )


def _fake_app(*, paused: bool) -> SimpleNamespace:
    """Bare app stand-in carrying app.state.{graph, background_tasks, convex_http}."""
    app_state = SimpleNamespace(
        graph=_fake_graph(paused=paused),
        background_tasks=set(),
        convex_http=MagicMock(),
    )
    return SimpleNamespace(state=app_state)


# ── Task 1: _resume_paused_run extraction ──────────────────────────────────

async def test_resume_paused_run_raises_409_when_not_paused() -> None:
    """Not-paused graph (state.next empty) -> HTTPException(409)."""
    app = _fake_app(paused=False)

    with pytest.raises(HTTPException) as exc_info:
        await runs._resume_paused_run(app, "run-not-paused-001", "SomeCharity")

    assert exc_info.value.status_code == 409


async def test_resume_paused_run_schedules_resume_and_returns() -> None:
    """Paused graph -> schedules Command(resume=...) and returns immediately."""
    app = _fake_app(paused=True)

    result = await runs._resume_paused_run(app, "run-paused-001", "SomeCharity")

    assert result == {"runId": "run-paused-001", "resumed": True}

    # Fire-and-forget: yield to the event loop so the background task runs.
    await asyncio.sleep(0)

    graph = app.state.graph
    assert graph.ainvoke.await_count == 1
    (command,), kwargs = graph.ainvoke.call_args
    assert command.resume == {"editorSelection": "SomeCharity"}
    assert kwargs["config"] == {"configurable": {"thread_id": "run-paused-001"}}
