---
phase: 43-my-tasks-decision-log
plan: 05
type: execute
wave: 4
depends_on: ["43-03", "43-04"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/my-tasks/page.tsx
  - apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx
  - apps/dispatch-control/lib/nav.ts
  - apps/dispatch-control/components/AwaitingYouInbox.tsx
  - apps/dispatch-control/__tests__/MyTasksScreen.test.tsx
autonomous: true
requirements: [TSK-01, TSK-02, TSK-03, TSK-04, TSK-05]

must_haves:
  truths:
    - "/my-tasks renders deriveTasks over the current issue's run (DerivationInputs assembled exactly like Masthead: runs.latest -> pipelineRuns.byRunId -> issues.byIssueNumber + signOffs/claimChecks/qaCorrections/pitchLog) — no tasks table, no new subscription shape"
    - "each task row shows plain-language title, issue/area (where), why, severity (label+icon never color alone), stage, age (formatTaskAge), the agent recommendation when present, a primary deep-link action, and an 'Inspect context' entry point"
    - "the empty state renders explicit 'Nothing needs you' copy + a link to Approval (TSK-04) — never a bare empty list"
    - "a superseded task renders struck-through with a link to the new step; a resolved task renders 'resolved just now' — via computeSessionStates fed by client-filtered run.section_rerolled rows (TSK-05)"
    - "nav gains a 'My Tasks' item in the Editorial group; AwaitingYouInbox gains a 'See all ->' footer link to /my-tasks (an ADD — the inbox has no see-all today and is a separate derivation)"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/my-tasks/page.tsx"
      provides: "the /my-tasks route entry"
    - path: "apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx"
      provides: "DerivationInputs assembly + deriveTasks render + session states + empty/superseded/resolved states + Inspect entry point"
      min_lines: 80
    - path: "apps/dispatch-control/lib/nav.ts"
      provides: "Editorial 'My Tasks' nav item"
      contains: "/my-tasks"
    - path: "apps/dispatch-control/components/AwaitingYouInbox.tsx"
      provides: "See all footer link to /my-tasks"
      contains: "/my-tasks"
  key_links:
    - from: "MyTasksScreen"
      to: "lib/derivedState.deriveTasks + lib/taskSupersession.computeSessionStates"
      via: "the assembled DerivationInputs + client-filtered reroll rows"
      pattern: "deriveTasks"
    - from: "AwaitingYouInbox"
      to: "/my-tasks"
      via: "See all footer Link (D-15)"
      pattern: "/my-tasks"
---

<objective>
Build the actual My Tasks screen (TSK-01..TSK-05) that renders the deriveTasks projection cross-stage for the current issue, wire the Editorial nav item + the Masthead inbox "See all" handoff (D-15). This is the screen the count-only Masthead readout has always pointed at.

Purpose: Answer "what needs me right now, regardless of where it came from?" as a designed surface — a severity-first task list with a designed empty state and a never-silent superseded state — reusing the exact same DerivationInputs the Masthead builds (D-01, zero new subscriptions) and the pure session-state predicate from 43-04.
Output: /my-tasks route + screen, nav item, AwaitingYouInbox see-all link.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/dispatch-control/components/Masthead.tsx
@apps/dispatch-control/lib/derivedState.ts
@apps/dispatch-control/lib/taskSupersession.ts
@apps/dispatch-control/lib/nav.ts
@apps/dispatch-control/components/AwaitingYouInbox.tsx
@docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md

<interfaces>
<!-- Verified from the current repo tree. -->
Masthead.tsx (186-232) is THE reference DerivationInputs assembly that self-resolves the current issue WITHOUT an issueNumber prop:
  runs.latest -> pipelineRuns.byRunId (issueNumber) -> issues.byIssueNumber (held/published) + signOffs.activeByRunId + claimChecks.listByRunId + qaCorrections.byRunId + pitchLog.byRunId, all keyed off runId. Copy this shape (or extract a shared useCurrentIssueDerivationInputs hook — Claude's discretion; if extracted, Masthead must keep compiling and still show the same count).
For My Tasks, the claimRows mapper must ALSO pass `createdAt: row._creationTime` (for age) and qaFindings pass through wholesale (timestamp already present). Provide `runStartedAt: latest?.startedAt` (or pipelineRun.startedAt) for sign-off age.
Reroll rows: useQuery(api.auditLog.listForWorkspace,{workspace_id, limit:200}), client-filter action==='run.section_rerolled' && resourceId startsWith `${runId}:`; parse agentKey from resourceId. Feed computeSessionStates(current, prevSnapshotRef.current, rerolls, Date.now(), taskSection).
taskSection(task): finding tasks (id 'qa-...') -> its `where`/sectionName in agentKey form; claim tasks (id 'claim-...') -> its sectionName (camelCase) — computeSessionStates already bridges via qaSectionToGalleyId.
Severity label+icon (D-19, State & Icon Contract §Attention): Must fix / Review recommended / Information — reuse the Masthead icon convention (lucide) + a label; NEVER color alone.
Inspect entry point (D-16): mirror ClaimProvenanceCard.tsx:448-455's disabled 'Inspect' button precedent — render an "Inspect context" control that is visible-but-inert (or links to a Phase-44 placeholder) — do NOT build the panel.
Empty state (TSK-04): explicit "Nothing needs you" + a Link to the current issue's approval (issueApprovalHref) — NOT a bare empty list; the closest sibling copy is AwaitingYouInbox's "Nothing needs you right now."
Route lives at app/(dashboard)/my-tasks/ — a nav-level screen, NOT nested under /issues/[n]. Client component ('use client') because it uses useQuery.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED component tests for the screen states</name>
  <files>apps/dispatch-control/__tests__/MyTasksScreen.test.tsx</files>
  <read_first>
    - apps/dispatch-control/__tests__/*.test.tsx (an existing jsdom component test to match render/query harness + how Convex useQuery is mocked)
    - apps/dispatch-control/components/AwaitingYouInbox.tsx (empty-state copy sibling)
    - docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md §Screen: My Tasks (row spec + empty/superseded)
  </read_first>
  <behavior>
    - Given the screen's pure render function receives an EMPTY DisplayTask list, it renders "Nothing needs you" text and a link whose href is the current issue's /approval (TSK-04).
    - Given one active must-fix task, it renders the title, the where, the why, a severity label ('Must fix') WITH an icon (not color alone), the age string, the recommendation when present, a primary action link with the task's href, and an "Inspect context" control (TSK-02/03).
    - Given one superseded DisplayTask, it renders struck-through text and a "superseded" label + a link to the new step (TSK-05).
    - Given one resolved DisplayTask, it renders "resolved just now" struck-through (TSK-05).
  </behavior>
  <action>
Factor the screen so its rendering is testable without live Convex: extract a pure `MyTasksList({ tasks: DisplayTask[], approvalHref: string })` render component (in MyTasksScreen.tsx) that the data-fetching wrapper feeds. Write __tests__/MyTasksScreen.test.tsx (jsdom) rendering MyTasksList directly with fixture DisplayTask arrays for each <behavior> bullet. RED until Task 2.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- __tests__/MyTasksScreen.test.tsx || true</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "Nothing needs you\|Inspect context\|superseded\|resolved just now" apps/dispatch-control/__tests__/MyTasksScreen.test.tsx` matches
    - `grep -n "MyTasksList" apps/dispatch-control/__tests__/MyTasksScreen.test.tsx` matches
    - the command exits non-zero (RED) before Task 2
  </acceptance_criteria>
  <done>Empty/active/superseded/resolved render states are pinned RED against a pure render component.</done>
</task>

<task type="auto">
  <name>Task 2: Build the /my-tasks screen (assembly + render + session states + Inspect stub)</name>
  <files>apps/dispatch-control/app/(dashboard)/my-tasks/page.tsx, apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx</files>
  <read_first>
    - apps/dispatch-control/components/Masthead.tsx (DerivationInputs assembly 186-232 — copy or extract)
    - apps/dispatch-control/lib/derivedState.ts (deriveTasks, formatTaskAge)
    - apps/dispatch-control/lib/taskSupersession.ts (computeSessionStates, DisplayTask)
    - apps/dispatch-control/lib/issueRouteResolver.ts (issueApprovalHref for the empty-state pointer)
    - apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx (lines ~448-455, the disabled Inspect button precedent)
  </read_first>
  <action>
1. app/(dashboard)/my-tasks/page.tsx: a thin route that renders `<MyTasksScreen />`.
2. _components/MyTasksScreen.tsx ('use client'):
   - Assemble DerivationInputs mirroring Masthead (self-resolve current issue via runs.latest -> pipelineRuns.byRunId -> issues.byIssueNumber + the four run-keyed queries). Map claimRows with `createdAt: row._creationTime`; set `runStartedAt: latest?.startedAt`.
   - `const tasks = deriveTasks(inputs)`.
   - Fetch reroll rows via auditLog.listForWorkspace(limit 200), client-filter action==='run.section_rerolled' + resourceId startsWith `${runId}:`, parse RerollSignal[] (agentKey, timestamp, href to the rerolled stage).
   - Keep a prev-snapshot ref (useRef<DerivedTask[]|null>); compute `const display = computeSessionStates(tasks, prevRef.current, rerolls, Date.now(), taskSection)`; update prevRef after render (useEffect).
   - Render `<MyTasksList tasks={display} approvalHref={issueNumber!=null ? issueApprovalHref(issueNumber) : '/issues'} />`.
   - MyTasksList (pure): severity-grouped-or-sorted rows (discretion), each row: title · where · why · severity label+icon · stage · formatTaskAge(t.openedAt) · rec (when present) · primary action Link (t.primary) · an "Inspect context" control rendered visible-but-inert (mirror ClaimProvenanceCard). Superseded rows: struck-through + "superseded" label + supersededBy link. Resolved rows: struck-through + "resolved just now". Empty list: explicit "Nothing needs you" + a Link to approvalHref. Every state uses label+icon, never color alone (D-19).
   - Structure controls so Phase 49 §6 gating can wrap them (do not hide/lock now) — e.g. keep primary actions as identifiable elements.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- __tests__/MyTasksScreen.test.tsx && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "deriveTasks" apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx` matches
    - `grep -n "computeSessionStates" apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx` matches
    - `grep -n "run.section_rerolled" apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx` matches
    - `grep -n "Nothing needs you\|Inspect context" apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx` matches
    - `pnpm --filter dispatch-control test -- __tests__/MyTasksScreen.test.tsx` exits 0 (RED→GREEN)
    - `pnpm --filter dispatch-control build` exits 0 (strict build — catches Vercel/Linux-only type errors)
  </acceptance_criteria>
  <done>/my-tasks renders the projection cross-stage with age, deep links, an Inspect entry point, a designed empty state, and never-silent superseded/resolved states.</done>
</task>

<task type="auto">
  <name>Task 3: Nav item + AwaitingYouInbox 'See all' handoff</name>
  <files>apps/dispatch-control/lib/nav.ts, apps/dispatch-control/components/AwaitingYouInbox.tsx</files>
  <read_first>
    - apps/dispatch-control/lib/nav.ts (the Editorial group with the reserved "My Tasks joins this group in Phase 43" comment, lines 49-57)
    - apps/dispatch-control/components/AwaitingYouInbox.tsx (full — it has NO see-all footer today; add one; it is a SEPARATE derivation, do NOT repoint its data)
  </read_first>
  <action>
1. lib/nav.ts: add `{ label: 'My Tasks', href: '/my-tasks' }` to the Editorial group's items (place it after 'Issues' / 'Issue Workspace', consistent with the reserved-slot comment).
2. AwaitingYouInbox.tsx: add a footer to the dropdown (below the items list / empty state, inside the dialog container) with a `<Link href="/my-tasks" onClick={onClose}>See all →</Link>`. This is an ADDITION — do NOT change the inbox's existing item derivation (it stays a separate, narrower projection).
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "'/my-tasks'\|\"/my-tasks\"" apps/dispatch-control/lib/nav.ts` matches inside the Editorial group
    - `grep -n "/my-tasks" apps/dispatch-control/components/AwaitingYouInbox.tsx` matches (See all footer link)
    - `grep -n "See all" apps/dispatch-control/components/AwaitingYouInbox.tsx` matches
    - `pnpm --filter dispatch-control test` exits 0 (existing AwaitingYouInbox tests still green — data unchanged)
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>My Tasks is reachable from the Editorial nav and from the Masthead inbox's new "See all" link — no dead button, no capability lost, the count stays live.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test` full suite green.
- `pnpm --filter dispatch-control build` strict build green.
- The Masthead My Tasks count still derives from deriveTasks(...).length (unchanged) and the dropdown "See all" now targets /my-tasks.
</verification>

<success_criteria>
Operator opens /my-tasks (via nav or the inbox See-all) and sees every open claim/finding/missing sign-off for the current issue as a severity-first task with title/where/why/severity/stage/age/rec/primary/Inspect-context; an empty list shows "Nothing needs you → Approval"; a rerolled task shows superseded; a resolved task shows "resolved just now".
</success_criteria>

<output>
After completion, create `.planning/phases/43-my-tasks-decision-log/43-05-SUMMARY.md`.
</output>
