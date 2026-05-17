"""Phase 5 Advocate — scores each Scout candidate (Haiku via OpenRouter).

Replaces Phase 4 stub. Responsibilities:

  1. Receive state['candidates'] from Scout (Plan 05-06).
  2. Call OpenRouter (Haiku, low-temp) ONCE over all candidates.
  3. Parse AdvocateOutput Pydantic (list of AdvocateVote).
  4. For each vote: write one agentVotes:insert row + one
     deliberationEvents:insert with eventType='advocate-argument'.
  5. Record resolved model into state['model_versions']['advocate'] (AGT-17).

emit_event=None: per-candidate events are emitted manually inside the body
(one row per vote). The @agent_node decorator's single emission is suppressed
because Advocate is fundamentally per-candidate.

Per-candidate Convex shapes are canonical per:
  - docs/API_CONTRACTS.md §3.5 (agentVotes:insert) — vote='for', includes charityName
  - docs/API_CONTRACTS.md §3.4 (deliberationEvents:insert) — eventType='advocate-argument'

The Convex agentVotes validator union is ('for' | 'against' | 'abstain');
Advocate always emits 'for' since the agent's role is to advocate. (Plan
05-07 text references 'yes' — superseded here by the canonical schema per
CLAUDE.md "do not modify field names without checking API_CONTRACTS.md".)
"""
from __future__ import annotations

import json

from pydantic import BaseModel, Field
from slugify import slugify

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
from eisenbalm_pipeline.lib.openrouter_client import acomplete


class AdvocateVote(BaseModel):
    """AGT-05 per-candidate Pydantic shape (RESEARCH §Advocate lines 447-453)."""

    charityName: str
    score: int = Field(description="integer 1-10, where 10 is strongest case")
    argument: str = Field(
        description="150-250 word argument for this charity in Jesse voice",
    )
    keyStrengths: list[str] = Field(
        default_factory=list,
        description="2-4 key strengths of this charity",
    )
    primaryConcern: str


class AdvocateOutput(BaseModel):
    """Top-level shape returned by the LLM."""

    votes: list[AdvocateVote]


def _build_messages(*, candidates: list[dict]) -> list[dict]:
    """System prompt embeds Advocate's voice + scoring rule.

    Sourced from RESEARCH §Advocate lines 434-445 + lib/voice.py constraints.
    Kept short: Haiku rewards a tight prompt.
    """
    candidates_json = json.dumps(candidates, indent=2, default=str)
    system = (
        "You are the Advocate for The Eisenbalm Dispatch. Score each Scout "
        "candidate 1-10 with a written argument. Surface the case for each "
        "charity without editorializing. Dry. Precise. Serious. No winking. "
        "No exclamation marks. Treat every charity with Fortune-500 gravity.\n\n"
        "For each candidate output:\n"
        "  - score (int, 1-10)\n"
        "  - argument (150-250 words, Jesse voice)\n"
        "  - keyStrengths (2-4 items)\n"
        "  - primaryConcern (one sentence)"
    )
    user = (
        f"CANDIDATES (Scout output, JSON):\n{candidates_json}\n\n"
        "Return JSON AdvocateOutput with field `votes` (one AdvocateVote "
        "per candidate, same order as input)."
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _charity_id_for(name: str) -> str:
    """Deterministic Sanity charity _id (matches lib/sanity_client:write_charity).

    Scout already wrote the same row under this _id; Advocate just re-derives
    for the agentVotes/deliberationEvents charityId field. Phase 1 D-17 +
    Phase 4 D-18 deterministic-_id pattern.

    Uses python-slugify (same library Scout uses), so casing, spaces, and
    punctuation collapse to a stable kebab-cased slug.
    """
    return f"charity-{slugify(name)}"


@agent_node(name="advocate", emit_event=None)
async def advocate(state: DispatchState) -> DispatchState:
    run_id = state["run_id"]
    candidates = state.get("candidates") or []

    messages = _build_messages(candidates=candidates)
    out_obj, usage = await acomplete(
        agent_id="advocate",
        run_id=run_id,
        messages=messages,
        response_format=AdvocateOutput,
    )

    # `out_obj` is normally an AdvocateOutput (real mode). Stub-mode
    # ``acomplete`` returns ``response_format.model_construct()`` which
    # SKIPS field defaults — so ``hasattr(out_obj, 'votes')`` is False
    # when stub-mode kicks in (votes is a required field without default).
    # Tolerate all three shapes (Pydantic instance, dict, model_construct
    # empty shell) before defaulting to an empty list.
    if hasattr(out_obj, "votes"):
        votes_raw = out_obj.votes
    elif isinstance(out_obj, dict):
        votes_raw = out_obj.get("votes", [])
    else:
        votes_raw = []

    votes_serialized: list[dict] = []
    for v_raw in votes_raw or []:
        v = (
            v_raw if isinstance(v_raw, AdvocateVote)
            else AdvocateVote(**v_raw)
        )
        charity_id = _charity_id_for(v.charityName)

        # 1. agentVotes:insert (API_CONTRACTS §3.5). Convex schema requires
        #    vote='for' | 'against' | 'abstain' + charityName denormalized.
        #    Score is NOT a Convex agentVotes field — it lives on the
        #    deliberation event payload below.
        await convex_mutation_safe(
            "agentVotes:insert",
            {
                "runId": run_id,
                "agentId": "advocate",
                "charityId": charity_id,
                "charityName": v.charityName,
                "vote": "for",
                "reasoning": v.argument,
            },
        )

        # 2. deliberationEvents:insert with eventType='advocate-argument'
        #    (API_CONTRACTS §3.4; Plan 05-01 patched union accepts this).
        await convex_mutation_safe(
            "deliberationEvents:insert",
            {
                "runId": run_id,
                "agentId": "advocate",
                "eventType": "advocate-argument",
                "payload": json.dumps({
                    "charityName": v.charityName,
                    "score": v.score,
                    "argument": v.argument,
                    "keyStrengths": v.keyStrengths,
                    "primaryConcern": v.primaryConcern,
                }),
                "charityId": charity_id,
            },
        )

        votes_serialized.append(v.model_dump())

    # AGT-17: record resolved model into state['model_versions']['advocate'].
    model_versions = dict(state.get("model_versions") or {})
    model_versions["advocate"] = usage["resolved_model"]

    return {
        **state,
        "advocate_votes": votes_serialized,
        "model_versions": model_versions,
    }
