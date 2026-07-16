---
phase: 48-brief-entry-point
plan: 03
subsystem: api
tags: [langgraph, dispatchstate, fastapi, brief-entry, convex, prompt-engineering]

# Dependency graph
requires:
  - phase: 48-brief-entry-point
    provides: "Plan 48-01's frozen contracts (§48.1-§48.5, entry_mode/source_material DispatchState fields, runs.entryMode Convex field) + Plan 48-02's Wave-0 red scaffolds (test_builder_entry_mode_wiring.py, test_start_run_brief_seed.py) this plan turns green"
provides:
  - "The graph fork: route_by_entry_mode router + two add_conditional_edges calls (calibrator->{signal_editor|verify_candidates}, verify_candidates->{advocate|researcher}) — one compiled graph with two valid execution paths"
  - "_start_run extended with entry_mode/winning_charity/brief/source_material/agent_keys_override, byte-equivalent for every existing caller, plus the briefs:insert write (Step 4b)"
  - "Researcher prompt threading of operator-supplied source_material (D-10), with the Prompt Lab VariableRegistry and Phase 24 byte-equivalence oracle kept in sync"
affects: [48-04-brief-trigger-endpoint, 48-05-create-panel-brief-path, 48-06-stage1-brief-mode-render, 48-07-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single router function reused at two add_conditional_edges call sites (route_by_entry_mode), rather than a no-op conditional edge at START — corrects CONTEXT D-01's literal wording per RESEARCH.md's finding that both chains begin identically at calibrator (D-02)"
    - "Additive-defaulted launcher extension: 5 new _start_run kwargs, all defaulted to reproduce today's exact discovery-mode behavior, so no existing caller needed a single-line change"
    - "Mirror-the-corrections-block pattern reused for source_material: same _build_*_block(...) -> '' when falsy shape as MEM-03's corrections threading, so a discovery run's prompt is byte-equivalent"

key-files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py
    - packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md
    - packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py
    - packages/pipeline/tests/test_builder_wiring.py
    - packages/pipeline/tests/test_prompt_version_seeds.py
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VariableRegistry.ts

key-decisions:
  - "initial_state['entry_mode'] is ALWAYS set explicitly (both 'discovery' and 'brief'), not omitted for discovery — the plan's literal task-3 prose said 'do NOT set entry_mode for discovery,' but RESEARCH.md's own Pattern 2 code example and the frozen Wave-0 test (test_discovery_mode_still_seeds_entry_mode_explicitly) both require it set explicitly. The frozen test scaffold is authoritative per this plan's critical_correctness_rules; implemented to match it."
  - "The two Phase 46 test_builder_wiring.py assertions that literally matched the now-removed static calibrator->signal_editor / verify_candidates->advocate edges were updated to assert the new conditional-edge form instead — a direct, foreseen consequence of the D-01 fork (RESEARCH.md explicitly documents these edges as REPLACED), not a scope-creep test rewrite."
  - "test_prompt_version_seeds.py's researcher_user byte-equivalence oracle needed a matching .replace('{source_material}', '') added to its manual substitution chain, mirroring the existing {corrections} treatment, once the token was added to the on-disk template."
  - "apps/dispatch-control's Prompt Lab VariableRegistry.ts (outside packages/pipeline, not in the plan's files_modified list) was updated to register the new {source_material} token for researcher_user — otherwise the findUnknownVariables save-gate would flag it as unknown/mangled the first time anyone opened that template in the console."

patterns-established:
  - "Frozen Wave-0 test scaffolds take precedence over a plan's literal task prose when the two conflict — verify against RESEARCH.md's own code examples first, since Wave-0 plans mirror RESEARCH.md, not paraphrase it."

requirements-completed: [ENT-02, ENT-03, ENT-04]

# Metrics
duration: 15min
completed: 2026-07-16
---

# Phase 48 Plan 03: Pipeline Entry Seam Summary

**Forked the compiled LangGraph at two conditional-edge hops (calibrator, verify_candidates) so a brief run routes straight to the Researcher skipping Signal Editor/Scout/Advocate/Gate 1/Chronicler, extended `_start_run` with byte-equivalent-for-existing-callers brief-mode seeding + a `briefs:insert` write, and threaded operator-supplied source material into the Researcher's prompt.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-16T07:54:00-07:00 (approx.)
- **Completed:** 2026-07-16T08:08:50-07:00
- **Tasks:** 3 completed (+ 2 auto-fixed follow-on deviations)
- **Files modified:** 8

## Accomplishments
- `graph/builder.py` gains `route_by_entry_mode(state) -> state.get("entry_mode") or "discovery"` and two `add_conditional_edges` calls replacing the static `calibrator->signal_editor` and `verify_candidates->advocate` edges; `add_edge(START, "calibrator")` stays a single unconditional edge (D-02). One compiled graph now has two valid execution paths — discovery's execution order is byte-identical, brief routes `calibrator -> verify_candidates -> researcher`.
- `api/runs.py::_start_run` gains 5 additive-defaulted kwargs (`entry_mode`, `winning_charity`, `brief`, `source_material`, `agent_keys_override`). `runs:create` carries `entryMode` only for non-discovery runs; Step 4b writes `briefs:insert` immediately after `runs:create` (gated on `brief is not None`, using the internally-minted `run_id` — no partial-failure window, D-06); `agent_keys` uses the override when present else the unchanged full 20-step list (D-16); `initial_state` always seeds `entry_mode` explicitly and seeds `winning_charity`/`candidates=[winning_charity]`/`brief`/`source_material` only in brief mode (D-04/D-05).
- `agents/researcher.py` gains `_build_source_material_block` (mirrors `_build_corrections_block`) chained into `_build_messages`'s `user` string via a new `{source_material}` `.replace()`; `prompts/researcher_user.md` gains the `{source_material}` token (renders `""` when absent — byte-equivalent for discovery); `lib/agent_wrapper.py::_INPUT_KEYS["researcher"]` gains `"source_material"` for the Phase-44 Inspect-Inputs tab.
- `verify_candidates.py` was **not edited** — confirmed via `git diff` against its Phase-46 commit (0 lines changed); it is already advisory-safe per D-11.
- Full pipeline pytest suite: **675 passed, 42 skipped, 0 failed**. Full dispatch-control vitest suite: **933 passed, 6 skipped, 2 todo, 0 failed**.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fork the graph — route_by_entry_mode + two conditional edges** - `e22d8b3` (feat)
2. **Task 2: Extend _start_run — entry_mode seed, reduced agent_runs queue, briefs:insert** - `5a627bd` (feat)
3. **Task 3: Thread source_material into the Researcher prompt** - `282e26e` (feat)

Plus two in-scope follow-on deviation commits (see below):
4. **Fix: mirror {source_material} in the Phase 24 byte-equivalence oracle** - `f444409` (fix)
5. **Fix: register {source_material} in the Prompt Lab VariableRegistry** - `003060a` (fix)

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` - route_by_entry_mode router + two add_conditional_edges calls replacing the calibrator->signal_editor and verify_candidates->advocate static edges
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` - _start_run extended with 5 additive-defaulted brief-mode params, briefs:insert write, reduced agent_keys support
- `packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` - _build_source_material_block + {source_material} threading into _build_messages
- `packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md` - {source_material} token added, doc-comment extended
- `packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py` - _INPUT_KEYS["researcher"] gains "source_material"
- `packages/pipeline/tests/test_builder_wiring.py` - two Phase 46 assertions updated to match the new conditional-edge form (direct consequence of the fork)
- `packages/pipeline/tests/test_prompt_version_seeds.py` - researcher_user byte-equivalence oracle gains the matching {source_material} -> "" substitution
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VariableRegistry.ts` - researcher_user allowed-token set + description/sample gain source_material

## Decisions Made
- **`initial_state['entry_mode']` is always set explicitly**, including for discovery calls (`"discovery"` literal), not omitted as the plan's Task 2 prose literally said. RESEARCH.md's own Pattern 2 code example and the frozen Wave-0 test `test_discovery_mode_still_seeds_entry_mode_explicitly` both require this. Per this plan's `critical_correctness_rules` ("the Wave-0 pipeline scaffolds ... must pass after this plan"), the frozen test is authoritative — implemented to match it, not the plan's literal (and internally inconsistent with RESEARCH.md) task text.
- **Conditional-edge calls written as single-line-opening `add_conditional_edges("node", router, {...})`** (not multi-line with a newline after the opening paren) so the literal substring the Wave-0 source-scan test greps for (`add_conditional_edges("calibrator"` contiguous) actually matches. A first pass with the arguments on separate lines compiled and worked correctly at runtime but failed the source-scan assertion — caught immediately by running the test, fixed before committing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Phase 46 test_builder_wiring.py asserted the now-removed static edges**
- **Found during:** Task 1 verification (`uv run pytest tests/test_builder_entry_mode_wiring.py tests/test_builder_wiring.py`)
- **Issue:** `test_calibrator_to_signal_editor_edge` and `test_verify_candidates_to_advocate_edge` (added in Phase 46) asserted the literal static edges `builder.add_edge("calibrator", "signal_editor")` and `builder.add_edge("verify_candidates", "advocate")` were present. This plan's own acceptance criteria (and RESEARCH.md §48.1) require those exact static edges to be REMOVED and replaced by conditional edges — the two assertions were now testing for something the design explicitly says should no longer exist.
- **Fix:** Updated both tests to assert the new conditional-edge form (`add_conditional_edges("calibrator"/"verify_candidates"` + the `"discovery": ...` path-map key), preserving every other assertion in the file (node registration, the untouched edges, the removed calibrator->scout/scout->advocate edges, the 20-node compiled-graph count) byte-unchanged.
- **Files modified:** `packages/pipeline/tests/test_builder_wiring.py`
- **Verification:** `uv run pytest tests/test_builder_entry_mode_wiring.py tests/test_builder_wiring.py` — 20 passed, 0 failed
- **Committed in:** `e22d8b3` (Task 1 commit)

**2. [Rule 1 - Bug] Phase 24 byte-equivalence oracle diverged after adding the {source_material} token**
- **Found during:** Full pipeline suite run after Task 3
- **Issue:** `tests/test_prompt_version_seeds.py::test_user_template_seed_byte_equivalence[researcher_user]` failed — it manually reconstructs `_build_messages`'s substitution chain against the seeded `researcher_user.md` template but did not know about the new `{source_material}` token, so its reconstruction diverged from the real (now source_material-substituted) output.
- **Fix:** Added the matching `.replace("{source_material}", "")` to the test's manual substitution chain, mirroring the existing `{corrections}` treatment.
- **Files modified:** `packages/pipeline/tests/test_prompt_version_seeds.py`
- **Verification:** `uv run pytest tests/test_prompt_version_seeds.py` — 15 passed; full suite re-run — 675 passed, 0 failed
- **Committed in:** `f444409`

**3. [Rule 1 - Bug] Prompt Lab VariableRegistry unaware of the new {source_material} token**
- **Found during:** Post-Task-3 correctness sweep (checking for other consumers of `researcher_user.md`'s token set)
- **Issue:** `apps/dispatch-control`'s `VariableRegistry.ts` declares `researcher_user: ['charity', 'results_block', 'corrections']` as the allowed-token set driving the Prompt Lab's `findUnknownVariables` save-gate. With `{source_material}` now in the on-disk template but not in this allowed set, the first operator to open/save the `researcher_user` template in the console would get a false "unknown/mangled variable" warning.
- **Fix:** Added `'source_material'` to `researcher_user`'s allowed set, plus a `VARIABLE_DESCRIPTIONS`/`VARIABLE_SAMPLES` entry mirroring the existing `corrections` precedent.
- **Files modified:** `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VariableRegistry.ts`
- **Verification:** `pnpm --filter dispatch-control test:unit` — 933 passed, 6 skipped, 2 todo, 0 failed
- **Committed in:** `003060a`

---

**Total deviations:** 3 auto-fixed (3 bugs, all direct consequences of the {source_material} token / conditional-edge fork this plan introduces)
**Impact on plan:** All three fixes were necessary for correctness — leaving any of them undone would have shipped either a failing test suite (deviations 1-2) or a false-positive UX warning in the operator console (deviation 3). No scope creep beyond what this plan's own changes required.

## Issues Encountered
None beyond the deviations above (all caught and fixed during this plan's own verification steps, not discovered later).

## User Setup Required

None - no external service configuration required. No Convex schema/function changes in this plan (that was Plan 48-01's job); nothing needs a `dev:once` sync.

## Next Phase Readiness

- `test_builder_entry_mode_wiring.py` and `test_start_run_brief_seed.py` (Plan 48-02's frozen Wave-0 scaffolds) are both fully green — no further pipeline-entry-seam work needed.
- 48-04 (brief-trigger endpoint) can now call `_start_run(app, ..., entry_mode="brief", winning_charity=..., brief=..., source_material=..., agent_keys_override=BRIEF_AGENT_KEYS)` and get the full brief-mode seed + graph fork + briefs row for free — `test_brief_run_endpoint.py`'s skip-guard (route registration) is the only remaining gate for that plan.
- 48-05/48-06 (Create-panel + Stage-1 render) are unaffected by this plan — their skip-guards (`triggerBriefRun` symbol, `StoryBriefScreen.tsx`'s entryMode branch) are untouched.
- `verify_candidates.py` remains byte-unchanged (confirmed via `git diff` against its Phase-46 commit) — ENT-04's advisory-record guarantee holds automatically once the graph fork places it on the brief path.
- No downstream node (researcher → publisher) was edited — ENT-03's "reuse verbatim" is preserved; only `researcher.py`'s prompt-building helper changed, not its output shape or the nodes after it.
- No blockers.

---
*Phase: 48-brief-entry-point*
*Completed: 2026-07-16*

## Self-Check: PASSED

- FOUND: packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
- FOUND: packages/pipeline/src/eisenbalm_pipeline/api/runs.py
- FOUND: packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py
- FOUND: packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md
- FOUND: packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py
- FOUND: packages/pipeline/tests/test_builder_wiring.py
- FOUND: packages/pipeline/tests/test_prompt_version_seeds.py
- FOUND: apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VariableRegistry.ts
- FOUND: e22d8b3 (Task 1 commit)
- FOUND: 5a627bd (Task 2 commit)
- FOUND: 282e26e (Task 3 commit)
- FOUND: f444409 (deviation fix commit)
- FOUND: 003060a (deviation fix commit)
