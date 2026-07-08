"""
Phase 26 RVW-03 (gate restructured in Phase 34 §34.4): Review FastAPI
endpoint tests.

Tests for the three FastAPI endpoints defined in API_CONTRACTS §26.7:
  POST /issues/{run_id}/publish
  POST /issues/{run_id}/schedule
  POST /issues/{run_id}/reject

Phase 34 (D-04): the claims-signoff + open-error-findings checks that used
to gate publish/schedule directly have been RELOCATED to the facts-cleared
sign-off endpoint (api/signoffs.py, tested in test_signoffs_endpoints.py).
publish_issue/schedule_issue now gate on BOTH sign-offs being active
(signOffs:activeByRunId) — 409 {reason:"missing_signoffs"} otherwise.

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


def _active_signoffs(*kinds: str) -> dict:
    """Build a signOffs:activeByRunId-shaped response for the given kinds."""
    return {k: {"actorId": "user_1", "signedAt": 1} for k in kinds}


_BOTH_SIGNOFFS = ("facts-cleared", "sounds-human")


# ── test_publish_requires_both_signoffs ────────────────────────────────────


def test_publish_requires_both_signoffs(monkeypatch):
    """
    POST /issues/{run_id}/publish → 409 {reason:"missing_signoffs"} when
    either sign-off is missing/revoked — the server refuses regardless of
    button state (Phase 34 §34.4, PUB-01).
    """
    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _awaiting_run()
        if path == "signOffs:activeByRunId":
            return _active_signoffs("facts-cleared")  # sounds-human missing
        return None

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.review._cc.convex_query",
        mock_convex_query,
    )

    response = _client.post("/issues/run-abc/publish")
    assert response.status_code == 409, (
        f"Expected 409 (missing signoffs), got {response.status_code}: {response.text}"
    )
    detail = response.json()["detail"]
    assert detail["reason"] == "missing_signoffs"
    assert detail["missing"] == ["sounds-human"]


def test_publish_409_when_no_signoffs_active(monkeypatch):
    """POST /issues/{run_id}/publish → 409 missing_signoffs when NEITHER
    sign-off is active."""
    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _awaiting_run()
        if path == "signOffs:activeByRunId":
            return {}
        return None

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.review._cc.convex_query",
        mock_convex_query,
    )

    response = _client.post("/issues/run-abc/publish")
    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["reason"] == "missing_signoffs"
    assert set(detail["missing"]) == {"facts-cleared", "sounds-human"}


# ── test_publish_success ──────────────────────────────────────────────────


def test_publish_success(monkeypatch):
    """
    POST /issues/{run_id}/publish → 200 + {published: true} when BOTH
    sign-offs are active.

    The endpoint should:
      1. Flip Sanity weeklyIssue.status='published' (D-01 path)
      2. Write a review_actions row with action='approved_and_published'
      3. Return 200 with {published: true, issueId: <id>}
    """
    sanity_flip_calls = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _awaiting_run("issue-42")
        if path == "signOffs:activeByRunId":
            return _active_signoffs(*_BOTH_SIGNOFFS)
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


# ── test_schedule_requires_both_signoffs / test_schedule_writes_scheduled_at ──


def test_schedule_requires_both_signoffs(monkeypatch):
    """
    POST /issues/{run_id}/schedule → 409 {reason:"missing_signoffs"} when
    either sign-off is missing (Phase 34 §34.4, D-09 — identical gate to
    publish, no bypass via scheduling).
    """
    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _awaiting_run()
        if path == "signOffs:activeByRunId":
            return _active_signoffs("sounds-human")  # facts-cleared missing
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
        f"Expected 409 (missing signoffs), got {response.status_code}: {response.text}"
    )
    detail = response.json()["detail"]
    assert detail["reason"] == "missing_signoffs"
    assert detail["missing"] == ["facts-cleared"]


def test_schedule_writes_scheduled_at(monkeypatch):
    """
    POST /issues/{run_id}/schedule → 200 + {scheduledAt: <timestamp>, issueId: <id>}
    when BOTH sign-offs are active.

    The endpoint should call runs:setScheduledPublish and write a review_actions row
    with action='approved_and_scheduled'.
    """
    future_ts = _future_ts()
    scheduled_at_written = []

    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return _awaiting_run("issue-42")
        if path == "signOffs:activeByRunId":
            return _active_signoffs(*_BOTH_SIGNOFFS)
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


# ── Phase 34 (§34.4, D-04) — claims + open-error-findings gate RELOCATED ───
#
# The claims-signoff and open-error-findings checks previously asserted here
# (Phase 33 §33.4) now live in api/signoffs.py — they gate RECORDING a
# "facts-cleared" sign-off, not publish/schedule directly. See
# test_signoffs_endpoints.py::test_facts_cleared_409_claims_not_signed_off
# and ::test_facts_cleared_409_open_error_findings for that coverage.
# publish_issue/schedule_issue now only check that both sign-offs are
# ACTIVE (signOffs:activeByRunId) — see test_publish_requires_both_signoffs
# and test_schedule_requires_both_signoffs above.
