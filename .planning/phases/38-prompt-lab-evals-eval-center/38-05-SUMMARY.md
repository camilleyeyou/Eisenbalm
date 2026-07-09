---
phase: 38-prompt-lab-evals-eval-center
plan: 05
subsystem: ui
tags: [react, nextjs, convex, prompt-lab, evals, eval-drawer]

# Dependency graph
requires:
  - phase: 38-prompt-lab-evals-eval-center (plan 01)
    provides: eval_scores Convex table + record/listForScenario/listForAgent (§38.2)
  - phase: 38-prompt-lab-evals-eval-center (plan 02)
    provides: GET /eval/scenarios endpoint + fetchScenarios(agentKey?, token) TS client (D-01/D-04 source)
  - phase: 38-prompt-lab-evals-eval-center (plan 04)
    provides: "§38.3 eval gate on promptVersions.activate (reads eval_scores by_workspace_agentKey_version, freshness-guarded) + VersionHistoryPanel override-with-reason UI this plan builds the producer next to"
provides:
  - "EvalDrawer.tsx: auto-selects an agent's golden scenarios (D-04), runs each through the existing test-run -> score primitive against BOTH the draft and the active version (D-05), renders a per-scenario draft/active/delta scoreboard + aggregate summary, and persists every scored side to eval_scores"
  - "targetVersion prop / freshness-producer mode: tags the draft-side eval_scores row promptVersion=String(N), source='commit' instead of 'draft'/'drawer' — the exact shape §38.3's gate requires"
  - "EvalDrawer mounted in AgentPromptEditorView's editing pane (normal iteration loop, no targetVersion)"
  - "'Run evals for v{N}' producer on VersionHistoryPanel's non-active version rows — mounts EvalDrawer with that version's saved content + targetVersion, closing the plan-review Blocker 1 (every commit after the first would otherwise force-block into the override escape hatch)"
affects: [38-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "N-scenario scaling of an existing 1-scenario draft-vs-active pattern: EvalDrawer reuses TestRunPanel's runAgentTest/runActiveVersionTest -> scoreOutput sequence verbatim, looped sequentially per scenario with per-row status (idle/running/done/error) so one scenario's failure never blocks the rest"
    - "Prop-driven eval_scores tagging: a single optional `targetVersion` prop switches the SAME run loop's draft-side persistence between the normal iteration tag ('draft'/'drawer') and the commit-freshness tag (String(N)/'commit') — no duplicated run logic between the two modes"
    - "mergeRow(prev, scenario, patch) helper for React state updates over a Record<string, T> keyed by scenario id — guarantees a fully-typed row even before TypeScript can prove prev[id] is seeded, avoiding an SetStateAction inference failure caught by the strict build"

key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/EvalDrawer.tsx
    - apps/dispatch-control/__tests__/EvalDrawer.test.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AgentPromptEditorView.tsx
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx

key-decisions:
  - "The auto-select fetch effect depends on [agentKey] only, never on getToken or draftPrompt/targetVersion — avoids re-fetching scenarios (or worse, an unstable-mock-driven effect loop in tests) on every keystroke in the editor, and guarantees scoring never fires except on the explicit button click (Pitfall 3 cost containment)"
  - "The active side of every run is ALWAYS tagged source:'drawer', promptVersion:String(active.version) regardless of targetVersion — only the draft side's tag depends on the mode, since the active version is never the thing being committed"
  - "VersionHistoryPanel's producer toggles an inline EvalDrawer (expand/collapse per row) rather than a modal or separate route — reuses the exact same component as the normal iteration loop with zero duplicated eval-running logic"

patterns-established:
  - "Data-testid-scoped assertions (eval-row-{id}, eval-row-draft-{id}, eval-aggregate-*) for a component whose per-row text (\"draft 8.5\") would otherwise ambiguously match at multiple DOM levels under RTL's text-node matching"

requirements-completed: [EVL-02, EVL-03]

# Metrics
duration: ~25min
completed: 2026-07-09
---

# Phase 38 Plan 05: Prompt Lab Eval Drawer Summary

**EvalDrawer.tsx auto-selects an agent's golden scenarios and runs an N-scenario draft-vs-active scoreboard (reusing the existing test-run→score client loop), persisting every scored run to `eval_scores`; a new "Run evals for v{N}" producer on non-active VersionHistoryPanel rows writes the commit-tagged rows the 38-04 gate needs, closing the plan-review blocker that would otherwise force every post-v1 commit into the override path.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-09
- **Tasks:** 3 (Task 1 TDD: RED-equivalent test-first, then GREEN; Tasks 2-3 auto)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `EvalDrawer.tsx` fetches `fetchScenarios(agentKey, token)` on mount/agentKey change (D-04 auto-select, no manual picker), and on an explicit "Run evals (N scenarios · ~4N model calls)" click runs each scenario sequentially through `runAgentTest`→`scoreOutput` (draft) and, when an active version exists, `runActiveVersionTest`→`scoreOutput` (active) — exactly TestRunPanel's existing 1-scenario draft-vs-active pattern scaled to N (D-05). Each scenario row shows draft/active/signed-delta (cobalt up / vermilion down, 1c tokens); an aggregate summary (avg draft, avg active, avg delta) sits above the rows.
- Every scored side is persisted via `useMutation(api.evalScores.record)` — 2 calls per scenario (draft + active) when an active version exists. The draft side's tag depends on the new optional `targetVersion` prop: absent → `promptVersion:'draft'`, `source:'drawer'` (normal iteration); present → `promptVersion:String(targetVersion.version)`, `source:'commit'` (freshness-producer mode). The active side is always `promptVersion:String(active.version)`, `source:'drawer'`.
- Scoring runs ONLY on the explicit button click — never on mount, never on an `agentKey`/`draftPrompt` prop change (verified by a dedicated test that reruns after a `draftPrompt` change and asserts zero `runAgentTest`/`scoreOutput` calls).
- `AgentPromptEditorView.tsx` mounts `<EvalDrawer>` directly below `<TestRunPanel>` in the editing branch, wired to the live unsaved draft, with no `targetVersion` (the normal iteration loop).
- `VersionHistoryPanel.tsx` gains a "Run evals for v{N}" toggle on every NON-active version row (absent on the active row). Clicking it expands an inline `<EvalDrawer draftPrompt={version.content} targetVersion={{version: N}}>` — the producer that writes the commit-tagged `eval_scores` rows the 38-04 gate's `evaluateEvalGate` reads via `by_workspace_agentKey_version` before allowing `activate(N)` to pass on its non-override path. This closes the plan-review Blocker 1: without it, no fresh scored row would ever exist for a version about to be committed, and every commit after the first would force-block into the override escape hatch.
- 7/7 new tests green in `__tests__/EvalDrawer.test.tsx` (5 for EvalDrawer's own behavior + 2 for the VersionHistoryPanel producer); full `apps/dispatch-control` vitest suite 491 passed / 2 todo (58 files, +7 net from this plan, zero regressions from the 38-04 baseline of 484); `pnpm --filter dispatch-control build` exits 0 (strict type-check); `pnpm --filter @eisenbalm/convex typecheck` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: EvalDrawer.tsx — auto-select + N-scenario scoreboard + eval_scores persistence** - `7a327f4` (feat)
2. **Task 2: Mount EvalDrawer in AgentPromptEditorView (editing pane) + strict build** - `3c56b8f` (feat — includes the anticipated `mergeRow` type-fix, see Deviations)
3. **Task 3: "Run evals for v{N}" freshness producer on non-active version rows** - `7c6043c` (feat)

**Plan metadata:** (this commit, following)

## Files Created/Modified

- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/EvalDrawer.tsx` - Auto-select-by-agentKey + N-scenario draft-vs-active scoreboard + eval_scores persistence, with the `targetVersion` freshness-producer mode
- `apps/dispatch-control/__tests__/EvalDrawer.test.tsx` - 7 tests: 5 for EvalDrawer's own behavior (auto-select, no-auto-run, scoreboard render, eval_scores call count/args, targetVersion tagging) + 2 for the VersionHistoryPanel producer (button visibility, click-through wiring)
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AgentPromptEditorView.tsx` - Mounts `<EvalDrawer>` below `<TestRunPanel>` in the editing branch
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx` - "Run evals for v{N}" toggle + inline `<EvalDrawer targetVersion={...}>` on non-active version rows

## Decisions Made

- The scenario auto-select `useEffect` depends on `[agentKey]` only (not `getToken`), matching TestRunPanel's existing pattern of calling `getToken()` fresh inside handlers rather than storing it as an effect dependency — avoids both an unnecessary re-fetch on every render and a potential infinite-effect risk if a test's mocked `useAuth()` returns a new object identity each call.
- `mergeRow()` was introduced (see Deviations) as the single point where a `Record<string, ScenarioRow>` state update is guaranteed fully-typed, rather than sprinkling `!` non-null assertions at each of the 3 `setRows` call sites.
- The VersionHistoryPanel producer toggles the SAME `EvalDrawer` component inline (expand/collapse) rather than introducing a second, simplified drawer variant — this guarantees the freshness-producer path exercises byte-identical run/scoring/persistence logic to the normal iteration path, with only the `targetVersion` prop differing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added a `mergeRow` helper to fix a TypeScript strict-build failure in `setRows` updates**
- **Found during:** Task 2 (`pnpm --filter dispatch-control build` strict type-check)
- **Issue:** All 3 `setRows(prev => ({...prev, [scenario.id]: {...prev[scenario.id], ...patch}}))` call sites in `EvalDrawer.tsx` spread `prev[scenario.id]`, which TypeScript types as possibly-`undefined` (a `Record<string, T>` index access), producing an object whose `scenario` field is typed optional — not assignable to the `Record<string, ScenarioRow>` state type. `next build`'s strict type-check failed with a `SetStateAction` mismatch.
- **Fix:** Added a `mergeRow(prev, scenario, patch)` helper that falls back to a fresh idle row when `prev[scenario.id]` is unset, always returning a fully-typed `ScenarioRow`; rewired all 3 call sites (running/done/error transitions) to use it.
- **Files modified:** `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/EvalDrawer.tsx`
- **Verification:** `pnpm --filter dispatch-control build` exits 0; `npx vitest run __tests__/EvalDrawer.test.tsx` still 5/5 green after the fix.
- **Committed in:** `3c56b8f` (Task 2 commit — found during this task's own verify step, on a file created in Task 1)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for the strict build to pass; no behavior change (the runtime logic is identical, only the TypeScript typing of the state-update helper changed) and no scope creep.

## Issues Encountered

- RTL's `toBeInTheDocument()` matcher is not available in this codebase (`@testing-library/jest-dom` is a devDependency but never registered as a global setup import) — every prior component test in this repo uses `toBeDefined()`/`toBeNull()` instead. `EvalDrawer.test.tsx` was written to match that existing house convention rather than adding a new jest-dom import.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The plan-review Blocker 1 (38-04's eval gate having no producer of fresh, target-version-tagged `eval_scores` rows) is now closed: an operator can run "Run evals for v{N}" on any saved non-active version before activating it, giving the gate a fresh `source:'commit'` row to pass on its intended non-override path.
- `EvalDrawer.tsx` is a self-contained, reusable component (workspaceId/agentKey/draftPrompt/targetVersion? props only) — Plan 38-06 (Eval Center) can mount it or reuse its scenario-fetch/run/persist logic if the Eval Center needs an equivalent on-demand run affordance, though 38-06's own scope is scenario cards + the drift time-series (reading `eval_scores`, not writing it).
- Full `apps/dispatch-control` vitest suite: 491 passed / 2 todo across 58 files + 1 skipped file (baseline from 38-04 was 484 passed — net +7, zero regressions). `pnpm --filter dispatch-control build` exits 0 (strict type-check). `pnpm --filter @eisenbalm/convex typecheck` clean. Pipeline (Python) suite untouched — this plan is frontend-only, no pipeline files modified.

---
*Phase: 38-prompt-lab-evals-eval-center*
*Completed: 2026-07-09*

## Self-Check: PASSED

All 5 created/modified files confirmed present on disk; all 3 task commit
hashes (`7a327f4`, `3c56b8f`, `7c6043c`) confirmed present in `git log`.
