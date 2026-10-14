"""Phase 51.1 Plan 03 Task 2 — attach_verdicts unit tests (LLM mocked)."""
from __future__ import annotations

import pytest

from eisenbalm_pipeline.lib.claim_verdicts import (
    FACT_CHECK_SYSTEM_PROMPT,
    NO_SOURCES_EVIDENCE,
    VERDICT_FIELDS,
    ClaimVerdict,
    VerdictBatch,
    attach_verdicts,
)
from eisenbalm_pipeline.lib.errors import CostCapExceeded

USAGE = {"resolved_model": "anthropic/claude-haiku-4-5", "tokens_in": 1, "tokens_out": 1, "usd": 0.0}


def _sources(n):
    return [
        {"index": i, "url": f"https://src{i}.org/p", "title": f"T{i}", "content": f"passage {i}",
         "retrievedAt": 1700000000000}
        for i in range(n)
    ]


def _rows(n):
    return [
        {"claimIndex": i, "text": f"Claim {i} happened in 2015.", "claimType": "date", "context": "",
         "sectionName": "originStory", "importance": "Supporting"}
        for i in range(n)
    ]


def _cv(idx, verdict, evidence="e", src=()):
    return ClaimVerdict(claimIndex=idx, verdict=verdict, evidence=evidence, sourceIndexes=list(src))


@pytest.fixture
def fake(monkeypatch):
    state = {"calls": [], "responder": lambda call_no, messages: VerdictBatch(verdicts=[]), "raises": None}

    async def _fake(*, agent_id, run_id, messages, response_format=None):
        state["calls"].append({"agent_id": agent_id, "run_id": run_id, "messages": messages})
        if state["raises"]:
            raise state["raises"]
        return state["responder"](len(state["calls"]) - 1, messages), USAGE

    monkeypatch.setattr("eisenbalm_pipeline.lib.claim_verdicts.acomplete", _fake)
    return state


def _set(fake, verdicts):
    fake["responder"] = lambda n, m: VerdictBatch(verdicts=verdicts)


async def test_maps_source_indexes_to_urls(fake):
    src = _sources(2)
    _set(fake, [_cv(0, "verified", "S1 states it", [1])])
    out = await attach_verdicts("r", _rows(1), src)
    assert out[0]["verdict"] == "verified"
    assert out[0]["verdictSources"] == [src[1]["url"]]


@pytest.mark.parametrize("idx", [[], [99]])
async def test_contradicted_without_valid_citation_downgraded(fake, idx):
    _set(fake, [_cv(0, "contradicted", "x", idx)])
    out = await attach_verdicts("r", _rows(1), _sources(2))
    assert out[0]["verdict"] == "unverifiable"
    assert out[0]["verdictSources"] == []


async def test_verified_without_citation_downgraded(fake):
    _set(fake, [_cv(0, "verified", "x", [])])
    out = await attach_verdicts("r", _rows(1), _sources(2))
    assert out[0]["verdict"] == "unverifiable"


async def test_out_of_range_indexes_dropped_valid_kept(fake):
    src = _sources(2)
    _set(fake, [_cv(0, "contradicted", "x", [0, 99])])
    out = await attach_verdicts("r", _rows(1), src)
    assert out[0]["verdict"] == "contradicted"
    assert out[0]["verdictSources"] == [src[0]["url"]]


async def test_omitted_claim_gets_no_verdict(fake):
    _set(fake, [_cv(0, "verified", "x", [0])])
    out = await attach_verdicts("r", _rows(2), _sources(1))
    assert out[0]["verdict"] == "verified"
    assert all(k not in out[1] for k in VERDICT_FIELDS)


async def test_unknown_and_duplicate_claim_index_first_wins(fake):
    _set(fake, [_cv(7, "verified", "x", [0]), _cv(0, "contradicted", "first", [0]),
                _cv(0, "verified", "second", [0])])
    out = await attach_verdicts("r", _rows(1), _sources(1))
    assert out[0]["verdict"] == "contradicted"
    assert out[0]["verdictEvidence"] == "first"


async def test_evidence_clipped_to_400(fake):
    _set(fake, [_cv(0, "verified", "y" * 1000, [0])])
    out = await attach_verdicts("r", _rows(1), _sources(1))
    assert len(out[0]["verdictEvidence"]) == 400


async def test_single_call_for_100_claims(fake):
    await attach_verdicts("r", _rows(100), _sources(2))
    assert len(fake["calls"]) == 1
    assert fake["calls"][0]["agent_id"] == "fact_check"


async def test_chunks_at_120(fake):
    def responder(n, messages):
        return VerdictBatch(verdicts=[_cv(0, "verified", f"chunk{n}", [0])])

    fake["responder"] = responder
    out = await attach_verdicts("r", _rows(250), _sources(1))
    assert len(fake["calls"]) == 3
    for c in fake["calls"]:
        assert "[C0]" in c["messages"][1]["content"]
    assert "[C119]" in fake["calls"][0]["messages"][1]["content"]
    assert "[C9]" in fake["calls"][2]["messages"][1]["content"]
    assert "[C10]" not in fake["calls"][2]["messages"][1]["content"]
    assert out[0]["verdictEvidence"] == "chunk0"
    assert out[120]["verdictEvidence"] == "chunk1"
    assert out[240]["verdictEvidence"] == "chunk2"
    assert "verdict" not in out[1]


async def test_zero_sources_unverifiable_without_call(fake):
    out = await attach_verdicts("r", _rows(3), [])
    assert fake["calls"] == []
    for row in out:
        assert row["verdict"] == "unverifiable"
        assert row["verdictEvidence"] == NO_SOURCES_EVIDENCE
        assert row["verdictSources"] == []
        assert "verdictModel" not in row
        assert isinstance(row["verdictAt"], int)


async def test_zero_claims_no_call(fake):
    assert await attach_verdicts("r", [], _sources(2)) == []
    assert fake["calls"] == []


async def test_stub_empty_batch_yields_no_verdicts(fake):
    fake["responder"] = lambda n, m: VerdictBatch.model_construct()
    out = await attach_verdicts("r", _rows(2), _sources(1))
    assert all("verdict" not in r for r in out)


async def test_cost_cap_exceeded_propagates(fake):
    fake["raises"] = CostCapExceeded(1.0, 0.5, "fact_check")
    with pytest.raises(CostCapExceeded):
        await attach_verdicts("r", _rows(1), _sources(1))


async def test_model_and_timestamp_stamped(fake):
    _set(fake, [_cv(0, "unverifiable", "x", [])])
    out = await attach_verdicts("r", _rows(1), _sources(1))
    assert out[0]["verdictModel"] == USAGE["resolved_model"]
    assert isinstance(out[0]["verdictAt"], int)


async def test_input_rows_not_mutated(fake):
    _set(fake, [_cv(0, "verified", "x", [0])])
    rows = _rows(1)
    await attach_verdicts("r", rows, _sources(1))
    assert "verdict" not in rows[0]


async def test_prompt_is_index_bound(fake):
    await attach_verdicts("r", _rows(1), _sources(1))
    msgs = fake["calls"][0]["messages"]
    assert "[S0]" in msgs[1]["content"] and "[C0]" in msgs[1]["content"]
    assert "Never use outside knowledge" in FACT_CHECK_SYSTEM_PROMPT
    assert "never URLs" in FACT_CHECK_SYSTEM_PROMPT
    assert "provide URL" not in FACT_CHECK_SYSTEM_PROMPT.lower()
