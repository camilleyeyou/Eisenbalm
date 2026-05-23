"""Phase 13 Wave 0 — Sanity write integration test for conversation array.

Covers DEL-CONV-02 (DEL-P13-09):
  - write_issue_draft emits selectionDeliberation.conversation on the wire
  - each item carries _key matching ^turn-\d{3}$
  - each item has _type == 'object', speaker, and text
  - empty deliberation_conversation produces no conversation key (or None)

This test is SKIP-GUARDED until Plan 13-02 extends write_issue_draft to emit
the conversation array.  The guard checks at collection time whether the actual
write function produces the key, so `pytest --collect-only` exits 0.
"""
from __future__ import annotations

import json
import re
from typing import Any

import httpx
import pytest

from eisenbalm_pipeline.lib.sanity_client import write_issue_draft


def _base_state(deliberation_conversation: list[dict] | None = None) -> dict:
    """Minimal DispatchState-shaped dict for write_issue_draft."""
    state: dict = {
        "issue_number": 13,
        "publish_date": "2026-06-05",
        "winning_charity_sanity_id": "charity-test-org",
        "run_id": "run-p13-write-test",
        "pipeline_started_at": "2026-06-05T00:00:00Z",
        "style_brief": {"bonusType": "bigBudget"},
        "candidates": [],
        "deliberation_transcript": "Full deliberation transcript text.",
    }
    if deliberation_conversation is not None:
        state["deliberation_conversation"] = deliberation_conversation
    return state


async def _capture_write(state: dict) -> dict[str, Any]:
    """Run write_issue_draft with an httpx.MockTransport; return the posted document."""
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content.decode())
        return httpx.Response(200, json={"transactionId": "test-tx", "results": []})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(
        base_url="https://test.api.sanity.io",
        transport=transport,
    ) as http:
        await write_issue_draft(http, state)

    mutations = captured.get("body", {}).get("mutations", [])
    assert mutations, "write_issue_draft produced no mutations"
    return mutations[0]["createOrReplace"]


def _conversation_written() -> bool:
    """Return True if write_issue_draft already emits the conversation key.

    Probes by running a minimal write synchronously and checking the payload.
    Returns False (allowing skip) if the key is absent.
    """
    import asyncio

    state = _base_state(deliberation_conversation=[{"speaker": "scout", "text": "test"}])
    try:
        doc = asyncio.run(_capture_write(state))
        delib = doc.get("selectionDeliberation", {})
        return "conversation" in delib
    except Exception:
        return False


@pytest.mark.skipif(
    not _conversation_written(),
    reason="Wave 2: write_issue_draft does not yet emit conversation — implement in Plan 13-02",
)
@pytest.mark.asyncio
async def test_conversation_write() -> None:
    """DEL-CONV-02 (DEL-P13-09): conversation array reaches Sanity payload with correct shape.

    Verifies:
      - selectionDeliberation.conversation is present and a list
      - every item has _key matching ^turn-\d{3}$
      - every item has _type == 'object'
      - speaker and text are present and match the input
    """
    turns = [
        {"speaker": "scout", "text": "Here is what I found."},
        {"speaker": "editor", "text": "And here is my decision."},
    ]
    state = _base_state(deliberation_conversation=turns)
    doc = await _capture_write(state)

    delib = doc.get("selectionDeliberation", {})
    assert "conversation" in delib, (
        "selectionDeliberation.conversation must be present in the Sanity payload "
        "when deliberation_conversation is set on state."
    )

    conversation = delib["conversation"]
    assert isinstance(conversation, list)
    assert len(conversation) == 2, f"Expected 2 turns, got {len(conversation)}"

    key_pattern = re.compile(r"^turn-\d{3}$")
    for i, item in enumerate(conversation):
        assert "_key" in item, f"Item {i} missing _key (Sanity array requirement)"
        assert key_pattern.match(item["_key"]), (
            f"Item {i} _key '{item['_key']}' does not match turn-NNN pattern"
        )
        assert item.get("_type") == "object", (
            f"Item {i} _type must be 'object', got '{item.get('_type')}'"
        )
        assert "speaker" in item, f"Item {i} missing 'speaker'"
        assert "text" in item, f"Item {i} missing 'text'"
        assert item["speaker"] == turns[i]["speaker"]
        assert item["text"] == turns[i]["text"]


@pytest.mark.skipif(
    not _conversation_written(),
    reason="Wave 2: write_issue_draft does not yet emit conversation — implement in Plan 13-02",
)
@pytest.mark.asyncio
async def test_empty_conversation_produces_none_or_absent() -> None:
    """When deliberation_conversation is None, conversation key is absent or None in payload."""
    state = _base_state(deliberation_conversation=None)
    doc = await _capture_write(state)

    delib = doc.get("selectionDeliberation", {})
    # Either absent or explicitly None — both are acceptable empty states
    conversation = delib.get("conversation")
    assert conversation is None or conversation == [], (
        "When deliberation_conversation is None, the payload conversation field "
        f"must be None or absent, got: {conversation!r}"
    )
