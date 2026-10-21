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
    # quick 260723-4a6 (§37.4(c)): carries completedAt so this fixture
    # represents a genuine final-review run (publisher writes awaiting-review
    # WITH completedAt) — NOT the paused-at-Gate-1 shape (awaiting-review
    # WITHOUT completedAt), which now 409s run_not_reviewable for
    # sounds-human. Every facts-cleared test ignores completedAt, so this is
    # additive-only.
    return {
        "status": "awaiting-review",
        "sanityIssueId": "issue-42",
        "completedAt": 1_700_000_000_000,
        "runId": run_id,
    }


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


def test_facts_cleared_records_despite_open_claims(monkeypatch):
    """Quick 261021-7aw: open findings / contradicted claims no longer block
    recording a sign-off (sign-offs are optional attestations)."""
    mutation_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _run()
        if path == "claimChecks:allSignedOff":
            return {'total': 3, 'signedOff': 1, 'blocking': 2, 'allSignedOff': False}
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

    response = _client.post("/issues/run-abc/sign-off", json={"kind": "facts-cleared"})
    assert response.status_code == 200, response.text
    assert any(p == "signOffs:record" for p, _ in mutation_calls)


# ── Phase 51.1 gate: only open contradicted claims block ────────────────────


def _gate_client(monkeypatch, gate_result):
    mutation_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _run()
        if path == "claimChecks:allSignedOff":
            return gate_result
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
    return mutation_calls


def test_facts_cleared_200_zero_claims(monkeypatch):
    calls = _gate_client(
        monkeypatch,
        {"total": 0, "signedOff": 0, "blocking": 0, "flagged": 0, "allSignedOff": True},
    )
    r = _client.post("/issues/run-abc/sign-off", json={"kind": "facts-cleared"})
    assert r.status_code == 200, r.text
    assert any(p == "signOffs:record" for p, _ in calls)


def test_facts_cleared_200_with_unreviewed_pending_claims(monkeypatch):
    _gate_client(
        monkeypatch,
        {"total": 40, "signedOff": 0, "blocking": 0, "flagged": 3, "allSignedOff": True},
    )
    r = _client.post("/issues/run-abc/sign-off", json={"kind": "facts-cleared"})
    assert r.status_code == 200, r.text


def test_facts_cleared_records_despite_contradicted_claims(monkeypatch):
    """Quick 261021-7aw: open findings / contradicted claims no longer block
    recording a sign-off (sign-offs are optional attestations)."""
    mutation_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _run()
        if path == "claimChecks:allSignedOff":
            return {'total': 12, 'blocking': 2, 'allSignedOff': False}
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

    response = _client.post("/issues/run-abc/sign-off", json={"kind": "facts-cleared"})
    assert response.status_code == 200, response.text
    assert any(p == "signOffs:record" for p, _ in mutation_calls)


def test_facts_cleared_records_when_claim_gate_unreadable(monkeypatch):
    """Quick 261021-7aw: open findings / contradicted claims no longer block
    recording a sign-off (sign-offs are optional attestations)."""
    mutation_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _run()
        if path == "claimChecks:allSignedOff":
            return None
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

    response = _client.post("/issues/run-abc/sign-off", json={"kind": "facts-cleared"})
    assert response.status_code == 200, response.text
    assert any(p == "signOffs:record" for p, _ in mutation_calls)


# ── test_facts_cleared_409_open_error_findings ──────────────────────────────


def test_facts_cleared_records_despite_open_error_findings(monkeypatch):
    """Quick 261021-7aw: open findings / contradicted claims no longer block
    recording a sign-off (sign-offs are optional attestations)."""
    mutation_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _run()
        if path == "claimChecks:allSignedOff":
            return {'allSignedOff': True}
        if path == "qaCorrections:byRunId":
            return [_error_finding(_id='fnd-1'), _error_finding(_id='fnd-2', quotedSpan=None)]
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

    response = _client.post("/issues/run-abc/sign-off", json={"kind": "facts-cleared"})
    assert response.status_code == 200, response.text
    assert any(p == "signOffs:record" for p, _ in mutation_calls)


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


def test_sounds_human_records_despite_open_voice_findings(monkeypatch):
    """Quick 261021-7aw: open findings / contradicted claims no longer block
    recording a sign-off (sign-offs are optional attestations)."""
    mutation_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _run()
        if path == "claimChecks:allSignedOff":
            return None
        if path == "qaCorrections:byRunId":
            return [_error_finding(axis='machine-tell')]
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

    response = _client.post("/issues/run-abc/sign-off", json={"kind": "sounds-human"})
    assert response.status_code == 200, response.text
    assert any(p == "signOffs:record" for p, _ in mutation_calls)


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


def test_sign_off_409_no_sanity_issue(monkeypatch):
    """
    Quick 260719-w6o (F5) — POST sign-off {kind:"sounds-human"} for a run
    with NO sanityIssueId (the failed-early AND paused-at-Gate-1 shape) →
    409 {reason:"no_sanity_issue"}; does NOT call signOffs:record. This
    reproduces the 2026-07-18 production incident where sounds-human 200'd
    on a contentless run.
    """
    mutation_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return {"status": "awaiting-review", "runId": "run-abc"}
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
    assert detail["reason"] == "no_sanity_issue"

    record_calls = [
        args for path, args in mutation_calls if path == "signOffs:record"
    ]
    assert record_calls == [], "signOffs:record must NOT be called"


# ── quick 260723-4a6 (§37.4(c)) — run_not_reviewable status guard ──────────


def test_sounds_human_409_run_not_reviewable_when_paused_at_gate1(monkeypatch):
    """
    POST sign-off {kind:"sounds-human"} for a run paused at Gate 1
    (status="awaiting-review", completedAt None/absent, sanityIssueId
    present so the earlier F5 no_sanity_issue guard does NOT catch it first)
    → 409 {reason:"run_not_reviewable"}; does NOT call signOffs:record.
    """
    mutation_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return {
                "status": "awaiting-review",
                "sanityIssueId": "issue-42",
                "completedAt": None,
                "runId": "run-abc",
            }
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
    assert detail["reason"] == "run_not_reviewable"

    record_calls = [
        args for path, args in mutation_calls if path == "signOffs:record"
    ]
    assert record_calls == [], "signOffs:record must NOT be called"


def test_sounds_human_409_run_not_reviewable_when_failed(monkeypatch):
    """
    POST sign-off {kind:"sounds-human"} for a FAILED run (sanityIssueId
    present so the earlier F5 no_sanity_issue guard does NOT catch it first)
    → 409 {reason:"run_not_reviewable"}; does NOT call signOffs:record.
    """
    mutation_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return {
                "status": "failed",
                "sanityIssueId": "issue-42",
                "runId": "run-abc",
            }
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
    assert detail["reason"] == "run_not_reviewable"

    record_calls = [
        args for path, args in mutation_calls if path == "signOffs:record"
    ]
    assert record_calls == [], "signOffs:record must NOT be called"


def test_facts_cleared_records_despite_open_factual_axis_error(monkeypatch):
    """Quick 261021-7aw: open findings / contradicted claims no longer block
    recording a sign-off (sign-offs are optional attestations)."""
    mutation_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _run()
        if path == "claimChecks:allSignedOff":
            return None
        if path == "qaCorrections:byRunId":
            return [_error_finding(axis='precision')]
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

    response = _client.post("/issues/run-abc/sign-off", json={"kind": "facts-cleared"})
    assert response.status_code == 200, response.text
    assert any(p == "signOffs:record" for p, _ in mutation_calls)


