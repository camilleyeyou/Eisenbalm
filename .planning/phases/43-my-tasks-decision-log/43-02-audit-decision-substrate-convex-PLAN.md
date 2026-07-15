---
phase: 43-my-tasks-decision-log
plan: 02
type: execute
wave: 2
depends_on: ["43-01"]
files_modified:
  - convex/schema.ts
  - convex/auditLog.ts
  - convex/users.ts
  - apps/dispatch-control/vitest.config.ts
  - apps/dispatch-control/__tests__/auditLogDecision.test.ts
autonomous: true
requirements: [TSK-06]

must_haves:
  truths:
    - "audit_log carries four additive-optional decision fields (reason, issueNumber, runId, instructionVersion); legacy rows omit them and still insert/read fine"
    - "internal.auditLog.writeDecision is the ONE Convex-side helper every reason-requiring dashboard mutation calls; it inserts a row with the structured decision fields"
    - "auditLog.listDecisions returns ONLY reason-bearing rows (structured reason OR after-JSON reason), newest-first, run/issue-scopable — a plain run.triggered row is excluded"
    - "a users read query resolves a Clerk sub to a display name/email for read-time actor rendering; the stored actorId is unchanged"
    - "convex/* changes are synced to dev:modest-magpie-797 via pnpm --filter @eisenbalm/convex dev:once (committing convex/*.ts is NOT deploying it)"
  artifacts:
    - path: "convex/schema.ts"
      provides: "audit_log additive-optional reason/issueNumber/runId/instructionVersion"
      contains: "reason: v.optional(v.string())"
    - path: "convex/auditLog.ts"
      provides: "writeDecision internalMutation, listDecisions projection query, extended write/record args, isDecisionRow predicate"
      exports: ["writeDecision", "listDecisions"]
    - path: "convex/users.ts"
      provides: "read query resolving Clerk sub -> displayName/email"
    - path: "apps/dispatch-control/__tests__/auditLogDecision.test.ts"
      provides: "convex-test coverage of writeDecision + listDecisions filter + legacy tolerance"
  key_links:
    - from: "convex/auditLog.ts writeDecision"
      to: "convex/auditLog.ts listDecisions"
      via: "the audit_log row's structured reason field"
      pattern: "reason"
---

<objective>
Build the Convex substrate the Decision Log projects over (TSK-06, per §43.1-§43.4): additive-optional decision fields on audit_log, the shared `writeDecision` helper, the reason-bearing `listDecisions` projection query, and a `users` read query for actor-name resolution — all additive, all following the milestone's Phase 35/42 additive-optional pattern.

Purpose: This is the "no separate decision store" spine (D-09) — decisions are a filtered projection over the same audit_log trail. Every downstream retrofit (43-07, 43-08) and the DecisionLog component (43-06) depend on these exports existing and being LIVE on dev:modest-magpie-797.
Output: extended audit_log schema + auditLog.writeDecision/listDecisions + users read query + edge-runtime convex-test + Convex dev sync.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/API_CONTRACTS.md
@convex/auditLog.ts
@convex/schema.ts
@convex/users.ts

<interfaces>
<!-- Verified from the current repo tree. -->
convex/schema.ts audit_log (266-277): { workspace_id, actorId, action, resourceType?, resourceId?, before?, after?, timestamp } + by_workspace, by_workspace_timestamp.
convex/auditLog.ts: write (internalMutation, args w/o decision fields), record (public mutation, pipelineSecret guard, requirePipelineSecret), listForWorkspace (query, by_workspace_timestamp desc, take(limit ?? 50)).
convex/users.ts: only upsertCurrentUser (mutation). users schema (schema.ts:235-245): { workspace_id, clerkUserId, email, displayName?, role?, ... } indexes by_workspace, by_clerkUserId. NO read query today.
vitest.config.ts environmentMatchGlobs: convex-test files registered edge-runtime individually (e.g. ['__tests__/auditLog.test.ts','edge-runtime']). Add the new file the same way.
Convex sync: `pnpm --filter @eisenbalm/convex dev:once` -> dev:modest-magpie-797 (project memory: a prior phase shipped a prod 500 by skipping this).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED convex-test for writeDecision + listDecisions + legacy tolerance</name>
  <files>apps/dispatch-control/__tests__/auditLogDecision.test.ts, apps/dispatch-control/vitest.config.ts</files>
  <read_first>
    - apps/dispatch-control/__tests__/auditLog.test.ts (the existing convex-test pattern for audit_log — imports, convexTest(schema), t.mutation/t.query usage)
    - apps/dispatch-control/vitest.config.ts (environmentMatchGlobs — where to register the new edge-runtime file)
    - docs/API_CONTRACTS.md §43.2/§43.3 (the writeDecision + listDecisions contract just written)
  </read_first>
  <behavior>
    - internal.auditLog.writeDecision inserts a row carrying reason/issueNumber/runId/instructionVersion; listDecisions returns it.
    - auditLog.listDecisions returns ONLY reason-bearing rows: a writeDecision row (structured reason) is included; a plain write row with action:'run.triggered' and no reason and no after is EXCLUDED.
    - Legacy tolerance: a write row with no structured `reason` but `after: JSON.stringify({ heldReason: 'x' })` IS included by listDecisions (after-JSON reason fallback).
    - listDecisions with { runId } returns only rows whose runId matches (structured) — a decision row for a different runId is excluded.
    - Rows are newest-first (timestamp desc).
    - The users read query returns the row for a given clerkUserId with its displayName/email; returns null/undefined for an unknown sub.
  </behavior>
  <action>
Create apps/dispatch-control/__tests__/auditLogDecision.test.ts as a convex-test (edge-runtime) file mirroring __tests__/auditLog.test.ts's structure (`convexTest(schema)`, `t.mutation(internal.auditLog.write, ...)`, `t.query(api.auditLog.listForWorkspace, ...)`). Cover every <behavior> bullet: insert via writeDecision, insert a plain run.triggered row, insert a legacy after-JSON hold row, and assert listDecisions filtering + ordering + runId scoping; add a users read-query case (upsert a user then read it back by sub). These assertions are RED until Task 2.
Register the file in vitest.config.ts environmentMatchGlobs: add `['__tests__/auditLogDecision.test.ts', 'edge-runtime']` alongside the existing entries.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- __tests__/auditLogDecision.test.ts || true</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "auditLogDecision.test.ts" apps/dispatch-control/vitest.config.ts` matches (registered edge-runtime)
    - `grep -n "writeDecision\|listDecisions" apps/dispatch-control/__tests__/auditLogDecision.test.ts` matches
    - `grep -n "heldReason\|run.triggered" apps/dispatch-control/__tests__/auditLogDecision.test.ts` matches (legacy + exclusion cases present)
    - the test file runs and FAILS (RED) because the functions do not yet exist — command exits non-zero before Task 2
  </acceptance_criteria>
  <done>The full TSK-06 substrate behavior is pinned RED in an edge-runtime convex-test before the implementation lands.</done>
</task>

<task type="auto">
  <name>Task 2: Implement audit_log fields + writeDecision + listDecisions + users read query, then sync Convex</name>
  <files>convex/schema.ts, convex/auditLog.ts, convex/users.ts</files>
  <read_first>
    - docs/API_CONTRACTS.md §43.1-§43.4 (the exact shapes to implement)
    - convex/auditLog.ts (write/record/listForWorkspace — extend, do not rewrite)
    - convex/schema.ts (audit_log lines 266-277; users lines 235-245)
    - convex/users.ts (upsertCurrentUser — add a read query beside it)
    - convex/_generated/ai/guidelines.md (Convex API rules that override training data — per convex/CLAUDE.md)
  </read_first>
  <action>
1. convex/schema.ts: add to audit_log (additive-optional, keep existing fields + indexes): `reason: v.optional(v.string())`, `issueNumber: v.optional(v.number())`, `runId: v.optional(v.string())`, `instructionVersion: v.optional(v.string())`.
2. convex/auditLog.ts:
   - Extend `write` AND `record` args additively with the four optional decision fields, forwarded into the db.insert only when present (they flow through the existing `...args` spread — just add them to the args validators).
   - Add `export const writeDecision = internalMutation({...})` taking `{ workspace_id, actorId, action, resourceType?, resourceId?, before?, after?, reason: v.string(), issueNumber?, runId?, instructionVersion? }`, inserting one audit_log row (timestamp: Date.now()). This is the ONE Convex-side decision helper (D-11).
   - Add an `isDecisionRow(row)` helper: true if `row.reason !== undefined` OR (`row.after` parses to an object with a `reason` or `heldReason` key). Wrap the JSON.parse in try/catch.
   - Add `export const listDecisions = query({ args: { workspace_id, runId?, issueNumber?, limit? } })`: query `by_workspace_timestamp` desc, take a generous cap (e.g. limit ?? 200), `.filter(isDecisionRow)`, then when runId/issueNumber provided keep rows whose structured field matches (rows lacking the field are dropped when a scope is requested). Return the filtered array (respecting a final display limit).
3. convex/users.ts: add `export const byClerkUserId = query({ args: { clerkUserId: v.string() } })` returning the users row (by_clerkUserId index) or null. (Add `listForWorkspace({ workspace_id })` too if the DecisionLog will batch-resolve — optional; byClerkUserId is the minimum.)
4. Run `pnpm --filter @eisenbalm/convex dev:once` to sync to dev:modest-magpie-797. Confirm no deploy error.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- __tests__/auditLogDecision.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "reason: v.optional(v.string())" convex/schema.ts` matches inside audit_log
    - `grep -n "export const writeDecision" convex/auditLog.ts` matches
    - `grep -n "export const listDecisions" convex/auditLog.ts` matches
    - `grep -n "export const byClerkUserId" convex/users.ts` matches
    - `pnpm --filter dispatch-control test -- __tests__/auditLogDecision.test.ts` exits 0 (RED→GREEN)
    - `pnpm --filter @eisenbalm/convex dev:once` completes without a deploy error (functions live on dev:modest-magpie-797)
  </acceptance_criteria>
  <done>The additive decision fields, the one shared writeDecision helper, the reason-bearing listDecisions projection, and the users actor-name query are implemented, green under convex-test, and deployed to the dev Convex.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- __tests__/auditLogDecision.test.ts` green.
- `git diff convex/schema.ts` shows only additions to audit_log (no field renamed/removed).
- Convex dev sync ran (no `_generated` drift left uncommitted that would break the build).
</verification>

<success_criteria>
The reason-bearing decision projection substrate exists and is LIVE: writeDecision writes the TSK-06 record, listDecisions returns only reason-bearing rows (legacy-tolerant, run/issue-scopable), and users.byClerkUserId resolves actor names.
</success_criteria>

<output>
After completion, create `.planning/phases/43-my-tasks-decision-log/43-02-SUMMARY.md`.
</output>
