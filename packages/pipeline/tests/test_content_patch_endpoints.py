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
from eisenbalm_pipeline.lib.sanity_client import patch_issue_field

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


@pytest.mark.skip(reason="Wave 2/3 — Plan 31-02/03")
async def test_upload_asset_patches_reference():
    """POST /issues/{run_id}/assets/{slot} uploads to Sanity assets, then
    patches a {_type, asset:{_ref}} reference onto the slot field."""


@pytest.mark.skip(reason="Wave 2/3 — Plan 31-02/03")
async def test_audit_row_truncated_snapshot():
    """A before/after snapshot longer than 2000 chars is truncated with the
    "...[truncated]" suffix before being written to auditLog:record."""


@pytest.mark.skip(reason="Wave 2/3 — Plan 31-02/03")
async def test_asset_overwrite_audit_swap():
    """Overwriting an existing asset slot leaves the prior Sanity asset
    document in place (no delete) — D-12."""


@pytest.mark.skip(reason="Wave 2/3 — Plan 31-02/03")
async def test_asset_overwrite_audit_swap_records_audit():
    """An asset-slot overwrite records the before/after asset IDs in the
    auditLog:record row."""


@pytest.mark.skip(reason="Wave 2/3 — Plan 31-02/03")
async def test_bonus_patch_variant_shaped():
    """PATCH /issues/{run_id}/bonus accepts a payload shaped by bonusType —
    specAd→body, bigBudget→storyboards, jingle→lyrics+sunoPrompt."""


@pytest.mark.skip(reason="Wave 2/3 — Plan 31-02/03")
async def test_draft_read_lossy_flag():
    """GET /issues/{run_id}/draft sets sections.<name>.lossy=true when a
    stored block had markDefs or multiple children spans."""
