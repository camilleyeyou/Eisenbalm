---
quick: 260721-ohu
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [OHU-01]
files_modified:
  - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx
  - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx
  - apps/dispatch-control/app/(dashboard)/issues/page.tsx
  - apps/dispatch-control/__tests__/WorkspaceDraftLoadLoop.test.tsx

must_haves:
  truths:
    - "A content-having review page (draft-load fetch resolves to content) renders once and stays interactive — no infinite refetch/re-render loop, even when Clerk's getToken reference churns on every render."
    - "The authoritative-draft fetch still refetches when the run (runId) changes — runId stays a reactive dependency at every site."
    - "reloadDraft in both RunViews stays callable from the accept / revision_mismatch refetch paths after the deps change (Pitfall 1 preserved)."
    - "Full dispatch-control vitest suite is green AND the Next build compiles (vitest does not type-check)."
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx"
      provides: "Draft-load useEffect deps reduced to [runId] (getToken dropped, eslint-disabled + justified)"
      contains: "}, [runId])"
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx"
      provides: "reloadDraft useCallback deps reduced to [runId] (getToken dropped)"
      contains: "}, [runId])"
    - path: "apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx"
      provides: "reloadDraft useCallback deps reduced to [runId] (getToken dropped)"
      contains: "}, [runId])"
    - path: "apps/dispatch-control/__tests__/WorkspaceDraftLoadLoop.test.tsx"
      provides: "Loop-bound regression: churning getToken + content getDraft ⇒ getDraft called exactly once"
      contains: "toHaveBeenCalledTimes(1)"
  key_links:
    - from: "WorkspaceStateProvider draft-load effect"
      to: "getDraft"
      via: "fires once per runId, not per render"
      pattern: "\\[runId\\]"
    - from: "WorkspaceDraftLoadLoop.test.tsx"
      to: "getDraft mock"
      via: "bounded call-count assertion under churning getToken"
      pattern: "toHaveBeenCalledTimes\\(1\\)"
---

<objective>
Content-having review pages (e.g. `/issues/999606/approval`) freeze with dead
clicks. Root cause (diagnosed, do NOT re-investigate): the authoritative
draft-load effect depends on Clerk's `getToken`. `getToken` is USUALLY
referentially stable but churns (new reference) under auth-state changes /
token refresh / dev-instance rate-limiting (the runaway Publisher webhook loop
earlier today hammered Clerk's dev instance). When its reference churns, the
draft-load effect refires every render; on a CONTENT run `getDraft` succeeds
and `setDraft(result)` stores a FRESH object → React re-renders → effect
refires → infinite loop → pinned main thread → dead clicks. Contentless runs
`setDraft(null)` when already null → React bails → no loop (why paused
`/issues/999607/approval` works but content `/issues/999606/approval` freezes).

Fix: at each draft-load site, stop `getToken`'s reference identity from being a
reactive trigger, WITHOUT changing correctness — `getToken` is still called
FRESH inside the async fn and always returns a current valid token regardless
of which reference was captured (standard Clerk-in-useEffect guidance). Keep
`runId` reactive so the draft still refetches on run change.

Purpose: Unfreeze content review/approval pages.
Output: 3 source files with corrected effect/callback deps + 1 new
loop-bound regression test. Frontend/dispatch-control ONLY.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@./CLAUDE.md

<interfaces>
<!-- Anchors verified against current master (post ac3b5aa / quick 260720-ig5). -->
<!-- Executor: apply the deps change ONLY; do NOT touch effect/callback bodies. -->

WorkspaceStateProvider.tsx — draft-load effect (lines 284-316):
```tsx
  useEffect(() => {
    if (runId === null) {
      setDraft(null)
      setDraftContentAbsent(false)
      return
    }
    let cancelled = false
    setDraftContentAbsent(false)
    async function load() {
      try {
        const token = await getToken()              // called FRESH — stays
        const result = await getDraft(runId as string, token)
        if (!cancelled) {
          setDraft(result)                          // fresh object every fetch
          setDraftContentAbsent(false)
        }
      } catch (e) {
        if (!cancelled) {
          setDraft(null)
          setDraftContentAbsent(e instanceof ContentPatchError && e.reason === 'no_sanity_issue')
          void (e instanceof ContentPatchError ? e.message : e instanceof Error ? e.message : e)
        }
      }
    }
    void load()
    return () => { cancelled = true }
  }, [runId, getToken])                             // <-- CHANGE THIS LINE ONLY
```

ReviewDeskRunView.tsx — reloadDraft useCallback (lines 335-350) + mount effect
(352-363). reloadDraft is ALSO passed as a prop and reused after accept /
revision_mismatch: `reloadDraft={reloadDraft}` (line 516) and
`onApplied={reloadDraft}` (line 584) — Pitfall 1: must stay callable.
```tsx
  const reloadDraft = useCallback(async () => {
    setError(null)
    try {
      const token = await getToken()
      const result = await getDraft(runId, token)
      setDraft(result)
    } catch (e) { setError(/* ... */) }
  }, [runId, getToken])                             // <-- CHANGE THIS LINE ONLY

  useEffect(() => {                                 // leave unchanged
    let cancelled = false
    async function load() { setLoading(true); await reloadDraft(); if (!cancelled) setLoading(false) }
    void load()
    return () => { cancelled = true }
  }, [reloadDraft])
```

VoicePassRunView.tsx — reloadDraft useCallback (lines 160-175) + mount effect
(177-188), identical structure; reloadDraft reused at `reloadDraft={reloadDraft}`
(294) and `onApplied={reloadDraft}` (326). Same one-line deps change at line 175.
NOTE: VoicePass has a SECOND `getToken` call at line ~207 (deep-check re-run) —
that is NOT a draft-load effect dep; do NOT touch it.

issues/page.tsx — repetition-note effect (lines 202-220), deps `[getToken]` BUT
guarded by a `noteFetchedRef` one-shot ref (line 203 early-return). Already
safe/no-op on refire — the PRECEDENT the codebase already knows getToken can
refire effects. NOT the bug; do NOT change its deps.

Test harness to mirror: __tests__/WorkspaceOutlineEmptyState.test.tsx already
renders the REAL WorkspaceStateProvider via `IssueWorkspaceLayout`, mocking
next/navigation, @clerk/nextjs (useAuth().getToken), @convex/_generated/api,
convex/react (useQuery/useMutation), and @/lib/contentPatchClient (getDraft +
ContentPatchError). Its header comment (lines 42-59) documents that it
DELIBERATELY uses a STABLE module-scoped getToken because a fresh-per-render
getToken retriggers this exact effect — the direct evidence for this bug.
The new test does the OPPOSITE: a CHURNING getToken.

Any `.test.tsx` in `__tests__/` auto-runs under jsdom (vitest.config.ts:66).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — loop-bound regression test (churning getToken + content ⇒ getDraft called once)</name>
  <files>apps/dispatch-control/__tests__/WorkspaceDraftLoadLoop.test.tsx</files>
  <behavior>
    - Renders the REAL WorkspaceStateProvider (via `IssueWorkspaceLayout`), mirroring
      WorkspaceOutlineEmptyState.test.tsx's mock harness VERBATIM (same
      next/navigation useParams `{ issueNumber: '7' }` + Draft pathname, same
      @convex/_generated/api map, same convex/react useQuery/useMutation mocks,
      same `fixtureFor` that resolves a run so runId === 'run-7' and the
      draft-load effect actually fires).
    - DIVERGENCE 1 (the churn): `@clerk/nextjs` `useAuth()` returns a NEW
      `getToken` reference on EVERY call — `useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') })`
      (a fresh vi.fn per render, NOT a module-scoped stable one). This simulates
      Clerk's dev-instance reference churn.
    - DIVERGENCE 2 (content path): `@/lib/contentPatchClient` `getDraft` uses
      persistent `mockResolvedValue` (NOT `*Once`) resolving to a run WITH
      content, e.g. `{ sections: { originStory: { blocks: [{ type: 'paragraph', text: 'x' }], lossy: false } }, bonus: null, game: null, podcast: null, conversation: null, theme: null }`.
      Persistent (not Once) so every loop firing pre-fix resolves identically —
      same rationale as the sibling test's header comment.
    - ASSERTION (loop-bound): after render, settle a BOUNDED window
      (`await new Promise(r => setTimeout(r, 50))` — do NOT wrap this settle in
      `act()`, which could chase an infinite effect flush and hang), then assert
      `expect(getDraft).toHaveBeenCalledTimes(1)`.
        · Pre-fix: the effect deps `[runId, getToken]` refire on every churned
          render → over the 50ms window getDraft is called MANY times (>1) →
          assertion FAILS (proves the loop). No hang: we assert after a fixed
          window, we never wait for the loop to stop.
        · Post-fix: deps `[runId]`, runId constant → effect fires exactly once;
          the single `setDraft(content)` re-render does not refire it → getDraft
          called exactly once → PASSES.
    - Optionally also assert the content outline row renders
      (`await screen.findByTestId('outline-row-originStory')`) as a sanity that
      the CONTENT path (the loop-prone path) was exercised — place this BEFORE
      the settle+count assertion if included.
  </behavior>
  <action>
    Create `apps/dispatch-control/__tests__/WorkspaceDraftLoadLoop.test.tsx`.
    Copy the mock harness from `__tests__/WorkspaceOutlineEmptyState.test.tsx`
    (imports, next/navigation mock, @convex/_generated/api map, convex/react
    mock, ContentPatchError stub, `fixtureFor`, `beforeEach`/`afterEach`,
    `renderWorkspace`) and change ONLY the two divergences above:
      1. `@clerk/nextjs` mock returns a fresh `getToken` per `useAuth()` call
         (churn) — inline `vi.fn(async () => 'tok-clerk')` inside the factory.
      2. Single test: `getDraft` `mockResolvedValue(<content>)`; render; settle
         50ms (unwrapped); `expect(getDraft).toHaveBeenCalledTimes(1)`.
    Add a header docblock stating this is the quick-260721-ohu loop regression,
    that it is the mirror of WorkspaceOutlineEmptyState.test.tsx but with a
    CHURNING getToken, and WHY the assertion is a bounded call-count (pre-fix
    many, post-fix one).

    RED gate: run this test file against CURRENT (pre-fix) source and CONFIRM it
    FAILS (getDraft called >1 / the count assertion blows up). If — and only if —
    the infinite loop proves impossible to assert deterministically in jsdom
    (e.g. it hangs the runner rather than producing a countable >1), fall back
    to the documented alternative: assert dependency behavior by comparing a
    STABLE getToken ref (getDraft once) vs a CHURNING one and assert the churn
    does NOT increase the count post-fix — and record in the commit body WHY the
    direct loop-bound assertion was infeasible. PREFER the direct call-count
    assertion.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control test -- WorkspaceDraftLoadLoop 2>&1 | tail -30</automated>
  </verify>
  <done>New test file exists and FAILS against pre-fix source (demonstrates the loop: getDraft called more than once). RED confirmed before Task 2.</done>
</task>

<task type="auto">
  <name>Task 2: GREEN — drop getToken from the three draft-load deps; note issues/page is already safe</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx, apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx, apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx, apps/dispatch-control/app/(dashboard)/issues/page.tsx</files>
  <action>
    Apply the MINIMAL deps change at each draft-load site. Do NOT touch any
    effect/callback BODY, the 260720-ig5 `draftContentAbsent` logic, the getToken
    CALL sites (calling `getToken()` inside the async fn is correct and stays),
    the mount effects, DecisionRail, or any non-draft-load effect. Do NOT remove
    `runId` from any deps (the draft MUST refetch on run change).

    1. WorkspaceStateProvider.tsx (PRIMARY) — the draft-load `useEffect`
       currently `}, [runId, getToken])` (line ~316). Change to `}, [runId])`
       preceded by an `// eslint-disable-next-line react-hooks/exhaustive-deps`
       and a short comment: getToken (Clerk) is a stable accessor called FRESH
       inside load() and always returns a current token regardless of captured
       reference; including its identity caused an infinite refetch/re-render
       loop on CONTENT runs (setDraft stores a fresh object every fetch) — quick
       260721-ohu. Depend on runId ONLY.

    2. ReviewDeskRunView.tsx — the `reloadDraft` `useCallback` currently
       `}, [runId, getToken])` (line ~350). Change to `}, [runId])` with the
       same eslint-disable + comment. CHOSEN APPROACH (justify in the comment):
       drop getToken from the useCallback deps rather than the mount effect,
       because the churn enters through reloadDraft's identity (mount effect
       depends on `[reloadDraft]`). Removing getToken makes reloadDraft
       stable-per-runId, which BOTH breaks the churn loop AND preserves Pitfall
       1 — reloadDraft is still reused via `reloadDraft={reloadDraft}` (line
       ~516) and `onApplied={reloadDraft}` (line ~584) for the accept /
       revision_mismatch refetch. Leave the mount effect `[reloadDraft]`
       unchanged.

    3. VoicePassRunView.tsx — the `reloadDraft` `useCallback` currently
       `}, [runId, getToken])` (line ~175). Same change as ReviewDeskRunView
       (drop getToken, `}, [runId])`, eslint-disable + comment). Leave the mount
       effect `[reloadDraft]` and the SECOND getToken usage (~line 207,
       deep-check re-run) untouched.

    4. issues/page.tsx — the repetition-note effect (deps `[getToken]`, line
       ~220) is already guarded by `noteFetchedRef` (one-shot). Do NOT change its
       deps (no risk-introduction). Add ONE brief comment above the effect noting
       it is intentionally safe against getToken churn via the `noteFetchedRef`
       one-shot guard (the precedent for quick 260721-ohu) — comment only, no
       behavior change. MY CALL: comment-only, deps untouched.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control test 2>&1 | tail -20 && NEXT_PUBLIC_CONVEX_URL=https://modest-magpie-797.convex.cloud pnpm --filter dispatch-control build 2>&1 | tail -15</automated>
  </verify>
  <done>Task 1's loop test now PASSES (getDraft called exactly once under churn). Full `pnpm --filter dispatch-control test` green AND `NEXT_PUBLIC_CONVEX_URL=... pnpm --filter dispatch-control build` exits 0. All three draft-load deps are `[runId]` with justified eslint-disable; runId retained everywhere; reloadDraft still passed as prop at both reuse sites.</done>
</task>

</tasks>

<verification>
- Task 1 test fails pre-fix (proves the loop), passes post-fix (getDraft called exactly once under a churning getToken + content response).
- Existing tests unchanged and green — especially WorkspaceOutlineEmptyState.test.tsx / WorkspaceLayout.test.tsx / WorkspaceContextPanelSlot.test.tsx / review-desk-editors.test.tsx.
- Both mandatory gates pass: `pnpm --filter dispatch-control test` green AND `NEXT_PUBLIC_CONVEX_URL=https://modest-magpie-797.convex.cloud pnpm --filter dispatch-control build` exit 0.
- Grep confirms every affected draft-load deps array is `[runId]` and no `runId` was removed anywhere.
</verification>

<success_criteria>
- Content-having review/approval pages no longer freeze: the draft-load effect
  fires once per runId even when getToken's reference churns.
- Correctness preserved: getToken still called fresh inside each async fn;
  draft still refetches when runId changes; reloadDraft still callable from the
  accept / revision_mismatch refetch paths.
- Atomic commits: Task 1 (test, RED) and Task 2 (fix, GREEN) as separate commits.
  Executor does NOT push/deploy (Vercel deploys on push).
</success_criteria>

<output>
After completion, create `.planning/quick/260721-ohu-fix-infinite-render-loop-on-content-revi/260721-ohu-SUMMARY.md`.

Note: do NOT run `node gsd-tools.cjs state record-session` for this quick task
(it corrupts STATE.md here — hand-edit if a state note is needed).
</output>
