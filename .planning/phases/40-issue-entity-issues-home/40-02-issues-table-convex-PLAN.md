---
phase: 40-issue-entity-issues-home
plan: 02
type: execute
wave: 2
depends_on: ["40-01"]
files_modified:
  - convex/schema.ts
  - convex/issues.ts
  - convex/pipelineRuns.ts
autonomous: true
requirements: [ISS-01, ISS-04, ISS-02]

must_haves:
  truths:
    - "A first-class issue entity exists in Convex, one row per issueNumber, that can be created before any run and defensively ensured at run start without ever resurrecting a Held issue"
    - "Hold writes a required reason + actor + timestamp to audit_log and sets held; Reopen clears it"
    - "A run can be resolved from an issueNumber (byIssueNumber) and an issue's full run history is queryable (listByIssueNumber)"
  artifacts:
    - path: "convex/schema.ts"
      provides: "issues table with by_workspace + by_workspace_issueNumber indexes"
      contains: "issues: defineTable"
    - path: "convex/issues.ts"
      provides: "byIssueNumber, listForWorkspace, ensureByNumber, hold, reopen, markPublished"
      exports: ["byIssueNumber", "listForWorkspace", "ensureByNumber", "hold", "reopen", "markPublished"]
    - path: "convex/pipelineRuns.ts"
      provides: "byIssueNumber + listByIssueNumber queries over the existing by_issueNumber index"
      contains: "by_issueNumber"
  key_links:
    - from: "convex/issues.ts hold"
      to: "convex/auditLog.ts write"
      via: "ctx.runMutation(internal.auditLog.write, ...)"
      pattern: "internal\\.auditLog\\.write"
    - from: "convex/issues.ts ensureByNumber"
      to: "convex/schema.ts issues by_workspace_issueNumber"
      via: "query-then-insert idempotent guard"
      pattern: "by_workspace_issueNumber"
---

<objective>
Build the `issues` Convex table and its functions, plus the two issue-keyed `pipelineRuns` queries the routing inversion needs. This is the operational-state substrate (D-01..D-04) every other Phase 40 plan reads.

Purpose: Hold/schedule/publish are durable operator state with nowhere to live today — the same justification `sign_offs` (Ph34) and `eval_scores` (Ph38) earned their tables. Sanity stays content-of-record; Convex owns operational state.
Output: `convex/schema.ts` (+issues table), `convex/issues.ts` (new), `convex/pipelineRuns.ts` (+2 queries).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/API_CONTRACTS.md
@.planning/phases/40-issue-entity-issues-home/40-RESEARCH.md

<interfaces>
The §40.1/§40.2/§40.3 shapes in docs/API_CONTRACTS.md are BINDING — implement them verbatim. Field names, mutation signatures, return shapes, error strings, and audit actions must match §40 exactly.

Guards (convex/lib/auth.ts):
```typescript
requireOperator(ctx): Promise<string>            // returns identity.subject; NEVER trust a client-supplied actorId
requireOperatorOrPipeline(ctx, secret?): Promise<{ actor: string; isPipeline: boolean }>
```

Audit (convex/auditLog.ts):
```typescript
internalMutation write({ workspace_id, actorId, action, resourceType?, resourceId?, before?, after? })
```

Idempotent-insert precedent (convex/runs.ts:37-41): query the index inside the mutation, `if (existing) return ...` (no-op), else insert. Convex has NO native unique constraint.

The `by_issueNumber` index on pipelineRuns ALREADY EXISTS (convex/schema.ts:25) — pipelineRuns just has no query using it yet.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add the issues table to convex/schema.ts</name>

  <read_first>
    - docs/API_CONTRACTS.md §40.1 (the exact table shape — copy field-for-field)
    - convex/schema.ts lines 466-483 (the sign_offs table — the structural analog; match its `defineTable(...).index(...)` style and the trailing-comma-in-defineSchema convention)
    - convex/schema.ts lines 6-25 (pipelineRuns — see how indexes are chained)
  </read_first>

  <action>
Add the `issues` table to the `defineSchema({ ... })` object in `convex/schema.ts`, immediately after the `sign_offs` table (the last table before the closing `})`). Use EXACTLY the §40.1 shape:

```typescript
  // ── issues: first-class issue entity (Phase 40 ISS-01/02/03/04) ───────────
  // Operational state Convex owns; Sanity stays content-of-record (D-01).
  // `held` and `published` are the ONLY stored status inputs — issue status is
  // DERIVED (lib/derivedState.ts, §40.6), never persisted (D-18). There is no
  // `status` column; a persisted status is exactly the stale "ready" ISS-06 bans.
  issues: defineTable({
    workspace_id: v.string(),
    issueNumber: v.number(),
    scheduledFor: v.optional(v.number()),
    held: v.boolean(),
    heldReason: v.optional(v.string()),
    heldBy: v.optional(v.string()),
    heldAt: v.optional(v.number()),
    published: v.boolean(),
    publishedAt: v.optional(v.number()),
    sanityIssueId: v.optional(v.string()),
    lastVisitedStage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_workspace', ['workspace_id'])
    .index('by_workspace_issueNumber', ['workspace_id', 'issueNumber']),
```
Do not touch any other table. Do not rename any existing field anywhere.
  </action>

  <verify>
    <automated>grep -q "issues: defineTable" convex/schema.ts && grep -q "by_workspace_issueNumber" convex/schema.ts && cd convex && pnpm exec tsc --noEmit</automated>
  </verify>

  <acceptance_criteria>
    - `grep -q "issues: defineTable" convex/schema.ts` succeeds
    - `grep -q "by_workspace_issueNumber', \['workspace_id', 'issueNumber'\]" convex/schema.ts` succeeds
    - The table declares exactly these fields: workspace_id, issueNumber, scheduledFor, held, heldReason, heldBy, heldAt, published, publishedAt, sanityIssueId, lastVisitedStage, createdAt
    - There is NO `status` field and NO `stage` field on the issues table (`grep -A16 "issues: defineTable" convex/schema.ts | grep -c "status:"` returns 0)
    - `cd convex && pnpm exec tsc --noEmit` exits 0
  </acceptance_criteria>

  <done>The issues table exists in the schema with both indexes and no derived-status column.</done>
</task>

<task type="auto">
  <name>Task 2: Create convex/issues.ts (queries + mutations)</name>

  <read_first>
    - docs/API_CONTRACTS.md §40.2 (the six function signatures, the exact NO-OP semantics of ensureByNumber, the exact error strings, and the exact audit_log actions — copy verbatim)
    - convex/runs.ts lines 22-52 (the idempotent insert-if-absent pattern ensureByNumber replicates) and lines 195-215 (requestCancel — the requirePipelineSecret + query-by-index + patch shape)
    - convex/signOffs.ts (the requireOperator dashboard-lane mutation + unguarded-read query conventions in this codebase)
    - convex/auditLog.ts lines 37-50 (the internalMutation write signature)
    - convex/lib/auth.ts (requireOperator, requireOperatorOrPipeline)
    - convex/pipelineConfig.ts around line 202 (the `ctx.runMutation(internal.auditLog.write, {...})` call precedent — how an internal audit write is invoked from inside another mutation)
  </read_first>

  <action>
Create `convex/issues.ts` implementing §40.2 EXACTLY. Import `query`, `mutation` from `./_generated/server`, `internal` from `./_generated/api`, `v` from `convex/values`, and the guards from `./lib/auth`.

Queries (PUBLIC, unguarded — the `claimChecks:allSignedOff` convention):
- `byIssueNumber({ workspace_id, issueNumber })` → the row via `.withIndex('by_workspace_issueNumber', q => q.eq('workspace_id', workspace_id).eq('issueNumber', issueNumber)).first()` (or `null`).
- `listForWorkspace({ workspace_id })` → `.withIndex('by_workspace', ...).collect()` sorted by `issueNumber` DESC.

Mutations (implement §40.2 verbatim):
- `ensureByNumber({ workspace_id, issueNumber, scheduledFor?, pipelineSecret? })` — DUAL LANE via `requireOperatorOrPipeline(ctx, pipelineSecret)`. Query `by_workspace_issueNumber`. If a row exists: **strict NO-OP** — return `{ issueNumber, created: false }` WITHOUT patching held/heldReason/heldBy/heldAt/published (D-04 guard: a stray run must never resurrect a Held issue). Else insert `{ workspace_id, issueNumber, scheduledFor, held: false, published: false, createdAt: Date.now() }` and return `{ issueNumber, created: true }`.
- `hold({ workspace_id, issueNumber, reason })` — `requireOperator(ctx)` → actor. If `reason.trim() === ''` throw `new Error('A reason is required to hold this issue.')`. Load the row; if absent throw `new Error('Issue not found')`. Patch `{ held: true, heldReason: reason.trim(), heldBy: actor, heldAt: Date.now() }`. Then `await ctx.runMutation(internal.auditLog.write, { workspace_id, actorId: actor, action: 'issue.held', resourceType: 'issue', resourceId: String(issueNumber), before: JSON.stringify({ held: false }), after: JSON.stringify({ held: true, heldReason: reason.trim() }) })`. Do NOT touch runs.cancelRequested.
- `reopen({ workspace_id, issueNumber })` — `requireOperator(ctx)` → actor. Patch `{ held: false, heldReason: undefined, heldBy: undefined, heldAt: undefined }`. Audit `action: 'issue.reopened'` with the same envelope.
- `markPublished({ workspace_id, issueNumber, sanityIssueId?, publishedAt?, pipelineSecret? })` — DUAL LANE via `requireOperatorOrPipeline`. Load-or-throw `'Issue not found'`. Patch `{ published: true, publishedAt: publishedAt ?? Date.now(), sanityIssueId }`. Idempotent.

To patch a field back to absent, use `undefined` in the patch object (Convex clears optional fields set to `undefined`).
  </action>

  <verify>
    <automated>grep -q "export const ensureByNumber" convex/issues.ts && grep -q "export const hold" convex/issues.ts && grep -q "export const reopen" convex/issues.ts && grep -q "A reason is required to hold this issue." convex/issues.ts && grep -q "issue.held" convex/issues.ts && cd convex && pnpm exec tsc --noEmit</automated>
  </verify>

  <acceptance_criteria>
    - `convex/issues.ts` exports `byIssueNumber`, `listForWorkspace`, `ensureByNumber`, `hold`, `reopen`, `markPublished`
    - `grep -q "requireOperatorOrPipeline" convex/issues.ts` succeeds (ensureByNumber + markPublished dual lane)
    - `grep -q "requireOperator(ctx)" convex/issues.ts` succeeds (hold + reopen operator lane)
    - `grep -q "internal.auditLog.write" convex/issues.ts` succeeds
    - `grep -q "'A reason is required to hold this issue.'" convex/issues.ts` succeeds
    - `grep -q "created: false" convex/issues.ts` succeeds (the NO-OP return path)
    - ensureByNumber's existing-row branch does NOT contain a `ctx.db.patch` call (grep the function body — the NO-OP must not mutate)
    - `cd convex && pnpm exec tsc --noEmit` exits 0
  </acceptance_criteria>

  <done>convex/issues.ts implements all six §40.2 functions with correct guard lanes, the D-04 NO-OP guard, and audit-logged hold/reopen.</done>
</task>

<task type="auto">
  <name>Task 3: Add byIssueNumber + listByIssueNumber to convex/pipelineRuns.ts</name>

  <read_first>
    - docs/API_CONTRACTS.md §40.3 (the two query signatures and their DESC ordering)
    - convex/pipelineRuns.ts (the whole file — copy the existing `byRunId` query style; both new queries are PUBLIC/unguarded like it)
    - convex/schema.ts line 25 (the already-declared `by_issueNumber` index the new queries use)
  </read_first>

  <action>
Add two PUBLIC queries to `convex/pipelineRuns.ts` (matching the existing `byRunId` unguarded style):

```typescript
export const byIssueNumber = query({
  args: { issueNumber: v.number() },
  handler: async (ctx, { issueNumber }) => {
    const rows = await ctx.db
      .query('pipelineRuns')
      .withIndex('by_issueNumber', q => q.eq('issueNumber', issueNumber))
      .collect()
    // Most-recent run for this issue — the runId the issue-keyed /issues/[n]/review
    // and /issues/[n]/voice console routes resolve to.
    return rows.sort((a, b) => b.startedAt - a.startedAt)[0] ?? null
  },
})

export const listByIssueNumber = query({
  args: { issueNumber: v.number() },
  handler: async (ctx, { issueNumber }) => {
    const rows = await ctx.db
      .query('pipelineRuns')
      .withIndex('by_issueNumber', q => q.eq('issueNumber', issueNumber))
      .collect()
    return rows.sort((a, b) => b.startedAt - a.startedAt) // run history (D-08), newest first
  },
})
```
Do not modify the existing `byRunId`, `create`, or `updateStatus` exports.
  </action>

  <verify>
    <automated>grep -q "export const byIssueNumber" convex/pipelineRuns.ts && grep -q "export const listByIssueNumber" convex/pipelineRuns.ts && grep -q "by_issueNumber" convex/pipelineRuns.ts && cd convex && pnpm exec tsc --noEmit</automated>
  </verify>

  <acceptance_criteria>
    - `convex/pipelineRuns.ts` exports `byIssueNumber` and `listByIssueNumber`
    - Both use `.withIndex('by_issueNumber', ...)`
    - `byIssueNumber` returns a single row (or null); `listByIssueNumber` returns an array
    - Both sort by `startedAt` DESC
    - The existing `byRunId`, `create`, `updateStatus` exports are unchanged (`grep -c "export const" convex/pipelineRuns.ts` returns 5)
    - `cd convex && pnpm exec tsc --noEmit` exits 0
  </acceptance_criteria>

  <done>pipelineRuns exposes both issue-keyed queries the routing inversion (Plan 40-04) depends on.</done>
</task>

</tasks>

<verification>
- `cd convex && pnpm exec tsc --noEmit` exits 0 (schema + both new function files type-check).
- The RED convex-test file from 40-01 (`__tests__/issues.test.ts`) now has real functions to exercise — this plan does NOT run it (the tests turn GREEN once codegen runs; the Convex deploy + full test run is Plan 40-10's gate).
- `grep -c "status:" <(grep -A16 "issues: defineTable" convex/schema.ts)` returns 0 (no persisted issue status).
</verification>

<success_criteria>
- The issues table + all six issues.ts functions + both pipelineRuns issue-keyed queries exist and type-check, matching §40.1/§40.2/§40.3 verbatim.
- ensureByNumber is idempotent and cannot resurrect a Held issue (D-04); hold requires a reason and writes audit_log (D-16); reopen clears the hold (D-17).
</success_criteria>

<output>
After completion, create `.planning/phases/40-issue-entity-issues-home/40-02-SUMMARY.md`.
</output>
