"""Tests for the golden-scenario Pydantic loader (EVL-01, D-01/D-02/D-03).

Covers the loader's contract: 8 validated fixtures, agentKey filtering, id
lookup, and the Pitfall-5 guardrail — every scenario MUST target a
test-run-REPLICABLE agentKey (flat ``{token}`` substitution model), never a
``build_section_writer_prompt`` agent.
"""
from __future__ import annotations

from eisenbalm_pipeline.evals.loader import Scenario, get_scenario, list_scenarios

# Test-run-REPLICABLE agentKeys — the flat `.replace("{token}", ...)`
# substitution model (api/agents.py SAMPLE_FIXTURES). Cross-checked against
# apps/dispatch-control/.../prompt-lab/_components/agentList.ts +
# 38-RESEARCH.md Pitfall 5.
REPLICABLE_AGENT_KEYS = {
    "scout",
    "advocate",
    "calibrator",
    "editor_gate1",
    "editor_final",
    "researcher",
    "game",
    "design",
    "bonus_big_budget",
    "bonus_jingle",
    "bonus_spec_ad",
}

# Section-writer agentKeys whose real prompt is assembled by
# build_section_writer_prompt(...) — test-run does NOT replicate these
# (38-RESEARCH.md Pitfall 5). No golden scenario may target these.
SECTION_WRITER_AGENT_KEYS = {
    "origin_story",
    "problem",
    "founder_bio_verified",
    "founder_bio_anonymous",
    "case_study_verified",
    "case_study_anonymous",
}


def test_list_scenarios_returns_all_eight_validated():
    """list_scenarios() returns all 8 scenarios, each a validated Scenario."""
    scenarios = list_scenarios()
    assert len(scenarios) == 8
    for s in scenarios:
        assert isinstance(s, Scenario)
        assert s.id
        assert s.agentKey
        assert s.description
        assert s.whatItCatches
        assert isinstance(s.input, dict)
        assert isinstance(s.scoringTarget.min_overall, float)


def test_list_scenarios_filters_by_agent_key():
    """list_scenarios(agent_key="scout") returns only scout-keyed scenarios."""
    scout_scenarios = list_scenarios(agent_key="scout")
    assert len(scout_scenarios) > 0
    assert all(s.agentKey == "scout" for s in scout_scenarios)
    assert len(scout_scenarios) < len(list_scenarios())


def test_get_scenario_returns_match_or_none():
    """get_scenario(id) returns the matching scenario, None on unknown id."""
    scenarios = list_scenarios()
    target = scenarios[0]

    found = get_scenario(target.id)
    assert found is not None
    assert found.id == target.id
    assert found.agentKey == target.agentKey

    assert get_scenario("scenario-id-that-does-not-exist") is None


def test_every_scenario_targets_a_replicable_agent_key():
    """Every scenario's agentKey is test-run-replicable, never a
    section-writer key (Pitfall-5 guardrail)."""
    for s in list_scenarios():
        assert s.agentKey in REPLICABLE_AGENT_KEYS, (
            f"scenario {s.id!r} targets non-replicable agentKey "
            f"{s.agentKey!r} — test-run has no SAMPLE_FIXTURES entry / "
            "substitution model for it"
        )
        assert s.agentKey not in SECTION_WRITER_AGENT_KEYS, (
            f"scenario {s.id!r} targets a section-writer agentKey "
            f"{s.agentKey!r} — its real prompt is assembled by "
            "build_section_writer_prompt, which test-run never calls"
        )


def test_every_scenario_id_is_unique():
    """No two scenarios share an id."""
    ids = [s.id for s in list_scenarios()]
    assert len(ids) == len(set(ids))
