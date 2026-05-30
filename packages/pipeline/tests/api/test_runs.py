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


# ── Phase 16 trigger-path: RunWeeklyBody.narratorSlug ──────────────────────


def test_run_weekly_body_accepts_narrator_slug():
    """Phase 16: RunWeeklyBody MUST accept an optional narratorSlug field so
    callers can override calibrator narrator-resolution step 2 (graph/state.py
    L199 + calibrator.py L200 resolution chain). Without this field the
    chronicler + QA narrator-aware code path is unreachable from the API."""
    from eisenbalm_pipeline.api.runs import RunWeeklyBody

    body = RunWeeklyBody(issueNumber=42, narratorSlug="maya-rudolph")
    assert body.narratorSlug == "maya-rudolph"


def test_run_weekly_body_narrator_slug_defaults_none():
    """When omitted, narratorSlug MUST default to None — the calibrator
    resolution chain then falls through to charity.narratorSlug then Jesse
    default. Preserves NRR-10 byte-equivalent legacy behavior."""
    from eisenbalm_pipeline.api.runs import RunWeeklyBody

    body = RunWeeklyBody()
    assert body.narratorSlug is None


async def test_run_weekly_injects_narrator_slug_into_initial_state(
    client, monkeypatch
):
    """Phase 16 NRR trigger-path: when the request body includes narratorSlug,
    it MUST land in initial_state["narrator_slug"] so the calibrator picks it
    up via state.get("narrator_slug") (calibrator.py L200). Patches
    _execute_run to capture the initial_state dict without running the graph."""
    captured: dict = {}

    async def fake_execute_run(app, run_id, initial_state, config):
        captured["initial_state"] = initial_state
        captured["run_id"] = run_id

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.runs._execute_run", fake_execute_run
    )

    r = await client.post(
        "/run/weekly",
        json={"issueNumber": 1234567, "narratorSlug": "maya-rudolph"},
    )
    assert r.status_code == 200, r.text

    # Background task may not have run yet — yield to the event loop briefly.
    import asyncio as _asyncio
    for _ in range(50):
        if "initial_state" in captured:
            break
        await _asyncio.sleep(0.01)

    assert "initial_state" in captured, "_execute_run was never invoked"
    assert (
        captured["initial_state"].get("narrator_slug") == "maya-rudolph"
    ), f"narrator_slug missing from initial_state: {captured['initial_state']}"


async def test_run_weekly_omits_narrator_slug_when_not_provided(
    client, monkeypatch
):
    """When narratorSlug is omitted from the body, the key MUST be absent from
    initial_state entirely (not present-but-None). Keeps the legacy-path state
    diff byte-minimal and preserves NRR-10 byte-equivalent behavior in the
    checkpointer for Jesse-default runs."""
    captured: dict = {}

    async def fake_execute_run(app, run_id, initial_state, config):
        captured["initial_state"] = initial_state

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.runs._execute_run", fake_execute_run
    )

    r = await client.post("/run/weekly", json={"issueNumber": 1234568})
    assert r.status_code == 200, r.text

    import asyncio as _asyncio
    for _ in range(50):
        if "initial_state" in captured:
            break
        await _asyncio.sleep(0.01)

    assert "initial_state" in captured, "_execute_run was never invoked"
    assert (
        "narrator_slug" not in captured["initial_state"]
    ), f"narrator_slug should be absent, got: {captured['initial_state']}"
