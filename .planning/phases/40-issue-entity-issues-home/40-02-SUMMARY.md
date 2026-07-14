---
phase: 40-issue-entity-issues-home
plan: 02
subsystem: database
tags: [convex, issues, hold-reopen, audit-log, derived-state]

# Dependency graph
requires:
  - phase: 40-issue-entity-issues-home
    provides: "§40.1/§40.2/§40.3 contract in docs/API_CONTRACTS.md + the RED convex-test scaffold (__tests__/issues.test.ts) from Plan 40-01"
  - phase: 34-two-sign-off-publish-gate-studio-bypass-retirement
    provides: "sign_offs table pattern (structural analog for issues: workspace-scoped, idempotent upsert, dual-lane auth)"
  - phase: 29-deployment-hardening-code-fixes
    provides: "requireOperator / requireOperatorOrPipeline / requirePipelineSecret guards in convex/lib/auth.ts"
provides:
  - "issues Convex table: one row per (workspace_id, issueNumber), held/published as the ONLY stored status inputs"
  - "convex/issues.ts: byIssueNumber, listForWorkspace, ensureByNumber, hold, reopen, markPublished"
  - "convex/pipelineRuns.ts: byIssueNumber (most-recent run) + listByIssueNumber (full history) over the by_issueNumber index"
affects: [40-03-repetition-note-backfill-pipeline, 40-04-derived-state-resolver-libs, 40-05-issues-home-screen, 40-06-routing-inversion, 40-07-issue-overview-hold, 40-09-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent insert-if-absent mutation with a strict NO-OP branch (no patch) on an existing row — extends the runs:create existing-row-check pattern to guard against resurrecting operator state (D-04)"
    - "Dual-lane auth (requireOperatorOrPipeline) for mutations both the console and the pipeline legitimately call; operator-only (requireOperator) for mutations that are exclusively human editorial decisions"

key-files:
  created:
    - convex/issues.ts
  modified:
    - convex/schema.ts
    - convex/pipelineRuns.ts

key-decisions:
  - "reopen throws 'Issue not found' when no row exists, mirroring hold's guard (contract text didn't explicitly require this, but symmetry with hold plus the row being required for ctx.db.patch made it the only sound choice)"
  - "reopen's audit_log before/after JSON captures { held: true, heldReason } → { held: false } — contract said 'same envelope as hold' without specifying exact before/after shape; chose the symmetric inverse of hold's envelope"

requirements-completed: [ISS-01, ISS-04, ISS-02]

# Metrics
duration: 10min
completed: 2026-07-14
---

# Phase 40 Plan 02: Issues Table + Convex Functions Summary

**New `issues` Convex table plus `convex/issues.ts` (byIssueNumber, listForWorkspace, ensureByNumber, hold, reopen, markPublished) and two issue-keyed `pipelineRuns` queries — the operational-state substrate for issue-keyed routing, implementing docs/API_CONTRACTS.md §40.1-§40.3 verbatim.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-14T23:33:00Z (approx)
- **Completed:** 2026-07-14T23:43:00Z (approx)
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `issues` table added to `convex/schema.ts` with `by_workspace` + `by_workspace_issueNumber` indexes; only `held`/`published` stored as status inputs — no `status`/`stage` column, matching D-18's derive-don't-store invariant
- `convex/issues.ts` created implementing all six §40.2 functions: two unguarded reads, a dual-lane idempotent `ensureByNumber` with the D-04 no-resurrect-a-Held-issue guard, operator-only `hold` (required reason + audit_log) and `reopen` (audit_log), and a dual-lane idempotent `markPublished`
- `convex/pipelineRuns.ts` gained `byIssueNumber` (most-recent run) and `listByIssueNumber` (full run history) over the already-declared `by_issueNumber` index — no schema change needed
- The RED convex-test scaffold from Plan 40-01 (`__tests__/issues.test.ts`, 8 tests) now passes GREEN against the real implementation — verified as an informational check even though this plan's own gate doesn't require it (Plan 40-09 owns that gate)
- Ran the full existing edge-runtime Convex test suite (12 files, 63 tests) to confirm zero regressions from the schema addition

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the issues table to convex/schema.ts** - `41ac7b0` (feat)
2. **Task 2: Create convex/issues.ts (queries + mutations)** - `14673fd` (feat)
3. **Task 3: Add byIssueNumber + listByIssueNumber to convex/pipelineRuns.ts** - `e793771` (feat)

## Files Created/Modified
- `convex/schema.ts` - Added the `issues` table (workspace_id, issueNumber, scheduledFor, held, heldReason, heldBy, heldAt, published, publishedAt, sanityIssueId, lastVisitedStage, createdAt) with two indexes
- `convex/issues.ts` - New file: byIssueNumber, listForWorkspace (queries); ensureByNumber, hold, reopen, markPublished (mutations)
- `convex/pipelineRuns.ts` - Added byIssueNumber + listByIssueNumber queries over the existing by_issueNumber index; byRunId/create/updateStatus untouched

## Decisions Made
- `reopen` throws `Issue not found` when no row exists (contract didn't explicitly state this, but `ctx.db.patch` requires a resolved `_id`, and mirroring `hold`'s guard is the only sound and consistent choice)
- `reopen`'s audit_log `before`/`after` JSON is the symmetric inverse of `hold`'s envelope (`{held:true, heldReason}` → `{held:false}`) — the contract said "same envelope as hold" without pinning the exact before/after shape

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria greps passed on the first attempt; `tsc --noEmit` was clean after each task; the RED test scaffold turned fully GREEN with no code changes needed beyond what the plan specified.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Per plan instructions, this plan does NOT run `convex dev`/deploy — that is Plan 40-09's job.

## Next Phase Readiness

- `convex/issues.ts` and the two `pipelineRuns` issue-keyed queries are ready for Plan 40-03 (backfill script, `markPublished` consumer) and Plan 40-04 (derived-state resolver, which will read `issues.held`/`issues.published` alongside `sign_offs`)
- Plan 40-06 (routing inversion) can now resolve `issueNumber → runId` via `pipelineRuns:byIssueNumber` for the `/issues/[n]/review` and `/issues/[n]/voice` thin wrappers
- No blockers. The live Convex deploy (`pnpm --filter @eisenbalm/convex dev:once` against `dev:modest-magpie-797`) still needs to happen before any dashboard `useQuery`/`useMutation` call against `api.issues.*` will work in the browser — tracked as Plan 40-09's integration gate, not overlooked here

---
*Phase: 40-issue-entity-issues-home*
*Completed: 2026-07-14*

## Self-Check: PASSED

All created files confirmed present (`convex/schema.ts`, `convex/issues.ts`, `convex/pipelineRuns.ts`, this SUMMARY.md); all three task commits (`41ac7b0`, `14673fd`, `e793771`) confirmed in git history.
