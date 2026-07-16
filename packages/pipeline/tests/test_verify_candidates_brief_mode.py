"""Phase 48 Wave 0 — verify_candidates brief-mode CHARACTERIZATION test (ENT-04).

48-RESEARCH.md ("verify_candidates needs ZERO functional code changes"): the
existing node already returns a bare partial dict
({"candidates": survivors, "verification_records": records}) that NEVER
touches state['winning_charity'], and it already persists each
VerificationRecord unconditionally inside the per-candidate loop, BEFORE the
kill decision is applied. D-11's "advisory, never blocks" posture on a
brief-mode run is already the node's natural behavior on a single
human-supplied org — this file CHARACTERIZES that behavior.

Unlike every other Wave 0 scaffold in this plan, this file runs GREEN TODAY
— no Wave 2+ code change is required for ENT-04's verify_candidates half.
(ENT-02's graph-fork routing is what NEW-ly places verify_candidates on the
brief path — see test_builder_entry_mode_wiring.py — but the node itself
needs no change.)

Mirrors tests/agents/test_verify_candidates.py's mocking idiom exactly
(respx for the httpx calls, patch _obscurity_press_scan + convex_mutation_safe).
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


def _human_org(name: str, *, website: str) -> dict:
    """A human-supplied brief-mode org — name-only, no scouted fields
    (§48.3's winning_charity seed shape: every unscouted field defaulted
    ""/None, mirroring agents/editor.py's D-14 synthetic-winner precedent)."""
    return {
        "name": name,
        "location": "",
        "website": website,
        "charityNavigatorUrl": None,
        "guidestarUrl": None,
        "foundingYear": None,
        "assetRange": "",
        "focusArea": "",
        "missionStatement": "",
        "scoutSummary": "",
        "whyOverlooked": "",
        "advocateArgument": None,
        "advocateScore": None,
    }


@pytest.mark.asyncio
async def test_single_human_org_definitively_killed_still_gets_a_record() -> None:
    """ENT-04: even when the ONE human-chosen org is definitively killed, its
    VerificationRecord is persisted exactly once — the record is never
    absent."""
    website = "https://definitely-fails.example/org"
    org = _human_org("Definite Fail Org", website=website)
    state = {"run_id": "run-brief-test-1", "entry_mode": "brief", "candidates": [org]}
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

    insert_calls = [
        c for c in mock_convex.call_args_list if c.args and c.args[0] == "verificationRecords:insert"
    ]
    assert len(insert_calls) == 1, (
        "ENT-04: exactly one verificationRecords:insert must fire for the "
        "single human org, even when it gets killed."
    )
    assert insert_calls[0].args[1]["candidateName"] == "Definite Fail Org"
    assert insert_calls[0].args[1]["killed"] is True

    records = result["verification_records"]
    assert len(records) == 1
    assert records[0]["killed"] is True
    assert records[0]["candidateName"] == "Definite Fail Org"


@pytest.mark.asyncio
async def test_kill_never_touches_winning_charity_advisory_only() -> None:
    """D-11: verify_candidates returns ONLY {candidates, verification_records}
    — 'winning_charity' is never a key in its return dict, so a killed single
    candidate cannot remove state['winning_charity']. The kill is advisory:
    candidates comes back empty, but the run itself is not halted by this
    node (researcher, the very next node on the brief path, never reads
    state['candidates'] — only state['winning_charity'])."""
    website = "https://also-fails.example/org"
    org = _human_org("Also Fails Org", website=website)
    state = {
        "run_id": "run-brief-test-2",
        "entry_mode": "brief",
        "candidates": [org],
        # Seeded by _start_run alongside candidates (§48.3, D-04/D-05) —
        # winning_charity and candidates[0] are the SAME dict on a brief run.
        "winning_charity": org,
    }
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

    assert "winning_charity" not in result, (
        "verify_candidates must return a bare {candidates, verification_records} "
        "partial dict — never touching winning_charity (D-11 advisory posture)."
    )
    assert result["candidates"] == [], "the killed single candidate is dropped from candidates."
    assert len(result["verification_records"]) == 1
    assert result["verification_records"][0]["killed"] is True
    # The caller's own state dict is unmodified by this call — verify_candidates
    # never reads or writes state['winning_charity'] directly.
    assert state["winning_charity"] == org


@pytest.mark.asyncio
async def test_single_human_org_kept_on_pass_still_gets_a_record() -> None:
    """ENT-04 (positive case): a human org that PASSES every check still gets
    exactly one VerificationRecord persisted, and survives into candidates —
    the record is never absent on the happy path either."""
    website = "https://genuinely-obscure.example/org"
    reg_url = "https://charitynavigator.example/org/genuinely-obscure"
    org = _human_org("Genuinely Obscure Org", website=website)
    org["charityNavigatorUrl"] = reg_url
    state = {"run_id": "run-brief-test-3", "entry_mode": "brief", "candidates": [org]}
    mock_convex = AsyncMock()

    async with respx.mock(assert_all_called=True) as router:
        router.get(website).mock(return_value=httpx.Response(200))
        router.get(reg_url).mock(return_value=httpx.Response(200))
        with patch(
            "eisenbalm_pipeline.agents.verify_candidates._obscurity_press_scan",
            AsyncMock(return_value=1),
        ), patch(
            "eisenbalm_pipeline.agents.verify_candidates.convex_mutation_safe",
            mock_convex,
        ):
            result = await verify_candidates(state)

    insert_calls = [
        c for c in mock_convex.call_args_list if c.args and c.args[0] == "verificationRecords:insert"
    ]
    assert len(insert_calls) == 1
    assert insert_calls[0].args[1]["killed"] is False
    assert insert_calls[0].args[1]["status"] == "pass"

    assert result["candidates"] == [org]
    assert len(result["verification_records"]) == 1
    assert result["verification_records"][0]["killed"] is False
