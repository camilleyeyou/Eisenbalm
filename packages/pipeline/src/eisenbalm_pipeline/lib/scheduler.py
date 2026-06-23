"""Phase 25 (RUN-03) — Cadence engine for the scheduler tick.

Two public functions:

  _is_due(pc, now) → bool
    Returns True when the current time has reached or passed the stored
    schedule_next_run_at cursor. Treats a cursor value of 0 (or absent) as
    "due immediately" — this covers the very-first run after schedule_enabled
    is turned on and schedule_next_run_at has never been set.

  compute_next_run_at(cadence, now) → datetime
    Given a cadence specification and the current time, returns the next
    occurrence of {dayOfWeek, hourUtc, minuteUtc} strictly AFTER `now`.
    "Strictly after" is essential (Pitfall 6) — an hourly tick calling this
    immediately after firing must advance to the NEXT cadence slot, not return
    the slot that just fired.

dayOfWeek convention
--------------------
  cron / Railway convention: 0 = Sunday, 1 = Monday, …, 4 = Thursday, 6 = Sat.
  Python datetime.weekday(): 0 = Monday, …, 3 = Thursday, 6 = Sunday.

  This module uses the CRON convention (0 = Sun … 6 = Sat) to match Railway's
  schedule `0 14 * * 4` (Thursday) and the pipeline_config default
  `{dayOfWeek: 4, hourUtc: 14, minuteUtc: 0}`.

  Internal conversion:
      python_weekday = (cron_day - 1) % 7    (maps Sun=0 → 6, Mon=1 → 0, …)
  Equivalently: cron 4 (Thu) → Python 3 (Thu) — consistent.

  +-----------+-----------+------------+
  | Cron day  | Day name  | Python wkd |
  +-----------+-----------+------------+
  |    0      | Sunday    |     6      |
  |    1      | Monday    |     0      |
  |    2      | Tuesday   |     1      |
  |    3      | Wednesday |     2      |
  |    4      | Thursday  |     3      |
  |    5      | Friday    |     4      |
  |    6      | Saturday  |     5      |
  +-----------+-----------+------------+
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Union


def _is_due(pc: dict, now: Union[datetime, int]) -> bool:
    """Return True when the current time has reached or passed the cursor.

    Args:
        pc:  Pipeline config dict. Reads ``pc["schedule_next_run_at"]`` (Unix
             milliseconds, int). A value of 0 or a missing key means "never
             been scheduled — treat as due immediately so the first tick fires."
        now: The current time. Accepts either a timezone-aware ``datetime``
             (converted internally to Unix ms) or an int Unix-ms value.

    Returns:
        True if now >= schedule_next_run_at (including the 0 / never-set case).
        False if the cursor is in the future.

    Rule:
        schedule_next_run_at == 0  →  due now (first-ever tick; pipeline has
                                       never set a cursor).
        schedule_next_run_at >  0  →  due when now_ms >= schedule_next_run_at.
    """
    next_run_ms: int = pc.get("schedule_next_run_at", 0) or 0

    if isinstance(now, datetime):
        now_ms = int(now.timestamp() * 1000)
    else:
        now_ms = int(now)

    # 0 means "never scheduled" → due immediately.
    if next_run_ms == 0:
        return True

    return now_ms >= next_run_ms


def compute_next_run_at(cadence: dict, now: Union[datetime, int]) -> datetime:
    """Compute the next cadence occurrence strictly after ``now``.

    Args:
        cadence: Dict with ``dayOfWeek`` (cron 0=Sun … 6=Sat), ``hourUtc``
                 (0-23), and ``minuteUtc`` (0-59). Example Thursday 14:00 UTC::

                     {"dayOfWeek": 4, "hourUtc": 14, "minuteUtc": 0}

        now: The reference time. Accepts a timezone-aware ``datetime`` or an
             int Unix-ms value (converted to UTC datetime internally).

    Returns:
        A timezone-aware ``datetime`` (UTC) representing the next occurrence of
        the cadence slot strictly after ``now``.

    Pitfall 6 protection:
        The function adds ``timedelta(minutes=1)`` to ``now`` before searching
        so that calling compute_next_run_at at *exactly* the cadence slot
        (which happens immediately after a tick fires) advances to the NEXT
        week's slot, preventing double-fire on the same cron tick.
    """
    if isinstance(now, datetime):
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        now_aware = now.astimezone(timezone.utc)
    else:
        now_aware = datetime.fromtimestamp(int(now) / 1000, tz=timezone.utc)

    cron_day = int(cadence.get("dayOfWeek", 4))    # 0=Sun … 6=Sat
    hour_utc = int(cadence.get("hourUtc", 14))
    minute_utc = int(cadence.get("minuteUtc", 0))

    # Convert cron day → Python weekday: (cron_day - 1) % 7
    #   cron 0 (Sun) → Python 6, cron 1 (Mon) → Python 0, cron 4 (Thu) → Python 3
    target_python_weekday = (cron_day - 1) % 7

    # Start searching from 1 minute after now (Pitfall 6: strictly-after guarantee).
    candidate = now_aware + timedelta(minutes=1)
    # Truncate to the minute (strip seconds/microseconds).
    candidate = candidate.replace(second=0, microsecond=0)

    # Walk forward one day at a time until we find the matching weekday+hour+minute.
    # Maximum loop: 7 days * 24 hours * 60 minutes / 1-day-step = 7 iterations.
    # We step by minutes to be precise when candidate is on the right day but
    # the target time is later the same day, but we first jump to the right day.
    for _ in range(7 * 24 * 60 + 1):  # never infinite — exits within one week
        # Advance to target hour:minute on this day.
        slot = candidate.replace(hour=hour_utc, minute=minute_utc, second=0, microsecond=0)
        if slot.weekday() == target_python_weekday and slot > now_aware:
            return slot
        # Advance to tomorrow and re-check.
        candidate = (candidate + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

    # Should never reach here; but return a safe 7-days-ahead fallback.
    return now_aware + timedelta(weeks=1)
