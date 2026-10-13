"""Quick 261013-j6s — verify_candidates relevance filter + narrowed 4xx kill.

Tavily returns ~10 results for almost any query, so raw len(results) saturated
the kill bar for every candidate. The press scan now counts only third-party
results that actually name the org; bot-block 4xx no longer kills. All mocked.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest
import respx

from eisenbalm_pipeline.agents.verify_candidates import (
    _check_domain_live,
    _mentions_org,
    _obscurity_press_scan,
    verify_candidates,
)
from eisenbalm_pipeline.lib.search_client import SearchResult

MOD = "eisenbalm_pipeline.agents.verify_candidates"
FAKE = "Zyxwvut Quiet Library Acoustics Trust of Lower Vermont"


def _unrelated(n: int = 10) -> list[SearchResult]:
    return [
        SearchResult(
            url=f"https://site{i}.example/page",
            title="Generic library acoustics guide",
            content="Tips on quiet reading rooms.", score=0.5,
        )
        for i in range(n)
    ]


def _named(name: str, hosts: list[str]) -> list[SearchResult]:
    return [
        SearchResult(url=f"https://{h}/a", title="News", content=f"Coverage of {name} today.", score=0.5)
        for h in hosts
    ]


def _candidate(name: str, website: str) -> dict:
    return {"name": name, "website": website}


def test_mentions_org_normalization() -> None:
    assert _mentions_org("Knowbility", "Read about KNOWBILITY's work")
    assert _mentions_org("Knowbility, Inc.", "the knowbility   inc program")
    assert not _mentions_org(
        "Quiet Library Acoustics Trust", "Generic library acoustics guide"
    )
    assert not _mentions_org("", "anything")


@pytest.mark.asyncio
async def test_unrelated_results_score_zero() -> None:
    mock = AsyncMock(return_value=_unrelated())
    with patch(f"{MOD}.web_search", mock):
        assert await _obscurity_press_scan(FAKE, "https://zyxwvut.org") == 0
    mock.assert_awaited_once_with(f'"{FAKE}"', max_results=10)


@pytest.mark.asyncio
async def test_genuine_third_party_mentions_count() -> None:
    hosts = [f"host{i}.example" for i in range(10)]
    with patch(f"{MOD}.web_search", AsyncMock(return_value=_named("Knowbility", hosts))):
        assert await _obscurity_press_scan("Knowbility", "https://knowbility.org/") == 10


@pytest.mark.asyncio
async def test_own_domain_excluded() -> None:
    hosts = ["www.knowbility.org", "knowbility.org", "www.knowbility.org"] * 2
    hosts += [f"host{i}.example" for i in range(4)]
    with patch(f"{MOD}.web_search", AsyncMock(return_value=_named("Knowbility", hosts))):
        assert await _obscurity_press_scan("Knowbility", "https://knowbility.org/") == 4


@pytest.mark.asyncio
async def test_scan_none_cases() -> None:
    with patch(f"{MOD}.web_search", AsyncMock(side_effect=RuntimeError("boom"))):
        assert await _obscurity_press_scan("X Org", None) is None
    assert await _obscurity_press_scan("", None) is None
    assert await _obscurity_press_scan(None, None) is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "code,expected",
    [(401, None), (403, None), (405, None), (429, None), (503, None),
     (404, False), (410, False), (200, True)],
)
async def test_domain_live_status_codes(code: int, expected) -> None:
    url = "https://status.example/"
    async with respx.mock() as router:
        router.get(url).mock(return_value=httpx.Response(code))
        assert await _check_domain_live(url) is expected


@pytest.mark.asyncio
async def test_domain_live_redirect_then_200() -> None:
    async with respx.mock() as router:
        router.get("https://a.example/").mock(
            return_value=httpx.Response(301, headers={"Location": "https://b.example/"})
        )
        router.get("https://b.example/").mock(return_value=httpx.Response(200))
        assert await _check_domain_live("https://a.example/") is True


async def _run(website: str, results: list[SearchResult]) -> dict:
    state = {"run_id": "r", "candidates": [_candidate(FAKE, website)]}
    with patch(f"{MOD}._check_registration", AsyncMock(return_value=(None, False))), \
         patch(f"{MOD}.web_search", AsyncMock(return_value=results)), \
         patch(f"{MOD}.convex_mutation_safe", AsyncMock()):
        return await verify_candidates(state)


@pytest.mark.asyncio
async def test_e2e_403_unrelated_survives() -> None:
    site = "https://zyxwvut.example/"
    async with respx.mock() as router:
        router.get(site).mock(return_value=httpx.Response(403))
        out = await _run(site, _unrelated())
    assert len(out["candidates"]) == 1
    rec = out["verification_records"][0]
    assert rec["killed"] is False
    assert rec["obscurity"]["pressHits"] == 0
    assert rec["obscurity"]["verdict"] == "obscure"


@pytest.mark.asyncio
async def test_e2e_410_kills() -> None:
    site = "https://gone.example/"
    async with respx.mock() as router:
        router.get(site).mock(return_value=httpx.Response(410))
        out = await _run(site, _unrelated())
    assert out["candidates"] == []
    assert "domain" in out["verification_records"][0]["killReason"]


@pytest.mark.asyncio
async def test_e2e_saturated_third_party_kills() -> None:
    site = "https://zyxwvut.example/"
    results = _named(FAKE, [f"host{i}.example" for i in range(10)])
    async with respx.mock() as router:
        router.get(site).mock(return_value=httpx.Response(200))
        out = await _run(site, results)
    assert out["candidates"] == []
    assert "not obscure" in out["verification_records"][0]["killReason"]
