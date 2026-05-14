---
phase: 04-pipeline-skeleton
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - convex/schema.ts
  - convex/pipelineRuns.ts
  - convex/README.md
autonomous: false
requirements:
  - PIP-11
  - PIP-12
must_haves:
  truths:
    - "convex/schema.ts pipelineRuns table accepts two new optional fields: `durationMs: v.optional(v.number())` and `cost: v.optional(v.string())`"
    - "convex/pipelineRuns.ts:updateStatus mutation args accept both new optional fields (`durationMs?` and `cost?`)"
    - "`pnpm --filter @eisenbalm/convex deploy` succeeds and the Convex dashboard reflects the new schema + extended mutation signature"
    - "Existing pipelineRuns rows (none yet — table is empty) remain forward-compatible"
    - "convex/README.md has a one-line note crediting Phase 4 with adding the new fields"
  artifacts:
    - path: "convex/schema.ts"
      provides: "pipelineRuns schema with durationMs + cost"
      contains: "durationMs: v.optional(v.number())"
    - path: "convex/pipelineRuns.ts"
      provides: "updateStatus accepting the two new args"
      contains: "durationMs: v.optional(v.number())"
  key_links:
    - from: "convex/schema.ts pipelineRuns.cost"
      to: "Sanity weeklyIssue.pipelineMetadata.cost"
      via: "Pipeline writes the same JSON-stringified payload to both (CONTEXT D-22)"
      pattern: "json.dumps"
    - from: "convex/pipelineRuns.ts:updateStatus"
      to: "Python lib/convex_client.py:convex_mutation('pipelineRuns:updateStatus', ...)"
      via: "Mutation arg validators define the wire contract"
      pattern: "pipelineRuns:updateStatus"
---

<objective>
Patch the Convex schema and updateStatus mutation to accept the two new optional fields Phase 4 needs to persist per-run cost + duration. This is the ONLY Convex contract change in Phase 4 — additive, forward-compatible, and mirrors the established Phase 3 D-04 redeploy workflow.

This plan is `autonomous: false` because the redeploy step (`pnpm --filter @eisenbalm/convex deploy`) prompts for a deployment selection and requires Andrew's logged-in `convex` CLI — same posture as Phase 3 D-04 (the original Convex deploy plan).

Purpose: PIP-11 (per-run cost on `pipelineRuns.cost`) and PIP-12 (wall-clock duration on `pipelineRuns.durationMs`) — CONTEXT D-22, D-23, D-39.
Output: Schema diff committed; Convex dashboard shows the extended validator on `updateStatus`; pipeline can write `cost` + `durationMs` to Convex without rejection.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-pipeline-skeleton/04-CONTEXT.md
@.planning/phases/04-pipeline-skeleton/04-RESEARCH.md
@convex/schema.ts
@convex/pipelineRuns.ts
@convex/README.md
@.planning/phases/03-convex-deployment/03-CONTEXT.md
</context>

<interfaces>
<!-- Current convex/schema.ts pipelineRuns table (verbatim, lines 5-21): -->

```typescript
pipelineRuns: defineTable({
  runId: v.string(),
  issueNumber: v.number(),
  status: v.union(
    v.literal('running'),
    v.literal('awaiting-review'),
    v.literal('complete'),
    v.literal('failed'),
  ),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  errorMessage: v.optional(v.string()),
})
  .index('by_runId', ['runId'])
  .index('by_issueNumber', ['issueNumber']),
```

<!-- Current convex/pipelineRuns.ts updateStatus mutation (verbatim, lines 28-49): -->

```typescript
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
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Add durationMs + cost optional fields to pipelineRuns schema</name>
  <files>convex/schema.ts</files>
  <read_first>
    - convex/schema.ts (verbatim — preserve every other field, every other table, every index)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-22 (cost is a JSON-stringified payload — string, not object — to mirror the existing modelVersions pattern; planner discretion: object validation can come in Phase 5)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-23 (durationMs is plain optional number — Unix ms)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-39 (additive patches only — every other table + every index untouched)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §6 "The two Phase 4 schema-patch concerns" (existing rows are forward-compatible; optional fields default to undefined)
    - convex/CLAUDE.md (read `convex/_generated/ai/guidelines.md` first per project rules)
  </read_first>
  <action>
    Edit `convex/schema.ts`. In the `pipelineRuns` table definition (lines 5-21), add the two new optional fields RIGHT BEFORE the closing `})` of `defineTable({...})`, AFTER `errorMessage`:

    ```typescript
    pipelineRuns: defineTable({
      runId: v.string(),
      issueNumber: v.number(),
      status: v.union(
        v.literal('running'),
        v.literal('awaiting-review'),
        v.literal('complete'),
        v.literal('failed'),
      ),
      startedAt: v.number(),
      completedAt: v.optional(v.number()),
      errorMessage: v.optional(v.string()),
      // ── Phase 4 additions (CONTEXT D-22, D-23, D-39) ────────────────────────
      durationMs: v.optional(v.number()),  // PIP-12: pipeline wall-clock ms
      cost: v.optional(v.string()),         // PIP-11 + OPS-03: JSON-stringified per-agent cost summary
    })
      .index('by_runId', ['runId'])
      .index('by_issueNumber', ['issueNumber']),
    ```

    Critical constraints:
    - Do NOT modify ANY other table (deliberationEvents, agentVotes, qaCorrections, pitchLog).
    - Do NOT modify the existing indexes on pipelineRuns.
    - Do NOT modify the existing field names or types.
    - The two new lines are ADDITIVE-ONLY.

    After saving, run `pnpm --filter @eisenbalm/convex exec convex dev --once` locally if a logged-in convex CLI is available — this regenerates `convex/_generated/dataModel.d.ts` with the new field types. (If the CLI is not logged in locally, skip this step; Task 3's deploy regenerates remotely.) Inspect the generated `dataModel.d.ts` to confirm `durationMs?: number` and `cost?: string` appear in the `pipelineRuns` document type.
  </action>
  <verify>
    <automated>grep -F "durationMs: v.optional(v.number())" convex/schema.ts && grep -F "cost: v.optional(v.string())" convex/schema.ts && grep -F "by_issueNumber" convex/schema.ts && grep -F "deliberationEvents:" convex/schema.ts && grep -F "qaCorrections:" convex/schema.ts && grep -F "agentVotes:" convex/schema.ts && grep -F "pitchLog:" convex/schema.ts</automated>
  </verify>
  <done>
    - `convex/schema.ts` `pipelineRuns` table contains the two new optional fields with EXACT validators `v.optional(v.number())` and `v.optional(v.string())`
    - All four other tables (deliberationEvents, agentVotes, qaCorrections, pitchLog) are untouched
    - Both indexes on `pipelineRuns` (`by_runId`, `by_issueNumber`) preserved
    - No existing field renamed, retyped, or reordered
  </done>
</task>

<task type="auto">
  <name>Task 2: Extend pipelineRuns:updateStatus mutation args to accept durationMs + cost</name>
  <files>convex/pipelineRuns.ts</files>
  <read_first>
    - convex/pipelineRuns.ts (current — preserve byRunId and create exactly; only updateStatus changes)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-22 + D-39 (extend updateStatus args to accept both new fields as optional)
    - docs/API_CONTRACTS.md §3.2 (Python call shape — pipelineRuns:updateStatus accepts cost/durationMs in args dict)
    - convex/CLAUDE.md (use generated server import paths exactly — `./_generated/server`)
  </read_first>
  <action>
    Edit `convex/pipelineRuns.ts`. In the `updateStatus` mutation (lines 28-49), add `durationMs` + `cost` to the `args` validator object, AFTER `errorMessage`. Do NOT touch `byRunId` (lines 4-12) or `create` (lines 14-26). The handler does NOT need any change — `args` destructuring already spreads via `const { runId, ...updates } = args`, so the new optional fields flow through `ctx.db.patch` automatically.

    Final shape:

    ```typescript
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
        // ── Phase 4 additions (CONTEXT D-22, D-23, D-39) ────────────────────
        durationMs: v.optional(v.number()),
        cost: v.optional(v.string()),
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

    Notes:
    - The throw-on-missing behavior (`Run not found`) is locked by Phase 3 D-13. Do NOT change it.
    - The handler body is unchanged — destructure `runId` out, patch the rest. The new optional fields drop into `updates` automatically.
  </action>
  <verify>
    <automated>grep -c "durationMs: v.optional(v.number())" convex/pipelineRuns.ts | grep -q "1" && grep -c "cost: v.optional(v.string())" convex/pipelineRuns.ts | grep -q "1" && grep -F "throw new Error(\`Run not found:" convex/pipelineRuns.ts && grep -F "export const byRunId = query" convex/pipelineRuns.ts && grep -F "export const create = mutation" convex/pipelineRuns.ts</automated>
  </verify>
  <done>
    - `updateStatus` args validator now lists `durationMs: v.optional(v.number())` and `cost: v.optional(v.string())`
    - `byRunId` and `create` exports unchanged
    - Handler unchanged (still throws `Run not found` if no row matches runId; still destructures `runId` and patches the rest)
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Andrew redeploys Convex with the patched schema + mutation</name>
  <files>convex/_generated/</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-39 (`pnpm --filter @eisenbalm/convex deploy` — same workflow as Phase 3 D-04)
    - .planning/phases/03-convex-deployment/03-CONTEXT.md D-04 (precedent: Andrew runs the deploy because the convex CLI is logged in under his account)
    - convex/README.md (Phase 3 documented the deploy command — Andrew has already done this once)
  </read_first>
  <what-built>
    Tasks 1 and 2 added two optional fields to the `pipelineRuns` table and to the `pipelineRuns:updateStatus` mutation args. The Convex deployment must be redeployed so the new validator accepts the additional args — without this step, any pipeline call passing `cost` or `durationMs` will be rejected with `ArgumentValidationError`.
  </what-built>
  <how-to-verify>
    Andrew runs from the repo root:

    ```
    pnpm --filter @eisenbalm/convex deploy
    ```

    Expected output: a clean deploy with no schema errors (the changes are additive — Convex will not require a migration). Output mentions "modules" and "indexes" deployed without warnings.

    Then in the Convex dashboard:
    1. Navigate to the production deployment → **Schema** view → `pipelineRuns` table.
    2. Confirm `durationMs (number, optional)` and `cost (string, optional)` are listed.
    3. Navigate to **Functions** → `pipelineRuns:updateStatus` → "Arguments" view.
    4. Confirm `durationMs?: number` and `cost?: string` appear in the args.

    Smoke test via the dashboard's Function tester:
    - Invoke `pipelineRuns:updateStatus` with args `{ runId: "nonexistent-test-runid", status: "running", cost: "{}", durationMs: 0 }`
    - Expected response: `Run not found: nonexistent-test-runid` (proves the new args are accepted by the validator — the throw is from the existing handler logic, not validator rejection).

    `convex/_generated/` files may regenerate during deploy — review the diff and commit any updates.
  </how-to-verify>
  <resume-signal>
    Type "deployed" when:
    - The deploy succeeded
    - The dashboard schema view shows the two new fields
    - The dashboard function tester accepts the new args (rejects with "Run not found" not with "ArgumentValidationError")
    - Any regenerated `convex/_generated/` files are committed
  </resume-signal>
</task>

<task type="auto">
  <name>Task 4: Update convex/README.md crediting Phase 4 ownership of the new fields</name>
  <files>convex/README.md</files>
  <read_first>
    - convex/README.md (current — Phase 3's documentation; preserve all existing sections)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-39 ("a one-line note in convex/README.md indicating Phase 4 ownership of these fields")
  </read_first>
  <action>
    Append a short Phase 4 section to `convex/README.md` (place near the schema documentation block, or near the bottom — planner discretion):

    ```markdown
    ## Phase 4 additions (Pipeline Skeleton)

    Two optional fields were added to the `pipelineRuns` table:

    - `durationMs: v.optional(v.number())` — pipeline wall-clock duration in ms (PIP-12).
    - `cost: v.optional(v.string())` — JSON-stringified per-agent cost summary (PIP-11 + OPS-03). The string mirrors the `modelVersions` pattern; nested object validation may come in Phase 5 (CONTEXT D-22).

    Both fields are also accepted by `pipelineRuns:updateStatus` mutation args.

    See `.planning/phases/04-pipeline-skeleton/04-CONTEXT.md` D-22, D-23, D-39 for the full context.
    ```
  </action>
  <verify>
    <automated>grep -F "Phase 4 additions" convex/README.md && grep -F "durationMs: v.optional(v.number())" convex/README.md && grep -F "cost: v.optional(v.string())" convex/README.md && grep -F "PIP-11" convex/README.md</automated>
  </verify>
  <done>
    - `convex/README.md` has a "Phase 4 additions" section documenting the new fields
    - References PIP-11, PIP-12 by ID
    - Does NOT modify any existing Phase 3 documentation
  </done>
</task>

</tasks>

<verification>
After all tasks:

1. `grep -F "durationMs: v.optional(v.number())" convex/schema.ts convex/pipelineRuns.ts` returns BOTH files.
2. `grep -F "cost: v.optional(v.string())" convex/schema.ts convex/pipelineRuns.ts` returns BOTH files.
3. Convex dashboard reflects the patched schema (manual check during Task 3 checkpoint).
4. The Convex function tester accepts `{cost, durationMs}` args without ArgumentValidationError.
5. No other table or function file was modified.
</verification>

<success_criteria>
- PIP-11 + PIP-12 schema slot exists: Convex `pipelineRuns` accepts both new fields; `updateStatus` mutation accepts them.
- Phase 3's deployed contract is preserved — all five other Convex functions and four other tables untouched.
- The deploy is Andrew-gated (autonomous: false) — matches Phase 3 D-04's manual-deploy posture.
- convex/README.md credits Phase 4 with the new fields.
</success_criteria>

<output>
Create `.planning/phases/04-pipeline-skeleton/04-03-convex-schema-patch-SUMMARY.md` recording:
- The Convex deploy timestamp + the deployed schema version (if visible in the dashboard)
- Confirmation that the function tester accepted the new args
- Any regenerated `convex/_generated/` files committed in the same PR
- Forward link to Plan 06 (`@agent_node` wrapper calls `pipelineRuns:updateStatus` with `cost?` and `durationMs?` from Plan 09's Publisher node)
</output>
