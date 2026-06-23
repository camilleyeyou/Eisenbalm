"""Phase 25 + Phase 26 — Scheduler tick and cadence cursor tests.

Phase 25 (RUN-03): _is_due + compute_next_run_at unit tests.
Phase 26 (D-02): test_tick_fires_due_scheduled_runs — the hourly tick fires
  scheduled publishes via runs:dueForPublish + _flip_sanity_published BEFORE
  the cadence gate, so they fire even when no new run is due.


RED state: ``eisenbalm_pipeline.lib.scheduler`` does not exist yet. The top-level
import ensures collection FAILS RED until Plan 02 lands the scheduler module.

  test_is_due_fires_when_due (RUN-03)
    _is_due returns True when now >= schedule_next_run_at (cursor in the past).

  test_is_due_skips_not_due (RUN-03)
    _is_due returns False when now < schedule_next_run_at (cursor in the future).

  test_next_run_cursor_advances (RUN-03, Pitfall 6)
    After a tick fires, compute_next_run_at returns a datetime strictly after
    'now' (prevents double-fire on the same cadence slot).
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from eisenbalm_pipeline.lib.scheduler import _is_due, compute_next_run_at

pytestmark = pytest.mark.anyio


def test_is_due_fires_when_due() -> None:
    """RUN-03: _is_due returns True when now >= schedule_next_run_at."""
    now = datetime(2026, 6, 26, 14, 0, 0, tzinfo=timezone.utc)   # Thu 14:00 UTC

    # Cursor in the past → due
    pc = {
        "schedule_enabled": True,
        "schedule_next_run_at": 1750000000000,  # some past UTC ms
        "schedule_cadence": {"dayOfWeek": 4, "hourUtc": 14, "minuteUtc": 0},
    }
    # schedule_next_run_at = 1750000000000 ms = ~2025-06-15 (before now)
    result = _is_due(pc, now=now)
    assert result is True, (
        f"_is_due should return True when now >= schedule_next_run_at, got {result!r}"
    )


def test_is_due_skips_not_due() -> None:
    """RUN-03: _is_due returns False when now < schedule_next_run_at."""
    now = datetime(2026, 6, 26, 13, 59, 0, tzinfo=timezone.utc)  # 1 min before

    # Cursor one minute in the future → not due
    next_run_ms = int(now.timestamp() * 1000) + 60_000  # +1 minute
    pc = {
        "schedule_enabled": True,
        "schedule_next_run_at": next_run_ms,
        "schedule_cadence": {"dayOfWeek": 4, "hourUtc": 14, "minuteUtc": 0},
    }
    result = _is_due(pc, now=now)
    assert result is False, (
        f"_is_due should return False when now < schedule_next_run_at, got {result!r}"
    )


def test_next_run_cursor_advances() -> None:
    """RUN-03, Pitfall 6: after a run fires, compute_next_run_at returns a
    datetime strictly AFTER 'now' so the hourly tick doesn't double-fire.

    The cursor must advance to the next occurrence of the cadence strictly
    after the current time.
    """
    now = datetime(2026, 6, 26, 14, 0, 0, tzinfo=timezone.utc)  # Thu 14:00 UTC (fire time)
    cadence = {"dayOfWeek": 4, "hourUtc": 14, "minuteUtc": 0}

    next_run = compute_next_run_at(cadence, now=now)

    assert isinstance(next_run, datetime), (
        f"compute_next_run_at should return a datetime, got {type(next_run)!r}"
    )
    assert next_run.tzinfo is not None, "compute_next_run_at must return a timezone-aware datetime"
    assert next_run > now, (
        f"compute_next_run_at must return a time strictly after 'now' to prevent "
        f"double-fire (Pitfall 6): now={now.isoformat()!r}, next={next_run.isoformat()!r}"
    )
    # The next run should be exactly one week later for a weekly Thursday cadence
    from datetime import timedelta
    expected_next = now + timedelta(weeks=1)
    assert next_run <= expected_next + timedelta(hours=1), (
        f"Next run should be within the next cadence period (~1 week for Thu weekly): "
        f"got {next_run.isoformat()!r}"
    )


# ── Phase 26 D-02: scheduled-publish sweep ────────────────────────────────


async def test_tick_fires_due_scheduled_runs(monkeypatch) -> None:
    """Phase 26 D-02: pipeline_tick fires _flip_sanity_published for each
    awaiting-review run whose scheduledPublishAt is now due.

    The sweep MUST run BEFORE the cadence gate so it fires even when no new
    run is due (e.g. _is_due returns False).

    Test setup:
      - schedule_enabled = True
      - _is_due = False (cadence cursor in the future — tick would normally skip)
      - runs:dueForPublish returns one due run
      - pipelineRuns:byRunId returns a run with sanityIssueId="issue-77"
      - _flip_sanity_published is mocked and asserted to have been called

    Expected: tick returns {"status":"skipped","reason":"not_due"} BUT also
    {"scheduledPublished": ["run-due-01"]} in the response, and
    _flip_sanity_published was awaited with "issue-77".
    """
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from eisenbalm_pipeline.api.control import router as control_router

    flip_calls: list[str] = []

    async def mock_flip(http, sanity_issue_id: str) -> None:
        flip_calls.append(sanity_issue_id)

    # Config values returned from pipelineConfig:getAll
    config_data = [
        {"key": "schedule_enabled", "value": json.dumps(True)},
        # Cursor 1 hour in the future → cadence gate will skip new-run triggering
        {"key": "schedule_next_run_at", "value": json.dumps(
            int(datetime.now(timezone.utc).timestamp() * 1000) + 3_600_000
        )},
    ]

    async def mock_convex_query(http, path: str, args: dict):
        if path == "pipelineConfig:getAll":
            return config_data
        if path == "runs:dueForPublish":
            return [{"runId": "run-due-01"}]
        if path == "pipelineRuns:byRunId":
            return {"runId": "run-due-01", "status": "awaiting-review", "sanityIssueId": "issue-77"}
        if path == "runs:latest":
            return None
        return None

    mutation_calls: list[tuple] = []

    async def mock_convex_mutation(http, path: str, args: dict):
        mutation_calls.append((path, args))
        return None

    # Build test app
    app = FastAPI()
    app.include_router(control_router)
    app.state.convex_http = MagicMock()
    app.state.sanity_http = MagicMock()
    app.state.graph = None
    app.state.background_tasks = set()

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.control._cc.convex_query",
        mock_convex_query,
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.control._cc.convex_mutation",
        mock_convex_mutation,
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.control._flip_sanity_published",
        mock_flip,
    )
    # Ensure trigger secret works
    trigger_secret = "test-schedule-secret"
    monkeypatch.setenv("PIPELINE_TRIGGER_SECRET", trigger_secret)

    client = TestClient(app, raise_server_exceptions=True)
    response = client.post(
        "/pipeline/tick",
        headers={"X-Pipeline-Trigger-Secret": trigger_secret},
    )

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    body = response.json()

    # Cadence gate should have skipped new-run triggering (cursor in future).
    assert body.get("status") == "skipped", (
        f"Expected status='skipped' (cadence gate), got {body!r}"
    )
    assert body.get("reason") == "not_due", (
        f"Expected reason='not_due', got {body.get('reason')!r}"
    )

    # But the scheduled-publish sweep MUST have fired before the gate.
    assert "run-due-01" in body.get("scheduledPublished", []), (
        f"Expected 'run-due-01' in scheduledPublished: {body.get('scheduledPublished')!r}"
    )
    assert flip_calls == ["issue-77"], (
        f"Expected _flip_sanity_published called with 'issue-77', got {flip_calls!r}"
    )

    # runs:setScheduledPublish was called to clear the scheduledPublishAt.
    clear_calls = [
        args for path, args in mutation_calls
        if path == "runs:setScheduledPublish"
    ]
    assert clear_calls, "Expected runs:setScheduledPublish to be called to clear scheduledPublishAt"
    assert clear_calls[0]["runId"] == "run-due-01"
