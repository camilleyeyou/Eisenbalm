---
phase: 42-fact-check-stage
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - convex/schema.ts
  - convex/claimChecks.ts
autonomous: true
requirements: [FCT-01, FCT-05, FCT-06, FCT-07]

must_haves:
  truths:
    - "docs/API_CONTRACTS.md has a §42 section defining the claim shape, the importance field, the six action endpoints, the FCT-06 request/apply contract, and the changedSinceCheck/conflict fields — written before any implementation code"
    - "claim_checks rows can carry importance, changedSinceCheck, and conflict (all additive-optional; legacy rows omit them)"
    - "The pipeline lane can update, mark-changed, keep-as-written, and remove a single claim by (runId, claimIndex); Confirm still flips status via the existing operator-guarded setStatus"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "§42 Fact Check Stage contract (skeleton from 42-RESEARCH lines 411-474)"
      contains: "## §42"
    - path: "convex/schema.ts"
      provides: "claim_checks additive fields importance/changedSinceCheck/conflict"
      contains: "importance: v.optional(v.union("
    - path: "convex/claimChecks.ts"
      provides: "byRunIdAndIndex, updateClaim, markChanged, keepAsWritten, remove + insertBatch importance pass-through + setStatus clears changedSinceCheck"
      exports: ["byRunIdAndIndex", "updateClaim", "markChanged", "keepAsWritten", "remove"]
  key_links:
    - from: "convex/claimChecks.ts new mutations"
      to: "convex/lib/auth.ts requirePipelineSecret"
      via: "requirePipelineSecret(pipelineSecret) guard on every content-adjacent mutation"
      pattern: "requirePipelineSecret"
---

<objective>
Establish the Phase 42 contract and data substrate FIRST (D-21 contract-first), so every downstream plan (importance plumbing, reset-touched-claims, six-action endpoints, selectors, screen) builds against a fixed §42 contract and a claim_checks table that already carries the three new additive-optional fields.

Purpose: The whole phase is additive on the Phase 35 provenance substrate. Nothing can read or write importance/changedSinceCheck/conflict until they exist on the schema, and no endpoint can mutate a claim until the pipeline-lane Convex mutations exist. This is the blocking root of the dependency graph.
Output: §42 in docs/API_CONTRACTS.md; three new optional fields on claim_checks; five new pipeline-lane claimChecks functions + insertBatch importance pass-through.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/42-fact-check-stage/42-CONTEXT.md
@.planning/phases/42-fact-check-stage/42-RESEARCH.md
@docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md

<interfaces>
<!-- Verified from the current repo. The executor uses these directly. -->

convex/schema.ts claim_checks table (lines ~431-452) TODAY carries these fields:
  workspace_id, runId, claimIndex, text, claimType, context, status, checkedAt?,
  claimId?, sourceUrl?, retrievedAt?, sectionName?, blockIndexHint?   (Phase 35 = all v.optional)
  indexes: by_runId ['runId'], by_workspace ['workspace_id']

convex/claimChecks.ts TODAY exports:
  insertBatch (mutation, requirePipelineSecret; args.claims is an array-of-object validator)
  setStatus   (mutation, requireOperator; args {runId, claimIndex, status}; stamps checkedAt)
  listByRunId (query {runId})
  allSignedOff(query {runId})  // predicate: total>0 && every row status !== 'pending' (NO status allowlist)
  imports: requireOperator, requirePipelineSecret from './lib/auth'
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write the §42 contract into docs/API_CONTRACTS.md (contract-first, D-21)</name>
  <files>docs/API_CONTRACTS.md</files>
  <read_first>
    - .planning/phases/42-fact-check-stage/42-RESEARCH.md (lines 409-508 — the §42 Contract Skeleton + Endpoint List table; transcribe it)
    - docs/API_CONTRACTS.md §26.2, §31, §35 (the existing claim_checks + content-patch + provenance sections the new §42 amends/extends — match their heading style and prose register)
    - docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md §4 and §5 (claim shape + counters the contract must be consistent with)
  </read_first>
  <action>
Append a new `## §42 — Fact Check Stage (Phase 42)` section to docs/API_CONTRACTS.md, transcribing the skeleton in 42-RESEARCH.md lines 411-474 and the endpoint table lines 496-508. It MUST contain these subsections verbatim in intent:

- **§42.1** claim_checks additive fields:
  `importance: v.optional(v.union(v.literal('Load-bearing'), v.literal('Supporting'), v.literal('Incidental')))`,
  `changedSinceCheck: v.optional(v.boolean())`, `conflict: v.optional(v.boolean())`.
  State the invariant: importance absent => treated as 'Supporting' for mustFix purposes (D-03), NEVER rendered blank (D-08).
- **§42.2** Researcher `ClaimOutput` gains `importance: Literal['Load-bearing','Supporting','Incidental'] = 'Supporting'`; mapped claim + publisher sourced/unsourced rows carry it (unsourced default 'Supporting', D-03).
- **§42.3** claimChecks functions: `insertBatch` claims[] gains `importance: v.optional(...)` pass-through; NEW `byRunIdAndIndex({runId,claimIndex})` public read; NEW `updateClaim`/`markChanged`/`keepAsWritten`/`remove` all `requirePipelineSecret`; `setStatus` UNCHANGED signature but now clears `changedSinceCheck` on check (D-20). Document that Confirm keeps calling operator-guarded `setStatus` directly.
- **§42.4** New endpoints in api/factcheck.py (mounted in api/main.py), all `_require_clerk_jwt_control`:
  `POST /issues/{run_id}/claims/{claim_index}/keep` {reason};
  `PATCH /issues/{run_id}/claims/{claim_index}` {ifRevisionID?, text?, sourceUrl?, retrievedAt?};
  `POST /issues/{run_id}/claims/{claim_index}/replace-source` {sourceUrl, retrievedAt?};
  `DELETE /issues/{run_id}/claims/{claim_index}` {reason?};
  `POST /issues/{run_id}/claims/{claim_index}/evidence/preview` {} -> {sourceUrl, sourcePublisher, retrievedAt, rewrittenClaim} (read-only, no audit, mirrors voice_pass.py::voice_rewrite);
  `POST /issues/{run_id}/claims/{claim_index}/evidence/apply` {ifRevisionID, sourceUrl, retrievedAt, rewrittenClaim} (atomic content patch + claim update + audit).
  State the content-touching routes (PATCH-when-text, evidence/apply) additionally call `_reset_touched_claims` + `_revoke_active_signoffs` + `_emit_audit`.
- **§42.5** `_reset_touched_claims` hook amends §31 patch_section (all 4 long-reads) + patch_bonus (specAd branch only; bigBudget/jingle bonus.body is a plain string, exempt per §35.3).
- **§42.6** Provenance card shape `{ text, importance, status, sourceUrl, sourcePublisher, supportingPassage, retrievedAt, agent, confidence }` with field sourcing: sourcePublisher = derived from sourceUrl host; supportingPassage = context field; agent = derived from sectionName; confidence = "—" (never invent a value).

Add one explicit reconciliation note (42-RESEARCH Pitfall 7): the per-claim chip vocabulary is D-08's `✓ Checked / ✕ Must fix / Unchecked / Review recommended / Changed`, which supersedes the Annotations "State model" table's check-lifecycle labels for this phase.
  </action>
  <verify>
    <automated>grep -q "## §42" docs/API_CONTRACTS.md && grep -q "changedSinceCheck" docs/API_CONTRACTS.md && grep -q "evidence/apply" docs/API_CONTRACTS.md && echo CONTRACT_OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "## §42" docs/API_CONTRACTS.md` returns 1
    - `docs/API_CONTRACTS.md` contains the strings `importance: v.optional(v.union(`, `changedSinceCheck`, `conflict`, `byRunIdAndIndex`, `keepAsWritten`, `evidence/preview`, `evidence/apply`, `_reset_touched_claims`
    - `docs/API_CONTRACTS.md` contains the reconciliation note referencing the D-08 chip vocabulary
  </acceptance_criteria>
  <done>§42 exists in docs/API_CONTRACTS.md and covers the claim shape, importance field, six action endpoints, FCT-06 request/apply, and changedSinceCheck/conflict — before any code that reads/writes them.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Extend claim_checks schema + claimChecks.ts functions (importance/changedSinceCheck/conflict + 5 pipeline-lane functions)</name>
  <files>convex/schema.ts, convex/claimChecks.ts, apps/dispatch-control/__tests__/claimChecksFactcheck.test.ts</files>
  <read_first>
    - convex/schema.ts (claim_checks table, lines ~431-452 — the additive-optional Phase 35 fields to mirror exactly)
    - convex/claimChecks.ts (insertBatch, setStatus, listByRunId, allSignedOff — the guard lanes and the claims[] validator to extend)
    - convex/qaCorrections.ts (setResolution — the requirePipelineSecret-guarded content-adjacent mutation pattern to mirror, per 42-RESEARCH Pattern 3)
    - convex/lib/auth.ts (requireOperator / requirePipelineSecret signatures)
    - apps/dispatch-control/vitest.config.ts (the `edge-runtime` environmentMatchGlobs entry — convex-test files must match it)
  </read_first>
  <behavior>
    - insertBatch accepts a claims[] entry carrying importance and persists it; an entry omitting importance persists no importance key (v.optional).
    - byRunIdAndIndex(runId, claimIndex) returns the single matching row, or null when absent.
    - updateClaim sets any of text/sourceUrl/retrievedAt provided, guarded by pipelineSecret; a wrong/absent secret throws.
    - markChanged sets status='pending' AND changedSinceCheck=true, guarded by pipelineSecret.
    - keepAsWritten sets the given terminal status (default 'checked') AND clears changedSinceCheck, guarded by pipelineSecret.
    - remove sets status='removed', guarded by pipelineSecret; the removed row satisfies allSignedOff's `!== 'pending'` gate.
    - setStatus, when setting 'checked' or 'skipped', clears changedSinceCheck (D-20: cleared when next checked).
    - allSignedOff regression: a run with one must-fix (Load-bearing, no sourceUrl, pending) row returns false; after Confirm/keep/remove it returns true.
  </behavior>
  <action>
In convex/schema.ts claim_checks table, add three additive-optional fields immediately after `blockIndexHint`, matching the Phase 35 comment style:
  `importance: v.optional(v.union(v.literal('Load-bearing'), v.literal('Supporting'), v.literal('Incidental'))),`
  `changedSinceCheck: v.optional(v.boolean()),`
  `conflict: v.optional(v.boolean()),`
Do NOT change existing fields or indexes.

In convex/claimChecks.ts:
1. `insertBatch`: add `importance: v.optional(v.union(v.literal('Load-bearing'), v.literal('Supporting'), v.literal('Incidental')))` to the `claims` array-object validator, and pass it through into the inserted document only when present (mirror how the Phase 35 optional fields are conditionally spread — omit the key when undefined, never write null).
2. `setStatus`: when the new status is 'checked' or 'skipped', also set `changedSinceCheck: undefined` (clear it). Keep the existing `requireOperator` guard and checkedAt stamping.
3. NEW `byRunIdAndIndex = query({ args: { runId: v.string(), claimIndex: v.number() }, handler })` — use the by_runId index, filter by claimIndex, return the doc or null. Public (no guard — read only).
4. NEW `updateClaim = mutation({ args: { runId, claimIndex, text: v.optional(v.string()), sourceUrl: v.optional(v.string()), retrievedAt: v.optional(v.number()), pipelineSecret: v.optional(v.string()) }, handler })` — `requirePipelineSecret(pipelineSecret)`; patch only the provided fields; stamp updatedAt.
5. NEW `markChanged = mutation({ args: { runId, claimIndex, pipelineSecret }, handler })` — requirePipelineSecret; set `status: 'pending', changedSinceCheck: true`.
6. NEW `keepAsWritten = mutation({ args: { runId, claimIndex, status: v.optional(v.string()), pipelineSecret }, handler })` — requirePipelineSecret; set status (default 'checked'), `changedSinceCheck: undefined`, stamp checkedAt.
7. NEW `remove = mutation({ args: { runId, claimIndex, pipelineSecret }, handler })` — requirePipelineSecret; set `status: 'removed'`.
All new mutations resolve the target row via the by_runId index + claimIndex filter (mirror byRunIdAndIndex); throw if not found.

Write apps/dispatch-control/__tests__/claimChecksFactcheck.test.ts as a convex-test file (tagged so it matches the edge-runtime glob — copy the header/tag convention from an existing edge-runtime convex-test file under apps/dispatch-control/__tests__) covering the <behavior> list, including the allSignedOff regression (must-fix pending row => false; after remove/keep => true).
  </action>
  <verify>
    <automated>pnpm --filter @eisenbalm/convex typecheck && pnpm --filter dispatch-control test:unit -- __tests__/claimChecksFactcheck.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "importance: v.optional(v.union(" convex/schema.ts` returns >= 1
    - `convex/schema.ts` claim_checks contains `changedSinceCheck: v.optional(v.boolean())` and `conflict: v.optional(v.boolean())`
    - `grep -E "export const (byRunIdAndIndex|updateClaim|markChanged|keepAsWritten|remove)" convex/claimChecks.ts` shows all five
    - Each of updateClaim/markChanged/keepAsWritten/remove contains `requirePipelineSecret(`
    - `pnpm --filter @eisenbalm/convex typecheck` exits 0
    - `pnpm --filter dispatch-control test:unit -- __tests__/claimChecksFactcheck.test.ts` exits 0
  </acceptance_criteria>
  <done>claim_checks carries the three new optional fields; five pipeline-lane functions exist and are secret-guarded; setStatus clears the changed marker on check; the allSignedOff gate still behaves correctly with a removed/kept row; convex typecheck is clean.</done>
</task>

</tasks>

<verification>
- `grep "## §42" docs/API_CONTRACTS.md` — contract exists before code.
- `pnpm --filter @eisenbalm/convex typecheck` clean.
- New convex-test file green.
- NOTE: the live dev deployment sync (`pnpm --filter @eisenbalm/convex dev:once`) is intentionally deferred to the Plan 42-08 integration gate (per project memory: committing convex/*.ts ≠ deployed).
</verification>

<success_criteria>
§42 is written first; claim_checks carries importance/changedSinceCheck/conflict; the pipeline lane can update/mark-changed/keep/remove a claim by (runId, claimIndex) with audit-able secret-guarded mutations; Confirm's operator path is unchanged; allSignedOff still gates facts-cleared correctly.
</success_criteria>

<output>
After completion, create `.planning/phases/42-fact-check-stage/42-01-SUMMARY.md`.
</output>
