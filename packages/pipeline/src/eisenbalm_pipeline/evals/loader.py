"""Golden scenario loader (EVL-01, D-01).

Scenarios are versioned repo fixtures — a single JSON manifest
(``evals/scenarios.json``) parsed and Pydantic-validated by this module. Each
scenario is a single-agent fixture (D-02): its ``input`` maps 1:1 onto
``TestRunRequest.variables`` (``api/agents.py``) for ONE ``agentKey``,
executed through the EXISTING ``test-run`` -> ``score`` endpoints. No new
scoring mechanism — this module only owns the fixture shape + lookup.

Every scenario MUST target a test-run-REPLICABLE agentKey (flat
``str.replace("{token}", ...)`` substitution) — never a
``build_section_writer_prompt`` agent (``origin_story``/``problem``/
``founder_bio_*``/``case_study_*`` — 38-RESEARCH.md Pitfall 5). That
guardrail is asserted by ``tests/evals/test_scenario_loader.py`` against the
allowlist of replicable agentKeys.
"""
from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, Field

_SCENARIOS_PATH = Path(__file__).parent / "scenarios.json"


class ScoringTarget(BaseModel):
    """Absolute floor for a scenario's judge ``overall`` score (0-10 scale)."""

    min_overall: float


class Scenario(BaseModel):
    """One golden-scenario fixture (§38.1 shape, docs/API_CONTRACTS.md)."""

    id: str
    agentKey: str
    description: str
    whatItCatches: str
    input: dict[str, str] = Field(
        default_factory=dict,
        description="Maps 1:1 onto TestRunRequest.variables for this agentKey.",
    )
    scoringTarget: ScoringTarget


def _load_all() -> list[Scenario]:
    """Read + Pydantic-validate every scenario in scenarios.json.

    Re-reads from disk on every call (no module-level cache) so an operator
    editing scenarios.json is reflected immediately without a process
    restart — cheap given the fixture set is small (D-03 starter set).
    """
    raw = json.loads(_SCENARIOS_PATH.read_text())
    return [Scenario.model_validate(item) for item in raw]


def list_scenarios(agent_key: str | None = None) -> list[Scenario]:
    """Return all scenarios, optionally filtered to a single ``agentKey``.

    Mirrors the eval drawer's auto-select behavior (D-04): editing agent X's
    prompt selects exactly the scenarios whose ``agentKey == X``.
    """
    scenarios = _load_all()
    if agent_key is None:
        return scenarios
    return [s for s in scenarios if s.agentKey == agent_key]


def get_scenario(scenario_id: str) -> Scenario | None:
    """Return the scenario matching ``scenario_id``, or None if not found."""
    for s in _load_all():
        if s.id == scenario_id:
            return s
    return None
