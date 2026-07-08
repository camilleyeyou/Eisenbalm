---
phase: 33-accept-fix-wiring-decision-rail
plan: 02
type: execute
wave: 2
depends_on: [33-01]
files_modified:
  - convex/schema.ts
  - convex/qaCorrections.ts
  - convex/claimChecks.ts
  - convex/pitchLog.ts
  - convex/_generated/api.d.ts
  - convex/_generated/api.js
  - apps/dispatch-control/vitest.config.ts
  - apps/dispatch-control/__tests__/qaCorrectionsResolution.test.ts
autonomous: true
requirements: [EDT-04, EDT-06, GLY-04]

must_haves:
  truths:
    - "qaCorrections rows can carry a resolution enum (accepted/dismissed) plus resolutionReason/resolvedBy/resolvedAt, with legacy accepted kept in sync"
    - "qaCorrections:setResolution enforces the pipeline secret and is registered in _PIPELINE_SECRET_GUARDED_PATHS's Convex-side mirror"
    - "claim_checks rows gain checkedAt, stamped by setStatus on checked/skipped"
    - "The pipeline can load one finding via qaCorrections:byId and the selected pitch via pitchLog:selectedByRunId"
  artifacts:
    - path: "convex/qaCorrections.ts"
      provides: "setResolution mutation (secret-guarded) + byId query"
      contains: "setResolution"
    - path: "convex/claimChecks.ts"
      provides: "checkedAt stamp inside setStatus"
      contains: "checkedAt"
    - path: "convex/pitchLog.ts"
      provides: "selectedByRunId query on by_runId_and_selected index"
      contains: "selectedByRunId"
    - path: "apps/dispatch-control/__tests__/qaCorrectionsResolution.test.ts"
      provides: "convex-test coverage for setResolution + checkedAt"
      contains: "setResolution"
  key_links:
    - from: "convex/qaCorrections.ts::setResolution"
      to: "convex/lib/auth.ts::requirePipelineSecret"
      via: "handler guard"
      pattern: "requirePipelineSecret"
---

<objective>
Add the Convex resolution state that the whole phase pivots on: additive optional fields on `qaCorrections` (D-01) and `claim_checks` (D-13), a secret-guarded `qaCorrections:setResolution` mutation (D-02), a `qaCorrections:byId` query, a `pitchLog:selectedByRunId` query (D-12), and a `checkedAt` stamp inside `claimChecks:setStatus`. Regenerate `convex/_generated` and cover it with a convex-test suite.

Purpose: Downstream plans read/write this state — the pipeline flips resolution through `setResolution`, the galley/rail filter on `resolution`, the rail's verification block reads `checkedAt`, and the hook card reads the selected pitch.
Output: New Convex functions + additive schema fields, committed `_generated`, and an edge-runtime convex-test suite.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/33-accept-fix-wiring-decision-rail/33-CONTEXT.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- Existing Convex shapes the executor builds on. Do not re-explore. -->
From convex/qaCorrections.ts:
```typescript
export const byRunId = query({ args: { runId: v.string() }, ... })   // exists
export const insert = mutation({ ... pipelineSecret: v.optional(v.string()) /* IGNORED — public GAM-05 exception, DO NOT copy */ })
```
From convex/claimChecks.ts:
```typescript
export const setStatus = mutation({
  args: { runId: v.string(), claimIndex: v.number(), status: v.string() },
  handler: async (ctx, { runId, claimIndex, status }) => {
    await requireOperator(ctx)          // dashboard lane — Clerk identity
    // ...validates status, finds row, then: await ctx.db.patch(row._id, { status })
  },
})
export const listByRunId = query({ args: { runId: v.string() }, ... })  // exists
```
From convex/pitchLog.ts:
```typescript
export const byRunId = query({ ... })                 // exists
export const markSelected = mutation({ ... })          // sets selected on entries
// schema.ts L112: selected: v.boolean(); L116: .index('by_runId_and_selected', ['runId','selected'])
```
From convex/lib/auth.ts:
```typescript
export function requirePipelineSecret(secret?: string): void  // pipeline lane guard (used by claimChecks:insertBatch)
export async function requireOperator(ctx): Promise<...>       // dashboard Clerk lane
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add additive schema fields + setResolution/byId + pitchLog:selectedByRunId</name>
  <read_first>
    - convex/schema.ts (qaCorrections table ~L70; pitchLog table ~L103 with selected L112 + by_runId_and_selected index L116; claim_checks table ~L396)
    - convex/qaCorrections.ts (the full file — add setResolution + byId; do NOT touch insert's public pattern)
    - convex/pitchLog.ts (byRunId + markSelected — mirror the query style for selectedByRunId)
    - convex/lib/auth.ts (requirePipelineSecret signature to reuse)
    - convex/claimChecks.ts (insertBatch already uses requirePipelineSecret — the reference for the guard import)
    - docs/API_CONTRACTS.md §33.1 and §33.7 (frozen field/mutation/query shapes)
  </read_first>
  <action>
In `convex/schema.ts`:
- On the `qaCorrections` table (~L70), add four additive optional fields (place them just before the existing `timestamp` field): `resolution: v.optional(v.union(v.literal('accepted'), v.literal('dismissed')))`, `resolutionReason: v.optional(v.string())`, `resolvedBy: v.optional(v.string())`, `resolvedAt: v.optional(v.number())`. Add a `// Phase 33 D-01: absent = open` comment on the resolution line.
- On the `claim_checks` table (~L396), add `checkedAt: v.optional(v.number())` with comment `// Phase 33 D-13: stamped by setStatus on checked/skipped`.

In `convex/qaCorrections.ts`, ADD (do not modify `insert`):
- A `byId` query: `export const byId = query({ args: { id: v.id('qaCorrections') }, handler: async (ctx, { id }) => await ctx.db.get(id) })`.
- A `setResolution` mutation using the PIPELINE lane (mirror `claimChecks:insertBatch`, NOT `qaCorrections:insert`). Import `requirePipelineSecret` from `./lib/auth`. Args: `{ id: v.id('qaCorrections'), resolution: v.optional(v.union(v.literal('accepted'), v.literal('dismissed'))), resolutionReason: v.optional(v.string()), resolvedBy: v.optional(v.string()), resolvedAt: v.optional(v.number()), pipelineSecret: v.optional(v.string()) }`. Handler: call `requirePipelineSecret(pipelineSecret)` FIRST, then `await ctx.db.patch(id, { resolution, resolutionReason, resolvedBy, resolvedAt, accepted: resolution === 'accepted' })`. Because Convex `patch` with `undefined` values removes optional fields, passing `resolution: undefined` (reopen) clears resolution/resolutionReason/resolvedBy/resolvedAt and sets `accepted: false`.

In `convex/pitchLog.ts`, ADD a public query `selectedByRunId`: `export const selectedByRunId = query({ args: { runId: v.string() }, handler: async (ctx, { runId }) => await ctx.db.query('pitchLog').withIndex('by_runId_and_selected', q => q.eq('runId', runId).eq('selected', true)).first() })`. Reads are public per existing convention.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && grep -q "setResolution" convex/qaCorrections.ts && grep -q "requirePipelineSecret" convex/qaCorrections.ts && grep -q "selectedByRunId" convex/pitchLog.ts && grep -q "checkedAt" convex/schema.ts && grep -q "resolution: v.optional(v.union(v.literal('accepted'), v.literal('dismissed')))" convex/schema.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export const setResolution = mutation" convex/qaCorrections.ts` succeeds
    - `grep -q "requirePipelineSecret(pipelineSecret)" convex/qaCorrections.ts` succeeds (setResolution is secret-guarded, NOT public)
    - `grep -q "accepted: resolution === 'accepted'" convex/qaCorrections.ts` succeeds (legacy sync per D-01)
    - `grep -q "export const byId = query" convex/qaCorrections.ts` succeeds
    - `grep -q "export const selectedByRunId = query" convex/pitchLog.ts` AND `grep -q "by_runId_and_selected" convex/pitchLog.ts` succeed
    - The `insert` mutation in convex/qaCorrections.ts is byte-unchanged: it still contains the comment `Do NOT gate this handler behind an identity or secret check of any kind.`
    - `grep -c "resolution: v.optional\|resolutionReason: v.optional\|resolvedBy: v.optional\|resolvedAt: v.optional" convex/schema.ts` returns ≥ 4
  </acceptance_criteria>
  <done>Schema carries the additive resolution + checkedAt fields; qaCorrections has a secret-guarded setResolution and a byId query; pitchLog has selectedByRunId; the public insert exception is untouched.</done>
</task>

<task type="auto">
  <name>Task 2: Stamp checkedAt in setStatus + regenerate _generated</name>
  <read_first>
    - convex/claimChecks.ts (setStatus handler — the patch call to extend)
    - convex/_generated/api.d.ts (confirm codegen target; new functions must appear here after regen)
    - docs/API_CONTRACTS.md §33.2 (checkedAt stamp semantics — checked/skipped only, never on pending)
  </read_first>
  <action>
In `convex/claimChecks.ts::setStatus`, change the final patch from `await ctx.db.patch(row._id, { status })` to stamp `checkedAt` only when the new status is a completed state: build the patch object as `const patch: { status: string; checkedAt?: number } = { status }; if (status === 'checked' || status === 'skipped') patch.checkedAt = Date.now(); await ctx.db.patch(row._id, patch)`. Do NOT stamp when status is `pending` (a re-open of a claim should not falsely record a check time). Leave `requireOperator(ctx)` and the status validation untouched — the Phase 26 `ClaimsChecklist.tsx` requires ZERO changes (§33.2).

Then regenerate Convex codegen so the new fields/functions land in `convex/_generated`: run `pnpm --filter @eisenbalm/convex exec convex codegen` (offline codegen is sufficient for types; a full `convex dev --once` deploy is done at phase deploy time). Commit the updated `convex/_generated/api.d.ts` and `convex/_generated/api.js`. Do NOT introduce any new `api as any` casts anywhere.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && grep -q "checkedAt = Date.now()" convex/claimChecks.ts && grep -q "setResolution" convex/_generated/api.d.ts && grep -q "selectedByRunId" convex/_generated/api.d.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "status === 'checked' || status === 'skipped'" convex/claimChecks.ts` succeeds (stamp gated to completed states)
    - `grep -q "requireOperator(ctx)" convex/claimChecks.ts` still present (dashboard lane unchanged)
    - `grep -q "setResolution" convex/_generated/api.d.ts` succeeds (codegen ran and captured the new mutation)
    - `grep -q "byId" convex/_generated/api.d.ts` succeeds
    - `grep -rn "api as any" apps/dispatch-control/app/\(dashboard\)/run-monitor/runs | wc -l` did not increase (no new `api as any` casts added by this plan)
  </acceptance_criteria>
  <done>setStatus stamps checkedAt on checked/skipped only; codegen is regenerated and committed with the new functions/fields; no new `api as any` casts.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: convex-test suite for setResolution + checkedAt</name>
  <read_first>
    - apps/dispatch-control/vitest.config.ts (environmentMatchGlobs — the NEW test file must be registered to run under edge-runtime like existing convex-test files)
    - apps/dispatch-control/__tests__/convexAuthLockdown.test.ts (the existing convex-test tripwire pattern to clone — how it imports convex-test, schema, and asserts secret-guarded mutations reject without the secret)
    - convex/qaCorrections.ts (setResolution + byId under test)
    - convex/claimChecks.ts (setStatus checkedAt under test)
    - docs/API_CONTRACTS.md §33.1/§33.2
  </read_first>
  <behavior>
    - Test 1: `setResolution` WITHOUT the pipeline secret throws (secret-guarded, unlike public insert).
    - Test 2: `setResolution` WITH the secret and `resolution:'accepted'` sets `resolution='accepted'` AND legacy `accepted=true`.
    - Test 3: `setResolution` with `resolution:'dismissed'` + `resolutionReason` records the reason and leaves `accepted` falsy.
    - Test 4: `setResolution` with `resolution: undefined` (reopen) clears resolution/resolutionReason and sets `accepted=false`.
    - Test 5: `claimChecks:setStatus` to `checked` stamps a numeric `checkedAt`; setting to `pending` does NOT stamp `checkedAt`.
    - Test 6: `qaCorrections:byId` returns the inserted row; `pitchLog:selectedByRunId` returns only the selected row.
  </behavior>
  <action>
Create `apps/dispatch-control/__tests__/qaCorrectionsResolution.test.ts` mirroring `convexAuthLockdown.test.ts`: import `convexTest` + the generated schema, seed a `qaCorrections` row via `insert`, and assert the six behaviors above. For the secret-guarded tests, pass/omit `pipelineSecret` exactly as `convexAuthLockdown.test.ts` does for other pipeline-lane mutations (read that file for the correct secret value/env handling — do not hardcode a different sentinel).

Register the file in `apps/dispatch-control/vitest.config.ts` `environmentMatchGlobs` under the SAME edge-runtime entry the other convex-test files use (add its path to that glob list). If the config already globs `__tests__/*convex*.test.ts` or similar, confirm this filename matches; if not, add an explicit entry so it runs under `edge-runtime`, not jsdom.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control test:unit __tests__/qaCorrectionsResolution.test.ts -- --run</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter dispatch-control test:unit __tests__/qaCorrectionsResolution.test.ts -- --run` exits 0 with ≥ 6 passing assertions
    - `grep -q "qaCorrectionsResolution" apps/dispatch-control/vitest.config.ts` succeeds OR the file matches an existing edge-runtime glob (verify the test actually ran under edge-runtime, not jsdom — a jsdom run of convex-test errors)
    - The test asserts a no-secret `setResolution` call REJECTS: `grep -q "setResolution" apps/dispatch-control/__tests__/qaCorrectionsResolution.test.ts` succeeds and the file contains a `rejects`/`toThrow` assertion
  </acceptance_criteria>
  <done>The convex-test suite passes, proving setResolution is secret-guarded, legacy accepted stays in sync, reopen clears fields, checkedAt stamps only on completed states, and the byId/selectedByRunId queries work.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test:unit __tests__/qaCorrectionsResolution.test.ts -- --run` green.
- `grep setResolution convex/_generated/api.d.ts` present (codegen captured new functions).
- `convex/qaCorrections.ts::insert` byte-unchanged.
</verification>

<success_criteria>
- Additive Convex resolution state exists, secret-guarded, codegen-committed, and tested — ready for the pipeline plan (33-03) to flip resolution and the frontend plans (33-04/05) to read it.
</success_criteria>

<output>
After completion, create `.planning/phases/33-accept-fix-wiring-decision-rail/33-02-SUMMARY.md`
</output>
