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
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import HTTPException

import eisenbalm_pipeline.lib.convex_client as _cc
from eisenbalm_pipeline.api.control import _emit_audit
from eisenbalm_pipeline.lib.sanity_client import (
    get_issue_draft,
    patch_issue_field,
    upload_asset,
)

pytestmark = pytest.mark.anyio


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


@pytest.mark.skip(reason="Wave 2/3 — Plan 31-02/03")
async def test_theme_patch_validation():
    """PATCH /issues/{run_id}/theme HARD-blocks invalid hex / non-whitelisted
    fonts with 4xx {reason: "validation_failed", fields: [...]}."""


@pytest.mark.skip(reason="Wave 2/3 — Plan 31-02/03")
async def test_structural_floor_warns_not_blocks():
    """A section-body patch below the structural floor still saves (200)
    with warnings — it never 4xxs."""


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


@pytest.mark.skip(reason="Wave 2/3 — Plan 31-02/03")
async def test_audit_row_truncated_snapshot():
    """A before/after snapshot longer than 2000 chars is truncated with the
    "...[truncated]" suffix before being written to auditLog:record."""


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


@pytest.mark.skip(reason="Wave 2/3 — Plan 31-02/03")
async def test_asset_overwrite_audit_swap_records_audit():
    """An asset-slot overwrite records the before/after asset IDs in the
    auditLog:record row."""


@pytest.mark.skip(reason="Wave 2/3 — Plan 31-02/03")
async def test_bonus_patch_variant_shaped():
    """PATCH /issues/{run_id}/bonus accepts a payload shaped by bonusType —
    specAd→body, bigBudget→storyboards, jingle→lyrics+sunoPrompt."""


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
