"""CORS tests for the composed pipeline app (DASHBOARD_ALLOWED_ORIGINS).

Unlike tests/api/test_score.py (which mounts a *bare* single-router app), CORS
middleware is only present on the REAL composed app, so these tests import
``eisenbalm_pipeline.api.main.app`` directly and drive it with the sync
``fastapi.testclient.TestClient`` so a browser preflight (OPTIONS) flows through
the middleware.

The suite already runs under EISENBALM_STUB_MODE, and CORS works regardless of
lifespan state — so the degraded boot (graph=None, no Postgres) is fine. Using
``with TestClient(app) as client:`` runs lifespan; the degraded path is expected.
A real mounted POST route (/agents/scout/score) is used so the preflight has a
genuine target.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from eisenbalm_pipeline.api.main import app


def test_preflight_from_allowed_origin_is_echoed():
    """OPTIONS preflight from http://localhost:3000 → access-control-allow-origin
    header equal to that origin."""
    with TestClient(app) as client:
        resp = client.options(
            "/agents/scout/score",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )
    # TestClient normalizes header names to lowercase.
    assert (
        resp.headers.get("access-control-allow-origin") == "http://localhost:3000"
    ), resp.headers


def test_preflight_from_non_listed_origin_is_not_echoed():
    """OPTIONS preflight from a non-listed origin → that origin is NOT echoed back
    in access-control-allow-origin (Starlette omits the header entirely)."""
    with TestClient(app) as client:
        resp = client.options(
            "/agents/scout/score",
            headers={
                "Origin": "https://evil.example.com",
                "Access-Control-Request-Method": "POST",
            },
        )
    assert (
        resp.headers.get("access-control-allow-origin")
        != "https://evil.example.com"
    ), resp.headers
