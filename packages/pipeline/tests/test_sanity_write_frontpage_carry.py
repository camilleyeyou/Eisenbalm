"""Phase 55: write_issue_draft carries forward an existing editor-authored frontPage."""
from __future__ import annotations

import json
import logging
from typing import Any, Callable

import httpx
import pytest

from eisenbalm_pipeline.lib.sanity_client import API_VERSION, write_issue_draft


@pytest.fixture(autouse=True)
def _env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SANITY_API_TOKEN", "test-token")
    monkeypatch.setenv("NEXT_PUBLIC_SANITY_DATASET", "production")


def _state() -> dict:
    return {
        "issue_number": 13,
        "publish_date": "2026-06-05",
        "winning_charity_sanity_id": "charity-test-org",
        "run_id": "run-p55-fp",
        "pipeline_started_at": "2026-06-05T00:00:00Z",
        "style_brief": {"bonusType": "bigBudget"},
        "candidates": [],
        "deliberation_transcript": "Transcript.",
    }


async def _run(get: Callable[[httpx.Request], httpx.Response]) -> tuple[dict, list, list]:
    posts: list[dict] = []
    gets: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            gets.append(request)
            return get(request)
        posts.append(json.loads(request.content.decode()))
        return httpx.Response(200, json={"transactionId": "t", "results": []})

    async with httpx.AsyncClient(
        base_url="https://test.api.sanity.io", transport=httpx.MockTransport(handler)
    ) as http:
        await write_issue_draft(http, _state())
    assert len(posts) == 1
    return posts[0]["mutations"][0]["createOrReplace"], posts, gets


def _docs(*docs: dict) -> Callable[[httpx.Request], httpx.Response]:
    return lambda r: httpx.Response(200, json={"documents": list(docs)})


async def test_published_front_page_preserved() -> None:
    doc, _, gets = await _run(
        _docs({"_id": "issue-13", "frontPage": {"dek": "Published dek"}})
    )
    assert doc["frontPage"] == {"dek": "Published dek"}
    assert gets[0].url.path == f"/{API_VERSION}/data/doc/production/issue-13,drafts.issue-13"
    assert "authorization" in gets[0].headers


async def test_draft_preferred() -> None:
    doc, _, _ = await _run(
        _docs(
            {"_id": "issue-13", "frontPage": {"dek": "Published dek"}},
            {"_id": "drafts.issue-13", "frontPage": {"dek": "Draft dek"}},
        )
    )
    assert doc["frontPage"]["dek"] == "Draft dek"


async def test_no_existing_doc() -> None:
    doc, _, _ = await _run(_docs())
    assert "frontPage" not in doc
    doc, _, _ = await _run(lambda r: httpx.Response(404, json={}))
    assert "frontPage" not in doc


async def test_existing_without_front_page() -> None:
    for fp in (None, {}, "x"):
        d = {"_id": "issue-13"}
        if fp is not None:
            d["frontPage"] = fp
        doc, _, _ = await _run(_docs(d))
        assert "frontPage" not in doc


async def test_lookup_failure_does_not_block(caplog: Any) -> None:
    def boom(r: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    with caplog.at_level(logging.WARNING):
        doc, _, _ = await _run(boom)
    assert "frontPage" not in doc
    assert any("carry-forward" in m for m in caplog.messages)

    caplog.clear()
    with caplog.at_level(logging.WARNING):
        doc, _, _ = await _run(lambda r: httpx.Response(500, json={}))
    assert "frontPage" not in doc
    assert any("carry-forward" in m for m in caplog.messages)
