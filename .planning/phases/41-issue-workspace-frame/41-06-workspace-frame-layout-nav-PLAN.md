---
phase: 41-issue-workspace-frame
plan: 06
type: execute
wave: 3
depends_on: [41-05, 41-01, 41-02]
files_modified:
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/page.tsx
  - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx
  - apps/dispatch-control/lib/nav.ts
  - apps/dispatch-control/__tests__/nav.test.ts
  - apps/dispatch-control/__tests__/WorkspaceLayout.test.tsx
autonomous: true
requirements: [WSP-01]
must_haves:
  truths:
    - "One Issue Workspace frame renders stage tabs 1-5 with live status marks, mounted across all stage routes"
    - "Bare /issues/[n] redirects into the frame at the last-visited stage (or the D-04 default)"
    - "The overview's Hold/Reopen + run-history + status capability survives as frame persistent controls (no loss)"
    - "Nav shows one 'Issue Workspace' item and none of Review Desk / Signal Desk / Voice Pass"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx"
      provides: "the shared frame: provider wrap + stage tabs + outline + panel + persistent controls + lastVisitedStage writer"
      min_lines: 40
    - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/page.tsx"
      provides: "redirect-only into the frame at last-visited/default stage"
      contains: "redirect"
    - path: "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx"
      provides: "Hold/Reopen + run-history + status, lifted from the old overview"
    - path: "apps/dispatch-control/lib/nav.ts"
      provides: "single 'Issue Workspace' Editorial nav item"
      contains: "Issue Workspace"
  key_links:
    - from: "layout.tsx stage tabs"
      to: "useWorkspaceState().stages (deriveStageStates)"
      via: "StageStrip-style segments wrapped in <Link> to each stage href, active via usePathname"
      pattern: "usePathname"
    - from: "layout.tsx lastVisitedStage effect"
      to: "api.issues.setLastVisitedStage"
      via: "useEffect keyed on pathname segment"
      pattern: "setLastVisitedStage"
---

<objective>
Build the spine: the shared `layout.tsx` that renders the stage tabs (1-5, live status marks),
the persistent outline + context panel, and the persistent controls, and stays mounted across
tab switches (App Router layout semantics). Gut the old 314-line overview `page.tsx` into a
redirect into the frame at the last-visited stage — but FIRST extract its Hold/Reopen +
run-history + status capability into a `WorkspaceControls` component so no capability is lost
(Pitfall 5). Add the single "Issue Workspace" nav item (WSP-01). Write the last-visited-stage
back on every stage visit.

Purpose: WSP-01 — the three desks collapse into one Issue Workspace with stage tabs carrying
live status marks; the overview's editorial capability moves into the frame, not away.
Output: layout.tsx frame + redirect page.tsx + WorkspaceControls + nav entry + tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/41-issue-workspace-frame/41-CONTEXT.md
@.planning/phases/41-issue-workspace-frame/41-RESEARCH.md

<interfaces>
<!-- run-monitor/layout.tsx is the exact layout-tab-bar precedent ('use client', usePathname,
     active-tab underline, {children} slot). Copy its shape; ADD the provider + tabs-from-derived-state. -->
<!-- 41-05 WorkspaceStateProvider: <WorkspaceStateProvider issueNumber={n}>...useWorkspaceState()...</WorkspaceStateProvider>
     exposing { runId, held, status, stages, sectionStates, tasks, workMinutes, history, issue }. -->
<!-- 41-05 WorkspaceOutline + ContextPanel components to mount in the frame. -->
<!-- 41-01 hrefs: issueStoryHref, issueDraftHref, issueFactCheckHref, issueVoiceHref, issueApprovalHref. -->
<!-- StageStrip.tsx: STAGE_LABELS ['Story','Draft','Fact Check','Voice','Approval'], STAGE_STATE_LABELS,
     the per-state icon set; the 5 stage segments render label+icon (never color alone). -->
<!-- OLD overview page.tsx (to gut) currently owns: StatusReadout (status incl. 'unknown'→"State unknown — refresh"),
     StageStrip, task count + "~{workMinutes} min", Open Review/Voice links, HoldDialog wiring
     (showHoldDialog/holdBusy/holdError state + api.issues.hold/reopen + cancelRun on stopRun), run-history list. -->
<!-- api.issues.setLastVisitedStage (Plan 41-02, LIVE): { workspace_id, issueNumber, stage } where
     stage ∈ story|draft|fact-check|voice|approval. -->
<!-- nav.ts: NAV_GROUPS[0] = Editorial group currently [{label:'Issues',href:'/issues'}].
     Review/Signal/Voice already left in Phase 40 (D-31). nav.test.ts asserts NAV_GROUPS + fs.existsSync
     against app/(dashboard)/<href>/page.tsx for each item. -->
<!-- D-04 default stage: Story if no run / no selected pitch; else Draft. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: The workspace frame layout — tabs + outline + panel + lastVisitedStage writer</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/run-monitor/layout.tsx (the layout-tab-bar precedent to model)
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx (context to wrap children in)
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceOutline.tsx + ContextPanel.tsx (to mount)
    - apps/dispatch-control/app/(dashboard)/issues/_components/StageStrip.tsx (STAGE_LABELS + STAGE_STATE_LABELS + icon set to reuse as tab visuals)
    - apps/dispatch-control/lib/issueRouteResolver.ts (the five stage hrefs)
    - apps/dispatch-control/lib/derivedState.ts (StageStateResult shape)
    - .planning/phases/41-issue-workspace-frame/41-RESEARCH.md §Pattern 1 (layout owns subscriptions via provider; stays mounted across tab switches) + §Pattern 5 (StageStrip-as-tabs)
  </read_first>
  <action>
    Create `'use client'` `issues/[issueNumber]/layout.tsx`:
      - `const n = parseIssueNumber(String(useParams().issueNumber))`.
      - Wrap everything in `<WorkspaceStateProvider issueNumber={n}>`.
      - A `<FrameChrome>` inner client component (define in the same file or a sibling) that consumes
        `useWorkspaceState()` and renders:
          (a) STAGE TABS: 5 segments built from `stages` (deriveStageStates), each a `<Link>` to its
              stage href [Story→issueStoryHref, Draft→issueDraftHref, Fact Check→issueFactCheckHref,
              Voice→issueVoiceHref, Approval→issueApprovalHref], showing STAGE_LABELS[i] + the state's
              label+icon (reuse StageStrip's icon mapping + STAGE_STATE_LABELS + the `· {openCount}`
              suffix for needs-you). Active tab via `usePathname()` (`pathname.startsWith(href)`),
              `aria-current="page"`. NEVER color alone (label + icon).
          (b) The persistent header: status readout (reuse the 'unknown'→"State unknown — refresh"
              rule) + `{tasks.length} open · ~{workMinutes} min`.
          (c) `<WorkspaceOutline />` and `<ContextPanel title=...>` (the panel's per-stage children
              are injected by each stage page in later plans; here render the shell + a default).
          (d) `<WorkspaceControls issueNumber={n} />` (Task 2).
          (e) `{children}` — the active stage's canvas.
      - LAST-VISITED WRITER: a `useEffect` keyed on `usePathname()` that parses the current stage
        segment (last path part ∈ story|draft|fact-check|voice|approval) and calls
        `useMutation(api.issues.setLastVisitedStage)({ workspace_id: DEFAULT_WORKSPACE_ID, issueNumber: n, stage })`
        when both are known (guard n===null and unknown segments; ignore /runs/*).
    The frame must survive tab switches (that is the layout-vs-page point — do not put per-stage
    subscriptions here beyond the provider).
  </action>
  <verify>
    <automated>grep -q "WorkspaceStateProvider" "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx" && grep -q "setLastVisitedStage" "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx" && grep -q "usePathname" "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx" && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `issues/[issueNumber]/layout.tsx` exists, is `'use client'`, wraps children in `WorkspaceStateProvider`
    - it renders 5 stage tabs each as a `<Link>` to the correct stage href, active via `usePathname`
    - tabs render label + icon (grep STAGE_STATE_LABELS / StageStrip icon usage), never color alone
    - a `useEffect` calls `api.issues.setLastVisitedStage` keyed on the pathname stage segment (grep `setLastVisitedStage`)
    - layout.tsx passes the grep checks above; the full `WorkspaceLayout.test.tsx` component run is created + executed in Task 3 and the plan-level verification
  </acceptance_criteria>
  <done>The shared frame renders tabs+outline+panel+controls+children, stays mounted, and records last-visited stage.</done>
</task>

<task type="auto">
  <name>Task 2: Extract WorkspaceControls + redirect the bare page (Pitfall 5, D-03)</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx, apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/page.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/page.tsx (full — enumerate EVERY piece of state/JSX to relocate: StatusReadout, HoldDialog wiring incl. holdBusy/holdError, api.issues.hold/reopen, cancelRun on stopRun, run-history history.map, relativeTime)
    - apps/dispatch-control/app/(dashboard)/issues/_components/HoldDialog.tsx + HeldIssueRow.tsx (relativeTime helper)
    - apps/dispatch-control/lib/pipelineControlClient.ts (cancelRun)
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx (consume held/issue/history from context to avoid re-subscribing — Pitfall 3)
    - .planning/phases/41-issue-workspace-frame/41-RESEARCH.md §Pitfall 5 + §Open Questions #1 (run-history: keep inline list to avoid capability loss)
  </read_first>
  <action>
    Create `WorkspaceControls.tsx` (`'use client'`) that RELOCATES the old overview's persistent
    concerns (no capability lost — Pitfall 5). Enumerate + move each:
      - Held-state row (Held · reason · who · when via relativeTime) + Reopen button (api.issues.reopen).
      - Hold flow: "Hold issue" button → HoldDialog → api.issues.hold + the SEPARATE cancelRun call on
        stopRun, with holdBusy/holdError surfaced (keep the error <p role="alert">).
      - Run-history inline list (history.map → issueRunHref links) — keep the full inline list (do NOT
        silently drop it; Open Q1 — inline list is the lowest-risk capability-preserving choice).
      Consume `held`, `issue`, `history` from `useWorkspaceState()` rather than re-subscribing.
    Rewrite `issues/[issueNumber]/page.tsx` as a redirect-only Server Component (D-03):
      - Resolve issueNumber; server-read `issues.byIssueNumber` (lastVisitedStage) + `pipelineRuns.byIssueNumber`
        via ConvexHttpClient (same pattern as the voice wrapper).
      - If `lastVisitedStage` is set and valid → `redirect(issueHref(n) + '/' + lastVisitedStage)`.
      - Else D-04 default: `redirect(issueDraftHref(n))` when a run exists AND a pitch is selected,
        otherwise `redirect(issueStoryHref(n))`. (No run at all → issueStoryHref.)
      - parseIssueNumber failure → redirect('/issues').
    Note: the OLD 314-line client body is fully removed; every concern has a new home (frame header
    or WorkspaceControls). No StageStrip/status/hold logic remains in page.tsx.
  </action>
  <verify>
    <automated>grep -q "HoldDialog" "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx" && grep -q "issueRunHref" "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx" && grep -q "redirect(" "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/page.tsx" && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `WorkspaceControls.tsx` references `api.issues.hold`, `api.issues.reopen`, `cancelRun`, and renders a run-history list (grep `issueRunHref`)
    - `issues/[issueNumber]/page.tsx` is redirect-only (contains `redirect(` and NO `StageStrip`/`HoldDialog`/`useState` for hold)
    - the redirect prefers `lastVisitedStage`, else falls to Draft/Story per D-04 (grep `lastVisitedStage` + `issueStoryHref`/`issueDraftHref`)
    - `grep -q "HoldDialog" apps/dispatch-control/app/\(dashboard\)/issues/_components/WorkspaceControls.tsx` succeeds (Hold capability preserved)
  </acceptance_criteria>
  <done>Hold/Reopen + run-history + status live in the frame controls; the bare page is a stage-aware redirect; no capability lost.</done>
</task>

<task type="auto">
  <name>Task 3: Nav "Issue Workspace" entry + frame/nav tests (WSP-01)</name>
  <files>apps/dispatch-control/lib/nav.ts, apps/dispatch-control/__tests__/nav.test.ts, apps/dispatch-control/__tests__/WorkspaceLayout.test.tsx</files>
  <read_first>
    - apps/dispatch-control/lib/nav.ts (NAV_GROUPS — the Editorial group to add to)
    - apps/dispatch-control/__tests__/nav.test.ts (the structural + fs.existsSync assertion pattern to extend)
    - apps/dispatch-control/__tests__/DecisionRail.test.tsx (component-test mock harness to copy for the layout test)
    - .planning/phases/41-issue-workspace-frame/41-CONTEXT.md D-22 (single "Issue Workspace" item; href /issues fallback)
  </read_first>
  <action>
    In lib/nav.ts, add to the Editorial group a single item `{ label: 'Issue Workspace', href: '/issues' }`
    (D-22: links to /issues home, which routes onward via the D-03 redirect; keep the existing "Issues"
    item — "Issues" is the home/list, "Issue Workspace" is the current-issue entry). Do NOT add any
    Review Desk / Signal Desk / Voice Pass item.
    Extend nav.test.ts to assert: (a) exactly one Editorial item labeled "Issue Workspace" exists;
    (b) NO nav item is labeled "Review Desk", "Signal Desk", or "Voice Pass"; (c) the existing
    fs.existsSync-per-href check still passes for the new item (/issues resolves to a real page.tsx).
    Create WorkspaceLayout.test.tsx (mock convex/react useQuery so the provider derivation runs on a
    fixture; mock useParams/usePathname): assert the 5 stage tabs render with their STAGE_LABELS and
    a state mark each, and that the active tab (per a mocked pathname of `/issues/7/draft`) carries
    `aria-current="page"`.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- nav.test.ts WorkspaceLayout.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "Issue Workspace" apps/dispatch-control/lib/nav.ts` succeeds; grep finds NO "Review Desk"/"Signal Desk"/"Voice Pass" in nav.ts
    - nav.test.ts asserts one "Issue Workspace" item AND absence of the three desk labels
    - `WorkspaceLayout.test.tsx` asserts 5 tabs with STAGE_LABELS + a live state mark + active `aria-current`
    - `pnpm --filter dispatch-control test -- nav.test.ts WorkspaceLayout.test.tsx` exits 0
  </acceptance_criteria>
  <done>One "Issue Workspace" nav item; the three desks are absent from nav; frame tabs proven live via test.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- nav.test.ts WorkspaceLayout.test.tsx` green.
- `pnpm --filter dispatch-control build` compiles the new layout/redirect (run at wave close).
- Manual: navigating /issues/[n] lands in the frame at last-visited stage; tabs switch without remounting the frame.
</verification>

<success_criteria>
One Issue Workspace frame with stage tabs 1-5 carrying live status marks; bare /issues/[n] redirects
into it at the last-visited/default stage; Hold/Reopen + run-history + status preserved as persistent
controls; a single "Issue Workspace" nav item with the three desks gone.
</success_criteria>

<output>
After completion, create `.planning/phases/41-issue-workspace-frame/41-06-SUMMARY.md`
</output>
