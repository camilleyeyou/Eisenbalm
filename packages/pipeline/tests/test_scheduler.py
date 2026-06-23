"""Phase 25 Wave 0 — RED tests for scheduler tick and cadence cursor (RUN-03).

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

from datetime import datetime, timezone

import pytest

from eisenbalm_pipeline.lib.scheduler import _is_due, compute_next_run_at  # RED until Plan 02

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
