"""Real-mode token+USD capture in acomplete (quick-260621-d31).

Patches _build_chat_model so the structured/plain extraction runs against a
fake AIMessage. Proves the per-run cost cap is re-armed once REAL usd lands.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage

from eisenbalm_pipeline.agents.calibrator import StyleBriefOutput
from eisenbalm_pipeline.lib import cost as cost_mod
from eisenbalm_pipeline.lib.cost import begin_run, get_cost_payload
from eisenbalm_pipeline.lib.errors import CostCapExceeded
from eisenbalm_pipeline.lib.openrouter_client import acomplete


@pytest.fixture(autouse=True)
def _reset_cost_state():
    cost_mod._warned_runs.clear()
    cost_mod._store.clear()
    cost_mod._start_times.clear()
    yield
    cost_mod._warned_runs.clear()
    cost_mod._store.clear()
    cost_mod._start_times.clear()


@pytest.fixture(autouse=True)
def _real_mode_env(monkeypatch):
    monkeypatch.setenv("EISENBALM_STUB_MODE", "false")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("PIPELINE_COST_CAP_USD", "10.0")
    monkeypatch.setenv("PIPELINE_COST_WARN_PCT", "0.7")


def _fake_raw_message(cost=0.0271, include_cost=True):
    token_usage = {"prompt_tokens": 1200, "completion_tokens": 350, "total_tokens": 1550}
    if include_cost:
        token_usage["cost"] = cost
    return AIMessage(
        content="hello",
        usage_metadata={"input_tokens": 1200, "output_tokens": 350, "total_tokens": 1550},
        response_metadata={"model_name": "anthropic/claude-opus-4-7", "token_usage": token_usage},
    )


def _structured_fake(result):
    structured = MagicMock()
    structured.ainvoke = AsyncMock(return_value=result)
    fake_model = MagicMock()
    fake_model.with_structured_output.return_value = structured
    return fake_model, structured


async def test_structured_capture_records_real_cost():
    begin_run("run-cap-1")
    fake_model, _ = _structured_fake({
        "raw": _fake_raw_message(),
        "parsed": StyleBriefOutput.model_construct(),
        "parsing_error": None,
    })
    with patch("eisenbalm_pipeline.lib.openrouter_client._build_chat_model", return_value=fake_model):
        parsed, usage = await acomplete(
            agent_id="calibrator", run_id="run-cap-1",
            messages=[{"role": "system", "content": "x"}],
            response_format=StyleBriefOutput,
        )
    assert isinstance(parsed, StyleBriefOutput)
    assert usage["tokens_in"] == 1200
    assert usage["tokens_out"] == 350
    assert usage["usd"] == pytest.approx(0.0271)
    payload = get_cost_payload("run-cap-1")
    assert payload["agents"]["calibrator"]["usd"] == pytest.approx(0.0271)  # recorded once
    assert payload["agents"]["calibrator"]["tokens_in"] == 1200


async def test_plain_text_capture_records_real_cost():
    begin_run("run-cap-plain")
    fake_model = MagicMock()
    fake_model.ainvoke = AsyncMock(return_value=_fake_raw_message())
    with patch("eisenbalm_pipeline.lib.openrouter_client._build_chat_model", return_value=fake_model):
        content, usage = await acomplete(
            agent_id="calibrator", run_id="run-cap-plain",
            messages=[{"role": "system", "content": "x"}],
            response_format=None,
        )
    assert content == "hello"
    assert usage["usd"] == pytest.approx(0.0271)
    assert get_cost_payload("run-cap-plain")["agents"]["calibrator"]["usd"] == pytest.approx(0.0271)


async def test_schema_miss_retries_once_and_records_once():
    begin_run("run-retry")
    bad = {"raw": _fake_raw_message(cost=0.99), "parsed": None, "parsing_error": ValueError("bad schema")}
    good = {"raw": _fake_raw_message(cost=0.0271), "parsed": StyleBriefOutput.model_construct(), "parsing_error": None}
    fake_model, structured = _structured_fake(None)
    structured.ainvoke = AsyncMock(side_effect=[bad, good])
    with patch("eisenbalm_pipeline.lib.openrouter_client._build_chat_model", return_value=fake_model):
        parsed, usage = await acomplete(
            agent_id="calibrator", run_id="run-retry",
            messages=[{"role": "system", "content": "x"}],
            response_format=StyleBriefOutput,
        )
    assert structured.ainvoke.call_count == 2
    assert isinstance(parsed, StyleBriefOutput)
    # Cost from the SECOND raw only (0.0271), not the failed 0.99 attempt.
    assert get_cost_payload("run-retry")["agents"]["calibrator"]["usd"] == pytest.approx(0.0271)


async def test_cap_trips_after_real_usd(monkeypatch):
    monkeypatch.setenv("PIPELINE_COST_CAP_USD", "0.01")  # below the 0.0271 we record
    begin_run("run-trip")
    fake_model, _ = _structured_fake({
        "raw": _fake_raw_message(cost=0.0271),
        "parsed": StyleBriefOutput.model_construct(),
        "parsing_error": None,
    })
    with patch("eisenbalm_pipeline.lib.openrouter_client._build_chat_model", return_value=fake_model):
        with pytest.raises(CostCapExceeded):
            await acomplete(
                agent_id="calibrator", run_id="run-trip",
                messages=[{"role": "system", "content": "x"}],
                response_format=StyleBriefOutput,
            )


async def test_cost_absent_records_zero():
    begin_run("run-nocost")
    fake_model, _ = _structured_fake({
        "raw": _fake_raw_message(include_cost=False),
        "parsed": StyleBriefOutput.model_construct(),
        "parsing_error": None,
    })
    with patch("eisenbalm_pipeline.lib.openrouter_client._build_chat_model", return_value=fake_model):
        _, usage = await acomplete(
            agent_id="calibrator", run_id="run-nocost",
            messages=[{"role": "system", "content": "x"}],
            response_format=StyleBriefOutput,
        )
    assert usage["usd"] == 0.0
    assert usage["tokens_in"] == 1200  # tokens still captured
