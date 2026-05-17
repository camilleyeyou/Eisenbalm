---
phase: 05-agent-quality
plan: 04
subsystem: testing
tags: [pytest, fixtures, asyncmock, font-whitelist, design-agent]

# Dependency graph
requires:
  - phase: 05-agent-quality
    provides: "Plan 05-02 dependency pins (tavily-python, langchain-tavily, selectolax) and DispatchState extensions"
  - phase: 04-pipeline-skeleton
    provides: "Plan 04-05 conftest.py base (ASGITransport, env-skip guards, 14-15 stub fixtures)"
provides:
  - "Phase 5 mock fixture library in tests/conftest.py (mock_convex_mutation, mock_sanity_write_charity, mock_openrouter_acomplete, mock_tavily_search, mock_httpx_get, sample_dispatch_state)"
  - "21 test skeleton files covering all Phase 5 REQ-IDs (AGT-01..AGT-18 + cost-cap + real-mode gate)"
  - "agents/design/ package with font_whitelist.py (WHITELIST_DISPLAY, WHITELIST_BODY, FONT_WHITELIST set, FALLBACK_FONT_DISPLAY/BODY)"
affects: ["plan-05-05", "plan-05-06", "plan-05-07", "plan-05-08", "plan-05-09", "plan-05-10", "plan-05-11", "plan-05-12", "plan-05-13", "plan-05-14", "plan-05-15"]

# Tech tracking
tech-stack:
  added: ["unittest.mock.AsyncMock", "unittest.mock.MagicMock"]
  patterns: ["skip-skeleton test files (pytest.mark.skip removed by implementing plan)", "agents/{name}/ as Python package layout for multi-file agents"]

key-files:
  created:
    - packages/pipeline/tests/agents/test_calibrator.py
    - packages/pipeline/tests/agents/test_scout.py
    - packages/pipeline/tests/agents/test_advocate.py
    - packages/pipeline/tests/agents/test_editor.py
    - packages/pipeline/tests/agents/test_researcher.py
    - packages/pipeline/tests/agents/test_verify.py
    - packages/pipeline/tests/agents/test_founder_bio.py
    - packages/pipeline/tests/agents/test_bonus.py
    - packages/pipeline/tests/agents/test_game.py
    - packages/pipeline/tests/agents/test_design.py
    - packages/pipeline/tests/agents/test_editor_final.py
    - packages/pipeline/tests/agents/test_tool_limits.py
    - packages/pipeline/tests/agents/qa/__init__.py
    - packages/pipeline/tests/agents/qa/test_rules.py
    - packages/pipeline/tests/agents/qa/test_judge.py
    - packages/pipeline/tests/lib/__init__.py
    - packages/pipeline/tests/lib/test_wcag.py
    - packages/pipeline/tests/lib/test_voice.py
    - packages/pipeline/tests/lib/test_openrouter.py
    - packages/pipeline/tests/lib/test_cost.py
    - packages/pipeline/tests/test_pipeline_real_mode.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py
  modified:
    - packages/pipeline/tests/conftest.py
    - packages/pipeline/tests/agents/__init__.py

key-decisions:
  - "design.py promoted to design/ package: __init__.py preserves the Phase 4 stub body so 'from eisenbalm_pipeline.agents.design import design' continues to resolve through the new package layer; Plan 05-12 will replace __init__.py body with the real DesignAgent"
  - "Test skeletons use pytest.mark.skip(reason='Wave N: pending — Plan 05-XX implements') so pytest --collect-only stays green throughout phase; implementing plan removes the marker AND adds assertions in the same task"
  - "Mock fixtures appended below Phase 4 fixtures; zero Phase 4 fixture modified or deleted; tests/conftest.py grew from 185 to 292 lines"
  - "tests/lib/__init__.py added (plan files_modified omitted it but Python package needs __init__.py for pytest discovery)"

patterns-established:
  - "Skip-skeleton pattern: ship a test file with all expected test_* function names skip-marked; implementing plan unskips + adds body in one task. Mirrors Phase 4 Plan 04-05."
  - "Mock fixtures use AsyncMock with sensible defaults (zero tokens, empty string content) — tests override .return_value / .side_effect per scenario"
  - "agents/<name>/ package layout: __init__.py exposes the @agent_node-decorated function so external import contract (from eisenbalm_pipeline.agents.<name> import <name>) is unchanged"

requirements-completed: [AGT-14]

# Metrics
duration: 11min
completed: 2026-05-17
---

# Phase 5 Plan 04: Test Infrastructure and Font Whitelist Summary

**Wave 0 test surface (21 skeletons across agents/, agents/qa/, lib/, test_pipeline_real_mode) plus agents/design/font_whitelist.py candidate list with Andrew approval marker — pytest --collect-only collects 68 tests with zero import errors**

## Performance

- **Duration:** 11 min
- **Started:** 2026-05-17T17:59:35Z
- **Completed:** 2026-05-17T18:10:28Z
- **Tasks:** 3
- **Files modified:** 25 (23 created + 2 modified)

## Accomplishments

- Phase 5 mock fixture library shipped: 6 fixtures (mock_convex_mutation, mock_sanity_write_charity, mock_openrouter_acomplete, mock_tavily_search, mock_httpx_get, sample_dispatch_state) consumable by every Wave 1-3 agent test
- 21 test skeleton files covering AGT-01..AGT-18 + cost-cap + real-mode gate; every test function pytest.mark.skip-decorated with Wave + Plan reference; pytest --collect-only collects 68 tests (44 new + 24 from Phase 4) and exits 0
- agents/design/ package with font_whitelist.py: WHITELIST_DISPLAY (13 fonts incl. 5 Phase-2-approved), WHITELIST_BODY (12 fonts incl. 3 Phase-2-approved), FONT_WHITELIST set (19 unique), FALLBACK_FONT_DISPLAY=Playfair Display, FALLBACK_FONT_BODY=Source Serif Pro; TODO(Andrew) marker present once
- Phase 4 test surface untouched: tests/agents/test_stub_fixtures.py still passes 17/17 in stub mode; graph/builder.py import `from eisenbalm_pipeline.agents.design import design` continues to resolve through the new package layer
- D-16 blocker (font whitelist) removed from STATE.md Blockers/Concerns: candidate list ready for Andrew's Plan 05-15 review

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend conftest.py with Phase 5 mock fixtures** - `3241883` (test)
2. **Task 2: Create Wave 0 test skeletons (21 files)** - `a4b36f3` (test)
3. **Task 3: Add agents/design/font_whitelist.py + package promotion** - `959887c` (feat)

## Files Created/Modified

### Created

**Test skeletons (21 files):**
- `packages/pipeline/tests/agents/test_{calibrator,scout,advocate,editor,researcher,verify,founder_bio,bonus,game,design,editor_final,tool_limits}.py` — 12 agent test files, each pytest.mark.skip with Wave + implementing Plan reference
- `packages/pipeline/tests/agents/qa/test_{rules,judge}.py` — QA Layer-1 (deterministic predicates) + Layer-2 (LLM-as-judge) skeletons
- `packages/pipeline/tests/lib/test_{wcag,voice,openrouter,cost}.py` — lib module test skeletons (consumed by Plan 05-03 finalization)
- `packages/pipeline/tests/test_pipeline_real_mode.py` — Phase 5 closing gate (Plan 05-14 fills in)
- `packages/pipeline/tests/agents/qa/__init__.py`, `packages/pipeline/tests/lib/__init__.py` — Python package init files

**Design package:**
- `packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py` — preserves Phase 4 stub body verbatim so graph/builder.py import contract holds
- `packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py` — pure-data module (zero runtime imports beyond `__future__`); WHITELIST_DISPLAY/BODY lists, FONT_WHITELIST set, FALLBACK_FONT_DISPLAY/BODY constants, TODO(Andrew) approval marker

### Modified

- `packages/pipeline/tests/conftest.py` — appended 6 Phase 5 mock fixtures + sample_dispatch_state builder below Phase 4 fixtures; Phase 4 fixtures preserved verbatim (file: 185 → 292 lines)
- `packages/pipeline/tests/agents/__init__.py` — added Phase 5 docstring (was empty)

### Renamed/Deleted (Rule 3 — see Deviations)

- `packages/pipeline/src/eisenbalm_pipeline/agents/design_old.py` → migrated into `agents/design/__init__.py`; design_old.py removed

## Decisions Made

- **design.py → design/ package conversion** — Plan 05-03's earlier work (commit `a2f9ffb`) renamed agents/design.py to agents/design_old.py to make way for the design/ package. Plan 05-04 (this plan) completes the conversion: design/__init__.py absorbs the Phase 4 stub body verbatim so `from eisenbalm_pipeline.agents.design import design` continues to resolve through graph/builder.py. Plan 05-12 will replace __init__.py with the real DesignAgent body that imports font_whitelist.FONT_WHITELIST + lib.wcag.validate_theme.
- **tests/lib/__init__.py added even though plan files_modified omitted it** — Python package discovery requires __init__.py; pytest would otherwise fail to discover tests under tests/lib/. Treated as part of Task 2 scaffolding.
- **Skip-skeleton pattern carried verbatim from Phase 4 Plan 04-05** — every test_* function pytest.mark.skip(reason="Wave N: pending — Plan 05-XX implements") at creation time; implementing plan unskips + adds assertions in the same atomic task. Ensures pytest --collect-only is green throughout the phase.
- **Mock fixtures use AsyncMock with cost-cap-safe defaults** — mock_openrouter_acomplete returns ("", {tokens_in: 0, tokens_out: 0, usd: 0.0, ...}) so tests that forget to override don't accidentally trip the cost cap. Tests set .return_value or .side_effect per scenario.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Promote agents/design.py to agents/design/ package**
- **Found during:** Task 3 (font_whitelist.py creation)
- **Issue:** Plan 05-03's earlier commit `a2f9ffb` had renamed agents/design.py → agents/design_old.py to clear the path for the new design/ package, but no one had built the package yet. As a result, `from eisenbalm_pipeline.agents.design import design` in graph/builder.py raised ModuleNotFoundError — pipeline imports were broken at HEAD before this plan started.
- **Fix:** Created agents/design/__init__.py that preserves the Phase 4 stub body verbatim (so graph/builder.py import resolves through the package layer), created agents/design/font_whitelist.py per plan spec, removed agents/design_old.py. `from eisenbalm_pipeline.graph.builder import build_graph` now succeeds again.
- **Files modified:** packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py (created), agents/design/font_whitelist.py (created), agents/design_old.py (deleted, content migrated into __init__.py)
- **Verification:** `uv run python -c "from eisenbalm_pipeline.graph.builder import build_graph; print('builder OK')"` returns 0; `uv run pytest tests/ --collect-only` collects 68 tests with zero import errors; Phase 4 stub fixtures test (`tests/agents/test_stub_fixtures.py`) continues to pass 17/17.
- **Committed in:** `959887c` (Task 3 commit)

**2. [Rule 2 - Missing Critical] Add tests/lib/__init__.py**
- **Found during:** Task 2 (test skeleton creation)
- **Issue:** Plan files_modified list omitted `packages/pipeline/tests/lib/__init__.py`, but plan instructed to create tests/lib/test_*.py files. Without __init__.py, pytest's import resolution under rootdir/testpaths can fail to discover tests in tests/lib/ (especially with conftest.py at tests/ level and Python package semantics).
- **Fix:** Added `packages/pipeline/tests/lib/__init__.py` with a one-line docstring matching the tests/agents/qa/__init__.py pattern.
- **Files modified:** packages/pipeline/tests/lib/__init__.py
- **Verification:** All 8 tests under tests/lib/ collected successfully by `pytest --collect-only`.
- **Committed in:** `a4b36f3` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking import, 1 Rule 2 missing package file)
**Impact on plan:** Both deviations necessary to satisfy plan path requirements + preserve Phase 4 import contracts. No scope creep — both directly support the plan's stated outputs (font_whitelist.py importable + pytest collection green).

## Issues Encountered

- One short detour during Task 3 setup: `git mv design.py design_old.py` was attempted twice inadvertently (file was already renamed in Plan 05-03 commit `a2f9ffb`). Self-corrected by restoring the file from git history and continuing with the design/ package conversion path. Final state is correct and verified.

## User Setup Required

None — this plan ships test infrastructure and a candidate font list. Andrew's final approval of the font_whitelist.py candidates is the scheduled step in Plan 05-15 (Wave 8); the TODO(Andrew) marker in font_whitelist.py is the surface for that review.

## Next Phase Readiness

- **Wave 0 closeout complete.** Every Wave 1-3 plan (05-05 through 05-14) can now consume the conftest.py mock fixtures + reference their pre-shipped test skeleton when writing implementation tasks. The skip-skeleton pattern means each implementing plan removes its skip marker(s) and lands real assertions atomically.
- **Font whitelist Andrew-approval blocker** (D-16) is no longer blocking any code path — agents/design/font_whitelist.py exports FONT_WHITELIST + FALLBACK_FONT_DISPLAY/BODY constants that Plan 05-12 (DesignAgent) can consume immediately. Andrew's final candidate approval moves to Plan 05-15 with no Phase 5 critical-path dependency.
- **graph/builder.py imports restored** — `from eisenbalm_pipeline.graph.builder import build_graph` succeeds; pipeline integration tests + FastAPI app boot continue to work.
- **No known blockers for Plan 05-05** (Calibrator). Plan 05-03 (lib modules) is running in parallel and is on track per the parallel commits visible at HEAD.

## Self-Check: PASSED

- All 21 test files created and present at expected paths
- tests/conftest.py contains mock_convex_mutation, mock_sanity_write_charity, mock_openrouter_acomplete, mock_tavily_search, mock_httpx_get, sample_dispatch_state (all verified via importlib spec check)
- agents/design/font_whitelist.py importable; WHITELIST_DISPLAY contains Phase 2 baseline; FALLBACK_FONT_DISPLAY=='Playfair Display'; FALLBACK_FONT_BODY=='Source Serif Pro'; FONT_WHITELIST set with 19 unique entries (≥18 required); TODO(Andrew) marker present exactly once
- pytest tests/ --collect-only -q exits 0 with 68 tests collected (≥30 required)
- Phase 4 stub fixture test still passes (17/17 in EISENBALM_STUB_MODE=true)
- All 3 task commits verified in git log: `3241883`, `a4b36f3`, `959887c`

---
*Phase: 05-agent-quality*
*Completed: 2026-05-17*
