"""
Phase 31 (Plan 31-01) — Wave-0 pytest scaffold for the content-patch endpoint
family (EDT-01/02/03/05, docs/API_CONTRACTS.md §31).

This file exists in two parts:

1. A PASSING test for the Plan 31-01 `_emit_audit` before/after extension
   (D-09) — the only real code shipped in this plan.
2. Ten SKIPPED placeholder tests, named to match the endpoints/behaviors
   later Phase 31 plans (31-02 backend lib, 31-03 endpoints, 31-04/05
   frontend) will fill in with real assertions. Collecting them now (as
   skips, not absent) makes the eventual test count/diff for those plans
   legible.
"""
from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import eisenbalm_pipeline.lib.convex_client as _cc
from eisenbalm_pipeline.api.content import (
    _reset_touched_claims,
    _touched_block_indices,
)
from eisenbalm_pipeline.api.content import router as content_router
from eisenbalm_pipeline.api.control import _emit_audit
from eisenbalm_pipeline.lib.sanity_client import (
    get_issue_draft,
    patch_issue_field,
    upload_asset,
)

pytestmark = pytest.mark.anyio

# ── Endpoint-layer TestClient (mirrors test_review_endpoints.py) ───────────

_content_app = FastAPI()
_content_app.include_router(content_router)
_content_app.state.convex_http = MagicMock()
_content_app.state.sanity_http = MagicMock()
_content_app.state.graph = None
_content_app.state.background_tasks = set()

_content_client = TestClient(_content_app, raise_server_exceptions=True)

_C = "eisenbalm_pipeline.api.content"


# ── _emit_audit before/after extension (D-09) — REAL, PASSING ─────────────


async def test_emit_audit_forwards_before_after(monkeypatch):
    """_emit_audit(before=..., after=...) forwards both into the Convex
    mutation args dict."""
    captured: dict = {}

    async def _mock_convex_mutation(http, path, args):
        captured["path"] = path
        captured["args"] = args

    monkeypatch.setattr(_cc, "convex_mutation", _mock_convex_mutation)

    await _emit_audit(
        None,
        actor_id="a",
        action="content.section_patched",
        before="B",
        after="A",
    )

    assert captured["path"] == "auditLog:record"
    assert captured["args"]["before"] == "B"
    assert captured["args"]["after"] == "A"


async def test_emit_audit_omits_before_after_when_not_supplied(monkeypatch):
    """_emit_audit called without before/after omits both keys (back-compat
    with every existing caller in review.py / control.py / runs.py)."""
    captured: dict = {}

    async def _mock_convex_mutation(http, path, args):
        captured["args"] = args

    monkeypatch.setattr(_cc, "convex_mutation", _mock_convex_mutation)

    await _emit_audit(
        None,
        actor_id="a",
        action="run.triggered",
    )

    assert "before" not in captured["args"]
    assert "after" not in captured["args"]


# ── _emit_audit decision kwargs extension (§43.2, D-11) — REAL, PASSING ────


async def test_emit_audit_forwards_decision_kwargs(monkeypatch):
    """_emit_audit(reason=..., issue_number=..., run_id=..., instruction_version=...)
    forwards each into the Convex mutation args dict under its camelCase key
    — mirrors the existing before/after forwarding pattern (Phase 43 §43.2)."""
    captured: dict = {}

    async def _mock_convex_mutation(http, path, args):
        captured["path"] = path
        captured["args"] = args

    monkeypatch.setattr(_cc, "convex_mutation", _mock_convex_mutation)

    await _emit_audit(
        None,
        actor_id="a",
        action="claim_kept",
        reason="Editorial judgment: figure is intentionally atmospheric.",
        issue_number=42,
        run_id="run-abc",
        instruction_version="v3",
    )

    assert captured["path"] == "auditLog:record"
    assert captured["args"]["reason"] == "Editorial judgment: figure is intentionally atmospheric."
    assert captured["args"]["issueNumber"] == 42
    assert captured["args"]["runId"] == "run-abc"
    assert captured["args"]["instructionVersion"] == "v3"


async def test_emit_audit_omits_decision_kwargs_when_not_supplied(monkeypatch):
    """_emit_audit called without the new decision kwargs omits all four keys
    (back-compat with every existing caller across control.py / content.py /
    review.py / factcheck.py / findings.py / signoffs.py / voice_pass.py)."""
    captured: dict = {}

    async def _mock_convex_mutation(http, path, args):
        captured["args"] = args

    monkeypatch.setattr(_cc, "convex_mutation", _mock_convex_mutation)

    await _emit_audit(
        None,
        actor_id="a",
        action="run.triggered",
    )

    assert "reason" not in captured["args"]
    assert "issueNumber" not in captured["args"]
    assert "runId" not in captured["args"]
    assert "instructionVersion" not in captured["args"]


# ── _touched_block_indices + _reset_touched_claims (FCT-07, D-19/D-20) ─────


def test_touched_block_indices_same_length_diff():
    """Same-length edit that changes only block 1's text returns {1}."""
    before = [
        {"type": "paragraph", "text": "A"},
        {"type": "paragraph", "text": "B"},
        {"type": "paragraph", "text": "C"},
    ]
    after = [
        {"type": "paragraph", "text": "A"},
        {"type": "paragraph", "text": "B2"},
        {"type": "paragraph", "text": "C"},
    ]
    assert _touched_block_indices(before, after) == {1}


def test_touched_block_indices_no_change_returns_empty_set():
    """Identical before/after (same length) returns an empty set, not None."""
    before = [{"type": "paragraph", "text": "A"}]
    after = [{"type": "paragraph", "text": "A"}]
    assert _touched_block_indices(before, after) == set()


def test_touched_block_indices_length_changed_returns_none():
    """An insert/delete (length changed) returns None — 'whole section
    touched' — rather than attempting unreliable positional diffing."""
    before = [{"type": "paragraph", "text": "A"}]
    after = [
        {"type": "paragraph", "text": "A"},
        {"type": "paragraph", "text": "B"},
    ]
    assert _touched_block_indices(before, after) is None


async def test_reset_touched_claims_precise_reset(monkeypatch: pytest.MonkeyPatch):
    """A same-length edit touching only block 1 resets the claim anchored to
    block 1 AND any null-anchor claim in the same section, but NOT the claim
    anchored to block 0, and NOT claims in other sections."""
    rows = [
        {"sectionName": "originStory", "blockIndexHint": 0, "claimIndex": 0},
        {"sectionName": "originStory", "blockIndexHint": 1, "claimIndex": 1},
        {"sectionName": "originStory", "blockIndexHint": None, "claimIndex": 2},
        {"sectionName": "caseStudy", "blockIndexHint": 1, "claimIndex": 3},
    ]

    async def mock_convex_query(http, path, args):
        assert path == "claimChecks:listByRunId"
        assert args == {"runId": "run-abc"}
        return rows

    changed_calls: list[dict] = []

    async def mock_convex_mutation(http, path, args):
        assert path == "claimChecks:markChanged"
        changed_calls.append(args)

    monkeypatch.setattr(f"{_C}._cc.convex_query", mock_convex_query)
    monkeypatch.setattr(f"{_C}._cc.convex_mutation", mock_convex_mutation)

    await _reset_touched_claims(
        None, run_id="run-abc", section_name="originStory", touched={1}
    )

    assert [c["claimIndex"] for c in changed_calls] == [1, 2]


async def test_reset_touched_claims_whole_section_on_length_drift(
    monkeypatch: pytest.MonkeyPatch,
):
    """touched=None (a length-changed edit) resets EVERY claim in the section
    regardless of blockIndexHint; claims in other sections stay untouched."""
    rows = [
        {"sectionName": "originStory", "blockIndexHint": 0, "claimIndex": 0},
        {"sectionName": "originStory", "blockIndexHint": 1, "claimIndex": 1},
        {"sectionName": "caseStudy", "blockIndexHint": 0, "claimIndex": 2},
    ]

    async def mock_convex_query(http, path, args):
        return rows

    changed_calls: list[dict] = []

    async def mock_convex_mutation(http, path, args):
        changed_calls.append(args)

    monkeypatch.setattr(f"{_C}._cc.convex_query", mock_convex_query)
    monkeypatch.setattr(f"{_C}._cc.convex_mutation", mock_convex_mutation)

    await _reset_touched_claims(
        None, run_id="run-abc", section_name="originStory", touched=None
    )

    assert [c["claimIndex"] for c in changed_calls] == [0, 1]


async def test_reset_touched_claims_fails_open_on_convex_error(
    monkeypatch: pytest.MonkeyPatch,
):
    """A Convex hiccup during the reset must not raise — it mirrors
    _revoke_active_signoffs's fail-open, non-blocking behavior so a claim
    reset failure never blocks the operator's content save."""

    async def mock_convex_query(http, path, args):
        raise RuntimeError("convex is down")

    monkeypatch.setattr(f"{_C}._cc.convex_query", mock_convex_query)

    await _reset_touched_claims(
        None, run_id="run-abc", section_name="originStory", touched={0}
    )  # must not raise


# ── Wave 2/3 placeholders — SKIPPED (filled in by Plan 31-02/03) ───────────


def _set_sanity_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SANITY_API_TOKEN", "test-token")
    monkeypatch.setenv("NEXT_PUBLIC_SANITY_DATASET", "production")


def _mock_http(handler) -> httpx.AsyncClient:
    """Build an httpx.AsyncClient wired to a MockTransport handler."""
    return httpx.AsyncClient(
        base_url="https://test.api.sanity.io",
        transport=httpx.MockTransport(handler),
    )


async def test_patch_section_scoped(monkeypatch: pytest.MonkeyPatch):
    """patch_issue_field() posts a mutation whose patch object has
    id=="issue-42" (NO drafts. prefix), ifRevisionID=="rev-1", and
    set=={"originStory.body": <blocks>} — nothing else in set."""
    _set_sanity_env(monkeypatch)
    captured: dict[str, Any] = {}
    blocks = [
        {
            "_type": "block",
            "_key": "block-aaa",
            "style": "normal",
            "markDefs": [],
            "children": [
                {"_type": "span", "_key": "span-aaa", "text": "hi", "marks": []}
            ],
        }
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path.endswith("/data/mutate/production"):
            captured["mutate_body"] = json.loads(request.content.decode())
            return httpx.Response(200, json={"transactionId": "tx-1", "results": []})
        if path.endswith("/data/query/production"):
            return httpx.Response(200, json={"result": {"_rev": "rev-2"}})
        return httpx.Response(404)

    async with _mock_http(handler) as http:
        new_rev = await patch_issue_field(
            http,
            issue_id="issue-42",
            field_path="originStory.body",
            value=blocks,
            if_revision_id="rev-1",
        )

    patch = captured["mutate_body"]["mutations"][0]["patch"]
    assert patch["id"] == "issue-42"
    assert not patch["id"].startswith("drafts.")
    assert patch["ifRevisionID"] == "rev-1"
    assert patch["set"] == {"originStory.body": blocks}
    assert len(patch["set"]) == 1
    assert new_rev == "rev-2"


async def test_patch_revision_mismatch(monkeypatch: pytest.MonkeyPatch):
    """A stale ifRevisionID → Sanity 409 → patch_issue_field re-raises 409
    {reason: "revision_mismatch"}."""
    _set_sanity_env(monkeypatch)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            409, json={"error": {"description": "revision mismatch"}}
        )

    async with _mock_http(handler) as http:
        with pytest.raises(HTTPException) as exc_info:
            await patch_issue_field(
                http,
                issue_id="issue-42",
                field_path="originStory.body",
                value=[],
                if_revision_id="stale-rev",
            )

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail["reason"] == "revision_mismatch"


def _valid_theme_body(**overrides) -> dict:
    body = {
        "ifRevisionID": "rev-1",
        "primaryColor": "#111111",
        "accentColor": "#222222",
        "backgroundColor": "#333333",
        "textColor": "#444444",
        "fontDisplay": "Lora",
        "fontBody": "Inter",
        "visualDirection": "warm and quiet",
    }
    body.update(overrides)
    return body


def _empty_draft(**overrides) -> dict:
    draft = {
        "revisionId": "rev-1",
        "sections": {},
        "theme": {},
        "game": {},
        "bonus": {},
        "podcast": {},
        "bonusType": None,
        "conversation": [],
    }
    draft.update(overrides)
    return draft


async def test_theme_patch_validation(monkeypatch: pytest.MonkeyPatch):
    """PATCH /issues/{run_id}/theme HARD-blocks invalid hex / non-whitelisted
    fonts with 4xx {reason: "validation_failed", fields: [...]}; a valid
    theme (hex + whitelisted font) returns 200."""
    # Invalid hex — no network calls should even be needed to reject this.
    bad_hex = _content_client.patch(
        "/issues/run-abc/theme", json=_valid_theme_body(primaryColor="red")
    )
    assert bad_hex.status_code == 422
    detail = bad_hex.json()["detail"]
    assert detail["reason"] == "validation_failed"
    assert "primaryColor" in detail["fields"]

    # Non-whitelisted font.
    bad_font = _content_client.patch(
        "/issues/run-abc/theme", json=_valid_theme_body(fontDisplay="Spectral")
    )
    assert bad_font.status_code == 422
    assert bad_font.json()["detail"]["fields"] == ["fontDisplay"]

    # Valid theme -> 200, patches + audits.
    async def mock_convex_query(http, path, args):
        return {"sanityIssueId": "issue-42"}

    async def mock_get_issue_draft(http, issue_id):
        return _empty_draft()

    async def mock_patch_issue_field(http, *, issue_id, field_path, value, if_revision_id):
        assert field_path == "theme"
        return "rev-2"

    audit_calls: list[dict] = []

    async def mock_emit_audit(http, **kwargs):
        audit_calls.append(kwargs)

    monkeypatch.setattr(f"{_C}._cc.convex_query", mock_convex_query)
    monkeypatch.setattr(f"{_C}.get_issue_draft", mock_get_issue_draft)
    monkeypatch.setattr(f"{_C}.patch_issue_field", mock_patch_issue_field)
    monkeypatch.setattr(f"{_C}._emit_audit", mock_emit_audit)

    ok = _content_client.patch("/issues/run-abc/theme", json=_valid_theme_body())
    assert ok.status_code == 200, ok.text
    assert ok.json() == {"revisionId": "rev-2"}
    assert audit_calls[0]["action"] == "content.theme_patched"


async def test_theme_patch_revokes_signoffs(monkeypatch: pytest.MonkeyPatch):
    """Phase 34 (D-08): a successful content patch calls signOffs:revokeAll
    for the run — content mutations auto-void both sign-off kinds."""

    async def mock_convex_query(http, path, args):
        return {"sanityIssueId": "issue-42"}

    async def mock_get_issue_draft(http, issue_id):
        return _empty_draft()

    async def mock_patch_issue_field(http, *, issue_id, field_path, value, if_revision_id):
        return "rev-2"

    mutation_calls: list[dict] = []

    async def mock_convex_mutation(http, path, args):
        mutation_calls.append({"path": path, "args": args})

    monkeypatch.setattr(f"{_C}._cc.convex_query", mock_convex_query)
    monkeypatch.setattr(f"{_C}.get_issue_draft", mock_get_issue_draft)
    monkeypatch.setattr(f"{_C}.patch_issue_field", mock_patch_issue_field)
    monkeypatch.setattr(f"{_C}._cc.convex_mutation", mock_convex_mutation)

    ok = _content_client.patch("/issues/run-abc/theme", json=_valid_theme_body())
    assert ok.status_code == 200, ok.text

    revoke_calls = [c for c in mutation_calls if c["path"] == "signOffs:revokeAll"]
    assert len(revoke_calls) == 1
    assert revoke_calls[0]["args"]["runId"] == "run-abc"

    audit_calls = [c for c in mutation_calls if c["path"] == "auditLog:record"]
    assert len(audit_calls) == 1
    assert audit_calls[0]["args"]["action"] == "content.theme_patched"


def _mock_convex_query_by_path(**by_path):
    """Path-routed convex_query mock: returns by_path[path] if present, else
    falls back to {"sanityIssueId": "issue-42"} (the _resolve_sanity_id
    lookup every content-patch test needs)."""

    async def mock(http, path, args):
        if path in by_path:
            return by_path[path]
        return {"sanityIssueId": "issue-42"}

    return mock


async def test_structural_floor_warns_not_blocks(monkeypatch: pytest.MonkeyPatch):
    """A long-read section-body patch with 0 h2/blockquote returns 200 with
    a non-empty warnings list — it never 4xxs (D-08)."""

    async def mock_get_issue_draft(http, issue_id):
        return _empty_draft(
            sections={"originStory": {"headline": "Old", "blocks": [], "lossy": False}}
        )

    async def mock_patch_issue_field(http, *, issue_id, field_path, value, if_revision_id):
        assert field_path == "originStory.body"
        return "rev-2"

    async def mock_emit_audit(http, **kwargs):
        pass

    monkeypatch.setattr(
        f"{_C}._cc.convex_query",
        _mock_convex_query_by_path(**{"claimChecks:listByRunId": []}),
    )
    monkeypatch.setattr(f"{_C}.get_issue_draft", mock_get_issue_draft)
    monkeypatch.setattr(f"{_C}.patch_issue_field", mock_patch_issue_field)
    monkeypatch.setattr(f"{_C}._emit_audit", mock_emit_audit)

    response = _content_client.patch(
        "/issues/run-abc/sections/originStory",
        json={
            "ifRevisionID": "rev-1",
            "blocks": [{"type": "paragraph", "text": "Just prose, no headers or quotes."}],
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["revisionId"] == "rev-2"
    assert len(data["warnings"]) == 2  # 0/2 sub-headers + 0/1 blockquote


async def test_patch_section_resets_only_touched_block_claims(
    monkeypatch: pytest.MonkeyPatch,
):
    """FCT-07/D-19: a same-length section-body patch that only changes block
    1's text calls claimChecks:markChanged for the claim anchored to block 1
    (and any null-anchor claim in the section), but NOT for block 0's claim."""

    async def mock_get_issue_draft(http, issue_id):
        return _empty_draft(
            sections={
                "originStory": {
                    "headline": "Old",
                    "blocks": [
                        {"type": "paragraph", "text": "Block zero."},
                        {"type": "paragraph", "text": "Block one, original."},
                    ],
                    "lossy": False,
                }
            }
        )

    async def mock_patch_issue_field(http, *, issue_id, field_path, value, if_revision_id):
        return "rev-2"

    async def mock_emit_audit(http, **kwargs):
        pass

    claim_rows = [
        {"sectionName": "originStory", "blockIndexHint": 0, "claimIndex": 0},
        {"sectionName": "originStory", "blockIndexHint": 1, "claimIndex": 1},
        {"sectionName": "caseStudy", "blockIndexHint": 1, "claimIndex": 2},
    ]

    monkeypatch.setattr(
        f"{_C}._cc.convex_query",
        _mock_convex_query_by_path(**{"claimChecks:listByRunId": claim_rows}),
    )
    monkeypatch.setattr(f"{_C}.get_issue_draft", mock_get_issue_draft)
    monkeypatch.setattr(f"{_C}.patch_issue_field", mock_patch_issue_field)
    monkeypatch.setattr(f"{_C}._emit_audit", mock_emit_audit)

    changed_calls: list[dict] = []

    async def mock_convex_mutation(http, path, args):
        if path == "claimChecks:markChanged":
            changed_calls.append(args)

    monkeypatch.setattr(f"{_C}._cc.convex_mutation", mock_convex_mutation)

    response = _content_client.patch(
        "/issues/run-abc/sections/originStory",
        json={
            "ifRevisionID": "rev-1",
            "blocks": [
                {"type": "paragraph", "text": "Block zero."},
                {"type": "paragraph", "text": "Block one, REVISED."},
            ],
        },
    )
    assert response.status_code == 200, response.text
    assert [c["claimIndex"] for c in changed_calls] == [1]


def _make_asset_handler(captured: dict, *, asset_id: str = "image-abc"):
    """Mock handler that answers assets/images POST, mutate POST, and
    query POST for upload_asset()'s three-call sequence."""

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if "/assets/" in path:
            captured.setdefault("asset_calls", []).append(path)
            return httpx.Response(
                200,
                json={
                    "document": {
                        "_id": asset_id,
                        "url": f"https://cdn.sanity.io/images/proj/production/{asset_id}.png",
                    }
                },
            )
        if path.endswith("/data/mutate/production"):
            captured["mutate_body"] = json.loads(request.content.decode())
            return httpx.Response(200, json={"transactionId": "tx-1", "results": []})
        if path.endswith("/data/query/production"):
            return httpx.Response(200, json={"result": {"_rev": "rev-2"}})
        return httpx.Response(404)

    return handler


async def test_upload_asset_patches_reference(monkeypatch: pytest.MonkeyPatch):
    """upload_asset() POSTs bytes to /assets/images/{dataset} for
    asset_kind="image", then patch_issue_field writes
    {_type:'image', asset:{_type:'reference',_ref:<assetId>}} onto the slot
    field; returns {assetUrl, assetId, revisionId}. asset_kind="file" hits
    /assets/files/{dataset}."""
    _set_sanity_env(monkeypatch)
    captured: dict[str, Any] = {}

    async with _mock_http(_make_asset_handler(captured)) as http:
        result = await upload_asset(
            http,
            issue_id="issue-42",
            field_path="game.storyboard",
            file_bytes=b"fake-png-bytes",
            filename="storyboard.png",
            content_type="image/png",
            asset_kind="image",
            if_revision_id="rev-1",
        )

    assert captured["asset_calls"][0].endswith("/assets/images/production")
    assert result == {
        "assetUrl": "https://cdn.sanity.io/images/proj/production/image-abc.png",
        "assetId": "image-abc",
        "revisionId": "rev-2",
    }
    patch = captured["mutate_body"]["mutations"][0]["patch"]
    assert patch["id"] == "issue-42"
    assert patch["ifRevisionID"] == "rev-1"
    assert patch["set"]["game.storyboard"] == {
        "_type": "image",
        "asset": {"_type": "reference", "_ref": "image-abc"},
    }

    # asset_kind="file" targets /assets/files/{dataset} with _type='file'
    captured2: dict[str, Any] = {}
    async with _mock_http(
        _make_asset_handler(captured2, asset_id="file-xyz")
    ) as http:
        result2 = await upload_asset(
            http,
            issue_id="issue-42",
            field_path="bonus.storyboard0",
            file_bytes=b"fake-audio-bytes",
            filename="jingle.mp3",
            content_type="audio/mpeg",
            asset_kind="file",
            if_revision_id="rev-1",
        )
    assert captured2["asset_calls"][0].endswith("/assets/files/production")
    assert result2["assetId"] == "file-xyz"
    patch2 = captured2["mutate_body"]["mutations"][0]["patch"]
    assert patch2["set"]["bonus.storyboard0"]["_type"] == "file"


async def test_audit_row_truncated_snapshot(monkeypatch: pytest.MonkeyPatch):
    """A before/after snapshot longer than 2000 chars is truncated with the
    "...[truncated]" suffix before being written to auditLog:record."""
    long_before = "B" * 3000
    long_after = "A" * 3000

    async def mock_convex_query(http, path, args):
        return {"sanityIssueId": "issue-42"}

    async def mock_get_issue_draft(http, issue_id):
        return _empty_draft(
            sections={"originStory": {"headline": long_before, "blocks": [], "lossy": False}}
        )

    async def mock_patch_issue_field(http, *, issue_id, field_path, value, if_revision_id):
        return "rev-2"

    captured: dict = {}

    async def mock_emit_audit(http, **kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(f"{_C}._cc.convex_query", mock_convex_query)
    monkeypatch.setattr(f"{_C}.get_issue_draft", mock_get_issue_draft)
    monkeypatch.setattr(f"{_C}.patch_issue_field", mock_patch_issue_field)
    monkeypatch.setattr(f"{_C}._emit_audit", mock_emit_audit)

    response = _content_client.patch(
        "/issues/run-abc/headlines/originStory",
        json={"ifRevisionID": "rev-1", "headline": long_after},
    )
    assert response.status_code == 200, response.text
    assert captured["action"] == "content.headline_patched"
    assert captured["before"].endswith("...[truncated]")
    assert captured["after"].endswith("...[truncated]")
    assert len(captured["before"]) == 2000 + len("...[truncated]")
    assert len(captured["after"]) == 2000 + len("...[truncated]")


async def test_asset_overwrite_audit_swap(monkeypatch: pytest.MonkeyPatch):
    """A second upload_asset() over the same slot returns a new assetId
    without error — overwrite semantics (old asset left in Sanity). The
    audit-log swap ROW is asserted at the endpoint layer in Plan 31-03; here
    we just assert the helper succeeds twice."""
    _set_sanity_env(monkeypatch)

    captured1: dict[str, Any] = {}
    async with _mock_http(
        _make_asset_handler(captured1, asset_id="image-first")
    ) as http:
        first = await upload_asset(
            http,
            issue_id="issue-42",
            field_path="game.storyboard",
            file_bytes=b"first-bytes",
            filename="storyboard.png",
            content_type="image/png",
            asset_kind="image",
            if_revision_id="rev-1",
        )

    captured2: dict[str, Any] = {}
    async with _mock_http(
        _make_asset_handler(captured2, asset_id="image-second")
    ) as http:
        second = await upload_asset(
            http,
            issue_id="issue-42",
            field_path="game.storyboard",
            file_bytes=b"second-bytes",
            filename="storyboard.png",
            content_type="image/png",
            asset_kind="image",
            if_revision_id="rev-2",
        )

    assert first["assetId"] == "image-first"
    assert second["assetId"] == "image-second"
    assert first["assetId"] != second["assetId"]


async def test_asset_overwrite_audit_swap_records_audit(monkeypatch: pytest.MonkeyPatch):
    """An asset-slot overwrite (endpoint layer) emits an audit row with
    action="content.asset_uploaded" carrying before(old assetId)/after(new
    assetId). Distinct from the helper-level test_asset_overwrite_audit_swap
    above (Plan 31-02, un-skipped there)."""

    async def mock_convex_query(http, path, args):
        return {"sanityIssueId": "issue-42"}

    async def mock_get_issue_draft(http, issue_id):
        return _empty_draft(
            bonusType="bigBudget",
            bonus={"storyboards": [{"_key": "sb-0", "asset": {"_ref": "image-old"}}]},
        )

    async def mock_upload_asset(
        http, *, issue_id, field_path, file_bytes, filename, content_type, asset_kind, if_revision_id
    ):
        assert field_path == "bonus.storyboards[0]"
        assert asset_kind == "image"
        return {
            "assetUrl": "https://cdn.sanity.io/images/proj/production/image-new.png",
            "assetId": "image-new",
            "revisionId": "rev-2",
        }

    captured: dict = {}

    async def mock_emit_audit(http, **kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(f"{_C}._cc.convex_query", mock_convex_query)
    monkeypatch.setattr(f"{_C}.get_issue_draft", mock_get_issue_draft)
    monkeypatch.setattr(f"{_C}.upload_asset", mock_upload_asset)
    monkeypatch.setattr(f"{_C}._emit_audit", mock_emit_audit)

    response = _content_client.post(
        "/issues/run-abc/assets/storyboard-0",
        headers={
            "X-Filename": "sb.png",
            "Content-Type": "image/png",
            "X-If-Revision-Id": "rev-1",
        },
        content=b"raw-bytes",
    )
    assert response.status_code == 200, response.text
    assert response.json()["assetId"] == "image-new"
    assert captured["action"] == "content.asset_uploaded"
    assert captured["before"] == "image-old"
    assert captured["after"] == "image-new"


async def test_suno_audio_sets_url_string(monkeypatch: pytest.MonkeyPatch):
    """The suno-audio slot patches a plain string URL (not an asset-reference
    dict) onto bonus.sunoAudioUrl (§31.6 exception)."""

    async def mock_convex_query(http, path, args):
        return {"sanityIssueId": "issue-42"}

    async def mock_get_issue_draft(http, issue_id):
        return _empty_draft(bonusType="jingle", bonus={"sunoAudioUrl": ""})

    patched: dict = {}

    async def mock_patch_issue_field(http, *, issue_id, field_path, value, if_revision_id):
        patched["field_path"] = field_path
        patched["value"] = value
        return "rev-2"

    class _FakeUploadResponse:
        status_code = 200

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {
                "document": {
                    "_id": "file-abc",
                    "url": "https://cdn.sanity.io/files/proj/production/file-abc.mp3",
                }
            }

    async def mock_post(url, **kwargs):
        assert url.endswith("/assets/files/production")
        return _FakeUploadResponse()

    async def mock_emit_audit(http, **kwargs):
        pass

    monkeypatch.setenv("SANITY_API_TOKEN", "test-token")
    monkeypatch.setenv("NEXT_PUBLIC_SANITY_DATASET", "production")
    monkeypatch.setattr(f"{_C}._cc.convex_query", mock_convex_query)
    monkeypatch.setattr(f"{_C}.get_issue_draft", mock_get_issue_draft)
    monkeypatch.setattr(f"{_C}.patch_issue_field", mock_patch_issue_field)
    monkeypatch.setattr(f"{_C}._emit_audit", mock_emit_audit)
    monkeypatch.setattr(_content_app.state.sanity_http, "post", AsyncMock(side_effect=mock_post))

    response = _content_client.post(
        "/issues/run-abc/assets/suno-audio",
        headers={
            "X-Filename": "audio.mp3",
            "Content-Type": "audio/mpeg",
            "X-If-Revision-Id": "rev-1",
        },
        content=b"raw-audio-bytes",
    )
    assert response.status_code == 200, response.text
    assert patched["field_path"] == "bonus.sunoAudioUrl"
    assert patched["value"] == "https://cdn.sanity.io/files/proj/production/file-abc.mp3"
    assert isinstance(patched["value"], str)
    assert response.json()["assetUrl"] == patched["value"]


async def test_storyboard_slot_field_path(monkeypatch: pytest.MonkeyPatch):
    """A storyboard-{i} slot resolves to positional field path
    bonus.storyboards[{i}] passed through to upload_asset() (RESEARCH Open
    Question 3 — verifies the exact set path the endpoint emits)."""

    async def mock_convex_query(http, path, args):
        return {"sanityIssueId": "issue-42"}

    async def mock_get_issue_draft(http, issue_id):
        return _empty_draft(bonusType="bigBudget", bonus={"storyboards": []})

    captured: dict = {}

    async def mock_upload_asset(
        http, *, issue_id, field_path, file_bytes, filename, content_type, asset_kind, if_revision_id
    ):
        captured["field_path"] = field_path
        captured["asset_kind"] = asset_kind
        return {
            "assetUrl": "https://cdn.sanity.io/images/proj/production/sb.png",
            "assetId": "image-sb",
            "revisionId": "rev-2",
        }

    async def mock_emit_audit(http, **kwargs):
        pass

    monkeypatch.setattr(f"{_C}._cc.convex_query", mock_convex_query)
    monkeypatch.setattr(f"{_C}.get_issue_draft", mock_get_issue_draft)
    monkeypatch.setattr(f"{_C}.upload_asset", mock_upload_asset)
    monkeypatch.setattr(f"{_C}._emit_audit", mock_emit_audit)

    response = _content_client.post(
        "/issues/run-abc/assets/storyboard-2",
        headers={
            "X-Filename": "sb.png",
            "Content-Type": "image/png",
            "X-If-Revision-Id": "rev-1",
        },
        content=b"bytes",
    )
    assert response.status_code == 200, response.text
    assert captured["field_path"] == "bonus.storyboards[2]"
    assert captured["asset_kind"] == "image"


async def test_upload_asset_unknown_slot_400(monkeypatch: pytest.MonkeyPatch):
    """An unrecognized slot name is rejected with 400 before any network
    calls are attempted."""
    response = _content_client.post(
        "/issues/run-abc/assets/not-a-real-slot",
        headers={"X-Filename": "x.png", "Content-Type": "image/png"},
        content=b"bytes",
    )
    assert response.status_code == 400
    assert response.json()["detail"]["reason"] == "invalid_slot"


async def test_get_draft_endpoint_returns_get_issue_draft_result(
    monkeypatch: pytest.MonkeyPatch,
):
    """GET /issues/{run_id}/draft returns get_issue_draft()'s dict verbatim
    (revisionId + sections + lossy) with no audit row written."""

    async def mock_convex_query(http, path, args):
        return {"sanityIssueId": "issue-42"}

    expected = _empty_draft(revisionId="rev-9")

    async def mock_get_issue_draft(http, issue_id):
        assert issue_id == "issue-42"
        return expected

    monkeypatch.setattr(f"{_C}._cc.convex_query", mock_convex_query)
    monkeypatch.setattr(f"{_C}.get_issue_draft", mock_get_issue_draft)

    response = _content_client.get("/issues/run-abc/draft")
    assert response.status_code == 200, response.text
    assert response.json() == expected


async def test_bonus_patch_variant_shaped(monkeypatch: pytest.MonkeyPatch):
    """PATCH /issues/{run_id}/bonus accepts a payload shaped by bonusType —
    variant mismatch -> 409 {reason:'wrong_bonus_variant'}; specAd -> bonus.body
    via compose_section_body; jingle -> bonus.lyrics + bonus.sunoPrompt."""

    async def mock_get_issue_draft_specad(http, issue_id):
        return _empty_draft(bonusType="specAd", bonus={"headline": "H"})

    captured_fields: dict = {}

    async def mock_patch_fields(http, *, issue_id, fields, if_revision_id):
        captured_fields.clear()
        captured_fields.update(fields)
        return "rev-2"

    async def mock_emit_audit(http, **kwargs):
        pass

    monkeypatch.setattr(
        f"{_C}._cc.convex_query",
        _mock_convex_query_by_path(**{"claimChecks:listByRunId": []}),
    )
    monkeypatch.setattr(f"{_C}.get_issue_draft", mock_get_issue_draft_specad)
    monkeypatch.setattr(f"{_C}._patch_fields", mock_patch_fields)
    monkeypatch.setattr(f"{_C}._emit_audit", mock_emit_audit)

    # Wrong variant against a specAd-typed issue -> 409.
    wrong = _content_client.patch(
        "/issues/run-abc/bonus",
        json={
            "ifRevisionID": "rev-1",
            "variant": "jingle",
            "headline": "H",
            "body": "B",
            "lyrics": "L",
            "sunoPrompt": "S",
        },
    )
    assert wrong.status_code == 409
    assert wrong.json()["detail"]["reason"] == "wrong_bonus_variant"

    # Correct (specAd) variant -> patches bonus.body via compose_section_body.
    ok = _content_client.patch(
        "/issues/run-abc/bonus",
        json={
            "ifRevisionID": "rev-1",
            "variant": "specAd",
            "blocks": [
                {"type": "h2", "text": "Header"},
                {"type": "blockquote", "text": "Quote"},
            ],
        },
    )
    assert ok.status_code == 200, ok.text
    assert "bonus.body" in captured_fields
    assert captured_fields["bonus.body"][0]["style"] == "h2"
    assert "bonus.lyrics" not in captured_fields

    # jingle against a jingle-typed issue -> lyrics + sunoPrompt patched.
    async def mock_get_issue_draft_jingle(http, issue_id):
        return _empty_draft(bonusType="jingle", bonus={})

    monkeypatch.setattr(f"{_C}.get_issue_draft", mock_get_issue_draft_jingle)

    jingle_ok = _content_client.patch(
        "/issues/run-abc/bonus",
        json={
            "ifRevisionID": "rev-1",
            "variant": "jingle",
            "headline": "H",
            "body": "B",
            "lyrics": "La la la",
            "sunoPrompt": "Upbeat",
        },
    )
    assert jingle_ok.status_code == 200, jingle_ok.text
    assert captured_fields["bonus.lyrics"] == "La la la"
    assert captured_fields["bonus.sunoPrompt"] == "Upbeat"


async def test_patch_bonus_specad_resets_only_touched_block_claims(
    monkeypatch: pytest.MonkeyPatch,
):
    """FCT-07/D-19: patch_bonus's specAd branch reads the before-state block
    array under the "body" key (NOT "blocks") — a same-length edit touching
    only block 1 resets only the claim anchored to block 1."""

    async def mock_get_issue_draft_specad(http, issue_id):
        return _empty_draft(
            bonusType="specAd",
            bonus={
                "headline": "H",
                "body": [
                    {"type": "paragraph", "text": "Bonus block zero."},
                    {"type": "paragraph", "text": "Bonus block one, original."},
                ],
            },
        )

    async def mock_patch_fields(http, *, issue_id, fields, if_revision_id):
        return "rev-2"

    async def mock_emit_audit(http, **kwargs):
        pass

    claim_rows = [
        {"sectionName": "bonus", "blockIndexHint": 0, "claimIndex": 0},
        {"sectionName": "bonus", "blockIndexHint": 1, "claimIndex": 1},
    ]

    monkeypatch.setattr(
        f"{_C}._cc.convex_query",
        _mock_convex_query_by_path(**{"claimChecks:listByRunId": claim_rows}),
    )
    monkeypatch.setattr(f"{_C}.get_issue_draft", mock_get_issue_draft_specad)
    monkeypatch.setattr(f"{_C}._patch_fields", mock_patch_fields)
    monkeypatch.setattr(f"{_C}._emit_audit", mock_emit_audit)

    changed_calls: list[dict] = []

    async def mock_convex_mutation(http, path, args):
        if path == "claimChecks:markChanged":
            changed_calls.append(args)

    monkeypatch.setattr(f"{_C}._cc.convex_mutation", mock_convex_mutation)

    response = _content_client.patch(
        "/issues/run-abc/bonus",
        json={
            "ifRevisionID": "rev-1",
            "variant": "specAd",
            "blocks": [
                {"type": "paragraph", "text": "Bonus block zero."},
                {"type": "paragraph", "text": "Bonus block one, REVISED."},
            ],
        },
    )
    assert response.status_code == 200, response.text
    assert [c["claimIndex"] for c in changed_calls] == [1]


async def test_patch_bonus_bigbudget_never_resets_claims(
    monkeypatch: pytest.MonkeyPatch,
):
    """FCT-07/D-19: the bigBudget/jingle branches of patch_bonus never call
    _reset_touched_claims — bonus.body is a plain string for those variants
    (exempt per §35.3 D-06), so zero markChanged calls happen even though
    claim_checks rows exist for the bonus section."""

    async def mock_get_issue_draft_bigbudget(http, issue_id):
        return _empty_draft(
            bonusType="bigBudget",
            bonus={"headline": "H", "body": "Old plain-string body."},
        )

    async def mock_patch_fields(http, *, issue_id, fields, if_revision_id):
        return "rev-2"

    async def mock_emit_audit(http, **kwargs):
        pass

    claim_rows = [
        {"sectionName": "bonus", "blockIndexHint": 0, "claimIndex": 0},
    ]

    mutation_calls: list[dict] = []

    async def mock_convex_mutation(http, path, args):
        mutation_calls.append({"path": path, "args": args})

    monkeypatch.setattr(
        f"{_C}._cc.convex_query",
        _mock_convex_query_by_path(**{"claimChecks:listByRunId": claim_rows}),
    )
    monkeypatch.setattr(f"{_C}.get_issue_draft", mock_get_issue_draft_bigbudget)
    monkeypatch.setattr(f"{_C}._patch_fields", mock_patch_fields)
    monkeypatch.setattr(f"{_C}._emit_audit", mock_emit_audit)
    monkeypatch.setattr(f"{_C}._cc.convex_mutation", mock_convex_mutation)

    response = _content_client.patch(
        "/issues/run-abc/bonus",
        json={
            "ifRevisionID": "rev-1",
            "variant": "bigBudget",
            "headline": "H",
            "body": "New plain-string body.",
        },
    )
    assert response.status_code == 200, response.text
    assert [c for c in mutation_calls if c["path"] == "claimChecks:markChanged"] == []


def _pt_block(style: str, text: str, *, mark_defs=None, extra_children=None) -> dict:
    children = [
        {"_type": "span", "_key": "span-0", "text": text, "marks": []}
    ]
    if extra_children:
        children.extend(extra_children)
    return {
        "_type": "block",
        "_key": f"block-{style}",
        "style": style,
        "markDefs": mark_defs or [],
        "children": children,
    }


async def test_draft_read_lossy_flag(monkeypatch: pytest.MonkeyPatch):
    """get_issue_draft returns a dict with revisionId and
    sections[<name>] = {headline, blocks, lossy}; a section whose stored PT
    block had markDefs sets that section's lossy=True; row types round-trip
    (h2/blockquote/paragraph)."""
    _set_sanity_env(monkeypatch)

    origin_body = [
        _pt_block("h2", "A Sub-Header"),
        _pt_block("normal", "Plain paragraph."),
        _pt_block("blockquote", "A pull quote."),
    ]
    # problemStatement's stored block has a markDef (a link) -> lossy=True
    problem_body = [
        _pt_block("normal", "Linked text.", mark_defs=[{"_key": "m1", "_type": "link"}]),
    ]

    doc = {
        "_rev": "rev-9",
        "theme": {"primaryColor": "#111111"},
        "game": {"headline": "Play"},
        "bonus": {"headline": "Bonus"},
        "bonusType": "specAd",
        "podcast": {"deliberationTranscript": "..."},
        "originStory": {"headline": "Origin", "body": origin_body},
        "problemStatement": {"headline": "Problem", "body": problem_body},
        "founderBio": {"headline": "Founder", "body": []},
        "caseStudy": {"headline": "Case", "body": []},
        "conversation": [{"speaker": "scout", "text": "hi"}],
    }

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path.endswith("/data/query/production"):
            return httpx.Response(200, json={"result": doc})
        return httpx.Response(404)

    async with _mock_http(handler) as http:
        result = await get_issue_draft(http, "issue-42")

    assert result["revisionId"] == "rev-9"
    assert result["bonusType"] == "specAd"
    assert result["theme"] == {"primaryColor": "#111111"}
    assert result["conversation"] == [{"speaker": "scout", "text": "hi"}]

    origin = result["sections"]["originStory"]
    assert origin["headline"] == "Origin"
    assert origin["lossy"] is False
    assert [b["type"] for b in origin["blocks"]] == ["h2", "paragraph", "blockquote"]
    assert origin["blocks"][0]["text"] == "A Sub-Header"
    assert origin["blocks"][2]["text"] == "A pull quote."

    problem = result["sections"]["problemStatement"]
    assert problem["lossy"] is True
    assert problem["blocks"][0]["type"] == "paragraph"

    # Sections with no stored body still shape correctly.
    assert result["sections"]["founderBio"]["blocks"] == []
    assert result["sections"]["founderBio"]["lossy"] is False


# ── Plan 31-06 gap-closure tests ────────────────────────────────────────────


async def test_draft_read_includes_pdf_content(monkeypatch: pytest.MonkeyPatch):
    """get_issue_draft() surfaces problemStatement.pdfContent verbatim on
    sections.problemStatement so the PDF-data-points editor can prefill real
    content on load (31-VERIFICATION.md gap 1)."""
    _set_sanity_env(monkeypatch)

    pdf_content = {
        "problemStatement": "The crisis, stated plainly.",
        "keyDataPoints": [
            {"stat": "42%", "source": "GAO 2024"},
            {"stat": "9,000", "source": "internal audit"},
            {"stat": "$3.2M", "source": "IRS 990"},
        ],
        "interventionMechanism": "Direct cash transfer.",
    }
    doc = {
        "_rev": "rev-9",
        "theme": {},
        "game": {},
        "bonus": {},
        "bonusType": "specAd",
        "podcast": {},
        "originStory": {"headline": "Origin", "body": []},
        "problemStatement": {
            "headline": "Problem",
            "body": [],
            "pdfContent": pdf_content,
        },
        "founderBio": {"headline": "Founder", "body": []},
        "caseStudy": {"headline": "Case", "body": []},
        "conversation": [],
    }

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/data/query/production"):
            return httpx.Response(200, json={"result": doc})
        return httpx.Response(404)

    async with _mock_http(handler) as http:
        result = await get_issue_draft(http, "issue-42")

    problem = result["sections"]["problemStatement"]
    assert problem["pdfContent"] == pdf_content
    assert len(problem["pdfContent"]["keyDataPoints"]) == 3

    # A long-read section other than problemStatement never gets a pdfContent
    # key at all.
    assert "pdfContent" not in result["sections"]["originStory"]


async def test_draft_read_decomposes_bonus_body(monkeypatch: pytest.MonkeyPatch):
    """get_issue_draft() runs bonus.body through pt_to_blocks() (mirroring the
    4 long-reads) and surfaces a sibling bonus.bodyLossy flag (31-VERIFICATION.md
    gap 2)."""
    _set_sanity_env(monkeypatch)

    bonus_body = [
        _pt_block("h2", "Spec Ad Header"),
        _pt_block("normal", "Body copy."),
    ]
    doc = {
        "_rev": "rev-9",
        "theme": {},
        "game": {},
        "bonus": {"headline": "Bonus H", "body": bonus_body, "sunoAudioUrl": "https://x"},
        "bonusType": "specAd",
        "podcast": {},
        "originStory": {"headline": "Origin", "body": []},
        "problemStatement": {"headline": "Problem", "body": []},
        "founderBio": {"headline": "Founder", "body": []},
        "caseStudy": {"headline": "Case", "body": []},
        "conversation": [],
    }

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/data/query/production"):
            return httpx.Response(200, json={"result": doc})
        return httpx.Response(404)

    async with _mock_http(handler) as http:
        result = await get_issue_draft(http, "issue-42")

    bonus = result["bonus"]
    assert bonus["headline"] == "Bonus H"
    assert bonus["sunoAudioUrl"] == "https://x"
    assert [b["type"] for b in bonus["body"]] == ["h2", "paragraph"]
    assert bonus["body"][0]["text"] == "Spec Ad Header"
    assert bonus["bodyLossy"] is False

    # A markDefs-bearing bonus block sets bodyLossy True.
    doc["bonus"]["body"] = [
        _pt_block("normal", "Linked.", mark_defs=[{"_key": "m1", "_type": "link"}])
    ]

    async with _mock_http(handler) as http:
        result2 = await get_issue_draft(http, "issue-42")

    assert result2["bonus"]["bodyLossy"] is True


async def test_bonus_headline_only_save_omits_body(monkeypatch: pytest.MonkeyPatch):
    """PATCH /bonus with {variant, headline} and NO blocks/body key emits a
    Sanity set containing ONLY bonus.headline — patch_bonus never clobbers a
    field the caller omitted (31-VERIFICATION.md gap 2)."""

    async def mock_convex_query(http, path, args):
        return {"sanityIssueId": "issue-42"}

    async def mock_get_issue_draft_specad(http, issue_id):
        return _empty_draft(bonusType="specAd", bonus={"headline": "Old", "body": []})

    captured_fields: dict = {}

    async def mock_patch_fields(http, *, issue_id, fields, if_revision_id):
        captured_fields.clear()
        captured_fields.update(fields)
        return "rev-2"

    async def mock_emit_audit(http, **kwargs):
        pass

    monkeypatch.setattr(f"{_C}._cc.convex_query", mock_convex_query)
    monkeypatch.setattr(f"{_C}.get_issue_draft", mock_get_issue_draft_specad)
    monkeypatch.setattr(f"{_C}._patch_fields", mock_patch_fields)
    monkeypatch.setattr(f"{_C}._emit_audit", mock_emit_audit)

    resp = _content_client.patch(
        "/issues/run-abc/bonus",
        json={"ifRevisionID": "rev-1", "variant": "specAd", "headline": "New Headline"},
    )
    assert resp.status_code == 200, resp.text
    assert captured_fields == {"bonus.headline": "New Headline"}
    assert "bonus.body" not in captured_fields

    # Same non-clobber contract for jingle: lyrics-only save never wipes
    # bonus.body.
    async def mock_get_issue_draft_jingle(http, issue_id):
        return _empty_draft(bonusType="jingle", bonus={"lyrics": "Old lyrics", "body": []})

    monkeypatch.setattr(f"{_C}.get_issue_draft", mock_get_issue_draft_jingle)

    resp2 = _content_client.patch(
        "/issues/run-abc/bonus",
        json={"ifRevisionID": "rev-1", "variant": "jingle", "lyrics": "New lyrics"},
    )
    assert resp2.status_code == 200, resp2.text
    assert captured_fields == {"bonus.lyrics": "New lyrics"}
    assert "bonus.body" not in captured_fields
