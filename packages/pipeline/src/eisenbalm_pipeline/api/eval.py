"""Prompt Lab evals + Eval Center pipeline endpoints (Phase 38, EVL-01/EVL-05).

``GET /eval/scenarios`` is a read-only endpoint that parses + returns the
repo-sourced golden-scenario fixtures (D-01, ``evals/loader.py``) as JSON so
the Next.js Eval Center + eval drawer can read them without duplicating
scenario data into Convex (docs/API_CONTRACTS.md §38.1).

``POST /eval/shadow-run`` (EVL-05, §38.4) is a read-only preview of Scout's
live discovery — it calls the PURE ``discover_candidates()`` helper (Plan
38-03, extracted from ``agents/scout.py``) and returns the surviving
candidates, writing NOTHING to Sanity or any Convex run table (D-12
isolation contract).

Auth mirrors ``api/agents.py``'s ``_require_operator`` exactly: an OPTIONAL
bearer so the dev-mode sentinel path (no CLERK_JWT_ISSUER_DOMAIN) is
reachable header-free, while a deployed environment still 401s on a
missing/invalid token.
"""
from __future__ import annotations

from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from eisenbalm_pipeline.agents.scout import discover_candidates
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


class ShadowRunBody(BaseModel):
    """Request body for POST /eval/shadow-run (§38.4)."""

    workspace_id: str


@router.post("/shadow-run")
async def post_shadow_run(
    body: ShadowRunBody,
    _: dict = Depends(_require_operator),
) -> dict:
    """Preview a live Scout discovery run without writing anything (D-11/D-12).

    Calls the pure ``discover_candidates()`` helper directly — NEVER
    ``scout()`` and NEVER ``scout.__wrapped__`` (both would perform the real
    ``write_charity`` + ``pitchLog:insert`` + ``charities:upsertCandidate``
    writes, per RESEARCH Pattern 3). A synthetic ``shadow-{uuid4()}`` run_id
    is used since there is no real pipeline run backing this preview; it only
    scopes the in-memory cost recorder (never flushed to Convex).

    Response shape (§38.4): ``{"candidates": [...], "featuredKeysCount": int}``.
    """
    surviving, featured_keys, _usage = await discover_candidates(
        run_id=f"shadow-{uuid4()}", config=None,
    )
    return {"candidates": surviving, "featuredKeysCount": len(featured_keys)}
