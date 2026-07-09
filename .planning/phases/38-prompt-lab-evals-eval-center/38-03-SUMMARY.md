---
phase: 38-prompt-lab-evals-eval-center
plan: 03
subsystem: api
tags: [fastapi, pydantic, scout, isolation-testing, shadow-run]

# Dependency graph
requires:
  - phase: 38-prompt-lab-evals-eval-center (plan 02)
    provides: "api/eval.py router (GET /eval/scenarios) + _require_operator auth reuse"
provides:
  - "Pure async discover_candidates(run_id, config) extracted from scout.py — registry-dedup read -> Tavily search -> LLM parse -> Python dedup, with NO Sanity/Convex writes"
  - "scout() refactored to call discover_candidates() then perform its existing write_charity + pitchLog:insert + charities:upsertCandidate writes unchanged"
  - "POST /eval/shadow-run (api/eval.py) — read-only live-discovery preview over discover_candidates(), returns {candidates, featuredKeysCount}"
  - "D-12 isolation proof: tests/api/test_shadow_run.py asserts zero Convex writes to any forbidden run-table prefix (incl. pitchLog/charities) AND zero Sanity write_charity calls"
affects: [38-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function extraction for isolation: discover_candidates() is the single seam both the real scout() node and the read-only shadow-run endpoint call — writes live ONLY in scout(), never in the extracted function (RESEARCH Pattern 3)"
    - "Isolation test belt-and-suspenders: patch both the actually-reachable bound reference (agents.scout.write_charity/convex_mutation_safe) AND the lib-module source (lib.sanity_client.write_charity/lib.convex_client.convex_mutation_safe) so the test catches a regression regardless of which reference a future edit uses"

key-files:
  created:
    - packages/pipeline/tests/agents/test_scout_discover.py
    - packages/pipeline/tests/api/test_shadow_run.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py
    - packages/pipeline/src/eisenbalm_pipeline/api/eval.py
    - packages/pipeline/tests/test_prompt_version_seeds.py

key-decisions:
  - "_build_messages() now takes config directly instead of the full DispatchState (it only ever read state.get('config')) — lets discover_candidates() call it without fabricating pipeline state; the one existing call site (tests/test_prompt_version_seeds.py's scout_user byte-equivalence oracle) was updated from state={} to config=None, a direct regression from this signature change"
  - "The shadow-run endpoint uses a synthetic run_id=f'shadow-{uuid4()}' — it only scopes the in-memory cost recorder (never flushed to Convex), so no real pipeline run needs to exist"
  - "_extract_candidates() (previously a closure inside scout()) was promoted to a module-level function so both discover_candidates() and any future caller can reuse it without duplicating the stub-mode/real-mode shape-tolerance logic"

patterns-established:
  - "Any future read-only preview endpoint over an agent with a write tail should follow this same extraction shape: <agent>() calls a pure <agent>_discover()/<agent>_compute() helper, then performs writes; the preview endpoint calls the pure helper directly, never the decorated node and never __wrapped__ (the RESEARCH-documented anti-pattern, since __wrapped__ still executes the write tail living in the function body)"

requirements-completed: [EVL-05]

# Metrics
duration: ~17min
completed: 2026-07-09
---

# Phase 38 Plan 03: Shadow-Run Discover-Candidates Summary

**Pure `discover_candidates()` extracted from Scout (registry read → live Tavily search → LLM parse → dedup, zero writes) backing a new `POST /eval/shadow-run` preview endpoint, with a D-12 isolation test proving zero Convex run-table writes and zero Sanity `write_charity` calls.**

## Performance

- **Duration:** ~17 min
- **Completed:** 2026-07-09
- **Tasks:** 2 (both TDD: RED → GREEN)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- `scout.py`'s discovery logic (steps 1-4: Convex registry-dedup read → Tavily search with `max_tool_calls` enforcement → OpenRouter `acomplete` parse with the empty-candidates corrective retry → Python dedup filter) is now a standalone `async def discover_candidates(*, run_id, config=None) -> tuple[list[dict], list[str], dict]` with NO Sanity write and NO Convex mutation — `charities:listForDedup` (inside `_load_registry_keys`) remains a READ.
- `scout()` is now a thin wrapper: it calls `discover_candidates()` then performs its unchanged write tail (`write_charity` → `pitchLog:insert` → `charities:upsertCandidate` per candidate, plus `model_versions` recording). Byte-for-byte identical real-run behavior — all 21 existing scout-related tests stay green with zero modification to their assertions.
- `_build_messages()` was refactored to accept `config` directly instead of the full `DispatchState` (it only ever read `state.get("config")`), so `discover_candidates()` never needs to fabricate pipeline state for the shadow-run caller.
- `POST /eval/shadow-run` (`api/eval.py`, same `_require_operator` auth as `GET /eval/scenarios`) accepts `{"workspace_id": str}` and calls `discover_candidates(run_id=f"shadow-{uuid4()}", config=None)` directly — never `scout()` and never `scout.__wrapped__` (both would execute the real write tail per RESEARCH Pattern 3) — returning `{"candidates": [...], "featuredKeysCount": int}`.
- D-12 isolation proof (`tests/api/test_shadow_run.py`): extends the codebase's `FORBIDDEN_MUTATION_PREFIXES` convention with `"pitchLog"` and `"charities"` (the two mutations Scout's real writes touch that neither `test-run` nor `score` ever needed to guard against) and additionally asserts Sanity's `write_charity` is never invoked — patched both at the actually-reachable bound reference (`agents.scout.write_charity`/`convex_mutation_safe`) and at the lib-module source, so the test would catch a regression through either path.
- 5/5 new pytest tests green (3 `test_scout_discover.py` + 2 `test_shadow_run.py`); full pipeline suite 515 passed / 36 skipped, zero regressions.

## Task Commits

Each task was committed atomically (RED → GREEN per TDD):

1. **Task 1: Extract pure discover_candidates() from scout.py** - `782e18e` (test, RED) → `677c5e5` (feat, GREEN)
2. **Task 2: POST /eval/shadow-run + D-12 isolation proof** - `bb2e3aa` (test, RED) → `7034ad9` (feat, GREEN)

**Plan metadata:** (this commit, following)

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/agents/scout.py` - Extracted `discover_candidates()` (pure, steps 1-4); `scout()` slimmed to call it + perform the unchanged write tail; `_build_messages()` now takes `config` directly; `_extract_candidates()` promoted to module level
- `packages/pipeline/src/eisenbalm_pipeline/api/eval.py` - Added `ShadowRunBody` + `POST /eval/shadow-run` over `discover_candidates()`
- `packages/pipeline/tests/agents/test_scout_discover.py` - 3 tests: dedup-applied return shape, never-writes proof, scout()-still-calls-discover-then-writes smoke test
- `packages/pipeline/tests/api/test_shadow_run.py` - 2 tests: 200 response shape, D-12 isolation proof (Convex forbidden prefixes + Sanity write_charity)
- `packages/pipeline/tests/test_prompt_version_seeds.py` - Updated the `scout_user` byte-equivalence oracle's `_build_messages()` call site from `state={}` to `config=None` (direct regression from the signature change, fixed inline per Rule 1)

## Decisions Made

- `_build_messages(config=...)` instead of `_build_messages(state=...)` — the function only ever read `state.get("config")`, so accepting `config` directly removes the need for `discover_candidates()` (and the shadow-run caller, which has no `DispatchState`) to fabricate a fake state dict.
- Synthetic `run_id=f"shadow-{uuid4()}"` for the shadow-run endpoint — scopes the in-memory `CostRecorder` only (never flushed to Convex), so no real pipeline run needs to pre-exist for the preview to work.
- `_extract_candidates()` moved from a closure inside `scout()` to a module-level function — both `discover_candidates()` and `scout()`'s corrective-retry path now share one definition instead of duplicating the stub/real-mode shape-tolerance logic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a regression in `test_prompt_version_seeds.py`'s scout_user byte-equivalence oracle**
- **Found during:** Task 1 (full scout suite run after the `_build_messages` signature change)
- **Issue:** `_build_messages()`'s signature changed from `(*, state, ...)` to `(*, config, ...)` per the plan's explicit instruction ("refactor `_build_messages` to accept `config` directly"). One out-of-plan-file call site (`tests/test_prompt_version_seeds.py:189`, the Phase 24 scout_user byte-equivalence oracle) still called `scout_agent._build_messages(state=_STATE, ...)`, causing `TypeError: _build_messages() got an unexpected keyword argument 'state'`.
- **Fix:** Updated the call site to `scout_agent._build_messages(config=None, ...)` — `_STATE` was already an empty dict standing in for "no config" (disk-fallback path), so `config=None` is the exact semantic equivalent.
- **Files modified:** `packages/pipeline/tests/test_prompt_version_seeds.py`
- **Verification:** `uv run pytest tests/ -k scout -q` — 21/21 passed (was 20 passed / 1 failed before the fix)
- **Committed in:** `677c5e5` (Task 1 GREEN commit — the fix travels with the signature change that caused it, not a separate commit, since reverting the scout.py refactor alone would re-break this test)

---

**Total deviations:** 1 auto-fixed (1 bug fix, directly caused by this task's own signature change — no scope creep)
**Impact on plan:** Necessary to keep the full scout test suite green; the plan's own acceptance criteria requires `uv run pytest tests/ -k scout -q` to exit 0.

## Issues Encountered

None beyond the auto-fixed regression above.

## User Setup Required

None - no external service configuration required. `POST /eval/shadow-run` reuses the same auth dependency (`_require_operator`) and environment variables (`TAVILY_API_KEY`, `OPENROUTER_API_KEY`) already required for the real Scout agent to run live.

## Next Phase Readiness

- `discover_candidates()` is a stable, tested seam — Plan 38-06 (eval-center-drift-shadow) can wire the dashboard's `ShadowRunPanel` directly against `POST /eval/shadow-run` with no further pipeline changes.
- The isolation pattern established here (belt: bound-reference patch; suspenders: lib-module-source patch) is reusable for any future read-only preview endpoint over an agent with a write tail.
- `apps/dispatch-control` was not touched by this plan (pure pipeline-side Python work); Plan 38-06 will be the first to consume the shadow-run endpoint from the dashboard and should run `pnpm --filter dispatch-control build` at that point per the phase's standing convention.

---
*Phase: 38-prompt-lab-evals-eval-center*
*Completed: 2026-07-09*

## Self-Check: PASSED

All 5 created/modified files confirmed present on disk; all 4 commit hashes
(`782e18e`, `677c5e5`, `bb2e3aa`, `7034ad9`) confirmed present in `git log`.
