"""Phase 5 iteration-limit tests — Plan 05-14.

Validation: AGT-18 (max_tool_calls enforcement + wrapper event emission).

Per-agent tests in ``test_scout.py`` and ``test_researcher.py`` cover the
in-body raise (the agent's local counter detecting the overrun). This file
exercises the integration surface: the ``@agent_node`` wrapper's behavior
when ``AgentToolCallLimitExceeded`` propagates out of the agent body.

The wrapper MUST emit BOTH:
  1. ``deliberationEvents:insert`` with ``eventType='agent-tool-limit-exceeded'``
     (Plan 05-01 schema literal; D-21 / AGT-18 typed signal).
  2. ``pipelineRuns:updateStatus`` with ``status='failed'``
     (Phase 4 D-27 generic failure path).
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

from eisenbalm_pipeline.agents.researcher import researcher
from eisenbalm_pipeline.agents.scout import scout
from eisenbalm_pipeline.lib.errors import AgentToolCallLimitExceeded


def test_scout_max_tool_calls_constant() -> None:
    """AGT-18: Scout decorator carries max_tool_calls=8."""
    assert scout._max_tool_calls == 8


def test_researcher_max_tool_calls_constant() -> None:
    """AGT-18: Researcher decorator carries max_tool_calls=12."""
    assert researcher._max_tool_calls == 12


async def test_wrapper_emits_tool_limit_event_on_overrun(
    sample_dispatch_state,
) -> None:
    """AGT-18: when AgentToolCallLimitExceeded propagates, the @agent_node
    wrapper emits BOTH a ``deliberationEvents`` row with
    ``eventType='agent-tool-limit-exceeded'`` AND writes
    ``pipelineRuns.status='failed'`` (Phase 4 D-27 + Plan 05-01 schema).
    """
    from eisenbalm_pipeline.agents import scout as scout_mod

    # Force overrun by patching SCOUT_QUERIES to 9 entries (> max_tool_calls=8).
    nine = tuple(f"q{i}" for i in range(9))
    mock_convex = AsyncMock()
    with patch.object(scout_mod, "SCOUT_QUERIES", nine), patch(
        "eisenbalm_pipeline.agents.scout.web_search",
        AsyncMock(return_value=[]),
    ), patch(
        "eisenbalm_pipeline.agents.scout._load_featured_keys",
        AsyncMock(return_value=[]),
    ), patch(
        "eisenbalm_pipeline.agents._wrapper.convex_mutation_safe",
        mock_convex,
    ), patch(
        "eisenbalm_pipeline.agents.scout.convex_mutation_safe",
        mock_convex,
    ):
        with pytest.raises(AgentToolCallLimitExceeded):
            await scout(sample_dispatch_state)

    # 1. pipelineRuns:updateStatus with status='failed' (Phase 4 D-27).
    failed_calls = [
        c for c in mock_convex.call_args_list
        if c.args
        and c.args[0] == "pipelineRuns:updateStatus"
        and isinstance(c.args[1], dict)
        and c.args[1].get("status") == "failed"
    ]
    assert len(failed_calls) >= 1, (
        f"wrapper must write status='failed' on tool-limit overrun; "
        f"got calls: {mock_convex.call_args_list}"
    )
    err_msg = failed_calls[0].args[1].get("errorMessage", "")
    assert "AgentToolCallLimitExceeded" in err_msg, (
        f"errorMessage should follow CONTEXT D-27 format; got {err_msg!r}"
    )

    # 2. deliberationEvents:insert with eventType='agent-tool-limit-exceeded' (D-21).
    tool_limit_events = [
        c for c in mock_convex.call_args_list
        if c.args
        and c.args[0] == "deliberationEvents:insert"
        and isinstance(c.args[1], dict)
        and c.args[1].get("eventType") == "agent-tool-limit-exceeded"
    ]
    assert len(tool_limit_events) >= 1, (
        "Wrapper must emit eventType='agent-tool-limit-exceeded' when "
        "AgentToolCallLimitExceeded is caught (D-21 / AGT-18). "
        f"Convex calls: {mock_convex.call_args_list}"
    )

    # Payload shape: introspectable agent_id / attempts / limit per
    # lib.errors.AgentToolCallLimitExceeded constructor (Plan 05-03).
    event = tool_limit_events[0].args[1]
    assert event["agentId"] == "scout"
    payload = json.loads(event["payload"])
    assert payload["agentId"] == "scout"
    assert payload["limit"] == 8
    assert isinstance(payload.get("attempts"), int)
    assert payload["attempts"] >= 8


async def test_wrapper_event_emits_before_status_failed(
    sample_dispatch_state,
) -> None:
    """AGT-18: deliberationEvents row is written BEFORE pipelineRuns.status='failed'.

    Ordering matters for the deliberation UI: Andrew sees the typed
    'agent-tool-limit-exceeded' event row arrive in real time, then the
    pipelineRun flips to 'failed'. If the order is reversed, a polling
    consumer that watches status could close out the run before reading
    the typed event.
    """
    from eisenbalm_pipeline.agents import scout as scout_mod

    call_order: list[str] = []

    async def _record_call(path: str, args: dict) -> None:
        if path == "deliberationEvents:insert" and args.get("eventType") == "agent-tool-limit-exceeded":
            call_order.append("event")
        elif path == "pipelineRuns:updateStatus" and args.get("status") == "failed":
            call_order.append("failed")

    nine = tuple(f"q{i}" for i in range(9))
    with patch.object(scout_mod, "SCOUT_QUERIES", nine), patch(
        "eisenbalm_pipeline.agents.scout.web_search",
        AsyncMock(return_value=[]),
    ), patch(
        "eisenbalm_pipeline.agents.scout._load_featured_keys",
        AsyncMock(return_value=[]),
    ), patch(
        "eisenbalm_pipeline.agents._wrapper.convex_mutation_safe",
        side_effect=_record_call,
    ), patch(
        "eisenbalm_pipeline.agents.scout.convex_mutation_safe",
        side_effect=_record_call,
    ):
        with pytest.raises(AgentToolCallLimitExceeded):
            await scout(sample_dispatch_state)

    assert "event" in call_order
    assert "failed" in call_order
    assert call_order.index("event") < call_order.index("failed"), (
        f"event must precede status='failed'; got order: {call_order}"
    )
