"""Phase 47 (Plan 47-04, BRF-05/BRF-06, docs/API_CONTRACTS.md §47.5) — Brief
edit + field-strengthen endpoint matrix.

  PATCH /issues/{run_id}/brief                           body {field, value}
  POST  /issues/{run_id}/brief/{field}/strengthen/preview body {currentValue}
  POST  /issues/{run_id}/brief/{field}/strengthen/apply   body {newText}

Harness mirrors test_revision_endpoints.py: Convex query/mutation and
`acomplete`/`would_exceed_run_cap`/`load_run_config` monkeypatched — no
network.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from eisenbalm_pipeline.api.brief import router as brief_router

pytestmark = pytest.mark.anyio

_app = FastAPI()
_app.include_router(brief_router)
_app.state.convex_http = MagicMock()
_app.state.sanity_http = MagicMock()
_app.state.graph = None
_app.state.background_tasks = set()

_client = TestClient(_app, raise_server_exceptions=True)

_B = "eisenbalm_pipeline.api.brief"


# ── Fixtures ─────────────────────────────────────────────────────────────


def _brief(**overrides) -> dict:
    base = {
        "runId": "run-abc",
        "premise": "A regional grant program is quietly running dry.",
        "currentPeg": "The program's fiscal year closes next month.",
        "centralClaim": "Overlooked funding gaps compound fastest in rural districts.",
        "readerEffect": "Readers should feel the urgency of a closing window.",
        "knownRisks": "Grant figures are self-reported by the org.",
        "voiceIntention": "Dry, precise, Fortune-500 register.",
    }
    base.update(overrides)
    return base


def _wire(monkeypatch, *, brief: dict | None = None, agent_run_rows: list[dict] | None = None):
    """Standard wiring: mocks convex query/mutation. Returns
    (query_calls, mutation_calls) recorder lists."""
    query_calls: list[tuple[str, dict]] = []
    mutation_calls: list[tuple[str, dict]] = []

    async def mock_convex_query(http, path, args):
        query_calls.append((path, args))
        if path == "briefs:byRunId":
            return brief if brief is not None else _brief()
        if path == "agentRuns:byRunId":
            return agent_run_rows if agent_run_rows is not None else []
        if path == "agents:listForWorkspace":
            return []
        if path == "pipelineConfig:getAll":
            return []
        return None

    async def mock_convex_mutation(http, path, args):
        mutation_calls.append((path, args))
        return None

    monkeypatch.setattr(f"{_B}._cc.convex_query", mock_convex_query)
    monkeypatch.setattr(f"{_B}._cc.convex_mutation", mock_convex_mutation)
    return query_calls, mutation_calls


def _reason(response) -> str | None:
    detail = response.json().get("detail")
    return detail.get("reason") if isinstance(detail, dict) else None


# ── PATCH /brief — BRF-05 ────────────────────────────────────────────────


def test_patch_brief_unknown_field_422(monkeypatch):
    _wire(monkeypatch)
    response = _client.patch(
        "/issues/run-abc/brief", json={"field": "notAField", "value": "x"}
    )
    assert response.status_code == 422
    assert _reason(response) == "unknown_field"


def test_patch_brief_happy_path_writes_and_audits(monkeypatch):
    _q, mutation_calls = _wire(monkeypatch)

    response = _client.patch(
        "/issues/run-abc/brief",
        json={"field": "premise", "value": "A sharper premise."},
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"resolution": "brief_field_edited"}

    patches = [args for path, args in mutation_calls if path == "briefs:patch"]
    assert len(patches) == 1
    assert patches[0] == {
        "runId": "run-abc",
        "field": "premise",
        "value": "A sharper premise.",
    }

    audits = [args for path, args in mutation_calls if path == "auditLog:record"]
    assert len(audits) == 1
    assert audits[0]["action"] == "brief_field_edited"
    assert "A sharper premise." in audits[0]["after"]


# ── Field-strengthen preview — read-only, zero mutations ─────────────────


def test_strengthen_preview_unknown_field_422(monkeypatch):
    _wire(monkeypatch)
    response = _client.post(
        "/issues/run-abc/brief/notAField/strengthen/preview",
        json={"currentValue": "x"},
    )
    assert response.status_code == 422
    assert _reason(response) == "unknown_field"


def test_strengthen_preview_returns_proposal_no_mutations(monkeypatch):
    _q, mutation_calls = _wire(monkeypatch)

    class _Pick:
        proposedText = "A regional grant program is dangerously close to running dry."
        whatChanged = "Sharpened the stakes with a concrete adjective."

    async def mock_acomplete(*, agent_id, run_id, messages, response_format=None):
        return _Pick(), {"tokens_in": 0, "tokens_out": 0, "usd": 0.01}

    monkeypatch.setattr(f"{_B}.acomplete", mock_acomplete)

    response = _client.post(
        "/issues/run-abc/brief/premise/strengthen/preview",
        json={"currentValue": "A regional grant program is quietly running dry."},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["proposedText"] == (
        "A regional grant program is dangerously close to running dry."
    )
    assert "Sharpened" in data["whatChanged"]

    # ZERO mutating calls of any kind during preview (no briefs:patch write,
    # no audit row) — the plan's explicit "NO Convex write, NO _emit_audit".
    assert mutation_calls == []


def test_strengthen_preview_cost_cap_exceeded_returns_409(monkeypatch):
    _wire(monkeypatch)

    async def mock_would_exceed(*args, **kwargs):
        return True, {"spentUsd": 9.99, "projectedUsd": 0.05, "capUsd": 10.0}

    monkeypatch.setattr(f"{_B}.would_exceed_run_cap", mock_would_exceed)

    response = _client.post(
        "/issues/run-abc/brief/premise/strengthen/preview",
        json={"currentValue": "A regional grant program is quietly running dry."},
    )
    assert response.status_code == 409
    assert _reason(response) == "cost_cap_exceeded"
    assert "capUsd" in response.json()["detail"]


# ── Field-strengthen apply — writes + audits + Decision log ──────────────


def test_strengthen_apply_unknown_field_422(monkeypatch):
    _wire(monkeypatch)
    response = _client.post(
        "/issues/run-abc/brief/notAField/strengthen/apply",
        json={"newText": "x"},
    )
    assert response.status_code == 422
    assert _reason(response) == "unknown_field"


def test_strengthen_apply_writes_and_emits_decision_logged_audit(monkeypatch):
    _q, mutation_calls = _wire(monkeypatch)

    response = _client.post(
        "/issues/run-abc/brief/premise/strengthen/apply",
        json={"newText": "A regional grant program is dangerously close to running dry."},
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"resolution": "brief_field_strengthened"}

    patches = [args for path, args in mutation_calls if path == "briefs:patch"]
    assert len(patches) == 1
    assert patches[0]["field"] == "premise"
    assert patches[0]["value"] == (
        "A regional grant program is dangerously close to running dry."
    )

    audits = [args for path, args in mutation_calls if path == "auditLog:record"]
    assert len(audits) == 1
    assert audits[0]["action"] == "brief_field_strengthened"
    # A structured reason= kwarg IS present — unlike revise/apply's
    # unreasoned passage_revised row, this action DOES surface in the
    # shared Decision log (auditLog.ts::isDecisionRow).
    assert audits[0]["reason"]
    assert audits[0]["runId"] == "run-abc"


# ── Wiring invariants ─────────────────────────────────────────────────────


def test_brief_router_registered_on_app():
    from eisenbalm_pipeline.api.main import app

    paths = {route.path for route in app.routes}
    assert "/issues/{run_id}/brief" in paths
    assert "/issues/{run_id}/brief/{field}/strengthen/preview" in paths
    assert "/issues/{run_id}/brief/{field}/strengthen/apply" in paths


def test_brief_mutations_are_secret_guarded():
    """briefs:patch MUST be in the pipeline-secret injection set — without
    it every Brief edit/strengthen-apply 500s Unauthorized against a real
    Convex deployment (the 42-03 lesson)."""
    from eisenbalm_pipeline.lib.convex_client import _PIPELINE_SECRET_GUARDED_PATHS

    assert "briefs:patch" in _PIPELINE_SECRET_GUARDED_PATHS
