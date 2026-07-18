"""Phase 46 Plan 05 — verify_candidates unit tests (SGE-03).

Validation: SGE-03 (domain-live / registration / obscurity checks, kill-only-
on-definitive-failure, killReason never silently dropped). Mirrors
tests/agents/test_verify.py's shape — the precedent this node mirrors.

Bug fix (quick 260718-7dk): registration absence used to be a definitive kill
signal even though Scout never populates charityNavigatorUrl/guidestarUrl —
100% of real candidates died "no registration record found". Per the
USER-LOCKED policy, registration NEVER kills anymore; verify_candidates does
its own bounded, site-scoped registration self-lookup (reusing web_search,
D-11 — no new paid/gov API) that can only UPGRADE confidence
(registrationVerified), never remove a candidate. Obscurity's press scan is
widened to a 10-result cap with a genuinely definitive 9/10 kill bar (the old
4/5 hair-trigger falsely killed even mildly-covered orgs). Every test below
mocks web_search / _check_registration explicitly — zero live Tavily calls in
this suite.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest
import respx

from eisenbalm_pipeline.agents.verify_candidates import (
    OBSCURITY_FAIL_MIN_HITS,
    _check_registration,
    verify_candidates,
)
from eisenbalm_pipeline.lib.search_client import SearchResult


def _candidate(name: str, *, website: str, charity_navigator_url=None, guidestar_url=None) -> dict:
    return {
        "name": name,
        "location": "Nowhere",
        "website": website,
        "charityNavigatorUrl": charity_navigator_url,
        "guidestarUrl": guidestar_url,
        "foundingYear": 2001,
        "assetRange": "$10K-$50K",
        "focusArea": "Housing",
        "missionStatement": f"Mission of {name}.",
        "scoutSummary": f"Scout summary of {name}.",
        "whyOverlooked": f"Why {name} is overlooked.",
        "advocateArgument": None,
        "advocateScore": None,
    }


@pytest.mark.asyncio
async def test_no_registration_live_domain_moderate_press_survives_unverified() -> None:
    """Bug B core RED (quick 260718-7dk): a candidate with NO registry URLs
    (Scout never populates these), a live domain, and moderate press SURVIVES
    as 'unverified' — registration absence is no longer a kill signal."""
    website = "https://no-registry-but-real.example/org"
    candidate = _candidate("No Registry Org", website=website)  # no registration fields at all
    state = {"run_id": "run-test-verify-noreg", "candidates": [candidate]}
    mock_convex = AsyncMock()

    async with respx.mock(assert_all_called=True) as router:
        router.get(website).mock(return_value=httpx.Response(200))
        with patch(
            "eisenbalm_pipeline.agents.verify_candidates._check_registration",
            AsyncMock(return_value=(None, False)),
        ), patch(
            "eisenbalm_pipeline.agents.verify_candidates._obscurity_press_scan",
            AsyncMock(return_value=5),
        ), patch(
            "eisenbalm_pipeline.agents.verify_candidates.convex_mutation_safe",
            mock_convex,
        ):
            result = await verify_candidates(state)

    assert len(result["candidates"]) == 1
    assert result["candidates"][0]["name"] == "No Registry Org"
    records = result["verification_records"]
    assert len(records) == 1
    record = records[0]
    assert record["killed"] is False
    assert record["killReason"] is None
    assert record["status"] == "unverified"
    assert record["registrationId"] is None


@pytest.mark.asyncio
async def test_registration_lookup_found_marks_verified() -> None:
    """_check_registration unit test: a name-only candidate (no existing
    registry URL) whose site-scoped web_search hits a registry domain is
    marked verified. FAILS pre-fix — a name-only candidate never searches,
    always returning (None, False)."""
    candidate = {
        "name": "Findable Org",
        "charityNavigatorUrl": None,
        "guidestarUrl": None,
    }
    hit = SearchResult(
        url="https://www.charitynavigator.org/ein/123",
        title="Findable Org — Charity Navigator",
        content="Rating profile for Findable Org.",
        score=0.9,
    )
    with patch(
        "eisenbalm_pipeline.agents.verify_candidates.web_search",
        AsyncMock(return_value=[hit]),
    ):
        registration_id, verified = await _check_registration(candidate)

    assert registration_id == hit.url
    assert verified is True


@pytest.mark.asyncio
async def test_registration_lookup_error_keeps_candidate_unverified() -> None:
    """A registration search error is inconclusive — the node keeps the
    candidate as 'unverified' rather than crashing or killing. FAILS pre-fix
    (killed 'no registration record found')."""
    website = "https://search-blip-but-real.example/org"
    candidate = _candidate("Search Blip Org", website=website)
    state = {"run_id": "run-test-verify-searcherr", "candidates": [candidate]}
    mock_convex = AsyncMock()

    async with respx.mock(assert_all_called=True) as router:
        router.get(website).mock(return_value=httpx.Response(200))
        with patch(
            "eisenbalm_pipeline.agents.verify_candidates.web_search",
            AsyncMock(side_effect=RuntimeError("simulated search blip")),
        ), patch(
            "eisenbalm_pipeline.agents.verify_candidates._obscurity_press_scan",
            AsyncMock(return_value=5),
        ), patch(
            "eisenbalm_pipeline.agents.verify_candidates.convex_mutation_safe",
            mock_convex,
        ):
            result = await verify_candidates(state)

    assert len(result["candidates"]) == 1
    records = result["verification_records"]
    assert len(records) == 1
    record = records[0]
    assert record["killed"] is False
    assert record["status"] == "unverified"


@pytest.mark.asyncio
async def test_heavy_press_still_kills_at_new_bar() -> None:
    """The new definitive obscurity bar (>=9/10 press hits) still kills —
    genuinely mainstream orgs are not obscure enough to feature."""
    website = "https://very-mainstream.example/org"
    candidate = _candidate("Very Mainstream Org", website=website)
    state = {"run_id": "run-test-verify-heavypress", "candidates": [candidate]}
    mock_convex = AsyncMock()

    async with respx.mock(assert_all_called=True) as router:
        router.get(website).mock(return_value=httpx.Response(200))
        with patch(
            "eisenbalm_pipeline.agents.verify_candidates._check_registration",
            AsyncMock(return_value=(None, False)),
        ), patch(
            "eisenbalm_pipeline.agents.verify_candidates._obscurity_press_scan",
            AsyncMock(return_value=OBSCURITY_FAIL_MIN_HITS),
        ), patch(
            "eisenbalm_pipeline.agents.verify_candidates.convex_mutation_safe",
            mock_convex,
        ):
            result = await verify_candidates(state)

    assert result["candidates"] == []
    records = result["verification_records"]
    assert len(records) == 1
    assert records[0]["killed"] is True
    assert records[0]["status"] == "fail"


@pytest.mark.asyncio
async def test_dead_domain_still_kills() -> None:
    """A dead domain (definitive 4xx) still kills, even when registration IS
    reachable — domain-dead remains the one unconditional kill rule."""
    website = "https://dead-domain.example/org"
    reg_url = "https://www.charitynavigator.org/ein/456"
    candidate = _candidate("Dead Domain Org", website=website)
    state = {"run_id": "run-test-verify-deaddomain", "candidates": [candidate]}
    mock_convex = AsyncMock()

    async with respx.mock(assert_all_called=True) as router:
        router.get(website).mock(return_value=httpx.Response(404))
        with patch(
            "eisenbalm_pipeline.agents.verify_candidates._check_registration",
            AsyncMock(return_value=(reg_url, True)),
        ), patch(
            "eisenbalm_pipeline.agents.verify_candidates._obscurity_press_scan",
            AsyncMock(return_value=1),
        ), patch(
            "eisenbalm_pipeline.agents.verify_candidates.convex_mutation_safe",
            mock_convex,
        ):
            result = await verify_candidates(state)

    assert result["candidates"] == []
    records = result["verification_records"]
    assert len(records) == 1
    record = records[0]
    assert record["killed"] is True
    assert record["status"] == "fail"
    assert "domain" in record["killReason"]


@pytest.mark.asyncio
async def test_kills_definitive_failure() -> None:
    """SGE-03 / D-12: a candidate with no registration data is killed via the
    DOMAIN check (rule 1), NOT via registration absence — registration never
    kills as of quick 260718-7dk. _check_registration is patched explicitly
    so no live Tavily search runs."""
    website = "https://definitely-fails.example/org"
    candidate = _candidate("Definite Fail Org", website=website)  # no registration fields at all
    state = {"run_id": "run-test-verify-1", "candidates": [candidate]}
    mock_convex = AsyncMock()

    async with respx.mock(assert_all_called=True) as router:
        router.get(website).mock(return_value=httpx.Response(404))
        with patch(
            "eisenbalm_pipeline.agents.verify_candidates._check_registration",
            AsyncMock(return_value=(None, False)),
        ), patch(
            "eisenbalm_pipeline.agents.verify_candidates._obscurity_press_scan",
            AsyncMock(return_value=OBSCURITY_FAIL_MIN_HITS + 2),
        ), patch(
            "eisenbalm_pipeline.agents.verify_candidates.convex_mutation_safe",
            mock_convex,
        ):
            result = await verify_candidates(state)

    assert result["candidates"] == []
    records = result["verification_records"]
    assert len(records) == 1
    record = records[0]
    assert record["killed"] is True
    assert record["status"] == "fail"
    assert record["killReason"]
    assert "domain" in record["killReason"]
    assert record["domainLive"] is False
    assert record["registrationId"] is None

    insert_calls = [
        c for c in mock_convex.call_args_list if c.args and c.args[0] == "verificationRecords:insert"
    ]
    assert len(insert_calls) == 1
    assert insert_calls[0].args[1]["killed"] is True
    assert insert_calls[0].args[1]["killReason"]


@pytest.mark.asyncio
async def test_keeps_on_transient_error() -> None:
    """SGE-03 / D-12: a transient/ambiguous error (timeout, 5xx, SSL/DNS blip,
    rate-limit) marks the check 'unverified' and KEEPS the candidate — never a
    kill on a blip. _check_registration is patched explicitly (rather than
    relying on candidate URL fields) so no live Tavily search runs."""
    website = "https://flaky-but-real.example/org"
    candidate = _candidate("Timeout Org", website=website)
    state = {"run_id": "run-test-verify-2", "candidates": [candidate]}
    mock_convex = AsyncMock()

    async with respx.mock(assert_all_called=True) as router:
        # The domain check raises a real httpx timeout — proves the node's
        # own try/except collapses it to None (unverified), never a kill.
        router.get(website).mock(side_effect=httpx.TimeoutException("simulated timeout"))
        with patch(
            "eisenbalm_pipeline.agents.verify_candidates._check_registration",
            AsyncMock(return_value=(None, False)),
        ), patch(
            "eisenbalm_pipeline.agents.verify_candidates._obscurity_press_scan",
            AsyncMock(return_value=1),  # low hit count — genuinely obscure
        ), patch(
            "eisenbalm_pipeline.agents.verify_candidates.convex_mutation_safe",
            mock_convex,
        ):
            result = await verify_candidates(state)

    # KEPT — not killed on the transient domain-check failure.
    assert len(result["candidates"]) == 1
    assert result["candidates"][0]["name"] == "Timeout Org"

    records = result["verification_records"]
    assert len(records) == 1
    record = records[0]
    assert record["killed"] is False
    assert record["killReason"] is None
    assert record["status"] == "unverified"
    # The record's domainLive field is coerced to a bool per the
    # VerificationRecord contract (state.py); the ambiguity itself is
    # captured in status='unverified', not a tri-state domainLive.
    assert record["domainLive"] is False


@pytest.mark.asyncio
async def test_killed_record_has_reason() -> None:
    """SGE-03 / D-13: a killed candidate's VerificationRecord carries a
    non-empty killReason — never silently dropped. Domain check is the SOLE
    definitive failure here (a clean 404); registration IS reachable
    (patched explicitly) and obscurity IS low — proves a single definitive
    signal is sufficient AND that killReason is always populated regardless
    of which check triggered the kill."""
    website = "https://also-fails.example/org"
    reg_url = "https://www.guidestar.org/profile/also-fails"
    candidate = _candidate("Reason Org", website=website)
    state = {"run_id": "run-test-verify-3", "candidates": [candidate]}
    mock_convex = AsyncMock()

    async with respx.mock(assert_all_called=True) as router:
        router.get(website).mock(return_value=httpx.Response(404))
        with patch(
            "eisenbalm_pipeline.agents.verify_candidates._check_registration",
            AsyncMock(return_value=(reg_url, True)),
        ), patch(
            "eisenbalm_pipeline.agents.verify_candidates._obscurity_press_scan",
            AsyncMock(return_value=1),
        ), patch(
            "eisenbalm_pipeline.agents.verify_candidates.convex_mutation_safe",
            mock_convex,
        ):
            result = await verify_candidates(state)

    records = result["verification_records"]
    assert len(records) == 1
    record = records[0]
    assert record["killed"] is True
    assert isinstance(record["killReason"], str) and record["killReason"].strip() != ""
    assert record not in [c for c in result["candidates"]]
