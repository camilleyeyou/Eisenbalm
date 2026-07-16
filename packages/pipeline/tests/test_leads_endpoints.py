"""Phase 47 (Plan 47-04, BRF-02, docs/API_CONTRACTS.md §47.5) — Story lead
Require/Remove action endpoint matrix.

  POST /issues/{run_id}/leads/{lead_id}/require   body {}
  POST /issues/{run_id}/leads/{lead_id}/remove     body {reason}

Harness mirrors test_factcheck_endpoints.py: Convex query/mutation
monkeypatched — no network.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from eisenbalm_pipeline.api.leads import router as leads_router

pytestmark = pytest.mark.anyio

_app = FastAPI()
_app.include_router(leads_router)
_app.state.convex_http = MagicMock()
_app.state.sanity_http = MagicMock()
_app.state.graph = None
_app.state.background_tasks = set()

_client = TestClient(_app, raise_server_exceptions=True)

_L = "eisenbalm_pipeline.api.leads"


# ── Fixtures ─────────────────────────────────────────────────────────────


def _lead(**overrides) -> dict:
    base = {
        "_id": "lead-1",
        "runId": "run-abc",
        "premise": "A regional grant program is quietly running dry.",
        "status": "active",
    }
    base.update(overrides)
    return base


def _wire(monkeypatch, *, leads: list[dict] | None = None):
    """Standard wiring: mocks convex query/mutation. Returns
    (query_calls, mutation_calls) recorder lists."""
    query_calls: list[tuple[str, dict]] = []
    mutation_calls: list[tuple[str, dict]] = []

    async def mock_convex_query(http, path, args):
        query_calls.append((path, args))
        if path == "storyLeads:byRunId":
            return leads if leads is not None else [_lead()]
        return None

    async def mock_convex_mutation(http, path, args):
        mutation_calls.append((path, args))
        return None

    monkeypatch.setattr(f"{_L}._cc.convex_query", mock_convex_query)
    monkeypatch.setattr(f"{_L}._cc.convex_mutation", mock_convex_mutation)
    return query_calls, mutation_calls


def _reason(response) -> str | None:
    detail = response.json().get("detail")
    return detail.get("reason") if isinstance(detail, dict) else None


# ── Require ──────────────────────────────────────────────────────────────


def test_require_flips_status_no_reason_audit(monkeypatch):
    _q, mutation_calls = _wire(monkeypatch)

    response = _client.post("/issues/run-abc/leads/lead-1/require")
    assert response.status_code == 200, response.text
    assert response.json() == {"leadId": "lead-1", "status": "required"}

    sets = [args for path, args in mutation_calls if path == "storyLeads:setStatus"]
    assert len(sets) == 1
    assert sets[0]["leadId"] == "lead-1"
    assert sets[0]["status"] == "required"

    audits = [args for path, args in mutation_calls if path == "auditLog:record"]
    assert len(audits) == 1
    assert audits[0]["action"] == "lead_required"
    # No reason kwarg AND no "reason" key in the after-JSON — Require stays
    # OUT of the shared Decision log (auditLog.ts::isDecisionRow).
    assert "reason" not in audits[0]
    assert "reason" not in audits[0]["after"]


def test_require_404_lead_missing(monkeypatch):
    _wire(monkeypatch, leads=[])
    response = _client.post("/issues/run-abc/leads/lead-1/require")
    assert response.status_code == 404


# ── Remove ───────────────────────────────────────────────────────────────


def test_remove_422_on_empty_reason(monkeypatch):
    _wire(monkeypatch)
    response = _client.post(
        "/issues/run-abc/leads/lead-1/remove", json={"reason": "   "}
    )
    assert response.status_code == 422
    assert _reason(response) == "empty_reason"


def test_remove_happy_path_calls_set_status_and_audits(monkeypatch):
    _q, mutation_calls = _wire(monkeypatch)

    response = _client.post(
        "/issues/run-abc/leads/lead-1/remove",
        json={"reason": "Duplicate of a lead already required this week."},
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"leadId": "lead-1", "status": "removed"}

    sets = [args for path, args in mutation_calls if path == "storyLeads:setStatus"]
    assert len(sets) == 1
    assert sets[0]["leadId"] == "lead-1"
    assert sets[0]["status"] == "removed"

    audits = [args for path, args in mutation_calls if path == "auditLog:record"]
    assert len(audits) == 1
    assert audits[0]["action"] == "lead_removed"
    # Reason + run scope forwarded as structured decision kwargs (D-05) —
    # this row DOES project through auditLog.listDecisions.
    assert audits[0]["reason"] == "Duplicate of a lead already required this week."
    assert audits[0]["runId"] == "run-abc"
    assert "Duplicate of a lead" in audits[0]["after"]


def test_remove_without_reason_key_still_422(monkeypatch):
    _wire(monkeypatch)
    response = _client.post("/issues/run-abc/leads/lead-1/remove", json={})
    assert response.status_code == 422


def test_remove_404_lead_missing(monkeypatch):
    _wire(monkeypatch, leads=[])
    response = _client.post(
        "/issues/run-abc/leads/lead-1/remove", json={"reason": "gone"}
    )
    assert response.status_code == 404


# ── Wiring invariants ─────────────────────────────────────────────────────


def test_leads_router_registered_on_app():
    from eisenbalm_pipeline.api.main import app

    paths = {route.path for route in app.routes}
    assert "/issues/{run_id}/leads/{lead_id}/require" in paths
    assert "/issues/{run_id}/leads/{lead_id}/remove" in paths


def test_lead_mutations_are_secret_guarded():
    """storyLeads:setStatus MUST be in the pipeline-secret injection set —
    without it every lead action 500s Unauthorized against a real Convex
    deployment (the 42-03 lesson, already asserted once in
    test_brief_convex_guard.py; re-asserted here at the call-site level)."""
    from eisenbalm_pipeline.lib.convex_client import _PIPELINE_SECRET_GUARDED_PATHS

    assert "storyLeads:setStatus" in _PIPELINE_SECRET_GUARDED_PATHS
