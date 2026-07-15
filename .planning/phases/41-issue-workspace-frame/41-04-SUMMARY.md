---
phase: 41-issue-workspace-frame
plan: 04
subsystem: ui
tags: [react, convex, dispatch-control, signal-desk, vitest]

# Dependency graph
requires:
  - phase: 37-run-monitor-v2-signal-desk
    provides: SignalDeskScreen (CandidateSlate/DecisionPanel/AdjudicationPanel composition) keyed to workspace_id/runs.latest
provides:
  - "SignalDeskScreen additive optional runId? prop that bypasses api.runs.latest when present"
  - "Regression-guard test proving the legacy workspace_id-only /signal-desk route is unchanged"
affects: [41-07-stage-1-story-brief]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "effectiveRunId = passedRunId ?? latestRun?.runId — additive issue-keying pattern for a screen previously hard-wired to runs.latest"

key-files:
  created:
    - apps/dispatch-control/__tests__/SignalDeskScreen.test.tsx
  modified:
    - "apps/dispatch-control/app/(dashboard)/signal-desk/_components/SignalDeskScreen.tsx"

key-decisions:
  - "api.runs.latest is skipped ('skip') entirely whenever a runId prop is passed, rather than being queried and then ignored — avoids an unnecessary live subscription and guarantees the latest run can never silently override a passed run."

patterns-established:
  - "Pattern 1: additive optional runId? prop with effectiveRunId fallback — the template Plan 41-07 will reuse when mounting SignalDeskScreen as Stage 1"

requirements-completed: [WSP-01]

# Metrics
duration: 8min
completed: 2026-07-15
---

# Phase 41 Plan 04: SignalDeskScreen Issue-Keying Summary

**Added an additive `runId?` prop to `SignalDeskScreen` so it can be scoped to a specific issue's run instead of always resolving `api.runs.latest`, closing the Pitfall-2 gap ahead of Plan 41-07's Stage 1 wrapper.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-07-15T05:55:44Z
- **Tasks:** 1 completed (TDD: test + implementation in a single task, committed together per the plan's single-task structure)
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments
- `SignalDeskScreenProps` now `{ workspace_id: string; runId?: string }` — additive, backward-compatible signature change
- `api.runs.latest` is explicitly skipped (`'skip'`) whenever a `runId` prop is passed; `effectiveRunId = passedRunId ?? latestRun?.runId` is used everywhere the old local `runId` was (the no-run guard, `CandidateSlate`, `AdjudicationPanel`, `DecisionPanel`)
- New `SignalDeskScreen.test.tsx` proves: (a) a passed non-latest `runId` is honored even when `runs.latest` would resolve to a different run, (b) the no-`runId` legacy path still resolves via `runs.latest` exactly as before, (c) the "No runs yet" empty state still works when neither is available
- Legacy `app/(dashboard)/signal-desk/page.tsx` (passes only `workspace_id`) requires zero changes and remains type-valid

## Task Commits

Each task was committed atomically:

1. **Task 1: Add additive runId? prop that bypasses runs.latest (D-09, Pitfall 2)** - `eabc0fe` (feat, TDD: test + implementation)

**Plan metadata:** (this commit) `docs(41-04): complete signal-desk-issue-keying plan`

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/signal-desk/_components/SignalDeskScreen.tsx` - additive `runId?` prop, `effectiveRunId` fallback logic, `runs.latest` skip guard
- `apps/dispatch-control/__tests__/SignalDeskScreen.test.tsx` - new test file proving the Pitfall-2 guard and the legacy fallback path

## Decisions Made
- `api.runs.latest` is passed `'skip'` (not queried-then-ignored) whenever `runId` is provided, avoiding a redundant live subscription and eliminating any possibility of a race where a newer "latest" run could override the passed run.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 41-07 (Stage 1 Story & Brief) can now mount `<SignalDeskScreen workspace_id={...} runId={issueRunId} />` to scope the Signal Desk to a specific issue's run.
- The legacy top-level `/signal-desk` route is verified unchanged (byte-identical `runs.latest` fallback), so no regression risk to existing operator workflows.
- `pnpm --filter dispatch-control test -- SignalDeskScreen.test.tsx` green (3/3); `CandidateSlate.test.tsx` / `DecisionPanel.test.tsx` / `AdjudicationPanel.test.tsx` unaffected (12/12 green). `tsc --noEmit` shows zero errors attributable to this plan's files (pre-existing unrelated errors in `syntheticPortableText.test.ts` / `voicePassAxis.test.ts` / `WriterExpansion.test.tsx` are untouched by this change and out of scope).

---
*Phase: 41-issue-workspace-frame*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/app/(dashboard)/signal-desk/_components/SignalDeskScreen.tsx
- FOUND: apps/dispatch-control/__tests__/SignalDeskScreen.test.tsx
- FOUND commit: eabc0fe
