---
phase: 24-prompt-editor-versioning
plan: 01
subsystem: testing
tags: [api-contracts, convex, pytest, vitest, prompt-versioning, byte-equivalence, tdd-scaffold]

# Dependency graph
requires:
  - phase: 22-config-externalization
    provides: "prompt_versions table + upsertActive/getActive + config_loader RunConfig"
  - phase: 21-auth-app-shell-convex-schema
    provides: "runs table + audit_log + require_clerk_jwt + dispatch-control convex-test harness"
  - phase: 16-choose-your-narrator
    provides: "lib/voice.py assemble_voice + VOICE_CONSTRAINTS import-time sentinel"
provides:
  - "API_CONTRACTS.md §4A.2/§4A.2a/§4A.2b/§3A/§7 amendments for all Phase 24 boundaries"
  - "8 RED test files (3 pipeline + 5 dispatch-control) covering PRM-01..06"
  - "by_workspace_agentKey_version index documented; saveVersion/activate/listForAgent/getByVersion contracts"
  - "POST /agents/{agent_key}/test-run endpoint contract + isolation rules"
affects: [24-02-convex-versioning, 24-03-pipeline-asset-loading, 24-04-user-templates, 24-05-guidance-rubric, 24-06-voice-testrun, 24-07-editor-ui, 24-08-diff-rollback-testrun-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contract-first: API_CONTRACTS.md amended BEFORE any implementing code (CLAUDE.md hard rule)"
    - "RED-until-green scaffold: guarded imports keep files collectable while assertions reference not-yet-built modules"
    - "Byte-equivalence oracle tests via load_prompt() round-trip"

key-files:
  created:
    - "packages/pipeline/tests/test_prompt_version_seeds.py"
    - "packages/pipeline/tests/test_voice_db_override.py"
    - "packages/pipeline/tests/test_test_run.py"
    - "apps/dispatch-control/__tests__/saveVersion.test.ts"
    - "apps/dispatch-control/__tests__/activate.test.ts"
    - "apps/dispatch-control/__tests__/VariableRegistry.test.ts"
    - "apps/dispatch-control/__tests__/DiffViewer.test.tsx"
    - "apps/dispatch-control/__tests__/PromptEditor.test.tsx"
  modified:
    - "docs/API_CONTRACTS.md"
    - "apps/dispatch-control/vitest.config.ts"

key-decisions:
  - "founder_bio/case_study guidance externalized as TWO agentKeys each (_verified + _anonymous), per D-06 Option A"
  - "voice_constraints seed stores the FULL assembled VOICE_CONSTRAINTS string, not just JESSE_PERSONA_BLOCK"
  - "test-run isolation: handler calls acomplete directly, never @agent_node / graph.ainvoke; no agent_runs writes"
  - "RunConfig.voice_constraints default None preserves the import-time sentinel + test_voice.py invariants"

patterns-established:
  - "Guarded-import RED scaffold: try/except import + pytestmark.skipif (pipeline) / require() try-catch (vitest) keeps files collectable"
  - "convex-test direct seeding via t.run(ctx => ctx.db.insert(...)) for runs/prompt_versions fixtures"
  - "xfail parametrize for user-template byte-source values Plan 04b will fill in"

requirements-completed: []

# Metrics
duration: 18min
completed: 2026-06-22
---

# Phase 24 Plan 01: Contracts and Test Scaffold Summary

**API_CONTRACTS.md amended for every Phase 24 boundary (prompt_versions mutations, by_workspace_agentKey_version index, externalized agentKeys, test-run endpoint, RunConfig.voice_constraints) plus 8 RED test files (3 pipeline + 5 dispatch-control) that fail until Waves 1-2 land — a complete contract-first + Nyquist scaffold.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-22T09:46:56Z
- **Completed:** 2026-06-22T09:55:00Z (approx)
- **Tasks:** 3
- **Files modified:** 10 (2 modified, 8 created)

## Accomplishments
- Amended `docs/API_CONTRACTS.md` additively: §4A.2 compound index, §4A.2a (saveVersion/activate/listForAgent/getByVersion contracts with the D-02 in-progress guard), §4A.2b (all newly-externalized agentKeys), a new top-level §3A (POST /agents/{agent_key}/test-run + isolation contract), and §7 RunConfig.voice_constraints — frozen deliberation tables §4.1-4.5 byte-unchanged.
- Authored 3 pipeline pytest RED files (byte-equivalence seed oracles, assemble_voice db_voice_override codepath, test-run endpoint isolation) — 20 collectable tests; RED state confirmed (6 failed + 11 xfailed + 2 skipped; the sentinel-preserving `assemble_voice(None)` invariant stays green).
- Authored 5 dispatch-control vitest RED files (saveVersion, activate guard + list/get, VariableRegistry + findUnknownVariables, DiffViewer two-column, PromptEditor smoke) — all discovered; 11 new RED tests fail with missing-export / not-yet-built-module errors; all 59 pre-existing tests still pass (zero regression).

## Task Commits

Each task was committed atomically (parallel-executor `--no-verify`):

1. **Task 1: Amend docs/API_CONTRACTS.md for all new Phase 24 boundaries** - `f87d102` (docs)
2. **Task 2: Author pipeline RED tests** - `5d07f53` (test)
3. **Task 3: Author dispatch-control RED tests** - `8a99ab8` (test)

## Files Created/Modified
- `docs/API_CONTRACTS.md` - §4A.2 index + §4A.2a/§4A.2b mutation+agentKey contracts, §3A test-run endpoint, §7 RunConfig.voice_constraints
- `packages/pipeline/tests/test_prompt_version_seeds.py` - byte-equivalence oracles (guidance, rubric, voice) + xfail user-template parametrize
- `packages/pipeline/tests/test_voice_db_override.py` - assemble_voice db_voice_override codepath (PRM-06)
- `packages/pipeline/tests/test_test_run.py` - /agents/{key}/test-run isolation + cost shape (PRM-05)
- `apps/dispatch-control/__tests__/saveVersion.test.ts` - v-increment + never-overwrite + audit (PRM-03)
- `apps/dispatch-control/__tests__/activate.test.ts` - in-progress guard + isActive flip + list/get (PRM-04)
- `apps/dispatch-control/__tests__/VariableRegistry.test.ts` - allowed-var map + findUnknownVariables (PRM-02)
- `apps/dispatch-control/__tests__/DiffViewer.test.tsx` - two-column [data-side] diff (PRM-04)
- `apps/dispatch-control/__tests__/PromptEditor.test.tsx` - CodeMirror dynamic-import smoke (PRM-01)
- `apps/dispatch-control/vitest.config.ts` - registered saveVersion/activate as edge-runtime

## Decisions Made
- founder_bio/case_study guidance gets two agentKeys each (`_verified` + `_anonymous`) per RESEARCH D-06 Option A — the anonymous seeds keep the literal `{role}` token (formatted at call time, not seed time).
- `voice_constraints` seed stores the FULL assembled `VOICE_CONSTRAINTS`, hydrated into `RunConfig.voice_constraints` at run start; `assemble_voice(None)` without an override stays byte-identical to the code constant so the import-time sentinel + `test_voice.py` are untouched.
- Test-run isolation documented as: call `acomplete` directly, never the `@agent_node` decorator / `graph.ainvoke`, and never write `agent_runs` / `agent_run_payloads` / `deliberationEvents`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The dispatch-control convex-test files required adding two entries to `vitest.config.ts`'s `environmentMatchGlobs` (edge-runtime) — this was anticipated by the plan's `read_first` reference to the harness config, not a deviation.

## Known Stubs / RED state (intentional)
The 8 test files are deliberately RED — they reference modules that Waves 1-2 build (`convex/promptVersions.saveVersion`, `api/agents.py`, `prompts/*.md` seeds, `VariableRegistry`, `DiffViewer`, `PromptEditor`, the `db_voice_override` kwarg). This is the planned Nyquist scaffold, not an unintended stub. The guarded imports keep every file collectable so each downstream task has a named failing check to turn green. Current RED tally: pipeline 6 failed + 11 xfailed + 2 skipped (1 green sentinel invariant); dispatch-control 11 failed (59 pre-existing green).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Every Phase 24 implementing wave (Plans 02-08) now has a written contract and a named RED automated check.
- Wave 1 can begin: Plan 02 (Convex versioning mutations) turns saveVersion/activate/list/get green; Plan 03/04/05 turn the byte-equivalence oracles green; Plan 06 turns the voice db_override + test-run tests green; Plans 07/08 turn the UI tests green.

---
*Phase: 24-prompt-editor-versioning*
*Completed: 2026-06-22*

## Self-Check: PASSED

All 10 created/modified files verified present on disk; all 3 task commits (f87d102, 5d07f53, 8a99ab8) verified in git log.
