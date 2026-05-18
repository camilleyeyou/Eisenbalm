"""Manual publish fallback tests. Plan 06-07 unskips."""
from __future__ import annotations

import pytest


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (WHK-08)")
async def test_manual_publish_invokes_publisher(client, monkeypatch):
    """WHK-08: POST /run/{runId}/publish invokes the same _run_publisher coroutine."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (WHK-08)")
async def test_manual_publish_requires_trigger_secret(client):
    """WHK-08: trigger-secret guard same as /run/weekly + /run/{id}/resume."""
