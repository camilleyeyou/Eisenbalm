"""Phase 42 (Plan 42-04) — Fact Check claim action endpoint matrix.

Tests for the six FastAPI routes defined in docs/API_CONTRACTS.md §42.4:
  POST   /issues/{run_id}/claims/{claim_index}/keep
  PATCH  /issues/{run_id}/claims/{claim_index}
  POST   /issues/{run_id}/claims/{claim_index}/replace-source
  DELETE /issues/{run_id}/claims/{claim_index}
  POST   /issues/{run_id}/claims/{claim_index}/evidence/preview
  POST   /issues/{run_id}/claims/{claim_index}/evidence/apply

Harness mirrors test_content_patch_endpoints.py / test_findings_endpoints.py:
Convex queries/mutations, the Sanity draft/patch helpers, web_search, and
acomplete are all monkeypatched — no network.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from eisenbalm_pipeline.api.factcheck import router as factcheck_router
from eisenbalm_pipeline.lib.search_client import SearchResult

pytestmark = pytest.mark.anyio

_app = FastAPI()
_app.include_router(factcheck_router)
_app.state.convex_http = MagicMock()
_app.state.sanity_http = MagicMock()
_app.state.graph = None
_app.state.background_tasks = set()

_client = TestClient(_app, raise_server_exceptions=True)

_FC = "eisenbalm_pipeline.api.factcheck"


# ── Fixtures ─────────────────────────────────────────────────────────────


def _run(sanity_id: str = "issue-42") -> dict:
    return {"status": "awaiting-review", "sanityIssueId": sanity_id, "runId": "run-abc"}


def _claim(**overrides) -> dict:
    base = {
        "_id": "cc-1",
        "runId": "run-abc",
        "claimIndex": 2,
        "text": "demand outpaces supply four to one",
        "claimType": "number",
        "context": "demand outpaces supply four to one",
        "status": "pending",
        "sectionName": "problemStatement",
        "blockIndexHint": 0,
        "sourceUrl": None,
        "retrievedAt": None,
        "importance": "Load-bearing",
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
                        "text": "demand outpaces supply four to one across the region.",
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
            "body": [{"type": "paragraph", "text": "demand outpaces supply too."}],
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
    claim: dict | None,
    draft: dict | None = None,
    patch_raises: Exception | None = None,
    charity_rows: list[dict] | None = None,
):
    """Standard wiring: mocks convex query/mutation + Sanity draft/patch.

    Returns (query_calls, mutation_calls, patch_calls, groq_calls) recorder
    lists.
    """
    query_calls: list[tuple[str, dict]] = []
    mutation_calls: list[tuple[str, dict]] = []
    patch_calls: list[dict] = []
    groq_calls: list[tuple[str, dict]] = []

    async def mock_convex_query(http, path, args):
        query_calls.append((path, args))
        if path == "pipelineRuns:byRunId":
            return _run()
        if path == "claimChecks:byRunIdAndIndex":
            return claim
        if path == "claimChecks:listByRunId":
            return [claim] if claim is not None else []
        return None

    async def mock_convex_mutation(http, path, args):
        mutation_calls.append((path, args))
        return None

    async def mock_get_issue_draft(http, issue_id):
        return draft if draft is not None else _draft()

    async def mock_patch_issue_field(http, **kwargs):
        if patch_raises is not None:
            raise patch_raises
        patch_calls.append(kwargs)
        return "rev-2"

    async def mock_groq(http, query, params=None):
        groq_calls.append((query, params or {}))
        return charity_rows if charity_rows is not None else [
            {"charityName": "The Quiet Foundation", "charityWebsite": "https://example.org"}
        ]

    monkeypatch.setattr(f"{_FC}._cc.convex_query", mock_convex_query)
    monkeypatch.setattr(f"{_FC}._cc.convex_mutation", mock_convex_mutation)
    monkeypatch.setattr(f"{_FC}.get_issue_draft", mock_get_issue_draft)
    monkeypatch.setattr(f"{_FC}.patch_issue_field", mock_patch_issue_field)
    monkeypatch.setattr(f"{_FC}._sc._groq", mock_groq)
    return query_calls, mutation_calls, patch_calls, groq_calls


def _reason(response) -> str | None:
    detail = response.json().get("detail")
    return detail.get("reason") if isinstance(detail, dict) else None


# ── Keep as written ─────────────────────────────────────────────────────


def test_keep_422_on_empty_reason(monkeypatch):
    _wire(monkeypatch, claim=_claim())
    response = _client.post(
        "/issues/run-abc/claims/2/keep", json={"reason": "   "}
    )
    assert response.status_code == 422


def test_keep_happy_path_calls_keep_as_written_and_audits(monkeypatch):
    _q, mutation_calls, patch_calls, _g = _wire(monkeypatch, claim=_claim())

    response = _client.post(
        "/issues/run-abc/claims/2/keep",
        json={"reason": "Editorial judgment: this figure is intentionally atmospheric."},
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"claimIndex": 2, "status": "checked"}

    keeps = [args for path, args in mutation_calls if path == "claimChecks:keepAsWritten"]
    assert len(keeps) == 1
    assert keeps[0]["runId"] == "run-abc"
    assert keeps[0]["claimIndex"] == 2

    audits = [args for path, args in mutation_calls if path == "auditLog:record"]
    assert len(audits) == 1
    assert audits[0]["action"] == "claim_kept"
    assert "Editorial judgment" in audits[0]["after"]
    # Phase 43 (§43.2, D-11/D-13): the operator's reason + run scope are ALSO
    # forwarded as structured decision kwargs, alongside the legacy after-JSON.
    assert audits[0]["reason"] == "Editorial judgment: this figure is intentionally atmospheric."
    assert audits[0]["runId"] == "run-abc"

    # NO Sanity write on keep.
    assert patch_calls == []


def test_keep_404_claim_missing(monkeypatch):
    _wire(monkeypatch, claim=None)
    response = _client.post(
        "/issues/run-abc/claims/2/keep", json={"reason": "gone"}
    )
    assert response.status_code == 404


# ── PATCH — metadata-only (no text) ─────────────────────────────────────


def test_patch_without_text_updates_metadata_no_sanity_write(monkeypatch):
    _q, mutation_calls, patch_calls, _g = _wire(monkeypatch, claim=_claim())

    response = _client.patch(
        "/issues/run-abc/claims/2",
        json={"sourceUrl": "https://example.org/report", "retrievedAt": 123456},
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"claimIndex": 2, "revisionId": None}

    updates = [args for path, args in mutation_calls if path == "claimChecks:updateClaim"]
    assert len(updates) == 1
    assert updates[0]["sourceUrl"] == "https://example.org/report"
    assert updates[0]["retrievedAt"] == 123456
    assert "text" not in updates[0]

    audits = [args for path, args in mutation_calls if path == "auditLog:record"]
    assert len(audits) == 1
    assert audits[0]["action"] == "claim_edited"

    # NO Sanity write and no terminal-status/keepAsWritten call in this branch.
    assert patch_calls == []
    keeps = [args for path, args in mutation_calls if path == "claimChecks:keepAsWritten"]
    assert keeps == []


# ── PATCH — text present (content-touching) ─────────────────────────────


def test_patch_with_text_400_when_missing_revision_id(monkeypatch):
    _wire(monkeypatch, claim=_claim())
    response = _client.patch(
        "/issues/run-abc/claims/2", json={"text": "revised claim text"}
    )
    assert response.status_code == 400
    assert _reason(response) == "missing_revision_id"


def test_patch_with_text_ordering_reset_before_terminal_status(monkeypatch):
    """The content-patch path calls _reset_touched_claims BEFORE the acted
    claim's own terminal-status write (claimChecks:keepAsWritten) — the
    explicit edit must win over the generic block-level reset (Pitfall 3)."""
    _q, mutation_calls, patch_calls, _g = _wire(monkeypatch, claim=_claim())

    response = _client.patch(
        "/issues/run-abc/claims/2",
        json={
            "ifRevisionID": "rev-1",
            "text": "demand outpaces installations roughly four to one",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"claimIndex": 2, "revisionId": "rev-2"}

    # Sanity patch happened, targeting problemStatement.body.
    assert len(patch_calls) == 1
    assert patch_calls[0]["field_path"] == "problemStatement.body"
    assert patch_calls[0]["if_revision_id"] == "rev-1"
    pt_texts = [
        child["text"]
        for blk in patch_calls[0]["value"]
        for child in blk.get("children", [])
    ]
    assert any("outpaces installations" in t for t in pt_texts)

    # Ordering: markChanged (generic reset) BEFORE keepAsWritten (terminal, acted claim).
    all_paths = [path for path, _args in mutation_calls]
    assert "claimChecks:markChanged" in all_paths
    assert "claimChecks:keepAsWritten" in all_paths
    assert all_paths.index("claimChecks:markChanged") < all_paths.index(
        "claimChecks:keepAsWritten"
    )

    updates = [args for path, args in mutation_calls if path == "claimChecks:updateClaim"]
    assert len(updates) == 1
    assert updates[0]["text"] == "demand outpaces installations roughly four to one"

    keeps = [args for path, args in mutation_calls if path == "claimChecks:keepAsWritten"]
    assert keeps[0]["claimIndex"] == 2

    revokes = [args for path, args in mutation_calls if path == "signOffs:revokeAll"]
    assert len(revokes) == 1
    assert revokes[0]["runId"] == "run-abc"

    audits = [args for path, args in mutation_calls if path == "auditLog:record"]
    assert len(audits) == 1
    assert audits[0]["action"] == "claim_edited"


def test_patch_with_text_409_span_not_resolved(monkeypatch):
    _wire(
        monkeypatch,
        claim=_claim(text="a phrase that never appears in the draft"),
    )
    response = _client.patch(
        "/issues/run-abc/claims/2",
        json={"ifRevisionID": "rev-1", "text": "replacement"},
    )
    assert response.status_code == 409
    assert _reason(response) == "span_not_resolved"


def test_patch_with_text_409_revision_mismatch_propagated(monkeypatch):
    _wire(
        monkeypatch,
        claim=_claim(),
        patch_raises=HTTPException(
            status_code=409,
            detail={"reason": "revision_mismatch", "message": "stale"},
        ),
    )
    response = _client.patch(
        "/issues/run-abc/claims/2",
        json={"ifRevisionID": "stale-rev", "text": "replacement"},
    )
    assert response.status_code == 409
    assert _reason(response) == "revision_mismatch"


def test_patch_bonus_claim_uses_bonus_body_path(monkeypatch):
    _q, _m, patch_calls, _g = _wire(
        monkeypatch,
        claim=_claim(
            sectionName="bonus",
            text="demand outpaces supply too.",
            blockIndexHint=0,
        ),
    )
    response = _client.patch(
        "/issues/run-abc/claims/2",
        json={"ifRevisionID": "rev-1", "text": "supply keeps up now."},
    )
    assert response.status_code == 200, response.text
    assert patch_calls[0]["field_path"] == "bonus.body"


def test_patch_bonus_claim_409_when_not_specad(monkeypatch):
    _wire(
        monkeypatch,
        claim=_claim(sectionName="bonus"),
        draft=_draft(bonusType="bigBudget"),
    )
    response = _client.patch(
        "/issues/run-abc/claims/2",
        json={"ifRevisionID": "rev-1", "text": "replacement"},
    )
    assert response.status_code == 409
    assert _reason(response) == "claim_edit_unavailable"


def test_patch_404_claim_missing(monkeypatch):
    _wire(monkeypatch, claim=None)
    response = _client.patch(
        "/issues/run-abc/claims/2", json={"sourceUrl": "https://x"}
    )
    assert response.status_code == 404


# ── Replace source ───────────────────────────────────────────────────────


def test_replace_source_updates_claim_no_sanity_write(monkeypatch):
    _q, mutation_calls, patch_calls, _g = _wire(monkeypatch, claim=_claim())

    response = _client.post(
        "/issues/run-abc/claims/2/replace-source",
        json={"sourceUrl": "https://post-and-courier.example/story", "retrievedAt": 999},
    )
    assert response.status_code == 200, response.text
    assert response.json() == {
        "claimIndex": 2,
        "sourceUrl": "https://post-and-courier.example/story",
        "retrievedAt": 999,
    }

    updates = [args for path, args in mutation_calls if path == "claimChecks:updateClaim"]
    assert len(updates) == 1
    assert updates[0]["sourceUrl"] == "https://post-and-courier.example/story"
    assert updates[0]["retrievedAt"] == 999

    audits = [args for path, args in mutation_calls if path == "auditLog:record"]
    assert audits[0]["action"] == "claim_source_replaced"

    assert patch_calls == []


def test_replace_source_code_stamps_retrieved_at_when_omitted(monkeypatch):
    _q, mutation_calls, _p, _g = _wire(monkeypatch, claim=_claim())

    response = _client.post(
        "/issues/run-abc/claims/2/replace-source",
        json={"sourceUrl": "https://example.org/new-source"},
    )
    assert response.status_code == 200, response.text
    updates = [args for path, args in mutation_calls if path == "claimChecks:updateClaim"]
    assert isinstance(updates[0]["retrievedAt"], int)
    assert updates[0]["retrievedAt"] > 0


def test_replace_source_404_claim_missing(monkeypatch):
    _wire(monkeypatch, claim=None)
    response = _client.post(
        "/issues/run-abc/claims/2/replace-source", json={"sourceUrl": "https://x"}
    )
    assert response.status_code == 404


# ── Remove ────────────────────────────────────────────────────────────────


def test_remove_soft_deletes_no_sanity_write(monkeypatch):
    _q, mutation_calls, patch_calls, _g = _wire(monkeypatch, claim=_claim())

    response = _client.request(
        "DELETE", "/issues/run-abc/claims/2", json={"reason": "duplicate of claim 3"}
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"claimIndex": 2, "status": "removed"}

    removes = [args for path, args in mutation_calls if path == "claimChecks:remove"]
    assert len(removes) == 1
    assert removes[0]["runId"] == "run-abc"
    assert removes[0]["claimIndex"] == 2

    audits = [args for path, args in mutation_calls if path == "auditLog:record"]
    assert audits[0]["action"] == "claim_removed"
    assert "duplicate of claim 3" in audits[0]["after"]

    assert patch_calls == []


def test_remove_without_body_still_works(monkeypatch):
    _wire(monkeypatch, claim=_claim())
    response = _client.request("DELETE", "/issues/run-abc/claims/2")
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "removed"


def test_remove_404_claim_missing(monkeypatch):
    _wire(monkeypatch, claim=None)
    response = _client.request("DELETE", "/issues/run-abc/claims/2")
    assert response.status_code == 404


# ── Evidence preview — read-only, zero mutations ────────────────────────


def test_evidence_preview_returns_source_and_rewritten_claim_no_mutations(monkeypatch):
    _q, mutation_calls, patch_calls, groq_calls = _wire(monkeypatch, claim=_claim())

    tavily_batch = [
        SearchResult(
            url="https://postandcourier.example/story",
            title="Installations lag demand",
            content="Demand for installations outpaces supply roughly four to one.",
            score=0.9,
        ),
        SearchResult(
            url="https://example.org/other",
            title="Other",
            content="Unrelated.",
            score=0.4,
        ),
    ]

    async def mock_web_search(query, *, max_results=5):
        return tavily_batch

    class _Pick:
        sourceIndex = 0
        rewrittenClaim = "demand outpaces installations roughly four to one"

    async def mock_acomplete(*, agent_id, run_id, messages, response_format=None):
        return _Pick(), {"tokens_in": 0, "tokens_out": 0, "usd": 0.0}

    monkeypatch.setattr(f"{_FC}.web_search", mock_web_search)
    monkeypatch.setattr(f"{_FC}.acomplete", mock_acomplete)

    response = _client.post("/issues/run-abc/claims/2/evidence/preview", json={})
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["sourceUrl"] == "https://postandcourier.example/story"
    assert data["sourcePublisher"] == "postandcourier.example"
    assert data["rewrittenClaim"] == "demand outpaces installations roughly four to one"
    assert isinstance(data["retrievedAt"], int)

    # Charity-context GROQ projection fired (Pitfall 6).
    assert len(groq_calls) == 1
    assert "charity->name" in groq_calls[0][0]

    # ZERO mutating calls of any kind during preview.
    assert mutation_calls == []
    assert patch_calls == []


def test_evidence_preview_falls_back_to_top_result_on_bad_index(monkeypatch):
    _wire(monkeypatch, claim=_claim())

    tavily_batch = [
        SearchResult(url="https://top.example/a", title="A", content="c", score=0.9),
    ]

    async def mock_web_search(query, *, max_results=5):
        return tavily_batch

    class _Pick:
        sourceIndex = 99  # out of range — never a raw LLM URL, never a crash
        rewrittenClaim = "rewritten"

    async def mock_acomplete(*, agent_id, run_id, messages, response_format=None):
        return _Pick(), {"tokens_in": 0, "tokens_out": 0, "usd": 0.0}

    monkeypatch.setattr(f"{_FC}.web_search", mock_web_search)
    monkeypatch.setattr(f"{_FC}.acomplete", mock_acomplete)

    response = _client.post("/issues/run-abc/claims/2/evidence/preview", json={})
    assert response.status_code == 200, response.text
    assert response.json()["sourceUrl"] == "https://top.example/a"


def test_evidence_preview_404_claim_missing(monkeypatch):
    _wire(monkeypatch, claim=None)
    response = _client.post("/issues/run-abc/claims/2/evidence/preview", json={})
    assert response.status_code == 404


# ── Evidence apply — atomic content patch + claim update + audit ────────


def test_evidence_apply_happy_path_patches_updates_and_audits(monkeypatch):
    _q, mutation_calls, patch_calls, _g = _wire(monkeypatch, claim=_claim())

    response = _client.post(
        "/issues/run-abc/claims/2/evidence/apply",
        json={
            "ifRevisionID": "rev-1",
            "sourceUrl": "https://postandcourier.example/story",
            "retrievedAt": 555,
            "rewrittenClaim": "demand outpaces installations roughly four to one",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json() == {
        "revisionId": "rev-2",
        "claimIndex": 2,
        "resolution": "evidence_applied",
    }

    assert len(patch_calls) == 1
    assert patch_calls[0]["field_path"] == "problemStatement.body"
    pt_texts = [
        child["text"]
        for blk in patch_calls[0]["value"]
        for child in blk.get("children", [])
    ]
    assert any("outpaces installations" in t for t in pt_texts)

    updates = [args for path, args in mutation_calls if path == "claimChecks:updateClaim"]
    assert updates[0]["text"] == "demand outpaces installations roughly four to one"
    assert updates[0]["sourceUrl"] == "https://postandcourier.example/story"
    assert updates[0]["retrievedAt"] == 555

    all_paths = [path for path, _args in mutation_calls]
    assert all_paths.index("claimChecks:markChanged") < all_paths.index(
        "claimChecks:keepAsWritten"
    )

    revokes = [args for path, args in mutation_calls if path == "signOffs:revokeAll"]
    assert len(revokes) == 1

    audits = [args for path, args in mutation_calls if path == "auditLog:record"]
    assert len(audits) == 1
    assert audits[0]["action"] == "claim_evidence_applied"


def test_evidence_apply_409_span_not_resolved(monkeypatch):
    _wire(monkeypatch, claim=_claim(text="never appears anywhere"))
    response = _client.post(
        "/issues/run-abc/claims/2/evidence/apply",
        json={
            "ifRevisionID": "rev-1",
            "sourceUrl": "https://x",
            "retrievedAt": 1,
            "rewrittenClaim": "y",
        },
    )
    assert response.status_code == 409
    assert _reason(response) == "span_not_resolved"


def test_evidence_apply_409_revision_mismatch_propagated(monkeypatch):
    _wire(
        monkeypatch,
        claim=_claim(),
        patch_raises=HTTPException(
            status_code=409,
            detail={"reason": "revision_mismatch", "message": "stale"},
        ),
    )
    response = _client.post(
        "/issues/run-abc/claims/2/evidence/apply",
        json={
            "ifRevisionID": "stale-rev",
            "sourceUrl": "https://x",
            "retrievedAt": 1,
            "rewrittenClaim": "y",
        },
    )
    assert response.status_code == 409
    assert _reason(response) == "revision_mismatch"


def test_evidence_apply_404_claim_missing(monkeypatch):
    _wire(monkeypatch, claim=None)
    response = _client.post(
        "/issues/run-abc/claims/2/evidence/apply",
        json={
            "ifRevisionID": "rev-1",
            "sourceUrl": "https://x",
            "retrievedAt": 1,
            "rewrittenClaim": "y",
        },
    )
    assert response.status_code == 404


# ── Wiring invariants ─────────────────────────────────────────────────────


def test_claim_mutations_are_secret_guarded():
    """claimChecks:updateClaim / keepAsWritten / remove MUST be in the
    pipeline-secret injection set — without it every claim action 500s
    Unauthorized against a real Convex deployment (the 42-03 lesson)."""
    from eisenbalm_pipeline.lib.convex_client import _PIPELINE_SECRET_GUARDED_PATHS

    assert "claimChecks:updateClaim" in _PIPELINE_SECRET_GUARDED_PATHS
    assert "claimChecks:keepAsWritten" in _PIPELINE_SECRET_GUARDED_PATHS
    assert "claimChecks:remove" in _PIPELINE_SECRET_GUARDED_PATHS


def test_factcheck_router_registered_on_app():
    from eisenbalm_pipeline.api.main import app

    paths = {route.path for route in app.routes}
    assert "/issues/{run_id}/claims/{claim_index}/keep" in paths
    assert "/issues/{run_id}/claims/{claim_index}" in paths
    assert "/issues/{run_id}/claims/{claim_index}/replace-source" in paths
    assert "/issues/{run_id}/claims/{claim_index}/evidence/preview" in paths
    assert "/issues/{run_id}/claims/{claim_index}/evidence/apply" in paths
