---
phase: 13-deliberation-as-conversation
plan: 02
type: execute
wave: 2
depends_on: ["13-01"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py
  - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
autonomous: true
requirements: [DEL-CONV-01, DEL-CONV-02, DEL-CONV-05, DEL-CONV-06]
must_haves:
  truths:
    - "A new chronicler graph node runs between editor_gate_1 and researcher and produces ≥8 well-formed {speaker, text} dialogue turns in a single LLM call"
    - "The turns are faithful — charity names, advocate scores, the winner, and the editor reasoning all trace to actual DispatchState values passed into the prompt"
    - "On Chronicler LLM failure the run falls back to the editor_gate_1 deterministic transcript (never an empty/absent transcript)"
    - "The Chronicler writes deliberation_conversation onto state AND derives deliberation_transcript from the turns; the Sanity write persists the conversation array with _key fields"
    - "Exactly one new LLM call is added (the Chronicler); model_versions['chronicler'] is recorded (AGT-17)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py"
      provides: "The chronicler @agent_node: single acomplete call, structured ChroniclerOutput, fallback, transcript derivation"
      contains: "async def chronicler"
      min_lines: 80
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py"
      provides: "chronicler entry in MODEL_BY_AGENT + SAMPLING_BY_AGENT"
      contains: "chronicler"
    - path: "packages/pipeline/src/eisenbalm_pipeline/graph/builder.py"
      provides: "editor_gate_1 -> chronicler -> researcher rewiring"
      contains: "chronicler"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py"
      provides: "conversation[] write in selectionDeliberation with _key fields"
      contains: "conversation"
  key_links:
    - from: "graph/builder.py editor_gate_1"
      to: "agents/chronicler.py chronicler"
      via: "add_edge editor_gate_1 -> chronicler -> researcher"
      pattern: "add_edge\\(\"editor_gate_1\", \"chronicler\"\\)"
    - from: "agents/chronicler.py"
      to: "lib/openrouter_client.acomplete"
      via: "single kwargs-only acomplete call with response_format=ChroniclerOutput"
      pattern: "acomplete\\(\\s*agent_id=\"chronicler\""
    - from: "lib/sanity_client.write_issue_draft"
      to: "Sanity selectionDeliberation.conversation[]"
      via: "enumerate(state['deliberation_conversation']) with _key=turn-NNN"
      pattern: "deliberation_conversation"
---

<objective>
Build the pipeline producer for the conversation: a new `chronicler` LangGraph node that takes the real deliberation data (Scout findings, Advocate scores/arguments, Editor decision) and stages it as a faithful multi-turn dialogue in a SINGLE LLM call, then persists those structured turns to Sanity.

This plan:
1. Adds `chronicler` to llm_config (MODEL_BY_AGENT + SAMPLING_BY_AGENT) so acomplete can route it.
2. Creates `agents/chronicler.py` — a `@agent_node(name="chronicler", emit_event=None)` async function that calls `acomplete` once with a Pydantic `ChroniclerOutput`, derives a flat transcript from the turns (D-17), records `model_versions['chronicler']` (AGT-17), and falls back gracefully on failure (D-18).
3. Rewires `graph/builder.py`: `editor_gate_1 → researcher` becomes `editor_gate_1 → chronicler → researcher`.
4. Extends `lib/sanity_client.write_issue_draft` to write `selectionDeliberation.conversation[]` with `_key` fields (per the contract Plan 01 declared in API_CONTRACTS §2.2).

Purpose: produce the canonical structured turns + transcript that the frontend (Plan 03) renders and that the NotebookLM export (D-17) consumes.
Output: a working chronicler node wired into the graph, persisting conversation turns to Sanity, with the deterministic transcript retained as the fallback.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/13-deliberation-as-conversation/13-CONTEXT.md
@.planning/phases/13-deliberation-as-conversation/13-RESEARCH.md
@.planning/phases/13-deliberation-as-conversation/13-VALIDATION.md

<interfaces>
<!-- Contract this plan implements (declared by Plan 01 in API_CONTRACTS + state.py). -->

DispatchState field (already added by Plan 01):
  deliberation_conversation: Optional[list[dict]]  # [{"speaker": "scout|advocate|editor", "text": "plain prose"}]

acomplete signature (lib/openrouter_client.py, kwargs-ONLY — note the leading `*`):
  async def acomplete(*, agent_id: str, run_id: str, messages: list[dict[str, str]],
                      response_format: Optional[Type[BaseModel]] = None) -> tuple[Any, dict[str, Any]]
  Returns (content, usage) where usage = {tokens_in, tokens_out, usd, resolved_model}.

@agent_node decorator (agents/_wrapper.py, kwargs-only):
  agent_node(*, name: str, emit_event: Optional[str] = None,
             payload_builder: Optional[Callable] = None, max_tool_calls: Optional[int] = None)

VOICE_CONSTRAINTS (lib/voice.py) — reuse verbatim (D-16).

editor_gate_1 return shape (agents/editor.py ~line 405) — the inputs the chronicler reads:
  winning_charity (CharityCandidate dict with .name), editor_decision (str), runner_up_notes (str),
  candidates (list[CharityCandidate] each with name/scoutSummary/advocateArgument/advocateScore),
  deliberation_transcript (the deterministic template — the fallback to preserve).

llm_config keys: voice-critical pin = MODEL_PIN_VOICE_CRITICAL = "anthropic/claude-opus-4-7".
Two-name convention note: the editor uses agent_id "editor_gate1" (no underscore) in MODEL_BY_AGENT.
Chronicler uses agent_id "chronicler" consistently in both MODEL_BY_AGENT and acomplete(agent_id=...).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add chronicler to llm_config + create agents/chronicler.py (single LLM call, fallback, transcript derivation)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py, packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py (the MODEL_BY_AGENT + SAMPLING_BY_AGENT dicts + MODEL_PIN_VOICE_CRITICAL — the exact existing keys/values to mirror)
    - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py (lines 35-48 import block; lines 112-169 _format_deliberation_transcript; lines 248-412 editor_gate_1 — mirror its @agent_node decorator, acomplete kwargs call, AGT-17 model_versions pattern, and Pydantic BaseModel response_format usage)
    - packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py (lines 113-235 acomplete kwargs-only signature + return shape; the stub-mode short-circuit at line 141 so the chronicler works in EISENBALM_STUB_MODE)
    - packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py (the @agent_node signature + how it wraps return; emit_event=None means no deliberationEvents:insert — confirm)
    - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py (VOICE_CONSTRAINTS verbatim string — D-16; build_section_writer_prompt structure to mirror)
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py (DispatchState with the deliberation_conversation field Plan 01 added)
    - packages/pipeline/tests/test_chronicler.py (the Wave 0 tests this task must turn green — read them to match the exact return-dict keys/shapes asserted)
    - .planning/phases/13-deliberation-as-conversation/13-RESEARCH.md (Pattern 1 Chronicler node + fallback block; the verified system/user prompt examples; Pattern 11 llm_config; Pitfall 1 acomplete positional-arg trap; Pitfall 6 fallback; Pitfall 7 no-Markdown prompt rule)
    - .planning/phases/13-deliberation-as-conversation/13-CONTEXT.md (D-01..D-05, D-13..D-18)
  </read_first>
  <behavior>
    - test_chronicler_produces_wellformed_turns: returns dict with deliberation_conversation = list of ≥8 dicts, each with exactly keys {"speaker","text"}, speaker ∈ {scout,advocate,editor}
    - test_turn_faithfulness: the chronicler's built user-prompt string contains the real winning charity name and each candidate's advocateScore (e.g. "7"); no fabricated facts
    - test_fallback_preserves_transcript: when acomplete raises, returns deliberation_conversation None and does NOT overwrite deliberation_transcript (omit the key or echo the existing sentinel)
    - test_model_versions_recorded: returned model_versions dict contains key "chronicler" mapped to the resolved model
  </behavior>
  <action>
    A) llm_config.py — add `"chronicler"` to BOTH dicts (per RESEARCH Pattern 11):
    - In MODEL_BY_AGENT, add (place it logically near the voice-critical group): `"chronicler":   MODEL_PIN_VOICE_CRITICAL,   # Phase 13 — voice-critical persona dialogue`
    - In SAMPLING_BY_AGENT, add: `"chronicler":   {"temperature": 0.4, "top_p": 1.0},  # creative staging but faithful to real scores/names`

    B) Create packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py with:
    - Module docstring noting: single LLM call (D-04), faithful dramatization (D-14), Jesse voice via VOICE_CONSTRAINTS (D-16), no Markdown in turn text (Pitfall 7), DEL-04 (no model/AI references).
    - Imports: `from __future__ import annotations`; `from typing import Any`; `from pydantic import BaseModel`; `from eisenbalm_pipeline.agents._wrapper import agent_node`; `from eisenbalm_pipeline.graph.state import DispatchState`; `from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS`; `from eisenbalm_pipeline.lib.openrouter_client import acomplete`; `from eisenbalm_pipeline.lib.llm_config import MODEL_BY_AGENT`.
    - Pydantic models:
      ```python
      class _Turn(BaseModel):
          speaker: str   # "scout" | "advocate" | "editor"
          text: str      # plain prose, no Markdown
      class ChroniclerOutput(BaseModel):
          turns: list[_Turn]
      ```
      (Use field defaults if needed so model_construct() works in stub mode — mirror StyleBriefOutput pattern: `turns: list[_Turn] = []`.)
    - `_build_system_prompt() -> str`: returns an f-string starting with `VOICE_CONSTRAINTS` verbatim, then The Chronicler role, the three personas (scout=The Scout reports findings; advocate=The Advocate scores 0-10 with argument; editor=The Editor makes the final call), and the explicit rules from RESEARCH Code Examples: (1) faithful dramatization, invent no new facts; (2) Output ONLY plain prose — no `#`, `##`, `**`, `_`, `[link](url)`, no bullet points, no numbered lists, no headings; (3) ~8-16 turns with genuine back-and-forth; (4) speaker exactly one of scout|advocate|editor; (5) never reference AI, language models, or Jesse's AI nature; (6) Jesse voice every turn, no exclamation marks. Do NOT put any model name literal in this file.
    - `_build_user_prompt(candidates, winning_charity, editor_decision, runner_up_notes, issue_number) -> str`: mirror RESEARCH Code Examples — render each candidate as `- {name}: Scout found — {scoutSummary} | Advocate score {advocateScore}/10 — {advocateArgument}`, then WINNER, EDITOR DECISION, RUNNER-UP NOTES blocks, then the instruction to stage an 8-16 turn conversation returning JSON {"turns":[{"speaker","text"}]}. winning_charity may be a dict — extract `.get("name", "")` if dict else use as str.
    - The node:
      ```python
      @agent_node(name="chronicler", emit_event=None)
      async def chronicler(state: DispatchState) -> dict[str, Any]:
          candidates = state.get("candidates") or []
          winning = state.get("winning_charity") or {}
          winner_name = winning.get("name", "") if isinstance(winning, dict) else str(winning)
          editor_decision = state.get("editor_decision", "") or ""
          runner_up_notes = state.get("runner_up_notes", "") or ""
          issue_number = state.get("issue_number", "")
          run_id = state["run_id"]
          system = _build_system_prompt()
          user = _build_user_prompt(candidates, winner_name, editor_decision, runner_up_notes, issue_number)
          try:
              result, usage = await acomplete(
                  agent_id="chronicler",
                  run_id=run_id,
                  messages=[{"role": "system", "content": system},
                            {"role": "user", "content": user}],
                  response_format=ChroniclerOutput,
              )
              turns = [t.model_dump() for t in result.turns]
              if len(turns) < 4:
                  raise ValueError(f"chronicler: too few turns ({len(turns)})")
              transcript = "\n\n".join(f"{t['speaker'].capitalize()}: {t['text']}" for t in turns)
              model_versions = dict(state.get("model_versions") or {})
              model_versions["chronicler"] = usage.get("resolved_model", MODEL_BY_AGENT["chronicler"])
              return {
                  "deliberation_conversation": turns,
                  "deliberation_transcript": transcript,
                  "model_versions": model_versions,
              }
          except Exception as exc:   # D-18 / Pitfall 6: never fail the run on a chronicler hiccup
              log.warning("chronicler failed, falling back to template transcript: %r", exc)
              return {"deliberation_conversation": None}   # deliberation_transcript stays as editor_gate_1 set it
      ```
      Add `import logging` and `log = logging.getLogger(__name__)` near the top. CRITICAL: the try/except MUST be INSIDE the function body so the @agent_node wrapper never sees the exception (Pitfall 6 — wrapper would mark the run failed). Do NOT use `**state` in the return (return only the keys you own — STATE.md Phase 5 fan-out lesson; sequential nodes also return only owned keys cleanly because LangGraph merges by key).
  </action>
  <verify>
    <automated>cd packages/pipeline && python -m pytest tests/test_chronicler.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n '"chronicler"' packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py` returns lines in BOTH MODEL_BY_AGENT and SAMPLING_BY_AGENT
    - `grep -n "async def chronicler" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py` returns one line
    - `grep -n "@agent_node(name=\"chronicler\", emit_event=None)" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py` returns one line
    - `grep -n "acomplete(" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py` shows the call uses `agent_id="chronicler"`, `run_id=`, `messages=`, `response_format=` (all kwargs — Pitfall 1)
    - `grep -n "VOICE_CONSTRAINTS" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py` returns at least one line (D-16 reuse)
    - `grep -niE "claude|sonnet|haiku|gpt|openrouter" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py` returns NO match (DEL-04 — no model literals in the chronicler source)
    - `grep -n "try:" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py` and the except branch returning `{"deliberation_conversation": None}` are present (D-18 fallback inside the function body)
    - `grep -c "\*\*state" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py` returns 0 (no full-state spread)
    - `cd packages/pipeline && python -m pytest tests/test_chronicler.py -x -q` exits 0 (all 4 Wave 0 chronicler tests green)
  </acceptance_criteria>
  <done>chronicler.py exists and passes its 4 Wave 0 tests; llm_config routes "chronicler"; single acomplete call; fallback inside the body; AGT-17 recorded; no model-name literals.</done>
</task>

<task type="auto">
  <name>Task 2: Rewire graph/builder.py (editor_gate_1 -> chronicler -> researcher) + write conversation[] in sanity_client.write_issue_draft</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/graph/builder.py, packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py (lines 40-63 imports; lines 99-150 node registration + edges — the exact `add_node`/`add_edge` calls; line 132 `builder.add_edge("editor_gate_1", "researcher")` is the edge to rewire)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (lines 146-250 write_issue_draft; lines 216-232 the selectionDeliberation dict — the insertion point after runnerUpNotes)
    - docs/API_CONTRACTS.md (§2.2 the conversation write block Plan 01 added — match the _key/_type/speaker/text shape verbatim)
    - packages/pipeline/tests/test_builder_wiring.py + tests/test_sanity_write.py (the Wave 0 assertions this task turns green)
    - .planning/phases/13-deliberation-as-conversation/13-RESEARCH.md (Pattern 2 edge rewiring; Pattern 7 Sanity write extension; Pitfall 2 Sanity array _key requirement)
  </read_first>
  <action>
    A) graph/builder.py:
    - Add the import alongside the other agent imports (after `from eisenbalm_pipeline.agents.case_study import case_study` or grouped logically): `from eisenbalm_pipeline.agents.chronicler import chronicler`
    - Register the node: after `builder.add_node("editor_gate_1", editor_gate_1)` (line ~103) add `builder.add_node("chronicler", chronicler)`
    - Rewire the edge: REPLACE the single line `builder.add_edge("editor_gate_1", "researcher")` (line ~132) with the two lines:
      ```python
      builder.add_edge("editor_gate_1", "chronicler")
      builder.add_edge("chronicler", "researcher")
      ```
    - Leave the `researcher -> verify_research` edge and everything downstream unchanged. The chronicler is purely sequential between editor_gate_1 and researcher (D-01); no reducer change, no fan-in change.

    B) lib/sanity_client.py — in write_issue_draft, inside the `"selectionDeliberation": { ... }` dict, AFTER the `"runnerUpNotes": state.get("runner_up_notes", ""),` line (line ~231) and before the closing `}`, add (matching API_CONTRACTS §2.2 verbatim):
    ```python
    "runnerUpNotes": state.get("runner_up_notes", ""),
    "conversation": [
        {
            "_type": "object",
            "_key": f"turn-{i:03d}",
            "speaker": t["speaker"],
            "text": t["text"],
        }
        for i, t in enumerate(state.get("deliberation_conversation") or [])
    ]
    or None,
    ```
    The `or None` ensures old runs / fallback path (deliberation_conversation None or empty) write `conversation: None` rather than `[]` (graceful for the frontend null-guard). The `_key` is REQUIRED for Sanity array-of-object items written via the Python client (Pitfall 2).
  </action>
  <verify>
    <automated>cd packages/pipeline && python -m pytest tests/test_builder_wiring.py tests/test_sanity_write.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "from eisenbalm_pipeline.agents.chronicler import chronicler" packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` returns one line
    - `grep -n 'builder.add_node("chronicler", chronicler)' packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` returns one line
    - `grep -n 'builder.add_edge("editor_gate_1", "chronicler")' packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` returns one line
    - `grep -n 'builder.add_edge("chronicler", "researcher")' packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` returns one line
    - `grep -c 'builder.add_edge("editor_gate_1", "researcher")' packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` returns 0 (old direct edge removed)
    - `grep -n '"conversation":' packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` returns a line inside write_issue_draft's selectionDeliberation dict
    - `grep -n "turn-{i:03d}" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` returns one line
    - `grep -n "deliberation_conversation" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` returns one line (reads the state field)
    - `cd packages/pipeline && python -m pytest tests/test_builder_wiring.py tests/test_sanity_write.py -x -q` exits 0
  </acceptance_criteria>
  <done>builder.py routes editor_gate_1 -> chronicler -> researcher; write_issue_draft persists conversation[] with _key fields; both Wave 0 tests green.</done>
</task>

</tasks>

<verification>
Full-suite gate after this plan (13-VALIDATION.md sampling — run before merging Wave 2 pipeline side):
- `cd packages/pipeline && python -m pytest -q` exits 0 (full pipeline suite — chronicler + wiring + sanity-write green; test_transcript_format still green — D-18 fallback intact)
- `cd packages/pipeline && python -c "from eisenbalm_pipeline.graph.builder import build_graph"` imports without error (chronicler import resolves)
- `grep -c "chronicler" packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` ≥ 3 (import + node + 2 edges)
- The exactly-one-new-LLM-call constraint holds: `grep -c "await acomplete" packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py` == 1
</verification>

<success_criteria>
- chronicler node produces ≥8 faithful {speaker,text} turns in one LLM call (DEL-CONV-01, success criterion 1+5)
- Fallback to deterministic transcript on failure; transcript still derivable for NotebookLM (DEL-CONV-01, DEL-CONV-05, success criterion 4)
- conversation[] persisted to Sanity with _key, no Convex eventType (DEL-CONV-02)
- model_versions['chronicler'] recorded; no model-name literals in source (DEL-CONV-06, AGT-17, DEL-04)
- exactly one added LLM call; pipeline tests green (DEL-CONV-06, success criterion 5)
</success_criteria>

<output>
After completion, create `.planning/phases/13-deliberation-as-conversation/13-02-SUMMARY.md`
</output>
