---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 05
type: execute
wave: 3
depends_on: [56-01, 56-02, 56-03]
files_modified:
  - apps/dispatch-control/app/(editorial)/page.tsx
  - apps/dispatch-control/app/(editorial)/_components/IssueHome.tsx
  - apps/dispatch-control/app/(editorial)/_components/IssueHomeView.tsx
  - apps/dispatch-control/app/(editorial)/_components/HoldStopFooter.tsx
  - apps/dispatch-control/app/(editorial)/_components/HoldControl.tsx
  - apps/dispatch-control/app/(editorial)/_components/PublishFooter.tsx
  - apps/dispatch-control/app/(editorial)/_components/StoryRow.tsx
  - apps/dispatch-control/app/(editorial)/_components/StartIssueButton.tsx
  - apps/dispatch-control/app/(editorial)/_components/HoldDialog.tsx
  - apps/dispatch-control/lib/publishChain.ts
  - apps/dispatch-control/__tests__/IssueHome.test.tsx
  - apps/dispatch-control/__tests__/IssueHomeView.test.tsx
  - apps/dispatch-control/__tests__/HoldStopFooter.test.tsx
  - apps/dispatch-control/__tests__/HoldControl.test.tsx
  - apps/dispatch-control/__tests__/HoldDialog.test.tsx
  - apps/dispatch-control/__tests__/StartIssueButton.test.tsx
  - apps/dispatch-control/__tests__/publishNoTypedConfirm.test.ts
  - apps/dispatch-control/__tests__/publishChain.test.ts
autonomous: true
requirements: [P56-A1, P56-A2, P56-A3, P56-B1, P56-B2]

must_haves:
  truths:
    - "The front page shows the Main, Home-Writing and Home-Published artboards for ready, writing and published issues"
    - "Each Home state has exactly one slab sentence and at most one cobalt button: Publish Issue N, Release this issue, Start next week's issue, Start a new issue, Start the first issue, or Stop this issue"
    - "A Collaborator sees 'Waiting for the editor-in-chief to publish.' and no Publish button; nothing flashes the Collaborator sentence while the role loads"
    - "While writing, the footer offers 'Stop writing this issue' with a confirm dialog (client bug 3); ready issues offer 'Hold this issue'; held issues 'Release this issue'"
    - "/?run=<id> opens a past issue's Home view; a past Problem/Stopped issue redirects to its Behind-the-scenes page"
    - "No run id, no 'agents', no 'Failed' appears on the page"
  artifacts:
    - path: "apps/dispatch-control/app/(editorial)/_components/IssueHomeView.tsx"
      provides: "Pure view: slab + issue header + stations + parts + footer"
    - path: "apps/dispatch-control/app/(editorial)/_components/IssueHome.tsx"
      provides: "Data wrapper (useCurrentRun, publishChain, triggerRun, cancelRun, hold/reopen)"
      contains: "derivePublishGate("
    - path: "apps/dispatch-control/app/(editorial)/_components/HoldStopFooter.tsx"
      provides: "Hold / Stop / Release ghost footer"
  key_links:
    - from: "IssueHome.tsx"
      to: "lib/editorState.ts"
      via: "deriveEditorHome + homeSlabCopy"
      pattern: "deriveEditorHome\\("
    - from: "IssueHome.tsx"
      to: "lib/publishChain.ts"
      via: "publishChain on the slab primary"
      pattern: "publishChain\\("
    - from: "app/(editorial)/page.tsx"
      to: "IssueHome.tsx"
      via: "searchParams.run → runId prop"
      pattern: "runId="
---

<objective>
Rebuild `/` (and `/?run=<runId>`) to the Main / Home-Writing / Home-Published artboards: slab, issue header, four stations, nine parts, Hold/Stop footer. Fold Start, Publish, Hold, Release and Stop into the slab and footer; delete the old publish footer, story row, start button and hold dialog.

Purpose: Success criteria 1 and 3 for the busiest screen; client bugs 1 (open a past issue), 3 (no Stop), 7 (nine parts).
Output: rebuilt IssueHome/IssueHomeView, new HoldStopFooter, 4 deleted components, rewritten tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UI-SPEC.md
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-RESEARCH.md
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/canvas/Main.dc.html
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/canvas/Home-Writing.dc.html
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/canvas/Home-Published.dc.html
@apps/dispatch-control/app/(editorial)/_components/IssueHome.tsx
@apps/dispatch-control/app/(editorial)/_components/IssueHomeView.tsx
@apps/dispatch-control/lib/editorState.ts
@apps/dispatch-control/lib/publishChain.ts

<interfaces>
```typescript
// lib/useCurrentRun.ts
useCurrentRun(opts?: { runId?: string | null }): { state: { kind: 'loading'|'none'|'run' }; pinned: boolean; runId: string | null; issueNumber: number | null; title: string | null | undefined; derivationInputs: { runStatus?: string; ... }; qaFindings; claimRows; runRow: { startedAt: number; completedAt?: number } | null | undefined; runCostUsd: number | undefined }
// Convex
api.runs.latest({ workspace_id })                 // to know the CURRENT run id when pinned
api.issues.byIssueNumber({ workspace_id, issueNumber })  // { held, published, publishedAt?, scheduledFor?, slug? ... }
api.pitchLog.selectedByRunId({ runId })           // subject/blurb (existing IssueHome usage)
api.issues.hold({ workspace_id, issueNumber, reason })   // reason non-empty
api.issues.reopen({ workspace_id, issueNumber })
// lib/pipelineControlClient.ts
triggerRun(body: TriggerRunBody /* {} */, token): Promise<TriggerRunResult>
cancelRun(runId, token): Promise<{ stopped?: boolean; alreadyTerminal?: boolean; cancelRequested?: boolean }>
// lib/publishChain.ts
publishChain({ getToken, runId }): Promise<{ ok: true } | { ok: false; step; message }>
derivePublishGate({ footer, role, held, busy }): PublishGate
// lib/homeSections.ts
deriveHomeSections({ draft, qaFindings, claimRows, runStatus }) ; deriveHomeFooter({ stateKind, sections, issue, publishedAt, runStatus, runCompletedAt })
// lib/editorState.ts (56-01)
deriveEditorHome({ footer, held, role, rows, pinnedOlder }): EditorHomeVM
homeSlabCopy(vm, { issueNumber, startedAt, publishedAt, now, pinned }): SlabCopy  // action: 'publish'|'start-next'|'start-new'|'start-first'|'release'|'stop-stuck'
partsHint(state); COPY; formatIssueLine (lib/issueTitle)
// components/editor (56-03)
NextStepSlab({ sentence, explanation, primary, working, ghost, link, error, live }); Stations({ stations }); PartsList({ rows, published, hint, hrefFor })
// lib/issueRouteResolver.ts
adminRunHref(runId); sectionEditHref(sectionId, runId, currentRunId)
```
Preview URL: existing fetch in IssueHome `/api/review-desk/${runId}/preview-url?slug=issue-${n}` → `{ previewUrl }` — keep.
Public site link: `https://jesseaeisenbalm.com/issue/issue-${n}` — confirm the real pattern from IssueHome.tsx `links.liveIssue` and reuse it exactly.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: IssueHomeView (pure) + HoldStopFooter</name>
  <files>apps/dispatch-control/app/(editorial)/_components/IssueHomeView.tsx, apps/dispatch-control/app/(editorial)/_components/HoldStopFooter.tsx, apps/dispatch-control/__tests__/IssueHomeView.test.tsx, apps/dispatch-control/__tests__/HoldStopFooter.test.tsx</files>
  <read_first>
    - current IssueHomeView.tsx (keep the pure-props seam pattern; full rewrite of markup)
    - 56-UI-SPEC.md § 1–5 (slab, stations, header, parts, footer), § Responsive contract, § Copywriting slab table + Other copy
    - canvas/Main.dc.html, Home-Writing.dc.html, Home-Published.dc.html
  </read_first>
  <behavior>
    - props state 'ready' (Editor-in-chief) → slab sentence 'Read the issue, then publish it.', exactly one [data-primary] with text 'Publish Issue 48', link 'Preview the issue first'; header line 'Issue 48 · Thursday 29 October 2026'; h1 charity name; Stations present; 9 parts rows; footer ghost 'Hold this issue' with UI-SPEC hold explanation
    - 'writing' → no [data-primary], text 'Working' in slab, footer button 'Stop writing this issue' + stop explanation; parts hint 'Finished parts open as soon as they're written.'
    - 'held' → primary 'Release this issue'; footer shows NO second Release button (footer hidden in held state, since Release is the slab primary)
    - 'published' → primary "Start next week's issue", link 'Read Issue 47 on the website' target _blank, header line ends ' · Published', no footer, every clean row reads 'Published'
    - 'ready-collab' → sentence 'Waiting for the editor-in-chief to publish.', zero [data-primary]
    - 'empty' → h1/slab 'No issue yet this week', primary 'Start the first issue', no stations, no parts
    - 'problem' → primary 'Start a new issue', link 'What happened' to /admin/runs/<id>
    - 'stuck' → primary 'Stop this issue'
    - 'loading' → skeleton lines, zero [data-primary], no 'Waiting for the editor-in-chief' text
    - draftError set → 'This page didn't load. Check your connection, then press Reload this page.' + ghost button 'Reload this page'
    - textContent of every state never matches EDITOR_BANNED_PATTERN or RUN_ID_PATTERN (fixture runId 'a1b2c3d4e5f6' must not appear)
    - HoldStopFooter mode 'stop' → clicking calls onStop only after confirm resolves true with title 'Stop writing this issue?'; mode 'hold' → onHold called directly (no confirm)
  </behavior>
  <action>
Rewrite `IssueHomeView.tsx` (no Convex/Clerk imports). New props:
```typescript
export interface IssueHomeViewProps {
  vm: EditorHomeVM
  slab: SlabCopy
  issueLine: string                 // formatIssueLine(...)
  charityName: string | null | undefined   // undefined = loading
  blurb: string | null | undefined
  rows: HomeSectionRow[] | undefined
  hrefFor: (row: HomeSectionRow) => string
  onPrimary: () => void
  primaryBusy: boolean
  actionError: string | null         // publish/start/stop/hold error copy (already plain)
  links: { preview: string | null; website: string | null; whatHappened: string | null }
  footer: ReactNode | null           // HoldStopFooter element or null
  draftError: string | null
  onReload: () => void
  live: string | null                // aria-live announcement e.g. 'Part 6 is written'
}
```
Render order: `NextStepSlab` (primary when `slab.action` set: `{ label: slab.actionLabel, onClick: onPrimary, busy: primaryBusy }`; `working` when slab.working; link from `slab.link` → links[...] with `external: true` for 'website', label `slab.linkLabel`; error = actionError) → header (`p` 15px ink-soft issueLine; `h1` Newsreader `text-[32px] leading-[1.1] sm:text-[48px] sm:leading-[1.04] font-semibold tracking-normal` charityName ?? 'Charity not chosen yet'; blurb Lora `text-[17px] sm:text-[18px] leading-[1.5]` max-w-[760px]) → `Stations` (omit for loading/empty) → `PartsList` (omit for loading/empty; hint `partsHint(vm.state)`; published = vm.state === 'published') → footer slot. Loading: SkeletonLine x3 from `components/ui/Skeleton`. Use `letter-spacing:-0.01em` via `style` on the h1 (no `tracking-` class). Empty state: slab only (sentence 'No issue yet this week'), no h1 duplication — the slab sentence plus an `h1` sr-only "This week's issue" so the page has one h1.

`HoldStopFooter.tsx` ('use client'): props `{ mode: 'hold' | 'stop'; onHold?: () => void; onStop?: () => void; busy: boolean; issueLabel: string; error?: string | null }`. Layout: `div border-t border-[color:var(--color-line-strong)] pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`; explanation Lora 17px ink-soft max-w-[620px] = COPY.holdExplanation or COPY.stopExplanation; ghost button full width on phone, 48px, 17px/600: COPY.holdButton / COPY.stopButton. Stop: `const ok = await confirm({ title: COPY.stopConfirmTitle, body: COPY.stopConfirmBody.replace('{issue}', issueLabel), confirmLabel: COPY.stopConfirm, cancelLabel: COPY.stopCancel, tone: 'default' })` then `onStop()`. Error `p role="alert"`.

Rewrite `__tests__/IssueHomeView.test.tsx` from scratch (drop all old copy-constant imports) covering every behavior bullet with a `makeProps(state)` helper built from real `deriveEditorHome` + `homeSlabCopy` outputs. Create `__tests__/HoldStopFooter.test.tsx`.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/IssueHomeView.test.tsx __tests__/HoldStopFooter.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "PublishFooter\|StoryRow\|FAILED_SENTENCE\|READY_SENTENCE" "apps/dispatch-control/app/(editorial)/_components/IssueHomeView.tsx"` returns nothing
    - `grep -nE "font-mono|uppercase|tracking-|text-\[(9|10|11|12|13|14|16)px\]" "apps/dispatch-control/app/(editorial)/_components/IssueHomeView.tsx" "apps/dispatch-control/app/(editorial)/_components/HoldStopFooter.tsx"` returns nothing
    - `grep -n "<input" "apps/dispatch-control/app/(editorial)/_components/IssueHomeView.tsx"` returns nothing
    - both tests pass
  </acceptance_criteria>
  <done>Every Home state renders from props with one primary at most, plain words only.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: IssueHome data wrapper + /?run= page + publish copy</name>
  <files>apps/dispatch-control/app/(editorial)/_components/IssueHome.tsx, apps/dispatch-control/app/(editorial)/page.tsx, apps/dispatch-control/lib/publishChain.ts, apps/dispatch-control/__tests__/IssueHome.test.tsx, apps/dispatch-control/__tests__/publishChain.test.ts</files>
  <read_first>
    - current IssueHome.tsx (draft load effect, preview fetch, publish latch — keep the behaviours, change the wiring)
    - apps/dispatch-control/__tests__/IssueHome.test.tsx (mocking conventions: vi.hoisted, convex/react, @clerk/nextjs, @/lib/useCurrentRun, next/navigation)
    - apps/dispatch-control/__tests__/homeRoute.test.ts (page must keep force-dynamic and NOT be 'use client')
    - 56-RESEARCH.md § Pattern 2, Pitfall 6, Pitfall 10, Open Question 7
  </read_first>
  <behavior>
    - page.tsx: `export const dynamic = 'force-dynamic'`, no 'use client', async `Page({ searchParams })` passes `runId` (string or undefined) to `<IssueHome runId=... />`
    - IssueHome with no runId follows runs.latest (useCurrentRun() called with { runId: null })
    - with runId pinned to a failed or cancelled run → router.replace('/admin/runs/<id>')
    - with runId pinned to a run that is not the current latest and not published → state 'older', zero [data-primary]
    - ready + Editor-in-chief: pressing 'Publish Issue 48' calls publishChain once even when clicked twice (busy latch); on {ok:false} shows "Publishing didn't go through, and nothing has reached readers. Press Publish Issue 48 to try again. If it keeps happening, tell Andrew."
    - after 75 s publishing shows PUBLISH_SLOW_NOTICE = 'Publishing is taking longer than usual. Nothing is lost. This page will update when it is done.'
    - 'Start next week's issue' / 'Start a new issue' / 'Start the first issue' call triggerRun({}, token) once; on reject show COPY.startFailed
    - writing state: 'Stop writing this issue' → confirm → cancelRun(runId, token)
    - stuck: primary 'Stop this issue' → confirm → cancelRun
    - 'Hold this issue' → api.issues.hold mutation with reason 'Held by the editor'; 'Release this issue' → api.issues.reopen
    - role undefined → no Collaborator sentence and no Publish button
  </behavior>
  <action>
1. `page.tsx`:
```tsx
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import IssueHome from './_components/IssueHome'
export const metadata: Metadata = { title: "This week's issue" }
export default async function IssueHomePage({ searchParams }: { searchParams: Promise<{ run?: string | string[] }> }) {
  const sp = await searchParams
  const run = Array.isArray(sp.run) ? sp.run[0] : sp.run
  return <IssueHome runId={run ?? null} />
}
```
2. Rewrite `IssueHome.tsx` ('use client'), `export default function IssueHome({ runId = null }: { runId?: string | null })`:
   - `const cr = useCurrentRun({ runId })`; `const latest = useQuery(api.runs.latest, runId ? { workspace_id: DEFAULT_WORKSPACE_ID } : 'skip')`; `pinnedOlder = runId != null && latest !== undefined && latest?.runId !== runId`.
   - Keep the existing draft-load effect, `selectedPitch` (blurb = selectedPitch?.scoutSummary), `issueRow`, preview-url fetch.
   - `sections = deriveHomeSections(...)`, `footer = deriveHomeFooter(...)` exactly as today.
   - Redirect: `useEffect(() => { if (runId && (footer.kind === 'failed' || footer.kind === 'stopped')) router.replace(adminRunHref(runId)) }, ...)` (useRouter from next/navigation).
   - `vm = deriveEditorHome({ footer, held: issueRow?.held, role, rows: sections?.rows, pinnedOlder })`; `slab = homeSlabCopy(vm, { issueNumber: cr.issueNumber, startedAt: cr.runRow?.startedAt, publishedAt: issueRow?.publishedAt ?? null, now, pinned: runId != null })` with `now` from a 30 s `useState(Date.now())` ticker.
   - Gate stays server-parity: `const gate = derivePublishGate({ footer, role, held: issueRow?.held, busy })`; the slab primary for action 'publish' runs only when `gate.enabled` (keep the literal `derivePublishGate(` call — publishNoTypedConfirm asserts it).
   - `onPrimary` switch on `slab.action`: publish → busy latch ref + `publishChain({ getToken, runId: cr.runId })`, set slow notice timer `PUBLISH_SLOW_MS`; start-next|start-new|start-first → `triggerRun({}, await getToken())` (latch), error → COPY.startFailed; release → `reopen({ workspace_id, issueNumber })`; stop-stuck → confirm (COPY.stopConfirmTitle/body/confirm/cancel) → `cancelRun(cr.runId, token)`.
   - Footer: writing|checking → `<HoldStopFooter mode="stop" onStop={...cancelRun} />`; ready|ready-collab → `<HoldStopFooter mode="hold" onHold={() => hold({ workspace_id, issueNumber, reason: COPY.holdReason })} />`; otherwise null. Errors from hold/stop shown via the footer's `error` with COPY.saveFailed-style plain text: use 'That didn't go through. Press the button again.' (define locally).
   - `hrefFor = row => sectionEditHref(row.id, cr.runId!, latest?.runId ?? cr.runId)` so pinned issues keep `?run=`.
   - `links`: preview (existing previewUrl), website (existing liveIssue URL logic), whatHappened `cr.runId ? adminRunHref(cr.runId) : null`.
   - `live`: when `writtenCount` increases while writing, set `Part {n} is written` (n = newly written count; spell as digits is fine: 'Part 6 is written').
   - `issueLine = formatIssueLine({ issueNumber: cr.issueNumber, publishedAt: issueRow?.publishedAt, scheduledFor: issueRow?.scheduledFor, runStartedAt: cr.runRow?.startedAt, published: vm.state === 'published' })`.
   - Do not import StartIssueButton, HoldControl, StopRunButton, PublishFooter, LockedControl.
3. `lib/publishChain.ts`: change only copy constants: `NETWORK_FAILURE_MESSAGE = "Publishing didn't go through, and nothing has reached readers. Press Publish again to try again. If it keeps happening, tell Andrew."`, `PUBLISH_SLOW_NOTICE = 'Publishing is taking longer than usual. Nothing is lost. This page will update when it is done.'`, `HELD_REASON = 'This issue is on hold. Release it to publish.'`, `COLLABORATOR_LOCK_LABEL = 'Waiting for the editor-in-chief to publish.'`. Keep names and the gate logic unchanged. Update `__tests__/publishChain.test.ts` string expectations.
4. Rewrite `__tests__/IssueHome.test.tsx` for every behavior bullet (keep the existing mock scaffolding; mock `@/lib/pipelineControlClient` triggerRun/cancelRun, `next/navigation` useRouter replace spy, `useMutation` returning spies for hold/reopen).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/IssueHome.test.tsx __tests__/publishChain.test.ts __tests__/homeRoute.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "'use client'" "apps/dispatch-control/app/(editorial)/page.tsx"` returns nothing; `grep -n "force-dynamic" "apps/dispatch-control/app/(editorial)/page.tsx"` matches
    - `grep -n "derivePublishGate(\|deriveEditorHome(\|publishChain(\|cancelRun(\|triggerRun(" "apps/dispatch-control/app/(editorial)/_components/IssueHome.tsx" | wc -l` >= 5
    - `grep -n "StartIssueButton\|HoldControl\|StopRunButton\|PublishFooter\|LockedControl" "apps/dispatch-control/app/(editorial)/_components/IssueHome.tsx"` returns nothing
    - `grep -n "Admin → Run Details" apps/dispatch-control/lib/publishChain.ts` returns nothing
    - listed tests pass
  </acceptance_criteria>
  <done>Home is fully wired: publish, start, stop, hold, release, past-issue pinning and redirects.</done>
</task>

<task type="auto">
  <name>Task 3: Delete the retired Home chrome and update structural tests</name>
  <files>apps/dispatch-control/app/(editorial)/_components/PublishFooter.tsx, apps/dispatch-control/app/(editorial)/_components/StoryRow.tsx, apps/dispatch-control/app/(editorial)/_components/StartIssueButton.tsx, apps/dispatch-control/app/(editorial)/_components/HoldDialog.tsx, apps/dispatch-control/app/(editorial)/_components/HoldControl.tsx, apps/dispatch-control/__tests__/StartIssueButton.test.tsx, apps/dispatch-control/__tests__/HoldDialog.test.tsx, apps/dispatch-control/__tests__/HoldControl.test.tsx, apps/dispatch-control/__tests__/publishNoTypedConfirm.test.ts</files>
  <read_first>
    - __tests__/publishNoTypedConfirm.test.ts (it requires PublishFooter.tsx to exist — must be repointed)
    - `grep -rn "PublishFooter\|StoryRow\|StartIssueButton\|HoldDialog\|HoldControl" apps/dispatch-control/app apps/dispatch-control/components apps/dispatch-control/lib apps/dispatch-control/__tests__`
  </read_first>
  <action>
1. `git rm` these five files: `PublishFooter.tsx`, `StoryRow.tsx`, `StartIssueButton.tsx`, `HoldDialog.tsx`, `HoldControl.tsx` (Hold/Release now live in HoldStopFooter + slab), and their tests `StartIssueButton.test.tsx`, `HoldDialog.test.tsx`, `HoldControl.test.tsx`. Do NOT delete `HeldIssueRow.tsx` (archive/page.tsx still imports it until plan 56-07; plan 56-12 deletes it).
2. `__tests__/publishNoTypedConfirm.test.ts`: replace `PUBLISH_FOOTER` with `ISSUE_HOME_VIEW = path.join(EDITORIAL_ROOT, 'IssueHomeView.tsx')`; `PUBLISH_SURFACE_FILES = [ISSUE_HOME_VIEW, ISSUE_HOME]`; update the comment ("Phase 56: the ONE publish surface is the slab primary on the front door, wired in IssueHome"). Keep all other assertions.
3. Run the full suite and the strict build.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control build && pnpm --filter dispatch-control test</automated>
  </verify>
  <acceptance_criteria>
    - `ls "apps/dispatch-control/app/(editorial)/_components/"` lists exactly: HeldIssueRow.tsx, HoldStopFooter.tsx, IssueHome.tsx, IssueHomeView.tsx
    - `grep -rn "PublishFooter\|StoryRow\|StartIssueButton\|HoldDialog\|from './HoldControl'" apps/dispatch-control/app apps/dispatch-control/components apps/dispatch-control/lib apps/dispatch-control/__tests__` returns nothing
    - strict build exits 0; full suite has no failures other than the recorded baseline failure in SectionReaderPage.test.tsx (which plan 56-06 replaces)
  </acceptance_criteria>
  <done>Old Home chrome is gone and nothing references it.</done>
</task>

</tasks>

<verification>
Strict build + full suite (baseline exception only) green.
</verification>

<success_criteria>
Main, Home-Writing and Home-Published have live equivalents; Held, Collaborator, Empty, Problem, Stopped, Stuck and Older states render per the copy table and assumptions A3, A6, A7.
</success_criteria>

<output>
After completion, create `.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-05-SUMMARY.md`
</output>
