"""Tests for GET /eval/scenarios (EVL-01, docs/API_CONTRACTS.md §38.1).

Mirrors tests/api/test_score.py's bare-FastAPI-app harness: a lifespan-free
app with only the eval router mounted. In dev mode (no CLERK_JWT_ISSUER_DOMAIN)
``_require_operator`` returns the sentinel {"sub": "local-dev-operator"}
without a network call, so no auth header is needed for these tests.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from eisenbalm_pipeline.api import eval as eval_module


def _build_app() -> FastAPI:
    """Mount only the eval router on a bare lifespan-free app."""
    app = FastAPI()
    app.include_router(eval_module.router)
    return app


async def test_get_eval_scenarios_returns_all_eight():
    """GET /eval/scenarios -> 200 with {"scenarios": [...]} containing all 8."""
    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.get("/eval/scenarios")
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert "scenarios" in body
    assert len(body["scenarios"]) == 8
    for s in body["scenarios"]:
        for key in (
            "id",
            "agentKey",
            "description",
            "whatItCatches",
            "input",
            "scoringTarget",
        ):
            assert key in s, f"scenario missing key {key!r}: {s}"


async def test_get_eval_scenarios_filters_by_agent_key():
    """GET /eval/scenarios?agentKey=scout -> only scout-keyed scenarios."""
    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.get("/eval/scenarios", params={"agentKey": "scout"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["scenarios"]) > 0
    assert all(s["agentKey"] == "scout" for s in body["scenarios"])
    assert len(body["scenarios"]) < 8


def test_eval_router_is_included_in_the_composed_app(monkeypatch):
    """The real composed app (api/main.py) routes /eval/scenarios — not 404."""
    monkeypatch.setenv("EISENBALM_STUB_MODE", "true")
    from eisenbalm_pipeline.api.main import app as composed_app

    with TestClient(composed_app) as client:
        r = client.get("/eval/scenarios")
    assert r.status_code != 404, "eval router is not registered on the composed app"
    assert r.status_code == 200, r.text
