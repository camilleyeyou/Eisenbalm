---
phase: 03-convex-deployment
plan: 03
type: execute
wave: 3
depends_on:
  - "03-02"
files_modified:
  - convex/pipelineRuns.ts
  - convex/pitchLog.ts
  - convex/deliberationEvents.ts
  - convex/agentVotes.ts
  - convex/qaCorrections.ts
autonomous: true
requirements:
  - CVX-02
  - CVX-03
must_haves:
  truths:
    - "Five Convex function files exist — one per table — with filenames exactly matching API_CONTRACTS §4.1–4.5"
    - "pipelineRuns.ts exports byRunId (query), create (mutation), updateStatus (mutation)"
    - "pitchLog.ts exports byRunId (query), insert (mutation), markSelected (mutation)"
    - "deliberationEvents.ts exports byRunId (query), byRunIdAndType (query), insert (mutation)"
    - "agentVotes.ts exports byRunId (query), byRunIdAndCharity (query), insert (mutation)"
    - "qaCorrections.ts exports byRunId (query), insert (mutation)"
    - "Every mutation that inserts a row sets `timestamp: Date.now()` server-side (D-12)"
    - "Every enum-like field uses v.literal(...) unions matching convex/schema.ts verbatim (D-11)"
    - "pipelineRuns.updateStatus throws if run not found (D-13)"
  artifacts:
    - path: "convex/pipelineRuns.ts"
      provides: "byRunId / create / updateStatus per API_CONTRACTS §4.1"
      exports: ["byRunId", "create", "updateStatus"]
    - path: "convex/pitchLog.ts"
      provides: "byRunId / insert / markSelected per API_CONTRACTS §4.2"
      exports: ["byRunId", "insert", "markSelected"]
    - path: "convex/deliberationEvents.ts"
      provides: "byRunId / byRunIdAndType / insert per API_CONTRACTS §4.3"
      exports: ["byRunId", "byRunIdAndType", "insert"]
    - path: "convex/agentVotes.ts"
      provides: "byRunId / byRunIdAndCharity / insert per API_CONTRACTS §4.4"
      exports: ["byRunId", "byRunIdAndCharity", "insert"]
    - path: "convex/qaCorrections.ts"
      provides: "byRunId / insert per API_CONTRACTS §4.5"
      exports: ["byRunId", "insert"]
  key_links:
    - from: "convex/*.ts function files"
      to: "convex/schema.ts table definitions"
      via: "Each function references its table by name + uses matching v.literal enums"
      pattern: "withIndex\\('by_runId'"
    - from: "convex/*.ts mutations"
      to: "Pipeline (Phase 4 caller via HTTP API)"
      via: "Argument validators (v.string, v.number, v.literal, v.optional) match API_CONTRACTS §3 payload shapes"
      pattern: "v\\.union\\(v\\.literal"
---

<objective>
Create the five Convex query/mutation files — one per table — by copying API_CONTRACTS §4.1–4.5 verbatim per D-10. No design work, no helper extractions, no consolidation into a single file. The Convex `api` object's surface is auto-derived from filename + export name, so `api.pipelineRuns.byRunId` requires exactly `convex/pipelineRuns.ts` exporting `byRunId`.

Purpose: Honors D-10 (one file per table, exact filenames, copy verbatim), D-11 (`v.literal(...)` enums match schema), D-12 (server-side `timestamp: Date.now()`), D-13 (`updateStatus` throws when not found). Resolves CVX-02 (queries exist) and CVX-03 (mutations exist). Field names locked across schema + contracts per CLAUDE.md.
Output: Five TypeScript files in `convex/` that Convex CLI will codegen against in Plan 03-04, producing `convex/_generated/api.{ts,d.ts,js}` so the web app can `useQuery(api.pipelineRuns.byRunId, ...)`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/03-convex-deployment/03-CONTEXT.md
@.planning/phases/03-convex-deployment/03-RESEARCH.md
@docs/API_CONTRACTS.md
@convex/schema.ts
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create convex/pipelineRuns.ts — byRunId, create, updateStatus</name>
  <files>convex/pipelineRuns.ts</files>
  <read_first>
    - docs/API_CONTRACTS.md §4.1 (verbatim source — copy exactly)
    - convex/schema.ts (verify status enum values: 'running' | 'awaiting-review' | 'complete' | 'failed' — note kebab-case `awaiting-review`)
    - .planning/phases/03-convex-deployment/03-RESEARCH.md §Code Examples §3 (the verbatim file content, identical to API_CONTRACTS §4.1)
    - .planning/phases/03-convex-deployment/03-CONTEXT.md D-10, D-11, D-13
    - CLAUDE.md ("do not modify field names without checking API_CONTRACTS.md first")
  </read_first>
  <action>
    Create `convex/pipelineRuns.ts` with EXACTLY this content (copy verbatim from API_CONTRACTS §4.1 — do not paraphrase, do not extract helpers, do not consolidate):

    ```typescript
    import { query, mutation } from './_generated/server'
    import { v } from 'convex/values'

    export const byRunId = query({
      args: { runId: v.string() },
      handler: async (ctx, { runId }) => {
        return await ctx.db
          .query('pipelineRuns')
          .withIndex('by_runId', q => q.eq('runId', runId))
          .first()
      },
    })

    export const create = mutation({
      args: {
        runId: v.string(),
        issueNumber: v.number(),
        startedAt: v.number(),
      },
      handler: async (ctx, args) => {
        return await ctx.db.insert('pipelineRuns', {
          ...args,
          status: 'running' as const,
        })
      },
    })

    export const updateStatus = mutation({
      args: {
        runId: v.string(),
        status: v.union(
          v.literal('running'),
          v.literal('awaiting-review'),
          v.literal('complete'),
          v.literal('failed'),
        ),
        completedAt: v.optional(v.number()),
        errorMessage: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        const run = await ctx.db
          .query('pipelineRuns')
          .withIndex('by_runId', q => q.eq('runId', args.runId))
          .first()
        if (!run) throw new Error(`Run not found: ${args.runId}`)
        const { runId, ...updates } = args
        await ctx.db.patch(run._id, updates)
      },
    })
    ```

    Critical: `'awaiting-review'` is kebab-case (matches `convex/schema.ts` line 11). `'running' as const` literal is preserved. `import { query, mutation } from './_generated/server'` — relative path, NOT `@convex/*` (Convex codegen requires relative imports from within `convex/`).
  </action>
  <verify>
    <automated>test -f convex/pipelineRuns.ts && grep -q "export const byRunId = query" convex/pipelineRuns.ts && grep -q "export const create = mutation" convex/pipelineRuns.ts && grep -q "export const updateStatus = mutation" convex/pipelineRuns.ts && grep -q "v.literal('awaiting-review')" convex/pipelineRuns.ts && grep -q "throw new Error" convex/pipelineRuns.ts && grep -q "from './_generated/server'" convex/pipelineRuns.ts</automated>
  </verify>
  <acceptance_criteria>
    - File exists at exact path `convex/pipelineRuns.ts`
    - Three named exports present: `byRunId` (query), `create` (mutation), `updateStatus` (mutation)
    - `updateStatus` args include the four-way `v.union(v.literal('running'), v.literal('awaiting-review'), v.literal('complete'), v.literal('failed'))` — kebab-case literals match `convex/schema.ts` lines 9-14 exactly
    - `updateStatus` handler contains `throw new Error` for missing-run case (D-13)
    - `create` handler hardcodes `status: 'running' as const`
    - Imports use relative path `'./_generated/server'` (NOT `@convex/*`) and `'convex/values'` for `v`
    - `cd convex && pnpm typecheck` exits 0 (codegen is from prior phase; this just confirms the function file parses)
  </acceptance_criteria>
  <done>
    File exists at exactly `convex/pipelineRuns.ts` with three named exports. The `updateStatus` mutation throws on missing run (D-13). All four `status` literal values are present and kebab-case (`awaiting-review`). The file is byte-for-byte equivalent to API_CONTRACTS §4.1.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create convex/pitchLog.ts — byRunId, insert, markSelected</name>
  <files>convex/pitchLog.ts</files>
  <read_first>
    - docs/API_CONTRACTS.md §4.2 (verbatim source)
    - convex/schema.ts (pitchLog table — note `selected: v.boolean()`, `charityId: v.optional(v.string())`)
    - .planning/phases/03-convex-deployment/03-CONTEXT.md D-10, D-12 (timestamp server-side)
  </read_first>
  <action>
    Create `convex/pitchLog.ts` with EXACTLY this content (verbatim from API_CONTRACTS §4.2):

    ```typescript
    import { query, mutation } from './_generated/server'
    import { v } from 'convex/values'

    export const byRunId = query({
      args: { runId: v.string() },
      handler: async (ctx, { runId }) => {
        return await ctx.db
          .query('pitchLog')
          .withIndex('by_runId', q => q.eq('runId', runId))
          .order('asc')
          .collect()
      },
    })

    export const insert = mutation({
      args: {
        runId: v.string(),
        charityId: v.optional(v.string()),
        charityName: v.string(),
        charityLocation: v.string(),
        charityWebsite: v.optional(v.string()),
        assetRange: v.optional(v.string()),
        focusArea: v.optional(v.string()),
        scoutSummary: v.string(),
        selected: v.boolean(),
      },
      handler: async (ctx, args) => {
        return await ctx.db.insert('pitchLog', {
          ...args,
          timestamp: Date.now(),
        })
      },
    })

    export const markSelected = mutation({
      args: {
        runId: v.string(),
        charityName: v.string(),
      },
      handler: async (ctx, { runId, charityName }) => {
        const entries = await ctx.db
          .query('pitchLog')
          .withIndex('by_runId', q => q.eq('runId', runId))
          .collect()
        await Promise.all(
          entries.map(entry =>
            ctx.db.patch(entry._id, { selected: entry.charityName === charityName })
          )
        )
      },
    })
    ```

    Critical: `timestamp: Date.now()` is set server-side in `insert` (D-12 — never trust caller's clock). `markSelected` patches every entry's `selected` field (matching wins true, others get false). `.order('asc')` on `byRunId` for chronological pitch log display.
  </action>
  <verify>
    <automated>test -f convex/pitchLog.ts && grep -q "export const byRunId = query" convex/pitchLog.ts && grep -q "export const insert = mutation" convex/pitchLog.ts && grep -q "export const markSelected = mutation" convex/pitchLog.ts && grep -q "timestamp: Date.now()" convex/pitchLog.ts && grep -q "selected: v.boolean()" convex/pitchLog.ts && grep -q ".order('asc')" convex/pitchLog.ts</automated>
  </verify>
  <acceptance_criteria>
    - File exists at exact path `convex/pitchLog.ts`
    - Three named exports present: `byRunId` (query), `insert` (mutation), `markSelected` (mutation)
    - `insert` handler contains `timestamp: Date.now()` (server-side, D-12)
    - `insert` args include `charityId: v.optional(v.string())`, `charityWebsite: v.optional(v.string())`, `assetRange: v.optional(v.string())`, `focusArea: v.optional(v.string())` — all four optional fields per schema.ts
    - `selected: v.boolean()` is required (not optional)
    - `byRunId` uses `.order('asc').collect()` (chronological pitch log)
    - `markSelected` collects all entries for the runId then patches each (`Promise.all` over `ctx.db.patch`)
    - No insertion mutation accepts `timestamp` as an arg (caller cannot spoof the clock)
  </acceptance_criteria>
  <done>
    File exists with three exports. `insert` sets `timestamp: Date.now()` server-side. `markSelected` flips `selected` across all entries for the given runId. `byRunId` orders ascending by creation time. All optional fields (`charityId`, `charityWebsite`, `assetRange`, `focusArea`) use `v.optional()`.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create convex/deliberationEvents.ts — byRunId, byRunIdAndType, insert</name>
  <files>convex/deliberationEvents.ts</files>
  <read_first>
    - docs/API_CONTRACTS.md §4.3 (verbatim source)
    - convex/schema.ts (deliberationEvents table — seven eventType literals: scout-finding | advocate-argument | editor-decision | section-draft | qa-correction | editor-final | publisher-deploy — all kebab-case)
    - .planning/phases/03-convex-deployment/03-CONTEXT.md D-10, D-11
  </read_first>
  <action>
    Create `convex/deliberationEvents.ts` with EXACTLY this content (verbatim from API_CONTRACTS §4.3):

    ```typescript
    import { query, mutation } from './_generated/server'
    import { v } from 'convex/values'

    export const byRunId = query({
      args: { runId: v.string() },
      handler: async (ctx, { runId }) => {
        return await ctx.db
          .query('deliberationEvents')
          .withIndex('by_runId', q => q.eq('runId', runId))
          .order('asc')
          .collect()
      },
    })

    export const byRunIdAndType = query({
      args: {
        runId: v.string(),
        eventType: v.string(),
      },
      handler: async (ctx, { runId, eventType }) => {
        return await ctx.db
          .query('deliberationEvents')
          .withIndex('by_runId_and_type', q =>
            q.eq('runId', runId).eq('eventType', eventType as any)
          )
          .order('asc')
          .collect()
      },
    })

    export const insert = mutation({
      args: {
        runId: v.string(),
        agentId: v.string(),
        eventType: v.union(
          v.literal('scout-finding'),
          v.literal('advocate-argument'),
          v.literal('editor-decision'),
          v.literal('section-draft'),
          v.literal('qa-correction'),
          v.literal('editor-final'),
          v.literal('publisher-deploy'),
        ),
        payload: v.string(),
        charityId: v.optional(v.string()),
        sectionName: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        return await ctx.db.insert('deliberationEvents', {
          ...args,
          timestamp: Date.now(),
        })
      },
    })
    ```

    Critical: All seven `eventType` literals are kebab-case and match schema.ts lines 28-34 exactly. `byRunIdAndType` accepts `eventType: v.string()` for query flexibility (callers pass any of the seven values), then casts to `as any` inside `withIndex` (this is the verbatim API_CONTRACTS pattern — keep it). `payload: v.string()` (JSON-encoded — pipeline does `json.dumps(...)` at write time per API_CONTRACTS §3.4).
  </action>
  <verify>
    <automated>test -f convex/deliberationEvents.ts && grep -q "export const byRunId = query" convex/deliberationEvents.ts && grep -q "export const byRunIdAndType = query" convex/deliberationEvents.ts && grep -q "export const insert = mutation" convex/deliberationEvents.ts && grep -q "v.literal('scout-finding')" convex/deliberationEvents.ts && grep -q "v.literal('advocate-argument')" convex/deliberationEvents.ts && grep -q "v.literal('editor-decision')" convex/deliberationEvents.ts && grep -q "v.literal('section-draft')" convex/deliberationEvents.ts && grep -q "v.literal('qa-correction')" convex/deliberationEvents.ts && grep -q "v.literal('editor-final')" convex/deliberationEvents.ts && grep -q "v.literal('publisher-deploy')" convex/deliberationEvents.ts && grep -q "timestamp: Date.now()" convex/deliberationEvents.ts</automated>
  </verify>
  <acceptance_criteria>
    - File exists at exact path `convex/deliberationEvents.ts`
    - Three named exports present: `byRunId` (query), `byRunIdAndType` (query), `insert` (mutation)
    - `insert.args.eventType` is exactly the seven-way `v.union(v.literal('scout-finding'), v.literal('advocate-argument'), v.literal('editor-decision'), v.literal('section-draft'), v.literal('qa-correction'), v.literal('editor-final'), v.literal('publisher-deploy'))` — kebab-case literals match schema.ts lines 28-34 byte-for-byte
    - `insert.args.payload` is `v.string()` (JSON-encoded string from pipeline)
    - `insert` handler sets `timestamp: Date.now()` server-side
    - `byRunIdAndType` uses `'by_runId_and_type'` compound index from schema
    - Both queries use `.order('asc').collect()`
    - `charityId` and `sectionName` mutation args are `v.optional(v.string())`
  </acceptance_criteria>
  <done>
    File exists with three exports. `insert` has a `v.union` of exactly seven kebab-case literal eventTypes matching schema.ts verbatim. `payload` is `v.string()` (JSON string from pipeline). Both queries order ascending. `byRunIdAndType` uses the compound `by_runId_and_type` index from schema.
  </done>
</task>

<task type="auto">
  <name>Task 4: Create convex/agentVotes.ts — byRunId, byRunIdAndCharity, insert</name>
  <files>convex/agentVotes.ts</files>
  <read_first>
    - docs/API_CONTRACTS.md §4.4 (verbatim source)
    - convex/schema.ts (agentVotes table — vote enum: 'for' | 'against' | 'abstain')
    - .planning/phases/03-convex-deployment/03-CONTEXT.md D-10, D-11
  </read_first>
  <action>
    Create `convex/agentVotes.ts` with EXACTLY this content (verbatim from API_CONTRACTS §4.4):

    ```typescript
    import { query, mutation } from './_generated/server'
    import { v } from 'convex/values'

    export const byRunId = query({
      args: { runId: v.string() },
      handler: async (ctx, { runId }) => {
        return await ctx.db
          .query('agentVotes')
          .withIndex('by_runId', q => q.eq('runId', runId))
          .order('asc')
          .collect()
      },
    })

    export const byRunIdAndCharity = query({
      args: { runId: v.string(), charityId: v.string() },
      handler: async (ctx, { runId, charityId }) => {
        return await ctx.db
          .query('agentVotes')
          .withIndex('by_runId_and_charity', q =>
            q.eq('runId', runId).eq('charityId', charityId)
          )
          .collect()
      },
    })

    export const insert = mutation({
      args: {
        runId: v.string(),
        agentId: v.string(),
        charityId: v.string(),
        charityName: v.string(),
        vote: v.union(v.literal('for'), v.literal('against'), v.literal('abstain')),
        reasoning: v.string(),
      },
      handler: async (ctx, args) => {
        return await ctx.db.insert('agentVotes', {
          ...args,
          timestamp: Date.now(),
        })
      },
    })
    ```

    Critical: `vote` is a three-way union (`for | against | abstain`) per schema lines 50-54. `charityId: v.string()` (required — agent votes are always tied to a specific charity, unlike `pitchLog.charityId` which is optional). `byRunIdAndCharity` uses the compound index `by_runId_and_charity`.
  </action>
  <verify>
    <automated>test -f convex/agentVotes.ts && grep -q "export const byRunId = query" convex/agentVotes.ts && grep -q "export const byRunIdAndCharity = query" convex/agentVotes.ts && grep -q "export const insert = mutation" convex/agentVotes.ts && grep -q "v.literal('for')" convex/agentVotes.ts && grep -q "v.literal('against')" convex/agentVotes.ts && grep -q "v.literal('abstain')" convex/agentVotes.ts && grep -q "timestamp: Date.now()" convex/agentVotes.ts && grep -q "by_runId_and_charity" convex/agentVotes.ts</automated>
  </verify>
  <acceptance_criteria>
    - File exists at exact path `convex/agentVotes.ts`
    - Three named exports present: `byRunId` (query), `byRunIdAndCharity` (query), `insert` (mutation)
    - `insert.args.vote` is exactly `v.union(v.literal('for'), v.literal('against'), v.literal('abstain'))` — matches schema.ts lines 50-54
    - `insert.args.charityId` is `v.string()` (REQUIRED, not optional — unlike pitchLog.charityId)
    - `insert` handler sets `timestamp: Date.now()` server-side
    - `byRunIdAndCharity` uses `'by_runId_and_charity'` compound index from schema (not `'by_runId'`)
    - `byRunId` uses `.order('asc').collect()`
    - `byRunIdAndCharity` uses `.collect()` (no `.order()` — matches API_CONTRACTS §4.4)
  </acceptance_criteria>
  <done>
    File exists with three exports. Vote literal union covers all three schema values. Both queries use the correct indices. `insert` sets server-side timestamp.
  </done>
</task>

<task type="auto">
  <name>Task 5: Create convex/qaCorrections.ts — byRunId, insert</name>
  <files>convex/qaCorrections.ts</files>
  <read_first>
    - docs/API_CONTRACTS.md §4.5 (verbatim source)
    - convex/schema.ts (qaCorrections table — severity enum: 'minor' | 'moderate' | 'major')
    - .planning/phases/03-convex-deployment/03-CONTEXT.md D-10, D-11
  </read_first>
  <action>
    Create `convex/qaCorrections.ts` with EXACTLY this content (verbatim from API_CONTRACTS §4.5):

    ```typescript
    import { query, mutation } from './_generated/server'
    import { v } from 'convex/values'

    export const byRunId = query({
      args: { runId: v.string() },
      handler: async (ctx, { runId }) => {
        return await ctx.db
          .query('qaCorrections')
          .withIndex('by_runId', q => q.eq('runId', runId))
          .order('asc')
          .collect()
      },
    })

    export const insert = mutation({
      args: {
        runId: v.string(),
        sectionName: v.string(),
        fieldName: v.string(),
        original: v.string(),
        corrected: v.string(),
        reason: v.string(),
        severity: v.union(
          v.literal('minor'),
          v.literal('moderate'),
          v.literal('major'),
        ),
        accepted: v.boolean(),
      },
      handler: async (ctx, args) => {
        return await ctx.db.insert('qaCorrections', {
          ...args,
          timestamp: Date.now(),
        })
      },
    })
    ```

    Critical: `severity` is `'minor' | 'moderate' | 'major'` per schema lines 70-74 (note `moderate`, NOT `major'` repeated). `accepted: v.boolean()` is required. `insert` sets server-side timestamp.
  </action>
  <verify>
    <automated>test -f convex/qaCorrections.ts && grep -q "export const byRunId = query" convex/qaCorrections.ts && grep -q "export const insert = mutation" convex/qaCorrections.ts && grep -q "v.literal('minor')" convex/qaCorrections.ts && grep -q "v.literal('moderate')" convex/qaCorrections.ts && grep -q "v.literal('major')" convex/qaCorrections.ts && grep -q "accepted: v.boolean()" convex/qaCorrections.ts && grep -q "timestamp: Date.now()" convex/qaCorrections.ts</automated>
  </verify>
  <acceptance_criteria>
    - File exists at exact path `convex/qaCorrections.ts`
    - Two named exports present: `byRunId` (query), `insert` (mutation)
    - `insert.args.severity` is exactly `v.union(v.literal('minor'), v.literal('moderate'), v.literal('major'))` — matches schema.ts lines 70-74 (no `major'` duplicate, no `minor'` typo)
    - `insert.args.accepted` is `v.boolean()` (required)
    - `qaCorrections:insert` mutation has args: 6 strings (`runId`, `sectionName`, `fieldName`, `original`, `corrected`, `reason`), 1 union (`severity: 'minor' | 'moderate' | 'major'`), 1 boolean (`accepted`) — **8 total args** matching `convex/schema.ts` qaCorrections table exactly
    - `insert` handler sets `timestamp: Date.now()` server-side
    - `byRunId` uses `.order('asc').collect()`
  </acceptance_criteria>
  <done>
    File exists with two exports. Severity literal union covers all three schema values (`minor`, `moderate`, `major` — no typos). All 8 args are present (6 strings + 1 union + 1 boolean). Server-side timestamp set.
  </done>
</task>

</tasks>

<verification>
- All five files exist in `convex/` with exact API_CONTRACTS filenames
- Each file imports from `'./_generated/server'` and `'convex/values'` only
- Each insert mutation sets `timestamp: Date.now()` server-side (D-12)
- Each enum-like arg uses `v.literal(...)` union matching schema.ts verbatim (D-11)
- `pipelineRuns.updateStatus` throws on missing run (D-13)
- No file references any other function file (no helper extractions)
- No file modifies `convex/schema.ts`
- The Convex CLI in Plan 03-04 will codegen `convex/_generated/api.d.ts` exposing:
  - `api.pipelineRuns.byRunId`, `api.pipelineRuns.create`, `api.pipelineRuns.updateStatus`
  - `api.pitchLog.byRunId`, `api.pitchLog.insert`, `api.pitchLog.markSelected`
  - `api.deliberationEvents.byRunId`, `api.deliberationEvents.byRunIdAndType`, `api.deliberationEvents.insert`
  - `api.agentVotes.byRunId`, `api.agentVotes.byRunIdAndCharity`, `api.agentVotes.insert`
  - `api.qaCorrections.byRunId`, `api.qaCorrections.insert`
</verification>

<success_criteria>
- CVX-02 satisfied: All five `byRunId` queries exist on disk and are byte-for-byte equivalent to API_CONTRACTS §4
- CVX-03 satisfied: All five insertion mutations plus `pipelineRuns.updateStatus`, `pitchLog.markSelected`, `deliberationEvents.byRunIdAndType`, `agentVotes.byRunIdAndCharity` exist
- Field names locked: every `v.literal(...)` value matches `convex/schema.ts` byte-for-byte (CLAUDE.md rule)
- Plan 03-04 (`convex dev --once` codegen + deploy) is unblocked
</success_criteria>

<output>
After completion, create `.planning/phases/03-convex-deployment/03-03-SUMMARY.md` recording (a) the five files created, (b) confirmation that no file extracted helpers or consolidated multiple tables, (c) any deviation from API_CONTRACTS §4 verbatim (target: zero), (d) line counts of each file (sanity check that nothing was truncated).
</output>
</content>
</invoke>