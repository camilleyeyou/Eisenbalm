"""Phase 13 Chronicler agent — single LLM call, faithful dramatization.

D-04: exactly one new LLM call per pipeline run.
D-14: faithful dramatization — the LLM stages REAL Scout findings, Advocate
      scores/arguments, and Editor decision as multi-turn dialogue. No invented
      facts.
D-16: Jesse voice enforced via VOICE_CONSTRAINTS verbatim.
D-18: on any Chronicler failure the run falls back gracefully — the
      editor_gate_1 deterministic deliberation_transcript is preserved intact.
DEL-04: never reference AI, language models, or Jesse's AI nature.
DEL-CONV-01/02: produces deliberation_conversation list[{speaker, text}] and
      derives deliberation_transcript from the turns for NotebookLM (V2-02).
AGT-17: model_versions['chronicler'] recorded at call time.

Pitfall notes (13-RESEARCH):
  - Pitfall 1: acomplete must be called kwargs-only (leading *).
  - Pitfall 6: the try/except MUST be INSIDE the function body so the
      @agent_node wrapper never sees the exception and never marks the run
      failed.
  - Pitfall 7: no Markdown in turn text — plain prose only.
"""
from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.llm_config import MODEL_BY_AGENT
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS

log = logging.getLogger(__name__)


# ── Pydantic output schema ────────────────────────────────────────────────


class _Turn(BaseModel):
    speaker: str = ""    # "scout" | "advocate" | "editor"
    text: str = ""       # plain prose, no Markdown


class ChroniclerOutput(BaseModel):
    turns: list[_Turn] = []  # field default so model_construct() works in stub mode


# ── Prompt builders ───────────────────────────────────────────────────────


def _build_system_prompt() -> str:
    """Return the Chronicler system prompt with VOICE_CONSTRAINTS verbatim."""
    return (
        f"{VOICE_CONSTRAINTS}\n\n"
        "You are The Chronicler for The Eisenbalm Dispatch. "
        "Your task is to dramatize a real editorial deliberation as a "
        "multi-turn conversation between three named agents.\n\n"
        "The three personas:\n"
        "- scout: The Scout reports charity findings — what they found, why "
        "each charity is overlooked, what the operational evidence shows.\n"
        "- advocate: The Advocate scores each charity 0-10 and presents the "
        "argument for or against selection.\n"
        "- editor: The Editor weighs the arguments and makes the final call.\n\n"
        "Rules (non-negotiable):\n"
        "1. Faithful dramatization only. Invent no new facts, names, scores, "
        "or statistics. Every claim must trace to the data you are given.\n"
        "2. Output ONLY plain prose. No #, ##, **, _, [link](url), no bullet "
        "points, no numbered lists, no headings of any kind.\n"
        "3. Write 8-16 turns with genuine back-and-forth. Each turn must be "
        "one speaker completing one thought — no monologues.\n"
        "4. The speaker field must be exactly one of: scout, advocate, editor.\n"
        "5. Never reference AI, language models, or Jesse's AI nature. "
        "Jesse was born AI. This is not a gimmick.\n"
        "6. Jesse voice every turn. No exclamation marks. No winking.\n"
        "7. WINNER AUTHORITY (non-negotiable): The Editor's final turn must "
        "conclude that the WINNER named in the data is the selected charity — "
        "the pick. The WINNER is the authoritative final decision. The EDITOR "
        "DECISION text is supporting rationale only: the Editor may discuss and "
        "weigh runners-up, but if the EDITOR DECISION text names a different "
        "charity as chosen, treat that as the Editor's earlier reasoning and "
        "still conclude the conversation with the WINNER as the final call.\n"
        "8. Return valid JSON matching the schema: "
        '{\"turns\": [{\"speaker\": \"scout\", \"text\": \"...\"}]}.'
    )


def _build_user_prompt(
    candidates: list[dict],
    winning_charity_name: str,
    editor_decision: str,
    runner_up_notes: str,
    issue_number: Any,
) -> str:
    """Render the data-grounded user prompt for the Chronicler."""
    lines: list[str] = []
    lines.append(f"ISSUE #{issue_number} — DELIBERATION DATA\n")
    lines.append("CANDIDATES:\n")
    for c in candidates:
        name = c.get("name", "Unknown") if isinstance(c, dict) else str(c)
        summary = c.get("scoutSummary", "") if isinstance(c, dict) else ""
        score = c.get("advocateScore", "") if isinstance(c, dict) else ""
        argument = c.get("advocateArgument", "") if isinstance(c, dict) else ""
        lines.append(
            f"- {name}: Scout found — {summary} | "
            f"Advocate score {score}/10 — {argument}"
        )
    lines.append(
        f"\nWINNER (authoritative — the selected charity, the final call): "
        f"{winning_charity_name}"
    )
    lines.append(
        f"\nEDITOR DECISION (supporting rationale only — may discuss "
        f"runners-up): {editor_decision}"
    )
    lines.append(f"\nRUNNER-UP NOTES: {runner_up_notes}")
    lines.append(
        f"\nThe Editor's final turn MUST conclude that "
        f"{winning_charity_name} is the selected charity. If the EDITOR "
        f"DECISION text above favors a different charity, treat that as the "
        f"Editor's earlier reasoning and still end with {winning_charity_name} "
        f"as the pick."
    )
    lines.append(
        "\n\nStage the above as an 8-16 turn conversation between scout, "
        "advocate, and editor. Each turn: plain prose, no Markdown, no invented "
        "facts. Return JSON: "
        '{\"turns\": [{\"speaker\": \"...\", \"text\": \"...\"}]}.'
    )
    return "\n".join(lines)


# ── Chronicler node ───────────────────────────────────────────────────────


@agent_node(name="chronicler", emit_event=None)
async def chronicler(state: DispatchState) -> dict[str, Any]:
    """Single LLM call that dramatizes the real deliberation as dialogue.

    Reads: candidates, winning_charity, editor_decision, runner_up_notes,
           issue_number, run_id, model_versions.
    Writes: deliberation_conversation (list[dict]), deliberation_transcript
            (str derived from turns), model_versions (adds 'chronicler').

    On any failure: returns {deliberation_conversation: None} only.
    The editor_gate_1 deliberation_transcript survives unmodified (D-18).
    """
    candidates = state.get("candidates") or []
    winning = state.get("winning_charity") or {}
    winner_name = winning.get("name", "") if isinstance(winning, dict) else str(winning)
    editor_decision = state.get("editor_decision", "") or ""
    runner_up_notes = state.get("runner_up_notes", "") or ""
    issue_number = state.get("issue_number", "")
    run_id = state["run_id"]

    system = _build_system_prompt()
    user = _build_user_prompt(
        candidates, winner_name, editor_decision, runner_up_notes, issue_number
    )

    try:
        result, usage = await acomplete(
            agent_id="chronicler",
            run_id=run_id,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format=ChroniclerOutput,
        )
        # model_dump() for Pydantic _Turn instances; identity for plain dicts
        # (stub mode returns _FakeChroniclerOutput with list[dict]).
        turns = [
            t if isinstance(t, dict) else t.model_dump()
            for t in result.turns
        ]
        if len(turns) < 4:
            raise ValueError(f"chronicler: too few turns ({len(turns)})")

        transcript = "\n\n".join(
            f"{t['speaker'].capitalize()}: {t['text']}" for t in turns
        )

        model_versions = dict(state.get("model_versions") or {})
        model_versions["chronicler"] = usage.get(
            "resolved_model", MODEL_BY_AGENT["chronicler"]
        )
        return {
            "deliberation_conversation": turns,
            "deliberation_transcript": transcript,
            "model_versions": model_versions,
        }

    except Exception as exc:   # D-18 / Pitfall 6: never fail the run on a chronicler hiccup
        log.warning("chronicler failed, falling back to template transcript: %r", exc)
        return {"deliberation_conversation": None}   # deliberation_transcript stays as editor_gate_1 set it
