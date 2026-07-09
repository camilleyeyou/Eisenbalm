---
phase: 38-prompt-lab-evals-eval-center
plan: 01
subsystem: database
tags: [convex, contract-first, append-only, time-series, eval]

# Dependency graph
requires:
  - phase: 24-prompt-versioning-diff-history
    provides: prompt_versions table + activate mutation (the gate this phase extends)
  - phase: 28-prompt-console
    provides: test-run/score endpoints + TestRunPanel draft-vs-active pattern (the eval primitives)
provides:
  - "§38 contract in docs/API_CONTRACTS.md: GET /eval/scenarios, eval_scores table shape, promptVersions.activate eval-gate+override, POST /eval/shadow-run isolation contract"
  - "eval_scores Convex table (append-only time-series)"
  - "convex/evalScores.ts: record (requireOperator mutation) + listForScenario + listForAgent (queries)"
affects: [38-02, 38-03, 38-04, 38-05, 38-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contract-first: full four-surface §38 written to docs/API_CONTRACTS.md before any implementing code (CLAUDE.md hard rule)"
    - "Append-only Convex table (eval_scores) mirroring audit_log/deliberationEvents — insert-only, time-series is the record of truth"
    - "Dashboard-only Convex mutation (requireOperator, no pipelineSecret) mirroring prompt_versions/audit_log — no pipeline round-trip for eval_scores writes"

key-files:
  created:
    - convex/evalScores.ts
    - apps/dispatch-control/__tests__/evalScores.test.ts
  modified:
    - docs/API_CONTRACTS.md
    - convex/schema.ts
    - apps/dispatch-control/vitest.config.ts
    - convex/_generated/api.d.ts

key-decisions:
  - "listForScenario/listForAgent order via the Convex index's native .order('asc'|'desc'), not a manual JS sort on ranAt — avoids flaky tie-breaking when two rows share a millisecond timestamp (Convex breaks ties on _creationTime)"

patterns-established:
  - "Append-only invariant enforced by a source-scan test (regex on evalScores.ts source) — no ctx.db.patch/delete permitted in this module"

requirements-completed: [EVL-04]

# Metrics
duration: ~20min
completed: 2026-07-09
---

# Phase 38 Plan 01: Contract + Eval-Scores Foundation Summary

**§38 four-surface contract amendment to API_CONTRACTS.md, plus the append-only `eval_scores` Convex time-series table + its `requireOperator`-guarded `record`/`listForScenario`/`listForAgent` surface.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-09
- **Tasks:** 2 (Task 2 was TDD: RED → GREEN → post-verification fix)
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `docs/API_CONTRACTS.md` §38 documents all four Phase-38 contract surfaces (GET /eval/scenarios, the eval_scores table, the promptVersions.activate eval-gate + override, POST /eval/shadow-run) BEFORE any of that code exists — the CLAUDE.md contract-first hard rule, satisfied up front for the whole phase.
- `eval_scores` Convex table lands in `convex/schema.ts` with the exact D-09 row shape and four indexes (including `by_workspace_agentKey_version`, which the §38.3 gate will read).
- `convex/evalScores.ts` ships `record` (append-only insert, `requireOperator`-guarded), `listForScenario` (ascending time-series), and `listForAgent` (newest-first for scenario-card "last result").
- 5/5 tests green in `evalScores.test.ts`, covering insert+read round-trip, the append-only invariant (two calls → two rows, plus a source-scan asserting no `patch`/`delete` calls exist in the module), and the `requireOperator` auth guard.

## Task Commits

Each task was committed atomically:

1. **Task 1: Amend docs/API_CONTRACTS.md with §38** - `9bed980` (docs)
2. **Task 2: eval_scores table + convex/evalScores.ts** - `d488068` (test, RED) → `0b2af8d` (feat, GREEN) → `ecba06c` (fix, Rule 1 auto-fix — see Deviations)

**Plan metadata:** (this commit, following)

## Files Created/Modified

- `docs/API_CONTRACTS.md` - New `## §38` section (4 subsections: `GET /eval/scenarios`, `eval_scores` table, `promptVersions.activate` eval-gate+override, `POST /eval/shadow-run`), inserted after §37.4 and before "Error handling rules"
- `convex/schema.ts` - New `eval_scores: defineTable(...)` (append-only, 4 indexes), placed immediately after `prompt_versions`
- `convex/evalScores.ts` - New file: `record` mutation (requireOperator, insert-only), `listForScenario` query (ascending), `listForAgent` query (descending)
- `apps/dispatch-control/__tests__/evalScores.test.ts` - New file: 5 tests covering the append-only contract
- `apps/dispatch-control/vitest.config.ts` - Added `evalScores.test.ts` to `environmentMatchGlobs` (edge-runtime, required by convex-test) — blocking fix, see Deviations
- `convex/_generated/api.d.ts` - Regenerated via `pnpm --filter @eisenbalm/convex codegen` to add the `evalScores` module entry (2-line additive diff, `api.js` unchanged since it uses `anyApi`)

## Decisions Made

- `listForScenario`/`listForAgent` order by the Convex query builder's native `.order('asc' | 'desc')` against the index, exactly as the plan specified — NOT a manual `Array.prototype.sort` on the `ranAt` field. This was corrected mid-verification (see Deviations) once a manual-sort implementation proved flaky.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registered `evalScores.test.ts` in vitest's `environmentMatchGlobs`**
- **Found during:** Task 2 (writing/running the RED test)
- **Issue:** The plan's file list didn't include `vitest.config.ts`, but every existing convex-test integration test (`auditLog.test.ts`, `convexAuthLockdown.test.ts`, etc.) is explicitly routed to the `edge-runtime` environment via `environmentMatchGlobs` — without this entry, `convexTest(...)` would run under the default `node` environment and fail.
- **Fix:** Added `['__tests__/evalScores.test.ts', 'edge-runtime']` to `apps/dispatch-control/vitest.config.ts`, mirroring the existing entries verbatim.
- **Files modified:** `apps/dispatch-control/vitest.config.ts`
- **Verification:** `npx vitest run __tests__/evalScores.test.ts` runs and (once implemented) passes.
- **Committed in:** `d488068` (Task 2 RED commit)

**2. [Rule 1 - Bug] Fixed flaky descending/ascending order in listForScenario/listForAgent**
- **Found during:** Task 2 post-implementation verification (re-running the test suite standalone surfaced a failure not seen in the first combined run)
- **Issue:** The initial implementation collected rows via the index and did a manual `Array.prototype.sort` keyed on the `ranAt` field (`Date.now()`). Two rows recorded in rapid succession within a test can land in the exact same millisecond, making the `ranAt`-keyed comparator return `0` for that pair — a stable sort then preserves original (ascending) insertion order regardless of the requested direction, so `listForAgent`'s "newest-first" guarantee silently broke on ties. This reproduced on ~1 in a few runs.
- **Fix:** Replaced both manual sorts with the Convex query builder's native `.order('asc')` / `.order('desc')` against the already-selected index, exactly as the plan's task description specified ("newest-first `.order('desc')`"). Convex indexes always tie-break on the document's `_creationTime` (unique, monotonic per insert), which removes the ambiguity entirely.
- **Files modified:** `convex/evalScores.ts`
- **Verification:** Re-ran `evalScores.test.ts` 5 times in a row post-fix — all green every time (previously flaky). Full `apps/dispatch-control` vitest suite (478 tests) and `pnpm --filter dispatch-control build` both re-verified green after the fix.
- **Committed in:** `ecba06c`

---

**Total deviations:** 2 auto-fixed (1 blocking config fix, 1 bug fix)
**Impact on plan:** Both fixes were necessary for the test suite to run at all (Rule 3) and to be deterministically correct (Rule 1) respectively. No scope creep — the plan's specified query shape (`.order('desc')`) was followed once the bug was caught.

## Issues Encountered

None beyond the two auto-fixes documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The §38 contract is now the fixed reference for Plans 38-02..38-06 (golden scenarios, eval drawer, commit gate, Eval Center, shadow run) — no field name, endpoint path, or gate predicate may be invented later; they must match §38.1-§38.4 verbatim.
- `eval_scores` + `evalScores.ts` are ready for the eval drawer (writes with `source: 'drawer'`) and the commit-gate check (reads via `by_workspace_agentKey_version`, writes with `source: 'commit'`) to build on directly.
- `api/eval.py` (the pipeline router for `GET /eval/scenarios` and `POST /eval/shadow-run`) does not exist yet — that is explicitly out of scope for this plan and lands in a later Phase 38 plan per the RESEARCH.md project structure.
- Full `apps/dispatch-control` vitest suite (478 passed, 1 skipped) and `pnpm --filter dispatch-control build` (exit 0) both green as of the final commit — no regressions introduced.

---
*Phase: 38-prompt-lab-evals-eval-center*
*Completed: 2026-07-09*

## Self-Check: PASSED

All created/modified files confirmed present on disk; all 4 commit hashes
(`9bed980`, `d488068`, `0b2af8d`, `ecba06c`) confirmed present in `git log`.
