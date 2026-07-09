"""Golden scenario fixtures + loader (EVL-01, D-01/D-02/D-03).

Scenarios live as versioned repo fixtures (``scenarios.json``); the Eval
Center and eval drawer read them ONLY via ``GET /eval/scenarios``
(``api/eval.py``) — no scenario data is duplicated into Convex.
"""
from __future__ import annotations

from eisenbalm_pipeline.evals.loader import Scenario, get_scenario, list_scenarios

__all__ = ["Scenario", "get_scenario", "list_scenarios"]
