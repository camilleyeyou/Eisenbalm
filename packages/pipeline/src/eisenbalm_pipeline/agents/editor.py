"""Phase 5 Editor — gate 1 (Opus via OpenRouter; voice-critical) + final stub.

Phase 5 Plan 05-08 implements gate 1 (winner selection + interrupt).
Phase 5 Plan 05-13 implements final (consumes QA + emits editor-final).
The ``editor_final`` body below remains the Phase 4 stub until Plan 05-13.

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
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS
from eisenbalm_pipeline.stubs import fixtures


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
        ge=0.0, le=1.0, description="Editor confidence in the pick (0.0-1.0)."
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
    candidates_with_scores: list[dict],
    issue_number: int,
) -> list[dict]:
    """Editor system prompt embeds D-18 selection rules + VOICE_CONSTRAINTS."""
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
    system = (
        "You are the Editor for The Eisenbalm Dispatch. Select the charity "
        "for this issue.\n\n"
        "VOICE CONSTRAINTS (non-negotiable for editorReasoning, "
        "runnerUpNotes, and deliberationTranscript):\n"
        f"{VOICE_CONSTRAINTS}\n\n"
        "Selection rules:\n"
        "1. Highest Advocate score wins by default.\n"
        "2. Set confidence 0.0-1.0 reflecting your conviction.\n"
        "3. If top two scores are within "
        f"{EDITOR_INTERRUPT_THRESHOLD} AND your confidence < "
        f"{EDITOR_CONFIDENCE_THRESHOLD}: set requiresHumanInput=true. "
        "Otherwise: requiresHumanInput=false.\n\n"
        "Notes:\n"
        "- editorReasoning is 200-400 words, Jesse voice.\n"
        "- runnerUpNotes is 50-150 words, Jesse voice.\n"
        "- deliberationTranscript should be Markdown with sections: "
        "# Eisenbalm Dispatch — Issue #N Deliberation, ## Scout Findings, "
        "## Advocate Arguments, ## Editor Reasoning, ## Decision. "
        "(Python re-renders this from a deterministic template; your "
        "version is used only if the renderer fails.)"
    )
    user = (
        f"Issue #{issue_number}\n\n"
        f"CANDIDATES WITH ADVOCATE SCORES:\n{candidates_block}\n\n"
        "Return JSON matching the EditorDecision schema: winnerName, "
        "confidence (0.0-1.0), requiresHumanInput (bool), editorReasoning, "
        "runnerUpNotes, deliberationTranscript."
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

    # No candidates is a hard failure — Scout must have emitted some.
    if not candidates:
        raise RuntimeError(
            "editor_gate_1: state['candidates'] is empty — Scout produced "
            "no candidates. This should be impossible after Phase 4 PIP-04 "
            "(advocate_scored requires non-empty input)."
        )

    # Deterministic ranking (D-18).
    sorted_candidates = _sort_candidates_by_score(candidates)
    top = sorted_candidates[0]
    score_gap = _score_gap(sorted_candidates)

    # LLM call — Opus pinned via lib/llm_config.MODEL_BY_AGENT['editor_gate1'].
    messages = _build_messages(
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
        "deliberation_transcript": transcript,
        "model_versions": model_versions,
    }


# ── Editor Final (post-QA) — Phase 4 stub; Plan 05-13 replaces ───────────


@agent_node(
    name="editor",
    emit_event="editor-final",
    payload_builder=_editor_final_payload,
)
async def editor_final(state: DispatchState) -> DispatchState:
    """PHASE 4 STUB — Plan 05-13 owns the real implementation.

    DO NOT modify this body in Plan 05-08. Editor Final consumes QA output
    and emits the editor-final event; that surface is reserved for 05-13.
    """
    return fixtures.editor_final_output()
