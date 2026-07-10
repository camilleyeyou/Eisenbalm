---
phase: 39-registry-coverage-memory-strip
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - convex/schema.ts
  - convex/charityCorrections.ts
  - convex/charities.ts
  - apps/dispatch-control/__tests__/charity-corrections-append-only.test.ts
autonomous: true
requirements: [MEM-01, MEM-02, MEM-03]
must_haves:
  truths:
    - "API_CONTRACTS §39 documents the charity_corrections table, its append/listByCharityKey functions, charities.listRecentFeatured, and GET /registry/coverage-strip BEFORE any code that implements them"
    - "A charity_corrections append-only Convex table exists with a by_workspace_charityKey index"
    - "charityCorrections.append requires operator identity and writes an audit_log row"
    - "charityCorrections exposes only append + listByCharityKey (no update/patch/delete export)"
    - "charities.listRecentFeatured returns at most 8 featured charities ordered by lastFeaturedAt desc"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "§39 contract for corrections table, mutation/query, coverage endpoint"
      contains: "§39"
    - path: "convex/schema.ts"
      provides: "charity_corrections table definition"
      contains: "charity_corrections"
    - path: "convex/charityCorrections.ts"
      provides: "append (requireOperator + audit) + listByCharityKey (unguarded)"
      exports: ["append", "listByCharityKey"]
    - path: "convex/charities.ts"
      provides: "listRecentFeatured query"
      contains: "listRecentFeatured"
    - path: "apps/dispatch-control/__tests__/charity-corrections-append-only.test.ts"
      provides: "source-scan tripwire proving no edit/delete path exists"
      contains: "charityCorrections"
  key_links:
    - from: "convex/charityCorrections.ts append"
      to: "internal.auditLog.write"
      via: "ctx.runMutation"
      pattern: "internal\\.auditLog\\.write"
    - from: "convex/charities.ts listRecentFeatured"
      to: "by_workspace_status index"
      via: "withIndex"
      pattern: "by_workspace_status"
---

<objective>
Lay the contract + Convex foundations every Phase 39 consumer depends on: amend the API contract FIRST (project HARD rule), then add the append-only `charity_corrections` table, its `append`/`listByCharityKey` functions, and the `charities:listRecentFeatured` query.

Purpose: All three downstream plans (coverage endpoint, corrections UI, Researcher read) block on these primitives. Contract-first is a non-negotiable CLAUDE.md rule — the contract must land before the schema/functions.
Output: Amended `docs/API_CONTRACTS.md` §39, `charity_corrections` table + `convex/charityCorrections.ts`, `charities:listRecentFeatured`, and an append-only source-scan tripwire.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/39-registry-coverage-memory-strip/39-CONTEXT.md
@.planning/phases/39-registry-coverage-memory-strip/39-RESEARCH.md
@convex/CLAUDE.md

<interfaces>
<!-- Executor: use these directly. Do NOT re-derive dedup-key logic or invent taxonomy. -->

charities table (convex/schema.ts ~L367) — ALREADY EXISTS, do not modify:
  { workspace_id, name, status, timesFeatured?, lastFeaturedAt?, dedupKey?, website?, domain?, sanityCharityId?, firstSeenRunId? }
  indexes: by_workspace, by_workspace_dedupKey, by_workspace_status
  dedupKey format = "{name.trim().toLowerCase()}|{domain}" (Phase 26 §26.1)

Audit precedent to copy EXACTLY (convex/promptVersions.ts saveVersion):
  const actor = await requireOperator(ctx)
  const id = await ctx.db.insert(...)
  await ctx.runMutation(internal.auditLog.write, {
    workspace_id, actorId: actor, action: '<action>',
    resourceType: '<type>', resourceId: '<id>', after: JSON.stringify({...}),
  })
  // auditLog.write args: { workspace_id, actorId, action, resourceType?, resourceId?, before?, after? }

Guards: requireOperator(ctx): Promise<string> from './lib/auth' (returns Clerk actorId).
Queries in this codebase are UNGUARDED (read-only) — listByCharityKey takes NO auth guard.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Amend API_CONTRACTS.md with §39 (contract-first gate)</name>
  <read_first>
    - docs/API_CONTRACTS.md (read §26 registry section ~L1980-2260 for shape/heading convention; read the §35/§36/§37/§38 headings — convention is `## §NN — Title (Phase NN)`)
    - .planning/phases/39-registry-coverage-memory-strip/39-RESEARCH.md (§"charity_corrections — proposed schema", §"Last-8 coverage strip — data flow", §"Researcher corrections read")
  </read_first>
  <action>
    Add a NEW section `## §39 — Registry Coverage-Memory Strip (Phase 39)` at the end of docs/API_CONTRACTS.md (after §38), following the existing per-phase heading convention. Document, verbatim to what later tasks implement:

    §39.1 — `charity_corrections` Convex table:
      { workspace_id: string, charityKey: string (registry dedupKey, §26.1 format — PRIMARY match key), sanityCharityId?: string (denormalized convenience), text: string, author: string (Clerk actorId from requireOperator — NEVER client-supplied), createdAt: number }
      indexes: by_workspace_charityKey [workspace_id, charityKey], by_workspace [workspace_id]
      APPEND-ONLY: never updated or deleted (the log IS the durable record).

    §39.2 — `convex/charityCorrections.ts` functions:
      - append({ workspace_id, charityKey, sanityCharityId?, text }) -> Id<'charity_corrections'> — requireOperator-guarded; inserts row with author=actor, createdAt=Date.now(); writes internal.auditLog.write with action 'charity_correction.added', resourceType 'charity_correction', resourceId=charityKey, after=JSON.stringify({ text }). Dashboard-only mutation (matches promptVersions.saveVersion / charities.setStatus convention).
      - listByCharityKey({ workspace_id, charityKey }) -> Doc<'charity_corrections'>[] — UNGUARDED query; by_workspace_charityKey index; sorted createdAt ASC (chronological, oldest first).
      - NO update/patch/remove/delete function is defined (append-only, D-05 / Pitfall 3).

    §39.3 — `charities:listRecentFeatured({ workspace_id, limit? }) -> Doc<'charities'>[]` — uses by_workspace_status index (status 'featured'), sorted lastFeaturedAt desc, take(limit ?? 8).

    §39.4 — `GET /registry/coverage-strip` (FastAPI, Clerk-guarded, read-only, no audit row):
      Response: `[{ name, sanityCharityId, lastFeaturedAt, cause, geo, signal }]` (8 or fewer), where cause=Sanity charity.focusArea, geo=charity.location, signal=charity.scoutNotes (truncated for chip display). Server joins charities:listRecentFeatured → Sanity `*[_type=="charity" && _id in $ids]{_id, focusArea, location, scoutNotes}` by _id==sanityCharityId, preserving lastFeaturedAt-desc order. Rows lacking sanityCharityId render empty chips, never crash (Pitfall 6). Note WHY server-side: dispatch-control has zero Sanity access (EDT-05, tripwire-enforced).

    §39.5 — Researcher corrections read: the Researcher computes dedupKey via the existing `charity_registry.make_dedup_key(name, website)`, calls `charityCorrections:listByCharityKey`, injects corrections text into its prompt, and logs the count (MEM-03 verifiability).

    Also add a one-line cross-reference under the §26 registry section: `> Phase 39 extends the registry with a coverage-memory strip + append-only corrections log — see §39.`
  </action>
  <verify>
    <automated>grep -n "## §39 — Registry Coverage-Memory Strip" docs/API_CONTRACTS.md && grep -n "charity_corrections" docs/API_CONTRACTS.md && grep -n "listRecentFeatured" docs/API_CONTRACTS.md && grep -n "coverage-strip" docs/API_CONTRACTS.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "## §39 — Registry Coverage-Memory Strip (Phase 39)" docs/API_CONTRACTS.md` returns 1
    - `grep -q "by_workspace_charityKey" docs/API_CONTRACTS.md` succeeds
    - `grep -q "charity_correction.added" docs/API_CONTRACTS.md` succeeds
    - `grep -q "GET /registry/coverage-strip" docs/API_CONTRACTS.md` succeeds
    - `grep -q "make_dedup_key" docs/API_CONTRACTS.md` succeeds
    - `grep -q "see §39" docs/API_CONTRACTS.md` succeeds (cross-ref from §26)
  </acceptance_criteria>
  <done>docs/API_CONTRACTS.md contains a complete §39 documenting the table, both Convex functions, listRecentFeatured, the coverage endpoint shape, and the Researcher read, plus a §26 cross-reference — landed BEFORE any implementing code.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: charity_corrections table + charityCorrections.ts + append-only tripwire</name>
  <read_first>
    - convex/schema.ts (read the claim_checks table ~L421 and charities table ~L367 for defineTable/index style)
    - convex/promptVersions.ts (saveVersion ~L194-239 — the requireOperator + insert + internal.auditLog.write pattern to copy EXACTLY)
    - convex/charities.ts (top imports ~L1-20 — `requireOperator` import path `./lib/auth`; `internal` import path)
    - convex/auditLog.ts (write args ~L37-45)
    - apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts (source-scan tripwire pattern to mirror for the append-only test)
    - convex/CLAUDE.md → then convex/_generated/ai/guidelines.md (Convex API rules)
  </read_first>
  <behavior>
    - Tripwire test: reading convex/charityCorrections.ts source, the exported function names include `append` and `listByCharityKey` and DO NOT include any of: `update`, `patch`, `remove`, `delete`, `edit` (append-only enforcement, Pitfall 3).
    - append inserts a row and calls internal.auditLog.write (asserted by presence in source; no Convex unit harness needed).
  </behavior>
  <action>
    RED first — author `apps/dispatch-control/__tests__/charity-corrections-append-only.test.ts` (Vitest): read `../../convex/charityCorrections.ts` as text (path relative to the test file — resolve via `path.join(__dirname, ...)` + `fs.readFileSync`, mirroring dispatch-control-no-sanity-write.test.ts); assert the source contains `export const append` and `export const listByCharityKey`, and assert it does NOT match `/export const (update|patch|remove|delete|edit)/`. Run it — it fails RED (file missing).

    Then GREEN:
    1. convex/schema.ts — add the `charity_corrections` table (place it right after the `charities` table block for locality):
       ```
       charity_corrections: defineTable({
         workspace_id: v.string(),
         charityKey: v.string(),
         sanityCharityId: v.optional(v.string()),
         text: v.string(),
         author: v.string(),
         createdAt: v.number(),
       })
         .index('by_workspace_charityKey', ['workspace_id', 'charityKey'])
         .index('by_workspace', ['workspace_id']),
       ```
    2. Create convex/charityCorrections.ts:
       - `import { mutation, query } from './_generated/server'`; `import { v } from 'convex/values'`; `import { internal } from './_generated/api'`; `import { requireOperator } from './lib/auth'`.
       - `export const append = mutation({ args: { workspace_id: v.string(), charityKey: v.string(), sanityCharityId: v.optional(v.string()), text: v.string() }, handler: async (ctx, { workspace_id, charityKey, sanityCharityId, text }) => { const actor = await requireOperator(ctx); const id = await ctx.db.insert('charity_corrections', { workspace_id, charityKey, sanityCharityId, text, author: actor, createdAt: Date.now() }); await ctx.runMutation(internal.auditLog.write, { workspace_id, actorId: actor, action: 'charity_correction.added', resourceType: 'charity_correction', resourceId: charityKey, after: JSON.stringify({ text }) }); return id } })`
       - `export const listByCharityKey = query({ args: { workspace_id: v.string(), charityKey: v.string() }, handler: async (ctx, { workspace_id, charityKey }) => { return await ctx.db.query('charity_corrections').withIndex('by_workspace_charityKey', q => q.eq('workspace_id', workspace_id).eq('charityKey', charityKey)).collect() } })` — index returns ascending by insertion (createdAt asc); do not reverse.
       - Do NOT add update/patch/remove/delete. Do NOT re-derive dedupKey here — caller passes charityKey (Pitfall 5).
    3. Run `pnpm --filter @eisenbalm/convex exec convex codegen` (or the repo's codegen script) so `_generated` reflects the new table, then re-run the tripwire test — GREEN.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run charity-corrections-append-only</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "charity_corrections: defineTable" convex/schema.ts` succeeds
    - `grep -q "by_workspace_charityKey" convex/schema.ts` succeeds
    - `grep -Eq "export const append" convex/charityCorrections.ts` succeeds
    - `grep -Eq "export const listByCharityKey" convex/charityCorrections.ts` succeeds
    - `grep -Eq "export const (update|patch|remove|delete|edit)" convex/charityCorrections.ts` returns NOTHING (exit 1)
    - `grep -q "internal.auditLog.write" convex/charityCorrections.ts` succeeds
    - `npx vitest run charity-corrections-append-only` passes (from apps/dispatch-control)
  </acceptance_criteria>
  <done>The append-only table exists, charityCorrections.ts exposes exactly append (guarded + audited) and listByCharityKey (unguarded), and the source-scan tripwire is green.</done>
</task>

<task type="auto">
  <name>Task 3: charities:listRecentFeatured query</name>
  <read_first>
    - convex/charities.ts (read listByWorkspace ~L197 and listForDedup ~L223 for the query + index-filter style; note by_workspace_status index exists on charities)
    - convex/schema.ts (charities by_workspace_status index ~L383)
  </read_first>
  <action>
    Add to convex/charities.ts a new query:
    `export const listRecentFeatured = query({ args: { workspace_id: v.string(), limit: v.optional(v.number()) }, handler: async (ctx, { workspace_id, limit }) => { const rows = await ctx.db.query('charities').withIndex('by_workspace_status', q => q.eq('workspace_id', workspace_id).eq('status', 'featured')).collect(); rows.sort((a, b) => (b.lastFeaturedAt ?? 0) - (a.lastFeaturedAt ?? 0)); return rows.slice(0, limit ?? 8) } })`
    Unguarded (read-only) — matches listByWorkspace/listForDedup convention. Do NOT add an auth guard.
    Run codegen so `api.charities.listRecentFeatured` is generated.
  </action>
  <verify>
    <automated>grep -q "export const listRecentFeatured" convex/charities.ts && grep -q "by_workspace_status" convex/charities.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export const listRecentFeatured = query" convex/charities.ts` succeeds
    - `grep -q "q.eq('status', 'featured')" convex/charities.ts` succeeds (or equivalent .eq status featured)
    - `grep -q "limit ?? 8" convex/charities.ts` succeeds
    - listRecentFeatured has NO requireOperator/requirePipelineSecret call in its handler
  </acceptance_criteria>
  <done>charities:listRecentFeatured returns ≤8 featured charities ordered by lastFeaturedAt desc via the existing by_workspace_status index, unguarded.</done>
</task>

</tasks>

<verification>
- API_CONTRACTS §39 landed before any implementing code (Task 1 is the gate).
- `charity_corrections` table + append/listByCharityKey exist; append is guarded + audited; no mutate/delete path.
- charities:listRecentFeatured returns featured rows, lastFeaturedAt-desc, capped at 8.
- `cd apps/dispatch-control && npx vitest run charity-corrections-append-only` is green.
- Convex `_generated` reflects the new table + functions (codegen ran).
</verification>

<success_criteria>
- Contract-first honored: §39 documents the table, functions, endpoint, and Researcher read.
- Downstream plans (39-02/03/04) can import `api.charityCorrections.*` and `api.charities.listRecentFeatured`.
- Append-only tripwire green; no edit/delete path exists.
</success_criteria>

<output>
After completion, create `.planning/phases/39-registry-coverage-memory-strip/39-01-SUMMARY.md`.
</output>
