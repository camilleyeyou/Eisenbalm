"""Regression tests: aggregator/degenerate domains must never be dedup keys (quick-261014-kor)."""
from __future__ import annotations

import logging
from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.scout import (
    CharityCandidate,
    ScoutBatchOutput,
    _candidate_keys,
    _is_usable_domain,
    _load_registry_keys,
    discover_candidates,
)

USAGE = {"tokens_in": 1, "tokens_out": 1, "usd": 0.0, "resolved_model": "m"}


def _cand(name: str, website: str) -> CharityCandidate:
    return CharityCandidate(
        name=name,
        location="NYC",
        website=website,
        assetRange="<$1M",
        focusArea="education",
        missionStatement="m",
        scoutSummary="s",
        whyOverlooked="o",
    )


async def _discover(featured: list[str], cands: list[CharityCandidate]):
    batch = ScoutBatchOutput(candidates=cands)
    with patch(
        "eisenbalm_pipeline.agents.scout.web_search", AsyncMock(return_value=[])
    ), patch(
        "eisenbalm_pipeline.agents.scout.acomplete",
        AsyncMock(return_value=(batch, USAGE)),
    ), patch(
        "eisenbalm_pipeline.agents.scout._load_registry_keys",
        AsyncMock(return_value=featured),
    ), patch(
        "eisenbalm_pipeline.agents.scout.get_convex_http", return_value=object()
    ):
        return await discover_candidates(run_id="r1", config=None)


@pytest.mark.parametrize(
    "domain,expected",
    [
        ("ripmedicaldebt.org", True),
        ("foo.example", True),
        (".", False),
        ("", False),
        ("localhost", False),
        (".org", False),
        ("foo.", False),
        ("guidestar.org", False),
        ("charitynavigator.org", False),
        ("sites.google.com", False),
        ("m.facebook.com", False),
        ("en.wikipedia.org", False),
        ("notguidestar.org", True),
    ],
)
def test_is_usable_domain(domain: str, expected: bool) -> None:
    assert _is_usable_domain(domain) is expected


def test_candidate_keys_skip_aggregator_domain() -> None:
    c = _cand("Some Org", "https://www.guidestar.org/profile/12-3456789")
    assert _candidate_keys(c) == {"some org"}


async def test_load_registry_keys_drops_bad_domains() -> None:
    rows = [
        {"dedupKey": "rip medical debt|ripmedicaldebt.org"},
        {"dedupKey": "through evely's eyes|guidestar.org"},
        {"dedupKey": "be a dear and donate a brassiere|."},
    ]
    with patch(
        "eisenbalm_pipeline.agents.scout.convex_query",
        AsyncMock(return_value=rows),
    ):
        keys = await _load_registry_keys(object())
    for k in (
        "rip medical debt",
        "ripmedicaldebt.org",
        "through evely's eyes",
        "be a dear and donate a brassiere",
    ):
        assert k in keys
    assert "guidestar.org" not in keys
    assert "." not in keys


async def test_candidate_side_filter_protects_alone() -> None:
    surviving, _, _ = await _discover(
        ["x", "guidestar.org", "y", "."],
        [_cand("A Org", "https://www.guidestar.org/profile/1"), _cand("B Org", "https://bfoo.example")],
    )
    assert {c["name"] for c in surviving} == {"A Org", "B Org"}


async def test_real_matches_still_dedup() -> None:
    surviving, _, _ = await _discover(
        ["rip medical debt", "ripmedicaldebt.org", "some featured org"],
        [
            _cand("Different Name", "https://www.ripmedicaldebt.org/about"),
            _cand("Some Featured Org", "https://www.guidestar.org/profile/1"),
            _cand("Fresh Org", "https://fresh.example"),
        ],
    )
    assert [c["name"] for c in surviving] == ["Fresh Org"]


async def test_dedup_logging(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger="eisenbalm_pipeline.agents.scout"):
        surviving, _, _ = await _discover(
            ["dupe org"], [_cand("Dupe Org", "https://dupe.example")]
        )
    assert surviving == []
    infos = [r for r in caplog.records if r.levelno == logging.INFO]
    assert any("dupe org" in r.getMessage() and "matched_keys" in r.getMessage() for r in infos)
    warns = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert any("Dupe Org" in r.getMessage() for r in warns)
