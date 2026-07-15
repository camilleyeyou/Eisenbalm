---
phase: 43-my-tasks-decision-log
plan: 02
subsystem: database
tags: [convex, audit-log, decision-log, convex-test, tsk-06]

# Dependency graph
requires:
  - phase: 43-01
    provides: "docs/API_CONTRACTS.md §43.1-§43.4 — the exact audit_log decision shape, writeDecision/listDecisions/byClerkUserId contracts, written contract-first"
provides:
  - "audit_log gains four additive-optional decision fields (reason, issueNumber, runId, instructionVersion)"
  - "internal.auditLog.writeDecision — the ONE shared Convex-side decision-write helper (reason required)"
  - "auditLog.listDecisions — reason-bearing projection query over audit_log, newest-first, run/issue-scopable, legacy-tolerant"
  - "users.byClerkUserId — the first users read query, resolving a Clerk sub to a displayName/email row"
  - "convex/* synced to dev:modest-magpie-797"
affects: [43-06-decision-log-component-mounts, 43-07-retrofit-reason-actions-shared-helper, 43-08-do-not-use-reason-capture, 43-09-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Decisions are a filtered projection over audit_log, not a new store (D-09) — isDecisionRow checks structured `reason` OR after-JSON `reason`/`heldReason` fallback for legacy-row tolerance"
    - "Additive-optional schema evolution continued: all four new audit_log fields are v.optional; write/record args extended the same way"
    - "Convex-side decision-write helper (writeDecision, internalMutation, reason required) as the single call site status-only dashboard mutations use, distinct from the content-touching pipeline write boundary (record)"

key-files:
  created:
    - apps/dispatch-control/__tests__/auditLogDecision.test.ts
  modified:
    - convex/schema.ts
    - convex/auditLog.ts
    - convex/users.ts
    - apps/dispatch-control/vitest.config.ts

key-decisions:
  - "isDecisionRow lives in convex/auditLog.ts as a plain (non-exported-as-Convex-function) predicate, applied in-memory after the by_workspace_timestamp scan — no new index required, matching §43.1/§43.3"
  - "listDecisions takes a generous cap (limit ?? 200) before filtering, per §43.3's 'return the filtered array respecting a final display limit' — filtering only removes rows, so the returned array is always <= the initial cap"
  - "byClerkUserId double-checks workspace_id after the by_clerkUserId index lookup (defense in depth — the index itself is not workspace-scoped) and returns null on any mismatch or miss"

patterns-established:
  - "The writeDecision / write / record trio: writeDecision (internal, reason required) for status-only dashboard mutations; write (internal, decision fields optional) for internal callers that may or may not be a decision; record (public, pipeline HTTP) mirrors write's args plus pipelineSecret — all three converge on an identical audit_log row shape"

requirements-completed: [TSK-06]

# Metrics
duration: 4min
completed: 2026-07-15
---

# Phase 43 Plan 02: Audit/Decision Substrate (Convex) Summary

**Extended `audit_log` with four additive-optional decision fields and shipped the `writeDecision`/`listDecisions`/`users.byClerkUserId` Convex trio that the Decision Log component projects over — no new store, fully convex-test covered, synced live to dev:modest-magpie-797.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-15T09:16:55-07:00
- **Completed:** 2026-07-15T09:20:35-07:00
- **Tasks:** 2 (TDD: RED test, then GREEN implementation)
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- `audit_log` schema gains `reason`/`issueNumber`/`runId`/`instructionVersion`, all `v.optional` — legacy rows insert/read unchanged
- `writeDecision` internalMutation: the ONE Convex-side helper for reason-requiring, status-only dashboard mutations (D-11); `reason` is a required arg
- `listDecisions` query: reason-bearing projection over `audit_log`, newest-first, `runId`/`issueNumber`-scopable, tolerant of legacy `after`-JSON `heldReason` rows, excludes plain rows like `run.triggered`
- `write`/`record` extended additively with the same four optional decision fields (forwarded into insert only when present)
- `users.byClerkUserId`: the first read query on `users`, resolving a Clerk sub to its row (or `null`) for read-time actor-name rendering
- `AuditLogViewer.tsx`/`listForWorkspace` left completely untouched (D-08) — `listDecisions` is a new sibling query
- Convex synced to `dev:modest-magpie-797` via `pnpm --filter @eisenbalm/convex dev:once` — confirmed "Convex functions ready!" with no deploy error

## Task Commits

Each task was committed atomically:

1. **Task 1: RED convex-test for writeDecision + listDecisions + legacy tolerance** - `be1cfa1` (test)
2. **Task 2: Implement audit_log fields + writeDecision + listDecisions + users read query, then sync Convex** - `fcdf911` (feat)

_TDD: RED confirmed 7/7 failing (functions did not exist) before Task 2; GREEN confirmed 7/7 passing after Task 2._

## Files Created/Modified
- `apps/dispatch-control/__tests__/auditLogDecision.test.ts` - convex-test (edge-runtime) coverage: writeDecision insert, listDecisions structured-reason + after-JSON-legacy-fallback filtering, run.triggered exclusion, runId scoping, newest-first order, users.byClerkUserId hit/miss
- `apps/dispatch-control/vitest.config.ts` - registered the new test file as `edge-runtime` in `environmentMatchGlobs`
- `convex/schema.ts` - `audit_log` gains four additive-optional decision fields (§43.1)
- `convex/auditLog.ts` - `write`/`record` args extended additively; new `writeDecision` internalMutation; new `isDecisionRow` predicate; new `listDecisions` query
- `convex/users.ts` - new `byClerkUserId` read query alongside the existing `upsertCurrentUser` mutation

## Decisions Made
- Implemented `docs/API_CONTRACTS.md` §43.1-§43.4 verbatim — no field, function, or predicate name deviated from the plan/contract
- `isDecisionRow`'s `after`-JSON parse is wrapped in try/catch so a malformed/non-JSON `after` string never accidentally qualifies a row as a decision
- Kept `listForWorkspace`/`AuditLogViewer.tsx` completely untouched per D-08 — verified via `pnpm --filter dispatch-control test` (all 87 existing test files still green after the change)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `pnpm --filter @eisenbalm/convex dev:once` completed cleanly on the first attempt; the full `dispatch-control` test suite (750 tests, 87 files) stayed green after the schema/function changes.

## User Setup Required

None - no external service configuration required. The Convex dev sync (`dev:modest-magpie-797`) was run and confirmed as part of this plan's execution.

## Next Phase Readiness

- `writeDecision`, `listDecisions`, and `users.byClerkUserId` are live on `dev:modest-magpie-797` and ready for Plan 43-06 (`DecisionLog` component) to consume
- Plans 43-07/43-08 can now route Hold/Activate-override/Do-not-use through `writeDecision` to promote their reasons into the structured field
- No blockers. Note for 43-06: `listDecisions` returns full `Doc<'audit_log'>` rows (not display-ready) — actor-name resolution (human via `users.byClerkUserId`, agent/system via a local static map) is a component-level concern per §43.4, not done here

---
*Phase: 43-my-tasks-decision-log*
*Completed: 2026-07-15*

## Self-Check: PASSED

All created/modified files found on disk; both task commits (`be1cfa1`, `fcdf911`) confirmed in git log.
