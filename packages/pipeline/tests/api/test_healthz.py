"""Quick 261021-5pr — deploy-aware /healthz and degraded-boot singleton reset."""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from eisenbalm_pipeline.api.health import router


def _client(checkpointer) -> TestClient:
    app = FastAPI()
    app.include_router(router)
    app.state.checkpointer = checkpointer
    return TestClient(app)


def test_connected_is_200(monkeypatch):
    monkeypatch.setenv("RAILWAY_ENVIRONMENT_NAME", "production")
    r = _client(object()).get("/healthz")
    assert r.status_code == 200
    assert r.json()["ok"] is True and r.json()["checkpointer"] == "connected"
    assert "stubMode" in r.json()


def test_degraded_local_is_200(monkeypatch):
    monkeypatch.delenv("RAILWAY_ENVIRONMENT_NAME", raising=False)
    r = _client(None).get("/healthz")
    assert r.status_code == 200
    assert r.json()["ok"] is False and r.json()["checkpointer"] == "missing"


def test_degraded_deployed_is_503_same_body(monkeypatch):
    monkeypatch.setenv("RAILWAY_ENVIRONMENT_NAME", "production")
    r = _client(None).get("/healthz")
    assert r.status_code == 503
    body = r.json()
    assert body["ok"] is False and body["checkpointer"] == "missing"
    assert "stubMode" in body


async def test_degraded_lifespan_clears_client_singletons(monkeypatch):
    from eisenbalm_pipeline.api import main
    from eisenbalm_pipeline.lib import convex_client, sanity_client

    monkeypatch.delenv("RAILWAY_ENVIRONMENT_NAME", raising=False)
    monkeypatch.delenv("SUPABASE_POSTGRES_URL", raising=False)
    convex_client.set_client(MagicMock())
    sanity_client.set_client(MagicMock())
    app = FastAPI()
    async with main.lifespan(app):
        assert app.state.graph is None
        assert convex_client._CLIENT is None
        assert sanity_client._CLIENT is None
