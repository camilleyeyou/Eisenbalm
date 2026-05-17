"""Shared Phase 5 exception classes.

Defining both exceptions in one module avoids split definitions across
lib/cost.py + agents/scout.py + agents/researcher.py + agents/_wrapper.py.
Every consumer imports from ``eisenbalm_pipeline.lib.errors``.
"""
from __future__ import annotations


class CostCapExceeded(Exception):
    """Raised by ``CostRecorder.check_cap()`` when per-run cost exceeds
    ``PIPELINE_COST_CAP_USD`` (D-08, AGT-18).

    The ``@agent_node`` wrapper's generic exception handler catches this and
    writes ``pipelineRuns.status='failed'`` with errorMessage per CONTEXT D-27.
    """

    def __init__(self, total_usd: float, cap_usd: float, agent_id: str) -> None:
        self.total_usd = total_usd
        self.cap_usd = cap_usd
        self.agent_id = agent_id
        super().__init__(
            f"cost-cap-exceeded: ${total_usd:.2f} of ${cap_usd:.2f} "
            f"(agent: {agent_id})"
        )


class AgentToolCallLimitExceeded(Exception):
    """Raised when an ``@agent_node`` body exceeds its ``max_tool_calls`` budget (D-21, AGT-18).

    Plan 05-14 wires ``agents/_wrapper.py`` so this exception class also
    emits a ``deliberationEvents:insert`` row with
    ``eventType='agent-tool-limit-exceeded'`` (Plan 05-01 schema patch)
    before the wrapper writes ``pipelineRuns.status='failed'``.
    """

    def __init__(self, agent_id: str, attempts: int, limit: int) -> None:
        self.agent_id = agent_id
        self.attempts = attempts
        self.limit = limit
        super().__init__(
            f"{agent_id}: tool-call-limit-exceeded: {attempts} of {limit}"
        )
