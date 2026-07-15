---
phase: 43-my-tasks-decision-log
plan: 08
type: execute
wave: 5
depends_on: ["43-02", "43-07"]
files_modified:
  - convex/charities.ts
  - apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx
  - apps/dispatch-control/__tests__/charitiesDoNotUse.test.ts
autonomous: true
requirements: [TSK-06]

must_haves:
  truths:
    - "marking a charity Do-not-use (blocklist) now REQUIRES a reason and emits a structured audit_log decision row (action 'charity.blocklisted') via the shared writeDecision helper — closing the pre-existing Phase 26 no-audit gap"
    - "charities.setStatus (or a dedicated markDoNotUse mutation) rejects a blocklist transition with an empty/missing reason"
    - "the RegistryTable blocklist confirm popover collects a required reason (textarea) and passes it to the mutation; confirm is disabled until the reason is non-empty"
    - "this is NET-NEW reason capture — there was no reason to 'promote'; the emitted row is projected by the Decision Log"
    - "convex/* changes are synced to dev:modest-magpie-797 via pnpm --filter @eisenbalm/convex dev:once"
  artifacts:
    - path: "convex/charities.ts"
      provides: "reason-required blocklist transition + writeDecision emission (action 'charity.blocklisted')"
      contains: "charity.blocklisted"
    - path: "apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx"
      provides: "reason textarea in the blocklist confirm flow, passed to the mutation"
      contains: "reason"
  key_links:
    - from: "charities.setStatus blocklist path"
      to: "auditLog.writeDecision"
      via: "structured reason + action 'charity.blocklisted'"
      pattern: "writeDecision"
---

<objective>
Add reason capture + audit emission to the Do-not-use (charity blocklist) flow (TSK-06, RESEARCH Pitfall 3). This is NET-NEW work, not a promotion: `charities.setStatus` today has NO reason param, no confirmation reason, and writes ZERO audit_log rows (a documented Phase 26 gap). Phase 43 makes Do-not-use a first-class reasoned decision the Decision Log projects.

Purpose: TSK-06 explicitly lists "Do not use" as a reason-requiring action. Because its substrate never existed, it must be built here — mutation reason enforcement + a structured writeDecision emission + a reason-collecting UI — reusing the shared helper from 43-02.
Output: reason-required blocklist mutation + audit emission + RegistryTable reason textarea + Convex sync.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/API_CONTRACTS.md
@convex/charities.ts
@convex/auditLog.ts
@apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx

<interfaces>
<!-- Verified from the current repo tree. -->
convex/charities.ts::setStatus (167-189): args { workspace_id, charityId, status }; requireOperator; validates status in [candidate,featured,blocklisted]; `ctx.db.patch(charityId,{status})` — NO reason, NO audit write. Returns the actor from requireOperator (see issues.ts: `const actor = await requireOperator(ctx)`).
writeDecision (43-02): internal.auditLog.writeDecision({ workspace_id, actorId, action, resourceType?, resourceId?, before?, after?, reason, ... }).
RegistryTable.tsx: handleBlocklist(charityId) (84-95) calls setStatus({workspace_id,charityId,status:'blocklisted'}); the confirm UI (212-240) is an inline popover with two buttons and NO text input. handleUnblocklist (97-107) sets status back to 'candidate' (no reason needed — only the blocklist transition requires a reason). confirmingBlocklistId/pendingAction/actionError state already exist.
charities.ts has NO existing test file (verified: no __tests__/charities*.test.ts) — create a new edge-runtime convex-test and register it in vitest.config.ts.
Annotations spec: Do-not-use = typed confirmation (org name) + required reason, Editor-in-chief only. Phase 49 owns the role gating; Phase 43 collects the reason + emits the decision (typed-org-name confirmation is optional polish — required reason + audit is the TSK-06 must).
Convex sync: `pnpm --filter @eisenbalm/convex dev:once` after editing convex/*.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED convex-test — blocklist requires reason + emits decision row</name>
  <files>apps/dispatch-control/__tests__/charitiesDoNotUse.test.ts, apps/dispatch-control/vitest.config.ts</files>
  <read_first>
    - apps/dispatch-control/__tests__/charityCorrections.test.ts (the closest charity convex-test pattern to mirror; edge-runtime)
    - apps/dispatch-control/vitest.config.ts (register the new edge-runtime file)
    - convex/charities.ts (setStatus — the mutation under test)
    - docs/API_CONTRACTS.md §43.7 (the Do-not-use net-new contract)
  </read_first>
  <behavior>
    - Calling setStatus with status 'blocklisted' and an empty/missing reason THROWS (reason required for the blocklist transition).
    - Calling setStatus with status 'blocklisted' + a non-empty reason patches the charity to blocklisted AND inserts an audit_log row with action 'charity.blocklisted' carrying the structured reason (visible via auditLog.listDecisions / listForWorkspace).
    - Non-blocklist transitions (e.g. back to 'candidate' via unblocklist) do NOT require a reason and still work.
  </behavior>
  <action>
Create __tests__/charitiesDoNotUse.test.ts (edge-runtime convex-test) mirroring charityCorrections.test.ts: seed a charity, then assert the three <behavior> bullets against setStatus (or the new markDoNotUse). Register `['__tests__/charitiesDoNotUse.test.ts','edge-runtime']` in vitest.config.ts. RED until Task 2.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- __tests__/charitiesDoNotUse.test.ts || true</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "charitiesDoNotUse.test.ts" apps/dispatch-control/vitest.config.ts` matches (edge-runtime)
    - `grep -n "charity.blocklisted" apps/dispatch-control/__tests__/charitiesDoNotUse.test.ts` matches
    - the command exits non-zero (RED) before Task 2
  </acceptance_criteria>
  <done>Reason enforcement + the audit emission for Do-not-use are pinned RED.</done>
</task>

<task type="auto">
  <name>Task 2: Enforce reason + emit writeDecision in charities.setStatus, then sync Convex</name>
  <files>convex/charities.ts</files>
  <read_first>
    - convex/charities.ts (setStatus 167-189)
    - convex/auditLog.ts (writeDecision from 43-02)
    - convex/issues.ts (hold — the requireOperator actor + writeDecision call pattern to mirror)
    - docs/API_CONTRACTS.md §43.7
  </read_first>
  <action>
In convex/charities.ts setStatus: add `reason: v.optional(v.string())` to args. Capture the actor: `const actor = await requireOperator(ctx)`. When `status === 'blocklisted'`, require a non-empty trimmed reason (throw 'A reason is required to mark a charity Do not use.' otherwise). Read the existing charity for the `before` snapshot. After `ctx.db.patch(charityId,{status})`, when blocklisting call `ctx.runMutation(internal.auditLog.writeDecision, { workspace_id, actorId: actor, action:'charity.blocklisted', resourceType:'charity', resourceId: charityId, before: JSON.stringify({status: charity.status}), after: JSON.stringify({status:'blocklisted'}), reason })`. Non-blocklist transitions keep working without a reason and without the emission (unblocklist stays reason-free). Keep the existing status validation. (Optional: expose a dedicated `markDoNotUse` mutation instead — either is acceptable; the required-reason + audit emission is the must.)
Run `pnpm --filter @eisenbalm/convex dev:once` to sync.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- __tests__/charitiesDoNotUse.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "reason" convex/charities.ts` shows the reason arg + enforcement in setStatus
    - `grep -n "charity.blocklisted" convex/charities.ts` matches
    - `grep -n "writeDecision" convex/charities.ts` matches
    - `pnpm --filter dispatch-control test -- __tests__/charitiesDoNotUse.test.ts` exits 0 (RED→GREEN)
    - `pnpm --filter @eisenbalm/convex dev:once` completes without a deploy error
  </acceptance_criteria>
  <done>Do-not-use now requires a reason and emits a structured decision row via the shared helper — the Phase 26 no-audit gap is closed.</done>
</task>

<task type="auto">
  <name>Task 3: Reason textarea in the RegistryTable blocklist confirm flow</name>
  <files>apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx (handleBlocklist 84-95; the confirm popover 212-240; existing confirmingBlocklistId/pendingAction/actionError state)
    - convex/charities.ts (the new reason arg on setStatus)
  </read_first>
  <action>
In RegistryTable.tsx: add a `blocklistReason` state (string, reset when the popover opens/closes). In the inline blocklist confirmation popover (212-240) add a required `<textarea>` (labeled, e.g. "Why mark Do not use?") bound to blocklistReason. Disable the "Blocklist Charity" confirm button while the trimmed reason is empty (in addition to the existing pending guard). Change `handleBlocklist(charityId)` to accept + pass `reason: blocklistReason.trim()` to `setStatus`. Leave handleUnblocklist unchanged (no reason). Keep the existing error/pending handling. Reuse the existing min-h-[44px] / focus-ring styling conventions in the file.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "blocklistReason\|textarea" apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx` matches
    - `grep -n "reason" apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx` shows the reason passed to setStatus
    - `pnpm --filter dispatch-control test` exits 0
    - `pnpm --filter dispatch-control build` exits 0 (strict build)
  </acceptance_criteria>
  <done>The operator must type a reason to mark Do-not-use; the reason reaches the mutation and becomes a Decision Log entry.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test` green (new charities test + existing suite).
- `pnpm --filter dispatch-control build` strict build green.
- Convex dev sync ran.
- Querying audit_log after a blocklist now returns a `charity.blocklisted` decision row (previously zero — Pitfall 3 closed).
</verification>

<success_criteria>
Do-not-use requires a reason, writes a structured decision row via the shared helper, and surfaces a reason textarea in the registry UI — the last shipped reason-requiring action now feeds the one Decision Log (Stage-1 actions inherit the shape in Phases 46-47).
</success_criteria>

<output>
After completion, create `.planning/phases/43-my-tasks-decision-log/43-08-SUMMARY.md`.
</output>
