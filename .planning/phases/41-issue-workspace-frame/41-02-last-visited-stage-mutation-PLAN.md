---
phase: 41-issue-workspace-frame
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - convex/issues.ts
  - apps/dispatch-control/__tests__/setLastVisitedStage.test.ts
autonomous: true
requirements: [WSP-01]
must_haves:
  truths:
    - "A mutation writes issues.lastVisitedStage so the bare /issues/[n] redirect (D-03) has a source"
    - "The mutation is idempotent and only patches lastVisitedStage on an existing row"
    - "The mutation is deployed live to dev:modest-magpie-797 (committing convex/*.ts is not deploying)"
  artifacts:
    - path: "convex/issues.ts"
      provides: "setLastVisitedStage operator mutation"
      contains: "export const setLastVisitedStage"
    - path: "apps/dispatch-control/__tests__/setLastVisitedStage.test.ts"
      provides: "convex-test coverage of the writer"
  key_links:
    - from: "setLastVisitedStage"
      to: "issues table row (by_workspace_issueNumber)"
      via: "ctx.db.patch(existing._id, { lastVisitedStage: stage })"
      pattern: "lastVisitedStage"
---

<objective>
Add the missing writer for `issues.lastVisitedStage`. The schema field exists
(convex/schema.ts:500) but grep across the repo finds ONLY the declaration — no
mutation writes it (41-RESEARCH Pitfall 6). The frame's redirect (D-03) and the
per-stage "remember where I was" behavior (D-04) both need this. Ship the mutation,
test it with convex-test, and — critically — run the live Convex sync so it is
actually callable in the dev deployment (committing convex/*.ts alone does NOT deploy,
per project memory [[convex-functions-need-live-sync]]).

Purpose: enables Plan 41-06's redirect + last-visited-stage useEffect writer.
Output: `setLastVisitedStage` live on dev:modest-magpie-797, with a green convex-test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/41-issue-workspace-frame/41-CONTEXT.md
@.planning/phases/41-issue-workspace-frame/41-RESEARCH.md

<interfaces>
<!-- convex/issues.ts existing shape to mirror (verified): -->
- imports: `import { query, mutation } from './_generated/server'`, `{ v } from 'convex/values'`,
  `{ requireOperator, requireOperatorOrPipeline } from './lib/auth'`, `{ internal } from './_generated/api'`
- `hold`/`reopen` are OPERATOR-ONLY via `requireOperator(ctx)` — mirror THIS lane (a stage-visit is a human action).
- Row lookup pattern used across the file:
    const existing = await ctx.db.query('issues')
      .withIndex('by_workspace_issueNumber', q => q.eq('workspace_id', workspace_id).eq('issueNumber', issueNumber))
      .first()
- issues table fields: workspace_id, issueNumber, held, published, lastVisitedStage: v.optional(v.string()), createdAt, ...
- Live-sync command (mandatory this plan): `pnpm --filter @eisenbalm/convex dev:once`
- convex-test is a devDependency (apps/dispatch-control/package.json: "convex-test": "^0.0.53").
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add setLastVisitedStage operator mutation (D-03/D-04)</name>
  <files>convex/issues.ts</files>
  <read_first>
    - convex/issues.ts (full — copy the exact requireOperator lane + by_workspace_issueNumber lookup used by hold/reopen)
    - convex/schema.ts lines 489–503 (the issues table — confirm lastVisitedStage: v.optional(v.string()))
    - convex/lib/auth.ts (requireOperator signature)
  </read_first>
  <action>
    Add to convex/issues.ts, following the OPERATOR-ONLY lane (like `hold`/`reopen`):

      export const setLastVisitedStage = mutation({
        args: {
          workspace_id: v.string(),
          issueNumber: v.number(),
          stage: v.union(
            v.literal('story'), v.literal('draft'), v.literal('fact-check'),
            v.literal('voice'), v.literal('approval'),
          ),
        },
        handler: async (ctx, { workspace_id, issueNumber, stage }) => {
          await requireOperator(ctx)
          const existing = await ctx.db.query('issues')
            .withIndex('by_workspace_issueNumber', q =>
              q.eq('workspace_id', workspace_id).eq('issueNumber', issueNumber))
            .first()
          if (!existing) return null            // no row yet — nothing to remember; never create here
          await ctx.db.patch(existing._id, { lastVisitedStage: stage })
          return null
        },
      })

    Add a header comment: this is the sole writer of `lastVisitedStage` (Pitfall 6);
    it is a strict patch-only NO-OP when the row is absent (a stray visit must never
    create/resurrect an issue — that is ensureByNumber's guarded job).
    The `stage` literal union MUST match the D-05 route segments exactly.
  </action>
  <verify>
    <automated>grep -q "export const setLastVisitedStage" convex/issues.ts && grep -q "lastVisitedStage: stage" convex/issues.ts && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export const setLastVisitedStage" convex/issues.ts` succeeds
    - the `stage` arg is a `v.union` of exactly the five literals story/draft/fact-check/voice/approval
    - handler calls `requireOperator(ctx)` and patches only `lastVisitedStage` (no other field written)
    - handler returns `null` (no row created) when the issue row is absent
  </acceptance_criteria>
  <done>setLastVisitedStage exists in convex/issues.ts on the operator lane, patch-only, stage validated.</done>
</task>

<task type="auto">
  <name>Task 2: convex-test coverage + live deploy sync</name>
  <files>apps/dispatch-control/__tests__/setLastVisitedStage.test.ts, convex/issues.ts</files>
  <read_first>
    - apps/dispatch-control/__tests__/ (find any existing convex-test usage to copy the harness setup; if none, use `convexTest(schema)` from 'convex-test' + `import schema from '@convex/schema'`)
    - convex/issues.ts (the mutation under test + the hold/reopen tests if present as a pattern)
  </read_first>
  <action>
    Write a convex-test unit test asserting:
      - Given an inserted issues row (workspace 'eisenbalm', issueNumber 7), calling
        setLastVisitedStage with stage 'voice' patches lastVisitedStage='voice'
        (read back via issues.byIssueNumber or a direct db read in the test harness).
      - Calling it again with 'approval' overwrites to 'approval' (idempotent last-write-wins).
      - Calling it for an issueNumber with NO row is a no-op (does not throw, creates no row).
    Use the operator-auth identity shim the existing convex-tests use (mirror the pattern
    for requireOperator; if a helper exists in another __tests__ convex-test, reuse it).
    Then run the LIVE SYNC so the mutation is deployed (NOT just committed):
      `pnpm --filter @eisenbalm/convex dev:once`
    Capture that it completes without error (functions deploy to dev:modest-magpie-797).
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- setLastVisitedStage.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `apps/dispatch-control/__tests__/setLastVisitedStage.test.ts` exists and imports from 'convex-test'
    - `pnpm --filter dispatch-control test -- setLastVisitedStage.test.ts` exits 0
    - `pnpm --filter @eisenbalm/convex dev:once` was run and completed without error (recorded in the SUMMARY)
    - test proves: patch on existing row, overwrite, and no-op-on-absent-row
  </acceptance_criteria>
  <done>Mutation tested + deployed live; downstream 41-06 can call api.issues.setLastVisitedStage.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- setLastVisitedStage.test.ts` green.
- `pnpm --filter @eisenbalm/convex dev:once` completed (mutation live on dev:modest-magpie-797).
</verification>

<success_criteria>
`setLastVisitedStage` is the sole, operator-guarded, patch-only writer of `issues.lastVisitedStage`,
covered by convex-test, and DEPLOYED (not merely committed) to the dev Convex deployment.
</success_criteria>

<output>
After completion, create `.planning/phases/41-issue-workspace-frame/41-02-SUMMARY.md`
</output>
