"""Phase 13 Chronicler agent — single LLM call, faithful dramatization.

Phase 16 (Plan 16-06) refactor:
  - System prompt composition decomposed into UNIVERSAL_CORE (imported from
    lib/voice.py — narrator-agnostic hard rules) + WINNER_AUTHORITY_PREAMBLE
    (chronicler-local constant; D-04 caveat overriding CONTEXT canonical_refs
    line 122) + narrator-aware voice from style_brief["voice"] (calibrator-
    composed per Plan 16-05; NRR-05 consumer surface).
  - VOICE_CONSTRAINTS is no longer imported here — calibrator now writes the
    composed (narrator-aware OR Jesse-default) voice into style_brief["voice"];
    chronicler reads that single string (D-05 single-injection-point).
  - WINNER AUTHORITY moved out of the role instruction block into a module-
    level preamble constant, placed between the voice and the role rules.
  - When narrator carries a non-empty voiceRubric, it is appended after the
    preamble (canonical pattern shared with Plan 16-07: narrator.get(
    "voiceRubric") or "").

D-04: exactly one new LLM call per pipeline run.
D-14: faithful dramatization — the LLM stages REAL Scout findings, Advocate
      scores/arguments, and Editor decision as multi-turn dialogue. No invented
      facts.
D-16: Jesse voice enforced via the calibrator-composed style_brief["voice"]
      (which defaults to VOICE_CONSTRAINTS when no narrator is set — NRR-10
      byte-equivalence).
D-18: on any Chronicler failure the run falls back gracefully — the
      editor_gate_1 deterministic deliberation_transcript is preserved intact.
DEL-04: never reference AI, language models, or Jesse's AI nature.
DEL-CONV-01/02: produces deliberation_conversation list[{speaker, text}] and
      derives deliberation_transcript from the turns for NotebookLM (V2-02).
AGT-17: model_versions['chronicler'] recorded at call time.

NRR-02: Chronicler is the only agent whose system prompt varies by narrator
        (via style_brief["voice"] + optional narrator.voiceRubric).
NRR-05: Chronicler consumer surface = style_brief["voice"] (NOT direct
        VOICE_CONSTRAINTS import).
NRR-06: No leakage to other agents — WINNER_AUTHORITY_PREAMBLE is local to
        chronicler.py, not in lib/voice.py UNIVERSAL_CORE.
NRR-08: Narrator schema-alignment — narrator['name'] (not 'displayName'),
        narrator.get("voiceRubric") as plain str (not structured wrapper).

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
from eisenbalm_pipeline.graph.state import DispatchState, Narrator
from eisenbalm_pipeline.lib.llm_config import MODEL_BY_AGENT
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.voice import UNIVERSAL_CORE

log = logging.getLogger(__name__)


# ── Pydantic output schema ────────────────────────────────────────────────


class _Turn(BaseModel):
    speaker: str = ""    # "scout" | "advocate" | "editor"
    text: str = ""       # plain prose, no Markdown


class ChroniclerOutput(BaseModel):
    turns: list[_Turn] = []  # field default so model_construct() works in stub mode


# ── Phase 16 (Plan 16-06): module-level WINNER AUTHORITY preamble ────────
#
# Per D-04 caveat + CONTEXT canonical_refs line 122 override + 16-RESEARCH §G:
# the WINNER AUTHORITY rule lives HERE in the chronicler persona-agnostic
# preamble, NOT in lib/voice.py UNIVERSAL_CORE. Rationale: the rule is vacuous
# for narrative writers (no plausible substitution chain can introduce a
# non-winner subject through their inputs), but load-bearing for the Chronicler
# (whose user prompt explicitly carries candidates including runners-up + the
# editor_decision text which may name a different charity). Keeping it local
# to chronicler.py prevents leakage to other agents (NRR-06) and keeps
# UNIVERSAL_CORE narrator-agnostic.
WINNER_AUTHORITY_PREAMBLE = (
    "WINNER AUTHORITY: This issue features one charity, selected after deliberation. "
    "Treat that charity as the sole subject of your chronicle. Do not equivocate, "
    "do not invoke the runners-up, and do not soften the win with hedging. The "
    "selection is final."
)


# ── Phase 16 (Plan 16-06): narrator personalization helper ────────────────


def _personalize_universal_core(core: str, narrator: Narrator) -> str:
    """Replace 'Jesse's voice' with '<Name>'s voice' in the first sentence of UNIVERSAL_CORE.

    UNIVERSAL_CORE's opening sentence references "Jesse's voice" implicitly via
    the persona-block separation (post-16-04). When the active narrator is NOT
    Jesse, personalize the leading sentence so the rubric flows grammatically.
    For Jesse (or when the substring is absent), this is a no-op.

    NRR-08 schema alignment: the Narrator TypedDict (Plan 16-05) uses `name`
    (Sanity narratorProfile.name), NOT `displayName`. Using `displayName` would
    raise KeyError on any non-Jesse narrator.
    """
    return core.replace("Jesse's voice", f"{narrator['name']}'s voice", 1)


# ── Prompt builders ───────────────────────────────────────────────────────


def _build_system_prompt(state: DispatchState) -> str:
    """Compose the Chronicler system prompt (Plan 16-06 / D-10 structure).

    Layered composition:
      1. Voice block — sourced from `style_brief["voice"]` (calibrator-composed,
         narrator-aware per Plan 16-05; byte-equivalent to VOICE_CONSTRAINTS
         when no narrator is set, NRR-10). Falls back to UNIVERSAL_CORE alone
         when style_brief is absent (defensive — predates calibrator wiring in
         some unit-test paths).
      2. WINNER_AUTHORITY_PREAMBLE — chronicler-local guardrail (D-04 caveat).
      3. (optional) narrator.voiceRubric — appended when narrator carries a
         non-empty `voiceRubric` plain string. Canonical access pattern shared
         with Plan 16-07: `narrator.get("voiceRubric") or ""`.
      4. (optional) narrator.exampleSamples — first 2 samples appended as
         "Reference samples:" anchors.
      5. Chronicler role instructions — three personas, faithfulness rules,
         output schema.

    Args:
        state: DispatchState. Reads `style_brief["voice"]` (primary voice
            source, NRR-05) and `narrator` (optional — for rubric/samples and
            UNIVERSAL_CORE personalization).

    Returns:
        Composed system prompt string ready for the acomplete `messages[0]`
        slot.
    """
    narrator: dict[str, Any] = state.get("narrator") or {}
    style_brief: dict[str, Any] = state.get("style_brief") or {}

    # Voice block: calibrator-composed style_brief["voice"] is the canonical
    # NRR-05 surface (it already contains UNIVERSAL_CORE + persona, narrator-
    # aware or Jesse default). Fallback path: personalize UNIVERSAL_CORE for
    # narrator name if present, else use raw UNIVERSAL_CORE.
    voice = style_brief.get("voice")
    if not voice:
        if narrator.get("name"):
            voice = _personalize_universal_core(UNIVERSAL_CORE, narrator)
        else:
            voice = UNIVERSAL_CORE

    # Narrator voiceRubric — canonical plain-str pattern shared with Plan 16-07.
    rubric_str = narrator.get("voiceRubric") or ""

    parts: list[str] = [
        voice,
        "",
        WINNER_AUTHORITY_PREAMBLE,
    ]
    if rubric_str:
        parts.extend(["", rubric_str])

    samples = narrator.get("exampleSamples") or []
    if samples:
        parts.extend(["", "Reference samples:", *samples[:2]])

    parts.extend([
        "",
        (
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
            "6. Voice every turn per the voice block above. No exclamation marks. "
            "No winking.\n"
            "7. WINNER AUTHORITY (non-negotiable, see preamble above): The Editor's "
            "final turn must conclude that the WINNER named in the data is the "
            "selected charity — the pick. The WINNER is the authoritative final "
            "decision. The EDITOR DECISION text is supporting rationale only: "
            "the Editor may discuss and weigh runners-up, but if the EDITOR "
            "DECISION text names a different charity as chosen, treat that as "
            "the Editor's earlier reasoning and still conclude the conversation "
            "with the WINNER as the final call.\n"
            "8. Return valid JSON matching the schema: "
            '{"turns": [{"speaker": "scout", "text": "..."}]}.'
        ),
    ])

    # Drop empty strings so we never emit consecutive blank lines around an
    # absent rubric/samples block.
    return "\n".join(p for p in parts if p != "" or True).replace("\n\n\n", "\n\n")


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
           issue_number, run_id, model_versions, style_brief["voice"]
           (NRR-05 narrator-aware voice source), narrator (optional rubric +
           samples).
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

    system = _build_system_prompt(state)
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
