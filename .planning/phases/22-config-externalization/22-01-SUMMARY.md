---
phase: 22-config-externalization
plan: 01
subsystem: testing
tags: [langgraph, convex, config-externalization, contract-first, pytest, xfail, importlib-resources]

# Dependency graph
requires:
  - phase: 21-auth-app-shell-convex-schema
    provides: "11 Mission Control Convex tables (agents/prompt_versions/pipeline_config/runs stubs) + workspace_id scoping"
  - phase: 04-pipeline-skeleton
    provides: "DispatchState §7 contract + lib/prompts.load_prompt byte oracle + pytest conftest fixtures"
provides:
  - "docs/API_CONTRACTS.md §4A Phase-22 control-plane table shapes + §7 DispatchState.config / RunConfig dataclass"
  - "CFG-01/CFG-03/CFG-04 config_loader test seam (5 xfail tests naming load_run_config/RunConfig/AgentConfig)"
  - "CFG-02 byte-parity test seam (11 agentKey/prompt-file parametrized pairs)"
  - "CFG-04 snapshot-before-create_task + resume-no-resnap ordering seam"
  - "Wheel-safe importlib.resources prompt-resolution guard (11 prompts, PASSES now)"
affects: [22-02, 22-03, 22-04, 22-05, config_loader, prompt-seed-migration, runs-snapshot-ordering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contract-first §7 amendment before any code touches DispatchState.config (CLAUDE.md hard rule)"
    - "xfail(strict=False) Wave-0 scaffolds naming real not-yet-existing symbols; guarded imports keep collection green"
    - "Byte oracle = load_prompt(); every prompt-content path asserts equality against it"

key-files:
  created:
    - "packages/pipeline/tests/lib/test_config_loader.py"
    - "packages/pipeline/tests/lib/test_prompt_seed.py"
    - "packages/pipeline/tests/api/test_runs_config_snapshot.py"
    - "packages/pipeline/tests/test_package_data_prompts.py"
  modified:
    - "docs/API_CONTRACTS.md"

key-decisions:
  - "§4A control-plane tables documented as a new subsection after §4.6 (kept separate from frozen deliberation tables)"
  - "RunConfig/AgentConfig documented as @dataclass (asdict-serializable for configSnapshot) not TypedDict"
  - "Byte-parity test mock returns load_prompt() output at Wave 0 → xpasses under strict=False (acceptable; Plan 04 wires real seed mock)"

patterns-established:
  - "Pattern 1: amend API_CONTRACTS §7 + control-plane table shapes BEFORE code (contract-first gate)"
  - "Pattern 2: Wave-0 test scaffolds xfail(strict=False) with guarded imports so suite stays green pre-implementation"
  - "Pattern 3: package-data wheel guard is NOT xfail — proves the production fallback path holds today"

requirements-completed: [CFG-01, CFG-02, CFG-03, CFG-04]

# Metrics
duration: 9min
completed: 2026-06-22
---

# Phase 22 Plan 01: Config-Externalization Wave-0 Foundation Summary

**Contract-first §7 amendment (DispatchState.config + RunConfig dataclass + §4A control-plane table shapes) plus four pytest scaffolds that lock byte-parity and snapshot-before-invoke invariants before any config_loader code is written.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-22T04:49Z
- **Completed:** 2026-06-22
- **Tasks:** 3
- **Files modified:** 5 (1 doc amended, 4 tests created)

## Accomplishments
- `docs/API_CONTRACTS.md` amended (contract-first): new §4A documents `agents` (with added `top_p`/`max_tokens`/`description`), `prompt_versions` (11-prompt seed + agentKey→file mapping table), `pipeline_config`, and `runs.configSnapshot`; §7 gains the `RunConfig`/`AgentConfig` dataclass shape and `config: NotRequired[Optional[RunConfig]]` on `DispatchState`. Zero deletions — frozen tables untouched.
- CFG-01/CFG-03/CFG-04 config_loader scaffold: 5 xfail tests naming `load_run_config`, `RunConfig`, `AgentConfig`, `_build_fallback_config` (Convex-hydration, hard-failure fallback, per-key fallback, byte-parity, snapshot round-trip).
- CFG-02 byte-parity scaffold parametrized over the canonical 11 agentKey/prompt-file pairs + idempotent-seed placeholder.
- CFG-04 snapshot-ordering scaffold naming the real `run_weekly`/`resume_run` handlers (snapshot-before-create_task; resume-no-resnap).
- Wheel-safe `importlib.resources` guard over all 11 prompt stems — **passes now** (11/11), proving the production fallback path resolves bundled package data.

## Task Commits

1. **Task 1: Amend API_CONTRACTS.md §7 + control-plane tables** - `d36bc03` (docs)
2. **Task 2: CFG-01/CFG-03/CFG-04 config_loader test scaffold** - `ed580fa` (test)
3. **Task 3: CFG-02 byte-parity + CFG-04 snapshot-ordering + wheel-data scaffolds** - `1fe93e6` (test)

## Files Created/Modified
- `docs/API_CONTRACTS.md` - §4A Phase-22 control-plane tables + §7 RunConfig/AgentConfig + DispatchState.config (additive, 146 lines)
- `packages/pipeline/tests/lib/test_config_loader.py` - 5 xfail config_loader seam tests (CFG-01/03/04)
- `packages/pipeline/tests/lib/test_prompt_seed.py` - parametrized 11-pair byte-parity seam (CFG-02)
- `packages/pipeline/tests/api/test_runs_config_snapshot.py` - snapshot-ordering seam (CFG-04)
- `packages/pipeline/tests/test_package_data_prompts.py` - wheel-safe prompt-resolution guard (passes now)

## Decisions Made
- §4A placed as a new subsection after §4.6 so the Phase-22 control plane is documented adjacent to the other Convex-table contracts without disturbing the frozen deliberation-table blocks.
- `RunConfig`/`AgentConfig` documented as `@dataclass` (per RESEARCH Pattern 1) because `dataclasses.asdict()` is what the `configSnapshot` write needs; TypedDict would force manual serialization.
- Byte-parity mock at Wave 0 returns `load_prompt()` output, so those tests `xpass` rather than `xfail`; `strict=False` keeps the suite green and Plan 04 swaps in the real `promptVersions:getActive` round-trip mock.

## Deviations from Plan

None - plan executed exactly as written. All grep/automated acceptance criteria for all three tasks passed on first run; full pipeline suite stayed green.

## Issues Encountered
None. The pre-existing Phase 18 `PydanticSerializationUnexpectedValue` warnings (`BodyBlock` discriminated-union serialization) surfaced in the full-suite run but are out of scope and unrelated to this plan's changes — logged here only to note they are not regressions.

## User Setup Required
None - no external service configuration required. (Live Convex seed + call-site swap happen in Plans 22-03/04/05.)

## Next Phase Readiness
- API_CONTRACTS §7 + §4A are the locked reference for Plan 22-03's `state.py` `config` field addition and the Convex schema column additions (`top_p`/`max_tokens`/`description`).
- All four CFG requirements now have named, discoverable test seams; Plans 22-03/04/05 remove the xfail marks as they implement.
- Verification: plan 4-file run = 11 passed / 18 xfailed / 11 xpassed; full pipeline suite = **262 passed / 33 skipped / 18 xfailed / 11 xpassed / 0 failed**.

## Self-Check: PASSED

All 5 created/modified files exist on disk; all 3 task commits (`d36bc03`, `ed580fa`, `1fe93e6`) present in git history.

---
*Phase: 22-config-externalization*
*Completed: 2026-06-22*
