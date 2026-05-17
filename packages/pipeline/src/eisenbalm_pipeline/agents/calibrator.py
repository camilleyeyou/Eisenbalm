"""Phase 5 Calibrator — voice-critical agent (Opus pinned per D-05).

Replaces Phase 4 stub. Responsibilities:

  1. Query Sanity for last 3 published issues' bonusType (D-17 rotation rule).
  2. Pick bonusType ∈ {bigBudget, jingle, specAd} that is NOT the most recent
     (deterministic tie-break by (issueNumber + offset) mod len(candidates)).
  3. Call OpenRouter (Opus pinned) with a system prompt that embeds
     VOICE_CONSTRAINTS verbatim from lib/voice.py (AGT-02).
  4. Record resolved model into state['model_versions']['calibrator'] (AGT-17).

emit_event=None — the Convex deliberationEvents.eventType union (Plan 05-01
patched, 9 literals) still does NOT include a 'calibrator-brief' literal.
StyleBrief lands on weeklyIssue.calibratorBrief at Sanity write time (Publisher).
"""
from __future__ import annotations

import logging
from typing import Literal

from pydantic import BaseModel, Field

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.sanity_client import groq_query
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS

log = logging.getLogger(__name__)


BONUS_TYPES: tuple[str, ...] = ("bigBudget", "jingle", "specAd")


class StyleBriefOutput(BaseModel):
    """Pydantic schema for LLM structured output. Maps 1:1 to graph.state.StyleBrief
    (minus ``previousBonusTypes`` which the agent fills from Sanity, not the LLM).
    """

    voice: str = Field(
        default="",
        description="Jesse voice summary — copy from VOICE_CONSTRAINTS",
    )
    constraints: list[str] = Field(
        default_factory=list,
        min_length=3,
        max_length=5,
        description="3-5 specific rules this week",
    )
    bonusType: Literal["bigBudget", "jingle", "specAd"] = "bigBudget"
    visualDirection: str = Field(
        default="",
        description="Aesthetic direction for DesignAgent",
    )


async def _fetch_previous_bonus_types() -> list[str]:
    """Query Sanity for last 3 published issues' bonusType.

    Returns list ordered most-recent-first. Empty list if fewer than 1 issue
    has been published (first-issue case) OR if the Sanity round-trip fails
    (defensive — Calibrator must still pick a bonusType).
    """
    query = (
        '*[_type == "weeklyIssue" && status == "published"] '
        '| order(issueNumber desc)[0..2]{ bonusType, issueNumber }'
    )
    try:
        rows = await groq_query(query)
    except Exception as exc:  # noqa: BLE001 — first-run + outage tolerance
        log.warning("Calibrator: previousBonusTypes lookup failed: %r", exc)
        return []
    return [row["bonusType"] for row in rows if row.get("bonusType")]


def _pick_bonus_type(previous: list[str], issue_number: int) -> str:
    """Deterministic bonusType rotation (D-17, AGT-01).

    Args:
        previous: last 3 bonusTypes, most-recent-first. May be empty.
        issue_number: current issueNumber (deterministic tie-break input).

    Returns:
        One of BONUS_TYPES. When ``previous`` is non-empty, never equal to
        ``previous[0]`` (the most recently published bonusType).
    """
    most_recent = previous[0] if previous else None
    candidates = [b for b in BONUS_TYPES if b != most_recent]
    # Deterministic tie-break: (issueNumber + 0) mod len(candidates).
    # Re-runs of the same issueNumber produce the same bonusType.
    idx = issue_number % len(candidates)
    return candidates[idx]


def _build_messages(
    *,
    issue_number: int,
    previous_bonus_types: list[str],
    chosen_bonus_type: str,
) -> list[dict]:
    """Assemble Calibrator system + user messages.

    System prompt MUST contain VOICE_CONSTRAINTS verbatim (AGT-02). The
    voice block is NEVER re-authored here — Calibrator consumes the
    canonical string from lib/voice.py.
    """
    system = (
        "You are the Calibrator for The Eisenbalm Dispatch. "
        "You set the creative constraints for this issue.\n\n"
        "VOICE CONSTRAINTS (non-negotiable, copy verbatim into output.voice):\n"
        f"{VOICE_CONSTRAINTS}\n\n"
        f"Issue number: {issue_number}\n"
        f"Previous bonusTypes (most-recent-first): {previous_bonus_types}\n"
        f"This week's bonusType (already selected by deterministic rotation): "
        f"{chosen_bonus_type}\n\n"
        "Output JSON StyleBrief with:\n"
        "- voice: copy VOICE_CONSTRAINTS verbatim\n"
        "- constraints: 3-5 specific rules for THIS week's writers\n"
        f"- bonusType: EXACTLY '{chosen_bonus_type}' (do not deviate)\n"
        "- visualDirection: one sentence aesthetic direction for DesignAgent"
    )
    user = (
        "Produce the StyleBrief for this week's issue. "
        "Return valid JSON matching the StyleBriefOutput schema."
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


@agent_node(name="calibrator", emit_event=None)
async def calibrator(state: DispatchState) -> DispatchState:
    issue_number = state["issue_number"]
    run_id = state["run_id"]

    previous = await _fetch_previous_bonus_types()
    chosen = _pick_bonus_type(previous, issue_number)
    messages = _build_messages(
        issue_number=issue_number,
        previous_bonus_types=previous,
        chosen_bonus_type=chosen,
    )

    brief_obj, usage = await acomplete(
        agent_id="calibrator",
        run_id=run_id,
        messages=messages,
        response_format=StyleBriefOutput,
    )

    # Pydantic returns model instance; coerce to TypedDict-shaped dict.
    if hasattr(brief_obj, "model_dump"):
        brief_dict = brief_obj.model_dump()
    elif isinstance(brief_obj, dict):
        brief_dict = dict(brief_obj)
    else:
        # Stub-mode fallback (FakeOpenRouterClient may return raw content).
        brief_dict = {
            "voice": VOICE_CONSTRAINTS,
            "constraints": [
                "No exclamation marks.",
                "No sentimentality keywords.",
                "No AI self-reference.",
            ],
            "bonusType": chosen,
            "visualDirection": "Warm cream paper feel; serif display, sans body.",
        }

    # Defensive: enforce the deterministic rotation pick even if the model
    # deviated. Add previousBonusTypes (computed here, not produced by LLM).
    brief_dict["bonusType"] = chosen
    brief_dict["previousBonusTypes"] = previous

    # Defensive: when stub-mode emitted an empty constraints list, fill with
    # a sensible default so downstream agents have something to consume.
    if not brief_dict.get("constraints"):
        brief_dict["constraints"] = [
            "No exclamation marks.",
            "No sentimentality keywords.",
            "Numbers cited with sources.",
        ]
    if not brief_dict.get("voice"):
        brief_dict["voice"] = VOICE_CONSTRAINTS
    if not brief_dict.get("visualDirection"):
        brief_dict["visualDirection"] = (
            "Warm cream paper feel; serif display, sans body."
        )

    # AGT-17: record resolved model into state['model_versions'].
    model_versions = dict(state.get("model_versions") or {})
    model_versions["calibrator"] = usage["resolved_model"]

    return {
        **state,
        "style_brief": brief_dict,
        "model_versions": model_versions,
    }
