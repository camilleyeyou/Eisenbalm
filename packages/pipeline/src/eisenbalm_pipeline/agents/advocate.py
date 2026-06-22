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
from eisenbalm_pipeline.lib.prompts import load_prompt


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


def _build_messages(*, state: DispatchState, candidates: list[dict]) -> list[dict]:
    """System prompt embeds Advocate's voice + scoring rule.

    Sourced from RESEARCH §Advocate lines 434-445 + lib/voice.py constraints.
    Kept short: Haiku rewards a tight prompt.

    Phase 22 (CFG-01): base prompt read from
    state["config"].agents["advocate"].system_prompt, disk fallback otherwise.
    """
    candidates_json = json.dumps(candidates, indent=2, default=str)
    cfg = state.get("config")
    system = cfg.agents["advocate"].system_prompt if cfg else load_prompt("advocate")
    # Phase 24 (PRM-01): user template read from config, on-disk .md fallback.
    user_tmpl = (
        cfg.user_templates.get("advocate_user")
        if cfg and cfg.user_templates.get("advocate_user")
        else load_prompt("advocate_user")
    )
    user = user_tmpl.replace("{candidates_json}", candidates_json)
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

    messages = _build_messages(state=state, candidates=candidates)
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

    # Match each Scout candidate to its Advocate vote robustly. The LLM
    # emits votes under `charityName`, which it may normalize (drop "The",
    # expand abbreviations, strip punctuation), so EXACT name matching against
    # Scout's `name` silently misses and collapses every score to 0 — which
    # makes editor.py's deterministic ranking fall back to an alphabetical
    # tiebreak and pick the wrong winner. Fix: prefer positional alignment
    # (the prompt guarantees one vote per candidate in input order); fall back
    # to a slugified-name map when counts differ.
    #
    # Found 2026-05-19 during the first multi-charity live run: all 3
    # candidates had no scores in state, editor's deterministic top-score
    # picked alphabetically-first candidate while the LLM rationale described
    # a different charity entirely (winner field and rationale text out of sync).
    def _vote_fields(vote: dict | None) -> dict:
        if not vote:
            return {
                "advocateScore": 0,
                "advocateArgument": "",
                "keyStrengths": [],
                "primaryConcern": "",
            }
        return {
            "advocateScore": vote.get("score", 0),
            "advocateArgument": vote.get("argument", ""),
            "keyStrengths": vote.get("keyStrengths") or [],
            "primaryConcern": vote.get("primaryConcern") or "",
        }

    if len(votes_serialized) == len(candidates):
        # PRIMARY: positional alignment (prompt: same order as input).
        candidates_with_scores = [
            {**c, **_vote_fields(v)}
            for c, v in zip(candidates, votes_serialized)
        ]
    else:
        # FALLBACK: slugify-keyed match when the count differs (dropped/added vote).
        vote_by_slug = {slugify(v["charityName"]): v for v in votes_serialized}
        candidates_with_scores = [
            {**c, **_vote_fields(vote_by_slug.get(slugify(c.get("name") or "")))}
            for c in candidates
        ]

    return {
        **state,
        "candidates": candidates_with_scores,
        "advocate_votes": votes_serialized,
        "model_versions": model_versions,
    }
