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

import json
import logging
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState, Narrator
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.sanity_client import fetch_narrator_by_slug, groq_query
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, assemble_voice

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
        description="3-5 specific rules this week (emit between 3 and 5 items)",
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


async def _emit_inactive_narrator_warning(
    run_id: str, original_slug: str, narrator_name: str
) -> None:
    """D-14: emit a non-blocking deliberationEvents warning when the resolved
    narrator has ``active == False``. Best-effort — Convex failures log and
    continue (lib/convex_client.convex_mutation_safe semantics).

    Uses ``editor-decision`` event type (Phase 5 Plan 05-01 patched Convex
    schema literal union) to avoid widening the Convex eventType union for
    this single edge. The payload carries a human-readable ``warning`` key
    so downstream UI + the Plan 16-02 test assertion can detect it.
    """
    # Call with keyword args so the Plan 16-02 test mock (side_effect
    # accepts **kwargs) can introspect the payload without positional-vs-
    # keyword arg-shape coupling. ``convex_mutation_safe(path, args)`` is
    # a 2-positional API; this call passes both as keyword to make the
    # test's ``_capture_event(**kwargs)`` shape work.
    await convex_mutation_safe(
        path="deliberationEvents:insert",
        args={
            "runId": run_id,
            "agentId": "calibrator",
            "eventType": "editor-decision",
            "payload": json.dumps(
                {
                    "warning": "inactive_narrator_fallback",
                    "originalSlug": original_slug,
                    "originalName": narrator_name,
                    "fellBackTo": "jesse",
                    "reason": "narrator marked inactive (active=False)",
                }
            ),
        },
    )


async def _resolve_narrator(
    state: DispatchState,
) -> tuple[Optional[Narrator], bool]:
    """Resolve which narrator to use for this run.

    Precedence (D-13):
      1. state["narrator"] (pre-populated by test / upstream code) if set
      2. state["narrator_slug"] override (fetched from Sanity)
      3. winning_charity.narratorSlug (fetched from Sanity)
      4. Jesse default (returns None — caller passes None to assemble_voice)

    D-14: If the resolved narrator record has ``active == False``, emit a
    deliberation warning and signal the caller to fall back to Jesse by
    returning ``(None, True)``. Detection uses the boolean ``active`` field
    (Sanity narratorProfile schema — Plan 16-01 + CONTEXT D-08), NOT a
    ``status: "active"|"inactive"`` string.

    Returns:
        A tuple ``(narrator, fellback)``. ``narrator`` is the resolved
        Narrator record (or None when the Jesse default applies). ``fellback``
        is True iff the resolution path tripped the D-14 inactive-narrator
        fallback (caller is responsible for the warning emission, which
        happens inside this helper).
    """
    run_id = state["run_id"]

    # 1) Direct state['narrator'] takes precedence (test path + upstream
    #    code that wants to bypass Sanity lookup entirely).
    narrator_record: Optional[dict] = state.get("narrator")  # type: ignore[assignment]

    # 2/3) Slug-based fetch when no direct record was set.
    if narrator_record is None:
        override_slug = state.get("narrator_slug")
        charity = state.get("winning_charity") or {}
        charity_slug = charity.get("narratorSlug") if isinstance(charity, dict) else None
        chosen_slug = override_slug or charity_slug
        # Jesse default: no slug means use VOICE_CONSTRAINTS verbatim. Do
        # not round-trip to Sanity for the default case — assemble_voice(None)
        # produces the byte-equivalent Jesse voice (Phase 16 D-13).
        if chosen_slug and chosen_slug != "jesse":
            try:
                narrator_record = await fetch_narrator_by_slug(chosen_slug)
            except Exception as exc:  # noqa: BLE001
                log.warning(
                    "Narrator slug %s fetch failed: %r — falling back to Jesse.",
                    chosen_slug,
                    exc,
                )
                narrator_record = None
            if narrator_record is None:
                log.warning(
                    "Narrator slug %s did not resolve; falling back to Jesse.",
                    chosen_slug,
                )

    # D-14: detect inactivity (boolean `active`, not status string).
    if narrator_record is not None and narrator_record.get("active") is False:
        await _emit_inactive_narrator_warning(
            run_id=run_id,
            original_slug=narrator_record.get("slug") or "",
            narrator_name=narrator_record.get("name") or "",
        )
        return (None, True)

    return (narrator_record, False)  # type: ignore[return-value]


@agent_node(name="calibrator", emit_event=None)
async def calibrator(state: DispatchState) -> DispatchState:
    issue_number = state["issue_number"]
    run_id = state["run_id"]

    # ── Phase 16 narrator resolution (NRR-03 single resolution point) ──────
    resolved_narrator, fellback = await _resolve_narrator(state)
    # ``assemble_voice`` is the single composition surface (Phase 16 D-05).
    # When resolved_narrator is None (Jesse default OR D-14 inactive
    # fallback), this returns VOICE_CONSTRAINTS verbatim (NRR-10 byte
    # equivalence). When set, it composes
    # ``narrator.voiceConstraints + UNIVERSAL_CORE``.
    voice_for_brief = assemble_voice(resolved_narrator)

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
            "voice": voice_for_brief,
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
    # Phase 16 NRR-03/04: ALWAYS overwrite the LLM-emitted `voice` with the
    # narrator-aware composition. The LLM has no business choosing the voice
    # — the Calibrator is the single resolution point. When narrator is None,
    # ``voice_for_brief == VOICE_CONSTRAINTS`` byte-for-byte (NRR-10).
    brief_dict["voice"] = voice_for_brief
    if not brief_dict.get("visualDirection"):
        brief_dict["visualDirection"] = (
            "Warm cream paper feel; serif display, sans body."
        )

    # AGT-17: record resolved model into state['model_versions'].
    model_versions = dict(state.get("model_versions") or {})
    model_versions["calibrator"] = usage["resolved_model"]

    # Phase 16: persist the resolved narrator back to state for downstream
    # consumers (chronicler — Plan 16-06; QA judge — Plan 16-07). On D-14
    # fallback, resolved_narrator is None (Jesse default); chronicler + QA
    # judge interpret None as "use Jesse rubric / Jesse-voice chronicler".
    # state['narrator_slug'] (input override) is preserved untouched for
    # auditability.
    out_state: dict[str, Any] = {
        **state,
        "style_brief": brief_dict,
        "model_versions": model_versions,
    }
    # Only overwrite narrator if we changed it (fellback) or if we resolved
    # a fresh record via slug — leave None if it was already None and no slug
    # was provided.
    if fellback:
        out_state["narrator"] = None
    elif resolved_narrator is not None:
        out_state["narrator"] = resolved_narrator
    return out_state
