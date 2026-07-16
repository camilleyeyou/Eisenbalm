---
phase: 47-story-brief-stage
plan: 02
type: execute
wave: 2
depends_on: ["47-01"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/graph/state.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py
  - packages/pipeline/tests/agents/test_editor.py
autonomous: true
requirements: [BRF-05]
must_haves:
  truths:
    - "DispatchState carries a Brief TypedDict (six fields) that survives the Postgres checkpoint"
    - "editor_gate_1 deterministically assembles the six-field Brief immediately after winning_charity resolves — on BOTH the auto-select and the human-resume paths — with zero new graph nodes and zero new LLM calls"
    - "The generated Brief is persisted to Convex via briefs:insert (upsert-safe) and returned in state['brief'] so the writers see it with no wait"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/graph/state.py"
      provides: "Brief TypedDict + brief: Optional[Brief] DispatchState field per API_CONTRACTS §7"
      contains: "class Brief(TypedDict)"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/editor.py"
      provides: "deterministic Brief assembly + briefs:insert in editor_gate_1"
      contains: "briefs:insert"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/agents/editor.py"
      to: "briefs:insert (Convex)"
      via: "convex_mutation_safe after winner resolves"
      pattern: "briefs:insert"
    - from: "editor_gate_1 return value"
      to: "DispatchState['brief']"
      via: "return {**state, ..., 'brief': brief}"
      pattern: "\"brief\""
---

<objective>
Add the `Brief` TypedDict + `brief` field to `DispatchState`, then generate the Brief deterministically inside `editor_gate_1` — immediately after `winning_charity` resolves — using data already in scope (the matched `StoryLead`, the `VerificationRecord`, `decision.editorReasoning`, `style_brief`). Persist it to the `briefs` Convex table and return it in `state['brief']`. No new graph node, no new LLM call (RESEARCH Pattern 4, honoring D-11's "prefer minimal machinery").

Purpose: The pipeline graph has ZERO pause points between Gate 1 and Publisher (`builder.py:152-172`) — once Gate 1 resolves, `chronicler→researcher→7 writers→…→publisher` runs autonomously in one `ainvoke()`. So the Brief must exist the instant the winner is chosen, on both the auto-select and the human-resume paths, or the writers never see it. This plan makes state['brief'] real; plan 47-03 threads it into the writer prompts.
Output: `Brief` in state.py; deterministic assembly + `briefs:insert` in editor_gate_1; updated test_editor.py.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/47-story-brief-stage/47-CONTEXT.md
@.planning/phases/47-story-brief-stage/47-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
Brief shape (must match API_CONTRACTS §7 landed in 47-01):
```python
class Brief(TypedDict):
    premise: str
    currentPeg: str
    centralClaim: str
    readerEffect: str
    knownRisks: str
    voiceIntention: str
# DispatchState gains: brief: Optional[Brief]
```

Deterministic field mapping (RESEARCH Pattern 4 — re-projections of data already computed; illustrative, executor finalizes exact fallbacks):
```python
premise       <- matched_lead["premise"]      (fallback: winning_charity["scoutSummary"])
currentPeg    <- matched_lead["datedPeg"]      (+ pegSourceUrl where present)
centralClaim  <- decision.editorReasoning       (already computed this call)
readerEffect  <- matched_lead["readerEnergy"]
knownRisks    <- brandRiskReason + repetitionWarning + verification killReasons/notes, joined
voiceIntention<- style_brief.get("visualDirection", "")  (or style_brief["voice"])
```

editor_gate_1 winner-resolution sites (agents/editor.py):
- auto-select return block (~L227-238 / the non-interrupt path building winning_charity ~L310-335)
- resume/selection return block (~L461-491 — `winning_charity = next(...)`, then pitchLog:markSelected, then `return {**state, "winning_charity": ..., "editor_decision": decision.editorReasoning, ...}`)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add Brief TypedDict + brief field to DispatchState</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/graph/state.py</files>
  <read_first>
    packages/pipeline/src/eisenbalm_pipeline/graph/state.py (the `StyleBrief`/`StoryLead` TypedDicts + the `DispatchState` TypedDict; the §46 `story_leads: Optional[list[StoryLead]]` checkpoint-safe field is the precedent to mirror). docs/API_CONTRACTS.md §7 (the exact Brief shape landed in 47-01).
  </read_first>
  <behavior>
    - test_editor.py (or test_state) asserts `Brief` is importable from `graph.state` with the six string fields.
    - `DispatchState` has an optional `brief` field typed `Optional[Brief]`.
  </behavior>
  <action>
    Add `class Brief(TypedDict)` with the six fields (premise, currentPeg, centralClaim, readerEffect, knownRisks, voiceIntention — all `str`) adjacent to `StyleBrief`. Add `brief: Optional[Brief]` to `DispatchState` in a `# ── Phase 47: editable Brief ──` comment block, documented as JSON-serializable/checkpoint-safe (mirror the `story_leads` field's comment).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.graph.state import Brief, DispatchState; assert set(Brief.__annotations__) == {'premise','currentPeg','centralClaim','readerEffect','knownRisks','voiceIntention'}; assert 'brief' in DispatchState.__annotations__; print('OK')"</automated>
  </verify>
  <acceptance_criteria>
    - `graph/state.py` contains `class Brief(TypedDict)` with exactly the six named fields
    - `DispatchState.__annotations__` contains `brief`
    - The one-liner import check above prints `OK`
  </acceptance_criteria>
  <done>DispatchState carries a typed, checkpoint-safe Brief field.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Deterministically assemble + persist the Brief in editor_gate_1</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/editor.py, packages/pipeline/tests/agents/test_editor.py</files>
  <read_first>
    packages/pipeline/src/eisenbalm_pipeline/agents/editor.py (BOTH winner-resolution return paths cited in the interfaces block — auto-select and resume; the existing `pitchLog:markSelected` convex call at ~L469-472 is the persistence idiom to mirror). packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (`convex_mutation_safe`/`convex_mutation` — non-blocking, never-crash idiom; `briefs:insert` guarded path was registered in 47-01). packages/pipeline/src/eisenbalm_pipeline/graph/state.py (StoryLead/VerificationRecord field names to read). 47-RESEARCH.md §"Pattern 4" (the assembly + why zero-node/zero-LLM) and §"Open Question 1/2" (upsert-safety on re-run; idempotent insert).
  </read_first>
  <behavior>
    - After a winner resolves on the AUTO-SELECT path, state['brief'] is a six-field dict populated from the matched lead / verification / editorReasoning / style_brief.
    - After a winner resolves on the RESUME path (human adjudication), the same assembly runs and state['brief'] is populated identically.
    - `briefs:insert` is called with `{runId, ...brief}` (upsert-safe; safe to re-run after a restart).
    - Missing lead/verification degrades to the documented fallbacks (never raises).
  </behavior>
  <action>
    Add a private helper (e.g. `_assemble_brief(state, winning_charity, decision) -> Brief`) that: matches the winning charity to its `StoryLead` (match on charity/lead category or the recommended lead — one-active-lead-per-run per RESEARCH Pitfall 1; NO invented join key) and to its `VerificationRecord` (match on `candidateId == f"charity-{slugify(name)}"`, the confirmed join format); builds the six fields per the interfaces mapping; joins `knownRisks` from `brandRiskReason` + `repetitionWarning` + any verification `killReason`/obscurity note. Call it from BOTH winner-resolution return paths, insert via `convex_mutation_safe("briefs:insert", {"runId": run_id, **brief})` (non-blocking, degrades to "" fields on any failure), and add `"brief": brief` to each `return {**state, ...}`. Do NOT add a graph node, an `interrupt()`, or an LLM call.
    Update `tests/agents/test_editor.py`: assert the Brief is populated with all six keys on both paths and that `briefs:insert` is invoked (mock the convex client, mirroring the existing markSelected assertions).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/agents/test_editor.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `agents/editor.py` contains a `_assemble_brief` helper and calls `briefs:insert` (grep `briefs:insert` in editor.py)
    - Both winner-resolution return blocks include `"brief":`
    - `grep -c "interrupt(" agents/editor.py` is unchanged from before this task (no new interrupt; still exactly the Gate-1 pause) and no `acomplete`/LLM call is added in `_assemble_brief`
    - `pytest tests/agents/test_editor.py` asserts six-field Brief on the auto-select AND resume paths and that briefs:insert was called; suite green
  </acceptance_criteria>
  <done>editor_gate_1 emits a persisted, in-state six-field Brief the instant a winner resolves, on both paths, with no new pipeline machinery.</done>
</task>

</tasks>

<verification>
- `pytest tests/agents/test_editor.py` green; Brief present on both resolution paths.
- No new graph node / interrupt / LLM call introduced (grep confirms).
</verification>

<success_criteria>
state['brief'] is a real, persisted six-field artifact produced deterministically at Gate-1 resolution — ready for the writers (47-03) and the console (47-05/06/07) to consume.
</success_criteria>

<output>
After completion, create `.planning/phases/47-story-brief-stage/47-02-SUMMARY.md`.
</output>
