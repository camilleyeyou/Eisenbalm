---
phase: 43-my-tasks-decision-log
plan: 06
type: execute
wave: 3
depends_on: ["43-02"]
files_modified:
  - apps/dispatch-control/components/decision-log/DecisionLog.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent.tsx
  - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx
  - apps/dispatch-control/__tests__/DecisionLog.test.tsx
autonomous: true
requirements: [TSK-06]

must_haves:
  truths:
    - "one DecisionLog component projects the reason-bearing subset of audit_log (via auditLog.listDecisions) newest-first, reason-first, issue/run-scoped — it is NOT a refactor of the raw Settings AuditLogViewer"
    - "actor renders as a NAME (human via users.byClerkUserId displayName/email; named-agent/system via a static id->name map), never a bare Clerk sub (TSK-06)"
    - "each decision row shows actor, action, time, reason, before/after, instruction version, issue+run — with any missing field rendered explicitly (never blank), reason falling back to parsing after-JSON for legacy rows"
    - "the same component mounts in the Approval context panel AND as the Issue Workspace persistent 'Decision log' control"
  artifacts:
    - path: "apps/dispatch-control/components/decision-log/DecisionLog.tsx"
      provides: "the shared reason-first, actor-as-name Decision Log projection component"
      min_lines: 60
    - path: "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx"
      provides: "a persistent 'Decision log' control that opens DecisionLog for the current run"
      contains: "Decision log"
  key_links:
    - from: "DecisionLog"
      to: "auditLog.listDecisions + users.byClerkUserId"
      via: "reason-bearing projection + read-time actor resolution"
      pattern: "listDecisions"
    - from: "ApprovalPanelContent"
      to: "DecisionLog"
      via: "the Approval context panel mount"
      pattern: "DecisionLog"
---

<objective>
Build the ONE shared, human-readable Decision Log component (TSK-06, D-08) that projects the reason-bearing subset of audit_log, resolves actors to names, and mount it in its two spec'd places: the Approval context panel and the Issue Workspace persistent "Decision log" control. This is a NEW component — the raw Settings AuditLogViewer stays unchanged.

Purpose: The Decision Log is the read-back surface for every reasoned action. It is a curated projection (D-09, no separate store), reason-first and actor-as-name — the opposite of the developer-facing AuditLogViewer's raw actorId/JSON table.
Output: components/decision-log/DecisionLog.tsx + Approval-panel mount + Workspace-frame control.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/API_CONTRACTS.md
@convex/auditLog.ts
@apps/dispatch-control/app/(dashboard)/settings/_components/AuditLogViewer.tsx
@apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent.tsx
@apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx

<interfaces>
<!-- Verified from the current repo tree. -->
auditLog.listDecisions (from Plan 43-02): query({ workspace_id, runId?, issueNumber?, limit? }) -> reason-bearing rows newest-first, each { actorId, action, reason?, before?, after?, timestamp, resourceType?, resourceId?, issueNumber?, runId?, instructionVersion? }.
users.byClerkUserId (from Plan 43-02): query({ clerkUserId }) -> users row (displayName?/email) | null.
System/agent ids to name (static map): 'pipeline' -> 'Pipeline', 'cron' -> 'Scheduler', 'webhook' -> 'Webhook', agent keys (scout/advocate/editor/...) -> display names; anything else falls back to the raw id (explicit, never blank).
AuditLogViewer.tsx (settings) is the raw sibling to NOT copy: <table> over listForWorkspace, actorId as bare Clerk sub, before/after as <details><pre> JSON. DecisionLog must be reason-first, actor-as-name.
ApprovalPanelContent.tsx: publishes ReactNode into the frame's ContextPanel via ws.setPanelContent (buildApprovalPanelContent + ApprovalPanelPublisher useEffect). Add the DecisionLog (or a compact decisions block) into that published content, scoped to ws.runId.
WorkspaceControls.tsx: the persistent controls surface (Hold issue + Run history today). Add a "Decision log" control (toggle/disclosure) that renders <DecisionLog runId={runId} issueNumber={n} /> — the annotations list it as a persistent frame control alongside Hold.
Component is 'use client' (uses useQuery). Time formatting: reuse a relativeTime/toLocaleString style already in the tree.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED component test — reason-first, actor-as-name, legacy tolerance</name>
  <files>apps/dispatch-control/__tests__/DecisionLog.test.tsx</files>
  <read_first>
    - apps/dispatch-control/__tests__/*.test.tsx (jsdom harness + how useQuery is mocked)
    - apps/dispatch-control/app/(dashboard)/settings/_components/AuditLogViewer.tsx (the sibling to contrast — DecisionLog must differ)
    - docs/API_CONTRACTS.md §43.3/§43.4 (projection + actor resolution contract)
  </read_first>
  <behavior>
    - Extract a pure render function (e.g. DecisionLogRows({ rows, resolveActor })) so tests avoid live Convex. Given a decision row with actorId 'clerk_sub_1' and a resolveActor that maps it to 'Andrew', the row shows 'Andrew', NOT 'clerk_sub_1'.
    - A system row actorId 'pipeline' resolves to 'Pipeline' via the static map.
    - The reason is the primary visible field; a row with structured reason shows it directly.
    - Legacy tolerance: a row with no structured reason but after=JSON.stringify({heldReason:'ran long'}) shows 'ran long' (after-JSON fallback).
    - Missing fields render explicitly: a row with no instructionVersion shows an explicit placeholder (e.g. '—' / 'n/a'), never an empty cell.
    - Each row shows action, a formatted time, and issue/run when present.
  </behavior>
  <action>
Create __tests__/DecisionLog.test.tsx (jsdom). Import the pure DecisionLogRows render function from ../components/decision-log/DecisionLog and render fixture rows for each <behavior> bullet with a fake resolveActor. RED until Task 2.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- __tests__/DecisionLog.test.tsx || true</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "DecisionLogRows\|resolveActor" apps/dispatch-control/__tests__/DecisionLog.test.tsx` matches
    - `grep -n "heldReason\|pipeline" apps/dispatch-control/__tests__/DecisionLog.test.tsx` matches (legacy + system-actor cases)
    - the command exits non-zero (RED) before Task 2
  </acceptance_criteria>
  <done>Reason-first render, actor-as-name resolution, and legacy after-JSON tolerance are pinned RED.</done>
</task>

<task type="auto">
  <name>Task 2: Build DecisionLog.tsx (projection + actor resolution + tolerant render)</name>
  <files>apps/dispatch-control/components/decision-log/DecisionLog.tsx</files>
  <read_first>
    - convex/auditLog.ts (listDecisions from 43-02)
    - convex/users.ts (byClerkUserId from 43-02)
    - apps/dispatch-control/app/(dashboard)/settings/_components/AuditLogViewer.tsx (contrast — do not copy its markup)
    - docs/API_CONTRACTS.md §43.3/§43.4
  </read_first>
  <action>
Create components/decision-log/DecisionLog.tsx ('use client'):
1. `export function DecisionLogRows({ rows, resolveActor })` — the PURE render: for each row, reason-first layout showing resolveActor(row.actorId) as a NAME, action, formatted time, reason (structured OR parsed from after-JSON via a tolerant `reasonOf(row)` helper), before/after (compact, human — not raw <pre> dumps), instructionVersion, issue+run — each missing field rendered explicitly ('—'), never blank. Every state label+icon, never color alone (D-19).
2. `export default function DecisionLog({ runId, issueNumber })` — the data wrapper: `useQuery(api.auditLog.listDecisions, { workspace_id: DEFAULT_WORKSPACE_ID, runId, issueNumber })`; build a resolveActor closure: for a human-shaped actorId, read users.byClerkUserId (batch/lazy — acceptable to resolve the small set present) returning displayName ?? email; for system/agent ids use a static SYSTEM_ACTOR_NAMES map; fall back to the raw id. Render <DecisionLogRows/>. Loading + empty states are explicit ("No decisions recorded yet.").
Do NOT generalize or import AuditLogViewer.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- __tests__/DecisionLog.test.tsx && pnpm --filter dispatch-control typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export function DecisionLogRows" apps/dispatch-control/components/decision-log/DecisionLog.tsx` matches
    - `grep -n "listDecisions" apps/dispatch-control/components/decision-log/DecisionLog.tsx` matches
    - `grep -n "byClerkUserId\|SYSTEM_ACTOR_NAMES" apps/dispatch-control/components/decision-log/DecisionLog.tsx` matches
    - `grep -Rn "AuditLogViewer" apps/dispatch-control/components/decision-log/DecisionLog.tsx` returns NOTHING (not a refactor of the raw viewer)
    - `pnpm --filter dispatch-control test -- __tests__/DecisionLog.test.tsx` exits 0 (RED→GREEN)
    - `pnpm --filter dispatch-control typecheck` exits 0
  </acceptance_criteria>
  <done>A reason-first, actor-as-name, legacy-tolerant Decision Log component exists as a distinct projection — not a refactor of the raw audit viewer.</done>
</task>

<task type="auto">
  <name>Task 3: Mount DecisionLog in the Approval context panel + the Workspace 'Decision log' control</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent.tsx, apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent.tsx (buildApprovalPanelContent + ApprovalPanelPublisher — how content is published via setPanelContent; ws.runId available)
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx (the persistent controls surface — Hold + Run history; add a Decision log control)
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx (useWorkspaceState fields: runId, issue/issueNumber)
  </read_first>
  <action>
1. ApprovalPanelContent.tsx: add a "Decision log" section to the published context-panel content, rendering <DecisionLog runId={ws.runId} issueNumber={n} /> below the readiness board (the annotations: "Approval context panel shows it"). Keep the existing readiness board. If passing a live component through setPanelContent(ReactNode) is awkward, render DecisionLog as part of the published node (it is a client component with its own useQuery — fine).
2. WorkspaceControls.tsx: add a persistent "Decision log" control (a disclosure/toggle button consistent with the existing Hold control styling) that reveals <DecisionLog runId={runId} issueNumber={n} /> for the current run — placed alongside Hold issue / Run history (the annotations list "Decision log" as a persistent frame control).
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "DecisionLog" apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent.tsx` matches
    - `grep -n "DecisionLog\|Decision log" apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx` matches
    - `pnpm --filter dispatch-control test` exits 0 (existing approval/workspace tests still green)
    - `pnpm --filter dispatch-control build` exits 0 (strict build)
  </acceptance_criteria>
  <done>The one DecisionLog component appears in both spec'd places — the Approval context panel and the persistent Issue Workspace control.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test` full suite green.
- `pnpm --filter dispatch-control build` strict build green.
- The Settings AuditLogViewer is untouched (`git diff --stat` shows no change to it).
</verification>

<success_criteria>
One reason-first, actor-as-name Decision Log projects the reason-bearing audit_log subset (legacy-tolerant, issue/run-scoped) and renders in both the Approval context panel and the persistent Issue Workspace control — a distinct surface from the raw Settings audit viewer.
</success_criteria>

<output>
After completion, create `.planning/phases/43-my-tasks-decision-log/43-06-SUMMARY.md`.
</output>
