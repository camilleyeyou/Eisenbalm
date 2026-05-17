---
phase: 05-agent-quality
plan: 13
subsystem: pipeline-agents
tags: [qa, editor-final, llm-as-judge, opus, voice-isolation, langgraph, pydantic, convex, regex-predicates]

# Dependency graph
requires:
  - phase: 05-agent-quality (Plan 05-01)
    provides: "Convex qaCorrections schema patched to severity∈{info|warning|error} + axis/quotedSpan/suggestedFix optional fields"
  - phase: 05-agent-quality (Plan 05-03)
    provides: "lib/openrouter_client.acomplete (kwargs-only) + lib/voice.VOICE_CONSTRAINTS"
  - phase: 05-agent-quality (Plan 05-08)
    provides: "agents/editor.py with real editor_gate_1 body — Plan 05-13 preserves it byte-for-byte and only replaces the editor_final stub"
  - phase: 05-agent-quality (Plan 05-10)
    provides: "Section writer state shapes (state['origin_story'], state['problem_statement'], etc.) the QA orchestrator extracts"
  - phase: 05-agent-quality (Plan 05-11)
    provides: "state['game'].description (GameContent) and state['bonus'].body (BonusContent) — QA reads both"
provides:
  - "Two-layer QA rubric (deterministic predicates + LLM-as-judge) for the eight Phase 5 section bodies"
  - "agents/qa/rules.py — 5 hard-rule predicates emitting QAFinding NamedTuples on 4 axes"
  - "agents/qa/rubric.md — version-controlled LLM-judge prompt with 5 evaluation axes"
  - "agents/qa/judge.py — single Opus call per run, returns Pydantic-validated findings"
  - "agents/qa/__init__.py — orchestrator combining both layers, writes one Convex row per finding"
  - "agents/editor.editor_final — Opus-driven advisory memo (100-300 words) for Andrew"
  - "AGT-17: model_versions['qa'] + model_versions['editor_final'] populated from resolved_model"
affects: ["06-publisher-pdf-webhook", "09-deliberation-ui", "05-14-real-mode-integration-test"]

# Tech tracking
tech-stack:
  added: []  # No new dependencies — judge uses lib/openrouter_client.acomplete; rules.py is stdlib re only
  patterns:
    - "Three defense layers for Jesse voice: lib/voice (preventative) → agents/qa/rules (deterministic backstop) → agents/qa/judge (LLM evaluative)"
    - "Layer-1 axis override to 'hard-rule' at orchestrator level — Andrew can distinguish Layer-1 from Layer-2 findings in qaCorrections without reading the raw axis literal"
    - "Section writers' state-field-to-section-id mapping: state['problem_statement'] → 'problem' (two-name convention from Plan 05-10)"
    - "QA annotation-only (D-02): orchestrator NEVER mutates section state, NEVER raises on findings — only writes state['qa_corrections']"
    - "agents/qa/ package layout mirrors agents/design/: __init__.py IS the orchestrator (exports the agent function), submodules carry implementation"

key-files:
  created:
    - "packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py — orchestrator (combines Layer 1 + Layer 2, writes Convex)"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py — 5 Layer-1 deterministic predicates + QAFinding NamedTuple"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py — Layer-2 LLM-as-judge with JudgeFinding/JudgeFindings Pydantic + _load_rubric"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md — version-controlled judge prompt (86 lines)"
  modified:
    - "packages/pipeline/src/eisenbalm_pipeline/agents/editor.py — replaced editor_final stub with real Opus impl; editor_gate_1 untouched"
    - "packages/pipeline/tests/agents/qa/test_rules.py — 14 tests covering all 5 predicates + aggregate behavior"
    - "packages/pipeline/tests/agents/qa/test_judge.py — 5 tests covering rubric load + Pydantic + single-call invariant"
    - "packages/pipeline/tests/agents/test_editor_final.py — 5 tests covering advisory prompt + emits-notes + never-blocks"
  deleted:
    - "packages/pipeline/src/eisenbalm_pipeline/agents/qa.py — Phase 4 4-line stub replaced by the agents/qa/ package"

key-decisions:
  - "agents/qa/ promoted from single-file qa.py stub → package (mirrors Plan 05-04 promotion of design.py → design/) so rules.py + judge.py + rubric.md can live alongside the orchestrator without a flat package; graph/builder.py import path `from eisenbalm_pipeline.agents.qa import qa` unchanged"
  - "Layer-1 axis override to 'hard-rule' at the orchestrator (not in rules.py) — predicates report their semantic axis (gravity / sentiment / etc.) but the orchestrator overwrites with 'hard-rule' so qaCorrections.axis encodes layer-of-origin for Studio/Andrew filtering"
  - "Editor Final response normalization handles three shapes: Pydantic instance (real mode), dict (stub mode legacy), and editorFinalNotes attribute on a model_construct'd Pydantic — defensive fallback returns notes='' rather than raising (D-04 spirit: Editor Final never blocks the draft)"

patterns-established:
  - "Two-layer QA architecture: deterministic floor + LLM judgment ceiling. Each finding carries the same QAFinding NamedTuple shape regardless of layer; orchestrator writes one Convex row per finding."
  - "AGT-17 modelVersions write pattern: `model_versions = dict(state.get('model_versions') or {}); model_versions[agent_id] = usage['resolved_model']` — identical to Plan 05-05 Calibrator, Plan 05-08 editor_gate1, Plan 05-12 design pattern."
  - "Editor Final = advisory only: every Editor Final prompt MUST contain 'Do NOT rewrite' + 'Do NOT reject' as substring guards (asserted in test_editor_final_prompt_is_advisory)."
  - "Section state-field-to-section-id mapping (canonical for QA + Editor Final): origin_story→origin_story, problem_statement→problem, founder_bio→founder_bio, case_study→case_study, game→game (uses .description not .body), bonus→bonus"

requirements-completed: [AGT-15, AGT-16, AGT-17]

# Metrics
duration: 10min
completed: 2026-05-17
---

# Phase 5 Plan 13: QA and Editor Final Summary

**Two-layer Jesse-voice QA (deterministic predicates + Opus LLM-as-judge) with annotation-only writes to Convex; advisory-memo Editor Final pass that never rewrites or rejects.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-17T18:57:57Z
- **Completed:** 2026-05-17T19:08:00Z
- **Tasks:** 5 executed (Task 6 satisfied cumulatively by Tasks 1, 3, 5 — see Decisions below)
- **Files created:** 4 (rules.py, judge.py, rubric.md, qa/__init__.py)
- **Files modified:** 4 (editor.py, test_rules.py, test_judge.py, test_editor_final.py)
- **Files deleted:** 1 (agents/qa.py stub)
- **Tests added:** 24 (14 rules + 5 judge + 5 editor_final), all passing
- **Suite-wide:** 115 passed / 23 skipped (env-gated integration tests)

## Accomplishments

- **Layer 1 hard-rule backstop**: 5 deterministic predicates over Jesse-voice forbidden constructs (exclamation marks, sentiment keywords from a 14-entry list, winking constructions, AI self-reference, unverified founder/subject names). Every hit emits a `QAFinding` with `severity='error'`.
- **Layer 2 LLM-as-judge**: single Opus call per run with the rubric.md prompt as the system message and all six section bodies concatenated as the user message. Returns Pydantic-validated `JudgeFindings { findings: list[JudgeFinding] }` mapping to the same `QAFinding` shape as Layer 1.
- **Version-controlled rubric prompt** at `agents/qa/rubric.md` — Andrew edits when voice drift surfaces.
- **Single-write orchestrator**: `agents/qa/__init__.py` runs both layers, writes one Convex `qaCorrections:insert` row per finding (post-05-01 schema fields), never mutates section state, never raises on findings.
- **Real Editor Final** (replaces Phase 4 fixtures stub): Opus call returns 100-300 word advisory memo for Andrew. System prompt contains explicit `Do NOT rewrite` + `Do NOT reject` guards.
- **AGT-17 observability**: `state['model_versions']['qa']` and `state['model_versions']['editor_final']` populated from `usage['resolved_model']` — observable for voice-drift forensics in `weeklyIssue.pipelineMetadata.modelVersions`.

## Task Commits

Each task was committed atomically (TDD: tests RED → impl GREEN folded into one commit per task):

1. **Task 1: agents/qa/rules.py + test_rules.py** — `4487c96` (feat)
2. **Task 2: agents/qa/rubric.md** — `f4c86f7` (chore)
3. **Task 3: agents/qa/judge.py + test_judge.py** — `d4a3937` (feat)
4. **Task 4: agents/qa/__init__.py orchestrator** — `72b14e0` (feat)
5. **Task 5: agents/editor.py editor_final + test_editor_final.py** — `8653a5c` (feat)
6. **Task 6: QA + Editor Final test files** — satisfied by Tasks 1, 3, 5 (no separate commit)

## Files Created/Modified

### Created
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py` (181 lines) — orchestrator combining Layer-1 + Layer-2; writes `qaCorrections:insert` per finding; records `model_versions['qa']`
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py` (236 lines) — 5 predicates + `QAFinding` NamedTuple + `run_all_predicates` aggregator
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py` (117 lines) — `JudgeFinding`/`JudgeFindings` Pydantic + `_load_rubric()` + `run_llm_judge()` single-call orchestrator
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md` (86 lines) — version-controlled LLM-judge prompt
- `packages/pipeline/tests/agents/qa/test_rules.py` (14 tests) — Layer-1 predicate coverage including AGT-10 unverified-name backstop
- `packages/pipeline/tests/agents/qa/test_judge.py` (5 tests) — Layer-2 single-call invariant + Pydantic shape
- `packages/pipeline/tests/agents/test_editor_final.py` (5 tests) — advisory prompt + emits-notes + never-blocks behavior

### Modified
- `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` — replaced Phase 4 `editor_final` stub (`return fixtures.editor_final_output()`) with real Opus implementation; dropped now-unused `from eisenbalm_pipeline.stubs import fixtures` import; `editor_gate_1` body unchanged from Plan 05-08

### Deleted
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa.py` — 4-line Phase 4 stub replaced by the `agents/qa/` package (graph/builder.py import path unchanged: `from eisenbalm_pipeline.agents.qa import qa`)

## Decisions Made

1. **`agents/qa.py` → `agents/qa/` package promotion.** The plan template said "REPLACE `agents/qa.py`" but the desired structure has `agents/qa/rules.py`, `agents/qa/judge.py`, `agents/qa/rubric.md` as siblings of the orchestrator. Python cannot have both `qa.py` and `qa/` resolve simultaneously. Resolution: delete `qa.py` (the stub being replaced), put the orchestrator at `agents/qa/__init__.py`. This mirrors Plan 05-04's promotion of `design.py` → `design/`. The import path consumers use (`from eisenbalm_pipeline.agents.qa import qa`) is unchanged.
2. **Layer-1 axis override to `'hard-rule'` at the orchestrator (not in rules.py).** Predicates report their semantic axis (`gravity`, `sentiment`, `irony-signaling`, `precision`). The orchestrator overwrites with `'hard-rule'` before writing to Convex so Andrew can filter qaCorrections by axis to see "what Layer-1 caught vs what Layer-2 caught" without reading internal layer markers. The reason/suggestedFix strings still surface the semantic axis to the reader. This keeps `agents/qa/rules.py` testable in isolation against the semantic axes.
3. **Section state-field-to-section-id mapping resolved by orchestrator.** State uses `state['problem_statement']` (Plan 05-10 SUMMARY two-name convention); QA's rubric.md `Input Format` uses `problem`. The orchestrator's `_extract_sections` maps the state field to the QA section ID. Game uses `.description` (not `.body`) because GameContent TypedDict has no body field.
4. **Editor Final defensive response normalization.** `acomplete` returns three possible shapes: Pydantic instance (real mode), dict (stub mode legacy), or `model_construct`'d empty Pydantic (when FakeOpenRouterClient is used). All three branches reach `notes = ""` as defensive fallback — the pipeline never blocks on a malformed Editor Final response. This honors D-04 ("QA never blocks") extended to Editor Final.
5. **Task 6 absorbed into Tasks 1, 3, 5.** The plan's Task 6 says "Implement QA + Editor Final test files" but specifies the same test files Tasks 1, 3, and 5 already required (test_rules.py, test_judge.py, test_editor_final.py). To keep TDD discipline (red → green per task), I wrote the full test bodies as part of the implementation tasks themselves rather than re-doing them in Task 6. All Task 6 acceptance criteria are satisfied: ≥13 tests pass (24 actual), `test_unverified_founder_name_caught` exists, `test_passing_text_yields_no_findings` exists, `test_editor_final_prompt_is_advisory` exists, `test_editor_final_emits_notes` exists.

## Deviations from Plan

### Rule 3 - Blocking issues auto-fixed

**1. [Rule 3 - Blocking] `agents/qa.py` and `agents/qa/` cannot coexist in Python.**
- **Found during:** Task 1 (creating `agents/qa/__init__.py`)
- **Issue:** Plan template says "REPLACE `agents/qa.py`" with the new orchestrator, but also says "CREATE `agents/qa/rules.py`, `agents/qa/judge.py`, `agents/qa/rubric.md`". Python's import system cannot have both a `qa.py` file and a `qa/` package directory at the same level — the package always wins, but VCS-tracking the orphaned `qa.py` is wrong.
- **Fix:** Deleted `agents/qa.py` and moved the orchestrator into `agents/qa/__init__.py`. This mirrors the precedent set by Plan 05-04's promotion of `agents/design.py` → `agents/design/`.
- **Verification:** `from eisenbalm_pipeline.agents.qa import qa` still works (test_judge.py uses it); `graph/builder.py` line 57 import unchanged.
- **Committed in:** `4487c96` (Task 1)

**2. [Rule 3 - Blocking] `acomplete` signature is kwargs-only.**
- **Found during:** Task 3 (judge.py implementation)
- **Issue:** Plan template line 519 shows positional-style call: `await acomplete("qa", messages, response_format=JudgeFindings)` but the actual `lib/openrouter_client.acomplete` signature is `def acomplete(*, agent_id, run_id, messages, response_format=None)`. This is the 7th plan in Phase 5 to hit this same template-vs-codebase mismatch (per STATE.md, Plans 05-05/06/07/08/09/11 all hit it).
- **Fix:** Used kwargs throughout: `acomplete(agent_id="qa", run_id=run_id, messages=messages, response_format=JudgeFindings)`. `run_id` parameter is required by acomplete for cost recording, so `run_llm_judge` accepts `run_id` as a kwarg-only parameter and the orchestrator passes `state['run_id']`.
- **Verification:** All 5 judge tests + all 5 editor_final tests pass; suite-wide 115/115 green.
- **Committed in:** `d4a3937` (Task 3) + `8653a5c` (Task 5)

**3. [Rule 1 - Bug] State field name is `problem_statement`, not `problem`.**
- **Found during:** Task 4 (`_extract_sections` implementation)
- **Issue:** Plan template's `_extract_sections` reads `state.get('problem')` but per Plan 05-10 SUMMARY and `graph/state.DispatchState`, the field is `problem_statement` (state field name) with agent_id `'problem'` (two-name convention).
- **Fix:** Orchestrator maps `state['problem_statement']` → QA section ID `'problem'`. Same mapping in `_build_editor_final_messages`.
- **Verification:** `_extract_sections` test passes; section IDs match rubric.md `Input Format`.
- **Committed in:** `72b14e0` (Task 4) and `8653a5c` (Task 5)

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All three were plan-vs-codebase mismatches in template text, not architectural changes. The actual behavior, schema, and contracts all match the plan's intent.

## Issues Encountered

None unique to this plan — all three deviations were known systemic issues already documented in STATE.md (acomplete kwargs-only signature mismatch in Phase 5 plan templates).

## Self-Check: PASSED

**Files verified to exist:**
- FOUND: packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py
- FOUND: packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py
- FOUND: packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py
- FOUND: packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md
- FOUND: packages/pipeline/src/eisenbalm_pipeline/agents/editor.py (editor_final body replaced)
- FOUND: packages/pipeline/tests/agents/qa/test_rules.py (14 tests)
- FOUND: packages/pipeline/tests/agents/qa/test_judge.py (5 tests)
- FOUND: packages/pipeline/tests/agents/test_editor_final.py (5 tests)

**Files verified to be deleted:**
- DELETED: packages/pipeline/src/eisenbalm_pipeline/agents/qa.py (Phase 4 stub)

**Commits verified to exist:**
- FOUND: 4487c96 — Task 1 QA Layer-1 rules
- FOUND: f4c86f7 — Task 2 rubric.md
- FOUND: d4a3937 — Task 3 judge.py
- FOUND: 72b14e0 — Task 4 orchestrator
- FOUND: 8653a5c — Task 5 editor_final

**Tests verified to pass:**
- 24/24 plan-specific tests pass (tests/agents/qa/ + tests/agents/test_editor_final.py)
- 115/115 suite-wide tests pass (24 env-gated skips)

## Next Phase Readiness

**Plan 05-14 (real-mode integration test) is unblocked.** All Phase 5 agent bodies are now real LLM-driven (Calibrator, Scout, Advocate, Editor[gate1], Researcher, OriginStory, Problem, FounderBio, CaseStudy, Bonus, Game, Design, QA, Editor[final]). Plan 05-14 can flip `EISENBALM_STUB_MODE=false` and run a single end-to-end pipeline against a tiny token budget to prove the AGT-* criteria mechanically.

**Plan 05-15 (Andrew smoke + docs)** depends on Plan 05-14. The QA rubric.md is the artifact Andrew will iterate on in Plan 05-15 if real-mode runs surface voice drift.

**Phase 6 (Publisher PDF + Sanity webhook)** is unblocked from a Phase 5 dependency standpoint: `state['editor_final_notes']` is now populated by Editor Final on every run, and the Publisher's eventual Sanity write surface includes that field. No contract changes required.

---
*Phase: 05-agent-quality*
*Completed: 2026-05-17*
