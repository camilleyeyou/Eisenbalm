---
phase: 05-agent-quality
plan: 08
subsystem: pipeline
tags: [editor, gate-1, opus, interrupt, idempotency, deliberation-transcript, markdown, agt-06, agt-17, jesse-voice, notebooklm]

# Dependency graph
requires:
  - phase: 04-pipeline-skeleton
    provides: "@agent_node decorator (GraphInterrupt re-raise path), Phase 4 D-13 idempotency-before-interrupt ordering, editor_gate_1 stub function name (keep — graph/builder.py imports it), editor_final stub body (Plan 05-13 owns), pitchLog:markSelected pattern (post-interrupt write)"
  - phase: 05-agent-quality
    provides: "lib/voice.py VOICE_CONSTRAINTS, lib/openrouter_client.acomplete (kwargs-only with agent_id='editor_gate1'), lib/llm_config MODEL_BY_AGENT['editor_gate1']=Opus pin, lib/llm_config SAMPLING_BY_AGENT['editor_gate1']={temperature:0.2,top_p:1.0}, Plan 05-04 Editor gate-1 test skeleton (2 skip-marked tests replaced), Plan 05-07 Advocate output (state['candidates'] with advocateScore+advocateArgument fields per CharityCandidate TypedDict)"
provides:
  - "Real Opus-driven Editor gate-1 body — replaces Phase 4 stub (gate-1 only; editor_final stub preserved)"
  - "EditorDecision Pydantic model (winnerName, confidence, requiresHumanInput, editorReasoning, runnerUpNotes, deliberationTranscript)"
  - "EDITOR_INTERRUPT_THRESHOLD=1.0 + EDITOR_CONFIDENCE_THRESHOLD=0.7 — single source of truth for D-18 interrupt rule"
  - "Deterministic ranking helpers: _sort_candidates_by_score (score desc, name asc tie-break), _score_gap (top-two diff with single-candidate inf fallback)"
  - "Markdown deliberationTranscript formatter (_format_deliberation_transcript) — NotebookLM-friendly per RESEARCH §Editor Gate 1 lines 484-504; required for V2-02 manual podcast export"
  - "Phase 4 D-13 enforced: pipelineRuns:updateStatus 'awaiting-review' write lands BEFORE interrupt() call"
  - "Resume protocol supports three shapes: {editorSelection}, {winnerName}, raw string"
  - "AGT-17 modelVersions['editor_gate1'] capture inherited from Plan 05-05 Calibrator pattern"
affects: [05-13-qa-and-editor-final, 05-14-real-mode-integration-test, 05-15-andrew-smoke-and-docs]

# Tech tracking
tech-stack:
  added: []  # no new pip deps; reuses Plan 05-03 lib scaffolding
  patterns:
    - "Deterministic winner override (D-18): LLM-supplied winnerName is read for diagnostic purposes only; Python overrides with sorted_candidates[0]['name']. LLM confidence + requiresHumanInput drive the interrupt rule, but winner identity is purely deterministic from advocateScore."
    - "Idempotency-before-interrupt (Phase 4 D-13): pipelineRuns:updateStatus is the ONLY write that lands BEFORE interrupt(); it's an upsert on runId so re-running the node from the top on resume is safe. pitchLog:markSelected and the deliberationEvents emit happen AFTER interrupt() resolves (success path only)."
    - "Test-stub interrupt(): unit tests patch eisenbalm_pipeline.agents.editor.interrupt to raise GraphInterrupt directly, bypassing LangGraph's runnable-context requirement. The wrapper's GraphInterrupt re-raise path is what's actually exercised; real interrupt() works in production via the CompiledStateGraph context provided by graph/builder.py."
    - "Stub-mode defensive defaults: when acomplete returns model_construct() (Pydantic without validation), the editor body falls through to a permissive decision so the deterministic top-score path still runs in EISENBALM_STUB_MODE=true."
    - "Resume value shape tolerance: editor body accepts {editorSelection: ...} (Phase 4 PIP-10 contract test_editor_gate_1_resume.py), {winnerName: ...} (Plan 05-08 plan contract), and raw string (defensive). All three override winner_name with the human-supplied value."

key-files:
  created:
    - .planning/phases/05-agent-quality/05-08-editor-gate1-SUMMARY.md
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py
    - packages/pipeline/tests/agents/test_editor.py

key-decisions:
  - "Function name preserved as editor_gate_1 (with underscore) — graph/builder.py:51 imports this exact name. Plan called the function 'editor_gate1' (no underscore); kept codebase convention to avoid rippling rename through the builder + Plan 04 PIP-04 stub-fixture test."
  - "agent_id for acomplete + llm_config is 'editor_gate1' (no underscore) — matches MODEL_BY_AGENT and SAMPLING_BY_AGENT keys in lib/llm_config.py (already locked by Plan 05-03). Two naming conventions coexist: function = editor_gate_1, llm_config key = editor_gate1. Deliberation event agentId stays 'editor' (Phase 4 @agent_node name='editor' — matches Sanity agentProfile.agentId)."
  - "Data source is state['candidates'] (not state['advocate_votes']). The plan referenced 'state['advocate_votes']' but the locked DispatchState contract (API_CONTRACTS §7, CharityCandidate TypedDict) embeds advocateScore + advocateArgument inline on each candidate. Editor reads from candidates directly; no separate votes list synthesis needed."
  - "_format_deliberation_transcript accepts one candidates list (with scores already embedded) rather than the plan's split (candidates + votes). Simpler interface; matches the real shape of post-Advocate state."
  - "editor_final body untouched — explicit Plan 05-13 boundary. The function still returns fixtures.editor_final_output() and still has @agent_node(name='editor', emit_event='editor-final', payload_builder=_editor_final_payload) decoration verbatim from Phase 4."
  - "Post-interrupt status='running' write preserved from Phase 4 stub — ensures the run shows 'running' between resume and pipeline completion. Matches test_editor_gate_1_resume.py PIP-10 contract."

patterns-established:
  - "Voice-critical agent template (post-Calibrator): @agent_node(name=<sanity-agent-id>, emit_event=<deliberation-eventType>) + Pydantic response_format + acomplete(agent_id=<llm_config-key>, run_id=...) + model_versions dict update. Plan 05-13 (QA, editor_final) follows verbatim."
  - "Interrupt rule encoding: factor the conditions into three module-level constants/booleans (EDITOR_INTERRUPT_THRESHOLD, EDITOR_CONFIDENCE_THRESHOLD, score_gap helper) so the AND-chain is one readable expression. Future interrupt-using agents (none in Phase 5 outside Editor) inherit this pattern."
  - "deliberationTranscript Markdown contract: section headers (# / ## Scout Findings / ## Advocate Arguments / ## Editor Reasoning / ## Decision) are LOAD-BEARING. Test asserts each header as a substring. V2-02 NotebookLM workflow depends on this format byte-for-byte."

requirements-completed: [AGT-06, AGT-17]

# Metrics
duration: 7min
completed: 2026-05-17
---

# Phase 5 Plan 08: Editor Gate-1 Summary

**Real Opus-driven Editor gate-1: deterministic top-score winner selection, narrow-gap interrupt rule (D-18), Phase 4 D-13 idempotency-before-interrupt ordering, and Markdown deliberationTranscript per RESEARCH §Editor Gate 1 (NotebookLM-friendly for V2-02 manual podcast export).**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-17T18:15:59Z
- **Completed:** 2026-05-17T18:23:00Z
- **Tasks:** 2 (TDD: 1 RED commit + 1 GREEN commit combining feat + test bodies)
- **Files modified:** 2

## Accomplishments

- Replaced Phase 4 Editor `editor_gate_1` stub body with a real Opus-driven implementation while preserving the `editor_final` stub (Plan 05-13 boundary respected verbatim).
- Landed the **deterministic top-score winner override** (D-18): the LLM's `winnerName` is read for diagnostic purposes only; Python overrides with the highest `advocateScore` candidate. Tie-break is alphabetical by `name`.
- Encoded the **three-condition interrupt rule** as a single readable AND expression: `score_gap < EDITOR_INTERRUPT_THRESHOLD AND confidence < EDITOR_CONFIDENCE_THRESHOLD AND requiresHumanInput`. All three must hold.
- Enforced **Phase 4 D-13 ordering**: `pipelineRuns:updateStatus` with `status='awaiting-review'` is written to Convex BEFORE `interrupt()` is called. Verified by line-number ordering (line 321 vs 330) and by `test_interrupt_threshold_triggers` mock-call inspection.
- Shipped the **Markdown deliberationTranscript** template (`_format_deliberation_transcript`) with all four required section headers (`## Scout Findings`, `## Advocate Arguments`, `## Editor Reasoning`, `## Decision`). Format is load-bearing for V2-02 NotebookLM ingestion.
- Inherited **AGT-17 modelVersions capture** pattern verbatim from Plan 05-05 Calibrator: `model_versions['editor_gate1'] = usage['resolved_model']`.
- Tolerant **resume protocol**: accepts `{editorSelection: ...}` (Phase 4 PIP-10 contract), `{winnerName: ...}` (Plan 05-08 plan contract), and raw string. Whichever is supplied overrides the deterministic winner on resume.
- 9 new tests landed and pass (full pipeline suite: 42 passed / 42 skipped / 0 failed).

## Task Commits

1. **RED — Failing tests** — `7d31296` (`test(05-08): add failing tests for editor gate-1 winner selection + interrupt threshold`)
2. **GREEN — Real implementation + test wiring** — `ee63c18` (`feat(05-08): real Opus-driven Editor gate-1 (winner selection + interrupt)`)

_TDD pattern: RED commit (failing imports — `EDITOR_CONFIDENCE_THRESHOLD` not exported) → GREEN commit (real implementation lands + test mock for `interrupt()` symbol added). REFACTOR pass skipped — implementation matches spec on first GREEN._

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` — replaced `editor_gate_1` stub body. New module-level symbols: `EDITOR_INTERRUPT_THRESHOLD`, `EDITOR_CONFIDENCE_THRESHOLD`, `EditorDecision` (Pydantic), `_sort_candidates_by_score`, `_score_gap`, `_format_deliberation_transcript`, `_build_messages`. Preserved untouched: `_editor_decision_payload`, `_editor_final_payload`, `editor_final` (Plan 05-13 owns).
- `packages/pipeline/tests/agents/test_editor.py` — replaced Plan 05-04 skip-skeletons with 9 real assertions: 5 pure-helper tests + 4 async gate-1 behavior tests.
- `.planning/phases/05-agent-quality/05-08-editor-gate1-SUMMARY.md` — this file.

## Decisions Made

1. **Function name `editor_gate_1` preserved (codebase convention).** Plan called the function `editor_gate1` (no underscore) but `graph/builder.py:51` imports `editor_gate_1` (with underscore) and Phase 4 stub-fixture test `test_stub_fixtures.py` refers to `editor_gate_1`. Renaming would have rippled through the builder, two tests, and the Phase 4 PIP-10 resume contract. Kept codebase name. The two naming conventions coexist:
   - **Function name** (Python import path): `editor_gate_1`
   - **llm_config key** (acomplete agent_id): `editor_gate1`
   - **Sanity agentProfile.agentId** (`@agent_node(name=...)`): `editor`

2. **Data source is `state['candidates']` (locked DispatchState contract).** The plan referenced `state['advocate_votes']`, but the canonical `CharityCandidate` TypedDict in `graph/state.py` embeds `advocateScore` + `advocateArgument` inline on each candidate (populated by Plan 05-07 Advocate). No separate votes list exists or should be synthesized.

3. **`_format_deliberation_transcript` simplified signature.** Plan called for separate `candidates` + `votes` arguments to the transcript formatter; implementation accepts a single `candidates` list (with scores already embedded). One argument; matches real post-Advocate state shape.

4. **Resume value override accepts three shapes.** The Phase 4 PIP-10 contract (`test_editor_gate_1_resume.py:88`) sends `{"selection": {"charityName": ...}}` which gets unwrapped by the FastAPI handler to `{"editorSelection": "name"}`. The Plan 05-08 plan specifies `{"winnerName": ...}`. Implementation accepts both, plus raw string. The first non-empty match wins.

5. **Test mocks `langgraph.types.interrupt` symbol directly.** Real `interrupt()` requires a LangGraph runnable context (a contextvar set inside `CompiledStateGraph` invocation). In unit tests, no graph is running, so calling `interrupt()` raises `RuntimeError: Called get_config outside of a runnable context`. Tests patch `eisenbalm_pipeline.agents.editor.interrupt` to raise `GraphInterrupt(())` directly — this exercises the `@agent_node` wrapper's `GraphInterrupt` re-raise path (which is what we care about). Real interrupt() works in production via the CompiledStateGraph context from `graph/builder.py`.

6. **Status='running' write preserved from Phase 4 stub.** After resume, the editor body writes `pipelineRuns:updateStatus status='running'` to flip the run back from `awaiting-review`. Matches `test_editor_gate_1_resume.py` PIP-10 contract.

7. **`editor_final` body untouched.** Explicit Plan 05-13 boundary. The function still returns `fixtures.editor_final_output()` and still has its Phase 4 `@agent_node(name='editor', emit_event='editor-final', payload_builder=_editor_final_payload)` decoration verbatim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `acomplete()` signature mismatch (positional vs kwargs-only)**
- **Found during:** Task 1 implementation
- **Issue:** Plan's example code called `acomplete("editor_gate1", messages, response_format=EditorDecision)` with positional args. Actual `lib/openrouter_client.acomplete` signature (Plan 05-03, locked) is kwargs-only with required `run_id`. Plan-as-written would raise `TypeError`.
- **Fix:** Used real signature `acomplete(agent_id="editor_gate1", run_id=run_id, messages=messages, response_format=EditorDecision)`. Same correction Plan 05-05 made.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py`
- **Verification:** 9/9 tests pass.
- **Committed in:** `ee63c18`

**2. [Rule 3 — Blocking] Plan's data source `state['advocate_votes']` does not exist**
- **Found during:** Task 1 implementation
- **Issue:** Plan referenced `state['advocate_votes']` (a separate scored-votes list). The locked `DispatchState` contract (API_CONTRACTS §7 + `CharityCandidate` TypedDict in `graph/state.py`) does NOT have an `advocate_votes` field. Advocate (Plan 05-07) writes `advocateScore` + `advocateArgument` directly onto each candidate in `state['candidates']`. Reading from a nonexistent field would have left the editor with no scores.
- **Fix:** Edited the implementation to read from `state['candidates']` directly. Renamed helpers `_sort_votes_by_score` → `_sort_candidates_by_score` and `_score_gap` to operate on candidate dicts (using `advocateScore` key). `_format_deliberation_transcript` simplified to one candidates argument with scores embedded.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` + `packages/pipeline/tests/agents/test_editor.py`
- **Verification:** 9/9 tests pass; data flows correctly from Advocate output → Editor input.
- **Committed in:** `ee63c18`

**3. [Rule 3 — Blocking] Plan's function name `editor_gate1` would have broken `graph/builder.py` import**
- **Found during:** Task 1 implementation
- **Issue:** Plan called the function `editor_gate1` (no underscore). `graph/builder.py:51` imports `from eisenbalm_pipeline.agents.editor import editor_final, editor_gate_1` (with underscore). Plan-as-written would have broken the graph wiring.
- **Fix:** Kept Phase 4 function name `editor_gate_1`. The llm_config lookup key remains `editor_gate1` (no underscore) per Plan 05-03's locked `MODEL_BY_AGENT` table. The two coexist — function name is Python import path; llm_config key is the agent_id passed to `acomplete`.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` + `packages/pipeline/tests/agents/test_editor.py`
- **Verification:** `graph/builder.py` imports still resolve; `tests/agents/test_stub_fixtures.py::test_stub_fixture_returns_valid_dispatch_state_shape[editor_gate_1]` still passes (no regression).
- **Committed in:** `ee63c18`

**4. [Rule 3 — Blocking] LangGraph `interrupt()` outside runnable context raises `RuntimeError`, not `GraphInterrupt`**
- **Found during:** First GREEN test run
- **Issue:** First test run showed `test_interrupt_threshold_triggers` raising `RuntimeError: Called get_config outside of a runnable context` from `langgraph/types.py:804`. The wrapper's `GraphInterrupt` re-raise path was never hit. Without a real CompiledStateGraph context, `interrupt()` can't read its configurable state.
- **Fix:** Patched `eisenbalm_pipeline.agents.editor.interrupt` in the test to raise `GraphInterrupt(())` directly. This bypasses LangGraph's context requirement while still exercising the wrapper's `GraphInterrupt` handler (which is what the test is verifying). Documented the stub function (`_interrupt_raises_graph_interrupt`) inline in the test file with a clear docstring explaining why the patch is necessary.
- **Files modified:** `packages/pipeline/tests/agents/test_editor.py`
- **Verification:** 9/9 tests pass.
- **Committed in:** `ee63c18`

**5. [Rule 3 — Blocking] `GraphInterrupt.__init__()` signature is `(interrupts=())`, not `(value=...)`**
- **Found during:** Second test run after Fix 4
- **Issue:** Initial `_interrupt_raises_graph_interrupt` stub called `GraphInterrupt(value={"reason": "test-stub"})` which raised `TypeError: GraphInterrupt.__init__() got an unexpected keyword argument 'value'`. The real LangGraph 1.x signature is `GraphInterrupt(interrupts: Sequence[Interrupt] = ())`.
- **Fix:** Changed to `GraphInterrupt(())` (empty sequence). The unit test only cares that GraphInterrupt is raised; the payload contents are not asserted on.
- **Files modified:** `packages/pipeline/tests/agents/test_editor.py`
- **Verification:** 9/9 tests pass.
- **Committed in:** `ee63c18`

---

**Total deviations:** 5 auto-fixed (all Rule 3 blocking; all are plan-vs-actual-codebase mismatches that the planner did not catch). No scope creep; no architectural change. Pattern matches Plan 05-05 deviations 1 + 2.

## Issues Encountered

- **Multiple plan-text references to symbols/conventions not actually in the codebase.** Five separate Rule 3 deviations all stemmed from the plan being written against an idealized contract rather than the actual locked code. None blocked progress — each was fixed in <2 minutes — but a future plan author should grep the codebase for every symbol referenced in `<action>` before publishing.

- **`graph/state.py` has no `advocate_votes` field, but the plan's "must_haves.key_links" frontmatter explicitly named `state['advocate_votes']` as the data source.** This is the most consequential of the five deviations — it would have left the editor reading from an empty list and silently picking the wrong winner. Caught at implementation time (Rule 3 + a quick grep of `graph/state.py`).

## User Setup Required

None — no external service configuration required. Real OpenRouter calls require `OPENROUTER_API_KEY` (already documented in Plan 05-03 `.env.example`); Plan 05-08 tests run entirely in stub mode (`EISENBALM_STUB_MODE=true`), no Sanity or Convex round-trip.

## Next Phase Readiness

- **Plan 05-09 (Researcher + verify_research):** Inherits AGT-17 modelVersions write pattern from Calibrator + Editor verbatim. Researcher's voice tier is Sonnet (not Opus) per D-05, but the `model_versions[agent_id] = usage['resolved_model']` idiom is identical.
- **Plan 05-13 (QA + Editor Final):** `editor_final` body still has Phase 4 stub — Plan 05-13 replaces. QA is voice-critical (Opus pinned) and follows the same `acomplete` + `EditorDecision`-style Pydantic response_format pattern. The deliberation_transcript Markdown format established by Plan 05-08 is consumed by QA's holistic pass over all section bodies.
- **Plan 05-14 (Real-mode integration test):** Editor gate-1 is now ready for `EISENBALM_STUB_MODE=false` execution. The deterministic-top-score-winner rule means real runs do NOT trigger interrupt() unless the Advocate genuinely produces scores within 1.0 of each other AND the LLM emits confidence < 0.7 AND requiresHumanInput=true. With Plan 05-07 Advocate's wide-spread scoring (9 for winner, 6 for runners-up), real runs proceed straight through.
- **Plan 04 PIP-10 (test_editor_gate_1_resume.py):** Still passes — the resume value shape `{editorSelection: "..."}` is still recognized by the editor body. No regression.

## Known Stubs

- `editor_final` (in `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py`, line ~419): still returns `fixtures.editor_final_output()`. **Intentional** — Plan 05-13 owns the replacement. This is a Plan 05-08 boundary, not an unfinished item.

## Self-Check: PASSED

- File `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py`: FOUND.
- File `packages/pipeline/tests/agents/test_editor.py`: FOUND.
- Commit `7d31296` (test RED): FOUND in `git log --oneline`.
- Commit `ee63c18` (feat GREEN): FOUND in `git log --oneline`.
- All 9 editor tests pass; full pipeline suite: 42 passed / 42 skipped / 0 failed.
- Plan verification commands:
  - `grep -c 'awaiting-review' src/eisenbalm_pipeline/agents/editor.py` → 3 (≥ 1) ✓
  - `grep -c 'EDITOR_INTERRUPT_THRESHOLD' src/eisenbalm_pipeline/agents/editor.py` → 4 (≥ 2) ✓
  - `grep -c '## Scout Findings' src/eisenbalm_pipeline/agents/editor.py` → 2 (≥ 1) ✓
  - Line-number ordering: `pipelineRuns:updateStatus` (line 321) precedes `interrupt(` (line 330) ✓

---
*Phase: 05-agent-quality*
*Completed: 2026-05-17*
