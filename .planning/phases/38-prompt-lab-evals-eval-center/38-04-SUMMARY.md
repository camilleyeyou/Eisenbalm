---
phase: 38-prompt-lab-evals-eval-center
plan: 04
subsystem: database
tags: [convex, prompt-versioning, eval-gate, audit-log, override]

# Dependency graph
requires:
  - phase: 38-prompt-lab-evals-eval-center
    provides: "Plan 01 — eval_scores Convex table + by_workspace_agentKey_version index (the gate's read source)"
  - phase: 24-prompt-versioning-diff-history
    provides: "convex/promptVersions.ts::activate — the existing {blocked,reason} commit chokepoint this plan extends"
provides:
  - "§38.3 eval-gate + override(reason) on convex/promptVersions.ts::activate — EVL-03 server-enforced commit gate"
  - "VersionHistoryPanel.tsx override-with-reason UI (typed justification input + 'Commit anyway' button)"
affects: [38-05, 38-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate-then-override mutation shape: a blocking guard clause returns {blocked, reason}; an optional override:{reason} arg skips ONE specific guard (never an earlier, unconditional guard) and logs an additional audit row alongside the normal one"
    - "Freshness-guarded read-your-own-writes gate: compares eval_scores rows filtered to ranAt >= the target row's own createdAt, so a stale score for old prompt text can never pass the gate for a newer version"

key-files:
  created: []
  modified:
    - convex/promptVersions.ts
    - apps/dispatch-control/__tests__/promptVersionsEvalGate.test.ts
    - apps/dispatch-control/__tests__/activate.test.ts
    - apps/dispatch-control/vitest.config.ts
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx"

key-decisions:
  - "The eval gate is skipped (not just passed) when there's no currently-active version for the agentKey (first-ever activation) OR when the target version IS the currently-active version (no-op reactivation) — both cases have nothing to regress against, matching §38.3's 'first-ever activation always passes' rule and avoiding a spurious freshness block on a no-op re-click"
  - "Regression/aggregate comparison uses the MOST-RECENTLY-RUN eval_scores row per scenarioId on each side (not first-seen, not all rows summed) so re-running a scenario always reflects the latest score, not a stale earlier one"
  - "Only scenarios present on BOTH the target and active side are compared — a scenario with no active-side score simply isn't part of the regression/aggregate check (freshness is still required on the target side regardless)"

patterns-established:
  - "Dual audit-row write on override: 'prompt_version.activate_override' (carries the reason) is written FIRST, then the normal 'prompt_version.activated' row — both persist, matching the phase's 'nothing silent' house rule"

requirements-completed: [EVL-03]

# Metrics
duration: ~20min
completed: 2026-07-09
---

# Phase 38 Plan 04: Commit Gate + Override Summary

**`convex/promptVersions.ts::activate` now blocks a prompt-version commit on a stale/regressed/not-up eval score (reading the Plan-01 `eval_scores` table), with a logged `override:{reason}` escape hatch that skips only the eval gate — never the pre-existing in-progress-run guard — and `VersionHistoryPanel.tsx` surfaces both the block and the override affordance.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-09
- **Completed:** 2026-07-09
- **Tasks:** 2 (Task 1 was TDD: RED → GREEN, plus an anticipated auto-fix to a pre-existing test)
- **Files modified:** 5 (0 created, 5 modified)

## Accomplishments

- `activate()`'s existing `{blocked, reason}` in-progress-run guard is untouched and still checked FIRST, unconditionally — the eval gate and its override can never reach it.
- New §38.3 eval gate reads `eval_scores` via the `by_workspace_agentKey_version` index for both the target version being committed and the currently-active version: freshness-guarded (target needs a row with `ranAt >= target.createdAt`), blocks on any paired scenario regressing beyond `EVAL_REGRESSION_TOLERANCE = 0.5` (0-10 scale), and blocks if the paired-scenario average is lower for the target.
- `override: { reason: string }` skips the eval-gate block only; on use, activation proceeds and BOTH an `activate_override` audit row (carrying the reason) and the normal `activated` audit row are written — never one instead of the other.
- `promptVersionsEvalGate.test.ts` — 6/6 green, covering every §38.3 behavior named in the plan (regression block, pass-when-fresh-and-up, stale/missing-freshness block, override bypass + dual audit rows, in-progress guard winning over an override, first-activation always passing).
- `VersionHistoryPanel.tsx` now shows a typed-reason input + "Commit anyway (override)" button whenever a version is blocked by the eval gate, gated on `!runInProgress` so the override is never offered while the in-progress guard is active.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend promptVersions.activate with the eval gate + override (RED)** - `3595d6b` (test)
2. **Task 1: Extend promptVersions.activate with the eval gate + override (GREEN)** - `5ed864a` (feat — includes the anticipated auto-fix to `activate.test.ts`, see Deviations)
3. **Task 2: Surface the gate + override-with-reason in VersionHistoryPanel** - `46f2830` (feat)

**Plan metadata:** (this commit, following)

## Files Created/Modified

- `convex/promptVersions.ts` - `activate` gains an optional `override: v.optional(v.object({ reason: v.string() }))` arg and a new `evaluateEvalGate()` helper (freshness + regression + aggregate checks against `eval_scores`); the in-progress-run guard and its early return are byte-unchanged and still run first; the gate is skipped when there's no active version or the target IS the active version; a red gate can be bypassed via `override.reason`, writing an `activate_override` audit row before the normal `activated` row; return shape gains `{ blocked: false, overridden: true }` on the override path
- `apps/dispatch-control/__tests__/promptVersionsEvalGate.test.ts` - New file: 6 tests covering every §38.3 behavior via the convex-test harness (seeded `prompt_versions` + `eval_scores` rows, `t.withIdentity(...).mutation(...)`)
- `apps/dispatch-control/__tests__/activate.test.ts` - Existing "activate flips isActive when no run is running and audits it" test now seeds a fresh, non-regressing `eval_scores` row for v2 so it continues to exercise ONLY the D-02 in-progress guard (see Deviations)
- `apps/dispatch-control/vitest.config.ts` - Added `['__tests__/promptVersionsEvalGate.test.ts', 'edge-runtime']` to `environmentMatchGlobs` (convex-test requirement, mirrors the Plan 38-01 entry)
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx` - `handleActivate` accepts an optional `override` param; new `blockedVersion` + `overrideReason` state; a typed-reason input + "Commit anyway (override)" button renders when a version is blocked and no run is in progress; submitting re-calls `activate` with `override: { reason }` and clears blocked state on a non-blocked (including `overridden: true`) response

## Decisions Made

- The eval gate is skipped entirely (not evaluated-and-passed) for two cases: no currently-active version for the agentKey (first-ever activation, per §38.3) and reactivating the version that's already active (a no-op with nothing to regress against — not named in §38.3 but logically required to avoid a spurious freshness block, and needed to keep an existing `convexAuthLockdown.test.ts` assertion green without modification).
- Per-scenario comparison uses each side's MOST-RECENTLY-RUN score (max `ranAt`), not the first-seen row, so a scenario that was re-run after an initial bad score reflects the latest result — this matters because `eval_scores` is append-only (Plan 01) and a scenario can accumulate multiple rows per version.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Seeded a fresh eval_scores row for v2 in a pre-existing activate.test.ts assertion**
- **Found during:** Task 1 (post-GREEN full-suite verification)
- **Issue:** The new eval gate applies whenever a currently-active version exists for the agentKey. The pre-existing `activate.test.ts` test "activate flips isActive when no run is running and audits it" seeds v1 (active) + v2 (inactive, no eval_scores) and expects `activate(v2)` to succeed — after this plan's change, that call now correctly blocks on the freshness guard (v2 has zero eval_scores rows), since this test's whole point (verifying the D-02 in-progress guard + successful flip + audit) is a DIFFERENT concern from the new eval gate (already covered exhaustively by `promptVersionsEvalGate.test.ts`).
- **Fix:** Seeded one fresh, non-regressing `eval_scores` row for v2 (`overall: 8.0`, `ranAt` far in the future to guarantee freshness regardless of clock jitter) directly in the test via `t.run(ctx => ctx.db.insert(...))`, so the test again exercises only the in-progress guard + flip + audit path it was written for.
- **Files modified:** `apps/dispatch-control/__tests__/activate.test.ts`
- **Verification:** `npx vitest run __tests__/activate.test.ts __tests__/convexAuthLockdown.test.ts __tests__/promptVersionsEvalGate.test.ts __tests__/evalScores.test.ts` — 24/24 green; full `apps/dispatch-control` suite re-run afterward, 484/484 (+2 todo, +2 skipped) green.
- **Committed in:** `5ed864a` (Task 1 GREEN commit, same commit as the gate implementation — the fix and the change that necessitated it are inseparable)

---

**Total deviations:** 1 auto-fixed (1 bug — a pre-existing test's fixture needed eval coverage once the gate it now incidentally exercises became live)
**Impact on plan:** Necessary for the full test suite to stay green; no scope creep — the fix only adds a fixture row to an existing test, it does not change what that test asserts.

## Issues Encountered

None beyond the one auto-fix documented above. `convexAuthLockdown.test.ts`'s "succeeds with a Clerk identity" case (which reactivates the already-active v1 with zero eval_scores) needed no change — the "target === currently-active version" gate-skip decision (see Decisions Made) covers it without any test modification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `promptVersions.activate`'s `{blocked, reason}` / `{blocked, overridden}` contract is now the fixed shape for Plan 38-05 (the eval drawer) to call after running scenarios and recording `eval_scores` with `source: 'commit'` before the operator commits.
- `VersionHistoryPanel.tsx`'s override affordance is intentionally minimal (inline input + button, no modal) — Plan 38-05/38-06 may want to route the drawer's own "commit" action through the same `activate` call with the same override contract rather than duplicating logic.
- Full `apps/dispatch-control` vitest suite (484 passed, 2 todo, 2 skipped across 57 files + 1 skipped file) and `pnpm --filter dispatch-control build` (exit 0, strict type-check) both green as of the final commit — no regressions introduced. `pnpm --filter @eisenbalm/convex typecheck` also clean.

---
*Phase: 38-prompt-lab-evals-eval-center*
*Completed: 2026-07-09*

## Self-Check: PASSED

All created/modified files confirmed present on disk; all 3 commit hashes
(`3595d6b`, `5ed864a`, `46f2830`) confirmed present in `git log`.
