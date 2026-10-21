"""Phase 5 Editor — gate 1 (Opus via OpenRouter; voice-critical) + final.

Phase 5 Plan 05-08 implements gate 1 (winner selection + interrupt).
Phase 5 Plan 05-13 implements final (consumes QA + emits editor-final).
Both gate-1 and final live in this module by design — they share the Opus
sampling tier and the VOICE_CONSTRAINTS block; the @agent_node wrapper
routes them through the same wrapper code.

gate 1 responsibilities (AGT-06, AGT-17, D-18):
  1. Read state['candidates'] — each has advocateScore + advocateArgument
     (populated by Advocate per CharityCandidate TypedDict in graph/state.py).
  2. Compute deterministic ranking: score desc, then name asc tie-break.
  3. Call Opus to produce EditorDecision (winnerName, confidence,
     requiresHumanInput, editorReasoning, runnerUpNotes,
     deliberationTranscript). Python OVERRIDES winnerName with the
     deterministic top-score candidate (D-18) — the LLM's pick is
     read only for confidence + requiresHumanInput signal.
  4. Low confidence / narrow gap no longer pauses: the run auto-proceeds with
     the deterministic top score (no human pause since quick 261021-ind).
  5. If no candidates survive, the run fails (RuntimeError) — start a new run.
  6. Format Markdown deliberation_transcript per RESEARCH §"Editor Gate 1"
     lines 484-504 (NotebookLM podcast input — V2-02 manual export).
  7. Record resolved model into state['model_versions']['editor_gate1']
     (AGT-17 observability surface).

emit_event='editor-decision': the @agent_node wrapper emits one
deliberationEvents row on the success path.
"""
from __future__ import annotations

import json
import logging
from typing import Optional

from pydantic import BaseModel, Field
from slugify import slugify

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import Brief, DispatchState
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.prompts import load_prompt
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS

log = logging.getLogger(__name__)


# D-18 thresholds — single source of truth.
EDITOR_INTERRUPT_THRESHOLD: float = 1.0
EDITOR_CONFIDENCE_THRESHOLD: float = 0.7


# ── EditorDecision Pydantic (RESEARCH §"Editor Gate 1" lines 506-516) ────


class EditorDecision(BaseModel):
    """AGT-06 LLM output. Python overrides winnerName with deterministic
    top-score; LLM-supplied winnerName read for diagnostic logging only.
    """

    winnerName: str = Field(description="LLM's preferred winner name.")
    confidence: float = Field(
        description="Editor confidence in the pick — float between 0.0 and 1.0."
    )
    requiresHumanInput: bool = Field(
        description=(
            "True when the LLM thinks the pick is too close to call. "
            "Combined with score_gap + confidence to decide interrupt."
        )
    )
    editorReasoning: str = Field(description="200-400 words; Jesse voice.")
    runnerUpNotes: str = Field(description="50-150 words; Jesse voice.")
    deliberationTranscript: str = Field(
        description=(
            "Markdown transcript (Scout findings + Advocate args + Editor "
            "reasoning). Python OVERRIDES this with a deterministic "
            "_format_deliberation_transcript() call — the LLM-supplied "
            "value is ignored on the success path."
        )
    )


# ── Pure helpers (unit-tested) ───────────────────────────────────────────


def _sort_candidates_by_score(candidates: list[dict]) -> list[dict]:
    """Deterministic ranking: advocateScore desc, then name asc tie-break."""
    return sorted(
        candidates,
        key=lambda c: (
            -int(c.get("advocateScore") or 0),
            str(c.get("name") or ""),
        ),
    )


def _score_gap(sorted_candidates: list[dict]) -> float:
    """Top-two score gap. Returns float('inf') when only one candidate.

    Single-candidate case => effectively infinite gap => no interrupt.
    """
    if len(sorted_candidates) < 2:
        return float("inf")
    top = float(sorted_candidates[0].get("advocateScore") or 0)
    second = float(sorted_candidates[1].get("advocateScore") or 0)
    return top - second


def _format_deliberation_transcript(
    *,
    issue_number: int,
    candidates: list[dict],
    editor_reasoning: str,
    confidence: float,
    winner_name: str,
    runner_up_notes: str,
) -> str:
    """Markdown transcript per RESEARCH §"Editor Gate 1" lines 484-504.

    Format is load-bearing for V2-02 NotebookLM podcast export. Section
    headers are exact-match assertions in test_transcript_format.

    Args:
        issue_number: weekly issue number for the header.
        candidates: list of CharityCandidate dicts (post-Advocate scoring).
            Each must carry name, scoutSummary, advocateScore,
            advocateArgument. Optional keyStrengths, primaryConcern.
        editor_reasoning: Editor's natural-language reasoning paragraph.
        confidence: 0.0-1.0 — rendered as percentage.
        winner_name: deterministic top-score winner name.
        runner_up_notes: Editor's runner-up notes paragraph.
    """
    lines: list[str] = []
    lines.append(f"# Eisenbalm Dispatch — Issue #{issue_number} Deliberation\n\n")

    lines.append("## Scout Findings\n\n")
    for c in candidates:
        name = c.get("name", "unknown")
        summary = c.get("scoutSummary", "")
        lines.append(f"- **{name}**: {summary}\n")
    lines.append("\n")

    lines.append("## Advocate Arguments\n\n")
    for c in candidates:
        name = c.get("name", "unknown")
        score = c.get("advocateScore", 0)
        argument = c.get("advocateArgument", "")
        lines.append(f"### {name} — Score: {score}/10\n\n")
        lines.append(f"{argument}\n\n")
        # Optional structured strengths/concerns if Advocate emits them.
        strengths = c.get("keyStrengths") or []
        if strengths:
            lines.append(f"**Key Strengths:** {', '.join(strengths)}\n\n")
        concern = c.get("primaryConcern")
        if concern:
            lines.append(f"**Primary Concern:** {concern}\n\n")

    lines.append("## Editor Reasoning\n\n")
    lines.append(f"{editor_reasoning}\n\n")
    lines.append(f"**Confidence:** {confidence:.0%}\n\n")

    lines.append("## Decision\n\n")
    lines.append(f"**Winner:** {winner_name}\n\n")
    lines.append(f"**Runner-up notes:** {runner_up_notes}\n")

    return "".join(lines)


# ── Phase 47 (BRF-05, §47.3): deterministic Brief assembly ───────────────
# Zero new graph node, zero new LLM call — a pure re-projection of data
# editor_gate_1 already has in scope. Called from BOTH winner-resolution
# return paths (the normal auto-select/human-resume path AND the Phase 46
# D-14 all-candidates-killed synthetic-winner path) immediately after
# winning_charity resolves.


def _match_lead_for_winner(
    story_leads: list[dict], winning_charity: dict
) -> Optional[dict]:
    """Resolve the "active" StoryLead for this run.

    RESEARCH Pitfall 1 (47-RESEARCH.md): Scout does NOT consume
    ``state['story_leads']`` — there is no real join key between a
    StoryLead and a CharityCandidate. Treat the relationship as
    one-active-lead-per-run (a single Scout pass per run today): prefer
    whichever lead is ``recommended``, else fall back to the first lead in
    the list, else ``None`` when there are no leads at all (legacy runs,
    or tests that omit story_leads). Never raises.
    """
    if not story_leads:
        return None
    for lead in story_leads:
        if lead.get("recommended"):
            return lead
    return story_leads[0]


def _match_verification_record(
    verification_records: list[dict], winning_charity: dict
) -> Optional[dict]:
    """Match the winning charity's VerificationRecord on candidateId.

    ``candidateId == f"charity-{slugify(name)}"`` — the SAME deterministic
    join key already used across Sanity ``_id`` / ``pitchLog.charityId`` /
    ``agentVotes.charityId`` (agents/advocate.py::_charity_id_for,
    agents/verify_candidates.py::_charity_id_for). Never raises.
    """
    name = winning_charity.get("name") or ""
    if not name or not verification_records:
        return None
    target_id = f"charity-{slugify(name)}"
    for record in verification_records:
        if record.get("candidateId") == target_id:
            return record
    return None


def _assemble_known_risks(
    winning_lead: Optional[dict], verification: Optional[dict]
) -> str:
    """Join brandRiskReason + repetitionWarning + verification killReason/
    obscurity notes into a single knownRisks string (§47.3 mapping). Never
    raises — missing inputs degrade to an empty joined string.
    """
    parts: list[str] = []
    if winning_lead:
        brand_risk_reason = winning_lead.get("brandRiskReason")
        if brand_risk_reason:
            parts.append(brand_risk_reason)
        repetition_warning = winning_lead.get("repetitionWarning")
        if repetition_warning:
            parts.append(repetition_warning)
    if verification:
        kill_reason = verification.get("killReason")
        if kill_reason:
            parts.append(kill_reason)
        obscurity = verification.get("obscurity") or {}
        verdict = obscurity.get("verdict")
        if verdict and verdict not in ("obscure", "unknown"):
            parts.append(f"obscurity verdict: {verdict}")
    return " · ".join(parts)


def _assemble_brief(
    *,
    state: DispatchState,
    winning_charity: dict,
    central_claim: str,
) -> Brief:
    """Deterministic, zero-new-node, zero-new-LLM-call Brief assembly
    (§47.3, BRF-05, D-11). A pure re-projection of data already in scope:
    the matched StoryLead, the matched VerificationRecord,
    ``central_claim`` (the resolved editorReasoning text on whichever
    winner-resolution path called this), and ``style_brief``. Never raises
    — missing lead/verification/style_brief data degrades to "" per field.
    """
    story_leads = state.get("story_leads") or []
    verification_records = state.get("verification_records") or []
    winning_lead = _match_lead_for_winner(story_leads, winning_charity)
    verification = _match_verification_record(verification_records, winning_charity)
    style_brief = state.get("style_brief") or {}

    brief: Brief = {
        "premise": (
            (winning_lead.get("premise", "") if winning_lead else "")
            or winning_charity.get("scoutSummary", "")
            or ""
        ),
        "currentPeg": (winning_lead.get("datedPeg", "") if winning_lead else "") or "",
        "centralClaim": central_claim or "",
        "readerEffect": (
            winning_lead.get("readerEnergy", "") if winning_lead else ""
        )
        or "",
        "knownRisks": _assemble_known_risks(winning_lead, verification),
        "voiceIntention": style_brief.get("visualDirection", "") or "",
    }
    return brief


def _build_messages(
    *,
    state: DispatchState,
    candidates_with_scores: list[dict],
    issue_number: int,
) -> list[dict]:
    """Editor system prompt embeds D-18 selection rules + VOICE_CONSTRAINTS.

    Phase 22 (CFG-01): base prompt read from
    state["config"].agents["editor_gate1"].system_prompt, disk fallback otherwise.
    """
    # Strip optional/None fields to keep the prompt compact + deterministic.
    cleaned = [
        {
            "name": c.get("name"),
            "location": c.get("location"),
            "focusArea": c.get("focusArea"),
            "missionStatement": c.get("missionStatement"),
            "scoutSummary": c.get("scoutSummary"),
            "advocateScore": c.get("advocateScore"),
            "advocateArgument": c.get("advocateArgument"),
        }
        for c in candidates_with_scores
    ]
    candidates_block = json.dumps(cleaned, indent=2)
    cfg = state.get("config")
    base = cfg.agents["editor_gate1"].system_prompt if cfg else load_prompt("editor")
    system = (
        base
        .replace("{VOICE_CONSTRAINTS}", VOICE_CONSTRAINTS)
        .replace("{EDITOR_INTERRUPT_THRESHOLD}", f"{EDITOR_INTERRUPT_THRESHOLD}")
        .replace("{EDITOR_CONFIDENCE_THRESHOLD}", f"{EDITOR_CONFIDENCE_THRESHOLD}")
    )
    # Phase 24 (PRM-01): user template read from config, on-disk .md fallback.
    user_tmpl = (
        cfg.user_templates.get("editor_gate1_user")
        if cfg and cfg.user_templates.get("editor_gate1_user")
        else load_prompt("editor_gate1_user")
    )
    user = (
        user_tmpl
        .replace("{issue_number}", str(issue_number))
        .replace("{candidates_block}", candidates_block)
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


# ── Wrapper payload builders (preserved from Phase 4 stub) ───────────────


def _editor_decision_payload(state: DispatchState) -> dict:
    winning = state.get("winning_charity") or {}
    return {
        "winner": winning.get("name", "<unknown>"),
        "rationale": state.get("editor_decision", ""),
        # Phase 37 §37.2 — previously computed by editor_gate_1 then discarded.
        "confidence": state.get("editor_confidence"),
        "runnerUpNotes": state.get("runner_up_notes", ""),
    }


def _editor_final_payload(state: DispatchState) -> dict:
    return {
        "approved": True,
        "notes": state.get("editor_final_notes", ""),
    }


# ── Editor gate 1 (Plan 05-08: real Opus implementation) ─────────────────


@agent_node(
    name="editor",
    emit_event="editor-decision",
    payload_builder=_editor_decision_payload,
)
async def editor_gate_1(state: DispatchState) -> DispatchState:
    run_id = state["run_id"]
    issue_number = state["issue_number"]
    candidates = state.get("candidates") or []

    # Phase 46 (D-14) / quick 261021-ind: verify_candidates or Scout dedup may
    # kill EVERY candidate. There is no pick to proceed with and no human pause
    # any more, so the run fails (the @agent_node wrapper marks it failed with
    # this message) and a new run is started.
    if not candidates:
        raise RuntimeError(
            "No candidates survived Scout dedup and verification — start a new run."
        )

    # Deterministic ranking (D-18).
    sorted_candidates = _sort_candidates_by_score(candidates)
    top = sorted_candidates[0]
    score_gap = _score_gap(sorted_candidates)

    # LLM call — Opus pinned via lib/llm_config.MODEL_BY_AGENT['editor_gate1'].
    messages = _build_messages(
        state=state,
        candidates_with_scores=sorted_candidates,
        issue_number=issue_number,
    )
    decision_obj, usage = await acomplete(
        agent_id="editor_gate1",
        run_id=run_id,
        messages=messages,
        response_format=EditorDecision,
    )
    # Pydantic v2: with_structured_output returns the model instance.
    decision: EditorDecision
    if isinstance(decision_obj, EditorDecision):
        decision = decision_obj
    elif isinstance(decision_obj, dict):
        decision = EditorDecision(**decision_obj)
    else:
        # Stub-mode FakeOpenRouterClient may return raw string content;
        # fall back to a permissive decision so the success path still runs.
        decision = EditorDecision(
            winnerName=top.get("name", ""),
            confidence=0.9,
            requiresHumanInput=False,
            editorReasoning=(
                f"Selected {top.get('name', '')} on the deterministic "
                f"top-score rule."
            ),
            runnerUpNotes=(
                "Runner-up candidates considered but not selected on score."
            ),
            deliberationTranscript="",  # overridden below
        )

    # Default winner = deterministic top-score (D-18). LLM-supplied
    # winnerName is read for diagnostic logging only — Python overrides.
    winner_name = top.get("name", "")

    # Quick 261021-ind: Gate 1 never pauses for a human. The old D-18
    # interrupt condition (narrow gap + low confidence + requiresHumanInput)
    # now just logs; the deterministic top score proceeds to phase 2.
    if (
        score_gap < EDITOR_INTERRUPT_THRESHOLD
        and decision.confidence < EDITOR_CONFIDENCE_THRESHOLD
        and decision.requiresHumanInput
    ):
        log.info(
            "editor_gate_1: low-confidence pick auto-proceeds (gap=%s conf=%s) — quick 261021-ind",
            score_gap,
            decision.confidence,
        )

    # Resolve the full CharityCandidate dict for the winner name. Falls
    # back to the deterministic top candidate if the human typo'd a name.
    winning_charity = next(
        (c for c in candidates if c.get("name") == winner_name),
        top,
    )

    # Mark the winning candidate in Convex pitchLog (Phase 4 D-18 step 4
    # second write — NOT idempotent in the same way as updateStatus, so it
    # lives AFTER any potential pause).
    await convex_mutation_safe(
        "pitchLog:markSelected",
        {"runId": run_id, "charityName": winning_charity["name"]},
    )

    # Deterministic Markdown transcript (NotebookLM-friendly per RESEARCH).
    transcript = _format_deliberation_transcript(
        issue_number=issue_number,
        candidates=sorted_candidates,
        editor_reasoning=decision.editorReasoning,
        confidence=decision.confidence,
        winner_name=winning_charity["name"],
        runner_up_notes=decision.runnerUpNotes,
    )

    # AGT-17: record resolved model under the llm_config key.
    model_versions = dict(state.get("model_versions") or {})
    model_versions["editor_gate1"] = usage.get("resolved_model", "")

    # Phase 47 (BRF-05, §47.3): deterministic Brief assembly + persist —
    # zero new graph node, zero new LLM call. Covers BOTH the auto-select
    # case (no pause) and the human-adjudication resume case (this is the
    # single return path after the conditional gate-1-pause block above),
    # since winning_charity is resolved identically either way.
    brief = _assemble_brief(
        state=state,
        winning_charity=winning_charity,
        central_claim=decision.editorReasoning,
    )
    await convex_mutation_safe("briefs:insert", {"runId": run_id, **brief})

    return {
        **state,
        "winning_charity": winning_charity,
        "editor_decision": decision.editorReasoning,
        "runner_up_notes": decision.runnerUpNotes,
        "editor_confidence": decision.confidence,
        "deliberation_transcript": transcript,
        "model_versions": model_versions,
        "brief": brief,
    }


# ── Editor Final (Plan 05-13: real Opus implementation) ─────────────────


class EditorFinalOutput(BaseModel):
    """AGT-16 LLM output — a single advisory memo string.

    Editor Final is advisory only (D-02): it consumes ``state['qa_corrections']``
    and writes a 100-300 word memo for Andrew describing what QA found and
    what to review before publishing. It does NOT rewrite any section. It
    does NOT reject the draft. The Sanity draft Andrew sees is whatever the
    section writers produced — Editor Final adds context, not edits.
    """

    editorFinalNotes: str = Field(
        description=(
            "100-300 word memo for Andrew describing QA findings and "
            "recommended review priorities. Advisory only — Editor Final "
            "does NOT rewrite any section."
        )
    )


def _build_editor_final_messages(state: DispatchState) -> list[dict]:
    """Assemble the Editor Final message list.

    System prompt embeds Editor Final's advisory mandate verbatim from
    RESEARCH §"Editor Final" (D-02 / AGT-16). User prompt carries the QA
    corrections JSON + the section headlines so Editor can refer to each
    section by name.
    """
    qa_corrections = state.get("qa_corrections") or []
    # Pull section headlines from the writer outputs Andrew will see.
    section_headlines = {
        "origin_story":  (state.get("origin_story") or {}).get("headline", ""),
        "problem":       (state.get("problem_statement") or {}).get("headline", ""),
        "founder_bio":   (state.get("founder_bio") or {}).get("headline", ""),
        "case_study":    (state.get("case_study") or {}).get("headline", ""),
        "game":          (state.get("game") or {}).get("headline", ""),
        "bonus":         (state.get("bonus") or {}).get("headline", ""),
    }
    cfg = state.get("config")
    base = cfg.agents["editor_final"].system_prompt if cfg else load_prompt("editor-final")
    system = base.replace("{VOICE_CONSTRAINTS}", VOICE_CONSTRAINTS)
    # Phase 24 (PRM-01): user template read from config, on-disk .md fallback.
    qa_corrections_json = json.dumps(qa_corrections, indent=2)
    section_headlines_json = json.dumps(section_headlines, indent=2)
    user_tmpl = (
        cfg.user_templates.get("editor_final_user")
        if cfg and cfg.user_templates.get("editor_final_user")
        else load_prompt("editor_final_user")
    )
    user = (
        user_tmpl
        .replace("{qa_corrections_json}", qa_corrections_json)
        .replace("{section_headlines_json}", section_headlines_json)
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


@agent_node(
    name="editor",
    emit_event="editor-final",
    payload_builder=_editor_final_payload,
)
async def editor_final(state: DispatchState) -> DispatchState:
    """AGT-16: advisory memo only. Never rewrites; never rejects.

    Reads ``state['qa_corrections']`` + section headlines, calls Opus
    (pinned via lib/llm_config.MODEL_BY_AGENT['editor_final']), writes
    ``state['editor_final_notes']`` and records the resolved model into
    ``state['model_versions']['editor_final']`` (AGT-17).

    Always returns success state (D-04). The @agent_node wrapper emits
    one deliberationEvents row with eventType='editor-final' on success.
    """
    run_id = state["run_id"]
    messages = _build_editor_final_messages(state)
    out_obj, usage = await acomplete(
        agent_id="editor_final",
        run_id=run_id,
        messages=messages,
        response_format=EditorFinalOutput,
    )

    # Normalize the response (real mode: Pydantic instance; stub mode: dict
    # or model_construct'd empty instance with editorFinalNotes='').
    if isinstance(out_obj, EditorFinalOutput):
        notes = out_obj.editorFinalNotes
    elif isinstance(out_obj, dict):
        notes = out_obj.get("editorFinalNotes", "")
    elif hasattr(out_obj, "editorFinalNotes"):
        notes = out_obj.editorFinalNotes or ""
    else:
        # Defensive fallback — keep the pipeline running even if the LLM
        # response is malformed; QA never blocks the draft (D-04) so
        # Editor Final shouldn't block it either.
        notes = ""

    model_versions = dict(state.get("model_versions") or {})
    model_versions["editor_final"] = usage["resolved_model"]

    return {
        **state,
        "editor_final_notes": notes,
        "model_versions": model_versions,
    }
