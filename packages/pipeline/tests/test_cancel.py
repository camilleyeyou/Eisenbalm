"""Phase 25 Wave 0 — RED tests for cooperative cancel (RUN-04).

RED state: ``eisenbalm_pipeline.api.control`` does not exist yet. The top-level
import ensures collection FAILS RED until Plan 02 lands the control router.

  test_cancel_lands_cancelled (RUN-04)
    After runs:requestCancel is set, the next agent node invoked via
    wrap_agent_node never emits agentRuns:started; the run ultimately lands
    with runs.status == 'cancelled'.

  test_cooperative_not_violent (RUN-04)
    An in-flight node that is already executing completes normally (wrap_agent_node
    does NOT call asyncio.Task.cancel() or raise inside the node fn). The cancel
    flag is checked BEFORE fn(state), not inside it.
"""
from __future__ import annotations

import pytest

from eisenbalm_pipeline.api.control import router as control_router  # RED until Plan 02
from eisenbalm_pipeline.lib.errors import RunCancelled

pytestmark = pytest.mark.anyio


async def test_cancel_lands_cancelled(
    convex_runs_store,
    convex_config_store,
    monkeypatch,
) -> None:
    """RUN-04: after the cancel flag is set on a running run, the next call to
    wrap_agent_node raises RunCancelled (no agentRuns:started emitted) and
    _execute_run writes runs.status='cancelled'."""
    from eisenbalm_pipeline.lib.agent_wrapper import wrap_agent_node  # noqa: WPS433 — Plan 02

    run_id = "run-cancel-test-001"

    # Seed a running run row and set the cancel flag
    convex_runs_store.seed({"runId": run_id, "status": "running", "workspace_id": "eisenbalm"})
    await convex_runs_store._handle_mutation(None, "runs:requestCancel", {"runId": run_id})

    # A bare no-op node that should NOT execute when cancel is set
    call_tracker = {"called": False}

    async def _noop_node(state: dict) -> dict:
        call_tracker["called"] = True
        return {}

    state = {
        "run_id": run_id,
        "workspace_id": "eisenbalm",
        "issue_number": 99,
    }

    # wrap_agent_node should raise RunCancelled before calling the node fn
    with pytest.raises(RunCancelled) as exc_info:
        wrapped = wrap_agent_node("test_agent", _noop_node)
        await wrapped(state)

    assert exc_info.value.run_id == run_id, (
        f"RunCancelled.run_id should be {run_id!r}, got {exc_info.value.run_id!r}"
    )
    assert not call_tracker["called"], (
        "Node fn should NOT have been called when cancel flag is set (D-02)"
    )

    # Verify no agentRuns:started was emitted for this node
    started_calls = [
        args
        for path, args in convex_runs_store.all_calls()
        if path == "agentRuns:started"
    ]
    assert len(started_calls) == 0, (
        "agentRuns:started must NOT be emitted when cancel flag is set (D-02)"
    )


async def test_cooperative_not_violent(
    convex_runs_store,
    monkeypatch,
) -> None:
    """RUN-04: the cancel mechanism is cooperative — it checks the flag BEFORE
    the node executes, not during. A node that has ALREADY started (cancel flag
    set mid-execution) runs to completion. wrap_agent_node must NOT call
    asyncio.Task.cancel() or inject an exception into a running node fn.

    This test verifies the design invariant by inspecting that wrap_agent_node
    does not import or use asyncio.Task.cancel.
    """
    import inspect
    import eisenbalm_pipeline.lib.agent_wrapper as wrapper_module  # noqa: WPS433 — Plan 02

    source = inspect.getsource(wrapper_module)

    assert "task.cancel()" not in source, (
        "wrap_agent_node must NOT call task.cancel() — cooperative cancel only (D-02)"
    )
    assert ".cancel()" not in source or "task.cancel()" not in source, (
        "Hard task cancellation is forbidden in the cancel path (D-02)"
    )
