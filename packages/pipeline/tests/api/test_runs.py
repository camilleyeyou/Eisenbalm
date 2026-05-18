"""Manual publish fallback tests (Plan 06-07 fills bodies)."""
from __future__ import annotations

import os
from unittest.mock import AsyncMock

import pytest


async def test_manual_publish_invokes_publisher(client, monkeypatch):
    """WHK-08: POST /run/{runId}/publish invokes the same _run_publisher coroutine."""
    fake_groq = AsyncMock(
        return_value=[{"_id": "issue-99", "issueNumber": 99}]
    )
    # Patch at the canonical home (lib.sanity_client.groq_query); the
    # manual_publish handler imports it locally each call.
    monkeypatch.setattr(
        "eisenbalm_pipeline.lib.sanity_client.groq_query", fake_groq
    )

    pub_spy = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher._run_publisher", pub_spy
    )

    r = await client.post("/run/run-abc-123/publish")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["runId"] == "run-abc-123"
    assert body["issueId"] == "issue-99"
    assert body["issueNumber"] == 99
    assert body["scheduled"] is True
    # groq_query was used to look up the issue by runId
    fake_groq.assert_awaited()
    call_kwargs = fake_groq.await_args.kwargs
    assert call_kwargs["params"] == {"runId": "run-abc-123"}


async def test_manual_publish_requires_trigger_secret(client):
    """WHK-08: trigger-secret guard same as /run/weekly + /run/{id}/resume."""
    # The `client` fixture sets the trigger-secret header automatically (conftest).
    # Test by sending a request WITHOUT the header — expect 401.
    if not os.environ.get("PIPELINE_TRIGGER_SECRET"):
        pytest.skip("PIPELINE_TRIGGER_SECRET unset — guard is no-op in dev")
    # Override the fixture's default header by sending empty headers explicitly.
    r = await client.post(
        "/run/some-id/publish",
        headers={"X-Pipeline-Trigger-Secret": ""},
    )
    assert r.status_code == 401, r.text
