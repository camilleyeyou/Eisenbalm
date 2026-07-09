---
phase: 38-prompt-lab-evals-eval-center
plan: 06
subsystem: ui
tags: [react, nextjs, convex, eval-center, drift-detector, shadow-run]

# Dependency graph
requires:
  - phase: 38-prompt-lab-evals-eval-center (plan 01)
    provides: "eval_scores Convex table + record/listForScenario/listForAgent (§38.2, D-09)"
  - phase: 38-prompt-lab-evals-eval-center (plan 02)
    provides: "GET /eval/scenarios endpoint + fetchScenarios(agentKey?, token) TS client (§38.1)"
  - phase: 38-prompt-lab-evals-eval-center (plan 03)
    provides: "POST /eval/shadow-run over the pure discover_candidates() extraction, isolation-proven server-side (§38.4, D-11/D-12)"
provides:
  - "Eval Center screen (eval-center/page.tsx) replacing the Phase 30 placeholder stub"
  - "ScenarioCard.tsx: per-scenario card — description + whatItCatches + max-ranAt eval_scores 'last result', 'never evaluated' empty state"
  - "DriftScoreboard.tsx: the append-only eval_scores TIME-SERIES per scenario (ranAt/promptVersion/source/overall) — the actual EVL-04 drift detector, not a single latest number"
  - "ShadowRunPanel.tsx + lib/shadowRunClient.ts: explicit-trigger read-only shadow-discovery preview over POST /eval/shadow-run, rendered inline (EVL-05 UI)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-only dashboard page with no Server Component wrapper: eval-center/page.tsx is 'use client' directly (mirrors voice-pass/page.tsx's precedent) since every piece of its data is Convex-subscription/fetch-driven and workspace_id is the single-tenant constant — no force-dynamic/getCurrentWorkspace() round-trip needed"
    - "Per-list-item child component for a dynamic useQuery list: DriftScoreboard renders one ScenarioDriftSeries child per scenario (each with its own listForScenario hook instance) instead of calling useQuery inside a .map() in one component body"
    - "Max-by-ranAt reduce (not 'last array item') for ScenarioCard's 'last result' — defensive against any future change to listForScenario's ordering guarantee"

key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/eval-center/_components/ScenarioCard.tsx
    - apps/dispatch-control/app/(dashboard)/eval-center/_components/DriftScoreboard.tsx
    - apps/dispatch-control/app/(dashboard)/eval-center/_components/ShadowRunPanel.tsx
    - apps/dispatch-control/lib/shadowRunClient.ts
    - apps/dispatch-control/__tests__/EvalCenter.test.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/eval-center/page.tsx

key-decisions:
  - "eval-center/page.tsx is a plain 'use client' component (no Server Component + getCurrentWorkspace() split, unlike Finance/Config/Registry/SignalDesk) — DEFAULT_WORKSPACE_ID is used directly, matching voice-pass/page.tsx's existing precedent for a page whose entire body is client-driven and single-tenant"
  - "ScenarioCard and DriftScoreboard both call listForScenario directly per Task 1's explicit instruction, rather than ScenarioCard reusing listForAgent — keeps both components independently correct if a scenario's agentKey ever has scenarios spread across drawer AND commit sources"

patterns-established:
  - "A card component showing a single collapsed metric (ScenarioCard) and a scoreboard component showing the FULL historical series (DriftScoreboard) both read the SAME query (listForScenario) but reduce it differently (max-by-ranAt vs. render-every-row) — the drift-detector distinction (D-10) is enforced by which component reduces the data, not by a different query shape"

requirements-completed: [EVL-04, EVL-05]

# Metrics
duration: ~20min
completed: 2026-07-09
---

# Phase 38 Plan 06: Eval Center — Drift Detector + Shadow Run Summary

**Eval Center built out from its Phase 30 placeholder into 8 golden-scenario cards (description + whatItCatches + last result), an append-only eval_scores time-series scoreboard per scenario, and a read-only Shadow Run panel triggering POST /eval/shadow-run with an inline candidate preview.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-09
- **Tasks:** 2 (Task 1 TDD: RED → GREEN; Task 2 auto)
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments

- `eval-center/page.tsx` no longer renders `PlaceholderScreen` — it fetches all golden scenarios once via `fetchScenarios(undefined, token)` (D-01, repo-fixture-sourced) and renders a `ScenarioCard` grid, a `DriftScoreboard`, and a `ShadowRunPanel`.
- `ScenarioCard.tsx` shows each scenario's `agentKey`/id chip, `description`, `whatItCatches`, and its "last result" — the eval_scores row with the highest `ranAt` for that `scenarioId` (via `listForScenario`, reduced with a max-by-`ranAt` fold, not "last array item"). A scenario with zero rows shows a "Never evaluated" empty state instead of crashing.
- `DriftScoreboard.tsx` is the actual EVL-04 drift detector: for every scenario it renders the FULL append-only `eval_scores` history (ranAt, promptVersion, source, overall) as a table — proven by a dedicated test asserting **two** historical points render for a scenario that has two rows, not a collapsed single number. Each scenario gets its own `listForScenario` hook instance via a per-item `ScenarioDriftSeries` child component (correct React pattern for a dynamic per-item subscription list).
- `ShadowRunPanel.tsx` + `lib/shadowRunClient.ts` (`runShadow(token)`) trigger `POST /eval/shadow-run` on an explicit button click only (never on mount), showing a loading state and rendering the returned candidates (name/focusArea/scoutSummary) inline, with a "read-only preview" label reflecting the D-11/D-12 isolation contract already proven server-side in Plan 38-03.
- 3/3 new tests green in `EvalCenter.test.tsx`; full `apps/dispatch-control` vitest suite 494 passed / 2 todo (59 files + 1 skipped, +3 net from the 38-05 baseline of 491, zero regressions); `pnpm --filter dispatch-control build` exits 0 (strict type-check); `pnpm --filter @eisenbalm/convex typecheck` clean.

## Task Commits

Each task was committed atomically (Task 1 TDD: RED → GREEN):

1. **Task 1: Eval Center page + ScenarioCard + DriftScoreboard (EVL-04)** - `4b3620e` (test, RED) → `6c25834` (feat, GREEN)
2. **Task 2: ShadowRunPanel + shadowRunClient + strict build (EVL-05 UI)** - `8ec0031` (feat)

**Plan metadata:** (this commit, following)

## Files Created/Modified

- `apps/dispatch-control/app/(dashboard)/eval-center/page.tsx` - Replaces the placeholder stub; `'use client'` page fetching scenarios once and mounting ScenarioCard grid + DriftScoreboard + ShadowRunPanel
- `apps/dispatch-control/app/(dashboard)/eval-center/_components/ScenarioCard.tsx` - Per-scenario card: description + whatItCatches + max-ranAt "last result" (or "never evaluated")
- `apps/dispatch-control/app/(dashboard)/eval-center/_components/DriftScoreboard.tsx` - The append-only eval_scores TIME-SERIES render per scenario (ranAt/promptVersion/source/overall table) — the drift detector
- `apps/dispatch-control/app/(dashboard)/eval-center/_components/ShadowRunPanel.tsx` - "Shadow run" card: explicit trigger button, loading/error states, inline candidate preview
- `apps/dispatch-control/lib/shadowRunClient.ts` - `runShadow(token)` client for `POST /eval/shadow-run`, mirroring `testRunClient.ts`'s base-URL/bearer/error-handling shape
- `apps/dispatch-control/__tests__/EvalCenter.test.tsx` - 3 tests: scenario cards render description/whatItCatches/max-ranAt last-result; DriftScoreboard renders >=2 historical points (not a single number); a never-evaluated scenario renders gracefully

## Decisions Made

- `eval-center/page.tsx` was written as a plain `'use client'` component rather than following the Server-Component-resolves-`workspace_id` split used by Finance/Config/Registry/SignalDesk. Since `getCurrentWorkspace()` is a single-tenant constant lookup and every piece of this screen's actual data (scenarios via fetch, eval_scores via Convex) is client-driven, this mirrors the existing `voice-pass/page.tsx` precedent (also a fully client dashboard page with no `force-dynamic` wrapper) rather than introducing an unnecessary extra file to satisfy the plan's "keep the file count within budget" note. `next build`'s route table confirms `/eval-center` still prerenders fine as a static (`○`) route, same as `/voice-pass`.
- `ScenarioCard` and `DriftScoreboard` both call `listForScenario` directly (per Task 1's explicit instruction) rather than `ScenarioCard` reusing `listForAgent` — keeps the two components' data sources independently obvious and matches the plan's key_links (`ScenarioCard` -> `listForScenario` for "last result" by max-`ranAt`; `DriftScoreboard` -> `listForScenario` for the full series).

## Deviations from Plan

None - plan executed exactly as written. Both tasks followed the plan's action/verify/acceptance-criteria steps verbatim; no bugs, missing functionality, or blocking issues were encountered. (One in-flight self-correction: an early draft of page.tsx's doc comment literally said "PlaceholderScreen", which the acceptance grep interprets as "stub not fully replaced" — caught immediately by running the acceptance grep before committing and reworded to "placeholder stub"; not a deviation from the plan's substance, just wording.)

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The Shadow Run panel reuses the same pipeline auth/env configuration (`NEXT_PUBLIC_PIPELINE_URL`, Clerk bearer) already required for Test Run / the eval drawer.

## Next Phase Readiness

- Phase 38 (prompt-lab-evals-eval-center) is now fully implemented across all 6 plans: contract + eval_scores foundation (38-01), golden scenarios endpoint (38-02), shadow-run discover-candidates (38-03), commit-gate override (38-04), the Prompt Lab eval drawer (38-05), and this Eval Center build-out (38-06).
- All EVL-01..EVL-05 requirements are code-complete. The 38-VALIDATION.md "Manual-Only Verifications" table lists 5 live/visual checks (eval drawer auto-select + deltas, commit gate block + override, commit gate clean pass, Eval Center drift time-series growth, shadow-run isolation) that remain for a live operator pass — none of them are automatable without live model/search calls, and none block this plan's own completion.
- Full `apps/dispatch-control` vitest suite: 494 passed / 2 todo across 59 files + 1 skipped file (baseline from 38-05 was 491 passed — net +3, zero regressions). `pnpm --filter dispatch-control build` exits 0 (strict type-check). `pnpm --filter @eisenbalm/convex typecheck` clean. Pipeline (Python) suite untouched — this plan is frontend-only, no `packages/pipeline` files modified.

---
*Phase: 38-prompt-lab-evals-eval-center*
*Completed: 2026-07-09*

## Self-Check: PASSED

All 6 created/modified files confirmed present on disk; all 3 commit hashes
(`4b3620e`, `6c25834`, `8ec0031`) confirmed present in `git log`.
