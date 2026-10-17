"""Phase 55: write_issue_draft emits selectionDeliberation.editorConfidence (valid values only)."""
from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from eisenbalm_pipeline.lib.sanity_client import write_issue_draft


@pytest.fixture(autouse=True)
def _env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SANITY_API_TOKEN", "test-token")
    monkeypatch.setenv("NEXT_PUBLIC_SANITY_DATASET", "production")


def _base_state(**extra: Any) -> dict:
    state: dict = {
        "issue_number": 13,
        "publish_date": "2026-06-05",
        "winning_charity_sanity_id": "charity-test-org",
        "run_id": "run-p55-conf",
        "pipeline_started_at": "2026-06-05T00:00:00Z",
        "style_brief": {"bonusType": "bigBudget"},
        "candidates": [],
        "deliberation_transcript": "Transcript.",
        "editor_decision": "Decision.",
        "runner_up_notes": "Notes.",
    }
    state.update(extra)
    return state


async def _capture_write(state: dict) -> dict[str, Any]:
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(404, json={})
        captured["body"] = json.loads(request.content.decode())
        return httpx.Response(200, json={"transactionId": "t", "results": []})

    async with httpx.AsyncClient(
        base_url="https://test.api.sanity.io", transport=httpx.MockTransport(handler)
    ) as http:
        await write_issue_draft(http, state)
    return captured["body"]["mutations"][0]["createOrReplace"]


@pytest.mark.parametrize(
    "value,expected", [(0.82, 0.82), (0, 0.0), (1, 1.0), (0.0, 0.0), (1.0, 1.0)]
)
async def test_valid_confidence_written(value: Any, expected: float) -> None:
    doc = await _capture_write(_base_state(editor_confidence=value))
    got = doc["selectionDeliberation"]["editorConfidence"]
    assert got == expected and isinstance(got, float)


@pytest.mark.parametrize(
    "value", [None, float("nan"), 1.5, -0.1, True, "0.8", float("inf")]
)
async def test_invalid_confidence_omitted(value: Any) -> None:
    doc = await _capture_write(_base_state(editor_confidence=value))
    assert "editorConfidence" not in doc["selectionDeliberation"]


async def test_missing_key_omitted_and_existing_keys_intact() -> None:
    doc = await _capture_write(_base_state())
    delib = doc["selectionDeliberation"]
    assert "editorConfidence" not in delib
    for k in ("candidates", "editorDecision", "runnerUpNotes", "conversation"):
        assert k in delib
