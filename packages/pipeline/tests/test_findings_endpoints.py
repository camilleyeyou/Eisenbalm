"""Phase 33 (Plan 33-03 Task 2) — findings endpoint matrix.

Tests for the three FastAPI routes defined in docs/API_CONTRACTS.md §33.3:
  POST /issues/{run_id}/findings/{finding_id}/accept   body {ifRevisionID}
  POST /issues/{run_id}/findings/{finding_id}/dismiss  body {reason}
  POST /issues/{run_id}/findings/{finding_id}/reopen   no body

Harness mirrors test_content_patch_endpoints.py / test_review_endpoints.py:
Convex queries/mutations and the Sanity draft/patch helpers are all
monkeypatched — no network.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from eisenbalm_pipeline.api.findings import router as findings_router

pytestmark = pytest.mark.anyio

_app = FastAPI()
_app.include_router(findings_router)
_app.state.convex_http = MagicMock()
_app.state.sanity_http = MagicMock()
_app.state.graph = None
_app.state.background_tasks = set()

_client = TestClient(_app, raise_server_exceptions=True)

_F = "eisenbalm_pipeline.api.findings"


# ── Fixtures ───────────────────────────────────────────────────────────────


def _run(sanity_id: str = "issue-42") -> dict:
    return {"status": "awaiting-review", "sanityIssueId": sanity_id, "runId": "run-abc"}


def _finding(**overrides) -> dict:
    base = {
        "_id": "fnd-1",
        "runId": "run-abc",
        "sectionName": "problem",
        "severity": "error",
        "reason": "vague date",
        "quotedSpan": "opened its doors",
        "suggestedFix": "opened on 3 March 1974",
        "accepted": False,
    }
    base.update(overrides)
    return base


def _draft(**overrides) -> dict:
    base = {
        "revisionId": "rev-1",
        "sections": {
            "originStory": {"headline": "", "blocks": [], "lossy": False},
            "problemStatement": {
                "headline": "",
                "blocks": [
                    {
                        "type": "paragraph",
                        "text": "The facility opened its doors in 1974.",
                    }
                ],
                "lossy": False,
            },
            "founderBio": {"headline": "", "blocks": [], "lossy": False},
            "caseStudy": {"headline": "", "blocks": [], "lossy": False},
        },
        "theme": {},
        "game": {},
        "bonus": {
            "body": [
                {"type": "paragraph", "text": "The spec ad opened its doors too."}
            ],
            "bodyLossy": False,
        },
        "podcast": {},
        "bonusType": "specAd",
        "conversation": [],
    }
    base.update(overrides)
    return base


def _wire(
    monkeypatch,
    *,
    finding: dict | None,
    draft: dict | None = None,
    patch_raises: Exception | None = None,
    mutation_raises_on: str | None = None,
):
    """Standard wiring: mocks convex query/mutation + Sanity draft/patch.

    Returns (query_calls, mutation_calls, patch_calls) recorder lists.
    """
    query_calls: list[tuple[str, dict]] = []
    mutation_calls: list[tuple[str, dict]] = []
    patch_calls: list[dict] = []

    async def mock_convex_query(http, path, args):
        query_calls.append((path, args))
        if path == "pipelineRuns:byRunId":
            return _run()
        if path == "qaCorrections:byId":
            return finding
        return None

    async def mock_convex_mutation(http, path, args):
        mutation_calls.append((path, args))
        if mutation_raises_on and path == mutation_raises_on:
            raise RuntimeError(f"Convex mutation failed: {path}")
        return None

    async def mock_get_issue_draft(http, issue_id):
        return draft if draft is not None else _draft()

    async def mock_patch_issue_field(http, **kwargs):
        if patch_raises is not None:
            raise patch_raises
        patch_calls.append(kwargs)
        return "rev-2"

    monkeypatch.setattr(f"{_F}._cc.convex_query", mock_convex_query)
    monkeypatch.setattr(f"{_F}._cc.convex_mutation", mock_convex_mutation)
    monkeypatch.setattr(f"{_F}.get_issue_draft", mock_get_issue_draft)
    monkeypatch.setattr(f"{_F}.patch_issue_field", mock_patch_issue_field)
    return query_calls, mutation_calls, patch_calls


def _reason(response) -> str | None:
    detail = response.json().get("detail")
    return detail.get("reason") if isinstance(detail, dict) else None


# ── Accept — happy path ────────────────────────────────────────────────────


def test_accept_happy_path_patches_flips_and_audits(monkeypatch):
    """Accept: resolves the span, replaces it with suggestedFix inside the
    Phase 31 scoped patch, flips resolution='accepted', and writes a
    before/after audit row."""
    _q, mutation_calls, patch_calls = _wire(monkeypatch, finding=_finding())

    response = _client.post(
        "/issues/run-abc/findings/fnd-1/accept",
        json={"ifRevisionID": "rev-1"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data == {
        "revisionId": "rev-2",
        "findingId": "fnd-1",
        "resolution": "accepted",
    }

    # Scoped patch targeted problemStatement.body ("problem" -> "problemStatement").
    assert len(patch_calls) == 1
    patch = patch_calls[0]
    assert patch["field_path"] == "problemStatement.body"
    assert patch["if_revision_id"] == "rev-1"
    # suggestedFix substituted into the block text (Portable Text value).
    pt_texts = [
        child["text"]
        for blk in patch["value"]
        for child in blk.get("children", [])
    ]
    assert any("opened on 3 March 1974" in t for t in pt_texts)
    assert not any("opened its doors" in t for t in pt_texts)

    # Convex resolution flip.
    set_res = [args for path, args in mutation_calls if path == "qaCorrections:setResolution"]
    assert len(set_res) == 1
    assert set_res[0]["id"] == "fnd-1"
    assert set_res[0]["resolution"] == "accepted"
    assert set_res[0]["resolvedBy"]
    assert isinstance(set_res[0]["resolvedAt"], int)

    # Audit row with before=quotedSpan / after=suggestedFix.
    audits = [args for path, args in mutation_calls if path == "auditLog:record"]
    assert len(audits) == 1
    assert audits[0]["action"] == "finding.accepted"
    assert audits[0]["before"] == "opened its doors"
    assert audits[0]["after"] == "opened on 3 March 1974"

    # Phase 34 (D-08): accepting a fix voids both sign-offs.
    revokes = [args for path, args in mutation_calls if path == "signOffs:revokeAll"]
    assert len(revokes) == 1
    assert revokes[0]["runId"] == "run-abc"


def test_accept_bonus_specad_uses_bonus_body_path(monkeypatch):
    """A bonus finding on a specAd issue patches field_path='bonus.body'."""
    finding = _finding(
        sectionName="bonus",
        quotedSpan="opened its doors too",
        suggestedFix="never closed",
    )
    _q, _m, patch_calls = _wire(monkeypatch, finding=finding)

    response = _client.post(
        "/issues/run-abc/findings/fnd-1/accept",
        json={"ifRevisionID": "rev-1"},
    )
    assert response.status_code == 200, response.text
    assert patch_calls[0]["field_path"] == "bonus.body"


# ── Accept — 409 branches ──────────────────────────────────────────────────


def test_accept_409_accept_unavailable_missing_suggested_fix(monkeypatch):
    _wire(monkeypatch, finding=_finding(suggestedFix=None))
    response = _client.post(
        "/issues/run-abc/findings/fnd-1/accept", json={"ifRevisionID": "rev-1"}
    )
    assert response.status_code == 409
    assert _reason(response) == "accept_unavailable"


def test_accept_409_accept_unavailable_missing_quoted_span(monkeypatch):
    _wire(monkeypatch, finding=_finding(quotedSpan=None))
    response = _client.post(
        "/issues/run-abc/findings/fnd-1/accept", json={"ifRevisionID": "rev-1"}
    )
    assert response.status_code == 409
    assert _reason(response) == "accept_unavailable"


def test_accept_409_accept_unavailable_game_section(monkeypatch):
    """`game` has no block body — accept is unavailable by design."""
    _wire(monkeypatch, finding=_finding(sectionName="game"))
    response = _client.post(
        "/issues/run-abc/findings/fnd-1/accept", json={"ifRevisionID": "rev-1"}
    )
    assert response.status_code == 409
    assert _reason(response) == "accept_unavailable"


def test_accept_409_accept_unavailable_non_specad_bonus(monkeypatch):
    """A bonus finding on a bigBudget/jingle issue has no {type,text} block
    body to patch — accept unavailable."""
    _wire(
        monkeypatch,
        finding=_finding(sectionName="bonus", quotedSpan="anything"),
        draft=_draft(bonusType="bigBudget"),
    )
    response = _client.post(
        "/issues/run-abc/findings/fnd-1/accept", json={"ifRevisionID": "rev-1"}
    )
    assert response.status_code == 409
    assert _reason(response) == "accept_unavailable"


def test_accept_409_span_not_resolved(monkeypatch):
    """resolve_span returns None -> 409 span_not_resolved with the §33.3
    operator-facing message."""
    _wire(monkeypatch, finding=_finding(quotedSpan="a phrase that never appears"))
    response = _client.post(
        "/issues/run-abc/findings/fnd-1/accept", json={"ifRevisionID": "rev-1"}
    )
    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["reason"] == "span_not_resolved"
    assert "Edit inline" in detail["message"]


def test_accept_409_revision_mismatch_propagated(monkeypatch):
    """patch_issue_field's 409 revision_mismatch propagates untouched (D-06)."""
    _wire(
        monkeypatch,
        finding=_finding(),
        patch_raises=HTTPException(
            status_code=409,
            detail={"reason": "revision_mismatch", "message": "stale"},
        ),
    )
    response = _client.post(
        "/issues/run-abc/findings/fnd-1/accept", json={"ifRevisionID": "stale-rev"}
    )
    assert response.status_code == 409
    assert _reason(response) == "revision_mismatch"


def test_accept_409_already_resolved(monkeypatch):
    _wire(monkeypatch, finding=_finding(resolution="accepted"))
    response = _client.post(
        "/issues/run-abc/findings/fnd-1/accept", json={"ifRevisionID": "rev-1"}
    )
    assert response.status_code == 409
    assert _reason(response) == "already_resolved"


def test_accept_404_finding_missing(monkeypatch):
    _wire(monkeypatch, finding=None)
    response = _client.post(
        "/issues/run-abc/findings/fnd-1/accept", json={"ifRevisionID": "rev-1"}
    )
    assert response.status_code == 404


def test_accept_404_finding_wrong_run(monkeypatch):
    _wire(monkeypatch, finding=_finding(runId="run-other"))
    response = _client.post(
        "/issues/run-abc/findings/fnd-1/accept", json={"ifRevisionID": "rev-1"}
    )
    assert response.status_code == 404


def test_accept_502_when_convex_flip_fails_after_patch(monkeypatch):
    """Pitfall 6: Sanity patch succeeded but the Convex resolution flip
    failed — surface it loudly (5xx + explanatory message), never swallow."""
    _q, _m, patch_calls = _wire(
        monkeypatch,
        finding=_finding(),
        mutation_raises_on="qaCorrections:setResolution",
    )
    response = _client.post(
        "/issues/run-abc/findings/fnd-1/accept", json={"ifRevisionID": "rev-1"}
    )
    assert response.status_code in (500, 502)
    detail = response.json()["detail"]
    message = detail["message"] if isinstance(detail, dict) else str(detail)
    assert "applied" in message.lower()
    # The Sanity write DID happen before the flip failed.
    assert len(patch_calls) == 1


# ── Dismiss ────────────────────────────────────────────────────────────────


def test_dismiss_422_on_empty_reason(monkeypatch):
    _wire(monkeypatch, finding=_finding())
    response = _client.post(
        "/issues/run-abc/findings/fnd-1/dismiss", json={"reason": "   "}
    )
    assert response.status_code == 422


def test_dismiss_flips_resolution_and_audits_no_sanity_write(monkeypatch):
    _q, mutation_calls, patch_calls = _wire(monkeypatch, finding=_finding())

    response = _client.post(
        "/issues/run-abc/findings/fnd-1/dismiss",
        json={"reason": "Editorial judgment: the date is intentionally vague."},
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"findingId": "fnd-1", "resolution": "dismissed"}

    set_res = [args for path, args in mutation_calls if path == "qaCorrections:setResolution"]
    assert len(set_res) == 1
    assert set_res[0]["resolution"] == "dismissed"
    assert set_res[0]["resolutionReason"].startswith("Editorial judgment")
    assert set_res[0]["resolvedBy"]
    assert isinstance(set_res[0]["resolvedAt"], int)

    audits = [args for path, args in mutation_calls if path == "auditLog:record"]
    assert len(audits) == 1
    assert audits[0]["action"] == "finding.dismissed"
    assert audits[0]["after"].startswith("Editorial judgment")

    # Phase 34 (D-08): dismissing a finding voids both sign-offs.
    revokes = [args for path, args in mutation_calls if path == "signOffs:revokeAll"]
    assert len(revokes) == 1
    assert revokes[0]["runId"] == "run-abc"

    # NO Sanity write on dismiss.
    assert patch_calls == []


def test_dismiss_409_already_resolved(monkeypatch):
    _wire(monkeypatch, finding=_finding(resolution="dismissed"))
    response = _client.post(
        "/issues/run-abc/findings/fnd-1/dismiss", json={"reason": "again"}
    )
    assert response.status_code == 409
    assert _reason(response) == "already_resolved"


def test_dismiss_404_finding_missing(monkeypatch):
    _wire(monkeypatch, finding=None)
    response = _client.post(
        "/issues/run-abc/findings/fnd-1/dismiss", json={"reason": "gone"}
    )
    assert response.status_code == 404


# ── Reopen ─────────────────────────────────────────────────────────────────


def test_reopen_clears_resolution_and_audits(monkeypatch):
    _q, mutation_calls, patch_calls = _wire(
        monkeypatch, finding=_finding(resolution="dismissed")
    )

    response = _client.post("/issues/run-abc/findings/fnd-1/reopen")
    assert response.status_code == 200, response.text
    assert response.json() == {"findingId": "fnd-1", "resolution": None}

    set_res = [args for path, args in mutation_calls if path == "qaCorrections:setResolution"]
    assert len(set_res) == 1
    assert set_res[0]["id"] == "fnd-1"
    # resolution OMITTED entirely = reopen semantics (§33.1).
    assert "resolution" not in set_res[0]

    audits = [args for path, args in mutation_calls if path == "auditLog:record"]
    assert len(audits) == 1
    assert audits[0]["action"] == "finding.reopened"

    # Phase 34 (D-08): reopening a finding voids both sign-offs (closes the
    # gate-integrity hole from relocating the error-findings check to
    # sign-off time).
    revokes = [args for path, args in mutation_calls if path == "signOffs:revokeAll"]
    assert len(revokes) == 1
    assert revokes[0]["runId"] == "run-abc"

    # Reopen never reverts text (D-04) — no Sanity write.
    assert patch_calls == []


def test_reopen_409_not_resolved(monkeypatch):
    _wire(monkeypatch, finding=_finding())
    response = _client.post("/issues/run-abc/findings/fnd-1/reopen")
    assert response.status_code == 409
    assert _reason(response) == "not_resolved"


def test_reopen_404_finding_missing(monkeypatch):
    _wire(monkeypatch, finding=None)
    response = _client.post("/issues/run-abc/findings/fnd-1/reopen")
    assert response.status_code == 404


# ── Wiring invariants ──────────────────────────────────────────────────────


def test_set_resolution_is_secret_guarded():
    """qaCorrections:setResolution MUST be in the pipeline-secret injection
    set — without it every accept/dismiss/reopen 500s Unauthorized against a
    real Convex deployment (Pitfall 3, §33.1)."""
    from eisenbalm_pipeline.lib.convex_client import _PIPELINE_SECRET_GUARDED_PATHS

    assert "qaCorrections:setResolution" in _PIPELINE_SECRET_GUARDED_PATHS


def test_findings_router_registered_on_app():
    from eisenbalm_pipeline.api.main import app

    paths = {route.path for route in app.routes}
    assert "/issues/{run_id}/findings/{finding_id}/accept" in paths
    assert "/issues/{run_id}/findings/{finding_id}/dismiss" in paths
    assert "/issues/{run_id}/findings/{finding_id}/reopen" in paths
