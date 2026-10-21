"""Quick 261021-ind: the single hold helper and its publish-manual /
manual_publish callers."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from eisenbalm_pipeline.lib import issue_hold


def _patch_query(monkeypatch, result=None, exc=None):
    calls = []

    async def q(http, path, args):
        calls.append((path, args))
        if exc:
            raise exc
        return result

    monkeypatch.setattr("eisenbalm_pipeline.lib.convex_client.convex_query", q)
    return calls


@pytest.mark.anyio
@pytest.mark.parametrize(
    "row,expected",
    [({"held": True}, True), ({"held": False}, False), (None, False), ({}, False), ("x", False)],
)
async def test_is_issue_held(monkeypatch, row, expected):
    calls = _patch_query(monkeypatch, row)
    assert await issue_hold.is_issue_held(None, 5) is expected
    assert calls[0][0] == "issues:byIssueNumber"
    assert calls[0][1] == {"workspace_id": "eisenbalm", "issueNumber": 5}


@pytest.mark.anyio
async def test_is_issue_held_none_number_skips_query(monkeypatch):
    calls = _patch_query(monkeypatch, {"held": True})
    assert await issue_hold.is_issue_held(None, None) is False
    assert calls == []


@pytest.mark.anyio
async def test_is_issue_held_propagates_errors(monkeypatch):
    _patch_query(monkeypatch, exc=RuntimeError("boom"))
    with pytest.raises(RuntimeError):
        await issue_hold.is_issue_held(None, 5)


@pytest.mark.anyio
async def test_assert_not_held_409(monkeypatch):
    _patch_query(monkeypatch, {"held": True})
    with pytest.raises(HTTPException) as ei:
        await issue_hold.assert_not_held(None, 5)
    assert ei.value.status_code == 409
    assert ei.value.detail["reason"] == "held"
    assert ei.value.detail["message"] == "This issue is on hold. Release the hold to publish."


@pytest.mark.anyio
async def test_assert_not_held_503_on_error(monkeypatch):
    _patch_query(monkeypatch, exc=RuntimeError("boom"))
    with pytest.raises(HTTPException) as ei:
        await issue_hold.assert_not_held(None, 5)
    assert ei.value.status_code == 503
    assert ei.value.detail["reason"] == "hold_unknown"


@pytest.mark.anyio
async def test_assert_not_held_ok(monkeypatch):
    _patch_query(monkeypatch, {"held": False})
    assert await issue_hold.assert_not_held(None, 5) is None


# ── POST /run/{run_id}/publish (runs.manual_publish) ──────────────────────


def _runs_client(monkeypatch, held: bool):
    from eisenbalm_pipeline.api import runs as runs_mod

    app = FastAPI()
    app.include_router(runs_mod.router)
    app.state.convex_http = MagicMock()
    app.state.background_tasks = set()
    monkeypatch.setattr(runs_mod, "_require_trigger_secret", lambda request: None)

    async def groq(query, params=None):
        return [{"_id": "issue-1", "issueNumber": 9}]

    monkeypatch.setattr("eisenbalm_pipeline.lib.sanity_client.groq_query", groq)
    publisher = AsyncMock()
    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher._run_publisher", publisher)
    spawned = []
    monkeypatch.setattr(runs_mod, "spawn_background", lambda app, coro, name=None: (coro.close() if hasattr(coro, "close") else None, spawned.append(name)))
    _patch_query(monkeypatch, {"held": held})
    return TestClient(app), spawned


def test_manual_publish_refused_when_held(monkeypatch):
    client, spawned = _runs_client(monkeypatch, True)
    r = client.post("/run/run-1/publish")
    assert r.status_code == 409, r.text
    assert r.json()["detail"]["reason"] == "held"
    assert spawned == []


def test_manual_publish_proceeds_when_not_held(monkeypatch):
    client, spawned = _runs_client(monkeypatch, False)
    r = client.post("/run/run-1/publish")
    assert r.status_code == 200, r.text
    assert spawned == ["publisher:issue-1"]
