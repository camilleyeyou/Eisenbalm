"""
Phase 34 (§34.3): sign-off record endpoint tests.

Tests for the single FastAPI endpoint defined in API_CONTRACTS §34.3:
  POST /issues/{run_id}/sign-off   body {kind: "facts-cleared" | "sounds-human"}

All tests monkeypatch Convex queries/mutations via the `_cc` module attribute
(mirrors the test_review_endpoints.py harness).
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from fastapi.testclient import TestClient
from fastapi import FastAPI

from eisenbalm_pipeline.api.signoffs import router

# Build a minimal test app with the signoffs router and mocked app.state.
_app = FastAPI()
_app.include_router(router)

_mock_convex_http = MagicMock()
_app.state.convex_http = _mock_convex_http
_app.state.graph = None
_app.state.background_tasks = set()

_client = TestClient(_app, raise_server_exceptions=True)

pytestmark = pytest.mark.anyio


# ── Helpers ────────────────────────────────────────────────────────────────


def _run(run_id: str = "run-abc") -> dict:
    return {"status": "awaiting-review", "sanityIssueId": "issue-42", "runId": run_id}


def _error_finding(**overrides) -> dict:
    base = {
        "_id": "fnd-1",
        "runId": "run-abc",
        "sectionName": "problem",
        "severity": "error",
        "reason": "vague date",
        "quotedSpan": "opened its doors",
        "resolution": None,
    }
    base.update(overrides)
    return base


# ── test_facts_cleared_success ──────────────────────────────────────────────


def test_facts_cleared_success(monkeypatch):
    """
    POST sign-off {kind:"facts-cleared"} with all claims signed + no open
    error findings → 200 {runId, kind, signedAt}; calls signOffs:record;
    writes one audit row action="signoff.recorded".
    """
    mutation_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _run()
        if path == "claimChecks:allSignedOff":
            return {"total": 3, "signedOff": 3, "allSignedOff": True}
        if path == "qaCorrections:byRunId":
            return []
        return None

    async def mock_convex_mutation(http, path, args):
        mutation_calls.append((path, args))
        return None

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.signoffs._cc.convex_query", mock_convex_query
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.signoffs._cc.convex_mutation", mock_convex_mutation
    )

    response = _client.post(
        "/issues/run-abc/sign-off", json={"kind": "facts-cleared"}
    )
    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )
    data = response.json()
    assert data["runId"] == "run-abc"
    assert data["kind"] == "facts-cleared"
    assert "signedAt" in data

    record_calls = [
        args for path, args in mutation_calls if path == "signOffs:record"
    ]
    assert len(record_calls) == 1
    assert record_calls[0]["kind"] == "facts-cleared"
    assert record_calls[0]["runId"] == "run-abc"

    audit_calls = [
        args for path, args in mutation_calls if path == "auditLog:record"
    ]
    assert len(audit_calls) == 1
    assert audit_calls[0]["action"] == "signoff.recorded"


# ── test_facts_cleared_409_claims_not_signed_off ────────────────────────────


def test_facts_cleared_409_claims_not_signed_off(monkeypatch):
    """
    POST sign-off {kind:"facts-cleared"} when claimChecks:allSignedOff is
    false → 409 {reason:"claims_not_signed_off"}; does NOT call
    signOffs:record.
    """
    mutation_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _run()
        if path == "claimChecks:allSignedOff":
            return {"total": 3, "signedOff": 1, "allSignedOff": False}
        return None

    async def mock_convex_mutation(http, path, args):
        mutation_calls.append((path, args))
        return None

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.signoffs._cc.convex_query", mock_convex_query
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.signoffs._cc.convex_mutation", mock_convex_mutation
    )

    response = _client.post(
        "/issues/run-abc/sign-off", json={"kind": "facts-cleared"}
    )
    assert response.status_code == 409, (
        f"Expected 409, got {response.status_code}: {response.text}"
    )
    detail = response.json()["detail"]
    assert detail["reason"] == "claims_not_signed_off"

    record_calls = [
        args for path, args in mutation_calls if path == "signOffs:record"
    ]
    assert record_calls == [], "signOffs:record must NOT be called"


# ── test_facts_cleared_409_open_error_findings ──────────────────────────────


def test_facts_cleared_409_open_error_findings(monkeypatch):
    """
    POST sign-off {kind:"facts-cleared"} with an unresolved error-severity
    finding (incl. an orphaned one, resolution absent) → 409
    {reason:"open_error_findings", count:n}; does NOT record. Anchor-blind
    (D-11b): an orphaned finding (no quotedSpan) still blocks.
    """
    mutation_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _run()
        if path == "claimChecks:allSignedOff":
            return {"total": 3, "signedOff": 3, "allSignedOff": True}
        if path == "qaCorrections:byRunId":
            return [
                _error_finding(_id="fnd-1"),
                # Orphaned: no quotedSpan at all — must STILL block.
                _error_finding(_id="fnd-2", quotedSpan=None),
                # Open warning — must NOT count toward the gate.
                _error_finding(_id="fnd-3", severity="warning"),
            ]
        return None

    async def mock_convex_mutation(http, path, args):
        mutation_calls.append((path, args))
        return None

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.signoffs._cc.convex_query", mock_convex_query
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.signoffs._cc.convex_mutation", mock_convex_mutation
    )

    response = _client.post(
        "/issues/run-abc/sign-off", json={"kind": "facts-cleared"}
    )
    assert response.status_code == 409, (
        f"Expected 409, got {response.status_code}: {response.text}"
    )
    detail = response.json()["detail"]
    assert detail["reason"] == "open_error_findings"
    assert detail["count"] == 2

    record_calls = [
        args for path, args in mutation_calls if path == "signOffs:record"
    ]
    assert record_calls == [], "signOffs:record must NOT be called"


# ── test_sounds_human_ungated ───────────────────────────────────────────────


def test_sounds_human_ungated(monkeypatch):
    """
    POST sign-off {kind:"sounds-human"} → 200 with NO prerequisite checks
    (ungated, D-06); records + audits — even when claims are NOT all signed
    off (proves sounds-human never consults the facts prerequisites).
    """
    mutation_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _run()
        if path == "claimChecks:allSignedOff":
            return {"total": 3, "signedOff": 0, "allSignedOff": False}
        if path == "qaCorrections:byRunId":
            return [_error_finding()]
        return None

    async def mock_convex_mutation(http, path, args):
        mutation_calls.append((path, args))
        return None

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.signoffs._cc.convex_query", mock_convex_query
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.signoffs._cc.convex_mutation", mock_convex_mutation
    )

    response = _client.post(
        "/issues/run-abc/sign-off", json={"kind": "sounds-human"}
    )
    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )
    data = response.json()
    assert data["kind"] == "sounds-human"

    record_calls = [
        args for path, args in mutation_calls if path == "signOffs:record"
    ]
    assert len(record_calls) == 1
    assert record_calls[0]["kind"] == "sounds-human"


# ── test_invalid_kind_422 ───────────────────────────────────────────────────


def test_invalid_kind_422(monkeypatch):
    """POST sign-off {kind:"bogus"} → 422 (Pydantic Literal rejects)."""
    response = _client.post("/issues/run-abc/sign-off", json={"kind": "bogus"})
    assert response.status_code == 422, (
        f"Expected 422, got {response.status_code}: {response.text}"
    )


# ── test_nonexistent_run_404 ────────────────────────────────────────────────


def test_nonexistent_run_404(monkeypatch):
    """POST sign-off for a nonexistent run → 404."""
    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return None
        return None

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.signoffs._cc.convex_query", mock_convex_query
    )

    response = _client.post(
        "/issues/run-missing/sign-off", json={"kind": "sounds-human"}
    )
    assert response.status_code == 404, (
        f"Expected 404, got {response.status_code}: {response.text}"
    )


# ── §36.7 — Sign-off prerequisite partition (Phase 36 Plan 02) ─────────────────


def test_sounds_human_409_open_voice_findings(monkeypatch):
    """
    POST sign-off {kind:"sounds-human"} with one open severity="error"
    axis="machine-tell" finding present → 409
    {reason:"open_voice_findings", count:1}; does NOT record.
    """
    mutation_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _run()
        if path == "qaCorrections:byRunId":
            return [_error_finding(axis="machine-tell")]
        return None

    async def mock_convex_mutation(http, path, args):
        mutation_calls.append((path, args))
        return None

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.signoffs._cc.convex_query", mock_convex_query
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.signoffs._cc.convex_mutation", mock_convex_mutation
    )

    response = _client.post(
        "/issues/run-abc/sign-off", json={"kind": "sounds-human"}
    )
    assert response.status_code == 409, (
        f"Expected 409, got {response.status_code}: {response.text}"
    )
    detail = response.json()["detail"]
    assert detail["reason"] == "open_voice_findings"
    assert detail["count"] == 1

    record_calls = [
        args for path, args in mutation_calls if path == "signOffs:record"
    ]
    assert record_calls == [], "signOffs:record must NOT be called"


def test_sounds_human_success_no_open_voice_findings(monkeypatch):
    """
    POST sign-off {kind:"sounds-human"} with NO open voice-axis error
    (one resolved voice-axis error, one open factual-axis error) → 200;
    calls signOffs:record with kind="sounds-human".
    """
    mutation_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _run()
        if path == "qaCorrections:byRunId":
            return [
                _error_finding(axis="sentiment", resolution="accepted"),
                _error_finding(axis="precision"),
            ]
        return None

    async def mock_convex_mutation(http, path, args):
        mutation_calls.append((path, args))
        return None

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.signoffs._cc.convex_query", mock_convex_query
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.signoffs._cc.convex_mutation", mock_convex_mutation
    )

    response = _client.post(
        "/issues/run-abc/sign-off", json={"kind": "sounds-human"}
    )
    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )
    data = response.json()
    assert data["kind"] == "sounds-human"

    record_calls = [
        args for path, args in mutation_calls if path == "signOffs:record"
    ]
    assert len(record_calls) == 1
    assert record_calls[0]["kind"] == "sounds-human"


def test_facts_cleared_ignores_open_voice_axis_error(monkeypatch):
    """
    Pitfall 2 regression guard: POST sign-off {kind:"facts-cleared"} with
    claims all signed AND only an open axis="sentiment" (voice) error
    present → 200 (the voice error must NOT block facts-cleared).
    """
    mutation_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _run()
        if path == "claimChecks:allSignedOff":
            return {"total": 3, "signedOff": 3, "allSignedOff": True}
        if path == "qaCorrections:byRunId":
            return [_error_finding(axis="sentiment")]
        return None

    async def mock_convex_mutation(http, path, args):
        mutation_calls.append((path, args))
        return None

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.signoffs._cc.convex_query", mock_convex_query
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.signoffs._cc.convex_mutation", mock_convex_mutation
    )

    response = _client.post(
        "/issues/run-abc/sign-off", json={"kind": "facts-cleared"}
    )
    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )

    record_calls = [
        args for path, args in mutation_calls if path == "signOffs:record"
    ]
    assert len(record_calls) == 1
    assert record_calls[0]["kind"] == "facts-cleared"


def test_facts_cleared_409_open_factual_axis_error(monkeypatch):
    """
    POST sign-off {kind:"facts-cleared"} with an open axis="precision"
    (factual) error present → still 409 {reason:"open_error_findings"}
    (factual errors still block facts-cleared).
    """
    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _run()
        if path == "claimChecks:allSignedOff":
            return {"total": 3, "signedOff": 3, "allSignedOff": True}
        if path == "qaCorrections:byRunId":
            return [_error_finding(axis="precision")]
        return None

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.signoffs._cc.convex_query", mock_convex_query
    )

    response = _client.post(
        "/issues/run-abc/sign-off", json={"kind": "facts-cleared"}
    )
    assert response.status_code == 409, (
        f"Expected 409, got {response.status_code}: {response.text}"
    )
    detail = response.json()["detail"]
    assert detail["reason"] == "open_error_findings"
    assert detail["count"] == 1
