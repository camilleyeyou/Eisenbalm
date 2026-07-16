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
  4. If score_gap < EDITOR_INTERRUPT_THRESHOLD AND
     confidence < EDITOR_CONFIDENCE_THRESHOLD AND requiresHumanInput=True:
     write pipelineRuns:updateStatus 'awaiting-review' to Convex FIRST,
     then call interrupt() (Phase 4 D-13 — idempotency-before-interrupt
     ordering is non-negotiable).
  5. On resume, the interrupt() return value supplies the human-chosen
     winner; override the winner_name with that.
  6. Format Markdown deliberation_transcript per RESEARCH §"Editor Gate 1"
     lines 484-504 (NotebookLM podcast input — V2-02 manual export).
  7. Record resolved model into state['model_versions']['editor_gate1']
     (AGT-17 observability surface).

emit_event='editor-decision': the @agent_node wrapper emits one
deliberationEvents row on the success path. On interrupt, the
GraphInterrupt re-raises out of the wrapper BEFORE emission (Phase 4
D-13 + _wrapper.py docstring).
"""
from __future__ import annotations

import json
import time
from typing import Any

from langgraph.types import interrupt
from pydantic import BaseModel, Field

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.prompts import load_prompt
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS


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

    # Phase 46 (D-14): verify_candidates may legitimately kill EVERY
    # candidate (SGE-03's conservative-but-real kill rule). That is a
    # RECOVERABLE degraded/needs-human state, not a fatal crash — mirrors
    # the low-confidence interrupt path below (idempotency-before-interrupt:
    # the status write MUST land BEFORE interrupt() — Phase 4 D-13). There
    # is no sorted_candidates[0] to fall back to, so a minimal synthetic
    # winning_charity is built from the human-supplied name alone, and the
    # deterministic-ranking / LLM path is skipped entirely.
    if not candidates:
        await convex_mutation_safe(
            "pipelineRuns:updateStatus",
            {
                "runId": run_id,
                "status": "awaiting-review",
                "awaitingHumanAt": int(time.time() * 1000),
            },
        )
        # Suspend. interrupt() raises GraphInterrupt; the @agent_node
        # wrapper re-raises it without writing the success-path event.
        resume_value: Any = interrupt(
            {
                "prompt": (
                    "verify_candidates killed every candidate — supply a "
                    "charity to proceed or restart."
                ),
                "reason": "all-candidates-killed",
                "candidates": [],
            }
        )
        # Accept the same three resume shapes the existing interrupt path
        # handles (Phase 4 PIP-10 contract / Phase 5 plan-08 contract).
        human_name = ""
        if isinstance(resume_value, dict):
            human_name = (
                resume_value.get("editorSelection")
                or resume_value.get("winnerName")
                or ""
            )
        elif isinstance(resume_value, str) and resume_value:
            human_name = resume_value

        # After resume, write status back to 'running' (mirror the existing
        # interrupt path below).
        await convex_mutation_safe(
            "pipelineRuns:updateStatus",
            {"runId": run_id, "status": "running"},
        )

        # Minimal synthetic CharityCandidate — every key present, empty
        # where there is no data to fill (there is no scored candidate to
        # fall back to). Downstream Researcher/Chronicler produce a
        # degraded-but-non-crashing result — D-14 requires "recoverable
        # rather than fatal", not "produces a great result".
        winning_charity: dict = {
            "name": human_name,
            "location": "",
            "website": "",
            "charityNavigatorUrl": None,
            "guidestarUrl": None,
            "foundingYear": None,
            "assetRange": "",
            "focusArea": "",
            "missionStatement": "",
            "scoutSummary": "",
            "whyOverlooked": "",
            "advocateArgument": None,
            "advocateScore": None,
        }
        transcript = (
            f"# Eisenbalm Dispatch — Issue #{issue_number} Deliberation\n\n"
            "## Decision\n\n"
            "No candidates survived verification — verify_candidates killed "
            "every candidate this run. A human supplied a charity directly "
            "to recover the run.\n\n"
            f"**Winner:** {human_name}\n"
        )
        return {
            **state,
            "winning_charity": winning_charity,
            "editor_decision": (
                "Degraded recovery path (D-14): verify_candidates killed "
                "every candidate, so no deterministic ranking or LLM call "
                "was made. A human supplied a charity directly via the "
                "all-candidates-killed interrupt."
            ),
            "runner_up_notes": "",
            "editor_confidence": None,
            "deliberation_transcript": transcript,
            "model_versions": dict(state.get("model_versions") or {}),
        }

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

    # D-18: interrupt() only when ALL THREE conditions hold.
    interrupt_triggered = (
        score_gap < EDITOR_INTERRUPT_THRESHOLD
        and decision.confidence < EDITOR_CONFIDENCE_THRESHOLD
        and decision.requiresHumanInput
    )

    # Default winner = deterministic top-score (D-18). LLM-supplied
    # winnerName is read for diagnostic logging only — Python overrides.
    winner_name = top.get("name", "")

    if interrupt_triggered:
        # Phase 4 D-13 (idempotency-before-interrupt): status='awaiting-review'
        # write MUST land BEFORE interrupt() is called. The write is an
        # upsert on runId — safe to re-run on resume (the node re-runs from
        # the top after the human supplies a Command(resume=...) value).
        await convex_mutation_safe(
            "pipelineRuns:updateStatus",
            {
                "runId": run_id,
                "status": "awaiting-review",
                "awaitingHumanAt": int(time.time() * 1000),
            },
        )
        # Suspend. interrupt() raises GraphInterrupt; the @agent_node
        # wrapper re-raises it without writing the success-path event.
        resume_value: Any = interrupt(
            {
                "prompt": "Select winner for this issue's deliberation gate.",
                "candidates": [
                    {
                        "name": c.get("name"),
                        "advocateScore": c.get("advocateScore"),
                        "advocateArgument": c.get("advocateArgument"),
                    }
                    for c in sorted_candidates
                ],
                "topTwoScores": [
                    {
                        "name": sorted_candidates[0].get("name"),
                        "score": sorted_candidates[0].get("advocateScore"),
                    },
                    {
                        "name": sorted_candidates[1].get("name"),
                        "score": sorted_candidates[1].get("advocateScore"),
                    },
                ],
                "editorReasoning": decision.editorReasoning,
            }
        )
        # On resume, override winner_name with the human-supplied value.
        # Accept three shapes the resume protocol may pass:
        #   - {"editorSelection": "name"}  (Phase 4 PIP-10 contract)
        #   - {"winnerName": "name"}        (Phase 5 plan-08 contract)
        #   - "name"                         (raw string)
        if isinstance(resume_value, dict):
            override = (
                resume_value.get("editorSelection")
                or resume_value.get("winnerName")
            )
            if override:
                winner_name = override
        elif isinstance(resume_value, str) and resume_value:
            winner_name = resume_value

        # After resume, write status back to 'running' (mirror Phase 4 stub).
        await convex_mutation_safe(
            "pipelineRuns:updateStatus",
            {"runId": run_id, "status": "running"},
        )

    # Resolve the full CharityCandidate dict for the winner name. Falls
    # back to the deterministic top candidate if the human typo'd a name.
    winning_charity = next(
        (c for c in candidates if c.get("name") == winner_name),
        top,
    )

    # Mark the winning candidate in Convex pitchLog (Phase 4 D-18 step 4
    # second write — NOT idempotent in the same way as updateStatus, so it
    # lives AFTER any potential interrupt() pass).
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

    return {
        **state,
        "winning_charity": winning_charity,
        "editor_decision": decision.editorReasoning,
        "runner_up_notes": decision.runnerUpNotes,
        "editor_confidence": decision.confidence,
        "deliberation_transcript": transcript,
        "model_versions": model_versions,
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
