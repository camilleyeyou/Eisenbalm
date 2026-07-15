---
phase: 43-my-tasks-decision-log
plan: 04
type: execute
wave: 3
depends_on: ["43-03"]
files_modified:
  - apps/dispatch-control/lib/taskSupersession.ts
  - apps/dispatch-control/__tests__/taskSupersession.test.ts
autonomous: true
requirements: [TSK-05]

must_haves:
  truths:
    - "a task whose openedAt predates a matching run.section_rerolled audit row (matched by runId + agentKey, honoring the claim-vs-finding section-vocab mismatch) is marked sessionState:'superseded' with a supersededBy link to the new step — it is NOT dropped"
    - "a task that vanished from the projection WITHOUT a matching reroll is marked 'resolved' (struck-through 'resolved just now') for the session, then falls out on the next snapshot"
    - "resolved/superseded are a screen-local DisplayTask wrapper — never added to TaskSeverity/SEVERITY_MINUTES/SEVERITY_ORDER (closed exhaustive Records, Pitfall 4)"
    - "the predicate is a pure function (testable without mounting the screen) and requires NO backend/pipeline change (audit-log cross-reference only)"
  artifacts:
    - path: "apps/dispatch-control/lib/taskSupersession.ts"
      provides: "DisplayTask type + computeSessionStates(current, prevSnapshot, rerollRows, now) pure predicate"
      exports: ["computeSessionStates"]
    - path: "apps/dispatch-control/__tests__/taskSupersession.test.ts"
      provides: "unit coverage of superseded vs resolved vs active discrimination + section-vocab match"
  key_links:
    - from: "computeSessionStates"
      to: "audit_log run.section_rerolled rows"
      via: "runId+agentKey match with timestamp > task.openedAt"
      pattern: "run.section_rerolled"
---

<objective>
Build the pure client-side supersession/resolution predicate (TSK-05, per §43.6) as its own testable module. RESEARCH Pitfall 2 is the load-bearing fact: rerun_agent does NOT clear stale qaCorrections/claim_checks, so a rerolled task does NOT vanish on the next render — the ONLY queryable reroll signal is the audit_log row `action:"run.section_rerolled"`, `resourceId:"{runId}:{agentKey}"`. Simple vanish-diffing is therefore insufficient; the predicate must cross-reference that audit row.

Purpose: "A task never disappears silently" (TSK-05) with "no tasks table" (§2). This module encodes both the audit cross-reference (superseded) and the in-session vanish memory (resolved), keeping resolved/superseded OUT of TaskSeverity (a type-safety necessity, Pitfall 4).
Output: lib/taskSupersession.ts (DisplayTask + computeSessionStates) + unit tests. No backend change.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/API_CONTRACTS.md
@apps/dispatch-control/lib/derivedState.ts
@apps/dispatch-control/lib/galley/sectionIdMap.ts

<interfaces>
<!-- Verified from the current repo tree + research. -->
DerivedTask (derivedState.ts, post-43-03): { id, sev, title, where, why, rec?, primary{label,href}, insp?, stage, openedAt? }. Task ids: `qa-{_id}` (finding), `claim-{_id}` (claim), `signoff-facts`/`signoff-voice`.
Reroll audit row (control.py:583-589, verified): { action:'run.section_rerolled', resourceId:`${runId}:${agentKey}`, timestamp }. agentKey is snake_case (e.g. 'origin_story').
Section-vocab mismatch (Pitfall 2): qaCorrections.sectionName === agentKey directly (snake_case); claim_checks.sectionName is camelCase (e.g. 'originStory') and needs qaSectionToGalleyId(agentKey) to compare. The screen must pass each task's section identity so the predicate can match; add an optional `agentKey?`/`sectionName` field carried into the input, OR have the screen supply a `taskSection(task)` resolver — choose the simplest: computeSessionStates accepts, per current task, the underlying section string already resolved to agentKey form by the caller (document the caller's responsibility). qaSectionToGalleyId lives in lib/galley/sectionIdMap.ts.
TaskSeverity (derivedState.ts:26) = 'must-fix'|'review-recommended'|'information' — CLOSED. SEVERITY_MINUTES/SEVERITY_ORDER are exhaustive Records over it. Do NOT extend.
Reroll rows are fetched by the screen via auditLog.listForWorkspace (client-filtered for action==='run.section_rerolled' + resourceId startsWith runId) — no new query. The predicate just receives the filtered rows.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED unit tests for computeSessionStates</name>
  <files>apps/dispatch-control/__tests__/taskSupersession.test.ts</files>
  <read_first>
    - apps/dispatch-control/__tests__/derivedState.test.ts (node-env unit test style — no Convex; imports the pure module)
    - docs/API_CONTRACTS.md §43.6 (the superseded/resolved contract)
    - apps/dispatch-control/lib/galley/sectionIdMap.ts (qaSectionToGalleyId — the vocab bridge)
  </read_first>
  <behavior>
    - active: a current task with no matching reroll row, present in both current and prev snapshot → sessionState 'active'.
    - superseded (finding): a QA-finding task with openedAt T and section 'origin_story', with a reroll row resourceId `${runId}:origin_story` timestamp > T → 'superseded', supersededBy set to the rerolled step link/label.
    - superseded (claim, vocab bridge): a claim task whose section is 'originStory' matched against reroll agentKey 'origin_story' via qaSectionToGalleyId → 'superseded'.
    - NOT superseded: a reroll row whose timestamp is OLDER than the task openedAt (reroll happened before the task's artifact) → 'active'.
    - resolved: a task present in prevSnapshot but ABSENT from current, with NO matching reroll → 'resolved' (kept for the session), and it does NOT appear as active.
    - superseded precedence over resolved: a task that vanished AND has a newer matching reroll → 'superseded' (link to new step), not 'resolved'.
    - no reroll rows + no prev snapshot → every current task 'active'.
  </behavior>
  <action>
Create __tests__/taskSupersession.test.ts (node env — plain vitest, no Convex). Import computeSessionStates + DisplayTask from ../lib/taskSupersession. Build DerivedTask fixtures (with openedAt + section identity) and reroll-row fixtures; assert each <behavior> bullet, including the qaSectionToGalleyId claim-vocab case. RED until Task 2.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- __tests__/taskSupersession.test.ts || true</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "run.section_rerolled\|computeSessionStates" apps/dispatch-control/__tests__/taskSupersession.test.ts` matches
    - `grep -n "superseded\|resolved" apps/dispatch-control/__tests__/taskSupersession.test.ts` matches
    - the command exits non-zero (RED) before Task 2
  </acceptance_criteria>
  <done>The superseded-vs-resolved-vs-active discrimination (including the claim/finding vocab bridge and precedence) is pinned RED.</done>
</task>

<task type="auto">
  <name>Task 2: Implement lib/taskSupersession.ts</name>
  <files>apps/dispatch-control/lib/taskSupersession.ts</files>
  <read_first>
    - apps/dispatch-control/lib/derivedState.ts (DerivedTask/TaskSeverity — import the type; DO NOT extend TaskSeverity)
    - apps/dispatch-control/lib/galley/sectionIdMap.ts (qaSectionToGalleyId)
    - docs/API_CONTRACTS.md §43.6
  </read_first>
  <action>
Create lib/taskSupersession.ts:
1. `export type DisplayTask = DerivedTask & { sessionState: 'active' | 'resolved' | 'superseded'; supersededBy?: string }`.
2. `export interface RerollSignal { agentKey: string; timestamp: number; href?: string }` (built by the caller from the run.section_rerolled rows: parse resourceId `${runId}:${agentKey}`).
3. `export function computeSessionStates(current: DerivedTask[], prevSnapshot: DerivedTask[] | null, rerolls: RerollSignal[], now: number, taskSection: (t: DerivedTask) => string | undefined): DisplayTask[]`:
   - For each current task: find a reroll where the agentKey matches the task's section — matching qaCorrections/finding sections directly (snake_case) AND claim sections via qaSectionToGalleyId(reroll.agentKey) === taskSection(task); if such a reroll has timestamp > (task.openedAt ?? 0), mark 'superseded' with supersededBy = a link/label to the new step (reroll.href or the task's stage). Else 'active'.
   - For each task in prevSnapshot NOT in current: if it has a matching newer reroll → 'superseded'; else → 'resolved' (age/label 'resolved just now'); append these session-carried entries after the active/superseded current set.
   - resolved/superseded live ONLY on the DisplayTask wrapper — never mutate sev; do not import SEVERITY_* maps.
Keep the module pure (now injected). The caller (43-05) owns fetching reroll rows + maintaining prevSnapshot in a ref.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- __tests__/taskSupersession.test.ts && pnpm --filter dispatch-control typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export function computeSessionStates" apps/dispatch-control/lib/taskSupersession.ts` matches
    - `grep -n "qaSectionToGalleyId" apps/dispatch-control/lib/taskSupersession.ts` matches (vocab bridge used)
    - `grep -nE "TaskSeverity|SEVERITY_MINUTES|SEVERITY_ORDER" apps/dispatch-control/lib/taskSupersession.ts` shows TaskSeverity is NOT extended (only imported as a type at most; no new member added)
    - `pnpm --filter dispatch-control test -- __tests__/taskSupersession.test.ts` exits 0 (RED→GREEN)
    - `pnpm --filter dispatch-control typecheck` exits 0
  </acceptance_criteria>
  <done>A pure, tested supersession/resolution predicate exists that cross-references run.section_rerolled audit rows and keeps resolved/superseded off TaskSeverity — no backend change.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- __tests__/taskSupersession.test.ts` green.
- `pnpm --filter dispatch-control typecheck` green (TaskSeverity Records untouched).
</verification>

<success_criteria>
A rerolled task renders superseded (link to the new step) via the audit cross-reference, a terminated task renders resolved for the session, both live on a screen-local DisplayTask wrapper, and the predicate is pure and backend-free.
</success_criteria>

<output>
After completion, create `.planning/phases/43-my-tasks-decision-log/43-04-SUMMARY.md`.
</output>
