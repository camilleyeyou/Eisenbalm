"""Rate-limit handling in acomplete structured path (quick-261014-kf8)."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage

from eisenbalm_pipeline.agents.calibrator import StyleBriefOutput
from eisenbalm_pipeline.lib import cost as cost_mod
from eisenbalm_pipeline.lib.cost import begin_run, get_cost_payload
from eisenbalm_pipeline.lib.openrouter_client import acomplete

GRAMMAR_MSG = (
    'Error code: 400 - {"error": {"message": "Grammar compilation rate limit '
    'exceeded. ... 50 compilations per minute"}}'
)
SLEEP = "eisenbalm_pipeline.lib.openrouter_client._rate_limit_sleep"
BUILD = "eisenbalm_pipeline.lib.openrouter_client._build_chat_model"


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


def _raw():
    tu = {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15, "cost": 0.01}
    return AIMessage(
        content="hi",
        usage_metadata={"input_tokens": 10, "output_tokens": 5, "total_tokens": 15},
        response_metadata={"model_name": "anthropic/claude-opus-4-7", "token_usage": tu},
    )


def _good():
    return {"raw": _raw(), "parsed": StyleBriefOutput.model_construct(), "parsing_error": None}


def _runnable(side_effect):
    r = MagicMock()
    r.ainvoke = AsyncMock(side_effect=side_effect)
    return r


def _model(*runnables):
    m = MagicMock()
    m.with_structured_output.side_effect = list(runnables)
    return m


async def _call(model, run="r1"):
    begin_run(run)
    with patch(BUILD, return_value=model):
        return await acomplete(
            agent_id="calibrator", run_id=run,
            messages=[{"role": "system", "content": "x"}],
            response_format=StyleBriefOutput,
        )


async def test_grammar_limit_falls_back_to_function_calling():
    strict = _runnable([Exception(GRAMMAR_MSG)])
    fc = _runnable([_good()])
    model = _model(strict, fc)
    with patch(SLEEP, new=AsyncMock()) as sleep:
        parsed, _ = await _call(model)
    assert isinstance(parsed, StyleBriefOutput)
    first, second = model.with_structured_output.call_args_list
    assert "method" not in first.kwargs
    assert second.kwargs["method"] == "function_calling"
    assert second.kwargs["include_raw"] is True
    sleep.assert_not_awaited()
    assert get_cost_payload("r1")["agents"]["calibrator"]["retries"] == 1


class _StatusErr(Exception):
    status_code = 429


@pytest.mark.parametrize(
    "exc",
    [Exception("Error code: 429 - rate limit exceeded"), _StatusErr("slow down")],
)
async def test_generic_429_backs_off_then_succeeds(exc):
    runnable = _runnable([exc, _good()])
    model = _model(runnable)
    with patch(SLEEP, new=AsyncMock()) as sleep:
        await _call(model)
    sleep.assert_awaited_once()
    delay = sleep.await_args.args[0]
    assert isinstance(delay, float) and 0 < delay <= 10
    assert model.with_structured_output.call_count == 1
    assert get_cost_payload("r1")["agents"]["calibrator"]["retries"] == 1


async def test_non_rate_limit_error_retries_immediately_once():
    runnable = _runnable([RuntimeError("connection reset"), _good()])
    with patch(SLEEP, new=AsyncMock()) as sleep:
        await _call(_model(runnable))
    assert runnable.ainvoke.call_count == 2
    sleep.assert_not_awaited()

    bad = _runnable([RuntimeError("a"), RuntimeError("b")])
    with patch(SLEEP, new=AsyncMock()), pytest.raises(RuntimeError):
        await _call(_model(bad), run="r2")


async def test_persistent_grammar_error_raises_after_two_retries():
    strict = _runnable([Exception(GRAMMAR_MSG)] * 3)
    fc = _runnable([Exception(GRAMMAR_MSG)] * 3)
    with patch(SLEEP, new=AsyncMock()) as sleep:
        with pytest.raises(Exception, match="Grammar compilation"):
            await _call(_model(strict, fc))
    assert strict.ainvoke.call_count + fc.ainvoke.call_count == 3
    assert sleep.await_count == 1


async def test_schema_miss_after_fallback_uses_function_calling_runnable():
    strict = _runnable([Exception(GRAMMAR_MSG)])
    bad = {"raw": _raw(), "parsed": None, "parsing_error": ValueError("nope")}
    fc = _runnable([bad, _good()])
    with patch(SLEEP, new=AsyncMock()):
        parsed, _ = await _call(_model(strict, fc))
    assert isinstance(parsed, StyleBriefOutput)
    assert strict.ainvoke.call_count == 1
    assert fc.ainvoke.call_count == 2
