---
phase: 38-prompt-lab-evals-eval-center
plan: 02
subsystem: api
tags: [fastapi, pydantic, golden-scenarios, evals, prompt-lab]

# Dependency graph
requires:
  - phase: 38-prompt-lab-evals-eval-center (plan 01)
    provides: §38 four-surface contract in docs/API_CONTRACTS.md (§38.1 GET /eval/scenarios shape locked verbatim)
  - phase: 28-prompt-console
    provides: POST /agents/{agent_key}/test-run + /score endpoints (the scenario execution primitive, D-02) and their SAMPLE_FIXTURES variable-key source
provides:
  - "8 golden-scenario repo fixtures (evals/scenarios.json) covering scout/advocate/researcher/bonus_spec_ad, each targeting a test-run-replicable agentKey only"
  - "evals/loader.py: Scenario/ScoringTarget Pydantic models + list_scenarios(agent_key?) + get_scenario(id)"
  - "GET /eval/scenarios pipeline endpoint (api/eval.py), registered in main.py, reusing api/agents.py's _require_operator auth verbatim"
  - "apps/dispatch-control/lib/evalScenarioClient.ts: fetchScenarios(agentKey?, token) TS client"
affects: [38-03, 38-04, 38-05, 38-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Repo-fixture-as-source-of-truth: scenarios.json is the ONLY scenario store; no duplication into Convex (D-01) — the pipeline is the sole reader/writer, the dashboard reads only via GET /eval/scenarios"
    - "Cross-module auth reuse: api/eval.py imports _require_operator directly from api/agents.py rather than re-declaring the optional-bearer dependency (first cross-module reuse of this pattern in the codebase)"

key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/evals/__init__.py
    - packages/pipeline/src/eisenbalm_pipeline/evals/scenarios.json
    - packages/pipeline/src/eisenbalm_pipeline/evals/loader.py
    - packages/pipeline/src/eisenbalm_pipeline/api/eval.py
    - packages/pipeline/tests/evals/__init__.py
    - packages/pipeline/tests/evals/test_scenario_loader.py
    - packages/pipeline/tests/api/test_eval_scenarios.py
    - apps/dispatch-control/lib/evalScenarioClient.ts
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py

key-decisions:
  - "Golden scenarios mapped to test-run-replicable agentKeys only: scout (normal week, dry well, radioactive week, repeat pressure), advocate (famous bait), researcher (ghost charity, hallucination trap), bonus_spec_ad (voice gauntlet) — no origin_story/problem/founder_bio_*/case_study_* scenario, per 38-RESEARCH.md Pitfall 5"
  - "loader.py re-reads scenarios.json from disk on every call (no module-level cache) — cheap given the 8-fixture starter set, and lets an operator edit the manifest without a process restart"
  - "api/eval.py imports _require_operator directly from api/agents.py instead of re-declaring the optional-bearer dependency — avoids drift between the two auth gates for a near-identical semantic"

patterns-established:
  - "Golden-scenario fixture shape enforced by a source-scan-style allowlist test (test_every_scenario_targets_a_replicable_agent_key) rather than validation inside loader.py itself — keeps the loader agentKey-agnostic while the test is the single source of truth for what counts as 'replicable'"

requirements-completed: [EVL-01]

# Metrics
duration: ~15min
completed: 2026-07-09
---

# Phase 38 Plan 02: Golden Scenarios + GET /eval/scenarios Endpoint Summary

**8 golden-scenario repo fixtures (scout/advocate/researcher/bonus_spec_ad only) behind a Pydantic loader and a new `GET /eval/scenarios` pipeline endpoint, plus the TS client the Eval Center + eval drawer will call.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-09
- **Tasks:** 2 (both TDD: RED → GREEN)
- **Files modified:** 9 (8 created, 1 modified)

## Accomplishments

- `evals/scenarios.json` ships 8 golden-scenario fixtures mapping the design brief's named scenarios (normal week, dry well, famous bait, ghost charity, radioactive week, repeat pressure, voice gauntlet, hallucination trap) onto test-run-replicable agentKeys ONLY — every `input` dict uses exclusively keys already present in `api/agents.py`'s `SAMPLE_FIXTURES` for that agentKey (no invented tokens, avoiding PRM-02's unknown-variable warning gate).
- `evals/loader.py` provides `Scenario`/`ScoringTarget` Pydantic models + `list_scenarios(agent_key?)` + `get_scenario(id)`, re-reading `scenarios.json` from disk on every call.
- `GET /eval/scenarios` (`api/eval.py`, registered in `main.py` after `voice_pass.router`) returns `{"scenarios": [...]}`, optionally filtered by `?agentKey=`, reusing `api/agents.py`'s `_require_operator` optional-bearer auth verbatim (dev-mode no-op, prod-mode Clerk-verified) — no new auth mechanism.
- `apps/dispatch-control/lib/evalScenarioClient.ts` exports `fetchScenarios(agentKey?, token)`, mirroring `testRunClient.ts`/`scoreClient.ts`'s `pipelineBaseUrl()` + bearer + error-handling shape.
- 8/8 new pytest tests green (5 loader + 3 endpoint); full pipeline suite 510 passed / 36 skipped, zero regressions.

## Task Commits

Each task was committed atomically (RED → GREEN per TDD):

1. **Task 1: Scenario manifest + Pydantic loader** - `646c891` (test, RED) → `0012dc1` (feat, GREEN)
2. **Task 2: GET /eval/scenarios endpoint + router registration + TS client** - `b2024e7` (test, RED) → `cf33c59` (feat, GREEN)

**Plan metadata:** (this commit, following)

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/evals/scenarios.json` - 8 golden-scenario fixtures (D-01/D-03)
- `packages/pipeline/src/eisenbalm_pipeline/evals/loader.py` - `Scenario`/`ScoringTarget` Pydantic models + `list_scenarios`/`get_scenario`
- `packages/pipeline/src/eisenbalm_pipeline/evals/__init__.py` - Re-exports `Scenario`, `list_scenarios`, `get_scenario`
- `packages/pipeline/src/eisenbalm_pipeline/api/eval.py` - `GET /eval/scenarios` router (prefix `/eval`); leaves a section comment for Plan 03's `POST /eval/shadow-run`
- `packages/pipeline/src/eisenbalm_pipeline/api/main.py` - Imports + registers `eval_api.router`
- `packages/pipeline/tests/evals/test_scenario_loader.py` - 5 tests: all-8-validated, agentKey filter, id lookup, replicable-agentKey guardrail, unique ids
- `packages/pipeline/tests/api/test_eval_scenarios.py` - 3 tests: full response shape, agentKey filter, composed-app router registration
- `apps/dispatch-control/lib/evalScenarioClient.ts` - `fetchScenarios(agentKey?, token)` + `EvalScenario`/`EvalScoringTarget` types

## Decisions Made

- Golden-scenario agentKey mapping follows 38-RESEARCH.md's recommended resolution of Pitfall 5 exactly: the 4 scout scenarios + 1 advocate + 2 researcher + 1 bonus_spec_ad, with zero section-writer scenarios (origin_story/problem/founder_bio_*/case_study_* are architecturally untestable via test-run's flat-substitution model).
- `_require_operator` reused via direct cross-module import (`from eisenbalm_pipeline.api.agents import _require_operator`) rather than re-declared in `api/eval.py` — this is the first cross-module reuse of this dependency in the codebase (every other router, e.g. `control.py`, re-declares its own copy); reuse was chosen here because eval.py's auth semantics must stay byte-identical to agents.py's per the plan's explicit instruction ("import or re-declare the same pattern") and reuse eliminates any risk of the two drifting.
- `loader.py` has no module-level cache — re-parses `scenarios.json` on every `list_scenarios()`/`get_scenario()` call. Deliberate: the fixture set is tiny (8 entries), and an operator hand-editing the manifest (D-01's incremental-no-code-change design goal) sees the change immediately without a pipeline restart.

## Deviations from Plan

None - plan executed exactly as written. Both tasks followed the plan's action/verify/acceptance-criteria steps verbatim; no bugs, missing functionality, or blocking issues were encountered.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `GET /eval/scenarios` is live, registered, and returns the exact §38.1 shape — Plan 03 (shadow-run-discover-candidates) can extend `api/eval.py` with `POST /eval/shadow-run` in the same file (the section comment marks the spot).
- `evalScenarioClient.ts` is ready for Plan 05 (prompt-lab eval drawer) to call directly for D-04's auto-select-by-agentKey behavior; `EvalScenario`/`EvalScoringTarget` types match the pipeline's `Scenario`/`ScoringTarget` Pydantic models field-for-field.
- The 8-scenario starter set covers scout/advocate/researcher/bonus_spec_ad; expanding true section-writer coverage (origin_story etc.) remains an explicitly flagged open question (38-RESEARCH.md Pitfall 5) for a future plan, not silently in scope here.
- Full pipeline suite: 510 passed / 36 skipped (baseline preserved, +8 new green from this plan). `apps/dispatch-control` was NOT rebuilt/typechecked in full for this plan (Python-heavy plan, one small unused-so-far TS file); a raw `tsc --noEmit` run showed only PRE-EXISTING unrelated test-file errors (confirmed via grep: zero mentions of `evalScenarioClient` in the error output) — out of scope per CLAUDE.md SCOPE BOUNDARY. Plan 05 will exercise `evalScenarioClient.ts` from a real component and should run the full `pnpm --filter dispatch-control build` gate at that point.

---
*Phase: 38-prompt-lab-evals-eval-center*
*Completed: 2026-07-09*

## Self-Check: PASSED

All 9 created/modified files confirmed present on disk; all 4 commit hashes
(`646c891`, `0012dc1`, `b2024e7`, `cf33c59`) confirmed present in `git log`.
