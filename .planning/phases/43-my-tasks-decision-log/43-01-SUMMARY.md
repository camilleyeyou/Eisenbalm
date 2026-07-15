---
phase: 43-my-tasks-decision-log
plan: 01
subsystem: contracts
tags: [convex, audit-log, decision-log, my-tasks, derived-state, api-contracts]

# Dependency graph
requires:
  - phase: 40-issue-entity-issues-home
    provides: "deriveTasks() selector + DerivationInputs assembly + the audit_log table shape (§40.6)"
  - phase: 42-fact-check-stage
    provides: "the audit_log-as-decision-trail precedent (§42.4a) and the contract-first amendment convention (§42)"
provides:
  - "docs/API_CONTRACTS.md §43 — the full Phase 43 data contract: audit_log's four additive-optional decision fields, the writeDecision/_emit_audit shared write helper (two writer paths), the listDecisions projection query, the users.byClerkUserId actor-name read query, the derivedState.ts openedAt field + two href corrections, the client-side run.section_rerolled superseded predicate, and the Do-not-use net-new reason-capture retrofit"
affects: [43-02, 43-03, 43-04, 43-05, 43-06, 43-07, "my-tasks-screen", "decision-log-component", "audit-log-schema"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Decision projection over audit_log (no new store) — decision-hood is a filter (reason field OR reason-shaped after-JSON), not a schema flag"
    - "Write-time facts stored, read-time facts resolved — actorId unchanged, actor display name resolved via users.byClerkUserId + a static system/agent label map at render time"
    - "Two-writer-path shared helper — Convex writeDecision (status-only dashboard mutations) + pipeline _emit_audit optional kwargs (content-touching EDT-05 boundary), converging on the same audit_log row shape"

key-files:
  created: []
  modified:
    - docs/API_CONTRACTS.md

key-decisions:
  - "Store only write-time-stable fields (reason/issueNumber/runId/instructionVersion) on audit_log; resolve actorName/actorKind at read time via a new users query — avoids ever storing a name that can drift from the users table (Open Question 3)"
  - "Corrected two research-confirmed contract errors that CONTEXT.md's optimistic characterization would have propagated: claim-task and facts-signoff-task hrefs must be corrected to issueFactCheckHref/issueApprovalHref (Pitfall 1, in-place bug fix), and Do-not-use is documented as NET-NEW reason-capture work, not a promotion of an existing reason (Pitfall 3 — charities.setStatus has no reason param and writes zero audit_log rows today)"
  - "Superseded detection is a client-side audit_log cross-reference (run.section_rerolled row newer than the task's openedAt) — no pipeline change to rerun_agent, per Open Question 2's locked recommendation"
  - "resolved/superseded/'Done' are explicitly forbidden as TaskSeverity union members (Pitfall 4) — modeled as a screen-local DisplayTask wrapper type instead, to avoid breaking the exhaustive SEVERITY_MINUTES/SEVERITY_ORDER Records"

patterns-established:
  - "Decision projection query pattern: listDecisions(workspace_id, runId?, issueNumber?, limit?) filters by a reason-presence predicate rather than requiring a new decisionKind schema flag"

requirements-completed: [TSK-02, TSK-03, TSK-05, TSK-06]

# Metrics
duration: ~15min
completed: 2026-07-15
---

# Phase 43 Plan 01: Contract Audit — Decision Shape Summary

**Amended docs/API_CONTRACTS.md with a new §43 section (280 lines) specifying the entire Phase 43 data contract — audit_log's decision fields, the writeDecision/_emit_audit shared helper, listDecisions, users.byClerkUserId, derivedState.ts's openedAt + href corrections, the superseded predicate, and the Do-not-use net-new retrofit — before any downstream code lands.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-15T16:08:37Z (per STATE.md context-gathered timestamp)
- **Completed:** 2026-07-15T16:11:35Z
- **Tasks:** 1 (of 1)
- **Files modified:** 1

## Accomplishments
- Wrote the complete §43 contract as seven subsections (§43.1–§43.7) plus an intro and closing reconciliation paragraph, mirroring the §31.8/§40.6/§42.7 conventions already established in the file
- Pinned the exact `audit_log` schema amendment (four additive-optional fields: `reason`, `issueNumber`, `runId`, `instructionVersion`) and explicitly ruled out storing `actorName`/`actorKind` (resolved at read time instead)
- Specified the ONE shared decision-write helper across both writer paths: Convex `writeDecision` (new internalMutation wrapping `write`) for status-only dashboard mutations, and `_emit_audit`'s four new optional kwargs for content-touching pipeline-side actions — both converging on the same row shape
- Specified `listDecisions`'s exact "is a decision" predicate (structured `reason` field OR reason-shaped `after` JSON), so legacy Hold/Activate-override rows project as decisions before AND after their retrofit, with zero backfill
- Documented the two research corrections that override CONTEXT.md's more optimistic characterization: the claim/facts-signoff href retarget to `issueFactCheckHref`/`issueApprovalHref` (§43.5b), and Do-not-use having no reason capture or audit row today — net-new work, not a promotion (§43.7)
- Specified the client-side, pipeline-untouched superseded predicate (§43.6) cross-referencing `run.section_rerolled` audit rows against each task's `openedAt`, and explicitly forbade adding `resolved`/`superseded` to the closed `TaskSeverity` union

## Task Commits

Each task was committed atomically:

1. **Task 1: Author §43 (My Tasks & Decision Log) in API_CONTRACTS.md** - `f1d0bae` (docs)

**Plan metadata:** (this commit, below)

## Files Created/Modified
- `docs/API_CONTRACTS.md` - Appended `## §43 — My Tasks & Decision Log (Phase 43)` (280 lines) after the existing `## §42` section; no existing content was renamed, removed, or reordered

## Decisions Made
- Store only write-time-stable decision fields on `audit_log`; resolve actor display name at read time via a new `users.byClerkUserId` query plus a static system/agent label map, per the Research doc's Open Question 3 recommendation
- Build the superseded predicate entirely client-side against the existing `audit_log` trail (no `rerun_agent` pipeline change), per Open Question 2's recommendation — a pipeline-side alternative (clearing stale rows on reroll) is documented in the contract as a known non-goal
- Treat the Do-not-use retrofit as net-new reason-capture + audit-emission work rather than a "promotion," directly reflecting 43-RESEARCH.md Pitfall 3's confirmed finding that `charities.setStatus` has no reason parameter and writes zero `audit_log` rows today

## Deviations from Plan

None - plan executed exactly as written. The single task's `<action>` block enumerated seven subsections (§43.1–§43.7) plus a closing reconciliation paragraph; all were authored as specified, verified against the plan's `<verify>` grep commands and `<acceptance_criteria>` list before committing.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. This plan is documentation-only (a contract amendment); no schema, code, or Convex sync is touched or required until the downstream implementation plans (43-02 onward) land.

## Next Phase Readiness
- §43 is self-contained and implementable verbatim: a downstream agent can build the `audit_log` schema fields, `writeDecision`/`listDecisions`/`users.byClerkUserId`, the `_emit_audit` kwargs, the `derivedState.ts` `openedAt` field + href corrections, the client-side superseded predicate, and the Do-not-use retrofit directly from this section without re-deriving any of the three research-confirmed corrections
- Downstream plans (43-02 onward, per the phase's plan sequence) implement this contract; no blockers identified
- Reminder for downstream plans: per project memory, any change to `convex/schema.ts`/`convex/auditLog.ts`/`convex/users.ts` must be followed by `pnpm --filter @eisenbalm/convex dev:once` (sync to `dev:modest-magpie-797`) before the dashboard can call the new functions live — this plan touched no code, so no sync was needed here

---
*Phase: 43-my-tasks-decision-log*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: docs/API_CONTRACTS.md
- FOUND: .planning/phases/43-my-tasks-decision-log/43-01-SUMMARY.md
- FOUND: commit f1d0bae (task 1)
- `## §43` appears exactly once in docs/API_CONTRACTS.md
