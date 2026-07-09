"""Tests for eisenbalm_pipeline.lib.agent_wrapper (OBS-03/OBS-04/OBS-05).

TDD GREEN tests — validate wrap_agent_node() lifecycle behaviour:
  (a) success path: emits started → completed → savePayload with correct cost
  (b) failure path: emits failed, re-raises exception
  (c) no-cost node: validate_sections yields costUsd == 0.0

The convex_mutation_safe call is monkeypatched with an async recorder so
these tests run without a live Convex deployment.
"""
from __future__ import annotations

import pytest

from eisenbalm_pipeline.lib.cost import begin_run, record_cost


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_state(run_id: str = "test-run-001") -> dict:
    """Minimal DispatchState for wrapper tests."""
    return {"run_id": run_id}


class _MutationRecorder:
    """Async callable that records (path, args) pairs."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, dict]] = []

    async def __call__(self, path: str, args: dict) -> None:
        self.calls.append((path, args))

    @property
    def paths(self) -> list[str]:
        return [c[0] for c in self.calls]

    def args_for(self, path: str) -> dict:
        for p, a in self.calls:
            if p == path:
                return a
        raise KeyError(f"No call found with path={path!r}")


# ── Test (a): success path ────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_success_emits_started_completed_savePayload(monkeypatch: pytest.MonkeyPatch) -> None:
    """wrap_agent_node emits exactly started → completed → savePayload on success.

    Also verifies that completed carries the cost recorded by record_cost.
    """
    run_id = "test-run-success-001"
    agent_key = "scout"

    # Seed cost data (simulates acomplete() having been called by the agent)
    begin_run(run_id)
    record_cost(run_id, agent_key, tokens_in=1200, tokens_out=340, usd=0.021, duration_ms=8400)

    recorder = _MutationRecorder()
    monkeypatch.setattr(
        "eisenbalm_pipeline.lib.agent_wrapper.convex_mutation_safe",
        recorder,
    )

    from eisenbalm_pipeline.lib.agent_wrapper import wrap_agent_node

    async def fn(state: dict) -> dict:
        return {"ok": 1}

    wrapped = wrap_agent_node(agent_key, fn)
    result = await wrapped(_make_state(run_id))

    # Return value is unchanged
    assert result == {"ok": 1}

    # Exactly three mutations emitted in order
    assert recorder.paths == [
        "agentRuns:started",
        "agentRuns:completed",
        "agentRuns:savePayload",
    ]

    # started carries runId + agentKey + workspace_id
    started_args = recorder.args_for("agentRuns:started")
    assert started_args["runId"] == run_id
    assert started_args["agentKey"] == agent_key
    assert "startedAt" in started_args
    assert "workspace_id" in started_args

    # completed carries the recorded costUsd
    completed_args = recorder.args_for("agentRuns:completed")
    assert completed_args["runId"] == run_id
    assert completed_args["agentKey"] == agent_key
    assert completed_args["costUsd"] == pytest.approx(0.021)
    assert completed_args["tokensIn"] == 1200
    assert completed_args["tokensOut"] == 340
    assert completed_args["durationMs"] == 8400
    assert "completedAt" in completed_args
    # Phase 37 §37.1: no retries recorded — retryCount defaults to 0.
    assert completed_args["retryCount"] == 0

    # savePayload carries runId + agentKey
    payload_args = recorder.args_for("agentRuns:savePayload")
    assert payload_args["runId"] == run_id
    assert payload_args["agentKey"] == agent_key


# ── Test (b): failure path ────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_failure_emits_failed_and_reraises(monkeypatch: pytest.MonkeyPatch) -> None:
    """wrap_agent_node emits agentRuns:failed with error string and re-raises."""
    run_id = "test-run-failure-001"
    agent_key = "researcher"

    begin_run(run_id)

    recorder = _MutationRecorder()
    monkeypatch.setattr(
        "eisenbalm_pipeline.lib.agent_wrapper.convex_mutation_safe",
        recorder,
    )

    from eisenbalm_pipeline.lib.agent_wrapper import wrap_agent_node

    async def fn(state: dict) -> dict:
        raise ValueError("boom")

    wrapped = wrap_agent_node(agent_key, fn)

    with pytest.raises(ValueError, match="boom"):
        await wrapped(_make_state(run_id))

    # Must have emitted started + failed (no completed, no savePayload)
    assert "agentRuns:started" in recorder.paths
    assert "agentRuns:failed" in recorder.paths
    assert "agentRuns:completed" not in recorder.paths
    assert "agentRuns:savePayload" not in recorder.paths

    failed_args = recorder.args_for("agentRuns:failed")
    assert failed_args["runId"] == run_id
    assert failed_args["agentKey"] == agent_key
    assert failed_args["error"] == "boom"


# ── Test (c): no-cost node ────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_no_cost_node_emits_zero_cost(monkeypatch: pytest.MonkeyPatch) -> None:
    """A node with no recorded cost (e.g. validate_sections) yields costUsd == 0.0."""
    run_id = "test-run-nocost-001"
    agent_key = "validate_sections"

    begin_run(run_id)
    # Deliberately do NOT record any cost for validate_sections

    recorder = _MutationRecorder()
    monkeypatch.setattr(
        "eisenbalm_pipeline.lib.agent_wrapper.convex_mutation_safe",
        recorder,
    )

    from eisenbalm_pipeline.lib.agent_wrapper import wrap_agent_node

    async def fn(state: dict) -> dict:
        return {"validated": True}

    wrapped = wrap_agent_node(agent_key, fn)
    result = await wrapped(_make_state(run_id))

    assert result == {"validated": True}

    # completed is still emitted
    assert "agentRuns:completed" in recorder.paths

    completed_args = recorder.args_for("agentRuns:completed")
    assert completed_args["costUsd"] == 0.0
    assert completed_args["tokensIn"] == 0
    assert completed_args["tokensOut"] == 0
    assert completed_args["durationMs"] == 0
    assert completed_args["retryCount"] == 0


# ── Test (d): retryCount plumbing (Phase 37 §37.1) ───────────────────────────

@pytest.mark.anyio
async def test_completed_carries_recorded_retries_as_retry_count(monkeypatch: pytest.MonkeyPatch) -> None:
    """A node whose acomplete() call(s) needed a regenerate-retry surfaces retryCount."""
    run_id = "test-run-retries-001"
    agent_key = "editor_gate1"

    begin_run(run_id)
    record_cost(run_id, agent_key, tokens_in=200, tokens_out=100, usd=0.02, duration_ms=400, retries=1)

    recorder = _MutationRecorder()
    monkeypatch.setattr(
        "eisenbalm_pipeline.lib.agent_wrapper.convex_mutation_safe",
        recorder,
    )

    from eisenbalm_pipeline.lib.agent_wrapper import wrap_agent_node

    async def fn(state: dict) -> dict:
        return {"ok": 1}

    wrapped = wrap_agent_node(agent_key, fn)
    await wrapped(_make_state(run_id))

    completed_args = recorder.args_for("agentRuns:completed")
    assert completed_args["retryCount"] == 1
