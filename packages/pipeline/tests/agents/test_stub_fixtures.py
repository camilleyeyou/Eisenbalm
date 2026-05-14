"""Stub fixture TypedDict shape validation (PIP-04).

Plan 10 will parametrize over the 14+1 (gate 1 + final) agent fixtures and
assert each returns a partial DispatchState with the required keys for its
agent.

Source: 04-CONTEXT.md D-16, 04-VALIDATION.md, docs/CLAUDE_CODE_BRIEF.md
§"The nine-agent pipeline".

The 14 agents (CONTEXT D-05, editor counted twice — gate 1 + final):
calibrator, scout, advocate, editor_gate_1, researcher, origin_story,
problem, founder_bio, case_study, game, bonus, design, qa, editor_final,
publisher.
"""
from __future__ import annotations

import pytest


AGENT_NAMES = [
    "calibrator",
    "scout",
    "advocate",
    "editor_gate_1",
    "researcher",
    "origin_story",
    "problem",
    "founder_bio",
    "case_study",
    "game",
    "bonus",
    "design",
    "qa",
    "editor_final",
    "publisher",
]


@pytest.mark.skip(reason="Pending Plan 04-10: parametrize over stub fixtures")
@pytest.mark.parametrize("agent_name", AGENT_NAMES)
def test_stub_fixture_returns_valid_dispatch_state_shape(agent_name):
    """PIP-04: Each agent stub returns a partial DispatchState containing the
    keys its contract owns (see API_CONTRACTS.md §7).
    """
    pass
