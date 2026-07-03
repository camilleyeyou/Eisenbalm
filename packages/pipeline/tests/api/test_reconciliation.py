"""Phase 29 D-4 — restart reconciliation sweep unit tests.

reconcile_orphaned_runs() must mark ONLY runs:listForWorkspace rows with
status == "running" as terminal (via the SAME runs:updateStatus +
pipelineRuns:updateStatus mutation pair api/runs.py::_execute_run's
RunCancelled/CostCapExceeded path already uses) — rows in any other status
must be left completely alone, and a Convex failure during the sweep must
degrade (log + return 0), never crash boot.
"""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from eisenbalm_pipeline.api.reconcile import reconcile_orphaned_runs


async def test_reconcile_marks_only_running_rows_as_failed(monkeypatch):
    rows = [
        {"runId": "run-orphan-1", "status": "running"},
        {"runId": "run-done-1", "status": "complete"},
        {"runId": "run-failed-1", "status": "failed"},
        {"runId": "run-orphan-2", "status": "running"},
        {"runId": "run-review-1", "status": "awaiting-review"},
    ]
    fake_query = AsyncMock(return_value=rows)
    fake_mutation = AsyncMock(return_value=None)

    monkeypatch.setattr("eisenbalm_pipeline.api.reconcile.convex_query", fake_query)
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.reconcile.convex_mutation", fake_mutation
    )

    count = await reconcile_orphaned_runs(convex_http=object())

    assert count == 2

    fake_query.assert_awaited_once()
    query_args = fake_query.await_args.args
    assert query_args[1] == "runs:listForWorkspace"
    assert query_args[2] == {"workspace_id": "eisenbalm"}

    runs_update_calls = [
        call for call in fake_mutation.await_args_list if call.args[1] == "runs:updateStatus"
    ]
    pipeline_runs_update_calls = [
        call
        for call in fake_mutation.await_args_list
        if call.args[1] == "pipelineRuns:updateStatus"
    ]

    assert {c.args[2]["runId"] for c in runs_update_calls} == {
        "run-orphan-1",
        "run-orphan-2",
    }
    assert {c.args[2]["runId"] for c in pipeline_runs_update_calls} == {
        "run-orphan-1",
        "run-orphan-2",
    }

    for call in runs_update_calls + pipeline_runs_update_calls:
        assert call.args[2]["status"] == "failed"
    for call in pipeline_runs_update_calls:
        assert "errorMessage" in call.args[2]

    # Non-running rows must never appear in ANY mutation call.
    all_mutated_run_ids = {call.args[2]["runId"] for call in fake_mutation.await_args_list}
    assert "run-done-1" not in all_mutated_run_ids
    assert "run-failed-1" not in all_mutated_run_ids
    assert "run-review-1" not in all_mutated_run_ids


async def test_reconcile_returns_zero_when_nothing_orphaned(monkeypatch):
    rows = [{"runId": "run-1", "status": "complete"}]
    fake_mutation = AsyncMock(return_value=None)

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.reconcile.convex_query", AsyncMock(return_value=rows)
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.reconcile.convex_mutation", fake_mutation
    )

    count = await reconcile_orphaned_runs(convex_http=object())
    assert count == 0
    fake_mutation.assert_not_awaited()


async def test_reconcile_degrades_on_convex_query_failure(monkeypatch):
    """A Convex outage during the sweep must never crash boot — log + return 0."""

    async def _boom(*args, **kwargs):
        raise RuntimeError("Convex unreachable")

    monkeypatch.setattr("eisenbalm_pipeline.api.reconcile.convex_query", _boom)

    count = await reconcile_orphaned_runs(convex_http=object())
    assert count == 0


async def test_reconcile_continues_after_one_row_mutation_failure(monkeypatch):
    """One bad row's mutation failure must not abort the sweep for the rest."""
    rows = [
        {"runId": "run-bad", "status": "running"},
        {"runId": "run-good", "status": "running"},
    ]
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.reconcile.convex_query", AsyncMock(return_value=rows)
    )

    async def _flaky_mutation(http, path, args):
        if args.get("runId") == "run-bad" and path == "runs:updateStatus":
            raise RuntimeError("transient Convex error")
        return None

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.reconcile.convex_mutation", _flaky_mutation
    )

    count = await reconcile_orphaned_runs(convex_http=object())
    assert count == 1
