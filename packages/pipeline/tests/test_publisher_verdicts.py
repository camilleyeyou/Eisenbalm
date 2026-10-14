"""Phase 51.1 Plan 04 — publisher wires sentence-level rows + agent verdicts.

API_CONTRACTS §51.1.4-§51.1.6. All Convex / Sanity / LLM boundaries mocked.
"""

from __future__ import annotations

import pytest

import eisenbalm_pipeline.agents._wrapper as _wrapper_mod
import eisenbalm_pipeline.agents.publisher as _publisher_mod
import eisenbalm_pipeline.lib.claim_verdicts as _cv_mod
from eisenbalm_pipeline.lib.claim_verdicts import VerdictBatch
from eisenbalm_pipeline.lib.cost import record_cost
from eisenbalm_pipeline.lib.errors import CostCapExceeded

VERDICT_KEYS = ("verdict", "verdictEvidence", "verdictSources", "verdictAt", "verdictModel")


def _patch_network_boundary(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, dict]]:
    calls: list[tuple[str, dict]] = []

    async def _fake_convex_mutation_safe(name, payload=None):
        calls.append((name, payload))
        return None

    async def _fake_write_issue_draft(sanity_http, state, cost_payload):
        return "sanity-issue-test-id"

    monkeypatch.setattr(_publisher_mod, "convex_mutation_safe", _fake_convex_mutation_safe)
    monkeypatch.setattr(_wrapper_mod, "convex_mutation_safe", _fake_convex_mutation_safe)
    monkeypatch.setattr(_publisher_mod, "write_issue_draft", _fake_write_issue_draft)
    monkeypatch.setattr(_publisher_mod, "get_sanity_http", lambda: object())
    return calls


def _insert_batch_claims(calls: list[tuple[str, dict]]) -> list[dict]:
    for name, payload in calls:
        if name == "claimChecks:insertBatch":
            return payload["claims"]
    raise AssertionError("claimChecks:insertBatch was never called")


def _status_calls(calls: list[tuple[str, dict]]) -> list[dict]:
    return [p for n, p in calls if n == "pipelineRuns:updateStatus"]


def _state(run_id: str, **extra) -> dict:
    base = {
        "run_id": run_id,
        "issue_number": 1,
        "winning_charity": {},
        "research": {"claims": []},
        "origin_story": {
            "body": [
                {"type": "paragraph", "text": "Volunteers have staffed the hotline every night since 2004."},
            ],
        },
    }
    base.update(extra)
    return base


async def test_rows_carry_verdicts_from_attach(monkeypatch):
    calls = _patch_network_boundary(monkeypatch)

    async def fake(run_id, claim_rows, sources, research=None):
        return [
            {
                **r,
                "verdict": "contradicted",
                "verdictEvidence": "S0 says 1999",
                "verdictSources": ["https://s0.org"],
                "verdictAt": 1,
                "verdictModel": "anthropic/claude-haiku-4-5",
            }
            for r in claim_rows
        ]

    monkeypatch.setattr(_publisher_mod, "attach_verdicts", fake)
    await _publisher_mod.publisher(_state("run-vrd-carry"))
    claims = _insert_batch_claims(calls)
    assert claims
    for row in claims:
        for k in VERDICT_KEYS:
            assert k in row
        assert row["verdict"] == "contradicted"


async def test_verdict_call_happens_before_end_run(monkeypatch):
    _patch_network_boundary(monkeypatch)
    order: list[str] = []
    real_end_run = _publisher_mod.end_run

    def spy_end_run(run_id):
        order.append("end_run")
        return real_end_run(run_id)

    async def fake(run_id, claim_rows, sources, research=None):
        order.append("attach_verdicts")
        return claim_rows

    monkeypatch.setattr(_publisher_mod, "end_run", spy_end_run)
    monkeypatch.setattr(_publisher_mod, "attach_verdicts", fake)
    await _publisher_mod.publisher(_state("run-vrd-order"))
    assert order.index("attach_verdicts") < order.index("end_run")


async def test_fact_check_cost_lands_in_run_cost_payload(monkeypatch):
    calls = _patch_network_boundary(monkeypatch)

    async def fake_acomplete(*, agent_id, run_id, messages, response_format=None, **kw):
        record_cost(run_id, "fact_check", tokens_in=10, tokens_out=5, usd=0.01)
        return VerdictBatch(), {"resolved_model": "anthropic/claude-haiku-4-5"}

    monkeypatch.setattr(_cv_mod, "acomplete", fake_acomplete)
    state = _state(
        "run-vrd-cost",
        research_sources=[
            {"index": 0, "url": "https://s0.org", "title": "S0", "content": "Founded in 1999."}
        ],
    )
    await _publisher_mod.publisher(state)
    statuses = _status_calls(calls)
    assert statuses
    assert "fact_check" in statuses[-1]["cost"]


async def test_verdict_failure_rows_inserted_unverdicted_and_run_lands(monkeypatch):
    calls = _patch_network_boundary(monkeypatch)

    async def fake(run_id, claim_rows, sources, research=None):
        raise RuntimeError("boom")

    monkeypatch.setattr(_publisher_mod, "attach_verdicts", fake)
    await _publisher_mod.publisher(_state("run-vrd-fail"))
    claims = _insert_batch_claims(calls)
    assert len(claims) >= 1
    for row in claims:
        assert not any(k in row for k in VERDICT_KEYS)
    assert any(p.get("status") == "awaiting-review" for p in _status_calls(calls))


async def test_cost_cap_exceeded_propagates(monkeypatch):
    _patch_network_boundary(monkeypatch)

    async def fake(run_id, claim_rows, sources, research=None):
        raise CostCapExceeded(1.0, 0.5, "fact_check")

    monkeypatch.setattr(_publisher_mod, "attach_verdicts", fake)
    with pytest.raises(CostCapExceeded):
        await _publisher_mod.publisher(_state("run-vrd-cap"))


async def test_unsourced_rows_are_sentences_not_tokens(monkeypatch):
    calls = _patch_network_boundary(monkeypatch)
    sentence = "Tameka Diaz founded the program in 2015 to mark Rare Disease Day."
    state = _state(
        "run-vrd-sentence",
        origin_story={"body": [{"type": "paragraph", "text": sentence}]},
    )
    await _publisher_mod.publisher(state)
    claims = _insert_batch_claims(calls)
    unsourced = [c for c in claims if c.get("claimType") != "sourced"]
    assert len(unsourced) == 1
    assert unsourced[0]["text"] == sentence
    assert not {c["text"] for c in claims} & {"2015", "Tameka Diaz", "Rare Disease Day"}


async def test_sentence_containing_claimspan_is_dropped(monkeypatch):
    calls = _patch_network_boundary(monkeypatch)
    state = _state(
        "run-vrd-covered",
        research={"claims": [{"claimId": "a-0", "text": "$2.3M", "importance": "Supporting"}]},
        origin_story={
            "body": [{"type": "paragraph", "text": "The charity had a $2.3M budget, founded in 1998."}],
            "claimSpans": [{"claimId": "a-0", "asWritten": "$2.3M"}],
        },
    )
    await _publisher_mod.publisher(state)
    claims = _insert_batch_claims(calls)
    assert len(claims) == 1
    assert claims[0]["claimType"] == "sourced"


async def test_known_entity_only_sentence_not_seeded(monkeypatch):
    calls = _patch_network_boundary(monkeypatch)
    state = _state(
        "run-vrd-entity",
        winning_charity={"name": "Riverside Trust"},
        origin_story={
            "body": [{"type": "paragraph", "text": "Riverside Trust keeps a quiet office downtown."}]
        },
    )
    await _publisher_mod.publisher(state)
    assert _insert_batch_claims(calls) == []


async def test_missing_research_sources_tolerated(monkeypatch):
    calls = _patch_network_boundary(monkeypatch)

    async def must_not_call(*a, **k):
        raise AssertionError("acomplete must not be called without sources")

    monkeypatch.setattr(_cv_mod, "acomplete", must_not_call)
    state = _state("run-vrd-nosrc")
    assert "research_sources" not in state
    await _publisher_mod.publisher(state)
    claims = _insert_batch_claims(calls)
    assert claims
    assert all(r["verdict"] == "unverifiable" for r in claims)
    assert any(p.get("status") == "awaiting-review" for p in _status_calls(calls))
