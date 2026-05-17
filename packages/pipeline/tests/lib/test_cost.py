"""Phase 5 CostRecorder.check_cap tests — Plan 05-14.

Validation: D-08 soft warn @ 70% + hard halt @ 100%, AGT-17 cost obs surface.

The warn event is fired via ``asyncio.create_task`` inside ``check_cap()`` so
the tests yield to the loop a few times before asserting on the patched
``convex_mutation_safe`` mock. Because ``convex_mutation_safe`` is imported
*inline* (inside ``check_cap``) to break a circular dependency, the patch
target is the canonical module path ``eisenbalm_pipeline.lib.convex_client``,
NOT ``eisenbalm_pipeline.lib.cost``.

The module-level ``_warned_runs`` set is cleared by an autouse fixture so
each test starts with a clean warn-once flag.
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.lib import cost as cost_mod
from eisenbalm_pipeline.lib.cost import CostRecorder, begin_run, end_run
from eisenbalm_pipeline.lib.errors import CostCapExceeded


@pytest.fixture(autouse=True)
def _reset_cost_state() -> None:
    """Wipe module-level cost state between tests.

    ``_warned_runs`` is the warn-once dedup set (D-08); ``_store`` holds
    per-run agent cost contributions; ``_start_times`` holds wall-clock
    starts. Each test runs against a fresh run_id, but resetting is
    belt-and-suspenders since multiple tests share the module.
    """
    cost_mod._warned_runs.clear()
    cost_mod._store.clear()
    cost_mod._start_times.clear()
    yield
    cost_mod._warned_runs.clear()
    cost_mod._store.clear()
    cost_mod._start_times.clear()


async def _drain_loop() -> None:
    """Yield to the loop enough times for ``asyncio.create_task`` to run."""
    for _ in range(3):
        await asyncio.sleep(0)


def _warn_calls(mock: AsyncMock) -> list:
    """Return the subset of mock calls that are cost-warning emits."""
    return [
        c for c in mock.call_args_list
        if c.args
        and c.args[0] == "deliberationEvents:insert"
        and isinstance(c.args[1], dict)
        and c.args[1].get("eventType") == "cost-warning"
    ]


async def test_no_warn_below_threshold(monkeypatch) -> None:
    """D-08: at <70% of cap, no warning event emitted."""
    monkeypatch.setenv("PIPELINE_COST_CAP_USD", "10.0")
    monkeypatch.setenv("PIPELINE_COST_WARN_PCT", "0.7")
    recorder = CostRecorder("run-no-warn")
    begin_run("run-no-warn")
    # 50% of cap — below 70% threshold
    recorder.record("calibrator", tokens_in=0, tokens_out=0, usd=5.0)

    mock_convex = AsyncMock()
    with patch(
        "eisenbalm_pipeline.lib.convex_client.convex_mutation_safe", mock_convex,
    ):
        await recorder.check_cap()
        await _drain_loop()

    assert len(_warn_calls(mock_convex)) == 0


async def test_warn_at_70_percent(monkeypatch) -> None:
    """D-08: at 70% of cap, ONE cost-warning event emitted."""
    monkeypatch.setenv("PIPELINE_COST_CAP_USD", "10.0")
    monkeypatch.setenv("PIPELINE_COST_WARN_PCT", "0.7")
    recorder = CostRecorder("run-warn-70")
    begin_run("run-warn-70")
    recorder.record("calibrator", tokens_in=0, tokens_out=0, usd=7.0)

    mock_convex = AsyncMock()
    with patch(
        "eisenbalm_pipeline.lib.convex_client.convex_mutation_safe", mock_convex,
    ):
        await recorder.check_cap()
        await _drain_loop()

    warns = _warn_calls(mock_convex)
    assert len(warns) == 1, f"expected 1 warn, got {len(warns)}: {warns}"

    # Payload shape (D-08): contains totalUsd, percentOfCap, perAgent, capUsd.
    import json as _json
    payload = _json.loads(warns[0].args[1]["payload"])
    assert payload["totalUsd"] == pytest.approx(7.0)
    assert payload["percentOfCap"] == pytest.approx(0.7)
    assert payload["capUsd"] == pytest.approx(10.0)
    assert "calibrator" in payload["perAgent"]


async def test_warn_emits_only_once(monkeypatch) -> None:
    """D-08: warning fires once even on repeated check_cap() calls above threshold."""
    monkeypatch.setenv("PIPELINE_COST_CAP_USD", "10.0")
    monkeypatch.setenv("PIPELINE_COST_WARN_PCT", "0.7")
    recorder = CostRecorder("run-warn-once")
    begin_run("run-warn-once")
    recorder.record("calibrator", tokens_in=0, tokens_out=0, usd=8.0)

    mock_convex = AsyncMock()
    with patch(
        "eisenbalm_pipeline.lib.convex_client.convex_mutation_safe", mock_convex,
    ):
        await recorder.check_cap()
        await recorder.check_cap()
        await recorder.check_cap()
        await _drain_loop()

    warns = _warn_calls(mock_convex)
    assert len(warns) == 1, f"warn should fire exactly once; got {len(warns)}"


async def test_hard_cap_raises(monkeypatch) -> None:
    """D-08: at 100% of cap, CostCapExceeded raised."""
    monkeypatch.setenv("PIPELINE_COST_CAP_USD", "10.0")
    monkeypatch.setenv("PIPELINE_COST_WARN_PCT", "0.7")
    recorder = CostRecorder("run-hard-cap")
    begin_run("run-hard-cap")
    recorder.record("calibrator", tokens_in=0, tokens_out=0, usd=10.0)

    with patch(
        "eisenbalm_pipeline.lib.convex_client.convex_mutation_safe", AsyncMock(),
    ):
        with pytest.raises(CostCapExceeded) as exc_info:
            await recorder.check_cap()

    # 3-arg constructor (lib/errors.py) carries introspectable attributes.
    assert exc_info.value.total_usd == pytest.approx(10.0)
    assert exc_info.value.cap_usd == pytest.approx(10.0)


async def test_env_var_override(monkeypatch) -> None:
    """D-08: env vars PIPELINE_COST_CAP_USD + PIPELINE_COST_WARN_PCT honored."""
    monkeypatch.setenv("PIPELINE_COST_CAP_USD", "5.0")
    monkeypatch.setenv("PIPELINE_COST_WARN_PCT", "0.5")
    recorder = CostRecorder("run-env-override")
    begin_run("run-env-override")
    # 50% of $5 cap = $2.50 — should trigger warn under the override.
    recorder.record("calibrator", tokens_in=0, tokens_out=0, usd=2.5)

    mock_convex = AsyncMock()
    with patch(
        "eisenbalm_pipeline.lib.convex_client.convex_mutation_safe", mock_convex,
    ):
        await recorder.check_cap()
        await _drain_loop()

    warns = _warn_calls(mock_convex)
    assert len(warns) == 1, (
        f"env-var override (warn at 50% of $5) should fire one warn; "
        f"got {len(warns)}"
    )
    # Cleanup — end_run wipes _store/_start_times so next test starts clean.
    end_run("run-env-override")
