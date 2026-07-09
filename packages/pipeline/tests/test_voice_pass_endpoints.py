"""Phase 36 (VOX-02/VOX-04, docs/API_CONTRACTS.md §36.4/§36.5) — Voice Pass
endpoint tests.

Tests for the two FastAPI routes defined in §36.4/§36.5:
  POST /issues/{run_id}/voice-recheck   # no body
  POST /issues/{run_id}/voice-rewrite   # body {findingId}

Harness mirrors test_findings_endpoints.py / test_signoffs_endpoints.py:
Convex queries/mutations, the Sanity draft read, the judge, and acomplete are
all monkeypatched — no network.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from eisenbalm_pipeline.agents.qa.rules import QAFinding
from eisenbalm_pipeline.api.voice_pass import router as voice_pass_router

pytestmark = pytest.mark.anyio

_app = FastAPI()
_app.include_router(voice_pass_router)
_app.state.convex_http = MagicMock()
_app.state.sanity_http = MagicMock()
_app.state.graph = None
_app.state.background_tasks = set()

_client = TestClient(_app, raise_server_exceptions=True)

_V = "eisenbalm_pipeline.api.voice_pass"


# ── Fixtures ───────────────────────────────────────────────────────────────


def _run(sanity_id: str = "issue-42") -> dict:
    return {"status": "awaiting-review", "sanityIssueId": sanity_id, "runId": "run-abc"}


def _draft(**overrides) -> dict:
    base = {
        "revisionId": "rev-1",
        "sections": {
            "originStory": {
                "headline": "",
                "blocks": [
                    {"type": "paragraph", "text": "It delves into a tapestry of hope."}
                ],
                "lossy": False,
            },
            "problemStatement": {"headline": "", "blocks": [], "lossy": False},
            "founderBio": {"headline": "", "blocks": [], "lossy": False},
            "caseStudy": {"headline": "", "blocks": [], "lossy": False},
        },
        "theme": {},
        "game": {"description": "A game about hope."},
        "bonus": {"body": [], "bodyLossy": False},
        "podcast": {},
        "bonusType": "specAd",
        "conversation": [],
    }
    base.update(overrides)
    return base


def _judge_finding(**overrides) -> QAFinding:
    base = dict(
        section="origin_story",
        severity="warning",
        axis="sentiment",
        quotedSpan="tapestry of hope",
        reason="AI-slop metaphor",
        suggestedFix="a history of grant renewals",
    )
    base.update(overrides)
    return QAFinding(**base)


def _wire_recheck(
    monkeypatch,
    *,
    existing: list[dict] | None = None,
    findings: list[QAFinding] | None = None,
    draft: dict | None = None,
):
    """Standard wiring for /voice-recheck: mocks convex query/mutation, the
    Sanity draft read, and run_llm_judge. Returns (query_calls,
    mutation_calls, judge_calls) recorder lists."""
    query_calls: list[tuple[str, dict]] = []
    mutation_calls: list[tuple[str, dict]] = []
    judge_calls: list[dict] = []

    async def mock_convex_query(http, path, args):
        query_calls.append((path, args))
        if path == "pipelineRuns:byRunId":
            return _run()
        if path == "qaCorrections:byRunId":
            return existing if existing is not None else []
        return None

    async def mock_convex_mutation(http, path, args):
        mutation_calls.append((path, args))
        return None

    async def mock_get_issue_draft(http, issue_id):
        return draft if draft is not None else _draft()

    async def mock_run_llm_judge(sections, *, run_id, narrator=None, rubric=None):
        judge_calls.append(
            {"sections": sections, "run_id": run_id, "narrator": narrator, "rubric": rubric}
        )
        result = findings if findings is not None else [_judge_finding()]
        return result, "anthropic/claude-opus-4-1"

    monkeypatch.setattr(f"{_V}._cc.convex_query", mock_convex_query)
    monkeypatch.setattr(f"{_V}._cc.convex_mutation", mock_convex_mutation)
    monkeypatch.setattr(f"{_V}.get_issue_draft", mock_get_issue_draft)
    monkeypatch.setattr(f"{_V}.run_llm_judge", mock_run_llm_judge)
    return query_calls, mutation_calls, judge_calls


# ── voice-recheck (§36.4) ───────────────────────────────────────────────────


def test_voice_recheck_writes_findings_with_qa_recheck_agent(monkeypatch):
    _q, mutation_calls, judge_calls = _wire_recheck(
        monkeypatch,
        findings=[_judge_finding(), _judge_finding(quotedSpan="delve into")],
    )

    response = _client.post("/issues/run-abc/voice-recheck")
    assert response.status_code == 200, response.text
    assert response.json() == {"runId": "run-abc", "findingCount": 2}

    inserts = [args for path, args in mutation_calls if path == "qaCorrections:insert"]
    assert len(inserts) == 2
    for args in inserts:
        assert args["agentId"] == "qa-recheck"
        assert args["accepted"] is False
        assert args["runId"] == "run-abc"

    # narrator=None per Research Pitfall 6 — always None for the on-demand path.
    assert judge_calls[0]["narrator"] is None
    # _draft_to_qa_sections flattening (§36.4 step 2).
    assert judge_calls[0]["sections"]["origin_story"] == "It delves into a tapestry of hope."
    assert judge_calls[0]["sections"]["game"] == "A game about hope."
    assert judge_calls[0]["sections"]["bonus"] == ""


def test_voice_recheck_supersedes_prior_open_qa_recheck_findings(monkeypatch):
    """Dedup (Research Pitfall 4): an OPEN prior qa-recheck row is dismissed
    BEFORE new findings are inserted."""
    _q, mutation_calls, _j = _wire_recheck(
        monkeypatch,
        existing=[
            {"_id": "fnd-old", "runId": "run-abc", "agentId": "qa-recheck", "resolution": None},
        ],
        findings=[_judge_finding()],
    )

    response = _client.post("/issues/run-abc/voice-recheck")
    assert response.status_code == 200, response.text

    supersede_calls = [
        args
        for path, args in mutation_calls
        if path == "qaCorrections:setResolution" and args.get("id") == "fnd-old"
    ]
    assert len(supersede_calls) == 1
    assert supersede_calls[0]["resolution"] == "dismissed"
    assert supersede_calls[0]["resolutionReason"] == "superseded by re-check"

    insert_index = next(
        i for i, (path, _args) in enumerate(mutation_calls) if path == "qaCorrections:insert"
    )
    supersede_index = next(
        i
        for i, (path, args) in enumerate(mutation_calls)
        if path == "qaCorrections:setResolution" and args.get("id") == "fnd-old"
    )
    assert supersede_index < insert_index


def test_voice_recheck_does_not_supersede_rule_layer_findings(monkeypatch):
    """Existing agentId='qa' (rule layer) findings are NEVER superseded here —
    they are stable/idempotent."""
    _q, mutation_calls, _j = _wire_recheck(
        monkeypatch,
        existing=[
            {"_id": "fnd-rule", "runId": "run-abc", "agentId": "qa", "resolution": None},
        ],
        findings=[],
    )

    response = _client.post("/issues/run-abc/voice-recheck")
    assert response.status_code == 200, response.text
    assert response.json()["findingCount"] == 0

    supersede_calls = [args for path, args in mutation_calls if path == "qaCorrections:setResolution"]
    assert supersede_calls == []


def test_voice_recheck_404_run_missing(monkeypatch):
    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return None
        return None

    monkeypatch.setattr(f"{_V}._cc.convex_query", mock_convex_query)

    response = _client.post("/issues/run-missing/voice-recheck")
    assert response.status_code == 404


def test_voice_recheck_409_no_sanity_issue(monkeypatch):
    async def mock_convex_query(http, path, args):
        if path == "pipelineRuns:byRunId":
            return {"status": "running", "sanityIssueId": None, "runId": "run-abc"}
        return None

    monkeypatch.setattr(f"{_V}._cc.convex_query", mock_convex_query)

    response = _client.post("/issues/run-abc/voice-recheck")
    assert response.status_code == 409


def test_voice_pass_router_registered_on_app():
    from eisenbalm_pipeline.api.main import app

    paths = {route.path for route in app.routes}
    assert "/issues/{run_id}/voice-recheck" in paths
