---
phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
plan: 02
subsystem: pipeline
tags: [pydantic, langgraph, researcher-agent, provenance, tavily, claims]

# Dependency graph
requires:
  - phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
    provides: "35-01 §35.1/§35.2 API_CONTRACTS.md contract (ClaimOutput shape, code-side research claim shape) this plan implements verbatim"
provides:
  - "ResearchOutputModel.claims: list[ClaimOutput] — the LLM emits {text, sourceIndex} only, never a URL"
  - "researcher() post-acomplete mapping step: sourceIndex -> real Tavily URL + code-stamped retrievedAt, with honest None/None fallback for out-of-range/absent index"
  - "graph/state.py ResearchOutput TypedDict claims: NotRequired[list[dict]] entry"
  - "Numbered [S0]..[Sn] Tavily results block in the Researcher system/user prompts, index-only claim binding instructions"
affects: [35-03-writer-claimspans, 35-04-publisher-provenance-seeding, 35-05-galley-provenance-wash, 35-06-decision-rail-source-index]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Index-bound LLM claims: the model never sees or writes a URL, only a 0-based index into a numbered evidence list; code performs the index->URL mapping after the LLM call returns — structurally eliminates hallucinated citations"
    - "Per-batch retrievedAt stamping (int(time.time()*1000)) captured at the moment each Tavily batch returns, parallel-indexed alongside the flat results list"

key-files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py
    - packages/pipeline/src/eisenbalm_pipeline/prompts/researcher.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md
    - packages/pipeline/tests/agents/test_researcher.py
    - packages/pipeline/tests/test_pipeline_real_mode.py
    - packages/pipeline/tests/test_prompt_version_seeds.py

key-decisions:
  - "Used 0-based indexing (tavily_results[i], [S0]..[Sn]) consistently across the prompt numbering, the ClaimOutput.sourceIndex the LLM emits, and the post-acomplete mapping — matching this plan's own RED-test behavior spec (sourceIndex=0 -> results[0].url) and Task 2/3 action text verbatim. Note: API_CONTRACTS.md §35.1's inline comment reads \"1-based index... (S1=1, S2=2, …)\", which is inconsistent with this plan's explicit 0-based acceptance criteria and test behavior; implemented per the plan (the authoritative, testable spec for this task) and left the doc comment as pre-existing phrasing since amending docs/API_CONTRACTS.md is outside this plan's files_modified list — flagging for a future doc pass, not a functional gap (the field semantics — index into the numbered results — are unchanged either way)."
  - "keyStatistics removed from ResearchOutputModel per D-02; the two test fixtures that constructed it (test_researcher.py, test_pipeline_real_mode.py) updated to drop the field"

patterns-established:
  - "Claim mapping runs synchronously inside researcher() itself — no new LangGraph node — mirroring the plan's Open Q2 answer"

requirements-completed: [PRV-01]

# Metrics
duration: ~12min
completed: 2026-07-08
---

# Phase 35 Plan 02: Researcher Index-Bound Claims Summary

**Researcher now emits `claims: list[{text, sourceIndex}]` where the LLM sees numbered `[S0]..[Sn]` Tavily results and never writes a URL; code maps `sourceIndex` to the real Tavily URL plus a code-stamped `retrievedAt`, with an honest `None`/`None` fallback for any out-of-range or absent index — `keyStatistics` is removed.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Added a flat `ClaimOutput{text, sourceIndex}` Pydantic model (no `oneOf`/discriminated union, per the `graph/blocks.py` production-incident precedent) and `ResearchOutputModel.claims: list[ClaimOutput]`
- Removed `keyStatistics` from `ResearchOutputModel` (D-02 — absorbed by the claims list) and scrubbed the two test-fixture constructor usages
- Tavily search loop now stamps a per-batch `int(time.time()*1000)` `retrievedAt`, parallel-indexed to `tavily_results`
- Post-`acomplete()` mapping step in `researcher()` converts each `ClaimOutput` into a code-assembled dict `{claimId, text, sourceUrl, retrievedAt}` — `claimId` is `f"{run_id[:8]}-{ordinal}"` (collision-free within a run); an out-of-range or `None` `sourceIndex` yields `sourceUrl=None, retrievedAt=None` rather than a guessed URL
- `graph/state.py::ResearchOutput` gained `claims: NotRequired[list[dict]]`
- `_build_messages` now numbers each Tavily result `[S0] [S1] …` in the results block fed to the LLM; `researcher.md`/`researcher_user.md` instruct the model to bind every claim to a numbered index only (or `null`), never a URL

## Task Commits

Each task was committed atomically:

1. **Task 1: RED tests — index binding, out-of-range, keyStatistics removal** - `41c5c24` (test)
2. **Task 2: Implement claims list, index→URL mapping, retrievedAt, claimId; remove keyStatistics; update ResearchOutput TypedDict** - `a7b3856` (feat)
3. **Task 3: Number Tavily results S0..Sn in the prompt + instruct the LLM to emit index-bound claims** - `fc93fbf` (feat, includes the auto-fixed `test_prompt_version_seeds.py` byte-equivalence oracle)

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` - `ClaimOutput` model, `claims` field, per-batch `retrievedAt` stamping, post-LLM index→URL mapping, numbered `[Si]` results block
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` - `ResearchOutput.claims: NotRequired[list[dict]]`
- `packages/pipeline/src/eisenbalm_pipeline/prompts/researcher.md` - CLAIMS instruction block (index-only binding, null when unsourced)
- `packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md` - reminder to populate `claims` with `{text, sourceIndex}`
- `packages/pipeline/tests/agents/test_researcher.py` - 4 new RED→GREEN assertions (index binding, out-of-range/None fallback, unique claimIds, keyStatistics field removal); `_make_research` helper gained a `claims` param and dropped `keyStatistics`
- `packages/pipeline/tests/test_pipeline_real_mode.py` - dropped `keyStatistics=[...]` from the `_research_output()` fixture
- `packages/pipeline/tests/test_prompt_version_seeds.py` - updated the duplicated `results_block` reconstruction to add the same `[Si]` labels (see Deviations)

## Decisions Made
- 0-based indexing throughout (`[S0]`, `tavily_results[0]`), matching this plan's own behavior spec and acceptance criteria (`0 <= sourceIndex < len(tavily_results)`) rather than API_CONTRACTS.md §35.1's inline "1-based (S1=1, S2=2)" comment phrasing — the plan's explicit, testable spec is authoritative for this task; the field semantics (an index into the numbered evidence list) are unaffected by which convention is used, and amending docs/API_CONTRACTS.md is outside this plan's file scope
- `keyStatistics` removed outright (not deprecated/kept) per D-02, since the plan explicitly scopes this as an absorption into `claims`
- Claim mapping stays synchronous inside `researcher()` — no new LangGraph node — per the plan's Open Q2 resolution

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated `test_prompt_version_seeds.py`'s duplicated `results_block` reconstruction**
- **Found during:** Task 3 (numbering Tavily results in the prompt)
- **Issue:** `test_user_template_seed_byte_equivalence[researcher_user]` independently reconstructs the `results_block` string to verify the on-disk seeded template stays byte-identical to `researcher_agent._build_messages()`'s actual output. Adding the `[Si]` index prefix in `_build_messages` (Task 3) made that duplicated reconstruction stale, and the full-suite regression run caught the failure.
- **Fix:** Added the same `[S{i}]` enumeration to the test's local `results_block` construction so both sides match again.
- **Files modified:** `packages/pipeline/tests/test_prompt_version_seeds.py`
- **Verification:** `uv run pytest tests/test_prompt_version_seeds.py -x -q` → 15 passed; full suite `uv run pytest -q` → 445 passed, 36 skipped (no regressions)
- **Committed in:** `fc93fbf` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep a pre-existing byte-equivalence oracle test accurate after the in-scope prompt-format change. No scope creep — no other files outside the plan's `files_modified` list were touched.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 35-03 (Writer claimSpans) can now read `state["research"]["claims"]` (code-mapped `{claimId, text, sourceUrl, retrievedAt}` dicts) and whitelist-reference `claimId`s from the five prose writers
- Plan 35-04 (Publisher provenance seeding) can seed `claim_checks` rows directly from `state["research"]["claims"]` via the Plan 35-01-extended `insertBatch`
- `founderName`/`founderNameSourceUrl`/`subjectName`/`subjectNameSourceUrl` remain untouched (D-02 back-compat) — no follow-up needed there
- The pre-existing `ResearchOutput`/`ResearchOutputModel` field-name drift (§35.6, Research Pitfall 3) remains documented-and-untouched, exactly as scoped

---
*Phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering*
*Completed: 2026-07-08*

## Self-Check: PASSED

All 8 modified/created files verified present on disk (researcher.py, graph/state.py, researcher.md, researcher_user.md, test_researcher.py, test_pipeline_real_mode.py, test_prompt_version_seeds.py, this SUMMARY.md); all three task commit hashes (41c5c24, a7b3856, fc93fbf) verified present in git log.
