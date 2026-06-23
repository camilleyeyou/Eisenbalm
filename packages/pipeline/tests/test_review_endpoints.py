"""
Wave 0 scaffold — Phase 26 RVW-01/RVW-02/RVW-03: Review FastAPI endpoint tests.

Pre-written stubs for the three FastAPI endpoints defined in API_CONTRACTS §26.7:
  POST /issues/{run_id}/publish
  POST /issues/{run_id}/schedule
  POST /issues/{run_id}/reject

All tests skip at import time if the router is not yet present.
The router path will be: packages/pipeline/eisenbalm_pipeline/api/review.py

Implementation target (Plan 26-02):
  - publish requires all claim_checks to be signed off (allSignedOff gate)
  - publish flips Sanity weeklyIssue.status='published' (reuses existing webhook path)
  - schedule stores scheduledPublishAt via runs.setScheduledPublish
  - reject writes a review_actions row with action="rejected"
"""

import pytest

# ── Import guard ──────────────────────────────────────────────────────────────

try:
    from fastapi.testclient import TestClient  # type: ignore[import]
    _FASTAPI_AVAILABLE = True
except ImportError:
    _FASTAPI_AVAILABLE = False

try:
    from eisenbalm_pipeline.api.review import router  # type: ignore[import]
    from fastapi import FastAPI

    _app = FastAPI()
    _app.include_router(router, prefix="/issues")
    _client = TestClient(_app)
    _ROUTER_AVAILABLE = True
except (ImportError, Exception):
    _ROUTER_AVAILABLE = False
    _client = None


skip_if_no_router = pytest.mark.skipif(
    not _ROUTER_AVAILABLE,
    reason="eisenbalm_pipeline.api.review router not yet implemented (Plan 26-02)",
)

skip_if_no_fastapi = pytest.mark.skipif(
    not _FASTAPI_AVAILABLE,
    reason="fastapi not installed in test environment",
)


# ── publish_requires_claims_signoff ───────────────────────────────────────────


@skip_if_no_router
def test_publish_requires_claims_signoff(monkeypatch):
    """
    POST /issues/{run_id}/publish → 422 when allSignedOff is false.

    The endpoint should reject publish requests when not all claim_checks
    have been signed off (checked or skipped). This guards the race window
    between the operator clicking "Approve" and claims loading from Convex
    (Pitfall 5 in plan 26-01).
    """
    # Mock the Convex allSignedOff query to return "not ready"
    def mock_all_signed_off(run_id: str):
        return {"total": 3, "signedOff": 1, "allSignedOff": False}

    # The implementation may call this via convex_client or a dependency;
    # the exact monkeypatch target will be known after Plan 26-02 implementation.
    # For now, stub the most likely path.
    try:
        import eisenbalm_pipeline.lib.convex_client as cc  # type: ignore[import]
        monkeypatch.setattr(cc, "claim_checks_all_signed_off", mock_all_signed_off, raising=False)
    except (ImportError, AttributeError):
        pytest.skip("convex_client module not yet available — update monkeypatch target in Plan 26-02")

    response = _client.post(
        "/issues/test-run-id/publish",
        json={"actor_id": "user_test123"},
    )
    # Expect 422 Unprocessable Entity (claims gate blocked)
    assert response.status_code == 422, (
        f"Expected 422 (claims not signed off), got {response.status_code}: {response.text}"
    )


@skip_if_no_router
def test_publish_success(monkeypatch):
    """
    POST /issues/{run_id}/publish → 200 + {published: true} when all claims signed off.

    When allSignedOff=true, the endpoint should:
      1. Flip Sanity weeklyIssue.status='published' (D-01 path)
      2. Write a review_actions row with action='approved_and_published'
      3. Return 200 with {published: true, sanity_issue_id: <id>}
    """
    def mock_all_signed_off(run_id: str):
        return {"total": 3, "signedOff": 3, "allSignedOff": True}

    def mock_sanity_publish(issue_id: str):
        return {"_id": issue_id, "status": "published"}

    try:
        import eisenbalm_pipeline.lib.convex_client as cc  # type: ignore[import]
        import eisenbalm_pipeline.lib.sanity_client as sc  # type: ignore[import]
        monkeypatch.setattr(cc, "claim_checks_all_signed_off", mock_all_signed_off, raising=False)
        monkeypatch.setattr(sc, "publish_issue", mock_sanity_publish, raising=False)
    except (ImportError, AttributeError):
        pytest.skip("required modules not yet available — update monkeypatch targets in Plan 26-02")

    response = _client.post(
        "/issues/test-run-id/publish",
        json={"actor_id": "user_test123"},
    )
    assert response.status_code == 200, (
        f"Expected 200 (publish success), got {response.status_code}: {response.text}"
    )
    data = response.json()
    assert data.get("published") is True


@skip_if_no_router
def test_schedule_writes_scheduled_at(monkeypatch):
    """
    POST /issues/{run_id}/schedule → 200 + {scheduled: true, scheduled_at: <timestamp>}.

    The endpoint should call runs.setScheduledPublish and write a review_actions row
    with action='approved_and_scheduled'.
    """
    from datetime import datetime, timezone, timedelta

    # A valid future timestamp (1 hour from now)
    future_ts = int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp() * 1000)

    scheduled_at_written = []

    def mock_set_scheduled_publish(run_id: str, scheduled_publish_at: int):
        scheduled_at_written.append(scheduled_publish_at)

    try:
        import eisenbalm_pipeline.lib.convex_client as cc  # type: ignore[import]
        monkeypatch.setattr(
            cc, "runs_set_scheduled_publish", mock_set_scheduled_publish, raising=False
        )
    except (ImportError, AttributeError):
        pytest.skip("convex_client module not yet available — update monkeypatch target in Plan 26-02")

    response = _client.post(
        "/issues/test-run-id/schedule",
        json={"actor_id": "user_test123", "scheduled_at": future_ts},
    )
    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )
    data = response.json()
    assert data.get("scheduled") is True
    assert "scheduled_at" in data

    # Verify the correct timestamp was written to Convex
    assert scheduled_at_written == [future_ts], (
        f"Expected runs.setScheduledPublish called with {future_ts}, got {scheduled_at_written}"
    )
