---
phase: quick-260524-ojm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py
  - packages/pipeline/tests/test_chronicler.py
autonomous: true
requirements: [CHRON-WINNER-AUTHORITATIVE]
must_haves:
  truths:
    - "The Chronicler prompt instructs the editor's final/closing turn to name the actual winning charity as the pick."
    - "When editor_decision text favors a different charity than winning_charity, the prompt tells the LLM to treat editor_decision as earlier reasoning and still conclude with the winning charity."
    - "All 4 existing chronicler tests stay green; one NEW test asserts WINNER-authoritative instruction at the prompt-construction level."
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py"
      provides: "WINNER-authoritative system + user prompt instructions"
      contains: "WINNER AUTHORITY"
    - path: "packages/pipeline/tests/test_chronicler.py"
      provides: "New divergence test (winner != editor_decision favorite) asserting prompt authority"
      contains: "winner_authoritative"
  key_links:
    - from: "chronicler._build_system_prompt"
      to: "editor final turn = winning_charity"
      via: "explicit WINNER-authoritative rule in system prompt"
      pattern: "WINNER AUTHORITY"
    - from: "chronicler._build_user_prompt"
      to: "winning_charity_name as final call"
      via: "inline instruction near WINNER/EDITOR DECISION lines"
      pattern: "is the selected charity"
---

<objective>
Fix the Chronicler faithfulness bug surfaced by issue 999001: when the two top
candidates tie and the editor_gate_1 `editor_decision` reasoning text favors a
DIFFERENT charity than the deterministic `winning_charity`, the Chronicler's
editor turns conclude with the WRONG charity — contradicting the featured
charity that all 8 section writers actually wrote about.

Root cause: `_build_user_prompt` passes BOTH `WINNER: {name}` (authoritative)
and `EDITOR DECISION: {editor_decision}` (can favor a runner-up). The prompts
never establish WINNER as authoritative over the editor_decision narrative, so
the LLM follows the editor_decision narrative.

Fix: prompt-level only. Make WINNER authoritative in `_build_system_prompt`
and `_build_user_prompt`. The editor may discuss/weigh runners-up, but its
final/closing turn MUST name `{winning_charity_name}` as the pick.

Purpose: Restore brand integrity — the deliberation conversation must never
name a winner other than the featured charity.
Output: Updated chronicler.py prompts + one new divergence regression test.

SHAPE CONFIRMATION (no stop-and-flag needed): Verified against
docs/API_CONTRACTS.md §7 (DispatchState, line 1329) and §2 (Sanity write,
lines 379-382). The fix touches ONLY prompt string text. The {speaker, text}
turn shape, the Sanity `conversation` write shape, API_CONTRACTS.md, and
DispatchState are all unchanged. No shape change is required.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

# The file being fixed (read fully before editing — both prompt builders + chronicler body)
@packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py

# The test file to extend (4 existing tests must stay green)
@packages/pipeline/tests/test_chronicler.py

# VOICE_CONSTRAINTS — MUST remain reused verbatim in the system prompt (do not edit voice.py)
@packages/pipeline/src/eisenbalm_pipeline/lib/voice.py

# Phase 13 validation strategy — the fix must not break it
@.planning/phases/13-deliberation-as-conversation/13-VALIDATION.md

<interfaces>
<!-- Key contracts the executor needs. Extracted from chronicler.py. No exploration required. -->

Prompt builder signatures (DO NOT change):

    def _build_system_prompt() -> str: ...
    def _build_user_prompt(
        candidates: list[dict],
        winning_charity_name: str,   # AUTHORITATIVE — the real featured charity
        editor_decision: str,        # supporting rationale only — may favor a runner-up
        runner_up_notes: str,
        issue_number: Any,
    ) -> str: ...

Current `_build_user_prompt` body emits these lines (the divergence source):

    lines.append(f"\nWINNER: {winning_charity_name}")
    lines.append(f"\nEDITOR DECISION: {editor_decision}")
    lines.append(f"\nRUNNER-UP NOTES: {runner_up_notes}")

Current system-prompt "Rules (non-negotiable):" block ends at rule 7 (the
JSON-schema rule). The new WINNER-authority rule is inserted as a new numbered
rule 7 (renumbering the JSON rule to 8), keeping VOICE_CONSTRAINTS verbatim at
the top via the existing `f"{VOICE_CONSTRAINTS}\n\n"` line.

HARD invariants (acceptance criteria below enforce all of these):
- Exactly ONE `await acomplete(...)` call in chronicler.py (D-04).
- VOICE_CONSTRAINTS reused verbatim in the system prompt (f"{VOICE_CONSTRAINTS}\n\n...").
- D-18 fallback unchanged: on failure return {"deliberation_conversation": None},
  leaving editor_gate_1's deliberation_transcript intact.
- Structured turns with speaker in {scout, advocate, editor}; no Markdown in turn text.
- DEL-04 preserved (no model names; existing "Never reference AI..." rule stays).
- No new pip/npm deps.
- {speaker, text} shape, Sanity write shape, API_CONTRACTS.md, DispatchState: UNCHANGED.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Make WINNER authoritative in chronicler prompts</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py (read fully: _build_system_prompt, _build_user_prompt, chronicler body)
    - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py (confirm VOICE_CONSTRAINTS stays verbatim — do NOT edit this file)
  </read_first>
  <behavior>
    - The system prompt establishes WINNER as the authoritative final decision over the editor_decision narrative.
    - The user prompt, near the WINNER/EDITOR DECISION lines, instructs the editor's final turn to conclude with the winning charity by name.
    - When editor_decision names a different charity as chosen, the LLM is told to treat that as the editor's earlier reasoning and still conclude with WINNER.
    - VOICE_CONSTRAINTS remains verbatim at the top of the system prompt.
    - The exactly-one acomplete call and the D-18 fallback are untouched.
  </behavior>
  <action>
    Edit `_build_system_prompt()` ONLY in the "Rules (non-negotiable):" block.
    Keep the `f"{VOICE_CONSTRAINTS}\n\n"` line and the three-persona description
    block unchanged. Insert a NEW rule as rule 7 (between the current rule 6
    "Jesse voice every turn..." and the current rule 7 JSON-schema rule), and
    renumber the JSON-schema rule to 8.

    Add this exact rule text as the new rule 7:

        "7. WINNER AUTHORITY (non-negotiable): The Editor's final turn must "
        "conclude that the WINNER named in the data is the selected charity — "
        "the pick. The WINNER is the authoritative final decision. The EDITOR "
        "DECISION text is supporting rationale only: the Editor may discuss and "
        "weigh runners-up, but if the EDITOR DECISION text names a different "
        "charity as chosen, treat that as the Editor's earlier reasoning and "
        "still conclude the conversation with the WINNER as the final call.\n"

    Then change the trailing JSON rule from "7." to "8." (text otherwise
    unchanged):

        "8. Return valid JSON matching the schema: "
        '{\"turns\": [{\"speaker\": \"scout\", \"text\": \"...\"}]}.'

    Edit `_build_user_prompt(...)` ONLY in the WINNER/EDITOR DECISION region.
    Replace these three current lines:

        lines.append(f"\nWINNER: {winning_charity_name}")
        lines.append(f"\nEDITOR DECISION: {editor_decision}")
        lines.append(f"\nRUNNER-UP NOTES: {runner_up_notes}")

    with:

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

    Do NOT touch: the `chronicler()` body, the single `await acomplete(...)`
    call, the try/except D-18 fallback, the ChroniclerOutput/_Turn schemas, the
    transcript derivation, or any field names. Do NOT add imports or deps.
  </action>
  <verify>
    <automated>cd packages/pipeline && grep -q "WINNER AUTHORITY" src/eisenbalm_pipeline/agents/chronicler.py && grep -q "is the selected charity" src/eisenbalm_pipeline/agents/chronicler.py && grep -q 'f"{VOICE_CONSTRAINTS}' src/eisenbalm_pipeline/agents/chronicler.py && [ "$(grep -c 'await acomplete(' src/eisenbalm_pipeline/agents/chronicler.py)" = "1" ] && grep -q 'return {"deliberation_conversation": None}' src/eisenbalm_pipeline/agents/chronicler.py && echo PROMPT_OK</automated>
  </verify>
  <done>
    chronicler.py system prompt contains a "WINNER AUTHORITY" rule (renumbered as
    rule 7, JSON rule now 8); user prompt contains the "is the selected charity"
    final-turn instruction; VOICE_CONSTRAINTS still interpolated verbatim;
    exactly one `await acomplete(` call; D-18 fallback line unchanged.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add divergence regression test (winner != editor_decision favorite)</name>
  <read_first>
    - packages/pipeline/tests/test_chronicler.py (read fully — reuse _minimal_state, _FakeChroniclerOutput, capture pattern from test_turn_faithfulness)
    - packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py (confirm the prompt text added in Task 1, so assertions match the literal strings)
  </read_first>
  <behavior>
    - Given a state where winning_charity.name = "Grassroots Poverty Action Network" but editor_decision favors "Community Justice and Accountability Initiative", the built prompts make WINNER (Grassroots) authoritative.
    - Because unit tests mock the LLM, the assertion is at the PROMPT-CONSTRUCTION level: capture the messages passed to acomplete and assert the WINNER-authority instruction names the winning charity as the selected/final pick.
    - The 4 existing chronicler tests remain green.
  </behavior>
  <action>
    Append ONE new async test to packages/pipeline/tests/test_chronicler.py named
    `test_winner_authoritative_when_editor_decision_diverges`. Mirror the existing
    `test_turn_faithfulness` capture pattern (capture acomplete kwargs["messages"],
    return a _FakeChroniclerOutput so the chronicler body completes).

    Construct state where the winner differs from the charity the editor_decision
    text favors:

        winner = "Grassroots Poverty Action Network"
        favored_by_editor = "Community Justice and Accountability Initiative"
        state = _minimal_state(charity_name=winner, extra={
            "winning_charity": {"name": winner, "location": "NYC", "advocateScore": 7},
            "editor_decision": (
                f"On the tiebreaker, {favored_by_editor} edges ahead — "
                "its accountability model is the stronger pick."
            ),
            "runner_up_notes": f"{favored_by_editor} was a very close second.",
            # candidates includes BOTH so faithful data is present
            "candidates": [
                {"name": winner, "scoutSummary": "Direct cash transfers.",
                 "advocateArgument": "Operationally tight.", "advocateScore": 7},
                {"name": favored_by_editor, "scoutSummary": "Police oversight.",
                 "advocateArgument": "Strong accountability model.", "advocateScore": 7},
            ],
        })

    Mark with @pytest.mark.skipif(not CHRONICLER_AVAILABLE, ...) and
    @pytest.mark.asyncio (matching the other tests). Capture messages via the
    capture_acomplete pattern, call `await chronicler(state)`, then flatten all
    message content into one string `all_content` (same join as
    test_turn_faithfulness).

    Assert (these match the literal strings added in Task 1):

        # WINNER is flagged authoritative and named as the selected/final pick
        assert "authoritative" in all_content
        assert f"{winner} is the selected charity" in all_content
        # editor_decision is explicitly framed as supporting rationale only
        assert "supporting rationale only" in all_content
        # both the winner and the editor-favored charity appear (faithful data)
        assert winner in all_content
        assert favored_by_editor in all_content
        # system-prompt rule present
        assert "WINNER AUTHORITY" in all_content

    Do NOT modify the 4 existing tests. Do NOT change _minimal_state /
    _FakeChroniclerOutput / _make_mock_turns signatures.
  </action>
  <verify>
    <automated>cd packages/pipeline && python -m pytest tests/test_chronicler.py -q</automated>
  </verify>
  <done>
    `cd packages/pipeline && python -m pytest tests/test_chronicler.py -q` reports
    5 passed (4 existing + 1 new `test_winner_authoritative_when_editor_decision_diverges`).
    The new test asserts at the prompt-construction level that WINNER is
    authoritative and named as the final/selected pick when editor_decision
    favors a different charity.
  </done>
</task>

</tasks>

<verification>
Full local check (matches 13-VALIDATION.md regression posture):

1. Chronicler tests (target verify command):
   `cd packages/pipeline && python -m pytest tests/test_chronicler.py -q`
   Expected: 5 passed.

2. D-18 fallback regression (deterministic transcript still survives):
   `cd packages/pipeline && python -m pytest tests/agents/test_editor.py::test_transcript_format -x`
   Expected: passes (unchanged — fix is prompt-level, does not touch editor.py).

3. Shape invariants (no shape change leaked):
   - `grep -c 'await acomplete(' packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py` == 1
   - chronicler.py still returns turns as {"speaker", "text"} dicts (no key renames)
   - No edits to docs/API_CONTRACTS.md, graph/state.py (DispatchState), voice.py
</verification>

<success_criteria>
- WINNER is established as authoritative over editor_decision in both the system
  and user prompts of chronicler.py.
- The editor's final turn is instructed to name {winning_charity_name} as the pick,
  even when editor_decision text favors a different charity.
- `cd packages/pipeline && python -m pytest tests/test_chronicler.py -q` = 5 passed.
- All HARD constraints hold: exactly one acomplete call; VOICE_CONSTRAINTS verbatim;
  D-18 fallback unchanged; {speaker,text}/Sanity-write/API_CONTRACTS/DispatchState
  shapes unchanged; DEL-04 preserved; no new deps.
- Existing Sanity draft issue-999001 is NOT published or deleted (out of scope —
  untouched by this plan).
</success_criteria>

<output>
After completion, create `.planning/quick/260524-ojm-fix-chronicler-faithfulness-bug-delibera/260524-ojm-SUMMARY.md`
</output>
