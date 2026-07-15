"""Phase 42 Plan 02 Task 2 — FCT-01: publisher carries `importance` onto
every claim_checks row it seeds.

Exercises the REAL merge logic inside ``agents/publisher/__init__.py``'s
``publisher()`` node by calling it directly, monkeypatching the Sanity write
and Convex mutation boundary (mirroring ``test_content_patch_endpoints.py``'s
monkeypatch-the-network-boundary style) so no network call happens. The
claim_rows payload actually passed to ``claimChecks:insertBatch`` is captured
and asserted against, per the plan's <behavior> list:

  - A sourced row whose claimId resolves in research_claims copies that
    claim's importance onto the row.
  - A sourced row whose research_claims lookup returns None defaults
    importance to 'Supporting'.
  - Every unsourced (extract_claims_by_block) row gets importance
    'Supporting'.
  - Every row in the final claim_rows payload carries an importance key.
"""

from __future__ import annotations

import pytest

import eisenbalm_pipeline.agents._wrapper as _wrapper_mod
import eisenbalm_pipeline.agents.publisher as _publisher_mod


def _patch_network_boundary(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, dict]]:
    """Monkeypatch the Sanity write + Convex mutation calls the publisher
    node makes, capturing every convex_mutation_safe(name, payload) call.

    Both ``agents/publisher/__init__.py`` and ``agents/_wrapper.py`` import
    ``convex_mutation_safe`` directly (``from ... import convex_mutation_safe``),
    so each module's own bound name must be patched independently — patching
    the source module (``lib.convex_client``) alone would not affect either
    already-bound reference.
    """
    calls: list[tuple[str, dict]] = []

    async def _fake_convex_mutation_safe(name, payload=None):
        calls.append((name, payload))
        return None

    async def _fake_write_issue_draft(sanity_http, state, cost_payload):
        return "sanity-issue-test-id"

    def _fake_get_sanity_http():
        return object()

    monkeypatch.setattr(_publisher_mod, "convex_mutation_safe", _fake_convex_mutation_safe)
    monkeypatch.setattr(_wrapper_mod, "convex_mutation_safe", _fake_convex_mutation_safe)
    monkeypatch.setattr(_publisher_mod, "write_issue_draft", _fake_write_issue_draft)
    monkeypatch.setattr(_publisher_mod, "get_sanity_http", _fake_get_sanity_http)
    return calls


def _insert_batch_claims(calls: list[tuple[str, dict]]) -> list[dict]:
    for name, payload in calls:
        if name == "claimChecks:insertBatch":
            return payload["claims"]
    raise AssertionError("claimChecks:insertBatch was never called")


async def test_sourced_row_copies_importance_from_research_claims(monkeypatch):
    """A sourced row whose claimId resolves in research_claims copies that
    claim's importance onto the row."""
    calls = _patch_network_boundary(monkeypatch)
    state = {
        "run_id": "test-run-a",
        "issue_number": 1,
        "winning_charity": {},
        "research": {
            "claims": [
                {
                    "claimId": "claimA",
                    "text": "Founded in 1998 by Jane Doe.",
                    "sourceUrl": "https://example.org/a",
                    "retrievedAt": 1_700_000_000_000,
                    "importance": "Load-bearing",
                },
            ],
        },
        "origin_story": {
            "body": [
                {"type": "paragraph", "text": "Founded in 1998 by Jane Doe."},
            ],
            "claimSpans": [
                {"claimId": "claimA", "asWritten": "Founded in 1998 by Jane Doe."},
            ],
        },
    }

    await _publisher_mod.publisher(state)

    claims = _insert_batch_claims(calls)
    sourced = [c for c in claims if c.get("claimId") == "claimA"]
    assert len(sourced) == 1
    assert sourced[0]["importance"] == "Load-bearing"


async def test_sourced_row_defaults_to_supporting_when_claim_id_unresolved(monkeypatch):
    """A sourced row whose research_claims lookup returns None (the writer's
    claimSpans claimId doesn't match any Researcher-emitted claim) defaults
    importance to 'Supporting' — never a fabricated Load-bearing."""
    calls = _patch_network_boundary(monkeypatch)
    state = {
        "run_id": "test-run-b",
        "issue_number": 2,
        "winning_charity": {},
        "research": {"claims": []},  # claimB-missing resolves to nothing
        "origin_story": {
            "body": [
                {"type": "paragraph", "text": "The Riverside Trust served many people."},
            ],
            "claimSpans": [
                {"claimId": "claimB-missing", "asWritten": "The Riverside Trust served many people."},
            ],
        },
    }

    await _publisher_mod.publisher(state)

    claims = _insert_batch_claims(calls)
    sourced = [c for c in claims if c.get("claimId") == "claimB-missing"]
    assert len(sourced) == 1
    assert sourced[0]["importance"] == "Supporting"


async def test_unsourced_rows_all_get_supporting_importance(monkeypatch):
    """Every unsourced (extract_claims_by_block regex catch-all) row gets
    importance 'Supporting' before it is appended."""
    calls = _patch_network_boundary(monkeypatch)
    state = {
        "run_id": "test-run-c",
        "issue_number": 3,
        "winning_charity": {},
        "research": {"claims": []},
        # No claimSpans at all on this section -> every extracted row is
        # unsourced (claimType in {number, date, proper_noun}).
        "founder_bio": {
            "body": [
                {"type": "paragraph", "text": "Founded in 2002. The program served 500 families."},
            ],
        },
    }

    await _publisher_mod.publisher(state)

    claims = _insert_batch_claims(calls)
    unsourced = [c for c in claims if c.get("claimType") != "sourced"]
    assert unsourced, "expected at least one unsourced row from the regex catch-all"
    for row in unsourced:
        assert row["importance"] == "Supporting"


async def test_every_claim_row_carries_an_importance_key(monkeypatch):
    """The final claim_rows passed to claimChecks:insertBatch each carry an
    importance key — sourced (resolved + unresolved) and unsourced rows
    combined in one run."""
    calls = _patch_network_boundary(monkeypatch)
    state = {
        "run_id": "test-run-d",
        "issue_number": 4,
        "winning_charity": {},
        "research": {
            "claims": [
                {
                    "claimId": "claimA",
                    "text": "Founded in 1998 by Jane Doe.",
                    "sourceUrl": "https://example.org/a",
                    "retrievedAt": 1_700_000_000_000,
                    "importance": "Incidental",
                },
            ],
        },
        "origin_story": {
            "body": [
                {"type": "paragraph", "text": "Founded in 1998 by Jane Doe."},
            ],
            "claimSpans": [
                {"claimId": "claimA", "asWritten": "Founded in 1998 by Jane Doe."},
            ],
        },
        "founder_bio": {
            "body": [
                {"type": "paragraph", "text": "Founded in 2002. The program served 500 families."},
            ],
        },
    }

    await _publisher_mod.publisher(state)

    claims = _insert_batch_claims(calls)
    assert claims, "expected at least one claim row"
    for row in claims:
        assert "importance" in row, f"row missing importance key: {row}"
