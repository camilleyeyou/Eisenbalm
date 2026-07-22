---
phase: quick-260721-pmn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/dispatch-control/__tests__/WorkspaceApprovalPanelLoop.test.tsx
  - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx
autonomous: true
requirements: [QUICK-260721-pmn]

must_haves:
  truths:
    - "The /issues/[n]/approval page no longer pegs the main thread — clicks register (no self-sustaining setPanelContent render loop)."
    - "ApprovalPanelPublisher's setPanelContent effect settles: after mount + one legitimate publish, it stops re-firing on its own."
    - "The same latent loop in FactCheckPanelContent (depends on ws.claimRows) is fixed by the same provider change."
    - "WorkspaceStateProvider hands out referentially-stable claimRows / tasks / stages / signOffs / sectionStates / workMinutes across renders when the underlying Convex query results are unchanged."
  artifacts:
    - path: "apps/dispatch-control/__tests__/WorkspaceApprovalPanelLoop.test.tsx"
      provides: "Bounded-settle regression: mounting the real provider + real ApprovalPanelPublisher with stable Convex fixtures + a content run does not loop"
      contains: "getDraft"
    - path: "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx"
      provides: "Identity-memoized claimRows + derivation block + stabilized signOffs fallback"
      contains: "useMemo"
  key_links:
    - from: "WorkspaceStateProvider derivation (claimRows/tasks/stages/signOffs)"
      to: "ApprovalPanelPublisher useMemo/useEffect deps [ws.signOffs, ws.claimRows, ws.tasks, ws.held]"
      via: "stable identities → content memo stable → setPanelContent not re-called → provider does not re-render in a cycle"
      pattern: "useMemo"
---

<objective>
Kill the production-facing infinite render loop on `/issues/[n]/approval` (dead clicks / pegged main thread) by memoizing the identity-unstable derived values in `WorkspaceStateProvider` so stage context-panel publishers stop re-firing `setPanelContent` on every render.

Purpose: `ApprovalPanelPublisher` publishes JSX into the frame's single `ContextPanel` slot via `useEffect(() => setPanelContent(content), [content, setPanelContent])`. `content` is a `useMemo` over `[ws.signOffs, ws.claimRows, ws.tasks, ws.held]`. The provider currently returns a FRESH `claimRows` (`claimRowsRaw?.map(...)`) and FRESH `tasks`/`stages` (`deriveTasks`/`deriveStageStates` allocate new arrays) on every render — even when the raw Convex results are unchanged. Because `panelContent` is provider state, `setPanelContent` re-renders the provider → fresh derived identities → `content` memo recomputes → effect re-fires → forever. This is a passive-effect loop (React never throws "Maximum update depth exceeded"), so it silently pins the main thread. `FactCheckPanelContent` has the identical latent loop (deps `[ws.claimRows]`).

Fix in ONE place — the provider — so all consumers benefit. Do NOT touch the publisher effect contracts; they are correct once identities are stable.

Output: a RED-first bounded-settle regression test + the memoization fix in the provider.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx
@apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent.tsx
@apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPanelContent.tsx
@apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx
@apps/dispatch-control/__tests__/WorkspaceDraftLoadLoop.test.tsx
@apps/dispatch-control/__tests__/WorkspaceContextPanelSlot.test.tsx
@apps/dispatch-control/lib/derivedState.ts

<verified_diagnosis>
Do NOT re-derive — verified this session:
- Loop engine: `ApprovalPanelPublisher` (ApprovalPanelContent.tsx:89-127). `readiness` memo deps `[ws.signOffs, ws.claimRows, ws.tasks, ws.held]` → `content` memo → `useEffect([content, setPanelContent])` calls `setPanelContent(content)`.
- Unstable provider identities (WorkspaceStateProvider.tsx):
  - `claimRows` = `claimRowsRaw?.map(...)` (~L224) — fresh array every render once resolved (even `[]`).
  - `tasks` = `deriveTasks(derivationInputs)` (~L266), `stages` = `deriveStageStates(...)` (~L265) — `derivedState.ts` returns fresh arrays/tuples every call (`deriveTasks` `return []` at L440 is also fresh).
  - `signOffs` `{}` branch (~L222, `runId === null`) — fresh object each render.
- `setPanelContent` mutates `panelContent` state IN the provider (~L333) → provider re-render → fresh identities → loop.
- FactCheckPanelContent.tsx:85-90 = same latent loop on `[ws.claimRows]`.
- NOT affected: Draft/Voice publishers depend on `ws.qaFindings` (raw useQuery result, referentially stable). getToken churn (561dad5 / quick 260721-ohu) is a SEPARATE already-fixed loop — leave the getDraft effect's `[runId]`-only deps unchanged.
</verified_diagnosis>

<test_harness_notes>
- `.test.tsx` files auto-run in jsdom (vitest.config.ts environmentMatchGlobs `['__tests__/*.test.tsx', 'jsdom']`) — no per-file override needed.
- Mirror the mock block in `WorkspaceContextPanelSlot.test.tsx` / `WorkspaceDraftLoadLoop.test.tsx` VERBATIM: mocks for `next/navigation`, `@clerk/nextjs`, `@/lib/contentPatchClient`, `@convex/_generated/api`, `convex/react`.
- CRITICAL DIVERGENCE from those two harnesses: `fixtureFor` MUST return STABLE (memoized, module-level-cached) references per query-ref string — NOT a fresh `[]`/`{}` each call. This models Convex's real referential stability. The loop is driven by the provider's fresh `.map()`/`deriveTasks()` over STABLE raw inputs; an input-keyed memo only breaks the loop when raw inputs are stable. A churning-raw fixture would neither reproduce reality nor ever go green post-fix.
- `ApprovalPanelPublisher` mounts `DecisionLog`, which calls `useQuery(api.auditLog.listDecisions, ...)` and (via a child) `useQuery(api.users.byClerkUserId, ...)`. The api mock MUST include `auditLog: { listDecisions: 'auditLog:listDecisions' }` and `users: { byClerkUserId: 'users:byClerkUserId' }` or accessing `.listDecisions` on an undefined namespace throws. They can resolve to `undefined` (default) — DecisionLog degrades to its loading/empty state, irrelevant to this test.
- Assertion style (from WorkspaceDraftLoadLoop.test.tsx): render, settle a BOUNDED window via `await new Promise(r => setTimeout(r, 50))` NOT wrapped in `act()` (an act()-wrapped await chases the infinite flush and HANGS the runner), then assert.
</test_harness_notes>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — bounded-settle regression proving the Approval panel loop</name>
  <files>apps/dispatch-control/__tests__/WorkspaceApprovalPanelLoop.test.tsx</files>
  <behavior>
    - Mount the REAL `IssueWorkspaceLayout` (which mounts the REAL `WorkspaceStateProvider` + `FrameChrome`) with the REAL `ApprovalPanelPublisher` AND a render-counter probe as its children (the `{children}` canvas slot).
    - Fixtures resolve a run (`pipelineRuns:byIssueNumber` → `{ runId: 'run-7', startedAt: ... }`), `signOffs` → `{}`, `claimChecks:listByRunId` → a non-empty content array (e.g. one pending claim), `runs:byRunId` → `{ status: 'complete' }`, `getDraft` → a resolved (content or empty) draft. All query fixtures returned as STABLE cached references (see test_harness_notes).
    - Probe: `let probeRenders = 0; function RenderProbe(){ probeRenders++; return null }`. Reset `probeRenders = 0` at test start (after render settles is fine; simplest is reset in the test body just before the settle window, or a module counter cleared in beforeEach).
    - Settle a bounded 50ms window WITHOUT `act()`, then assert `probeRenders` stays below a small bound (e.g. `≤ 20`).
    - Pre-fix: `setPanelContent` re-fires every render → provider re-renders in a tight cycle → `probeRenders` reaches hundreds+ over 50ms → assertion FAILS (proves the loop). Post-fix: a handful of renders → PASSES.
  </behavior>
  <action>
    Create `apps/dispatch-control/__tests__/WorkspaceApprovalPanelLoop.test.tsx`. Copy the mock scaffolding from `WorkspaceContextPanelSlot.test.tsx` VERBATIM with these changes:
    1. `next/navigation` `usePathname` → `'/issues/7/approval'` (Approval stage).
    2. Extend the `@convex/_generated/api` mock to ALSO include `auditLog: { listDecisions: 'auditLog:listDecisions' }` and `users: { byClerkUserId: 'users:byClerkUserId' }` (DecisionLog, mounted by ApprovalPanelPublisher, subscribes to these — without the namespaces the mock throws on property access).
    3. Make `fixtureFor` return STABLE references: build a module-level `const FIXTURE_CACHE = new Map<unknown, unknown>()` and have `fixtureFor(ref)` compute-once-then-cache per ref (or define the fixture objects as module-level consts and return the same reference each call). `claimChecks:listByRunId` → a stable single-element array e.g. `[{ _id: 'c1', status: 'pending', text: 'A claim', sourceUrl: undefined, sectionName: 'originStory', claimIndex: 0, claimId: 'c1', importance: 'Supporting', changedSinceCheck: false, conflict: false, checkedAt: undefined }]`. Keep `signOffs` → stable `{}`, `pitchLog:byRunId` → stable `[{ selected: true }]`, `runs:byRunId` → stable `{ status: 'complete' }`, `issues:byIssueNumber` → stable `{ held: false, published: false }`, `pipelineRuns:byIssueNumber` → stable `{ runId: 'run-7', startedAt: <fixed> }`, `pipelineRuns:listByIssueNumber` → stable `[]`. Clear the cache (or it's fine to keep — refs are constant) each run; simplest is module-level consts so `vi.clearAllMocks()` in beforeEach doesn't touch them.
    4. `getDraft` mock → `vi.fn().mockResolvedValue({ sections: {}, bonus: null, game: null, podcast: null, conversation: null, theme: null })` (draft resolution is not the loop driver here; a resolved value keeps the provider effect quiet).
    5. Import the REAL `ApprovalPanelPublisher` default export from `../app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent` and the layout default from `../app/(dashboard)/issues/[issueNumber]/layout`.
    6. Module-level `let probeRenders = 0` + `function RenderProbe(){ probeRenders++; return null }`. In `beforeEach` (or the test) reset `probeRenders = 0` AND `vi.clearAllMocks()` + re-wire `useQuery`/`useMutation` mocks (mirror the sibling files).
    7. Render `<IssueWorkspaceLayout><ApprovalPanelPublisher /><RenderProbe /></IssueWorkspaceLayout>`. Optionally sanity-assert the panel published (e.g. `await screen.findByText(/Voice/i)` or a readiness label) to confirm the loop-prone path executed.
    8. `await new Promise(resolve => setTimeout(resolve, 50))` (NO `act()`), then `expect(probeRenders).toBeLessThanOrEqual(20)`.

    Include a header comment (mirror WorkspaceDraftLoadLoop.test.tsx's) documenting: the loop mechanism, WHY fixtures must be stable, WHY the settle window is not act()-wrapped, and the pre-fix vs post-fix expectation.

    Run the test and CONFIRM IT FAILS (probeRenders far exceeds 20). This is the RED gate — do not proceed to Task 2 until RED is confirmed. If it does not hang: good (the bounded-window-without-act pattern is exactly what prevents a hang while still capturing the runaway render count).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control test -- WorkspaceApprovalPanelLoop 2>&1 | tail -30</automated>
  </verify>
  <done>Test file exists and FAILS pre-fix (probeRenders >> 20), proving the loop; the runner does not hang (bounded settle window).</done>
</task>

<task type="auto">
  <name>Task 2: GREEN — memoize the identity-unstable derived values in WorkspaceStateProvider</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx</files>
  <action>
    Stabilize the four identity-unstable outputs so consumers' effect deps stop churning. Add `useMemo` to the existing React import (`import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'`).

    1. Stable empty sign-offs fallback: add a module-level `const EMPTY_SIGNOFFS: DerivationInputs['signOffs'] = {}` (top-level, above the component). Change the `signOffs` computation (~L222) to use it:
       `const signOffs = !runLookupResolved ? undefined : runId === null ? EMPTY_SIGNOFFS : signOffsRaw`
       (was an inline `{}` fresh each render; now a stable reference.)

    2. Memoize `claimRows` (~L224) keyed on the raw query result ONLY:
       `const claimRows = useMemo(() => claimRowsRaw?.map(row => ({ ... })), [claimRowsRaw])`
       Keep the exact same mapped fields (_id, status, sourceUrl, sectionName, claimText: row.text, claimIndex, claimId, importance, changedSinceCheck, conflict, checkedAt). `claimRowsRaw` is a stable Convex `useQuery` result between data changes, so `claimRows` becomes stable too.

    3. Memoize the derivation block (~L243-267) into ONE `useMemo` computing `{ derivationInputs, status, stages, tasks, workMinutes }`:
       ```
       const { derivationInputs, status, stages, tasks, workMinutes } = useMemo(() => {
         const derivationInputs: DerivationInputs = { /* unchanged fields */ }
         const tasks = deriveTasks(derivationInputs)
         return {
           derivationInputs,
           status: deriveIssueStatus(derivationInputs),
           stages: deriveStageStates(derivationInputs),
           tasks,
           workMinutes: estimateWorkMinutes(tasks),
         }
       }, [n, runId, issue, signOffs, claimRows, qaFindings, pitchRows, runRow])
       ```
       Deps are the stable raw inputs (+ the now-memoized `signOffs`/`claimRows`). `runRow` covers both `runStatus: runRow?.status` and `runCompletedAt: runRow?.completedAt`. Keep every `derivationInputs` field exactly as-is (issueNumber, runId, issue normalization, signOffs, claimRows, qaFindings, pitchRows, runStatus, runCompletedAt).

    4. Memoize `sectionStates` (~L325) keyed on the now-stable `derivationInputs` + `draft`:
       ```
       const sectionStates = useMemo(
         () => draft ? deriveSectionStates(derivationInputs, draftSectionIdsFromDraft(draft)) : undefined,
         [derivationInputs, draft],
       )
       ```

    DO NOT change: the getDraft `useEffect` (`[runId]`-only deps — quick 260721-ohu, leave the eslint-disable and comment), the panel-content slot state, the publisher effect contracts, or the exposed `value` object shape/fields. The `value` literal may stay freshly-allocated each render — the loop breaks because the load-bearing array/object FIELDS (claimRows, tasks, stages, signOffs, sectionStates, workMinutes) are now referentially stable, which is what the publisher memos/effects depend on.

    Add a short comment above the memoized derivation block noting it fixes the Approval/FactCheck setPanelContent loop (quick 260721-pmn): fresh `.map()`/`deriveTasks()` identities over stable raw inputs re-fired `setPanelContent` → provider re-render → cycle.

    Then run the RED test (now GREEN), the full dispatch-control suite (no regressions — WorkspaceDraftLoadLoop, WorkspaceContextPanelSlot, StageContextPanels, WorkspaceOutline*, FactCheckScreen must still pass), and the STRICT Next build (vitest does NOT type-check — per CLAUDE.md/memory, a frontend fix is not done until `next build` passes on Linux-parity strict compile).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control test 2>&1 | tail -30 && NEXT_PUBLIC_CONVEX_URL=https://modest-magpie-797.convex.cloud pnpm --filter dispatch-control build 2>&1 | tail -25</automated>
  </verify>
  <done>WorkspaceApprovalPanelLoop test passes (probeRenders ≤ 20); the full dispatch-control vitest suite passes with no regressions; `next build` completes with no type errors. The Approval and FactCheck panel publishers settle after one legitimate publish.</done>
</task>

</tasks>

<verification>
- RED confirmed before the fix (Task 1 fails), GREEN after (Task 2 passes) — the RED→GREEN transition is the proof the fix addresses the real loop, not a mock artifact.
- Full `pnpm --filter dispatch-control test` green (no regression in the sibling loop/panel/outline/factcheck tests).
- `NEXT_PUBLIC_CONVEX_URL=... pnpm --filter dispatch-control build` green (strict type-check — the mandatory pre-done gate for frontend work).
- Manual smoke (optional, not required for done): `/issues/[n]/approval` for a content-bearing run registers clicks (main thread not pinned).
</verification>

<success_criteria>
- `WorkspaceStateProvider` returns referentially-stable `claimRows`, `tasks`, `stages`, `signOffs`, `sectionStates`, `workMinutes` when the underlying Convex query results are unchanged.
- `ApprovalPanelPublisher` and `FactCheckPanelPublisher` publish once and settle — no self-sustaining `setPanelContent` re-render loop.
- Bounded-settle regression test guards the behavior; vitest suite + strict Next build both pass.
</success_criteria>

<output>
After completion, create `.planning/quick/260721-pmn-fix-approval-stage-setpanelcontent-infin/260721-pmn-SUMMARY.md`
</output>
</output>
