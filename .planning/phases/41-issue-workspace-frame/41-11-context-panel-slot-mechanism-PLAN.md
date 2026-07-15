---
phase: 41-issue-workspace-frame
plan: 11
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx
  - apps/dispatch-control/__tests__/WorkspaceContextPanelSlot.test.tsx
autonomous: true
requirements: [WSP-03]
gap_closure: true

must_haves:
  truths:
    - "A nested stage route can publish content into the frame's single persistent ContextPanel via a provider setter (setPanelContent), and the frame renders it — the ContextPanel no longer hardcodes {null}"
    - "The already-fetched per-run data every stage panel needs (pitch rows, QA findings, claim rows, sign-offs) is readable from useWorkspaceState() with NO new Convex subscription added"
    - "When no stage has published content the ContextPanel still shows its honest never-blank placeholder (not a crash, not a stale value)"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx"
      provides: "panelContent + setPanelContent slot state on the context value; pitchRows/qaFindings/claimRows/signOffs exposed from the already-subscribed queries"
      contains: "setPanelContent"
    - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx"
      provides: "FrameChrome renders <ContextPanel title=\"Context\">{panelContent}</ContextPanel>, reading panelContent from useWorkspaceState()"
      contains: "{panelContent}"
    - path: "apps/dispatch-control/__tests__/WorkspaceContextPanelSlot.test.tsx"
      provides: "Regression proof: a child calling setPanelContent makes the panel show that content and drop the placeholder; default (no publisher) shows the placeholder"
  key_links:
    - from: "a stage page's client publisher"
      to: "FrameChrome's <ContextPanel>"
      via: "useWorkspaceState().setPanelContent(node) -> provider useState -> value.panelContent -> layout renders {panelContent}"
      pattern: "setPanelContent"
    - from: "WorkspaceStateProvider already-subscribed useQuery results"
      to: "context value"
      via: "expose pitchRows/qaFindings/claimRows/signOffs (no new useQuery)"
      pattern: "pitchRows|qaFindings|claimRows|signOffs"
---

<objective>
Build the mechanism half of the WSP-03 gap fix: a single persistent ContextPanel whose content is injected per stage.

Today `layout.tsx:249` mounts `<ContextPanel title="Context">{null}</ContextPanel>` and no stage route can feed it — so the panel shows "Nothing to show for this stage yet" on all 5 stages (the verified gap in 41-VERIFICATION.md). Per 41-CONTEXT.md D-19 ("One shared collapsible panel shell ... content injected per stage"), this plan hoists a panel-content slot into `WorkspaceStateProvider` (a `panelContent` field + `setPanelContent` setter) and wires `layout.tsx` to render it. It ALSO exposes the four per-run arrays the stage publishers will need — pitch rows, QA findings, claim rows, sign-offs — which the provider ALREADY subscribes to, so Plan 41-12's publishers add ZERO new Convex subscriptions.

This keeps ONE persistent panel (its collapse/hide state, owned by `ContextPanel.tsx`, survives tab switches because the frame layout never remounts) with content swapped by whichever stage is mounted. It does NOT move ContextPanel into each stage (that would remount it per tab and fragment the shell — the anti-pattern D-19 warns against).

Purpose: Close the "renders stage-appropriate context" half of WSP-03 without rewriting ContextPanel, the stages, or the derivation.
Output: A provider slot + exposed data + wired layout + a slot regression test. Plan 41-12 (wave 2) consumes this to publish each stage's content.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/41-issue-workspace-frame/41-VERIFICATION.md
@.planning/phases/41-issue-workspace-frame/41-CONTEXT.md
@.planning/phases/41-issue-workspace-frame/41-05-SUMMARY.md
@.planning/phases/41-issue-workspace-frame/41-VALIDATION.md

<interfaces>
<!-- Current contracts the executor needs — use these directly, no exploration. -->

Provider value today (apps/.../issues/_components/WorkspaceStateProvider.tsx):
```typescript
export interface WorkspaceStateValue {
  issueNumber: number | null
  runId: string | null
  held: boolean
  published: boolean
  status: IssueStatus
  stages: ReturnType<typeof deriveStageStates>
  sectionStates: Record<string, SectionStateResult> | undefined
  tasks: DerivedTask[]
  workMinutes: number
  history: Doc<'pipelineRuns'>[] | undefined
  issue: Doc<'issues'> | null | undefined
}
// useWorkspaceState() throws if used outside <WorkspaceStateProvider>.
```

Already-subscribed local vars INSIDE the provider (from api.* useQuery) to EXPOSE on the value (NO new query):
```typescript
const pitchRows   = useQuery(api.pitchLog.byRunId, runId ? { runId } : 'skip')      // raw Doc<'pitchLog'>[] | undefined
const qaFindings  = useQuery(api.qaCorrections.byRunId, runId ? { runId } : 'skip') // raw qaCorrections[] | undefined
// claimRows: mapped to { _id, status, sourceUrl?, sectionName?, claimText? }[] | undefined
// signOffs:  Record<string, {...}> | {} | undefined   (normalized: {} once run lookup resolved to no-run)
```
(Element type shapes already exist as `DerivationInputs['qaFindings' | 'claimRows' | 'signOffs' | 'pitchRows']` in lib/derivedState.ts. `Doc` is already imported here for the raw pitchLog rows.)

ContextPanel shell (apps/.../issues/_components/ContextPanel.tsx) — DO NOT MODIFY:
```typescript
export default function ContextPanel({ title, children }: { title: string; children: React.ReactNode }): JSX.Element
// Renders children when present; renders "Nothing to show for this stage yet" when children is null/undefined/false.
// Owns its own collapse/hide + localStorage persistence (dc.workspace.contextPanel.hidden). Content-agnostic.
```

layout.tsx call site to change (FrameChrome destructure line ~161 + line ~249):
```tsx
const { status, stages, tasks, workMinutes } = useWorkspaceState()   // add panelContent here
...
<ContextPanel title="Context">{null}</ContextPanel>                  // becomes {panelContent}
```

Test-mock template to mirror: apps/dispatch-control/__tests__/WorkspaceLayout.test.tsx (mocks next/navigation, @clerk/nextjs, @/lib/contentPatchClient, @convex/_generated/api, and convex/react useQuery/useMutation to feed the REAL provider a fixture).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add the panelContent slot + expose already-fetched per-run data on WorkspaceStateProvider</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx (whole file — you edit the value interface + returned value; pitchRows line ~102, qaFindings line ~101, claimRows line ~112, signOffs line ~110 are already computed)
    - apps/dispatch-control/lib/derivedState.ts lines 58-86 (DerivationInputs — reuse its `qaFindings`/`claimRows`/`signOffs`/`pitchRows` element types for the exposed field types)
    - .planning/phases/41-issue-workspace-frame/41-CONTEXT.md D-19 (one shared shell, content injected per stage)
  </read_first>
  <action>
    In WorkspaceStateProvider.tsx:
    1. Ensure `ReactNode` and `useState` are imported (both already are).
    2. Extend `WorkspaceStateValue` with:
       - `panelContent: ReactNode` — the currently-published per-stage panel content (null when no stage has published).
       - `setPanelContent: (content: ReactNode) => void` — a stage publisher calls this in an effect (with cleanup) to publish/clear its content.
       - `pitchRows: Doc<'pitchLog'>[] | undefined` — raw candidate/pitch rows (Stage 1 lead/org detail source).
       - `qaFindings: DerivationInputs['qaFindings']` — raw open+resolved QA findings feed (Stage 2 open items + Stage 4 voice tells).
       - `claimRows: DerivationInputs['claimRows']` — mapped claim rows (Stage 3 claim detail).
       - `signOffs: DerivationInputs['signOffs']` — normalized active sign-offs (Stage 5 readiness).
       Add a short comment that these four arrays are the SAME already-subscribed queries the provider derives from — exposed so Plan 41-12 publishers reuse them with zero new subscriptions (41-CONTEXT D-19 + the gap's "do not add new Convex subscriptions where existing ones suffice" rule).
    3. Inside the provider body add `const [panelContent, setPanelContent] = useState<ReactNode>(null)`.
    4. Add `panelContent`, `setPanelContent`, and the four already-computed local vars (`pitchRows`, `qaFindings`, `claimRows`, `signOffs`) to the returned `value` object. Add NO new `useQuery` — every array already exists as a local var in this file.
    Do NOT touch the derivation logic, the getDraft effect, or the sectionStates contract.
  </action>
  <acceptance_criteria>
    - `grep -n "setPanelContent" "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx"` shows the interface field, the `useState`, and the returned value (>=3 hits).
    - `grep -n "panelContent: ReactNode" "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx"` matches.
    - `grep -E "pitchRows|qaFindings|claimRows|signOffs" "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx"` shows each of the four on the returned value.
    - NO new subscription: `grep -c "useQuery(" "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx"` is unchanged (8).
    - `pnpm --filter dispatch-control exec tsc --noEmit 2>&1 | grep "WorkspaceStateProvider.tsx"` prints nothing (zero type errors in this file).
  </acceptance_criteria>
  <verify>
    <automated>cd apps/dispatch-control && grep -q "setPanelContent" "app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx" && pnpm --filter dispatch-control exec tsc --noEmit 2>&1 | (! grep -q "WorkspaceStateProvider.tsx")</automated>
  </verify>
  <done>WorkspaceStateProvider exposes panelContent + setPanelContent and the four already-fetched arrays; no new useQuery; the file type-checks.</done>
</task>

<task type="auto">
  <name>Task 2: Render {panelContent} in the frame + prove the slot end-to-end</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx, apps/dispatch-control/__tests__/WorkspaceContextPanelSlot.test.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx (FrameChrome destructure line ~161; the ContextPanel mount line ~249)
    - apps/dispatch-control/app/(dashboard)/issues/_components/ContextPanel.tsx (confirm the placeholder renders only when children is null/undefined/false — do NOT modify it)
    - apps/dispatch-control/__tests__/WorkspaceLayout.test.tsx (COPY its full mock block: next/navigation, @clerk/nextjs, @/lib/contentPatchClient, @convex/_generated/api, convex/react — you need the identical setup to render the real layout+provider)
  </read_first>
  <action>
    1. In layout.tsx `FrameChrome`, add `panelContent` to the `useWorkspaceState()` destructure (line ~161).
    2. Replace `<ContextPanel title="Context">{null}</ContextPanel>` (line ~249) with `<ContextPanel title="Context">{panelContent}</ContextPanel>`. No other change to the grid or frame.
    3. Create apps/dispatch-control/__tests__/WorkspaceContextPanelSlot.test.tsx. Mirror WorkspaceLayout.test.tsx's mock block verbatim (same 5 vi.mock calls + beforeEach fixture). Add a tiny in-test client publisher:
       ```tsx
       function SlotProbe() {
         const { setPanelContent } = useWorkspaceState()
         useEffect(() => { setPanelContent(<span>PANEL_PROBE_CONTENT</span>) }, [setPanelContent])
         return null
       }
       ```
       (import `useWorkspaceState` from the provider path used by layout.tsx; `useEffect` from react.)
       Tests:
       - "publishes stage content into the single ContextPanel": render `<IssueWorkspaceLayout><SlotProbe /></IssueWorkspaceLayout>`; assert `screen.getByText('PANEL_PROBE_CONTENT')` is defined AND `screen.queryByText(/nothing to show for this stage yet/i)` is null (published content replaced the placeholder).
       - "shows the never-blank placeholder when no stage publishes": render `<IssueWorkspaceLayout><div>stage canvas</div></IssueWorkspaceLayout>` (no probe); assert `screen.getByText(/nothing to show for this stage yet/i)` is defined (the slot defaults to the honest placeholder — proving {null} was replaced by {panelContent} and panelContent starts null).
  </action>
  <acceptance_criteria>
    - The hardcoded null is gone: `grep -q ">{null}</ContextPanel>" "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx"` returns non-zero (no match).
    - `grep -q "{panelContent}</ContextPanel>" "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx"` matches.
    - `grep -q "panelContent" "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx"` shows it added to the useWorkspaceState() destructure.
    - `pnpm --filter dispatch-control test -- WorkspaceContextPanelSlot.test.tsx` exits 0 (both tests pass).
    - `pnpm --filter dispatch-control test -- WorkspaceLayout.test.tsx ContextPanel.test.tsx` still exits 0 (no regression to existing frame/shell tests).
  </acceptance_criteria>
  <verify>
    <automated>cd apps/dispatch-control && (! grep -q ">{null}</ContextPanel>" "app/(dashboard)/issues/[issueNumber]/layout.tsx") && grep -q "{panelContent}</ContextPanel>" "app/(dashboard)/issues/[issueNumber]/layout.tsx" && pnpm --filter dispatch-control test -- WorkspaceContextPanelSlot.test.tsx WorkspaceLayout.test.tsx ContextPanel.test.tsx</automated>
  </verify>
  <done>layout.tsx renders {panelContent} (no {null}); the new slot test proves published content reaches the panel and replaces the placeholder, and the default still shows the honest placeholder; existing frame/shell tests still pass.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- WorkspaceContextPanelSlot.test.tsx WorkspaceLayout.test.tsx ContextPanel.test.tsx` all green.
- `grep` confirms `layout.tsx` no longer contains `>{null}</ContextPanel>` and now contains `{panelContent}</ContextPanel>`.
- `grep` confirms `WorkspaceStateProvider.tsx` exposes `setPanelContent` + `pitchRows`/`qaFindings`/`claimRows`/`signOffs`, with `useQuery(` count still 8 (no new subscription).
- `pnpm --filter dispatch-control exec tsc --noEmit` reports no NEW errors in the two touched non-test files (the ~20 pre-existing baseline errors in unrelated test files documented since 41-01 are out of scope).
</verification>

<success_criteria>
The frame now has a working per-stage content slot: `setPanelContent` on the provider flows to `<ContextPanel>{panelContent}</ContextPanel>` in the frame; the four per-run arrays are exposed for reuse with zero new subscriptions; the slot regression test proves both the published-content and honest-empty paths. Plan 41-12 can now wire each stage's content. (Full-suite + strict build gate runs at the end of Plan 41-12, which is the last gap-closure plan.)
</success_criteria>

<output>
After completion, create `.planning/phases/41-issue-workspace-frame/41-11-SUMMARY.md`.
</output>
