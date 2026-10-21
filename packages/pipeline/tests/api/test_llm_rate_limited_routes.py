"""Quick 261021-5pr — the rate-limit dependency is wired on all 7 LLM routes."""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from eisenbalm_pipeline.api import agents, brief, eval as eval_api, factcheck, revision, voice_pass
from eisenbalm_pipeline.api.control import _require_clerk_jwt_control
from eisenbalm_pipeline.lib import rate_limit as rl

ROUTES = [
    "/agents/scout/test-run",
    "/agents/scout/score",
    "/eval/shadow-run",
    "/issues/r1/brief/headline/strengthen/preview",
    "/issues/r1/revise/preview",
    "/issues/r1/voice-rewrite",
    "/issues/r1/claims/0/evidence/preview",
]


def _app() -> FastAPI:
    app = FastAPI()
    for m in (agents, eval_api, brief, revision, voice_pass, factcheck):
        app.include_router(m.router)
    app.dependency_overrides[agents._require_operator] = lambda: {"sub": "u1"}
    app.dependency_overrides[_require_clerk_jwt_control] = lambda: {"sub": "u1"}
    return app


@pytest.mark.parametrize("path", ROUTES)
def test_route_returns_429_when_limited(monkeypatch, path):
    monkeypatch.setattr(rl._LIMITER, "check", lambda *a, **k: 7)
    r = TestClient(_app()).post(path, json={})
    assert r.status_code == 429, (path, r.status_code, r.text)
    assert r.headers["Retry-After"] == "7"
    assert r.json()["detail"]["reason"] == "rate_limited"


def test_buckets_and_numbers(monkeypatch):
    calls = []

    def spy(bucket, key, *, per_minute, per_hour):
        calls.append((bucket, key, per_minute, per_hour))
        return 1

    monkeypatch.setattr(rl._LIMITER, "check", spy)
    c = TestClient(_app())
    c.post("/agents/scout/score", json={})
    c.post("/eval/shadow-run", json={})
    assert calls == [("llm", "u1", 10, 60), ("shadow-run", "u1", 2, 10)]
