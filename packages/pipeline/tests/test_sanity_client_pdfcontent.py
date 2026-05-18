"""Phase 6 Plan 02 — write_issue_draft pdfContent passthrough tests.

Verifies the `_build_pdf_content` helper and write_issue_draft together
produce a problemStatement.pdfContent block on every Sanity write, with:
  - exactly 3 keyDataPoints (Sanity Rule.length(3) contract)
  - _key on every keyDataPoint (Sanity array-item requirement)
  - byte-faithful passthrough of state['problem_statement']['pdfContent']
  - defensive default when pdfContent is missing

This is the durable contract between Phase 5 ProblemWriter (which emits
pdfContent into DispatchState) and the Phase 6 WeasyPrint renderer (which
reads pdfContent back from Sanity GROQ, NOT from the LangGraph checkpoint).
"""
from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from eisenbalm_pipeline.lib.sanity_client import (
    _build_pdf_content,
    write_issue_draft,
)


# ── Unit tests for the helper ────────────────────────────────────────────


def test_full_pdf_content_passthrough() -> None:
    """All 3 keyDataPoints, problemStatement, interventionMechanism preserved."""
    out = _build_pdf_content(
        {
            "problem_statement": {
                "pdfContent": {
                    "problemStatement": "Why it's broken.",
                    "keyDataPoints": [
                        {"stat": "1 in 4", "source": "CDC, 2024"},
                        {"stat": "$2.3T", "source": "World Bank"},
                        {"stat": "73%", "source": "JAMA 2023"},
                    ],
                    "interventionMechanism": "Direct cash transfer.",
                }
            }
        }
    )
    assert out["problemStatement"] == "Why it's broken."
    assert out["interventionMechanism"] == "Direct cash transfer."
    assert len(out["keyDataPoints"]) == 3
    assert out["keyDataPoints"][0]["stat"] == "1 in 4"
    assert out["keyDataPoints"][2]["source"] == "JAMA 2023"


def test_missing_pdf_content_defaults_to_three_empty_items() -> None:
    """Manually-authored drafts pre-Phase 5 still pass Sanity Rule.length(3)."""
    out = _build_pdf_content({"problem_statement": {"headline": "h", "body": "b"}})
    assert out["problemStatement"] == ""
    assert out["interventionMechanism"] == ""
    assert len(out["keyDataPoints"]) == 3
    for kdp in out["keyDataPoints"]:
        assert kdp["stat"] == ""
        assert kdp["source"] == ""


def test_missing_problem_statement_section_defaults() -> None:
    """No problem_statement at all in state — still emits valid 3-item shape."""
    out = _build_pdf_content({})
    assert len(out["keyDataPoints"]) == 3
    assert all(kdp["stat"] == "" for kdp in out["keyDataPoints"])


def test_partial_key_data_points_pads_to_three() -> None:
    """Only 1 keyDataPoint supplied — pad with 2 empties to reach 3."""
    out = _build_pdf_content(
        {
            "problem_statement": {
                "pdfContent": {"keyDataPoints": [{"stat": "only", "source": "one"}]}
            }
        }
    )
    assert len(out["keyDataPoints"]) == 3
    assert out["keyDataPoints"][0]["stat"] == "only"
    assert out["keyDataPoints"][0]["source"] == "one"
    assert out["keyDataPoints"][1]["stat"] == ""
    assert out["keyDataPoints"][2]["stat"] == ""


def test_excess_key_data_points_truncates_to_three() -> None:
    """5 keyDataPoints supplied — drop the last 2 to enforce Rule.length(3)."""
    out = _build_pdf_content(
        {
            "problem_statement": {
                "pdfContent": {
                    "keyDataPoints": [
                        {"stat": "a", "source": "1"},
                        {"stat": "b", "source": "2"},
                        {"stat": "c", "source": "3"},
                        {"stat": "d", "source": "4"},
                        {"stat": "e", "source": "5"},
                    ]
                }
            }
        }
    )
    assert len(out["keyDataPoints"]) == 3
    assert [k["stat"] for k in out["keyDataPoints"]] == ["a", "b", "c"]


def test_key_present_on_every_key_data_point() -> None:
    """Sanity rejects array items without _key; every kdp must carry one."""
    out = _build_pdf_content(
        {
            "problem_statement": {
                "pdfContent": {
                    "keyDataPoints": [
                        {"stat": "x", "source": "y"},
                        {"stat": "x", "source": "y"},
                        {"stat": "x", "source": "y"},
                    ]
                }
            }
        }
    )
    keys = [kdp["_key"] for kdp in out["keyDataPoints"]]
    assert keys == ["kdp-0", "kdp-1", "kdp-2"]


def test_non_dict_pdf_content_falls_back_to_default() -> None:
    """Garbage in pdfContent (e.g. a string from a bad LLM response) — default."""
    out = _build_pdf_content(
        {"problem_statement": {"pdfContent": "this is not a dict"}}
    )
    assert out["problemStatement"] == ""
    assert len(out["keyDataPoints"]) == 3


# ── Integration test: write_issue_draft emits pdfContent on the wire ─────


@pytest.mark.asyncio
async def test_write_issue_draft_emits_pdf_content(monkeypatch: pytest.MonkeyPatch) -> None:
    """End-to-end: state['problem_statement']['pdfContent'] reaches the Sanity payload.

    Mocks Sanity HTTP via httpx.MockTransport. Captures the JSON body and
    asserts the problemStatement.pdfContent block is present, well-formed,
    and contains exactly the values supplied by Phase 5 ProblemWriter.
    """
    monkeypatch.setenv("SANITY_API_TOKEN", "test-token")
    monkeypatch.setenv("NEXT_PUBLIC_SANITY_DATASET", "production")

    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content.decode())
        return httpx.Response(200, json={"transactionId": "test-tx", "results": []})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(
        base_url="https://test.api.sanity.io",
        transport=transport,
    ) as http:
        state = {
            "issue_number": 42,
            "publish_date": "2026-06-04",
            "winning_charity_sanity_id": "charity-test",
            "run_id": "run-test",
            "pipeline_started_at": "2026-06-04T00:00:00Z",
            "style_brief": {"bonusType": "bigBudget"},
            "candidates": [],
            "problem_statement": {
                "headline": "The problem",
                "body": "First paragraph.\n\nSecond paragraph.",
                "pdfContent": {
                    "problemStatement": "Short summary under 150 words.",
                    "keyDataPoints": [
                        {"stat": "1 in 4", "source": "CDC 2024"},
                        {"stat": "$2.3T", "source": "World Bank"},
                        {"stat": "73%", "source": "JAMA 2023"},
                    ],
                    "interventionMechanism": "Direct cash transfer.",
                },
            },
        }
        issue_id = await write_issue_draft(http, state)

    assert issue_id == "issue-42"
    payload = captured["body"]["mutations"][0]["createOrReplace"]
    pdf = payload["problemStatement"]["pdfContent"]
    assert pdf["problemStatement"] == "Short summary under 150 words."
    assert pdf["interventionMechanism"] == "Direct cash transfer."
    assert len(pdf["keyDataPoints"]) == 3
    assert pdf["keyDataPoints"][0]["stat"] == "1 in 4"
    assert pdf["keyDataPoints"][0]["source"] == "CDC 2024"
    assert pdf["keyDataPoints"][2]["stat"] == "73%"
    # Every keyDataPoint carries _key (Sanity array-item requirement)
    for kdp in pdf["keyDataPoints"]:
        assert "_key" in kdp


@pytest.mark.asyncio
async def test_write_issue_draft_handles_missing_pdf_content(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Manually-authored draft with no pdfContent still produces valid payload."""
    monkeypatch.setenv("SANITY_API_TOKEN", "test-token")
    monkeypatch.setenv("NEXT_PUBLIC_SANITY_DATASET", "production")

    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content.decode())
        return httpx.Response(200, json={"transactionId": "test-tx", "results": []})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(
        base_url="https://test.api.sanity.io",
        transport=transport,
    ) as http:
        state = {
            "issue_number": 1,
            "publish_date": "2026-06-04",
            "winning_charity_sanity_id": "charity-test",
            "run_id": "run-test",
            "pipeline_started_at": "2026-06-04T00:00:00Z",
            "style_brief": {"bonusType": "bigBudget"},
            "candidates": [],
            "problem_statement": {"headline": "h", "body": "b"},  # no pdfContent
        }
        await write_issue_draft(http, state)

    pdf = captured["body"]["mutations"][0]["createOrReplace"]["problemStatement"][
        "pdfContent"
    ]
    assert pdf["problemStatement"] == ""
    assert len(pdf["keyDataPoints"]) == 3
    for kdp in pdf["keyDataPoints"]:
        assert "_key" in kdp
        assert kdp["stat"] == ""
        assert kdp["source"] == ""
