"""Quick 261022-cr6 (client bug 3) — POST /runs/{id}/cancel on a run paused at Gate 1.

A run parked at the LangGraph interrupt (runs.status 'awaiting-review', no
completedAt) never executes another node, so the cooperative cancel flag can
never fire. The endpoint must land the terminal status itself.
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from eisenbalm_pipeline.api.control import router as control_router

pytestmark = pytest.mark.anyio


async def _post_cancel(run_id: str, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)
    app = FastAPI()
    app.include_router(control_router)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        return await client.post(f"/runs/{run_id}/cancel")


def _paths(store) -> list[str]:
    return [p for p, _ in store.all_calls()]


async def test_cancel_paused_at_gate1_lands_terminal_status(convex_runs_store, monkeypatch) -> None:
    run_id = "run-paused-001"
    convex_runs_store.seed({"runId": run_id, "status": "awaiting-review", "workspace_id": "eisenbalm"})

    response = await _post_cancel(run_id, monkeypatch)

    assert response.status_code == 200, response.text
    assert response.json() == {"runId": run_id, "status": "cancelled", "stopped": True}
    calls = dict(reversed(convex_runs_store.all_calls()))
    assert calls["runs:updateStatus"]["status"] == "cancelled"
    assert isinstance(calls["runs:updateStatus"]["completedAt"], int)
    assert calls["pipelineRuns:updateStatus"]["status"] == "failed"
    assert calls["pipelineRuns:updateStatus"]["errorMessage"] == (
        "Stopped by the editor while paused at charity selection."
    )
    assert "runs:requestCancel" not in _paths(convex_runs_store)


@pytest.mark.parametrize("status_value", ["complete", "failed", "cancelled"])
async def test_cancel_terminal_run_is_a_noop(convex_runs_store, monkeypatch, status_value) -> None:
    run_id = "run-term-001"
    convex_runs_store.seed({"runId": run_id, "status": status_value, "workspace_id": "eisenbalm"})

    response = await _post_cancel(run_id, monkeypatch)

    assert response.json()["alreadyTerminal"] is True
    assert "runs:updateStatus" not in _paths(convex_runs_store)
    assert "pipelineRuns:updateStatus" not in _paths(convex_runs_store)


async def test_cancel_finished_awaiting_review_is_a_noop(convex_runs_store, monkeypatch) -> None:
    """A genuine final-review run (completedAt set) can never be 'stopped'."""
    run_id = "run-final-001"
    convex_runs_store.seed(
        {"runId": run_id, "status": "awaiting-review", "completedAt": 1700000000000, "workspace_id": "eisenbalm"}
    )

    response = await _post_cancel(run_id, monkeypatch)

    assert response.json() == {"runId": run_id, "status": "awaiting-review", "alreadyTerminal": True}
    assert "runs:updateStatus" not in _paths(convex_runs_store)


async def test_cancel_running_run_only_sets_the_flag(convex_runs_store, monkeypatch) -> None:
    run_id = "run-live-001"
    convex_runs_store.seed({"runId": run_id, "status": "running", "workspace_id": "eisenbalm"})

    response = await _post_cancel(run_id, monkeypatch)

    assert response.json() == {"runId": run_id, "cancelRequested": True}
    assert "runs:requestCancel" in _paths(convex_runs_store)
    assert "runs:updateStatus" not in _paths(convex_runs_store)
