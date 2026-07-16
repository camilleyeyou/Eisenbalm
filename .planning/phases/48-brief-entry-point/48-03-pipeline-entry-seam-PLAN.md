---
phase: 48-brief-entry-point
plan: 03
type: execute
wave: 2
depends_on: ["48-01", "48-02"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
  - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py
  - packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md
  - packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py
autonomous: true
requirements: [ENT-02, ENT-03, ENT-04]

must_haves:
  truths:
    - "A brief run routes calibrator → verify_candidates → researcher, skipping signal_editor/scout/advocate/editor_gate_1/chronicler"
    - "A discovery run's execution order is byte-for-byte unchanged"
    - "_start_run seeds entry_mode/winning_charity/candidates/brief/source_material for brief runs and writes briefs:insert after runs:create"
    - "Existing _start_run callers (run_weekly, pipeline_run, pipeline_tick) are byte-equivalent"
    - "Operator source material is threaded into the Researcher's user prompt"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/graph/builder.py"
      provides: "route_by_entry_mode + two add_conditional_edges (after calibrator, after verify_candidates)"
      contains: "add_conditional_edges"
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/runs.py"
      provides: "_start_run extended with entry_mode/winning_charity/brief/source_material/agent_keys_override + briefs:insert"
      contains: "agent_keys_override"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py"
      provides: "source_material threaded into _build_messages"
      contains: "source_material"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/graph/builder.py"
      to: "DispatchState['entry_mode']"
      via: "route_by_entry_mode reads state.get('entry_mode') or 'discovery'"
      pattern: "entry_mode"
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/runs.py"
      to: "convex briefs:insert + verify_candidates candidates"
      via: "_start_run seeds candidates=[winning_charity] and writes briefs:insert after runs:create"
      pattern: "briefs:insert"
---

<objective>
Build the pipeline entry seam: the graph fork that lets a brief run skip Signal Editor/Scout/Advocate/Gate 1 and enter at the Researcher (ENT-02), the `_start_run` extension that seeds the human brief + org into `initial_state` and queues the shorter node set (ENT-02/ENT-04), and the source-material threading into the Researcher (ENT-02). Everything downstream of `researcher` is reused verbatim (ENT-03) — this plan touches only the entry seam.

Purpose: turn `test_builder_entry_mode_wiring.py` and `test_start_run_brief_seed.py` (48-02, currently skipped-red) green.
Output: forked graph + brief-aware launcher + source-material-aware Researcher.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/48-brief-entry-point/48-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
@packages/pipeline/src/eisenbalm_pipeline/api/runs.py
@packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py
@packages/pipeline/src/eisenbalm_pipeline/agents/editor.py

<interfaces>
<!-- Exact current shapes. Executor edits against these — no exploration needed. -->

builder.py (L143-172) — the two edges to REPLACE and the one to KEEP:
```python
builder.add_edge(START, "calibrator")            # KEEP unconditional (RESEARCH Pattern 1)
builder.add_edge("calibrator", "signal_editor")  # REPLACE with add_conditional_edges
builder.add_edge("signal_editor", "scout")
builder.add_edge("scout", "verify_candidates")
builder.add_edge("verify_candidates", "advocate")# REPLACE with add_conditional_edges
builder.add_edge("advocate", "editor_gate_1")
builder.add_edge("editor_gate_1", "chronicler")
builder.add_edge("chronicler", "researcher")
```

_start_run current signature (runs.py L237-246) — extend with 5 additive params, all defaulted so
existing callers stay byte-equivalent:
```python
async def _start_run(app, *, issue_number, trigger_source, triggered_by=None,
                     force_no_winner=False, force_fail_agent=None, narrator_slug=None) -> str:
```
Current agent_keys full list (runs.py L324-330):
```python
agent_keys = ["calibrator","signal_editor","scout","verify_candidates","advocate",
              "editor_gate_1","chronicler","researcher","verify_research",
              *SECTION_WRITERS,"validate_sections","qa","editor_final","publisher"]
```
Current runs_create_args (L310-317): {workspace_id, runId, triggerSource, triggeredBy?}.
Current initial_state (L351-361): {run_id, issue_number, publish_date, pipeline_started_at,
_force_no_winner, _force_fail_agent, config}.

editor.py D-14 synthetic-winner precedent (the shape to copy for the human org): a CharityCandidate
dict with name set and every other field defaulted "" / None (location, website, charityNavigatorUrl,
guidestarUrl, foundingYear, assetRange, focusArea, missionStatement, scoutSummary, whyOverlooked,
advocateArgument, advocateScore).

researcher.py _build_messages (L147-187): builds `user` by chaining `.replace("{charity}", ...)`,
`.replace("{results_block}", ...)`, `.replace("{corrections}", corrections_block)`. `researcher`
reads ONLY `state.get("winning_charity")` (L192) — never `state['candidates']`.

agent_wrapper.py: `_INPUT_KEYS["researcher"] == ["winning_charity"]` (L41).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fork the graph — route_by_entry_mode + two conditional edges (calibrator, verify_candidates)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/graph/builder.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py (L143-172 — the edge block)
    - packages/pipeline/tests/test_builder_entry_mode_wiring.py (the assertions this task must satisfy)
    - .planning/phases/48-brief-entry-point/48-RESEARCH.md §"Pattern 1" (~L94-131) and §"Pitfall 1" (~L306-310)
  </read_first>
  <behavior>
    - route_by_entry_mode(state) returns state.get("entry_mode") or "discovery" (absent → discovery, back-compat).
    - After calibrator: discovery → signal_editor, brief → verify_candidates.
    - After verify_candidates: discovery → advocate, brief → researcher.
    - START → calibrator stays unconditional; every other edge unchanged.
  </behavior>
  <action>
    In `graph/builder.py`, define a module-level `def route_by_entry_mode(state: DispatchState) -> str: return state.get("entry_mode") or "discovery"` (place near the top of the file or just above `build_graph`). Inside `build_graph`, KEEP `builder.add_edge(START, "calibrator")` exactly as-is. REPLACE `builder.add_edge("calibrator", "signal_editor")` with:
    `builder.add_conditional_edges("calibrator", route_by_entry_mode, {"discovery": "signal_editor", "brief": "verify_candidates"})`.
    REPLACE `builder.add_edge("verify_candidates", "advocate")` with:
    `builder.add_conditional_edges("verify_candidates", route_by_entry_mode, {"discovery": "advocate", "brief": "researcher"})`.
    Leave every other edge (`signal_editor→scout`, `scout→verify_candidates`, `advocate→editor_gate_1`, `editor_gate_1→chronicler`, `chronicler→researcher`, `researcher→verify_research`, the 7-way fan-out, the post-fan-in chain) UNCHANGED. Add a comment referencing D-01 / RESEARCH Pattern 1 explaining the fork is after calibrator + after verify_candidates (NOT at START), and that discovery's execution ORDER is byte-identical — only the edge-declaration mechanism for these two hops changes.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_builder_entry_mode_wiring.py tests/test_builder_wiring.py -x</automated>
  </verify>
  <acceptance_criteria>
    - `grep 'add_conditional_edges("calibrator"' packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` matches with `{"discovery": "signal_editor", "brief": "verify_candidates"}`.
    - `grep 'add_conditional_edges("verify_candidates"' packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` matches with `{"discovery": "advocate", "brief": "researcher"}`.
    - `grep 'add_edge("calibrator", "signal_editor")' packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` returns NOTHING (old static edge removed).
    - `grep 'add_edge(START, "calibrator")' packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` still matches (unconditional START edge kept).
    - `cd packages/pipeline && uv run pytest tests/test_builder_entry_mode_wiring.py tests/test_builder_wiring.py` exits 0 (fork test green; the existing Phase-13 chronicler wiring test still green).
  </acceptance_criteria>
  <done>The graph has two valid paths from one compiled graph: discovery unchanged, brief routes calibrator→verify_candidates→researcher. (ENT-02.)</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Extend _start_run — entry_mode seed, reduced agent_runs queue, briefs:insert (byte-equivalent for existing callers)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/runs.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py (_start_run, L237-378)
    - packages/pipeline/tests/test_start_run_brief_seed.py (the assertions this task must satisfy)
    - .planning/phases/48-brief-entry-point/48-RESEARCH.md §"Pattern 2" (~L133-188) and §"Pitfall 3" (~L318-322)
  </read_first>
  <behavior>
    - Discovery callers (no new args): runs:create payload has NO entryMode; agent_keys is the full 20-key list; no briefs:insert; initial_state has no entry_mode/candidates/brief/source_material keys.
    - Brief caller (entry_mode="brief", winning_charity, brief, source_material, agent_keys_override): initial_state carries entry_mode="brief", winning_charity, candidates=[winning_charity], brief, source_material; runs:create carries entryMode="brief"; agent_keys equals the override; briefs:insert called once.
    - briefs:insert is called AFTER runs:create, only when brief is not None.
  </behavior>
  <action>
    In `_start_run`, add 5 keyword params AFTER `narrator_slug`, all defaulted for byte-equivalence: `entry_mode: str = "discovery"`, `winning_charity: Optional[dict] = None`, `brief: Optional[dict] = None`, `source_material: Optional[str] = None`, `agent_keys_override: Optional[list[str]] = None`. Update the docstring's arg list + the CFG-04 ordering note (briefs:insert rides step 4b, after runs:create).
    Step 4 (runs_create_args): add `entryMode` ONLY for brief runs — `if entry_mode != "discovery": runs_create_args["entryMode"] = entry_mode` (keeps every existing discovery caller's runs:create payload byte-identical; Stage-1 treats absent as 'discovery' per schema default).
    Step 4b (NEW, immediately after `await _cc.convex_mutation(http, "runs:create", runs_create_args)`): `if brief is not None: await _cc.convex_mutation(http, "briefs:insert", {"runId": run_id, **brief})` (runId minted internally in Step 2; briefs:insert already in _PIPELINE_SECRET_GUARDED_PATHS — no new registration).
    Step 5 (agent_keys): change `agent_keys = [full list]` to `agent_keys = agent_keys_override or [full list]` (keep the existing full list literal intact as the else branch).
    initial_state: after the existing dict literal, add — ONLY for brief mode — `if entry_mode == "brief": initial_state["entry_mode"] = "brief"; initial_state["winning_charity"] = winning_charity; initial_state["candidates"] = [winning_charity] if winning_charity else []; initial_state["brief"] = brief;` and `if source_material: initial_state["source_material"] = source_material`. Do NOT set entry_mode for discovery (the router defaults absent→discovery; keeps discovery initial_state byte-identical). Verify existing callers (run_weekly L396, pipeline_run in control.py, pipeline_tick) are unchanged — they pass none of the new params.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_start_run_brief_seed.py tests/test_runs.py tests/test_control.py -x</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "agent_keys_override" packages/pipeline/src/eisenbalm_pipeline/api/runs.py` matches in both the signature and `agent_keys = agent_keys_override or [`.
    - `grep -n "briefs:insert" packages/pipeline/src/eisenbalm_pipeline/api/runs.py` matches, positioned after the `runs:create` mutation call.
    - `grep -n 'entry_mode != "discovery"' packages/pipeline/src/eisenbalm_pipeline/api/runs.py` matches (conditional entryMode write).
    - `cd packages/pipeline && uv run pytest tests/test_start_run_brief_seed.py` exits 0 (all seed + reduced-queue + byte-equivalence assertions green).
    - `cd packages/pipeline && uv run pytest tests/test_runs.py tests/test_control.py` exits 0 (existing callers unaffected).
  </acceptance_criteria>
  <done>_start_run seeds the brief run's state, queues the shorter node set, and writes the briefs row — while every existing caller stays byte-equivalent. (ENT-02/ENT-04.)</done>
</task>

<task type="auto">
  <name>Task 3: Thread source_material into the Researcher prompt (+ _INPUT_KEYS + DB-active-override note)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py, packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md, packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py (_build_messages, L147-187)
    - packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md (the token-bearing template)
    - packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py (_INPUT_KEYS, L33-41)
    - .planning/phases/48-brief-entry-point/48-RESEARCH.md §"Researcher threading (D-10)" (~L358-377) and §"Pitfall 5" (~L330-334)
  </read_first>
  <action>
    In `agents/researcher.py`, add `def _build_source_material_block(source_material: str | None) -> str:` mirroring `_build_corrections_block` — returns "" when falsy, else `f"OPERATOR-SUPPLIED SOURCE MATERIAL (prioritize these as seed context):\n{source_material}"`. In `_build_messages`, add one more chained `.replace("{source_material}", _build_source_material_block(state.get("source_material")))` to the `user` assignment (after the `{corrections}` replace).
    In `prompts/researcher_user.md`, add a `{source_material}` token in a sensible position (e.g. between the corrections and results blocks) and extend the top-of-file "DO NOT DELETE the … tokens" comment to include `{source_material}` (note it renders "" when absent — byte-equivalent for discovery).
    In `lib/agent_wrapper.py`, add `"source_material"` to `_INPUT_KEYS["researcher"]` so the Phase-44 Inspect-Inputs tab reports it for brief runs (`["winning_charity", "source_material"]`).
    In the researcher.py change, add a short comment stating the Pitfall-5 decision EXPLICITLY: a `researcher_user` `prompt_versions` row that is DB-active and predates this token will silently drop `{source_material}` (a `.replace` no-op on a missing substring) — this is an ACCEPTED, flagged degradation (matches the existing missing-token tolerance in the config system); the disk `.md` fallback carries the token for every run not overridden by a stale active version.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_researcher.py -x && grep -q "{source_material}" packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep "_build_source_material_block" packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` matches (definition + call in _build_messages).
    - `grep '{source_material}' packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md` matches.
    - `grep 'source_material' packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py` matches inside `_INPUT_KEYS["researcher"]`.
    - `cd packages/pipeline && uv run pytest tests/test_researcher.py` exits 0 (existing researcher tests still green — discovery-run messages are byte-equivalent since source_material renders "").
  </acceptance_criteria>
  <done>Operator source material reaches the Researcher's user prompt as prioritized seed context on brief runs; discovery runs are byte-equivalent; the Pitfall-5 degradation is flagged. (ENT-02.)</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/test_builder_entry_mode_wiring.py tests/test_start_run_brief_seed.py tests/test_builder_wiring.py tests/test_runs.py tests/test_control.py tests/test_researcher.py` all green.
- No downstream node (researcher → publisher) is edited — ENT-03's "reuse verbatim" preserved.
- verify_candidates.py is NOT edited (its advisory behavior is already correct — D-11).
</verification>

<success_criteria>
A brief run's graph path (calibrator → verify_candidates → researcher) exists, `_start_run` seeds it and queues the shorter node set while every existing caller stays byte-equivalent, and the Researcher consumes operator source material — with zero change to any downstream node or to verify_candidates.
</success_criteria>

<output>
After completion, create `.planning/phases/48-brief-entry-point/48-03-SUMMARY.md`
</output>
