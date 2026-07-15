---
phase: 41-issue-workspace-frame
plan: 05
type: execute
wave: 2
depends_on: [41-01]
files_modified:
  - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx
  - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceOutline.tsx
  - apps/dispatch-control/app/(dashboard)/issues/_components/ContextPanel.tsx
  - apps/dispatch-control/lib/galley/sectionIdMap.ts
  - apps/dispatch-control/__tests__/WorkspaceOutline.test.tsx
  - apps/dispatch-control/__tests__/ContextPanel.test.tsx
autonomous: true
requirements: [WSP-02, WSP-03, WSP-07]
must_haves:
  truths:
    - "One provider owns the workspace Convex subscriptions + derivation and exposes them via context"
    - "The outline's per-section 'generated' signal is derived from the authoritative draft (draftSectionIdsFromDraft over getDraft) — the SAME source the Stage-2 canvas uses, so the two surfaces cannot contradict"
    - "The outline lists every editable section with a label+icon 5-state mark and jumps to it"
    - "'Not generated' renders as a first-class outline marker, never a blank row; while the draft is still loading the outline shows a loading state, never an inferred wall of 'not generated'"
    - "The context panel is a collapsible shell that can be hidden and remembers its hidden state"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx"
      provides: "WorkspaceStateProvider + useWorkspaceState() context (status, stages, sectionStates [undefined while the draft loads], tasks, workMinutes, runId, held); sectionStates sourced from getDraft via draftSectionIdsFromDraft"
      contains: "useWorkspaceState"
    - path: "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceOutline.tsx"
      provides: "section outline with 5-state label+icon + jump-to-section + a loading state when sectionStates is undefined"
      min_lines: 40
    - path: "apps/dispatch-control/app/(dashboard)/issues/_components/ContextPanel.tsx"
      provides: "collapsible shell + Hide control + per-stage content slot"
      contains: "Hide panel"
  key_links:
    - from: "WorkspaceStateProvider sectionStates"
      to: "getDraft(runId, token) → draftSectionIdsFromDraft(draft) → deriveSectionStates"
      via: "authenticated draft fetch (useAuth().getToken), the SAME source the Stage-2 canvas reads"
      pattern: "draftSectionIdsFromDraft"
    - from: "WorkspaceOutline"
      to: "useWorkspaceState().sectionStates (deriveSectionStates)"
      via: "context consumption + galleyAnchorFor jump"
      pattern: "useWorkspaceState"
    - from: "WorkspaceOutline jump"
      to: "galley section anchor"
      via: "document.getElementById(galleyAnchorFor(id))?.scrollIntoView"
      pattern: "galleyAnchorFor"
---

<objective>
Build the three frame-internal consumables the layout (Plan 41-06) composes: the
WorkspaceStateProvider (the ONE place the workspace's Convex subscriptions + derivation
live, so tabs/outline/panel/header do not each re-derive — Pitfall 3), the persistent
issue outline (WSP-02/WSP-07), and the collapsible context panel shell (WSP-03).
Interface-first: Task 1 defines the context contract; Tasks 2–3 consume it. De-duplicate
the `galleyAnchorFor` scroll helper (currently copied in two files) into `sectionIdMap.ts`
on this third use (research Don't-Hand-Roll).

The provider's per-section "generated" signal is read from the AUTHORITATIVE draft (the same
`getDraft` fetch the Stage-2 canvas uses), via the shared `draftSectionIdsFromDraft` source
from 41-01 — so the outline and the canvas can never disagree about which sections exist.

Purpose: WSP-02 (outline lists every section with clean/review/must-fix/changed-since-review/
not-generated and jumps to it), WSP-03 (collapsible stage-appropriate panel), WSP-07 (the
"not generated" outline marker) — all built once, consumed by the frame.
Output: WorkspaceStateProvider + WorkspaceOutline + ContextPanel + a shared galleyAnchorFor + tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/41-issue-workspace-frame/41-CONTEXT.md
@.planning/phases/41-issue-workspace-frame/41-RESEARCH.md
@.planning/phases/41-issue-workspace-frame/41-VALIDATION.md

<interfaces>
<!-- The subscription+derivation block to LIFT verbatim from the current overview page
     (issues/[issueNumber]/page.tsx lines 116–161): issues.byIssueNumber, pipelineRuns.byIssueNumber,
     pipelineRuns.listByIssueNumber, signOffs.activeByRunId, claimChecks.listByRunId,
     qaCorrections.byRunId, pitchLog.byRunId, runs.byRunId; the signOffs `{}`-normalization on
     resolved-no-run; the claimRows mapping (text→claimText). Then deriveIssueStatus/deriveStageStates/
     deriveTasks/estimateWorkMinutes. -->
<!-- section-state input (CORRECTED — the blocker): source the outline's "is this section generated"
     signal from the AUTHORITATIVE DRAFT, not from side-tables. The provider fetches the draft the SAME
     way the Stage-2 canvas does — `getDraft(runId, token)` from lib/contentPatchClient, token from
     `useAuth().getToken()` (mirror ReviewDeskRunView's reloadDraft, lines ~251–266) — into local state,
     then builds `draftSectionIds = draftSectionIdsFromDraft(draft)` (the 41-01 shared source-of-truth:
     a section is generated iff it has non-empty draft content, byte-identical to the canvas's
     `(section?.blocks ?? []).length === 0` check). `sectionStates = draft ? deriveSectionStates(inputs,
     draftSectionIdsFromDraft(draft)) : undefined`. While the draft is still loading OR the fetch failed,
     `sectionStates` stays `undefined` — the provider NEVER hands the outline an empty set (that would
     silently mislabel every section 'not-generated', the mirror-image of the WSP-07 "never silently
     clean" concern). A clean, claim-less, finding-less section WITH content therefore reads 'clean',
     not 'not-generated'. Note: the canvas keeps its own getDraft for its write-path needs (revisionId/
     reloadDraft); both hit the same endpoint and share `draftSectionIdsFromDraft`, so the accepted minor
     double-GET cannot cause presence divergence. -->
<!-- deriveSectionStates + SectionState (5-value) + draftSectionIdsFromDraft from lib/derivedState.ts (Plan 41-01). -->
<!-- DraftResponse + getDraft from lib/contentPatchClient.ts; useAuth from @clerk/nextjs. -->
<!-- EDITABLE_SECTIONS from review-desk/[runId]/_components/SectionChipList.tsx (section id+label list). -->
<!-- StageStrip STAGE_STATE_LABELS + icon set (label+icon rule) at issues/_components/StageStrip.tsx. -->
<!-- galleyAnchorFor (to de-dup into sectionIdMap.ts): theme→null, deliberation-conversation→'galley-deliberation', else `galley-${id}`. -->
<!-- Existing panel/disclosure precedents to reuse for content: review-desk/[runId]/_components/{SourceIndex,ResolvedFindingsList}.tsx; _PlaceholderScreen.tsx (not-generated styling). -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: WorkspaceStateProvider context (the shared derivation contract)</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/page.tsx (lines 102–161 — the exact subscription + normalization + derivation block to lift)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx lines 137, 251–279 (the `useAuth().getToken()` + `getDraft(runId, token)` reload pattern to mirror for the provider's draft fetch)
    - apps/dispatch-control/lib/contentPatchClient.ts (getDraft signature + DraftResponse.sections[id].blocks)
    - apps/dispatch-control/lib/derivedState.ts (deriveIssueStatus/deriveStageStates/deriveSectionStates/deriveTasks/estimateWorkMinutes + draftSectionIdsFromDraft + DerivationInputs)
    - apps/dispatch-control/lib/workspace.ts (DEFAULT_WORKSPACE_ID)
    - .planning/phases/41-issue-workspace-frame/41-RESEARCH.md §Pattern 1 (Context recommendation) + §Pitfall 3 + §Code Examples (the draft fetch)
  </read_first>
  <action>
    Create a `'use client'` `WorkspaceStateProvider.tsx` that:
      - Takes `{ issueNumber: number | null; children }`.
      - Owns the exact Convex `useQuery` block from the overview page (issues.byIssueNumber,
        pipelineRuns.byIssueNumber, pipelineRuns.listByIssueNumber, signOffs.activeByRunId,
        claimChecks.listByRunId, qaCorrections.byRunId, pitchLog.byRunId, runs.byRunId), with the
        SAME `signOffs` `{}`-on-resolved-no-run normalization and the claimRows text→claimText map.
      - Fetches the AUTHORITATIVE draft for the section-presence signal (the blocker fix): mirror
        ReviewDeskRunView's reload effect — `const { getToken } = useAuth()`; in a `useEffect` keyed on
        `runId`, `const token = await getToken(); const draft = await getDraft(runId, token)` → store in
        `useState<DraftResponse | null>(null)`; track a loading/error flag. Guard `runId === null`.
      - Computes `sectionStates` from the loaded draft ONLY: `draft ? deriveSectionStates(inputs,
        draftSectionIdsFromDraft(draft)) : undefined`. While loading OR on fetch error, `sectionStates`
        is `undefined` — do NOT pass an empty set to deriveSectionStates (that would mislabel every
        section 'not-generated'; the outline renders a loading/unavailable state instead). This is the
        SAME presence source the Stage-2 canvas uses, so outline and canvas cannot contradict.
      - Runs deriveIssueStatus, deriveStageStates, deriveTasks, estimateWorkMinutes ONCE.
      - Exposes via React Context: `{ issueNumber, runId, held, published, status, stages,
        sectionStates /* Record | undefined */, tasks, workMinutes, history, issue }`.
      - Exports `useWorkspaceState()` that throws if used outside the provider.
    This is the interface every Wave-2/3 consumer reads — no other component re-subscribes to these
    derived values (Pitfall 3). The provider's draft→set derivation correctness is proven by the 41-01
    selector-level test over the shared `draftSectionIdsFromDraft` (clean generated section ⇒ 'clean');
    the provider wiring itself is exercised by Tasks 2–3 + the wave build (no separate provider test).
  </action>
  <verify>
    <automated>grep -q "export function useWorkspaceState" apps/dispatch-control/app/\(dashboard\)/issues/_components/WorkspaceStateProvider.tsx && grep -q "draftSectionIdsFromDraft" apps/dispatch-control/app/\(dashboard\)/issues/_components/WorkspaceStateProvider.tsx && grep -q "getDraft" apps/dispatch-control/app/\(dashboard\)/issues/_components/WorkspaceStateProvider.tsx && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `WorkspaceStateProvider.tsx` exists, is `'use client'`, and exports both the provider and `useWorkspaceState`
    - it fetches the authoritative draft via `getDraft(runId, token)` (token from `useAuth().getToken()`) and builds `sectionStates` via `draftSectionIdsFromDraft(draft)` → `deriveSectionStates`
    - `sectionStates` is `undefined` while the draft is loading or the fetch failed (never an empty-set → all-'not-generated' inference)
    - it calls deriveIssueStatus, deriveStageStates, deriveTasks, estimateWorkMinutes
    - it subscribes to all eight Convex queries listed (grep each `api.<x>` reference present once)
    - context value exposes `sectionStates`, `stages`, `status`, `tasks`, `workMinutes`, `runId`, `held`
  </acceptance_criteria>
  <done>One provider owns the workspace subscriptions + all derivation and exposes them via useWorkspaceState(); the section-presence signal comes from the same authoritative draft the canvas uses.</done>
</task>

<task type="auto">
  <name>Task 2: WorkspaceOutline — 5-state section list + jump (WSP-02/WSP-07)</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceOutline.tsx, apps/dispatch-control/lib/galley/sectionIdMap.ts, apps/dispatch-control/__tests__/WorkspaceOutline.test.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx (Task 1 context shape — note `sectionStates` may be `undefined` while the draft loads)
    - apps/dispatch-control/lib/galley/sectionIdMap.ts (add the shared galleyAnchorFor here)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx lines 92–96 + DecisionRail.tsx lines 76–80 (the two duplicate galleyAnchorFor copies to consolidate)
    - apps/dispatch-control/app/(dashboard)/issues/_components/StageStrip.tsx (the label+icon rendering convention to mirror for section marks)
    - apps/dispatch-control/__tests__/DecisionRail.test.tsx (component-test mock harness to copy)
  </read_first>
  <action>
    Add `export function galleyAnchorFor(sectionId: string): string | null` to lib/galley/sectionIdMap.ts
    (theme→null; 'deliberation-conversation'→'galley-deliberation'; else `galley-${id}`). Leave the two
    private copies in ReviewDeskRunView/DecisionRail as-is for now (out of scope to rewire them) — the
    shared export is for the outline.
    Create WorkspaceOutline.tsx (`'use client'`) that:
      - Consumes `useWorkspaceState().sectionStates`.
      - If `sectionStates` is `undefined` (draft still loading / unavailable), render a LOADING state
        (e.g. "Loading outline…") — NEVER a wall of "not generated" (that would present an inferred
        absence as reliable; the blocker's mirror-image concern).
      - Otherwise render one row per EDITABLE_SECTIONS entry: section label + a state mark rendered as
        LABEL + ICON (never color alone) for each of the 5 SectionState values:
        clean / review / must-fix ("Must fix") / changed-since-review ("Changed since review") /
        not-generated ("— not generated"). WSP-07: 'not-generated' is a visible marker, never a blank row.
      - Include a small legend listing all five state labels (so the vocabulary is visible even for
        states that never fire this phase — see 41-01 changed-since-review invariant).
      - onClick a row → `document.getElementById(galleyAnchorFor(id) ?? '')?.scrollIntoView({behavior:'smooth',block:'start'})`.
    Create WorkspaceOutline.test.tsx: wrap in a mocked provider (or mock useWorkspaceState) and assert
    (a) every EDITABLE_SECTIONS id renders a row when sectionStates is defined, (b) a 'not-generated'
    section shows the "not generated" marker text (not blank), (c) a 'clean' section shows a clean mark
    and NOT the "not generated" text (guards the blocker mislabel), (d) a 'must-fix' section shows a
    "Must fix" label, (e) when sectionStates is `undefined` the outline shows the loading state (and
    NOT a row of "not generated"), (f) clicking a row calls scrollIntoView on the anchor.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- WorkspaceOutline.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export function galleyAnchorFor" apps/dispatch-control/lib/galley/sectionIdMap.ts` succeeds
    - `WorkspaceOutline.tsx` renders a row per EDITABLE_SECTIONS id and imports `useWorkspaceState`
    - the outline renders a visible "not generated" marker for a not-generated section (test asserts non-empty text)
    - a 'clean' section renders a clean mark and NOT the "not generated" text (test asserts — the blocker guard)
    - when `sectionStates` is `undefined` the outline renders a loading state, never a wall of "not generated" (test asserts)
    - each state renders a text label alongside an icon (grep the five state labels present)
    - `pnpm --filter dispatch-control test -- WorkspaceOutline.test.tsx` exits 0
  </acceptance_criteria>
  <done>Outline lists all sections with label+icon 5-state marks (not-generated first-class, clean never mislabeled) and jumps to section; shows a loading state while the draft loads; galleyAnchorFor shared.</done>
</task>

<task type="auto">
  <name>Task 3: ContextPanel — collapsible shell with Hide control (WSP-03)</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/_components/ContextPanel.tsx, apps/dispatch-control/__tests__/ContextPanel.test.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx (context, for open-item content)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ResolvedFindingsList.tsx (collapsed-disclosure precedent)
    - apps/dispatch-control/components/_PlaceholderScreen.tsx (empty/placeholder styling)
    - .planning/phases/41-issue-workspace-frame/41-CONTEXT.md D-19 (per-stage content injection + Claude's-discretion persistence)
  </read_first>
  <action>
    Create ContextPanel.tsx (`'use client'`) as a SHARED collapsible shell (no shared disclosure
    primitive exists — build it once here, D-19):
      - Props: `{ title: string; children: React.ReactNode }` (per-stage content is injected by the
        caller — Stage 1 lead/org, Stage 2 open QA items, Stage 3 claim detail, Stage 4 voice findings,
        Stage 5 decision log/readiness detail).
      - A persistent "Hide panel" / "Show panel" toggle button. When hidden, render only a slim
        "Show panel" affordance (never a blank/absent region).
      - Persist hidden state across mounts via `localStorage` key `dc.workspace.contextPanel.hidden`
        (Claude's-discretion mechanism per D-19 — localStorage chosen; guard for SSR/no-window).
      - Use `_PlaceholderScreen`-style copy when `children` is empty ("Nothing to show for this stage yet").
    Create ContextPanel.test.tsx: assert (a) content renders when shown, (b) clicking "Hide panel"
    hides the content and shows a "Show panel" affordance, (c) the hidden state round-trips via localStorage
    (re-render reads the persisted value).
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- ContextPanel.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `ContextPanel.tsx` exists, is `'use client'`, and renders a Hide/Show toggle (grep "Hide panel")
    - hidden state persists to `localStorage` (grep `localStorage` + the `dc.workspace.contextPanel.hidden` key)
    - `pnpm --filter dispatch-control test -- ContextPanel.test.tsx` exits 0 (shows/hides/persists)
    - hidden state renders a "Show panel" affordance, never a blank region
  </acceptance_criteria>
  <done>A reusable collapsible context-panel shell with a persistent Hide control + localStorage persistence; test green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- WorkspaceOutline.test.tsx ContextPanel.test.tsx` green.
- Provider exposes the single derivation surface; grep confirms `getDraft` + `draftSectionIdsFromDraft` wire the outline's presence to the same source as the canvas, and galleyAnchorFor is shared into sectionIdMap.
</verification>

<success_criteria>
The three frame consumables exist and are tested: one provider owns all workspace subscriptions +
derivation; the outline lists every section with a 5-state label+icon mark (not-generated first-class,
clean never mislabeled, loading state while the draft resolves) sourced from the SAME authoritative draft
as the canvas; the context panel is a collapsible, persistently-hideable shell.
</success_criteria>

<output>
After completion, create `.planning/phases/41-issue-workspace-frame/41-05-SUMMARY.md`
</output>
