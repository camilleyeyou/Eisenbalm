"""Phase 45 (Plan 45-01 Wave 0 scaffold; Plan 45-03 implements) — passage
revision endpoint matrix.

Guarded by ``pytest.importorskip`` so the WHOLE module SKIPS cleanly (not a
collection error, not a failure) until ``eisenbalm_pipeline.api.revision``
exists. Mirrors ``test_factcheck_endpoints.py``'s harness (FastAPI TestClient
+ MagicMock ``convex_http``/``sanity_http`` + a module-string monkeypatch
target) — see ``docs/API_CONTRACTS.md`` §45 for the exact request/response
shapes these tests assert against; §45 is the binding contract, this file is
the automated feedback signal for Plan 45-03.

Select subsets via:
  -k directive          test_build_directive_per_chip
  -k preview             the two preview tests
  -k apply                the three apply tests
  -k cost_attribution    test_cost_attribution_distinct_agentKey_real_runid
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

pytest.importorskip("eisenbalm_pipeline.api.revision")

from eisenbalm_pipeline.api.revision import _build_directive  # noqa: E402
from eisenbalm_pipeline.api.revision import router as revision_router  # noqa: E402

pytestmark = pytest.mark.anyio

_app = FastAPI()
_app.include_router(revision_router)
_app.state.convex_http = MagicMock()
_app.state.sanity_http = MagicMock()
_app.state.graph = None
_app.state.background_tasks = set()

_client = TestClient(_app, raise_server_exceptions=True)

_R = "eisenbalm_pipeline.api.revision"


# ── Fixtures ─────────────────────────────────────────────────────────────


def _run(sanity_id: str = "issue-42") -> dict:
    return {"status": "awaiting-review", "sanityIssueId": sanity_id, "runId": "run-abc"}


def _draft(**overrides) -> dict:
    base = {
        "revisionId": "rev-1",
        "sections": {
            "originStory": {"headline": "", "blocks": [], "lossy": False},
            "problemStatement": {"headline": "", "blocks": [], "lossy": False},
            "founderBio": {
                "headline": "",
                "blocks": [
                    {
                        "type": "paragraph",
                        "text": "Jane Doe grew up nearby before founding the org.",
                    }
                ],
                "lossy": False,
            },
            "caseStudy": {"headline": "", "blocks": [], "lossy": False},
        },
        "theme": {},
        "game": {},
        "bonus": {"body": [], "bodyLossy": False},
        "podcast": {},
        "bonusType": "specAd",
        "conversation": [],
    }
    base.update(overrides)
    return base


def _wire(
    monkeypatch,
    *,
    draft: dict | None = None,
    patch_raises: Exception | None = None,
    agent_run_rows: list[dict] | None = None,
):
    """Standard wiring: mocks convex query/mutation + Sanity draft/patch,
    mirroring test_factcheck_endpoints.py's `_wire`. Returns
    (query_calls, mutation_calls, patch_calls) recorder lists."""
    query_calls: list[tuple[str, dict]] = []
    mutation_calls: list[tuple[str, dict]] = []
    patch_calls: list[dict] = []

    async def mock_convex_query(http, path, args):
        query_calls.append((path, args))
        if path == "pipelineRuns:byRunId":
            return _run()
        if path == "agentRuns:byRunId":
            return agent_run_rows if agent_run_rows is not None else []
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

    monkeypatch.setattr(f"{_R}._cc.convex_query", mock_convex_query)
    monkeypatch.setattr(f"{_R}._cc.convex_mutation", mock_convex_mutation)
    monkeypatch.setattr(f"{_R}.get_issue_draft", mock_get_issue_draft)
    monkeypatch.setattr(f"{_R}.patch_issue_field", mock_patch_issue_field)
    return query_calls, mutation_calls, patch_calls


def _reason(response) -> str | None:
    detail = response.json().get("detail")
    return detail.get("reason") if isinstance(detail, dict) else None


# ── §45.1 — direction-chip directive builder ─────────────────────────────


def test_build_directive_per_chip():
    """Each of the 7 chips produces the correct directive clause; `custom`
    passes free text verbatim; `match_brief` degrades to brief_context
    (§45.1, D-06/D-07)."""
    assert "clear" in _build_directive(
        "make_clearer", custom_direction=None, brief_context=""
    ).lower()
    assert "specific" in _build_directive(
        "make_more_specific", custom_direction=None, brief_context=""
    ).lower()
    assert "tighten" in _build_directive(
        "tighten", custom_direction=None, brief_context=""
    ).lower()
    assert "repetition" in _build_directive(
        "reduce_repetition", custom_direction=None, brief_context=""
    ).lower()

    custom = _build_directive(
        "custom",
        custom_direction="Make it sound more like a county clerk",
        brief_context="",
    )
    assert custom == "Make it sound more like a county clerk"

    brief = _build_directive(
        "match_brief", custom_direction=None, brief_context="voice: dry and precise"
    )
    assert "dry and precise" in brief


# ── §45.3 — preview: read-only, no mutation, no audit ────────────────────


def test_preview_no_mutation_no_audit(monkeypatch):
    _q, mutation_calls, patch_calls = _wire(monkeypatch)

    class _Pick:
        proposedText = "a former county clerk"
        whatChanged = (
            "Replaced unverifiable characterization with a sourced biographical fact."
        )
        claimDelta = {
            "added": [],
            "removed": [],
            "altered": ["founder's prior occupation"],
        }

    async def mock_acomplete(*, agent_id, run_id, messages, response_format=None):
        return _Pick(), {"tokens_in": 0, "tokens_out": 0, "usd": 0.01}

    monkeypatch.setattr(f"{_R}.acomplete", mock_acomplete)

    response = _client.post(
        "/issues/run-abc/revise/preview",
        json={
            "sectionName": "founderBio",
            "quotedText": "Jane Doe grew up nearby",
            "direction": "make_clearer",
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["proposedText"] == "a former county clerk"
    assert "claimDelta" in data

    # ZERO mutation and ZERO Sanity write during preview (D-02).
    assert patch_calls == []
    audits = [args for path, args in mutation_calls if path == "auditLog:record"]
    assert audits == []


def test_preview_cost_cap_exceeded_returns_409(monkeypatch):
    _wire(monkeypatch, agent_run_rows=[{"costUsd": 9.99}])

    async def mock_would_exceed(*args, **kwargs):
        return True, {"spentUsd": 9.99, "projectedUsd": 0.05, "capUsd": 10.0}

    monkeypatch.setattr(f"{_R}.would_exceed_run_cap", mock_would_exceed)

    response = _client.post(
        "/issues/run-abc/revise/preview",
        json={
            "sectionName": "founderBio",
            "quotedText": "Jane Doe grew up nearby",
            "direction": "make_clearer",
        },
    )
    assert response.status_code == 409
    assert _reason(response) == "cost_cap_exceeded"
    assert "capUsd" in response.json()["detail"]


# ── §45.4 — apply: atomic + audited ───────────────────────────────────────


def test_apply_patches_and_resets_and_audits_once(monkeypatch):
    _q, mutation_calls, patch_calls = _wire(monkeypatch)

    response = _client.post(
        "/issues/run-abc/revise/apply",
        json={
            "ifRevisionID": "rev-1",
            "sectionName": "founderBio",
            "quotedText": "Jane Doe grew up nearby",
            "newText": "a former county clerk",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"revisionId": "rev-2", "resolution": "revision_applied"}

    assert len(patch_calls) == 1
    assert patch_calls[0]["field_path"] == "founderBio.body"

    all_paths = [path for path, _args in mutation_calls]
    assert "signOffs:revokeAll" in all_paths

    audits = [args for path, args in mutation_calls if path == "auditLog:record"]
    assert len(audits) == 1
    assert audits[0]["action"] == "passage_revised"


def test_apply_stale_revision_id_409(monkeypatch):
    _wire(
        monkeypatch,
        patch_raises=HTTPException(
            status_code=409,
            detail={"reason": "revision_mismatch", "message": "stale"},
        ),
    )
    response = _client.post(
        "/issues/run-abc/revise/apply",
        json={
            "ifRevisionID": "stale-rev",
            "sectionName": "founderBio",
            "quotedText": "Jane Doe grew up nearby",
            "newText": "a former county clerk",
        },
    )
    assert response.status_code == 409
    assert _reason(response) == "revision_mismatch"


def test_apply_unresolved_span_409(monkeypatch):
    _wire(
        monkeypatch,
        draft=_draft(
            sections={
                "originStory": {"headline": "", "blocks": [], "lossy": False},
                "problemStatement": {"headline": "", "blocks": [], "lossy": False},
                "founderBio": {
                    "headline": "",
                    "blocks": [
                        {"type": "paragraph", "text": "an entirely different sentence"}
                    ],
                    "lossy": False,
                },
                "caseStudy": {"headline": "", "blocks": [], "lossy": False},
            }
        ),
    )
    response = _client.post(
        "/issues/run-abc/revise/apply",
        json={
            "ifRevisionID": "rev-1",
            "sectionName": "founderBio",
            "quotedText": "a phrase that never appears",
            "newText": "replacement",
        },
    )
    assert response.status_code == 409
    assert _reason(response) == "span_not_resolved"


# ── §45.5 — cost attribution: distinct agentKey, real run_id ─────────────


def test_cost_attribution_distinct_agentKey_real_runid(monkeypatch):
    _q, mutation_calls, _p = _wire(monkeypatch)

    class _Pick:
        proposedText = "a former county clerk"
        whatChanged = "Tightened the phrase."
        claimDelta = {"added": [], "removed": [], "altered": []}

    async def mock_acomplete(*, agent_id, run_id, messages, response_format=None):
        return _Pick(), {"tokens_in": 10, "tokens_out": 20, "usd": 0.02}

    monkeypatch.setattr(f"{_R}.acomplete", mock_acomplete)

    response = _client.post(
        "/issues/run-abc/revise/preview",
        json={
            "sectionName": "founderBio",
            "quotedText": "Jane Doe grew up nearby",
            "direction": "tighten",
        },
    )
    assert response.status_code == 200, response.text

    completed = [args for path, args in mutation_calls if path == "agentRuns:completed"]
    assert len(completed) == 1
    # The REAL run_id — never a "evidence-preview-{run_id}" pseudo-id (D-13).
    assert completed[0]["runId"] == "run-abc"
    # A fresh, distinct agentKey — never a reused pipeline agentKey (Pitfall 2).
    assert completed[0]["agentKey"].startswith("revision-")
