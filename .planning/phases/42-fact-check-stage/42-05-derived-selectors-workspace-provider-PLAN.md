---
phase: 42-fact-check-stage
plan: 05
type: execute
wave: 2
depends_on: ["42-01"]
files_modified:
  - apps/dispatch-control/lib/derivedState.ts
  - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx
  - apps/dispatch-control/__tests__/derivedState.test.ts
autonomous: true
requirements: [FCT-02]

must_haves:
  truths:
    - "deriveFactCheckSummary(rows) returns the affirmative summary {factCoverage 'X of Y', mustFixCount, changedCount, uncheckedCount, conflictsCount, checksNotRunCount, lastVerifiedAt} as a pure selector over claim_checks rows — no stored counters"
    - "Claim severity is importance-aware: isMustFix = status==='pending' && (importance ?? 'Supporting')==='Load-bearing' && !sourceUrl; deriveTasks uses it so an unsourced Incidental claim is Review-recommended, not Must-fix"
    - "WorkspaceStateProvider's claimRows mapping carries claimIndex/claimId/importance/changedSinceCheck so My Tasks + stage badges read the SAME data as the Stage 3 screen (no silent divergence)"
  artifacts:
    - path: "apps/dispatch-control/lib/derivedState.ts"
      provides: "isMustFix, deriveFactCheckSummary, corrected deriveTasks claim severity, widened DerivationInputs.claimRows type"
      exports: ["deriveFactCheckSummary", "isMustFix"]
    - path: "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx"
      provides: "claimRows mapping extended with claimIndex, claimId, importance, changedSinceCheck"
      contains: "importance: row.importance"
  key_links:
    - from: "WorkspaceStateProvider claimRows mapping"
      to: "derivedState.ts deriveTasks / deriveFactCheckSummary"
      via: "the DerivationInputs.claimRows array both consume"
      pattern: "importance"
---

<objective>
Add the pure fact-check summary selector and importance-aware severity to lib/derivedState.ts (FCT-02, D-04/D-05/D-06/D-07/D-08), and widen the WorkspaceStateProvider claimRows mapping so My Tasks, the stage badges, and the new Stage 3 screen all derive from the same rows. This is the RESEARCH-flagged required correction: deriveTasks currently computes claim severity from sourceUrl presence alone.

Purpose: All four surfaces (counters, My Tasks, Approval readiness, header status) are derived selectors over the same Convex data, so a single mutation propagates to all four via reactivity (D-16) — but ONLY if they share the same importance-aware logic and the provider actually carries importance. Otherwise the stage badge and the Stage 3 screen visibly disagree.

SCOPE NOTE (checker Warning 2): this plan adds `importance`/`changedSinceCheck` (severity/summary inputs) to the provider's `claimRows` — NOT `claimType`/`context`. That is deliberate: My Tasks + stage badges never need `claimType` (filter facet) or `context` (supporting passage). The Stage 3 `FactCheckScreen` and Approval `SourceIndex`, which DO need those, subscribe to the FULL `claim_checks` rows via `useQuery(api.claimChecks.listByRunId,{runId})` (mandated in Plan 42-06 Task 3), where `claimType`/`context` are already present. So the provider mapping stays lean and the full-row consumers get everything.
Output: isMustFix + deriveFactCheckSummary + corrected deriveTasks; widened claimRows type + mapping.
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
<!-- Verified from the current repo tree. -->

lib/derivedState.ts:
  DerivationInputs.claimRows (lines 63-71) TODAY: Array<{ status: string; sourceUrl?: string; sectionName?: string; claimText?: string; _id: string }> | undefined
  deriveFactCheckStage (line 136) reads claimRows.status; unaffected by this change except it stays consistent.
  deriveTasks claim loop (lines 314-327) TODAY: `const sev = row.sourceUrl ? 'review-recommended' : 'must-fix'`  <- importance-blind, MUST change.

WorkspaceStateProvider.tsx:
  claimRowsRaw = useQuery(api.claimChecks.listByRunId, ...) (line 121)
  claimRows mapping (lines 133-139) TODAY: { _id, status, sourceUrl, sectionName, claimText: row.text }

deriveFactCheckSummary illustrative sketch: 42-RESEARCH.md lines 316-369 (NOT locked; exact predicates are discretion, bounded by "every claim renders one explicit state; blank never means verified").
Confirm keeps calling claimChecks:setStatus directly (operator-guarded) — the mustFix->0 equivalence with allSignedOff is a regression invariant.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: isMustFix + deriveFactCheckSummary + corrected deriveTasks severity + widened claimRows type</name>
  <files>apps/dispatch-control/lib/derivedState.ts, apps/dispatch-control/__tests__/derivedState.test.ts</files>
  <read_first>
    - apps/dispatch-control/lib/derivedState.ts (DerivationInputs.claimRows type lines 58-86; deriveFactCheckStage lines 136-144; deriveTasks claim loop lines 314-327)
    - .planning/phases/42-fact-check-stage/42-RESEARCH.md (deriveFactCheckSummary sketch lines 316-369; Pattern 4 lines 216-236; Open Question 3 lines 544-547 the allSignedOff<->mustFix equivalence)
    - docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md §4 (the counter definitions: factCoverage, mustFixCount=unsourced load-bearing, changedCount block-level, "blank never means verified")
    - apps/dispatch-control/__tests__/derivedState.test.ts (the existing suite to extend — match its describe/it structure)
  </read_first>
  <behavior>
    - isMustFix(row) is true iff status==='pending' && (importance ?? 'Supporting')==='Load-bearing' && !sourceUrl; false for Incidental/Supporting unsourced rows and for any non-pending row.
    - deriveFactCheckSummary(rows): factCoverage=`${rows.filter(status!=='pending').length} of ${rows.length}`; mustFixCount=rows.filter(isMustFix).length; changedCount=rows.filter(r=>r.changedSinceCheck).length; uncheckedCount=rows.filter(status==='pending').length; conflictsCount=rows.filter(r=>r.conflict).length; checksNotRunCount=rows.filter(status==='pending' && !sourceUrl && !changedSinceCheck).length; lastVerifiedAt=max(checkedAt) or null. Every counter is defined even at zero (never omitted).
    - deriveTasks: an unsourced Incidental claim (importance:'Incidental', no sourceUrl, pending) yields a 'review-recommended' task, NOT 'must-fix'; an unsourced Load-bearing pending claim yields 'must-fix'; a legacy row (importance undefined) unsourced pending yields 'review-recommended' (defaults Supporting).
    - Regression invariant: for any row set where every row status !== 'pending' (allSignedOff-true condition), deriveFactCheckSummary(rows).mustFixCount === 0.
    - A 'removed'-status row is excluded from mustFix (status !== 'pending') and does not inflate uncheckedCount.
  </behavior>
  <action>
In lib/derivedState.ts:
1. Widen `DerivationInputs.claimRows`'s element type (lines 63-71) additively to include: `claimIndex?: number; claimId?: string; importance?: 'Load-bearing' | 'Supporting' | 'Incidental'; changedSinceCheck?: boolean; conflict?: boolean; checkedAt?: number`. Keep existing fields.
2. Add and export `isMustFix(row: { status: string; importance?: string; sourceUrl?: string }): boolean` per the <behavior> definition.
3. Add and export `deriveFactCheckSummary(rows)` returning the FactCheckSummary shape from the 42-RESEARCH sketch (lines 340-369). Transcribe that sketch; the conflictsCount/checksNotRunCount predicates are the recommended defaults (D-07) — keep them, they are honest and never-blank.
4. In the deriveTasks claim loop (line 316), replace `const sev: TaskSeverity = row.sourceUrl ? 'review-recommended' : 'must-fix'` with `const sev: TaskSeverity = isMustFix(row) ? 'must-fix' : 'review-recommended'`. Leave the rest of the loop (title, href, stage 3) unchanged.

Extend apps/dispatch-control/__tests__/derivedState.test.ts with a `deriveFactCheckSummary`/`isMustFix` describe block covering the full <behavior> list, and add cases to the existing deriveTasks tests asserting the importance-aware severity change (Incidental-unsourced => review-recommended; Load-bearing-unsourced => must-fix). Include the allSignedOff<->mustFix equivalence test.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- __tests__/derivedState.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export function isMustFix" apps/dispatch-control/lib/derivedState.ts` matches
    - `grep -n "export function deriveFactCheckSummary" apps/dispatch-control/lib/derivedState.ts` matches
    - `grep -n "isMustFix(row) ? 'must-fix' : 'review-recommended'" apps/dispatch-control/lib/derivedState.ts` matches
    - `grep -n "importance" apps/dispatch-control/lib/derivedState.ts` shows the widened claimRows type
    - `pnpm --filter dispatch-control test:unit -- __tests__/derivedState.test.ts` exits 0
  </acceptance_criteria>
  <done>The importance-aware selector + severity live in the one place editorial policy is defined; every counter is defined even at zero; the allSignedOff<->mustFix equivalence is locked by test.</done>
</task>

<task type="auto">
  <name>Task 2: Extend WorkspaceStateProvider claimRows mapping to carry the new severity/summary fields</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx (claimRowsRaw useQuery line 121; claimRows mapping lines 133-139; the DerivationInputs assembly lines 141-155)
    - apps/dispatch-control/lib/derivedState.ts (the widened DerivationInputs.claimRows type from Task 1 — the mapping must satisfy it)
    - .planning/phases/42-fact-check-stage/42-RESEARCH.md (Pitfall 1 lines 272-276 — why the narrow mapping silently breaks the summary/tasks)
  </read_first>
  <action>
In WorkspaceStateProvider.tsx, extend the `claimRows = claimRowsRaw?.map(row => ({ ... }))` mapping (lines 133-139) additively to also carry:
  `claimIndex: row.claimIndex,`
  `claimId: row.claimId,`
  `importance: row.importance,`
  `changedSinceCheck: row.changedSinceCheck,`
  `conflict: row.conflict,`
  `checkedAt: row.checkedAt,`
Keep the existing `_id, status, sourceUrl, sectionName, claimText: row.text` fields. Do NOT add a new useQuery — `claimChecks:listByRunId` already returns full rows (it just wasn't projecting these).
Deliberately do NOT add `claimType`/`context` here (checker Warning 2): My Tasks/stage badges (the provider's consumers) never use them; the Stage 3 screen + Approval SourceIndex read the full untouched rows via their own `useQuery(api.claimChecks.listByRunId,{runId})` where `claimType`/`context` are present. Keep the provider mapping lean. No other change to the provider.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "importance: row.importance" apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx` matches
    - `grep -n "changedSinceCheck: row.changedSinceCheck" apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx` matches
    - `grep -n "claimIndex: row.claimIndex" apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx` matches
    - `pnpm --filter dispatch-control build` exits 0 (strict type-check — the mapping satisfies the widened type; vitest alone would not catch this)
  </acceptance_criteria>
  <done>My Tasks + stage badges now read importance/changedSinceCheck from the same rows the Stage 3 screen will read; the strict build confirms the widened type is satisfied everywhere; claimType/context are intentionally left to the full-row consumers.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test:unit -- __tests__/derivedState.test.ts` green.
- `pnpm --filter dispatch-control build` exits 0 (project memory: vitest does NOT type-check — the build is the real gate on the type widening).
</verification>

<success_criteria>
FCT-02 selector layer complete: the affirmative summary is a pure derived function; severity is importance-aware everywhere; the provider carries the severity/summary fields so all four surfaces agree; blank never stands for verified (every counter defined at zero).
</success_criteria>

<output>
After completion, create `.planning/phases/42-fact-check-stage/42-05-SUMMARY.md`.
</output>
