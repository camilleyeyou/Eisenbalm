---
phase: 38-prompt-lab-evals-eval-center
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - convex/schema.ts
  - convex/evalScores.ts
  - apps/dispatch-control/__tests__/evalScores.test.ts
autonomous: true
requirements: [EVL-04]
must_haves:
  truths:
    - "docs/API_CONTRACTS.md has a §38 section documenting all four Phase-38 contract surfaces before any code that implements them"
    - "A new append-only Convex table eval_scores stores one row per scenario run"
    - "evalScores.record inserts a row and never patches or deletes an existing row"
    - "evalScores.listForScenario and listForAgent return time-series rows for the Eval Center + drawer"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "§38 contract for GET /eval/scenarios, eval_scores table, promptVersions.activate eval-gate+override, POST /eval/shadow-run"
      contains: "## §38"
    - path: "convex/schema.ts"
      provides: "eval_scores table definition"
      contains: "eval_scores: defineTable"
    - path: "convex/evalScores.ts"
      provides: "record mutation (requireOperator, append-only) + listForScenario + listForAgent queries"
      exports: ["record", "listForScenario", "listForAgent"]
  key_links:
    - from: "convex/evalScores.ts"
      to: "convex/lib/auth requireOperator"
      via: "import + await requireOperator(ctx) in record"
      pattern: "requireOperator"
    - from: "convex/evalScores.ts::record"
      to: "eval_scores table"
      via: "ctx.db.insert('eval_scores', ...)"
      pattern: "ctx.db.insert\\('eval_scores'"
---

<objective>
Lay the contract-first foundation for Phase 38: amend docs/API_CONTRACTS.md with the full §38 boundary (the hard CLAUDE.md rule — contract BEFORE code), and build the append-only `eval_scores` Convex time-series table + its `evalScores.ts` mutation/query surface that every downstream consumer (eval drawer, commit gate, Eval Center) reads and writes.

Purpose: EVL-04's editorial drift detector is an append-only time-series; this plan creates its durable store and locks the whole phase's interface boundary up front so no later plan invents a shape.
Output: §38 in API_CONTRACTS.md; `eval_scores` table in schema.ts; `convex/evalScores.ts` (record/listForScenario/listForAgent).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/38-prompt-lab-evals-eval-center/38-CONTEXT.md
@.planning/phases/38-prompt-lab-evals-eval-center/38-RESEARCH.md
@convex/auditLog.ts
@convex/promptVersions.ts

<interfaces>
<!-- Existing Convex conventions the executor mirrors. No codebase exploration needed. -->

convex/schema.ts existing append-only table pattern (audit_log, lines 266-277):
```ts
audit_log: defineTable({
  workspace_id: v.string(),
  actorId: v.string(),
  action: v.string(),
  resourceType: v.optional(v.string()),
  resourceId: v.optional(v.string()),
  before: v.optional(v.string()),
  after: v.optional(v.string()),
  timestamp: v.number(),
})
  .index('by_workspace', ['workspace_id'])
  .index('by_workspace_timestamp', ['workspace_id', 'timestamp']),
```

Auth guard (convex/lib/auth.ts) used by every dashboard-authenticated mutation:
`await requireOperator(ctx)` — returns the verified Clerk actor id.

D-09 locked eval_scores row shape:
`{ workspace_id, scenarioId, agentKey, promptVersion (string), overall (number), axes (JSON string), costUsd (number), ranAt (number), source ('drawer'|'commit'|'manual') }`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Amend docs/API_CONTRACTS.md with §38 (contract-first, whole-phase boundary)</name>
  <files>docs/API_CONTRACTS.md</files>
  <read_first>
    - docs/API_CONTRACTS.md lines 3525-3666 (§37 + Error handling rules — append §38 AFTER §37.4, BEFORE "## Error handling rules")
    - .planning/phases/38-prompt-lab-evals-eval-center/38-RESEARCH.md (§Architecture Patterns, §Code Examples — exact shapes)
    - convex/promptVersions.ts lines 145-210 (the activate mutation the gate extends)
  </read_first>
  <action>
    Insert a new `## §38 — Prompt Lab Evals + Eval Center (Phase 38)` section immediately after §37.4 and before `## Error handling rules`. Document all FOUR surfaces so downstream plans implement to a fixed contract:

    §38.1 — `GET /eval/scenarios` (pipeline, api/eval.py, prefix `/eval`). Optional `?agentKey=` filter. Response: `{ scenarios: Scenario[] }` where `Scenario = { id: string, agentKey: string, description: string, whatItCatches: string, input: Record<string,string>, scoringTarget: { min_overall: number } }`. `input` is EXACTLY a `dict[str,str]` variables map matching `TestRunRequest.variables` (NOT a full request body). Clerk-guarded via the same optional-bearer `_require_operator` pattern as agents.py.

    §38.2 — `eval_scores` Convex table (append-only, D-09). Row: `{ workspace_id, scenarioId, agentKey, promptVersion (string), overall (number 0-10), axes (JSON string), costUsd (number), ranAt (number, Date.now()), source ('drawer'|'commit'|'manual') }`. Never updated/deleted. `evalScores.record` (mutation, requireOperator), `evalScores.listForScenario`, `evalScores.listForAgent` (queries). Written directly dashboard→Convex (NO pipeline round-trip — mirrors prompt_versions; the EDT-05 write boundary governs Sanity content only).

    §38.3 — `promptVersions.activate` eval-gate + override (EVL-03, extends the existing `{blocked, reason}` mutation, NOT a new endpoint). New optional arg `override: { reason: string }`. Gate logic (reads eval_scores only): block if no FRESH eval_scores row exists for the target version (a row with `promptVersion === String(version)` AND `ranAt >= the version's prompt_versions.createdAt`), OR any scenario regresses (`targetOverall < activeOverall - TOLERANCE`, TOLERANCE = 0.5), OR aggregate avg target overall < aggregate avg active overall. First-ever activation (no active version) passes. `override.reason` bypasses the eval-gate ONLY (never the in-progress-run guard) and writes `audit_log` action `prompt_version.activate_override` with `after = {agentKey, version, reason}`. Return `{ blocked: false }` or `{ blocked: false, overridden: true }` on override.

    §38.4 — `POST /eval/shadow-run` (pipeline, api/eval.py). Body `{ workspace_id: string }`. Runs Scout's PURE `discover_candidates()` against LIVE search and returns `{ candidates: CharityCandidate[], featuredKeysCount: number }`. ISOLATION CONTRACT (D-12): writes NOTHING — no pitchLog, charities, agent_runs, deliberationEvents, pipelineRuns Convex rows; no Sanity write_charity. Read-only preview only.

    Cross-link each subsection to the owning Phase-38 plan. Keep prose consistent with the existing §37 style (short, shape-first).
  </action>
  <verify>
    <automated>grep -q "## §38" docs/API_CONTRACTS.md && grep -q "eval_scores" docs/API_CONTRACTS.md && grep -q "shadow-run" docs/API_CONTRACTS.md && grep -q "activate_override" docs/API_CONTRACTS.md && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^### §38." docs/API_CONTRACTS.md` returns 4 (four subsections §38.1–§38.4)
    - `grep -q "GET /eval/scenarios" docs/API_CONTRACTS.md` matches
    - `grep -q "prompt_version.activate_override" docs/API_CONTRACTS.md` matches
    - The §38 block appears before the line `## Error handling rules` (verify: `awk '/## §38/{s=NR} /## Error handling rules/{e=NR} END{exit !(s>0 && s<e)}' docs/API_CONTRACTS.md`)
  </acceptance_criteria>
  <done>docs/API_CONTRACTS.md contains a complete §38 with all four subsections, positioned before the Error handling rules section.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: eval_scores table + convex/evalScores.ts (append-only record + time-series reads)</name>
  <files>convex/schema.ts, convex/evalScores.ts, apps/dispatch-control/__tests__/evalScores.test.ts</files>
  <read_first>
    - convex/schema.ts lines 265-308 (audit_log + prompt_versions patterns to mirror)
    - convex/auditLog.ts (mutation/query file conventions, requireOperator vs internal)
    - apps/dispatch-control/__tests__/convexAuthLockdown.test.ts (convex-test harness: convexTest, schema, modules glob, withIdentity)
  </read_first>
  <behavior>
    - Test 1: `evalScores.record` inserts a row; a subsequent `listForScenario` returns it with all D-09 fields intact.
    - Test 2: Calling `record` twice for the same scenarioId+promptVersion produces TWO rows (append-only — never patches/dedups).
    - Test 3: `evalScores.ts` source contains no `ctx.db.patch` or `ctx.db.delete` (append-only invariant, source-scan).
    - Test 4: `record` without an operator identity is rejected (requireOperator guard) — mirror convexAuthLockdown.test.ts's unauthenticated-call assertion.
  </behavior>
  <action>
    In convex/schema.ts, add an `eval_scores` table (place it near prompt_versions, ~line 308) with fields from §38.2: `workspace_id: v.string()`, `scenarioId: v.string()`, `agentKey: v.string()`, `promptVersion: v.string()`, `overall: v.number()`, `axes: v.string()` (JSON), `costUsd: v.number()`, `ranAt: v.number()`, `source: v.string()`. Indexes: `.index('by_workspace', ['workspace_id'])`, `.index('by_workspace_scenario', ['workspace_id', 'scenarioId'])`, `.index('by_workspace_agentKey', ['workspace_id', 'agentKey'])`, `.index('by_workspace_agentKey_version', ['workspace_id', 'agentKey', 'promptVersion'])`.

    Create convex/evalScores.ts mirroring auditLog.ts/promptVersions.ts style:
    - `record` (mutation): args `{ workspace_id, scenarioId, agentKey, promptVersion, overall, axes, costUsd, source }`; `await requireOperator(ctx)`; `ctx.db.insert('eval_scores', { ...args, ranAt: Date.now() })`. NO patch/delete anywhere — append-only.
    - `listForScenario` (query): args `{ workspace_id, scenarioId }`; use `by_workspace_scenario` index; return rows ordered ascending by ranAt (time-series).
    - `listForAgent` (query): args `{ workspace_id, agentKey }`; use `by_workspace_agentKey` index; return rows (newest-first `.order('desc')`).

    Write apps/dispatch-control/__tests__/evalScores.test.ts using the convex-test harness (copy the `convexTest({ schema, modules })` + `import.meta.glob('../../../convex/**/*.*s')` setup from convexAuthLockdown.test.ts) covering the 4 behaviors above.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/evalScores.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "eval_scores: defineTable" convex/schema.ts` matches
    - `grep -q "by_workspace_agentKey_version" convex/schema.ts` matches (the gate's index exists)
    - `grep -Eq "ctx.db.(patch|delete)" convex/evalScores.ts` returns NON-zero exit (no patch/delete present — append-only)
    - `npx vitest run __tests__/evalScores.test.ts` exits 0 with all 4 tests passing
  </acceptance_criteria>
  <done>eval_scores table + evalScores.ts exist; record is append-only and operator-guarded; the time-series queries return rows; evalScores.test.ts is green.</done>
</task>

</tasks>

<verification>
- `grep "## §38" docs/API_CONTRACTS.md` present with 4 subsections.
- `npx vitest run __tests__/evalScores.test.ts` green.
- No `ctx.db.patch`/`ctx.db.delete` in evalScores.ts (append-only).
</verification>

<success_criteria>
The Phase 38 contract boundary is documented before any implementing code, and the append-only eval_scores store + its dashboard-authenticated record/read surface exist and are tested.
</success_criteria>

<output>
After completion, create `.planning/phases/38-prompt-lab-evals-eval-center/38-01-SUMMARY.md`.
</output>
