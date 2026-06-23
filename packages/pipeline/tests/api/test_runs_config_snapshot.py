"""Phase 22 Plan 05 — CFG-04 snapshot-ordering + resume-no-resnap tests.

Source: .planning/phases/22-config-externalization/22-RESEARCH.md
        (Pitfall 1 snapshot race; Pitfall 6 resume no re-snap; Pattern 4
        run-start sequence) + 22-VALIDATION.md.

Two invariants this phase locks:
  - ``snapshot_config()`` is AWAITED in the ``run_weekly`` HTTP handler BEFORE
    ``asyncio.create_task()`` — never inside ``_execute_run()`` (the race
    window). CFG-04 / Pitfall 1.
  - ``resume_run`` does NOT re-snapshot — the original run-start snapshot stays
    authoritative. Pitfall 6.

Both tests invoke the real ``eisenbalm_pipeline.api.runs`` handlers directly
with a lightweight fake Request (no FastAPI app / env vars required), and patch
``eisenbalm_pipeline.api.runs.snapshot_config`` AT ITS BINDING IN THE api.runs
MODULE (Task 1 imports it top-level, so ``run_weekly`` resolves it as a
module-global of api.runs; patching ``lib.config_loader.snapshot_config`` would
NOT intercept the call).
"""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from eisenbalm_pipeline.api import runs


def _fake_request() -> SimpleNamespace:
    """A minimal stand-in for fastapi.Request.

    Carries only what run_weekly / resume_run touch:
      - .headers (trigger-secret check — empty so the local-dev no-op path
        applies when PIPELINE_TRIGGER_SECRET is unset)
      - .app.state.convex_http / .graph / .background_tasks
    """
    app_state = SimpleNamespace(
        convex_http=MagicMock(),
        graph=MagicMock(),               # truthy → _require_graph passes
        background_tasks=set(),
    )
    app = SimpleNamespace(state=app_state)
    return SimpleNamespace(headers={}, app=app)


@pytest.mark.asyncio
async def test_snapshot_before_task(monkeypatch) -> None:
    """CFG-04: snapshot_config() is awaited BEFORE asyncio.create_task() in run_weekly.

    Shared ordered call recorder: patch the api.runs binding of snapshot_config
    AND asyncio.create_task to append a marker, then assert the snapshot
    marker's index precedes the create_task marker's index. Also assert the
    snapshot mock WAS called (await_count == 1) so the test cannot pass
    vacuously if snapshot_config is never reached.
    """
    if __import__("os").environ.get("PIPELINE_TRIGGER_SECRET"):
        pytest.skip(
            "PIPELINE_TRIGGER_SECRET set — fake-request path skips the secret "
            "check only when unset (local dev)"
        )

    call_order: list[str] = []

    mock_snapshot = AsyncMock(side_effect=lambda *a, **k: call_order.append("snapshot"))

    def fake_create_task(*args, **kwargs):
        call_order.append("create_task")
        # Cancel-safe stand-in: the real coroutine arg is never awaited here.
        coro = args[0] if args else None
        if coro is not None and hasattr(coro, "close"):
            coro.close()  # avoid "coroutine was never awaited" warning
        return MagicMock()

    # Patch AT THE api.runs BINDING (top-level import target), not lib.config_loader.
    monkeypatch.setattr(runs, "snapshot_config", mock_snapshot)
    monkeypatch.setattr(
        runs, "load_run_config", AsyncMock(return_value=MagicMock()), raising=True
    )
    monkeypatch.setattr(runs.asyncio, "create_task", fake_create_task)
    _convex_mock = AsyncMock(return_value={"status": "success"})
    monkeypatch.setattr(
        runs, "convex_mutation", _convex_mock
    )
    # Also patch _cc.convex_mutation (module-level) — _start_run uses _cc.convex_mutation
    # since Phase 25 import refactor; patching only the local name is insufficient.
    import eisenbalm_pipeline.lib.convex_client as _cc
    monkeypatch.setattr(_cc, "convex_mutation", _convex_mock)
    monkeypatch.setattr(runs, "begin_run", lambda *a, **k: None)
    monkeypatch.setattr(runs, "new_run_id", lambda: "run-snap-test-001")
    # Explicit issueNumber → _resolve_issue_number short-circuits (no Sanity read).

    body = runs.RunWeeklyBody(issueNumber=1234567)
    result = await runs.run_weekly(_fake_request(), body)

    assert result["runId"] == "run-snap-test-001"
    # (a) snapshot was actually awaited — no vacuous pass.
    assert mock_snapshot.await_count == 1, (
        "snapshot_config was never awaited — the ordering assertion would pass "
        "vacuously"
    )
    # (b) snapshot precedes create_task in the recorded call order.
    assert "snapshot" in call_order and "create_task" in call_order, call_order
    assert call_order.index("snapshot") < call_order.index("create_task"), (
        f"snapshot_config must be awaited BEFORE asyncio.create_task; "
        f"observed order: {call_order}"
    )


@pytest.mark.asyncio
async def test_resume_no_resnap(monkeypatch) -> None:
    """CFG-04 (Pitfall 6): resume_run NEVER calls snapshot_config — original snapshot stays."""
    if __import__("os").environ.get("PIPELINE_TRIGGER_SECRET"):
        pytest.skip(
            "PIPELINE_TRIGGER_SECRET set — fake-request path skips the secret "
            "check only when unset (local dev)"
        )

    snap_spy = AsyncMock()
    # Patch the api.runs binding (same as Task 1's import target).
    monkeypatch.setattr(runs, "snapshot_config", snap_spy, raising=True)

    req = _fake_request()

    # Mock a paused graph: aget_state returns a state with non-empty .next so
    # resume proceeds past the 409 guard; ainvoke is a no-op AsyncMock.
    paused_state = SimpleNamespace(next=("editor_gate_1",))
    graph = req.app.state.graph
    graph.aget_state = AsyncMock(return_value=paused_state)
    graph.ainvoke = AsyncMock(return_value={})

    body = runs.ResumeBody(selection=runs.ResumeSelection(charityName="The Quiet Foundation"))
    result = await runs.resume_run(req, "run-resume-test-001", body)

    assert result == {"runId": "run-resume-test-001", "resumed": True}
    # Give the spawned resume task a chance to run, then confirm no snapshot.
    import asyncio as _asyncio
    await _asyncio.sleep(0)
    snap_spy.assert_not_called()
