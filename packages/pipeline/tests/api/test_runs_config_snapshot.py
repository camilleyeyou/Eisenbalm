"""Phase 22 Wave 0 scaffold — CFG-04 snapshot-ordering test seam.

Source: .planning/phases/22-config-externalization/22-RESEARCH.md
        (Pitfall 1 snapshot race; Pitfall 6 resume no re-snap; Pattern 4
        run-start sequence) + 22-VALIDATION.md.

Two invariants this phase must lock:
  - `snapshot_config()` is awaited in the `run_weekly` HTTP handler BEFORE
    `asyncio.create_task()` — never inside `_execute_run()` (the race window).
  - `resume_run` does NOT re-snapshot — the original run-start snapshot stays
    authoritative.

The real handlers are `eisenbalm_pipeline.api.runs.run_weekly` / `resume_run`.
The `config_loader.snapshot_config` symbol does not exist until Plan 22-03, so
both tests are `xfail(strict=False)` until Plan 22-05 wires the ordering and
removes the marks. Imports are guarded inside the test bodies.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.mark.xfail(reason="Phase 22 Plan 05 wires snapshot-before-create_task", strict=False)
async def test_snapshot_before_task(monkeypatch) -> None:
    """CFG-04: snapshot_config() is awaited BEFORE asyncio.create_task() in run_weekly.

    Uses a shared ordered call recorder: patch config_loader.snapshot_config and
    asyncio.create_task to append a marker, then assert the snapshot marker's
    index precedes the create_task marker's index.
    """
    from eisenbalm_pipeline.api import runs  # guarded import
    from eisenbalm_pipeline.lib import config_loader  # guarded import (Plan 03)

    call_order: list[str] = []

    async def fake_snapshot(*args, **kwargs):
        call_order.append("snapshot")

    def fake_create_task(*args, **kwargs):
        call_order.append("create_task")
        return MagicMock()

    monkeypatch.setattr(config_loader, "snapshot_config", fake_snapshot)
    monkeypatch.setattr(runs, "snapshot_config", fake_snapshot, raising=False)
    monkeypatch.setattr(
        config_loader,
        "load_run_config",
        AsyncMock(return_value=MagicMock()),
        raising=False,
    )
    monkeypatch.setattr(runs.asyncio, "create_task", fake_create_task)
    monkeypatch.setattr(
        runs, "convex_mutation", AsyncMock(return_value={"status": "success"}), raising=False
    )

    # Plan 22-05 fills the actual run_weekly invocation (request/body construction).
    raise NotImplementedError("Plan 22-05 invokes run_weekly and asserts call_order")


@pytest.mark.xfail(reason="Phase 22 Plan 05 confirms resume does not re-snapshot", strict=False)
async def test_resume_no_resnap(monkeypatch) -> None:
    """CFG-04 (Pitfall 6): resume_run NEVER calls snapshot_config — original snapshot stays."""
    from eisenbalm_pipeline.api import runs  # guarded import
    from eisenbalm_pipeline.lib import config_loader  # guarded import (Plan 03)

    snap_spy = AsyncMock()
    monkeypatch.setattr(config_loader, "snapshot_config", snap_spy)
    monkeypatch.setattr(runs, "snapshot_config", snap_spy, raising=False)

    # Plan 22-05 fills the actual resume_run invocation, then:
    #   snap_spy.assert_not_called()
    raise NotImplementedError("Plan 22-05 invokes resume_run and asserts snapshot NOT called")
