---
phase: 41-issue-workspace-frame
plan: 12
type: execute
wave: 2
depends_on: [41-11]
files_modified:
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/page.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/DraftPanelContent.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/page.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPanelContent.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/page.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/VoicePanelContent.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/page.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/page.tsx
  - apps/dispatch-control/__tests__/StageContextPanels.test.tsx
autonomous: true
requirements: [WSP-03]
gap_closure: true

must_haves:
  truths:
    - "On each of the 5 stages the ContextPanel shows stage-specific content: Stage 1 lead/org detail, Stage 2 open QA items, Stage 3 claim detail, Stage 4 voice findings, Stage 5 decision-log/readiness — never the generic 'Nothing to show for this stage yet' placeholder when the stage has data"
    - "A stage with genuinely no data shows an honest stage-specific empty state (e.g. 'No open QA items', 'No claims extracted yet') — never a fake filled state and never the generic shell placeholder"
    - "Every stage's panel reuses data the provider ALREADY subscribes to (pitch rows / QA findings / claim rows / sign-offs) — no new Convex subscription is added by any publisher"
    - "The single ContextPanel shell stays mounted across tab switches (collapse state preserved) while only its injected content changes per stage"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx"
      provides: "Stage 1 lead/org-detail publisher + pure buildStoryPanelContent(pitchRows)"
      contains: "setPanelContent"
    - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/DraftPanelContent.tsx"
      provides: "Stage 2 open-QA-items publisher + pure buildDraftPanelContent(openFindings)"
      contains: "setPanelContent"
    - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPanelContent.tsx"
      provides: "Stage 3 claim-detail publisher + pure buildFactCheckPanelContent(claimRows)"
      contains: "setPanelContent"
    - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/VoicePanelContent.tsx"
      provides: "Stage 4 voice-findings publisher + pure buildVoicePanelContent(voiceFindings)"
      contains: "setPanelContent"
    - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent.tsx"
      provides: "Stage 5 readiness/decision-log publisher + pure buildApprovalPanelContent(...)"
      contains: "setPanelContent"
    - path: "apps/dispatch-control/__tests__/StageContextPanels.test.tsx"
      provides: "A test per stage proving real, stage-specific, non-placeholder content is produced + honest empty state; and each publisher calls setPanelContent (reaches the slot)"
      contains: "buildStoryPanelContent"
  key_links:
    - from: "each stage page.tsx"
      to: "its <XxxPanelPublisher/>"
      via: "mounted as a sibling client component alongside the stage screen"
      pattern: "PanelPublisher"
    - from: "each publisher"
      to: "provider data + the panel slot"
      via: "useWorkspaceState() reads pitchRows/qaFindings/claimRows/signOffs and calls setPanelContent(built) in an effect with cleanup"
      pattern: "useWorkspaceState\\(\\)"
---

<objective>
Wire real, stage-appropriate content into the persistent ContextPanel for all 5 stages, closing the "renders stage-appropriate context" half of WSP-03 (the sole code gap in 41-VERIFICATION.md).

Using the slot mechanism built in Plan 41-11 (`setPanelContent` + the four exposed per-run arrays on `useWorkspaceState()`), this plan adds one tiny client "panel publisher" per stage. Each publisher reads data the provider ALREADY subscribes to (zero new Convex subscriptions), builds the stage's read-only detail via a pure `buildXxxPanelContent(...)` function, and publishes it via `setPanelContent` in an effect (cleaning up to null on unmount so tab switches swap content cleanly). Each stage page mounts its publisher as a sibling of the existing stage screen.

Per 41-CONTEXT.md D-19, each stage's content:
- Stage 1 (Story): lead/org detail from the pitch/candidate rows (charity name, location, focus area, scout summary; selected winner highlighted).
- Stage 2 (Draft): the open QA items list — open findings from the `qaCorrections` feed (reason · section · severity).
- Stage 3 (Fact Check): claim detail — coverage + the `claim_checks` list (text · status · source), read-only (mirrors FactCheckPlaceholder's never-blank ladder).
- Stage 4 (Voice): voice findings — the VOICE_AXES open tells (the SAME filter VoicePassRunView's tell count uses).
- Stage 5 (Approval): decision-log / readiness detail — a read-only readiness summary duplicated from what DecisionRail already computes (fact/voice sign-off state, claim coverage, blocker count, held).

Honesty rule (never-blank): a stage with genuinely no data renders a stage-specific honest empty state (e.g. "No open QA items"), NOT a fake filled one and NOT the generic shell placeholder.

Purpose: Make the panel useful on every stage; complete WSP-03.
Output: 5 publishers + 5 page mounts + a per-stage regression test file. Final full-suite + strict build gate runs here (last gap-closure plan).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/41-issue-workspace-frame/41-VERIFICATION.md
@.planning/phases/41-issue-workspace-frame/41-CONTEXT.md
@.planning/phases/41-issue-workspace-frame/41-VALIDATION.md
@.planning/phases/41-issue-workspace-frame/41-11-context-panel-slot-mechanism-PLAN.md

<interfaces>
<!-- Contracts the executor needs — use directly, no exploration. -->

Provider value AFTER Plan 41-11 (useWorkspaceState() exposes these — read them, publish via setPanelContent):
```typescript
{
  runId: string | null
  held: boolean
  status: IssueStatus
  stages: StageStateResult[]        // 5-tuple, index 0..4 = Story..Approval
  tasks: DerivedTask[]              // each has .stage (1|2|3|4|5), .sev, .title, .where, .why, .rec
  panelContent: ReactNode
  setPanelContent: (content: ReactNode) => void   // stable identity (useState setter)
  pitchRows: Doc<'pitchLog'>[] | undefined         // Stage 1
  qaFindings: Array<{ _id: string; severity: 'info'|'warning'|'error'; axis?: string; sectionName: string; reason: string; suggestedFix?: string; accepted?: boolean; resolution?: 'accepted'|'dismissed'|null }> | undefined  // Stage 2 + Stage 4
  claimRows: Array<{ _id: string; status: string; sourceUrl?: string; sectionName?: string; claimText?: string }> | undefined  // Stage 3
  signOffs: Record<string, { actorId: string; signedAt: number }> | {} | undefined  // Stage 5 (keys: 'facts-cleared', 'sounds-human')
}
```

pitchLog row fields (Doc<'pitchLog'>): charityName, charityLocation, charityWebsite?, assetRange?, focusArea?, scoutSummary, selected (boolean), runId, timestamp.

Reusable helpers (import, do NOT re-derive):
```typescript
import { isOpenFinding } from '@/lib/galley/findingState'   // open = accepted !== true && resolution == null
import { VOICE_AXES } from '@/lib/galley/axisPartition'      // Set: 'gravity','sentiment','irony-signaling','machine-tell'
// Stage-4 voice filter (identical to VoicePassRunView tellCount): qaFindings.filter(r => isOpenFinding(r) && VOICE_AXES.has(r.axis ?? ''))
```

Publisher import path to the provider (from a stage folder, matches ApprovalStage.tsx): `../../_components/WorkspaceStateProvider`.

Publisher shape (apply to all 5):
```tsx
'use client'
import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useWorkspaceState } from '../../_components/WorkspaceStateProvider'

export function buildXxxPanelContent(/* the stage's data */): ReactNode { /* pure — returns compact read-only JSX or a stage-specific honest empty state */ }

export default function XxxPanelPublisher() {
  const ws = useWorkspaceState()
  const content = useMemo(() => buildXxxPanelContent(/* ws.<fields> */), [/* ws.<raw data deps> */])
  const { setPanelContent } = ws
  useEffect(() => {
    setPanelContent(content)
    return () => setPanelContent(null)   // cleanup so tab switches swap content, never stack
  }, [content, setPanelContent])
  return null   // pure publisher — renders nothing itself
}
```

Stage page mount pattern (server component renders the client publisher as a sibling of the stage screen; publisher needs NO props — it reads context):
```tsx
return (
  <>
    <XxxPanelPublisher />
    <ExistingStageScreen ... />
  </>
)
```

Reuse/scope rules (D-19): reuse the existing label+icon vocabulary and read-only presentation; do NOT import components that carry write mutations (e.g. SourceIndex's Check/Skip) into the panel — mirror FactCheckPlaceholder.tsx's read-only precedent. Keep each builder a compact read-only list. Do NOT modify ContextPanel.tsx, the stage screens (SignalDeskScreen/ReviewDeskRunView/FactCheckPlaceholder/VoicePassRunView/ApprovalStage/DecisionRail), or the design tokens.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Stage 1 (Story) + Stage 2 (Draft) panel publishers + mounts + tests</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx, apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/page.tsx, apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/DraftPanelContent.tsx, apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/page.tsx, apps/dispatch-control/__tests__/StageContextPanels.test.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/page.tsx (mount point — returns <SignalDeskScreen .../>)
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/page.tsx (mount point — returns <ReviewDeskRunView .../>)
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalStage.tsx (the provider-import-path + 'use client' precedent to copy)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx lines 83-95, 313-320 (the QaCorrectionRow shape + the isOpenFinding filter Stage 2 must mirror)
    - apps/dispatch-control/lib/galley/findingState.ts (isOpenFinding predicate)
    - apps/dispatch-control/__tests__/ContextPanel.test.tsx (the RTL/vitest conventions to follow)
    - 41-11 PLAN <interfaces> (the exposed provider fields)
  </read_first>
  <action>
    STORY (Stage 1 — lead/org detail):
    1. Create story/StoryPanelContent.tsx. `buildStoryPanelContent(pitchRows: Doc<'pitchLog'>[] | undefined)`:
       - `undefined` → honest empty JSX: italic "Loading lead detail…".
       - empty array → italic "No charity selected yet".
       - otherwise: render the selected winner first (find `selected === true`) as the lead card (charityName as heading, charityLocation, focusArea, a 1–2 line scoutSummary); list the remaining candidate names below under a "Candidates" micro-label. Reuse the existing font/label token classes seen in FactCheckPlaceholder.tsx (var(--font-ui), MICRO_LABEL-style uppercase labels). Read-only — no links to write actions.
       - `StoryPanelPublisher` default export follows the publisher shape; deps `[ws.pitchRows]`.
    2. Mount in story/page.tsx: wrap the return in a fragment with `<StoryPanelPublisher />` before `<SignalDeskScreen .../>`. Import from `./StoryPanelContent`.

    DRAFT (Stage 2 — open QA items):
    3. Create draft/DraftPanelContent.tsx. `buildDraftPanelContent(openFindings)` where the publisher computes `openFindings = (ws.qaFindings ?? []).filter(isOpenFinding)`:
       - `ws.qaFindings === undefined` → italic "Loading…" (handle in builder by passing the raw array; if undefined, show loading).
       - no open findings → italic "No open QA items — this draft is clean".
       - otherwise: a compact list, one row per open finding: the finding `reason`, a section label (from `sectionName`), and a severity mark using the existing label+icon vocabulary (info/warning/error — label text, never color alone). Read-only.
       - `DraftPanelPublisher` deps `[ws.qaFindings]`; filter via imported `isOpenFinding` (do NOT re-derive `accepted !== true`).
    4. Mount in draft/page.tsx: wrap the return in a fragment with `<DraftPanelPublisher />` before `<ReviewDeskRunView .../>`. Import from `./DraftPanelContent`.

    TESTS:
    5. Create __tests__/StageContextPanels.test.tsx (jsdom). Import `buildStoryPanelContent` and `buildDraftPanelContent`. Add `describe('Stage 1 Story panel')` and `describe('Stage 2 Draft panel')`, each with:
       - populated: `render(buildStoryPanelContent(fixture))` with a fixture containing a selected charity → assert the charity name text is present AND `screen.queryByText(/nothing to show for this stage yet/i)` is null.
       - empty: `render(buildStoryPanelContent([]))` → assert "No charity selected yet" present.
       - loading: `render(buildStoryPanelContent(undefined))` → assert "Loading" present.
       Same three cases for Draft (populated fixture with one open finding → assert its `reason` text present + no generic placeholder; `[]` → "No open QA items…"; undefined-feed → "Loading").
    Follow ContextPanel.test.tsx's import/cleanup conventions (afterEach cleanup, screen queries).
  </action>
  <acceptance_criteria>
    - Both publishers exist and reach the slot: `grep -l "setPanelContent" "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx" "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/DraftPanelContent.tsx"` lists both files.
    - Both read the provider, not a new query: each file contains `useWorkspaceState(` and NEITHER contains `useQuery(` — `grep -L "useQuery(" .../story/StoryPanelContent.tsx .../draft/DraftPanelContent.tsx` lists both (no new subscription).
    - Draft reuses the shared predicate: `grep -q "isOpenFinding" "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/DraftPanelContent.tsx"`.
    - Both pages mount their publisher: `grep -q "StoryPanelPublisher" "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/page.tsx"` and `grep -q "DraftPanelPublisher" "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/page.tsx"`.
    - `pnpm --filter dispatch-control test -- StageContextPanels.test.tsx` exits 0 with the Story + Draft describes green.
    - `pnpm --filter dispatch-control exec tsc --noEmit 2>&1 | grep -E "StoryPanelContent|DraftPanelContent|story/page|draft/page"` prints nothing.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/dispatch-control && grep -q "setPanelContent" "app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx" && grep -q "setPanelContent" "app/(dashboard)/issues/[issueNumber]/draft/DraftPanelContent.tsx" && (! grep -q "useQuery(" "app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx") && (! grep -q "useQuery(" "app/(dashboard)/issues/[issueNumber]/draft/DraftPanelContent.tsx") && grep -q "StoryPanelPublisher" "app/(dashboard)/issues/[issueNumber]/story/page.tsx" && grep -q "DraftPanelPublisher" "app/(dashboard)/issues/[issueNumber]/draft/page.tsx" && pnpm --filter dispatch-control test -- StageContextPanels.test.tsx</automated>
  </verify>
  <done>Story + Draft publishers publish real lead-detail / open-QA-items content (with honest empty + loading states), reuse provider data (no new useQuery), are mounted by their pages, and their describes pass.</done>
</task>

<task type="auto">
  <name>Task 2: Stage 3 (Fact Check) + Stage 4 (Voice) panel publishers + mounts + tests</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPanelContent.tsx, apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/page.tsx, apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/VoicePanelContent.tsx, apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/page.tsx, apps/dispatch-control/__tests__/StageContextPanels.test.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPlaceholder.tsx (the never-blank coverage ladder + read-only claim-row rendering to mirror compactly)
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/page.tsx (mount point — returns <FactCheckPlaceholder .../>)
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/page.tsx (mount point — returns <VoicePassScreen .../>)
    - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx lines 133-142 (the exact isOpenFinding + VOICE_AXES tellCount filter Stage 4 must mirror)
    - apps/dispatch-control/lib/galley/axisPartition.ts (VOICE_AXES) + lib/galley/findingState.ts (isOpenFinding)
    - the StageContextPanels.test.tsx file created in Task 1 (you extend it)
    - 41-11 PLAN <interfaces>
  </read_first>
  <action>
    FACT CHECK (Stage 3 — claim detail):
    1. Create fact-check/FactCheckPanelContent.tsx. `buildFactCheckPanelContent(claimRows: ...['claimRows'])`:
       - `undefined` → italic "Loading…".
       - empty → italic "No claims extracted yet" (mirror FactCheckPlaceholder's exact never-blank copy — never "verified"/"complete").
       - otherwise: a compact coverage line ("checked X of Y · N unchecked") followed by a short read-only claim list (claimText, a status label — Pending/Checked/Skipped — and, when present, an "Open source" link to sourceUrl). Reuse FactCheckPlaceholder's status vocabulary; do NOT include Check/Skip write actions.
       - `FactCheckPanelPublisher` deps `[ws.claimRows]`.
    2. Mount in fact-check/page.tsx: fragment with `<FactCheckPanelPublisher />` before `<FactCheckPlaceholder .../>`. Import from `./FactCheckPanelContent`.

    VOICE (Stage 4 — voice findings):
    3. Create voice/VoicePanelContent.tsx. The publisher computes `voiceFindings = (ws.qaFindings ?? []).filter(r => isOpenFinding(r) && VOICE_AXES.has(r.axis ?? ''))` — the SAME filter VoicePassRunView uses for its tell count. `buildVoicePanelContent(voiceFindings, loading)`:
       - feed undefined → italic "Loading…".
       - no voice tells → italic "No voice tells flagged".
       - otherwise: a compact list, one row per open voice finding: its `reason`, section label, and the axis (e.g. machine-tell / gravity) as a micro-label. Read-only.
       - `VoicePanelPublisher` deps `[ws.qaFindings]`; import VOICE_AXES + isOpenFinding (do NOT re-derive either).
    4. Mount in voice/page.tsx: fragment with `<VoicePanelPublisher />` before `<VoicePassScreen .../>`. Import from `./VoicePanelContent`.

    TESTS:
    5. Extend __tests__/StageContextPanels.test.tsx: import `buildFactCheckPanelContent` + `buildVoicePanelContent`; add `describe('Stage 3 Fact Check panel')` and `describe('Stage 4 Voice panel')`, each with populated (assert a claim text / a voice tell reason present + no generic placeholder), empty (assert "No claims extracted yet" / "No voice tells flagged"), and loading cases.
  </action>
  <acceptance_criteria>
    - Both publishers reach the slot: `grep -q "setPanelContent" .../fact-check/FactCheckPanelContent.tsx` and `grep -q "setPanelContent" .../voice/VoicePanelContent.tsx`.
    - Voice reuses the exact shipped filter: `grep -q "VOICE_AXES" "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/VoicePanelContent.tsx"` and `grep -q "isOpenFinding" .../voice/VoicePanelContent.tsx`.
    - Neither adds a subscription: neither FactCheckPanelContent.tsx nor VoicePanelContent.tsx contains `useQuery(`.
    - Fact Check honesty: `grep -q "No claims extracted yet" "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPanelContent.tsx"` and it contains NO "verified"/"complete" fake-state string for the empty case.
    - Both pages mount their publisher: `grep -q "FactCheckPanelPublisher" .../fact-check/page.tsx` and `grep -q "VoicePanelPublisher" .../voice/page.tsx`.
    - `pnpm --filter dispatch-control test -- StageContextPanels.test.tsx` exits 0 with all four (Story/Draft/Fact Check/Voice) describes green.
    - `pnpm --filter dispatch-control exec tsc --noEmit 2>&1 | grep -E "FactCheckPanelContent|VoicePanelContent|fact-check/page|voice/page"` prints nothing.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/dispatch-control && grep -q "setPanelContent" "app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPanelContent.tsx" && grep -q "VOICE_AXES" "app/(dashboard)/issues/[issueNumber]/voice/VoicePanelContent.tsx" && grep -q "isOpenFinding" "app/(dashboard)/issues/[issueNumber]/voice/VoicePanelContent.tsx" && (! grep -q "useQuery(" "app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPanelContent.tsx") && (! grep -q "useQuery(" "app/(dashboard)/issues/[issueNumber]/voice/VoicePanelContent.tsx") && grep -q "FactCheckPanelPublisher" "app/(dashboard)/issues/[issueNumber]/fact-check/page.tsx" && grep -q "VoicePanelPublisher" "app/(dashboard)/issues/[issueNumber]/voice/page.tsx" && pnpm --filter dispatch-control test -- StageContextPanels.test.tsx</automated>
  </verify>
  <done>Fact Check + Voice publishers publish real claim detail / voice-tell content (with honest empty + loading states), reuse the shipped VOICE_AXES/isOpenFinding filter and claim data (no new useQuery), are mounted by their pages, and their describes pass.</done>
</task>

<task type="auto">
  <name>Task 3: Stage 5 (Approval) readiness publisher + mount + tests + full-suite/strict-build gate</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent.tsx, apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/page.tsx, apps/dispatch-control/__tests__/StageContextPanels.test.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx (the Readiness board section — Fact check X/Y, Voice signed y/n, Open decisions/blocker count, held — duplicate its READ-ONLY summary; do NOT import or modify it)
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/page.tsx (mount point — returns <ApprovalStage .../>)
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalStage.tsx (reads `held` from useWorkspaceState — the precedent)
    - apps/dispatch-control/lib/derivedState.ts lines 33-44, 90-102 (DerivedTask.stage + sign-off keys 'facts-cleared'/'sounds-human')
    - the StageContextPanels.test.tsx file (you extend it)
    - .planning/phases/41-issue-workspace-frame/41-VALIDATION.md (the strict-build gate requirement)
  </read_first>
  <action>
    APPROVAL (Stage 5 — decision-log / readiness detail):
    1. Create approval/ApprovalPanelContent.tsx. `buildApprovalPanelContent({ signOffs, claimRows, tasks, held })` — a compact READ-ONLY duplication of DecisionRail's readiness board (the gap explicitly permits extract-or-duplicate the read-only summary):
       - `signOffs === undefined` → italic "Loading readiness…".
       - otherwise ALWAYS render the readiness lines (never blank), each label+text (never color alone):
         - Fact check: `signOffs['facts-cleared']` present → "signed"; else claim coverage "checked X of Y" from claimRows (0 claims → "no claims yet").
         - Voice: `signOffs['sounds-human']` present → "signed"; else "not signed".
         - Held: held → "Held — release to publish"; else "not held".
         - Blocking items: count of `tasks.filter(t => t.sev === 'must-fix')` → "N must-fix" (0 → "none").
       Use distinct copy from DecisionRail's own strings so RTL getByText stays unambiguous if ever co-rendered (this is a separate DOM surface).
       - `ApprovalPanelPublisher` deps `[ws.signOffs, ws.claimRows, ws.tasks, ws.held]`.
    2. Mount in approval/page.tsx: fragment with `<ApprovalPanelPublisher />` before `<ApprovalStage .../>`. Import from `./ApprovalPanelContent`.

    TESTS:
    3. Extend __tests__/StageContextPanels.test.tsx: import `buildApprovalPanelContent`; add `describe('Stage 5 Approval panel')` with:
       - populated: fixture where facts-cleared signed, sounds-human not, 2 must-fix tasks → assert "signed" + "must-fix" readiness text present + no generic placeholder.
       - loading: `signOffs: undefined` → assert "Loading readiness…".
       - never-blank: fixture where signOffs is `{}` (loaded, nothing signed), no tasks, no claims → assert readiness lines still render (e.g. "not signed" / "no claims yet" / "none") — NOT the generic shell placeholder.
    4. Add a parameterized "publishers reach the slot" block: for each of the 5 publishers, render it with a mocked `useWorkspaceState` returning a fixture (that stage's data + a `setPanelContent` spy), assert the spy was called with a defined node on mount (proving each publisher feeds the panel slot). Use a mutable module-level fixture the vi.mock reads, set per case.

    FINAL GATE (this is the last gap-closure plan):
    5. Run the full suite `pnpm --filter dispatch-control test` (must be green) AND the strict `pnpm --filter dispatch-control build` (must compile — type-check + lint; per 41-VALIDATION.md and project memory run-strict-build-before-frontend-phase-done). Neither touched Convex functions, so no `dev:once` sync is required. If build surfaces a type/lint error in any touched file, fix it before declaring done.
  </action>
  <acceptance_criteria>
    - Approval publisher reaches the slot and reuses provider data: `grep -q "setPanelContent" .../approval/ApprovalPanelContent.tsx`, contains `useWorkspaceState(`, and does NOT contain `useQuery(`.
    - Readiness duplicated read-only: `grep -q "facts-cleared" .../approval/ApprovalPanelContent.tsx` and `grep -q "sounds-human" .../approval/ApprovalPanelContent.tsx`; the file does NOT import DecisionRail (`! grep -q "DecisionRail" .../approval/ApprovalPanelContent.tsx`).
    - Page mounts it: `grep -q "ApprovalPanelPublisher" .../approval/page.tsx`.
    - The test file covers all 5 stages + the plumbing block: `grep -c "buildStoryPanelContent\|buildDraftPanelContent\|buildFactCheckPanelContent\|buildVoicePanelContent\|buildApprovalPanelContent" .../__tests__/StageContextPanels.test.tsx` shows all five builders imported/used, and the file references all five `*PanelPublisher` names in the plumbing block.
    - `pnpm --filter dispatch-control test -- StageContextPanels.test.tsx` exits 0 with all 5 stage describes + the plumbing block green.
    - FULL SUITE: `pnpm --filter dispatch-control test` exits 0 (no regressions).
    - STRICT BUILD: `pnpm --filter dispatch-control build` exits 0 ("Compiled successfully").
  </acceptance_criteria>
  <verify>
    <automated>cd apps/dispatch-control && grep -q "setPanelContent" "app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent.tsx" && (! grep -q "useQuery(" "app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent.tsx") && (! grep -q "DecisionRail" "app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent.tsx") && grep -q "ApprovalPanelPublisher" "app/(dashboard)/issues/[issueNumber]/approval/page.tsx" && pnpm --filter dispatch-control test -- StageContextPanels.test.tsx && pnpm --filter dispatch-control test && pnpm --filter dispatch-control build</automated>
  </verify>
  <done>Stage 5 readiness/decision-log content publishes (never blank, honest states); all 5 stage describes + the 5-publisher plumbing block pass; the full dispatch-control suite is green and the strict build compiles.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- StageContextPanels.test.tsx` — all 5 stage describes (populated + honest-empty + loading) and the 5-publisher plumbing block green.
- `pnpm --filter dispatch-control test` (full suite) green; `pnpm --filter dispatch-control build` compiles clean (strict gate).
- `grep` confirms all 5 pages mount their `*PanelPublisher`; every publisher contains `useWorkspaceState(` and NONE contains `useQuery(` (zero new subscriptions); Voice reuses `VOICE_AXES`+`isOpenFinding`, Draft reuses `isOpenFinding`, Approval duplicates `facts-cleared`/`sounds-human` read-only without importing DecisionRail.
- Manual (out of scope for automation — recorded, not required to close the code gap): the live UAT walk in 41-UAT.md Section 2 confirms the panel visibly swaps stage content across tab navigations while its collapse state persists.
</verification>

<success_criteria>
WSP-03 is fully closed: the collapsible ContextPanel renders stage-appropriate context on all 5 stages (lead detail, open QA items, claim detail, voice findings, decision-log/readiness), each reusing already-subscribed provider data with zero new Convex subscriptions, each honoring the never-blank rule with a stage-specific honest empty state, and each proven by a per-stage regression test plus a publisher-reaches-the-slot plumbing test. The single panel shell (collapse/hide state) stays intact across tab switches. Full suite green + strict build compiles.
</success_criteria>

<output>
After completion, create `.planning/phases/41-issue-workspace-frame/41-12-SUMMARY.md`.
</output>
