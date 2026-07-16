"""Phase 45 (Plan 45-02) — REV-05 per-issue cost-guard predicate
(`would_exceed_run_cap`).

Mirrors `would_exceed_monthly_cap`'s existing shape (docs/API_CONTRACTS.md
§45.5) and `test_budget_gate.py`'s conventions.

Select via: -k run_cap
"""
from __future__ import annotations

import pytest

import eisenbalm_pipeline.lib.budget as budget_mod

pytestmark = [pytest.mark.anyio]


class _FakeHttp:
    """Placeholder http handle — the real Convex httpx client wiring lands
    with Plan 45-02; monkeypatched `_cc.convex_query` never dereferences it."""


async def test_would_exceed_run_cap_sums_agent_runs(monkeypatch):
    """§45.5: spend is the SUM of durable `agentRuns:byRunId` rows' costUsd —
    never `lib.cost`'s in-memory `_store` (45-RESEARCH Pitfall 1)."""
    async def mock_convex_query(http, path, args):
        assert path == "agentRuns:byRunId"
        assert args == {"runId": "run-abc"}
        return [{"costUsd": 1.5}, {"costUsd": 2.5}]

    monkeypatch.setattr("eisenbalm_pipeline.lib.budget._cc.convex_query", mock_convex_query)

    over, info = await budget_mod.would_exceed_run_cap(
        _FakeHttp(),
        run_id="run-abc",
        per_run_cap_usd=10.0,
        prior_revision_costs=[],
    )
    assert info["spentUsd"] == 4.0
    assert over is False


async def test_would_exceed_run_cap_over_cap_true(monkeypatch):
    """When spend + the projected next revision call would exceed the cap,
    returns (True, info) — mirrors `would_exceed_monthly_cap`'s over-cap shape."""
    async def mock_convex_query(http, path, args):
        return [{"costUsd": 9.8}]

    monkeypatch.setattr("eisenbalm_pipeline.lib.budget._cc.convex_query", mock_convex_query)

    over, info = await budget_mod.would_exceed_run_cap(
        _FakeHttp(),
        run_id="run-abc",
        per_run_cap_usd=10.0,
        prior_revision_costs=[0.5],
    )
    assert over is True
    assert info["capUsd"] == 10.0


async def test_would_exceed_run_cap_disabled_when_cap_le_zero(monkeypatch):
    """`per_run_cap_usd <= 0` disables the guard entirely (mirrors
    `would_exceed_monthly_cap`'s `cap_disabled` edge, D-12)."""
    over, info = await budget_mod.would_exceed_run_cap(
        _FakeHttp(),
        run_id="run-abc",
        per_run_cap_usd=0.0,
        prior_revision_costs=[],
    )
    assert over is False
    assert info.get("reason") == "cap_disabled"
