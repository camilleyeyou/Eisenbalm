"""Prompt Lab evals + Eval Center pipeline endpoints (Phase 38, EVL-01/EVL-05).

``GET /eval/scenarios`` is a read-only endpoint that parses + returns the
repo-sourced golden-scenario fixtures (D-01, ``evals/loader.py``) as JSON so
the Next.js Eval Center + eval drawer can read them without duplicating
scenario data into Convex (docs/API_CONTRACTS.md §38.1).

Auth mirrors ``api/agents.py``'s ``_require_operator`` exactly: an OPTIONAL
bearer so the dev-mode sentinel path (no CLERK_JWT_ISSUER_DOMAIN) is
reachable header-free, while a deployed environment still 401s on a
missing/invalid token.

NOTE: this module also gains ``POST /eval/shadow-run`` (EVL-05, §38.4) in a
later Phase 38 plan — this file is the shared router for both endpoints.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends

from eisenbalm_pipeline.api.agents import _require_operator
from eisenbalm_pipeline.evals.loader import list_scenarios

router = APIRouter(prefix="/eval")


@router.get("/scenarios")
async def get_eval_scenarios(
    agentKey: Optional[str] = None,
    _: dict = Depends(_require_operator),
) -> dict:
    """Return the golden-scenario fixtures, optionally filtered by agentKey.

    Response shape (§38.1): ``{"scenarios": [Scenario.model_dump(), ...]}``.
    """
    scenarios = list_scenarios(agent_key=agentKey)
    return {"scenarios": [s.model_dump() for s in scenarios]}


# ── Phase 38 Plan 03 adds POST /eval/shadow-run (EVL-05, §38.4) here ─────────
