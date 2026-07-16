---
phase: 49-roles-permissions
plan: 08
type: execute
wave: 3
depends_on: ["49-05", "49-06"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/_components/IssueComments.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx
  - apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx
  - apps/dispatch-control/__tests__/IssueComments.test.tsx
autonomous: true
requirements: [ROL-04]

must_haves:
  truths:
    - "A persistent Comments affordance renders on every one of the 5 issue stages + overview (mounted in FrameChrome, NOT in the per-stage ContextPanel panelContent slot which gets clobbered)."
    - "The same affordance renders on My Tasks (a sibling route not under the issue layout)."
    - "The affordance lists an issue's comments (oldest-first) and lets ANY signed-in user (both roles) submit a comment via comments.add; it is not editor-gated."
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/_components/IssueComments.tsx"
      provides: "reusable comments list + add affordance"
      contains: "api.comments"
    - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx"
      provides: "persistent Comments mount in FrameChrome (sibling to ContextPanel)"
      contains: "IssueComments"
  key_links:
    - from: "IssueComments"
      to: "api.comments.listByIssueNumber + api.comments.add"
      via: "useQuery + useMutation"
      pattern: "api.comments"
    - from: "FrameChrome (layout.tsx)"
      to: "IssueComments"
      via: "persistent affordance NOT inside ContextPanel panelContent"
      pattern: "IssueComments"
---

<objective>
Mount a consistent, persistent comment affordance so a Collaborator can read every screen and leave comments (ROL-04's positive capability). Build a reusable `<IssueComments>` (list + add) wired to `api.comments.*`, mount it in `FrameChrome` (covering the 5 stages + overview) and on the sibling `my-tasks` route.

Purpose: ROL-04 surface. RESEARCH: do NOT hang comments off `ContextPanel.panelContent` (it is REPLACED per-stage via `setPanelContent` and would be clobbered on every stage switch) — mount a separate persistent slot inside FrameChrome. My Tasks is a sibling route, so it needs its own placement.
Output: `IssueComments.tsx`; mounts in `layout.tsx` (FrameChrome) + `MyTasksScreen.tsx`; a mount test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/49-roles-permissions/49-RESEARCH.md

<interfaces>
Convex functions from Plan 49-05 (call these):
  api.comments.add({ workspace_id, issueNumber, stage?, anchorRef?, text }) → Id
  api.comments.listByIssueNumber({ workspace_id, issueNumber, stage? }) → Doc<'comments'>[]  (oldest-first)
Workspace + Convex client conventions (from layout.tsx):
  import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
  import { api } from '@convex/_generated/api'
  import { useQuery, useMutation } from 'convex/react'
FrameChrome mount point (layout.tsx:273-277) — the grid row; ContextPanel is REPLACED per-stage, so add a SEPARATE persistent region:
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr_300px]">
    <WorkspaceOutline />
    <div className="min-w-0">{children}</div>
    <ContextPanel title="Context">{panelContent}</ContextPanel>   // ← DO NOT put comments here
  </div>
Button chrome convention: min-h-[44px], var(--font-ui), focus-visible:ring-2 (matches the rest of the app).
Single-<main> invariant: the dashboard root layout owns <main>; do NOT add another.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Build IssueComments.tsx (list + add) + IssueComments.test.tsx</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/_components/IssueComments.tsx, apps/dispatch-control/__tests__/IssueComments.test.tsx</files>
  <read_first>
    - apps/dispatch-control/__tests__/EvalDrawer.test.tsx (existing RTL/component test pattern + how Convex hooks are mocked in this app's tests)
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/_components/ContextPanel.tsx (a sibling _components affordance — chrome/spacing vocabulary to match)
    - docs/API_CONTRACTS.md §49.3 (the exact add/listByIssueNumber arg shapes)
    - .planning/phases/49-roles-permissions/49-RESEARCH.md "### Scope discipline (D-13)" (flat only — no threading/mentions/notifications)
  </read_first>
  <behavior>
    - Given a list of comments, IssueComments renders each row's text oldest-first.
    - Typing text + submitting calls comments.add with { workspace_id, issueNumber, stage?, text } and clears the input.
    - The add affordance is available regardless of role (NOT wrapped in LockedControl) — commenting is the one write both roles may make.
    - Empty state renders a legible "no comments yet" affordance (never blank/undefined crash).
  </behavior>
  <action>
    Create `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/_components/IssueComments.tsx` — a `'use client'` component with props `{ issueNumber: number; stage?: string }`. Use `useQuery(api.comments.listByIssueNumber, { workspace_id: DEFAULT_WORKSPACE_ID, issueNumber, stage })` for the list and `useMutation(api.comments.add)` for submit. Render: a heading ("Comments"), the oldest-first list, and a textarea + submit button (min-h-[44px], focus-visible ring). On submit call add with the current stage (pass through the prop), then clear the input. Flat only — no reply/threading UI. Do NOT wrap the submit in LockedControl.
    Then create `apps/dispatch-control/__tests__/IssueComments.test.tsx` (RTL) asserting: list rows render oldest-first from a mocked query; submitting calls the add mutation with the right args; empty state renders.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm vitest run __tests__/IssueComments.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "api.comments.listByIssueNumber" apps/dispatch-control/app/\(dashboard\)/issues/\[issueNumber\]/_components/IssueComments.tsx` == 1.
    - `grep -c "api.comments.add" apps/dispatch-control/app/\(dashboard\)/issues/\[issueNumber\]/_components/IssueComments.tsx` == 1.
    - `grep -c "LockedControl" apps/dispatch-control/app/\(dashboard\)/issues/\[issueNumber\]/_components/IssueComments.tsx` == 0 (commenting is NOT editor-gated).
    - `cd apps/dispatch-control && pnpm vitest run __tests__/IssueComments.test.tsx` exits 0.
  </acceptance_criteria>
  <done>IssueComments lists + adds comments for both roles, flat, tested green.</done>
</task>

<task type="auto">
  <name>Task 2: Mount IssueComments in FrameChrome + on My Tasks</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx, apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx lines 184-283 (FrameChrome — where to add a persistent Comments region; the grid + the current-stage segment is derivable from usePathname())
    - apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx (the My Tasks screen shape — where a comment affordance reads well; My Tasks aggregates across issues)
    - .planning/phases/49-roles-permissions/49-RESEARCH.md "### Mount points" (do NOT use ContextPanel.panelContent; add a separate persistent slot; My Tasks needs its own placement)
  </read_first>
  <action>
    FrameChrome (layout.tsx): import IssueComments. Derive the current stage segment from `usePathname()` (the existing `isStageSegment` helper already exists in this file — reuse it; pass `undefined` for the bare overview route). Add a PERSISTENT `<IssueComments issueNumber={n} stage={currentStageSegment} />` as a separate region in the frame (e.g., a collapsible block beneath the stage grid, or a second column region) — NOT inside `<ContextPanel title="Context">{panelContent}</ContextPanel>` (that slot is clobbered per-stage). Do NOT introduce a second `<main>`.
    MyTasksScreen.tsx: mount the same `<IssueComments>` affordance appropriately for the aggregate My Tasks view (My Tasks is a sibling route, NOT under the issue layout, so it does not inherit the FrameChrome mount). If My Tasks rows are per-issue, place a comment affordance keyed to each row's issueNumber; otherwise place a single reachable affordance. Keep it legible and reachable for a Collaborator (ROL-04 "read everything and comment").
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm vitest run __tests__/setLastVisitedStage.test.ts __tests__/IssueComments.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "IssueComments" apps/dispatch-control/app/\(dashboard\)/issues/\[issueNumber\]/layout.tsx` ≥ 1.
    - `grep -c "IssueComments" apps/dispatch-control/app/\(dashboard\)/my-tasks/_components/MyTasksScreen.tsx` ≥ 1.
    - The comments mount is NOT placed inside the ContextPanel panelContent (it is a separate region): the `IssueComments` usage in layout.tsx is not passed as `panelContent`.
    - layout.tsx still renders no second `<main>` (single-main invariant): `grep -c "<main" apps/dispatch-control/app/\(dashboard\)/issues/\[issueNumber\]/layout.tsx` == 0.
  </acceptance_criteria>
  <done>Comments affordance persistent across the 5 stages + overview (FrameChrome) and present on My Tasks; not clobbered by per-stage panel content.</done>
</task>

<task type="auto">
  <name>Task 3: Strict Next build with the mounts in place</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/_components/IssueComments.tsx</files>
  <read_first>
    - /Users/user/.claude/projects/-Users-user-Desktop-Eisenbalm/memory/MEMORY.md entry "Run strict build before frontend phase done"
  </read_first>
  <action>
    vitest does not type-check. Run the strict Next build and fix any type errors from the new component + mounts (e.g., Convex arg typing on api.comments.*, the stage-segment union type passed to IssueComments).
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter dispatch-control build` exits 0.
  </acceptance_criteria>
  <done>dispatch-control builds strictly with the comments affordance mounted.</done>
</task>

</tasks>

<verification>
- IssueComments lists + adds (both roles), flat, tested.
- Mounted persistently in FrameChrome (not the clobbered panel slot) + on My Tasks.
- Strict build green; single-main preserved.
</verification>

<success_criteria>
A Collaborator can read every screen and leave a comment via a consistent affordance across My Tasks + the 5 stages (ROL-04).
</success_criteria>

<output>
After completion, create `.planning/phases/49-roles-permissions/49-08-SUMMARY.md`.
</output>
