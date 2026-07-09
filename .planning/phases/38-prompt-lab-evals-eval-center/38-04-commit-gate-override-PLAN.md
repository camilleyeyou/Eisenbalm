---
phase: 38-prompt-lab-evals-eval-center
plan: 04
type: execute
wave: 2
depends_on: ["38-01"]
files_modified:
  - convex/promptVersions.ts
  - apps/dispatch-control/__tests__/promptVersionsEvalGate.test.ts
  - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx
autonomous: true
requirements: [EVL-03]
must_haves:
  truths:
    - "Activating a prompt version is server-blocked when the target metric is not up or any scenario regresses beyond tolerance, reading eval_scores for the version being committed"
    - "The gate is freshness-guarded — a stale score for different prompt text cannot pass the gate for a version"
    - "An operator can commit despite a red gate by supplying a typed reason, which is written to audit_log"
    - "The in-progress-run guard is never bypassable by the override"
  artifacts:
    - path: "convex/promptVersions.ts"
      provides: "activate() extended with eval-gate + override arg"
      contains: "activate_override"
    - path: "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx"
      provides: "gate {blocked, reason} surfacing + override-with-reason UI"
      contains: "override"
  key_links:
    - from: "convex/promptVersions.ts::activate"
      to: "eval_scores by_workspace_agentKey_version index"
      via: "ctx.db.query('eval_scores').withIndex(...)"
      pattern: "eval_scores"
    - from: "convex/promptVersions.ts::activate override branch"
      to: "audit_log via internal.auditLog.write"
      via: "ctx.runMutation(internal.auditLog.write, { action: 'prompt_version.activate_override' ... })"
      pattern: "activate_override"
    - from: "VersionHistoryPanel.tsx"
      to: "api.promptVersions.activate with override"
      via: "activateVersion({ ..., override: { reason } })"
      pattern: "override"
---

<objective>
Extend the EXISTING `convex/promptVersions.ts::activate` mutation (the actual commit chokepoint — a direct dashboard→Convex mutation, NOT a pipeline endpoint per Research Pitfall 1) with the EVL-03 eval gate: block activation on target-metric-not-up / regression, freshness-guarded against eval_scores, with a logged override-with-reason escape hatch so the gate cannot deadlock. Surface both in VersionHistoryPanel.

Purpose: EVL-03 — upgrade Phase 28's "score never gates any action" to a server-enforced commit gate consistent with every v3.0 gate.
Output: gated `activate()` + override; VersionHistoryPanel override UI.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/38-prompt-lab-evals-eval-center/38-RESEARCH.md
@docs/API_CONTRACTS.md
@convex/promptVersions.ts
@convex/auditLog.ts

<interfaces>
<!-- The exact mutation to extend + the gate contract from §38.3. -->
convex/promptVersions.ts::activate (lines 145-210) already returns `{ blocked, reason }` for the in-progress-run guard and writes audit_log on success. ADD the eval-gate guard AFTER the in-progress-run guard (which must always win).

eval_scores row (Plan 01): `{ workspace_id, scenarioId, agentKey, promptVersion (string), overall, axes, costUsd, ranAt, source }`. Index `by_workspace_agentKey_version` = ['workspace_id','agentKey','promptVersion'].

Gate constant: `const EVAL_REGRESSION_TOLERANCE = 0.5` (0-10 scale, Pitfall 7 — LLM-judge non-determinism).

VersionHistoryPanel.tsx (lines 61-80) already calls `activateVersion({ workspace_id, agentKey, version, actorId })` and surfaces `result.blocked` + `result.reason` inline.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend promptVersions.activate with the eval gate + override-with-reason (EVL-03)</name>
  <files>convex/promptVersions.ts, apps/dispatch-control/__tests__/promptVersionsEvalGate.test.ts</files>
  <read_first>
    - convex/promptVersions.ts lines 136-210 (activate — the exact mutation to extend)
    - convex/auditLog.ts lines 26-50 (internal.auditLog.write signature)
    - apps/dispatch-control/__tests__/convexAuthLockdown.test.ts (convex-test harness: seed rows via t.run, call mutation via withIdentity)
    - docs/API_CONTRACTS.md §38.3 (the gate contract this implements)
  </read_first>
  <behavior>
    - Test 1 (block on regression): seed active version v1 with eval_scores rows (e.g. overall 8.0 for scenario A) and target v2 rows with overall 6.0 (regression > 0.5) → `activate(v2)` returns `{ blocked: true }` and does NOT flip isActive.
    - Test 2 (pass when up + fresh): seed v2 rows all >= v1 rows (within tolerance) AND with `ranAt >= v2.createdAt` → `activate(v2)` returns `{ blocked: false }` and flips isActive to v2.
    - Test 3 (block on stale/missing freshness): seed v2 rows with `ranAt < v2.createdAt` (or no v2 rows) → `activate(v2)` returns `{ blocked: true }` with a freshness reason.
    - Test 4 (override): with a red gate (regression), `activate(v2, { override: { reason: 'urgent voice fix' } })` returns `{ blocked: false, overridden: true }`, flips isActive, and writes an audit_log row with action `prompt_version.activate_override` containing the reason.
    - Test 5 (in-progress guard wins): with a `runs` row status 'running', `activate` returns the in-progress `{ blocked: true }` reason EVEN WITH an override supplied (override never bypasses the in-progress guard).
    - Test 6 (first activation): no currently-active version + no eval_scores → `activate(v1)` passes (nothing to regress against).
  </behavior>
  <action>
    In convex/promptVersions.ts, extend `activate`:
    - Add optional arg `override: v.optional(v.object({ reason: v.string() }))`.
    - Keep the existing in-progress-run guard FIRST and unchanged; it must return blocked even when `override` is present.
    - After the in-progress guard, resolve the target version's `createdAt` (from the already-collected `rows` / `target`) and the currently-active version (`previousActive`). If there is NO active version, skip the eval gate (first activation passes).
    - Otherwise compute the gate from eval_scores: query `by_workspace_agentKey_version` for `promptVersion === String(version)` (target) and for `String(previousActive)` (active). FRESHNESS: require at least one target row with `ranAt >= target.createdAt`; if none, `blocked` with reason "No fresh eval results for v{version} — run the scenario evals against this saved version before activating." Pair rows by scenarioId; for each scenario present on BOTH sides compute `delta = targetOverall - activeOverall`; if any `delta < -EVAL_REGRESSION_TOLERANCE`, blocked with a per-scenario regression reason. Compute aggregate avg overall for target vs active over the paired scenarios; if `avgTarget < avgActive`, blocked "Target metric not up (v{version} avg {x} < active avg {y})."
    - If `override?.reason` is a non-empty string, SKIP the eval-gate block (but never the in-progress guard) and, after the isActive flip, write BOTH audit rows (warning-3 clarification — the trail shows both the justification AND the standard state transition): first `internal.auditLog.write` with `action: 'prompt_version.activate_override'`, `resourceType: 'prompt_version'`, `resourceId: '{agentKey}:{version}'`, `after: JSON.stringify({ agentKey, version, reason: override.reason })`; then the normal `prompt_version.activated` row exactly as the non-override success path writes it. Return `{ blocked: false, overridden: true }`.
    - Preserve the existing success path + `prompt_version.activated` audit write; return `{ blocked: false }` on a clean (non-override) pass.
    - Add `const EVAL_REGRESSION_TOLERANCE = 0.5` near the top of the mutation module.

    Write apps/dispatch-control/__tests__/promptVersionsEvalGate.test.ts using the convex-test harness (seed prompt_versions + eval_scores via `t.run(ctx => ctx.db.insert(...))`, call `activate` via `t.withIdentity({ subject: 'user_operator' }).mutation(...)`) covering all 6 behaviors.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/promptVersionsEvalGate.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "activate_override" convex/promptVersions.ts` matches
    - `grep -q "EVAL_REGRESSION_TOLERANCE" convex/promptVersions.ts` matches
    - `grep -q "override" convex/promptVersions.ts` matches (the new arg exists)
    - `npx vitest run __tests__/promptVersionsEvalGate.test.ts` exits 0 with all 6 tests passing
  </acceptance_criteria>
  <done>activate() is eval-gated + freshness-guarded, override writes audit_log, in-progress guard still wins; gate test green.</done>
</task>

<task type="auto">
  <name>Task 2: Surface the gate + override-with-reason in VersionHistoryPanel</name>
  <files>apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx lines 39-209 (handleActivate + block surfacing to extend)
    - docs/design/dispatch-control-v2/README.md §Prompt Lab ("Override + reason escape hatch per audit R5")
  </read_first>
  <action>
    Extend `handleActivate`: when the mutation returns `{ blocked: true, reason }`, in addition to the existing inline reason surface, reveal an override affordance — a typed-reason input + "Commit anyway (override)" button (typed confirmation, consistent with the design's irreversible-action pattern). On override submit, call `activateVersion({ workspace_id, agentKey, version, actorId, override: { reason } })`; on `{ overridden: true }`, clear the blocked state. Keep the in-progress-run disable (D-02) unchanged — the override is ONLY for the eval gate, never offered while a run is running. Preserve ≥44px touch targets and the existing focus-visible styling. Do NOT touch the advisory single-run score copy in TestRunPanel (Research State-of-the-Art note — that surface stays advisory).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "override" apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx` matches
    - `grep -q "min-h-\[44px\]" apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx` still matches (touch targets preserved)
    - `pnpm --filter dispatch-control build` exits 0 (strict type-check — MEMORY rule)
  </acceptance_criteria>
  <done>The operator sees the block reason and can commit anyway with a typed reason; strict build passes.</done>
</task>

</tasks>

<verification>
- `npx vitest run __tests__/promptVersionsEvalGate.test.ts` green (6 behaviors).
- `pnpm --filter dispatch-control build` exits 0.
</verification>

<success_criteria>
EVL-03 — prompt commit is server-gated on target-metric-up with no regressions, freshness-guarded, with a logged override-with-reason that cannot deadlock; the in-progress guard remains unbypassable.
</success_criteria>

<output>
After completion, create `.planning/phases/38-prompt-lab-evals-eval-center/38-04-SUMMARY.md`.
</output>
