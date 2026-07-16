"""Phase 46 Plan 05 — verify_candidates unit tests (SGE-03).

Validation: SGE-03 (domain-live / registration / obscurity checks, kill-only-
on-definitive-failure, killReason never silently dropped). Mirrors
tests/agents/test_verify.py's shape — the precedent this node mirrors.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest
import respx

from eisenbalm_pipeline.agents.verify_candidates import (
    OBSCURITY_FAIL_MIN_HITS,
    verify_candidates,
)


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
async def test_kills_definitive_failure() -> None:
    """SGE-03 / D-12: a candidate is killed only on a DEFINITIVE failure
    (domain does not resolve, no registration found, clearly not-obscure)."""
    website = "https://definitely-fails.example/org"
    candidate = _candidate("Definite Fail Org", website=website)  # no registration fields at all
    state = {"run_id": "run-test-verify-1", "candidates": [candidate]}
    mock_convex = AsyncMock()

    async with respx.mock(assert_all_called=True) as router:
        router.get(website).mock(return_value=httpx.Response(404))
        with patch(
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
    kill on a blip."""
    website = "https://flaky-but-real.example/org"
    reg_url = "https://charitynavigator.example/org/flaky-but-real"
    candidate = _candidate(
        "Timeout Org", website=website, charity_navigator_url=reg_url,
    )
    state = {"run_id": "run-test-verify-2", "candidates": [candidate]}
    mock_convex = AsyncMock()

    async with respx.mock(assert_all_called=True) as router:
        # The domain check raises a real httpx timeout — proves the node's
        # own try/except collapses it to None (unverified), never a kill.
        router.get(website).mock(side_effect=httpx.TimeoutException("simulated timeout"))
        router.get(reg_url).mock(return_value=httpx.Response(200))
        with patch(
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
    non-empty killReason — never silently dropped."""
    website = "https://also-fails.example/org"
    reg_url = "https://guidestar.example/org/also-fails"
    candidate = _candidate(
        "Reason Org", website=website, guidestar_url=reg_url,
    )
    state = {"run_id": "run-test-verify-3", "candidates": [candidate]}
    mock_convex = AsyncMock()

    async with respx.mock(assert_all_called=True) as router:
        # Domain check is the SOLE definitive failure here (a clean 404);
        # registration IS reachable and obscurity IS low — proves a single
        # definitive signal is sufficient AND that killReason is always
        # populated regardless of which check triggered the kill.
        router.get(website).mock(return_value=httpx.Response(404))
        router.get(reg_url).mock(return_value=httpx.Response(200))
        with patch(
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
