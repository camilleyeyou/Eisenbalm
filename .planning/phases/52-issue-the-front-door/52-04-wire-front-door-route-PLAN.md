---
phase: 52-issue-the-front-door
plan: 04
type: execute
wave: 4
depends_on: ["52-01", "52-02", "52-03"]
files_modified:
  - apps/dispatch-control/app/(editorial)/_components/IssueHome.tsx
  - apps/dispatch-control/__tests__/IssueHome.test.tsx
  - apps/dispatch-control/app/(editorial)/page.tsx
  - apps/dispatch-control/app/(dashboard)/page.tsx
  - apps/dispatch-control/app/(dashboard)/run/page.tsx
  - apps/dispatch-control/__tests__/homeRoute.test.ts
  - apps/dispatch-control/app/(editorial)/s/[section]/page.tsx
  - apps/dispatch-control/__tests__/SectionReaderPage.test.tsx
autonomous: true
requirements: [HOME-01, HOME-05, HOME-07, HOME-08, HOME-09]

must_haves:
  truths:
    - "Signing in lands on / and / is the Issue page, resolved through useCurrentRun() (runs.latest -> pipelineRuns.byRunId -> issueNumber), never max(issueNumber)"
    - "Exactly one page.tsx owns /; /run, /issues, /issues/[n]/approval, /my-tasks and /review-desk still resolve"
    - "Clicking Publish -> Publish runs publishChain with the live signOffs map; a failure shows the server's sentence; success holds 'Publishing…' until the run reads published (issue.published OR runStatus 'complete' — the pipeline never calls issues:markPublished), and after 75s shows the taking-longer notice with the button still disabled"
    - "A draft loaded for a previous runId is never shown or counted for the current run"
    - "A failed or Gate-1-paused run shows its own sentence even when the draft fetch fails — no skeleton, no error alert, no Publish button"
    - "A failed run triggers no recordSignOff or publishIssue call and offers none"
    - "While any of draft, qaFindings, claimRows, claimSummary, signOffs, issue or title is undefined the page shows a skeleton and no clean/ready copy"
    - "Following a '1 thing to fix →' link lands on /s/{id} scrolled to #finding-{id} once the draft has loaded"
  artifacts:
    - path: "apps/dispatch-control/app/(editorial)/_components/IssueHome.tsx"
      provides: "Client data wrapper: subscriptions, draft load, preview URL, publish state -> IssueHomeView"
      exports: ["default"]
    - path: "apps/dispatch-control/app/(editorial)/page.tsx"
      provides: "Server route entry for / (force-dynamic + metadata)"
    - path: "apps/dispatch-control/__tests__/homeRoute.test.ts"
      provides: "fs assertions on route ownership + old entry points"
    - path: "apps/dispatch-control/__tests__/IssueHome.test.tsx"
      provides: "Wrapper tests with mocked Convex/Clerk/clients"
  key_links:
    - from: "IssueHome.tsx"
      to: "lib/useCurrentRun.ts"
      via: "useCurrentRun() — the only current-issue resolution"
      pattern: "useCurrentRun\\(\\)"
    - from: "IssueHome.tsx"
      to: "lib/publishChain.ts"
      via: "publishChain({ getToken, runId, activeSignOffs: signOffs })"
      pattern: "publishChain\\("
    - from: "IssueHome.tsx"
      to: "lib/homeSections.ts"
      via: "deriveHomeSections + deriveHomeFooter"
      pattern: "deriveHomeSections\\(|deriveHomeFooter\\("
    - from: "app/(editorial)/s/[section]/page.tsx"
      to: "AnnotationMark id=finding-{id}"
      via: "hash-scroll effect after isLoading clears"
      pattern: "scrollIntoView"
---

<objective>
Wire live data into the view, move `/` to the new front door, and make the row deep link land on the problem.

Purpose: HOME-01 (real current issue at `/`), HOME-05 (straight to the first problem), HOME-07 (live chain), HOME-08/09 (honest + loading states with real subscriptions). The route move is a deliverable in its own right (Phase 34 retirement-half lesson; Phase 27 two-`/`-pages build break, commit 1430b98f).
Output: `IssueHome.tsx`, `(editorial)/page.tsx`, deletion of `(dashboard)/page.tsx`, hash-scroll on `/s/[section]`, and three test files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/52-issue-the-front-door/52-CONTEXT.md
@.planning/phases/52-issue-the-front-door/52-RESEARCH.md
@.planning/phases/52-issue-the-front-door/52-03-SUMMARY.md
@apps/dispatch-control/lib/useCurrentRun.ts
@apps/dispatch-control/app/(editorial)/_components/IssueHomeView.tsx

<interfaces>
From apps/dispatch-control/lib/useCurrentRun.ts:
```ts
export function useCurrentRun(): { state: {kind:'loading'|'none'|'run', ...}; runId: string | null; issueNumber: number | null; title: string | null | undefined; derivationInputs: DerivationInputs; claimSummary: { total; signedOff; blocking: number; flagged; allSignedOff } | undefined; signOffs: Record<string,{actorId:string;signedAt:number}> | undefined; qaFindings: DerivationInputs['qaFindings']; claimRows: DerivationInputs['claimRows']; runRow: {startedAt:number; completedAt?:number} | null | undefined; ... }
// derivationInputs.issue: {held, published} | null | undefined; derivationInputs.runStatus; derivationInputs.runCompletedAt
```
Convex queries (deduped with the hook's own subscriptions): `api.pitchLog.selectedByRunId({runId})` -> `{charityName, scoutSummary, ...} | null`; `api.issues.byIssueNumber({workspace_id: DEFAULT_WORKSPACE_ID, issueNumber})` -> issues row incl. `publishedAt?: number` (import DEFAULT_WORKSPACE_ID from `@/lib/workspace`).
`getDraft(runId: string, token: string | null): Promise<DraftResponse>` and `ContentPatchError` from `@/lib/contentPatchClient`.
`useRole(): 'Editor-in-chief' | 'Collaborator' | undefined` from `@/lib/role`.
Route helpers `@/lib/issueRouteResolver`: `issueRunHref(n, runId)`, `issueFactCheckHref(n)`, `issueApprovalHref(n)`, `issueStoryHref(n)`.
Preview: `GET /api/review-desk/{runId}/preview-url?slug=issue-{n}` -> `{ previewUrl: string | null }` (server signs; PREVIEW_SECRET stays server-side).
Public slug is deterministic `issue-{n}` (packages/pipeline/.../lib/sanity_client.py:184).
IssueHomeView props (52-03): issueNumber, title, subject, sections, footer, gate, draftError, publishing, publishError, confirming, onRequestPublish, onConfirmPublish, onCancelPublish, links {admin, pastIssues, runDetails, factCheck, approval, storyChoice, liveIssue, preview}.
Section page (app/(editorial)/s/[section]/page.tsx): all hooks sit before early returns (comment "Every hook, unconditionally, before any early return", ~line 203); `isLoading` computed ~line 279 AFTER the early `notFound()`/`none` returns; finding marks render `id="finding-{findingId}"` (components/galley/AnnotationMark.tsx:357).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: IssueHome data wrapper + IssueHome.test.tsx</name>
  <files>apps/dispatch-control/app/(editorial)/_components/IssueHome.tsx, apps/dispatch-control/__tests__/IssueHome.test.tsx</files>
  <read_first>
    - apps/dispatch-control/lib/useCurrentRun.ts
    - apps/dispatch-control/app/(editorial)/s/[section]/page.tsx lines 195-300 (draft-load pattern, getToken excluded from deps, isLoading predicate)
    - apps/dispatch-control/app/(dashboard)/run/_components/RunScreen.tsx lines ~580-650 (cancelled-flag draft effect, surface kinds)
    - apps/dispatch-control/__tests__/SectionReaderPage.test.tsx lines 36-130 (mock harness to copy)
    - apps/dispatch-control/app/(editorial)/_components/IssueHomeView.tsx, lib/homeSections.ts, lib/publishChain.ts
  </read_first>
  <behavior>
    - title: useCurrentRun mock title 'The Quiet Ledger' + useQuery('pitchLog:selectedByRunId') -> {charityName:'The Quiet Ledger', scoutSummary:'A two-person water lab.'} -> h1 'The Quiet Ledger' and subject visible; state {kind:'none'} -> 'There is no current issue yet.' and getDraft never called.
    - loading (table-driven, one `it` per field): starting from a fully-loaded awaiting-review fixture, set each of qaFindings, claimRows, claimSummary, signOffs, derivationInputs.issue, title to undefined in turn, and separately make getDraft a never-resolving promise -> `[aria-busy="true"]` present and no text matching /Reads clean|Ready to publish|Nothing left to fix/.
    - loading (runId switch): render with runId 'run_1' and a resolved clean draft, then switch mockCurrentRun to runId 'run_2' (same otherwise-clean inputs) with getDraft for run_2 never resolving -> rerender shows `[aria-busy="true"]` and no /Reads clean|Ready to publish|Nothing left to fix/ (the run_1 draft is ignored).
    - publish: fully-loaded ready fixture (awaiting-review, runCompletedAt set, no findings, claimSummary.blocking 0, signOffs {}, issue {held:false,published:false}, role 'Editor-in-chief') -> click 'Publish' -> 'Publish Issue 7 now?' -> click confirm 'Publish' -> publishChain mock called once with {runId:'run_1', activeSignOffs:{}} and a getToken function; chain resolves {ok:false, step:'publish', message:'Both sign-offs (Facts cleared + Sounds human) are required before publishing.'} -> that sentence in role="alert" and the Publish button enabled again; chain resolving {ok:true} -> button shows 'Publishing…' and stays disabled while issue.published is false; rerender with issue.published true -> 'Published' sentence, no Publish button; separately, after ok:true rerender with runStatus 'complete' and issue.published STILL false -> 'Published' sentence (date from runRow.completedAt), no Publish button, phase released; with `vi.useFakeTimers()`, ok:true and no completion, advance 75_000 ms -> 'Publishing is taking longer than usual — check Admin → Run Details.' in role="status" and the button still disabled ('Publishing…').
    - states: runStatus 'failed' -> FAILED_SENTENCE and no button named Publish; publishChain mock never called. getDraft REJECTS (ContentPatchError 409 'no draft') with runStatus 'failed' -> FAILED_SENTENCE, no `[aria-busy="true"]` in the footer, no role="alert", no Publish button. Same rejection with runStatus 'awaiting-review' + runCompletedAt undefined (Gate 1) -> GATE1_SENTENCE + 'Choose the charity →', no skeleton in the footer, no alert, no Publish button. role 'Collaborator' -> 'Collaborators can review and comment, not publish.' and disabled Publish. a voice-axis error finding open on 'game' -> Publish disabled and '1 story has something to fix: Game.' rendered.
  </behavior>
  <action>
    **IssueHome.tsx** (`'use client'`, default export `IssueHome`). Docstring: Phase 52 data wrapper; current issue ONLY via `useCurrentRun()` (never max(issueNumber)); every gate input from the hook or deduped subscriptions; no new fetch path to the pipeline except `getDraft`; publish only via `publishChain`.
    Imports include `publishChain, derivePublishGate, PUBLISH_SLOW_MS, PUBLISH_SLOW_NOTICE` from `@/lib/publishChain`. Hooks, all unconditionally at top: `const { getToken } = useAuth()` (`@clerk/nextjs`); `const cr = useCurrentRun()`; `const role = useRole()`; `const selectedPitch = useQuery(api.pitchLog.selectedByRunId, cr.runId ? { runId: cr.runId } : 'skip')`; `const issueRow = useQuery(api.issues.byIssueNumber, cr.issueNumber != null ? { workspace_id: DEFAULT_WORKSPACE_ID, issueNumber: cr.issueNumber } : 'skip')`; `const [draftState, setDraftState] = useState<{ runId: string; draft: DraftResponse } | { runId: string; error: string } | undefined>(undefined)` (keyed by runId — a draft or error for another run is ignored); `const [publishOk, setPublishOk] = useState(false)`; `const [slow, setSlow] = useState(false)`; `const [phase, setPhase] = useState<'idle' | 'confirming' | 'publishing'>('idle')`; `const [publishError, setPublishError] = useState<string | null>(null)`; `const [previewUrl, setPreviewUrl] = useState<string | null>(null)`.
    Draft effect keyed `[cr.runId, runStatus]` (re-fetch when a running run finishes) with a `cancelled` flag captured per run; `getToken` deliberately excluded from deps (eslint-disable comment, same as the section page). Capture `const forRun = cr.runId` at effect start; on success `if (!cancelled) setDraftState({ runId: forRun, draft: result })`; on error `setDraftState({ runId: forRun, error: e instanceof ContentPatchError || e instanceof Error ? e.message : 'Failed to load draft.' })`. Read side: `const current = draftState && draftState.runId === cr.runId ? draftState : undefined`; `const draft = current && 'draft' in current ? current.draft : undefined`; `const draftError = current && 'error' in current ? current.error : null`.
    Preview effect keyed `[cr.runId, cr.issueNumber]`: `fetch(`/api/review-desk/${encodeURIComponent(runId)}/preview-url?slug=issue-${issueNumber}`)` -> `json.previewUrl ?? null`; catch -> null.
    Derived: `const runStatus = cr.derivationInputs.runStatus`; `const draftForSelector = draftError ? (runStatus === 'running' ? null : undefined) : draft` (a failed fetch while running means "being written", otherwise never clean); `const sections = deriveHomeSections({ draft: draftForSelector, qaFindings: cr.qaFindings, claimRows: cr.claimRows, runStatus })`; `const publishedAt = issueRow?.publishedAt ?? cr.runRow?.completedAt ?? cr.derivationInputs.runCompletedAt ?? null` (the issues row is not flipped by the pipeline, so the run's completedAt is the real publish date in practice); `const footerRaw = deriveHomeFooter({ stateKind: cr.state.kind, sections, claimSummaryBlocking: cr.claimSummary?.blocking, signOffsLoaded: cr.signOffs !== undefined, issue: cr.derivationInputs.issue, publishedAt, runStatus, runCompletedAt: cr.derivationInputs.runCompletedAt })`; `const footer = (footerRaw.kind === 'fix' || footerRaw.kind === 'ready') && cr.title === undefined ? { kind: 'loading' as const } : footerRaw` (terminal kinds never wait on content or title); `const held = cr.derivationInputs.issue === undefined ? undefined : (cr.derivationInputs.issue?.held ?? false)`; `const gate = derivePublishGate({ footer, role, held, busy: phase === 'publishing' })`.
    Effect: when `footer.kind === 'published'` (covers issue.published OR runStatus 'complete') and phase === 'publishing' -> `setPhase('idle'); setPublishOk(false); setSlow(false)`. Slow effect keyed `[phase, publishOk]`: when `phase === 'publishing' && publishOk`, `const t = setTimeout(() => setSlow(true), PUBLISH_SLOW_MS)`; cleanup clears it. `publishNotice = slow ? PUBLISH_SLOW_NOTICE : null` (button stays disabled — busy).
    Handlers: `onRequestPublish = () => { setPublishError(null); setPhase('confirming') }`; `onCancelPublish = () => setPhase('idle')`; `onConfirmPublish = async () => { if (!gate.enabled || !cr.runId) return; setPhase('publishing'); const r = await publishChain({ getToken: () => getToken(), runId: cr.runId, activeSignOffs: cr.signOffs ?? {} }); if (!r.ok) { setPublishError(r.message); setPhase('idle') } else { setPublishOk(true) } }` (on ok stay 'publishing' until the footer reads published — Pitfall 4; never auto-retry).
    Links: `{ admin: '/run', pastIssues: '/issues', runDetails: n != null && runId ? issueRunHref(n, runId) : null, factCheck: n != null ? issueFactCheckHref(n) : null, approval: n != null ? issueApprovalHref(n) : null, storyChoice: n != null ? issueStoryHref(n) : null, liveIssue: base && n != null ? `${base.replace(/\/$/, '')}/issue/issue-${n}` : null, preview: previewUrl }` where `const base = process.env.NEXT_PUBLIC_WEB_PREVIEW_BASE` (literal access so Next inlines it).
    Render `<IssueHomeView issueNumber={cr.issueNumber} title={cr.title} subject={selectedPitch === undefined ? undefined : selectedPitch?.scoutSummary ?? null} sections={sections} footer={footer} gate={gate} draftError={footer.kind === 'fix' || footer.kind === 'ready' || footer.kind === 'loading' ? draftError : null} publishing={phase === 'publishing'} publishError={publishError} publishNotice={publishNotice} confirming={phase === 'confirming'} onRequestPublish={...} onConfirmPublish={() => void onConfirmPublish()} onCancelPublish={...} links={links} />`. Do NOT import Galley, InspectorProvider consumers, DecisionRail, or pipelineControlClient.

    **IssueHome.test.tsx**: copy the SectionReaderPage harness — `vi.mock('convex/react', () => ({ useQuery: vi.fn(), useMutation: vi.fn(() => vi.fn()) }))`; `vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: vi.fn(async () => 'tok') }), useUser: () => ({ isLoaded: true, user: { publicMetadata: { role: hoisted.role.current } } }) }))`; `vi.mock('@convex/_generated/api', () => ({ api: { pitchLog: { selectedByRunId: 'pitchLog:selectedByRunId' }, issues: { byIssueNumber: 'issues:byIssueNumber' } } }))`; `vi.mock('@/lib/useCurrentRun', () => ({ useCurrentRun: () => mockCurrentRun }))`; mock `@/lib/contentPatchClient` getDraft (keep actual ContentPatchError via importActual) and `@/lib/publishChain` `publishChain` (keep actual derivePublishGate/constants via importActual); `vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))`; stub `global.fetch = vi.fn(async () => ({ json: async () => ({ previewUrl: null }) }))`. Implement every <behavior> spec with describe names 'title', 'loading', 'publish', 'states'. Commit `feat(52-04): front-door data wrapper wired to live run`.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm exec vitest run __tests__/IssueHome.test.tsx __tests__/IssueHomeView.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - Both test files pass
    - `grep -n "useCurrentRun()" "apps/dispatch-control/app/(editorial)/_components/IssueHome.tsx"` matches; `grep -n "max(\|Math.max\|issues.list\|api.issues.list" "apps/dispatch-control/app/(editorial)/_components/IssueHome.tsx"` returns nothing
    - `grep -n "publishChain(" "apps/dispatch-control/app/(editorial)/_components/IssueHome.tsx"` matches; `grep -n "recordSignOff\|publishIssue\|publishManual\|DecisionRail\|Galley" "apps/dispatch-control/app/(editorial)/_components/IssueHome.tsx"` returns nothing
    - `grep -n "process.env.NEXT_PUBLIC_WEB_PREVIEW_BASE" "apps/dispatch-control/app/(editorial)/_components/IssueHome.tsx"` matches
    - IssueHome.test.tsx contains `describe('loading'` with at least 8 `it(` cases inside (six undefined fields + pending draft + runId switch)
    - `grep -n "draftState.runId === cr.runId\|runId === cr.runId" "apps/dispatch-control/app/(editorial)/_components/IssueHome.tsx"` matches; `grep -n "PUBLISH_SLOW_MS" "apps/dispatch-control/app/(editorial)/_components/IssueHome.tsx"` matches
    - IssueHome.test.tsx contains `runStatus: 'complete'` and `Publishing is taking longer than usual`
  </acceptance_criteria>
  <done>Live wrapper renders the view from real subscriptions, publish chain wired, tests green. The 52-04 SUMMARY must note that SectionHeader's `href="/"` back-link (app/(editorial)/s/[section]/_components/SectionHeader.tsx:39) now lands on the front door instead of bouncing through /run — UAT step checks it.</done>
</task>

<task type="auto">
  <name>Task 2: Move / to the front door (one commit) + homeRoute.test.ts</name>
  <files>apps/dispatch-control/app/(editorial)/page.tsx, apps/dispatch-control/app/(dashboard)/page.tsx, apps/dispatch-control/app/(dashboard)/run/page.tsx, apps/dispatch-control/__tests__/homeRoute.test.ts</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/page.tsx (the redirect('/run') stub being deleted)
    - apps/dispatch-control/app/(dashboard)/run/page.tsx (server-wrapper shape to mirror; docstring line 3 says "root redirects here")
    - apps/dispatch-control/app/(editorial)/layout.tsx
    - apps/dispatch-control/__tests__/middleware-matcher.test.ts (asserts / is protected — must stay green)
  </read_first>
  <action>
    Per 52-CONTEXT "Resolved after research": delete `app/(dashboard)/page.tsx` and add `app/(editorial)/page.tsx` in the SAME commit (two route groups owning `/` broke a Vercel build — commit 1430b98f).
    1. `git rm "apps/dispatch-control/app/(dashboard)/page.tsx"`.
    2. Create `apps/dispatch-control/app/(editorial)/page.tsx`:
    ```tsx
    /**
     * Phase 52 (HOME-01) — `/` is the editor's front door: the current issue,
     * its nine stories, one Publish button. Replaces the (dashboard) redirect
     * stub to /run (deleted in the same commit — two groups owning `/` breaks
     * the build, 1430b98f). The old console stays at its own URLs (/run,
     * /issues, /issues/[n]/approval, …) as the fallback path (Phase 53 SC-4).
     * force-dynamic: Convex useQuery needs a live provider (same as run/page.tsx).
     */
    export const dynamic = 'force-dynamic'

    import type { Metadata } from 'next'
    import IssueHome from './_components/IssueHome'

    export const metadata: Metadata = { title: 'This issue' }

    export default function IssueHomePage() {
      return <IssueHome />
    }
    ```
    3. In `app/(dashboard)/run/page.tsx` docstring, replace "The front door: root redirects here (see app/(dashboard)/page.tsx) and it is the first Editorial nav item" with "Formerly the post-login landing page; since Phase 52 `/` is the Issue front door (app/(editorial)/page.tsx) and The Run stays reachable here and as the first Editorial nav item". Comment-only.
    4. Create `apps/dispatch-control/__tests__/homeRoute.test.ts` (node env, fs only, `path.resolve(__dirname, '../app')`): asserts `(editorial)/page.tsx` exists; `(dashboard)/page.tsx` does NOT exist; `app/page.tsx` does NOT exist; scans every `page.tsx` directly under each route group root (`app/*/page.tsx` where the dir name matches /^\(.+\)$/) and expects exactly one; and each of these still exists: `(dashboard)/run/page.tsx`, `(dashboard)/issues/page.tsx`, `(dashboard)/issues/[issueNumber]/approval/page.tsx`, `(dashboard)/my-tasks/page.tsx`, `(dashboard)/review-desk/page.tsx`, `(editorial)/s/[section]/page.tsx`. Also asserts `(editorial)/page.tsx` contains `force-dynamic` and does NOT contain `'use client'`.
    5. Run `pnpm --filter dispatch-control build` (strict; catches route conflicts and type errors vitest misses). Then commit all four paths together with explicit-path `git add` (never `git add -A`; the tree has unrelated dirty files): `feat(52-04): / becomes the Issue front door; retire the /run redirect stub`.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm exec vitest run __tests__/homeRoute.test.ts __tests__/middleware-matcher.test.ts && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `test -f "apps/dispatch-control/app/(editorial)/page.tsx" && ! test -e "apps/dispatch-control/app/(dashboard)/page.tsx" && ! test -e apps/dispatch-control/app/page.tsx` succeeds
    - homeRoute and middleware-matcher tests pass; `pnpm --filter dispatch-control build` exits 0 and its route table lists `/` once
    - `git show --stat HEAD` lists both `app/(editorial)/page.tsx` (added) and `app/(dashboard)/page.tsx` (deleted)
    - `grep -n "root redirects here" "apps/dispatch-control/app/(dashboard)/run/page.tsx"` returns nothing
  </acceptance_criteria>
  <done>/ is owned by the editorial front door; every old console URL still exists; strict build green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Hash-scroll to the finding on /s/[section]</name>
  <files>apps/dispatch-control/app/(editorial)/s/[section]/page.tsx, apps/dispatch-control/__tests__/SectionReaderPage.test.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(editorial)/s/[section]/page.tsx lines 195-300
    - apps/dispatch-control/components/galley/AnnotationMark.tsx around line 357 (id={`finding-${findingId}`})
    - apps/dispatch-control/__tests__/SectionReaderPage.test.tsx (draft fixture, groupFindings, renderSection)
  </read_first>
  <behavior>
    - New `d('hash', ...)` block in SectionReaderPage.test.tsx: set `window.location.hash = '#finding-q0'`, stub `Element.prototype.scrollIntoView = vi.fn()`, set `mockCurrentRun.derivationInputs.qaFindings = groupFindings(1)` (quotedSpan 'in a garage' in originStory), render 'originStory' -> `await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled())`, and the element it was called on has id 'finding-q0'. Second spec: no hash -> scrollIntoView not called. Reset `window.location.hash = ''` in afterEach of the block.
  </behavior>
  <action>
    Add the spec first (RED), then in `page.tsx` move the loading predicate so it can feed an effect without breaking "every hook before any early return": compute `const pageLoading = state.kind === 'loading' || loading || title === undefined || derivationInputs.qaFindings === undefined || derivationInputs.claimRows === undefined` in the hooks region (before the `meta`/`notFound()` check), and add directly after it:
    ```ts
    // Phase 52 (HOME-05) — the front door links to /s/{id}#finding-{id}. The
    // browser's native hash scroll fires before the async draft renders the
    // mark, so scroll once loading clears.
    useEffect(() => {
      if (pageLoading || typeof window === 'undefined') return
      const id = window.location.hash.slice(1)
      if (!id) return
      document.getElementById(id)?.scrollIntoView({ block: 'center' })
    }, [pageLoading])
    ```
    Then make the existing `const isLoading = ...` reuse it (`const isLoading = pageLoading`) so the two can never diverge. No other behaviour change. Run the whole SectionReaderPage file plus the strict build. Commit `feat(52-04): section page scrolls to the linked finding`.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm exec vitest run __tests__/SectionReaderPage.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - SectionReaderPage.test.tsx passes, including the new `hash` specs (`pnpm exec vitest run __tests__/SectionReaderPage.test.tsx -t "hash"` runs ≥2 tests)
    - `grep -n "scrollIntoView" "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` matches
    - `grep -n "const isLoading = pageLoading" "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` matches
    - The new `useEffect` line number is lower than the line containing `notFound()` in that file
  </acceptance_criteria>
  <done>Row deep links land on the mark; section page behaviour otherwise unchanged.</done>
</task>

</tasks>

<verification>
`cd apps/dispatch-control && pnpm exec vitest run __tests__/IssueHome.test.tsx __tests__/IssueHomeView.test.tsx __tests__/homeSections.test.ts __tests__/publishChain.test.ts __tests__/homeRoute.test.ts __tests__/SectionReaderPage.test.tsx` green and `pnpm --filter dispatch-control build` exits 0.
</verification>

<success_criteria>
`/` serves the live front door through the locked resolution path; old URLs intact; deep links scroll to the problem.
</success_criteria>

<output>
After completion, create `.planning/phases/52-issue-the-front-door/52-04-SUMMARY.md`
</output>
