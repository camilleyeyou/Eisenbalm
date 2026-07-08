"""
Phase 26 RVW-03: Review FastAPI endpoint tests.

Tests for the three FastAPI endpoints defined in API_CONTRACTS §26.7:
  POST /issues/{run_id}/publish
  POST /issues/{run_id}/schedule
  POST /issues/{run_id}/reject

All tests monkeypatch Convex queries/mutations and the Sanity flip helper.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from fastapi.testclient import TestClient
from fastapi import FastAPI

from eisenbalm_pipeline.api.review import router

# Build a minimal test app with the review router and mocked app.state.
_app = FastAPI()
_app.include_router(router)

# Inject a mock convex_http and sanity_http into app.state.
_mock_convex_http = MagicMock()
_mock_sanity_http = MagicMock()
_app.state.convex_http = _mock_convex_http
_app.state.sanity_http = _mock_sanity_http
_app.state.graph = None
_app.state.background_tasks = set()

_client = TestClient(_app, raise_server_exceptions=True)

pytestmark = pytest.mark.anyio


# ── Helpers ────────────────────────────────────────────────────────────────

def _future_ts() -> int:
    """Unix ms 1 hour from now."""
    return int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp() * 1000)


def _awaiting_run(sanity_id: str = "issue-42") -> dict:
    return {"status": "awaiting-review", "sanityIssueId": sanity_id, "runId": "run-abc"}


# ── test_publish_requires_claims_signoff ──────────────────────────────────


def test_publish_requires_claims_signoff(monkeypatch):
    """
    POST /issues/{run_id}/publish → 409 when allSignedOff is false.

    Server-side claims gate must reject the request even when the run is
    in awaiting-review status (Pitfall 6 in plan 26-01).
    """
    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _awaiting_run()
        if path == "claimChecks:allSignedOff":
            return {"total": 3, "signedOff": 1, "allSignedOff": False}
        return None

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.review._cc.convex_query",
        mock_convex_query,
    )

    response = _client.post("/issues/run-abc/publish")
    assert response.status_code == 409, (
        f"Expected 409 (claims not signed off), got {response.status_code}: {response.text}"
    )
    data = response.json()
    # FastAPI wraps HTTPException detail in {"detail": ...}
    detail = data.get("detail", {})
    reason = detail.get("reason") if isinstance(detail, dict) else str(detail)
    assert "claims_not_signed_off" in reason, (
        f"Expected reason='claims_not_signed_off' in {detail}"
    )


# ── test_publish_success ──────────────────────────────────────────────────


def test_publish_success(monkeypatch):
    """
    POST /issues/{run_id}/publish → 200 + {published: true} when all claims signed off.

    The endpoint should:
      1. Flip Sanity weeklyIssue.status='published' (D-01 path)
      2. Write a review_actions row with action='approved_and_published'
      3. Return 200 with {published: true, issueId: <id>}
    """
    sanity_flip_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _awaiting_run("issue-42")
        if path == "claimChecks:allSignedOff":
            return {"total": 3, "signedOff": 3, "allSignedOff": True}
        return None

    async def mock_convex_mutation(http, path, args):
        return None

    async def mock_flip(http, sanity_issue_id: str):
        sanity_flip_calls.append(sanity_issue_id)

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.review._cc.convex_query",
        mock_convex_query,
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.review._cc.convex_mutation",
        mock_convex_mutation,
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.review._flip_sanity_published",
        mock_flip,
    )

    response = _client.post("/issues/run-abc/publish")
    assert response.status_code == 200, (
        f"Expected 200 (publish success), got {response.status_code}: {response.text}"
    )
    data = response.json()
    assert data.get("published") is True
    assert data.get("issueId") == "issue-42"

    # Sanity flip was called with the correct issue ID.
    assert sanity_flip_calls == ["issue-42"], (
        f"Expected _flip_sanity_published called with issue-42, got {sanity_flip_calls}"
    )


# ── test_schedule_writes_scheduled_at ────────────────────────────────────


def test_schedule_writes_scheduled_at(monkeypatch):
    """
    POST /issues/{run_id}/schedule → 200 + {scheduledAt: <timestamp>, issueId: <id>}.

    The endpoint should call runs:setScheduledPublish and write a review_actions row
    with action='approved_and_scheduled'.
    """
    future_ts = _future_ts()
    scheduled_at_written = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _awaiting_run("issue-42")
        if path == "claimChecks:allSignedOff":
            return {"total": 3, "signedOff": 3, "allSignedOff": True}
        return None

    async def mock_convex_mutation(http, path, args):
        if path == "runs:setScheduledPublish":
            scheduled_at_written.append(args.get("scheduledPublishAt"))
        return None

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.review._cc.convex_query",
        mock_convex_query,
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.review._cc.convex_mutation",
        mock_convex_mutation,
    )

    response = _client.post(
        "/issues/run-abc/schedule",
        json={"scheduledAt": future_ts},
    )
    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )
    data = response.json()
    assert data.get("scheduledAt") == future_ts
    assert data.get("issueId") == "issue-42"

    # Verify the correct timestamp was written to Convex.
    assert scheduled_at_written == [future_ts], (
        f"Expected runs:setScheduledPublish called with {future_ts}, got {scheduled_at_written}"
    )


# ── test_reject_records_action ────────────────────────────────────────────


def test_reject_records_action(monkeypatch):
    """
    POST /issues/{run_id}/reject → 200 + {rejected: true} and writes review_actions row.
    """
    mutation_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _awaiting_run("issue-42")
        return None

    async def mock_convex_mutation(http, path, args):
        mutation_calls.append((path, args))
        return None

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.review._cc.convex_query",
        mock_convex_query,
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.review._cc.convex_mutation",
        mock_convex_mutation,
    )

    response = _client.post(
        "/issues/run-abc/reject",
        json={"note": "Content needs revision"},
    )
    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )
    data = response.json()
    assert data.get("rejected") is True
    assert data.get("issueId") == "issue-42"

    # reviewActions:record was called with action="rejected".
    review_action_calls = [
        args for path, args in mutation_calls
        if path == "reviewActions:record"
    ]
    assert review_action_calls, "reviewActions:record should have been called"
    assert review_action_calls[0]["action"] == "rejected"


# ── Phase 33 (§33.4, D-14, D-11b) — open-error-findings gate ──────────────


def _error_finding(**overrides) -> dict:
    base = {
        "_id": "fnd-1",
        "runId": "run-abc",
        "sectionName": "problem",
        "severity": "error",
        "reason": "vague date",
        "quotedSpan": "opened its doors",
        "accepted": False,
    }
    base.update(overrides)
    return base


def test_publish_409_on_open_error_findings(monkeypatch):
    """
    POST /issues/{run_id}/publish → 409 {reason:"open_error_findings", count:n}
    when unresolved error-severity findings exist. The check is anchor-blind
    (D-11b): an ORPHANED error finding (no quotedSpan — its anchor would fail)
    still blocks until explicitly accepted or dismissed.
    """
    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _awaiting_run()
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

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.review._cc.convex_query",
        mock_convex_query,
    )

    response = _client.post("/issues/run-abc/publish")
    assert response.status_code == 409, (
        f"Expected 409 (open error findings), got {response.status_code}: {response.text}"
    )
    detail = response.json()["detail"]
    assert detail["reason"] == "open_error_findings"
    assert detail["count"] == 2


def test_publish_passes_gate_when_errors_resolved_or_only_warnings_open(monkeypatch):
    """
    Resolved/dismissed error findings and open warning/info findings do NOT
    block publish — the gate counts only severity=='error' with no resolution.
    """
    sanity_flip_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _awaiting_run("issue-42")
        if path == "claimChecks:allSignedOff":
            return {"total": 3, "signedOff": 3, "allSignedOff": True}
        if path == "qaCorrections:byRunId":
            return [
                _error_finding(_id="fnd-1", resolution="accepted"),
                _error_finding(_id="fnd-2", resolution="dismissed"),
                _error_finding(_id="fnd-3", severity="warning"),
                _error_finding(_id="fnd-4", severity="info"),
            ]
        return None

    async def mock_convex_mutation(http, path, args):
        return None

    async def mock_flip(http, sanity_issue_id: str):
        sanity_flip_calls.append(sanity_issue_id)

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.review._cc.convex_query", mock_convex_query
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.review._cc.convex_mutation", mock_convex_mutation
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.review._flip_sanity_published", mock_flip
    )

    response = _client.post("/issues/run-abc/publish")
    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )
    assert sanity_flip_calls == ["issue-42"]


def test_schedule_409_on_open_error_findings(monkeypatch):
    """
    POST /issues/{run_id}/schedule gets the IDENTICAL gate (Pitfall 8):
    scheduling must not bypass the open-error-findings block.
    """
    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _awaiting_run()
        if path == "claimChecks:allSignedOff":
            return {"total": 3, "signedOff": 3, "allSignedOff": True}
        if path == "qaCorrections:byRunId":
            return [_error_finding(_id="fnd-1")]
        return None

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.review._cc.convex_query",
        mock_convex_query,
    )

    response = _client.post(
        "/issues/run-abc/schedule",
        json={"scheduledAt": _future_ts()},
    )
    assert response.status_code == 409, (
        f"Expected 409 (open error findings), got {response.status_code}: {response.text}"
    )
    detail = response.json()["detail"]
    assert detail["reason"] == "open_error_findings"
    assert detail["count"] == 1
