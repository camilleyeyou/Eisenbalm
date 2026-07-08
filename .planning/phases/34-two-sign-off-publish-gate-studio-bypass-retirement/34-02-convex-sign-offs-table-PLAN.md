---
phase: 34-two-sign-off-publish-gate-studio-bypass-retirement
plan: 02
type: execute
wave: 2
depends_on: [34-01]
files_modified:
  - convex/schema.ts
  - convex/signOffs.ts
autonomous: true
requirements: [PUB-01, PUB-04]

must_haves:
  truths:
    - "A sign_offs Convex table exists with one active row per (runId, kind), kind constrained to facts-cleared | sounds-human"
    - "signOffs:record upserts by (runId, kind) and clears any prior revocation on re-sign"
    - "signOffs:revokeAll patches revokedAt/revokedReason onto every active row for a run"
    - "signOffs:activeByRunId returns only active (unrevoked) rows keyed by kind; listByRunId returns all rows"
  artifacts:
    - path: "convex/schema.ts"
      provides: "sign_offs table definition"
      contains: "sign_offs: defineTable"
    - path: "convex/signOffs.ts"
      provides: "record / revokeAll mutations + activeByRunId / listByRunId queries"
      exports: ["record", "revokeAll", "activeByRunId", "listByRunId"]
  key_links:
    - from: "convex/signOffs.ts::record"
      to: "convex/lib/auth.ts::requirePipelineSecret"
      via: "pipeline-lane secret guard"
      pattern: "requirePipelineSecret"
---

<objective>
Add the new `sign_offs` Convex table (D-02) and the `convex/signOffs.ts` module (record / revokeAll mutations + activeByRunId / listByRunId queries) exactly per the frozen §34.1/§34.2 contract. This is the datastore the publish gate (34-03), the webhook re-check (34-04), the auto-revoke hook (34-05), and the rail's live subscription (34-06) all read/write.

Purpose: One append-friendly, audit-shaped attestation table with a single active row per (run, kind), so "both greens = publishable" and "content changed = both greens void" are enforceable server-side.
Output: `convex/schema.ts` gains the `sign_offs` table; `convex/signOffs.ts` is new.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-CONTEXT.md
@.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- Existing Convex conventions to mirror exactly. -->
From convex/schema.ts (claim_checks / review_actions — the defineTable + .index style to copy):
```typescript
claim_checks: defineTable({ workspace_id: v.string(), runId: v.string(), /* ... */ checkedAt: v.optional(v.number()) })
  .index('by_runId', ['runId']).index('by_workspace', ['workspace_id']),
review_actions: defineTable({ workspace_id: v.string(), runId: v.string(), actorId: v.string(), action: v.string(), note: v.optional(v.string()), timestamp: v.number() })
  .index('by_workspace', ['workspace_id']).index('by_runId', ['runId']),
```
From convex/reviewActions.ts (the mutation + requirePipelineSecret + Date.now() pattern):
```typescript
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requirePipelineSecret } from './lib/auth'
export const record = mutation({
  args: { workspace_id: v.string(), runId: v.string(), actorId: v.string(), action: v.string(), note: v.optional(v.string()), pipelineSecret: v.optional(v.string()) },
  handler: async (ctx, args) => { requirePipelineSecret(args.pipelineSecret); await ctx.db.insert('review_actions', { /* ... */ timestamp: Date.now() }) },
})
export const listByRunId = query({ args: { runId: v.string() }, handler: async (ctx, { runId }) => { /* withIndex by_runId, collect, sort */ } })
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add the sign_offs table to convex/schema.ts</name>
  <read_first>
    - convex/schema.ts (lines 397-425 — the claim_checks + review_actions tables; append sign_offs directly after review_actions, before the closing `})` of defineSchema)
    - docs/API_CONTRACTS.md §34.1 (the frozen sign_offs shape)
    - convex/_generated/ai/guidelines.md (Convex API rules — read before writing Convex code, per convex/CLAUDE.md)
  </read_first>
  <action>
In `convex/schema.ts`, append a new `sign_offs` table immediately after the `review_actions` table definition (after its `.index('by_runId', ['runId'])` line, ~L424) and before the `})` that closes `defineSchema`. Use this EXACT shape from §34.1:
```typescript
  // ── sign_offs: two-sign-off publish gate (Phase 34 PUB-01) ──────────────────
  // One active row per (runId, kind). "Active" = revokedAt absent. Both kinds
  // active (unrevoked) is the publish/schedule gate (§34.4) and the webhook
  // re-check (§34.5). Content mutations revoke both (§34.6). Re-signing PATCHES
  // the same row and clears the revocation (§34.2).
  sign_offs: defineTable({
    workspace_id: v.string(),
    runId: v.string(),
    kind: v.union(v.literal('facts-cleared'), v.literal('sounds-human')),
    actorId: v.string(),          // verified-upstream Clerk sub from the FastAPI endpoint
    signedAt: v.number(),         // Unix ms
    revokedAt: v.optional(v.number()),      // present = revoked; absent = active
    revokedReason: v.optional(v.string()),
  })
    .index('by_runId', ['runId'])
    .index('by_runId_and_kind', ['runId', 'kind'])
    .index('by_workspace', ['workspace_id']),
```
Do NOT modify any existing table or field name.
  </action>
  <verify>
    <automated>grep -q "sign_offs: defineTable" convex/schema.ts && grep -q "by_runId_and_kind" convex/schema.ts && grep -q "v.literal('facts-cleared')" convex/schema.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "sign_offs: defineTable" convex/schema.ts` succeeds
    - `grep -q "v.union(v.literal('facts-cleared'), v.literal('sounds-human'))" convex/schema.ts` succeeds (kind is the constrained union, not a free string)
    - `grep -c "by_runId_and_kind" convex/schema.ts` returns ≥ 1 (upsert index present)
    - `grep -q "revokedAt: v.optional(v.number())" convex/schema.ts` succeeds
    - No existing field renamed: `git diff convex/schema.ts` shows only additions inside the `sign_offs` block (no `-` lines touching other tables)
  </acceptance_criteria>
  <done>The sign_offs table is defined with the exact §34.1 shape and three indexes, appended after review_actions, no existing table touched.</done>
</task>

<task type="auto">
  <name>Task 2: Create convex/signOffs.ts (record / revokeAll / activeByRunId / listByRunId)</name>
  <read_first>
    - convex/reviewActions.ts (the full module — record mutation with requirePipelineSecret + Date.now(); listByRunId query pattern to mirror)
    - convex/claimChecks.ts (setStatus mutation + allSignedOff/listByRunId queries — another mirror for the query shapes)
    - convex/lib/auth.ts (requirePipelineSecret signature — imported as-is)
    - docs/API_CONTRACTS.md §34.2 (the four frozen function signatures + upsert/revoke semantics)
  </read_first>
  <action>
Create `convex/signOffs.ts` importing `{ mutation, query } from './_generated/server'`, `{ v } from 'convex/values'`, and `{ requirePipelineSecret } from './lib/auth'`. Implement exactly per §34.2:

**`record` (mutation, pipeline-lane):**
```typescript
export const record = mutation({
  args: {
    workspace_id: v.string(),
    runId: v.string(),
    kind: v.union(v.literal('facts-cleared'), v.literal('sounds-human')),
    actorId: v.string(),
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { workspace_id, runId, kind, actorId, pipelineSecret }) => {
    requirePipelineSecret(pipelineSecret)
    const existing = await ctx.db
      .query('sign_offs')
      .withIndex('by_runId_and_kind', q => q.eq('runId', runId).eq('kind', kind))
      .unique()
    if (existing) {
      // Re-sign PATCHES the same row and clears any prior revocation (§34.2).
      await ctx.db.patch(existing._id, { actorId, signedAt: Date.now(), revokedAt: undefined, revokedReason: undefined })
    } else {
      await ctx.db.insert('sign_offs', { workspace_id, runId, kind, actorId, signedAt: Date.now() })
    }
  },
})
```

**`revokeAll` (mutation, pipeline-lane):** args `{ runId: v.string(), reason: v.string(), pipelineSecret: v.optional(v.string()) }`. Call `requirePipelineSecret(pipelineSecret)`. Query `sign_offs` `by_runId`, filter to rows where `revokedAt === undefined`, and `ctx.db.patch(row._id, { revokedAt: Date.now(), revokedReason: reason })` for each. No-op when none active.

**`activeByRunId` (query, PUBLIC — no guard):** args `{ runId: v.string() }`. Query `by_runId`, collect, and build an object of ACTIVE rows only (`revokedAt === undefined`), keyed by `kind`, each value `{ actorId, signedAt }`. Return that object (e.g. `{ 'facts-cleared': { actorId, signedAt } }`). A kind absent from the object = not signed / revoked.

**`listByRunId` (query, PUBLIC):** args `{ runId: v.string() }`. Query `by_runId`, collect, return all rows sorted by `signedAt` descending (newest first) for the rail's who-signed-when display.

Add a module docstring citing §34.2 and noting: mutations are pipeline-lane (secret-guarded, called only by the FastAPI sign-off/revoke paths with verified-upstream `actorId`); queries are public per the existing `claimChecks:allSignedOff` unguarded-read convention (Pitfall 2 — the webhook re-check calls `activeByRunId` with no Clerk JWT).
  </action>
  <verify>
    <automated>grep -q "export const record = mutation" convex/signOffs.ts && grep -q "export const revokeAll = mutation" convex/signOffs.ts && grep -q "export const activeByRunId = query" convex/signOffs.ts && grep -q "export const listByRunId = query" convex/signOffs.ts && grep -q "requirePipelineSecret" convex/signOffs.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "requirePipelineSecret" convex/signOffs.ts` returns ≥ 2 (both record and revokeAll guard the secret)
    - `grep -q "by_runId_and_kind" convex/signOffs.ts` succeeds (record upserts via the compound index)
    - `grep -q "revokedAt: undefined" convex/signOffs.ts` succeeds (re-sign clears revocation)
    - `activeByRunId` filters out revoked rows: `grep -q "revokedAt === undefined" convex/signOffs.ts` succeeds
    - Neither query declares `pipelineSecret` (public reads): the `query({ args:` blocks for activeByRunId/listByRunId contain only `runId` — verify by reading the file
  </acceptance_criteria>
  <done>convex/signOffs.ts exports record (secret-guarded upsert), revokeAll (secret-guarded patch), and the two public queries, matching §34.2 exactly.</done>
</task>

</tasks>

<verification>
- `grep -q "sign_offs: defineTable" convex/schema.ts` and all four exports exist in `convex/signOffs.ts`.
- Mutations call `requirePipelineSecret`; queries do not.
</verification>

<success_criteria>
- The sign_offs table + signOffs.ts exist and match §34.1/§34.2; the pipeline plans can call these paths by name.
</success_criteria>

<output>
After completion, create `.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-02-SUMMARY.md`
</output>
