---
phase: 05-agent-quality
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - convex/schema.ts
  - convex/deliberationEvents.ts
  - convex/qaCorrections.ts
autonomous: false
requirements_addressed:
  - AGT-08
  - AGT-15
  - AGT-18

must_haves:
  truths:
    - "Convex schema accepts eventType='cost-warning' and eventType='agent-tool-limit-exceeded' on deliberationEvents:insert"
    - "Convex schema accepts severity='info' | 'warning' | 'error' on qaCorrections:insert"
    - "Convex schema accepts new optional fields on qaCorrections:insert: agentId, axis (6-literal union including 'hard-rule'), quotedSpan, suggestedFix"
    - "Legacy qaCorrections fields fieldName/original/corrected are v.optional(v.string()) — Phase 5 QA does not write them (D-02 annotation-only)"
    - "Existing 7 deliberationEvents.eventType literals continue to work (additive, non-breaking)"
    - "convex/_generated/api.d.ts reflects the new validator unions after redeploy"
  artifacts:
    - path: "convex/schema.ts"
      provides: "Patched deliberationEvents.eventType union (9 literals) + patched qaCorrections.severity union (info|warning|error)"
      contains: "cost-warning"
    - path: "convex/deliberationEvents.ts"
      provides: "Mutation validator mirrors schema.ts deliberationEvents.eventType union (9 literals)"
      contains: "agent-tool-limit-exceeded"
    - path: "convex/qaCorrections.ts"
      provides: "Mutation validator mirrors schema.ts qaCorrections.severity union (info|warning|error)"
      contains: "v.literal('warning')"
  key_links:
    - from: "convex/schema.ts deliberationEvents.eventType"
      to: "convex/deliberationEvents.ts insert.args.eventType"
      via: "byte-identical v.union of 9 v.literal() values"
      pattern: "v.literal\\('cost-warning'\\)"
    - from: "convex/schema.ts qaCorrections.severity"
      to: "convex/qaCorrections.ts insert.args.severity"
      via: "byte-identical v.union of 3 v.literal() values"
      pattern: "v.literal\\('error'\\)"
---

<objective>
Land the two additive Convex schema patches Phase 5 requires before any agent body writes new event types or new severity values.

Patch 1 (deliberationEvents.eventType): extend the existing 7-literal `v.union` to 9 literals by adding `cost-warning` (D-08, AGT-18) and `agent-tool-limit-exceeded` (D-21, AGT-18). The CONTEXT.md canonical_refs incorrectly described this field as permissive `v.string()`; direct inspection of `convex/schema.ts` (lines 30-37) confirms it is a strict 7-literal union. Without this patch, Phase 5's `CostRecorder.check_cap()` warning emission and `@agent_node` tool-limit-exceeded emission will fail Convex validation.

Patch 2 (qaCorrections.severity): change the existing `v.union(v.literal('minor'), v.literal('moderate'), v.literal('major'))` to `v.union(v.literal('info'), v.literal('warning'), v.literal('error'))` (D-01, API_CONTRACTS §3.6). Tables are empty in dev — no data migration. Phase 5 QA writes only `info | warning | error`.

Purpose: Wave 0 prerequisite. Every agent body that writes to `deliberationEvents` or `qaCorrections` in subsequent plans depends on these patches landing first. Mirrors the additive-patch pattern from Phase 3 → Phase 4 (Plan 04-03 added `durationMs` + `cost` to `pipelineRuns`).

Output: 3 files patched; `npx convex deploy` (or `pnpm --filter @eisenbalm/convex deploy`) run by Andrew against the dev Convex deployment (`modest-magpie-797` per Phase 4 Plan 04-03 deviation); `convex/_generated/` updated; commit lands on `master`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/05-agent-quality/05-CONTEXT.md
@.planning/phases/05-agent-quality/05-RESEARCH.md
@convex/schema.ts
@convex/deliberationEvents.ts
@convex/qaCorrections.ts
@docs/API_CONTRACTS.md

<interfaces>
<!-- Current convex/schema.ts deliberationEvents (verified by inspection) -->
```typescript
// convex/schema.ts lines 27-46 (current)
deliberationEvents: defineTable({
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
  timestamp: v.number(),
})
  .index('by_runId', ['runId'])
  .index('by_runId_and_type', ['runId', 'eventType']),
```

<!-- Current convex/schema.ts qaCorrections (verified by inspection) -->
```typescript
// convex/schema.ts lines 66-82 (current)
qaCorrections: defineTable({
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
  timestamp: v.number(),
})
```

<!-- convex/deliberationEvents.ts insert mutation (lines 31-54) and convex/qaCorrections.ts insert mutation (lines 15-36) both contain duplicate v.union validators that must be kept in lockstep with schema.ts. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Patch convex/schema.ts — add 2 eventType literals + replace 3 severity literals</name>
  <files>convex/schema.ts</files>

  <read_first>
    - convex/schema.ts (whole file — 100 lines — read before editing to see exact current state)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Convex Schema Conflicts (CRITICAL — Wave 0 Patches)" lines 1385-1437
    - convex/CLAUDE.md (project-level Convex rules)
  </read_first>

  <action>
  Edit `convex/schema.ts` in two places:

  **Edit 1 — extend `deliberationEvents.eventType`** (lines 30-37 in current file). Replace the existing 7-literal union:

  ```typescript
  eventType: v.union(
    v.literal('scout-finding'),
    v.literal('advocate-argument'),
    v.literal('editor-decision'),
    v.literal('section-draft'),
    v.literal('qa-correction'),
    v.literal('editor-final'),
    v.literal('publisher-deploy'),
  ),
  ```

  with the 9-literal union (additive only — preserve existing 7 in the same order, append the 2 new ones at the end with inline comments matching the existing comment style for the surrounding literals):

  ```typescript
  eventType: v.union(
    v.literal('scout-finding'),      // Scout found a candidate charity
    v.literal('advocate-argument'),  // Advocate built case for a candidate
    v.literal('editor-decision'),    // Editor gate 1 selected winner
    v.literal('section-draft'),      // Section agent produced draft
    v.literal('qa-correction'),      // QA flagged and corrected something
    v.literal('editor-final'),       // Editor final approved
    v.literal('publisher-deploy'),   // Publisher built and deployed
    v.literal('cost-warning'),                // Phase 5 D-08: CostRecorder soft-warn at 70% of PIPELINE_COST_CAP_USD
    v.literal('agent-tool-limit-exceeded'),   // Phase 5 D-21: max_tool_calls overrun on Scout/Researcher
  ),
  ```

  **Edit 2 — full `qaCorrections` table shape patch** (lines 66-82 in current file). Phase 5's QA agent (D-01 / D-02) uses a different output shape than the Phase 4 rewrite-style schema. The patch must:

  - Make the rewrite-shaped fields (`fieldName`, `original`, `corrected`) OPTIONAL so they remain valid for legacy rows but are unused by Phase 5 QA (D-02 says "QA writes annotations only — never rewrites").
  - Replace the `severity` enum: `minor|moderate|major` → `info|warning|error` (D-01).
  - ADD 4 new optional fields the Phase 5 LLM-judge emits as structured output (D-01):
    - `agentId` (always 'qa' for Phase 5; optional for legacy compatibility)
    - `axis` (6-literal union: gravity | sentiment | irony-signaling | precision | cross-section-consistency, plus 'hard-rule' for Layer-1 deterministic findings)
    - `quotedSpan` (the exact offending text)
    - `suggestedFix` (concrete alternative)
  - KEEP `accepted: v.boolean()` (Phase 5 writes `false` on every new row; Andrew flips via Studio in Phase 9).

  Replace the existing qaCorrections table:

  ```typescript
  qaCorrections: defineTable({
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
    timestamp: v.number(),
  })
  ```

  with the Phase 5 patched table:

  ```typescript
  qaCorrections: defineTable({
    runId: v.string(),
    agentId: v.optional(v.string()),         // Phase 5 D-01: always 'qa' for new rows
    sectionName: v.string(),                  // same field name as before
    fieldName: v.optional(v.string()),        // Phase 5 unused; legacy compat
    original: v.optional(v.string()),         // Phase 5 unused; legacy compat
    corrected: v.optional(v.string()),        // Phase 5 unused (D-02 annotation-only); legacy compat
    reason: v.string(),                       // Phase 5 maps Pydantic `reason` directly into this
    severity: v.union(
      v.literal('info'),                     // Phase 5 D-01: minor suggestion; Andrew may ignore
      v.literal('warning'),                  // Phase 5 D-01: borderline; Andrew should review
      v.literal('error'),                    // Phase 5 D-01: clear voice/factual violation; Andrew must review
    ),
    accepted: v.boolean(),                    // Phase 5 writes `false` on every row; Andrew flips in Phase 9
    // ── New Phase 5 fields (D-01 LLM-judge structured output) ─────────────
    axis: v.optional(v.union(
      v.literal('gravity'),
      v.literal('sentiment'),
      v.literal('irony-signaling'),
      v.literal('precision'),
      v.literal('cross-section-consistency'),
      v.literal('hard-rule'),                // Layer-1 deterministic findings
    )),
    quotedSpan: v.optional(v.string()),       // exact offending text
    suggestedFix: v.optional(v.string()),     // concrete alternative
    timestamp: v.number(),
  })
  ```

  Preserve any existing `.index(...)` chain after the closing `})` verbatim — do not modify indexes on the qaCorrections table.

  Do NOT touch any other table (pipelineRuns, agentVotes, pitchLog remain unchanged). Do NOT touch indexes on other tables. The patch on qaCorrections is the full table-shape replacement shown above.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && grep -c "v.literal('cost-warning')" convex/schema.ts | grep -q "^1$" && grep -c "v.literal('agent-tool-limit-exceeded')" convex/schema.ts | grep -q "^1$" && grep -c "v.literal('info')" convex/schema.ts | grep -q "^1$" && grep -c "v.literal('warning')" convex/schema.ts | grep -q "^1$" && grep -c "v.literal('error')" convex/schema.ts | grep -q "^1$" && grep -q "v.literal('gravity')" convex/schema.ts && grep -q "v.literal('cross-section-consistency')" convex/schema.ts && grep -q "v.literal('hard-rule')" convex/schema.ts && grep -q "axis: v.optional" convex/schema.ts && grep -q "quotedSpan: v.optional" convex/schema.ts && grep -q "suggestedFix: v.optional" convex/schema.ts && grep -q "agentId: v.optional" convex/schema.ts && ! grep -q "v.literal('minor')" convex/schema.ts && ! grep -q "v.literal('moderate')" convex/schema.ts && ! grep -q "v.literal('major')" convex/schema.ts && echo OK</automated>
  </verify>

  <acceptance_criteria>
    - `convex/schema.ts` contains exactly one `v.literal('cost-warning')`
    - `convex/schema.ts` contains exactly one `v.literal('agent-tool-limit-exceeded')`
    - `convex/schema.ts` contains exactly one `v.literal('info')`
    - `convex/schema.ts` contains exactly one `v.literal('warning')`
    - `convex/schema.ts` contains exactly one `v.literal('error')`
    - `convex/schema.ts` no longer contains `v.literal('minor')`, `v.literal('moderate')`, or `v.literal('major')`
    - `convex/schema.ts` still contains all 7 original deliberationEvents literals (scout-finding, advocate-argument, editor-decision, section-draft, qa-correction, editor-final, publisher-deploy)
    - `convex/schema.ts` qaCorrections table contains new optional fields: `agentId`, `axis`, `quotedSpan`, `suggestedFix` (each `v.optional(...)`)
    - `convex/schema.ts` qaCorrections.axis union contains 6 literals: `gravity`, `sentiment`, `irony-signaling`, `precision`, `cross-section-consistency`, `hard-rule`
    - `convex/schema.ts` qaCorrections.fieldName, original, corrected are now `v.optional(v.string())` (legacy compat)
    - `convex/schema.ts` qaCorrections still has `accepted: v.boolean()` and `runId: v.string()` and `sectionName: v.string()` and `reason: v.string()` and `timestamp: v.number()`
    - `pnpm --filter @eisenbalm/convex exec tsc --noEmit` exits 0 (TypeScript happy)
  </acceptance_criteria>

  <done>
  Schema patch is in place: deliberationEvents.eventType now accepts 9 values; qaCorrections has been refactored to Phase 5's annotation-only shape (severity info|warning|error; new optional fields agentId/axis/quotedSpan/suggestedFix; legacy rewrite-shaped fields made optional). File still type-checks. Existing 7 eventType literals untouched. No other tables touched.
  </done>
</task>

<task type="auto">
  <name>Task 2: Patch convex/deliberationEvents.ts insert mutation validator</name>
  <files>convex/deliberationEvents.ts</files>

  <read_first>
    - convex/deliberationEvents.ts (whole file — 55 lines)
    - convex/schema.ts (post-Task-1 to ensure byte-identical union)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md (Plan 04-03 pattern: mutation validator must mirror schema validator)
  </read_first>

  <action>
  Edit `convex/deliberationEvents.ts` lines 31-54. The `insert` mutation's `args.eventType` validator currently mirrors the OLD 7-literal schema. Replace lines 35-43 (the inner `v.union(...)` of `eventType`):

  Current:
  ```typescript
  eventType: v.union(
    v.literal('scout-finding'),
    v.literal('advocate-argument'),
    v.literal('editor-decision'),
    v.literal('section-draft'),
    v.literal('qa-correction'),
    v.literal('editor-final'),
    v.literal('publisher-deploy'),
  ),
  ```

  Replace with (byte-identical to schema.ts post-Task-1, including comments):
  ```typescript
  eventType: v.union(
    v.literal('scout-finding'),
    v.literal('advocate-argument'),
    v.literal('editor-decision'),
    v.literal('section-draft'),
    v.literal('qa-correction'),
    v.literal('editor-final'),
    v.literal('publisher-deploy'),
    v.literal('cost-warning'),                // Phase 5 D-08
    v.literal('agent-tool-limit-exceeded'),   // Phase 5 D-21
  ),
  ```

  Do NOT touch the `byRunId` query, the `byRunIdAndType` query, or any other field on `insert`. Only the `eventType` validator union is replaced.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && grep -c "v.literal('cost-warning')" convex/deliberationEvents.ts | grep -q "^1$" && grep -c "v.literal('agent-tool-limit-exceeded')" convex/deliberationEvents.ts | grep -q "^1$" && grep -c "v.literal('scout-finding')" convex/deliberationEvents.ts | grep -q "^1$" && echo OK</automated>
  </verify>

  <acceptance_criteria>
    - `convex/deliberationEvents.ts` contains `v.literal('cost-warning')` (exactly once)
    - `convex/deliberationEvents.ts` contains `v.literal('agent-tool-limit-exceeded')` (exactly once)
    - `convex/deliberationEvents.ts` still contains all 7 original literals (scout-finding, advocate-argument, editor-decision, section-draft, qa-correction, editor-final, publisher-deploy)
    - The 9-literal union in `convex/deliberationEvents.ts insert.args.eventType` matches the 9-literal union in `convex/schema.ts deliberationEvents.eventType` (verified by side-by-side diff)
    - `pnpm --filter @eisenbalm/convex exec tsc --noEmit` exits 0
  </acceptance_criteria>

  <done>
  insert mutation validator mirrors schema.ts deliberationEvents.eventType union exactly. No other queries/mutations touched. Type-check passes.
  </done>
</task>

<task type="auto">
  <name>Task 3: Patch convex/qaCorrections.ts insert mutation validator</name>
  <files>convex/qaCorrections.ts</files>

  <read_first>
    - convex/qaCorrections.ts (whole file — 37 lines)
    - convex/schema.ts (post-Task-1 to ensure byte-identical union)
  </read_first>

  <action>
  Edit `convex/qaCorrections.ts`. The `insert` mutation's `args` validator currently mirrors the OLD qaCorrections table shape. It must be expanded to mirror the Phase 5 schema (post-Task-1) byte-for-byte so callers can pass the new Phase 5 fields AND the legacy rewrite-shaped fields stay valid as optional.

  Replace the existing `args: {...}` body of the `insert` mutation with (byte-identical to schema.ts post-Task-1 qaCorrections fields):

  ```typescript
  args: {
    runId: v.string(),
    agentId: v.optional(v.string()),
    sectionName: v.string(),
    fieldName: v.optional(v.string()),        // legacy compat (Phase 4 rewrite-shape)
    original: v.optional(v.string()),         // legacy compat
    corrected: v.optional(v.string()),        // legacy compat (D-02 annotation-only)
    reason: v.string(),
    severity: v.union(
      v.literal('info'),
      v.literal('warning'),
      v.literal('error'),
    ),
    accepted: v.boolean(),                    // Phase 5 writes `false`
    axis: v.optional(v.union(
      v.literal('gravity'),
      v.literal('sentiment'),
      v.literal('irony-signaling'),
      v.literal('precision'),
      v.literal('cross-section-consistency'),
      v.literal('hard-rule'),
    )),
    quotedSpan: v.optional(v.string()),
    suggestedFix: v.optional(v.string()),
  },
  ```

  The `timestamp` field is server-set inside the handler (Phase 4 pattern: `timestamp: Date.now()` is written by the handler, not provided by the caller) — confirm this matches the existing handler; do not change handler logic in this task. If the handler currently inserts only the OLD fields, update it to spread all caller-provided args including the new optional ones — the handler body should look approximately like:

  ```typescript
  handler: async (ctx, args) => {
    return await ctx.db.insert('qaCorrections', {
      ...args,
      timestamp: Date.now(),
    });
  },
  ```

  Do NOT touch the `byRunId` query or any other field/index. The patch expands `insert.args` to the full Phase 5 superset.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && grep -c "v.literal('info')" convex/qaCorrections.ts | grep -q "^1$" && grep -c "v.literal('warning')" convex/qaCorrections.ts | grep -q "^1$" && grep -c "v.literal('error')" convex/qaCorrections.ts | grep -q "^1$" && grep -q "axis: v.optional" convex/qaCorrections.ts && grep -q "quotedSpan: v.optional" convex/qaCorrections.ts && grep -q "suggestedFix: v.optional" convex/qaCorrections.ts && grep -q "agentId: v.optional" convex/qaCorrections.ts && grep -q "v.literal('hard-rule')" convex/qaCorrections.ts && ! grep -q "v.literal('minor')" convex/qaCorrections.ts && ! grep -q "v.literal('moderate')" convex/qaCorrections.ts && ! grep -q "v.literal('major')" convex/qaCorrections.ts && echo OK</automated>
  </verify>

  <acceptance_criteria>
    - `convex/qaCorrections.ts` contains `v.literal('info')`, `v.literal('warning')`, `v.literal('error')` (each exactly once)
    - `convex/qaCorrections.ts` no longer contains `v.literal('minor')`, `v.literal('moderate')`, `v.literal('major')`
    - `convex/qaCorrections.ts insert.args` includes the new optional fields: `agentId`, `axis`, `quotedSpan`, `suggestedFix`
    - `convex/qaCorrections.ts insert.args.axis` union contains 6 literals including `hard-rule`
    - `convex/qaCorrections.ts insert.args.fieldName`, `original`, `corrected` are all `v.optional(v.string())` (legacy compat)
    - `convex/qaCorrections.ts insert.args` union shape is byte-identical to `convex/schema.ts qaCorrections` (excluding `timestamp` which is server-set)
    - `pnpm --filter @eisenbalm/convex exec tsc --noEmit` exits 0
  </acceptance_criteria>

  <done>
  insert mutation validator mirrors schema.ts qaCorrections shape exactly (Phase 5 superset: new optional fields agentId/axis/quotedSpan/suggestedFix plus the patched severity enum; legacy rewrite-shaped fields preserved as optional). Type-check passes.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 4: Andrew deploys patched schema + mutations to dev Convex instance</name>

  <what-built>
  Tasks 1-3 patched 3 Convex files (schema.ts + 2 mutation validators). The patches are additive (deliberationEvents.eventType gains 2 literals) and one substitution (qaCorrections.severity goes from minor|moderate|major to info|warning|error). Tables are empty in dev — no data migration needed.
  </what-built>

  <how-to-verify>
  Andrew or a developer runs the deploy against the dev Convex instance (the same one Phase 4 Plan 04-03 used: `modest-magpie-797`, NOT prod `wonderful-wolverine-947` — per Phase 4 Plan 04-03 Deviation 1). Steps:

  1. From repo root, ensure `.env.local` has `CONVEX_DEPLOY_KEY=dev:...` (the dev-tier key, NOT the prod-tier).
  2. Run: `pnpm --filter @eisenbalm/convex exec convex dev --once` (this picks up the schema patch + mutation patches; equivalent to the Plan 04-03 deploy method).
  3. Confirm console output shows `Deployed Convex` with no schema-validation warning.
  4. Open the Convex dashboard for `modest-magpie-797` → Data → `deliberationEvents` → click "Insert" → in the eventType field, the dropdown shows 9 options including `cost-warning` and `agent-tool-limit-exceeded`.
  5. Same on `qaCorrections` → severity dropdown shows `info`, `warning`, `error`.
  6. Confirm `convex/_generated/api.d.ts` was updated (git diff shows the new literals in the type union).
  7. Type "deployed" or "approved" once both validators are confirmed live.

  Resume signal: reply "deployed" or "approved".
  </how-to-verify>

  <resume-signal>Type "deployed" once the patched schema is live on the dev Convex instance and the dashboard shows the 9 eventType literals + 3 severity literals.</resume-signal>
</task>

</tasks>

<verification>
After all tasks complete:
- `grep -c "v.literal('cost-warning')" convex/schema.ts convex/deliberationEvents.ts` returns `2` (one per file)
- `grep -c "v.literal('agent-tool-limit-exceeded')" convex/schema.ts convex/deliberationEvents.ts` returns `2`
- `grep -c "v.literal('error')" convex/schema.ts convex/qaCorrections.ts` returns `2`
- `pnpm --filter @eisenbalm/convex exec tsc --noEmit` exits 0
- Andrew confirms dev Convex deployment shows new validators in dashboard
- `convex/_generated/api.d.ts` reflects the new union types
</verification>

<success_criteria>
- All 3 Convex files patched with byte-identical validator unions where applicable (schema↔mutation)
- TypeScript type-check passes
- Dev Convex deployment redeployed and verified by Andrew
- No data migration performed (tables empty)
- No unrelated changes (other tables, indexes, queries, fields preserved)
- Subsequent Phase 5 plans can safely write `cost-warning`, `agent-tool-limit-exceeded` events and `info|warning|error` qaCorrections rows
</success_criteria>

<output>
After completion, create `.planning/phases/05-agent-quality/05-01-convex-schema-patches-SUMMARY.md` per the standard summary template.
</output>
