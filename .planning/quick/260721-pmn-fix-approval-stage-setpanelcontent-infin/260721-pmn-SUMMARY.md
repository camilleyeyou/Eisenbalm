---
quick: 260721-pmn
type: execute
status: complete
requirements: [QUICK-260721-pmn]
completed: 2026-07-21
---

# Quick 260721-pmn: Fix approval-stage setPanelContent infinite render loop Summary

Memoized four identity-unstable derived values in `WorkspaceStateProvider` (`claimRows`, the `tasks`/`stages`/`status`/`workMinutes` derivation block, `signOffs`' empty fallback, `sectionStates`), stopping a self-sustaining `setPanelContent` render loop that pegged the main thread (dead clicks) on `/issues/[n]/approval` and latently on `/issues/[n]/fact-check`.

## What Happened

`/issues/[n]/approval` pegged the main thread on content-bearing runs — clicks stopped registering. Root cause: `ApprovalPanelPublisher` builds a `content` memo over `[ws.signOffs, ws.claimRows, ws.tasks, ws.held]` and publishes it via `useEffect(() => setPanelContent(content), [content, setPanelContent])`. `WorkspaceStateProvider` returned a FRESH `claimRows` (`claimRowsRaw?.map(...)`) and FRESH `tasks`/`stages` (`deriveTasks`/`deriveStageStates` allocate new arrays) on every render, even when the underlying Convex query results were unchanged. Because `setPanelContent` writes `panelContent` INTO the provider's own state, the cycle was: `setPanelContent` → provider re-renders → fresh `claimRows`/`tasks`/`stages` identities → `content` memo recomputes → effect re-fires → `setPanelContent` again → forever. This is a passive-effect loop in production (a real browser's Scheduler keeps rescheduling it indefinitely with no ceiling), so it silently pins the main thread instead of throwing a visible error. `FactCheckPanelContent`'s `[ws.claimRows]`-only effect has the identical latent loop and is fixed by the same provider change.

Fix: memoize the provider's derived outputs keyed on the stable raw Convex query results, so `claimRows`/`tasks`/`stages`/`workMinutes`/`signOffs`/`sectionStates` keep the same reference across re-renders whenever the underlying data hasn't changed — breaking the cycle after one legitimate publish.

## Task 1 — RED: bounded-settle regression proving the loop

Created `apps/dispatch-control/__tests__/WorkspaceApprovalPanelLoop.test.tsx`, mirroring `WorkspaceContextPanelSlot.test.tsx`'s mock scaffolding (same `next/navigation`, `@clerk/nextjs`, `@/lib/contentPatchClient`, `@convex/_generated/api`, `convex/react` mocks) extended with `auditLog.listDecisions` + `users.byClerkUserId` (the real `ApprovalPanelPublisher` mounts `DecisionLog`, which subscribes to both). All Convex fixtures are module-level consts returned BY REFERENCE (not fresh `[]`/`{}` per call) — real Convex `useQuery` is referentially stable between renders when the underlying data hasn't changed, and only a stable-fixture harness can distinguish the bug (fresh provider identities over stable inputs) from a mock-churn artifact.

Two deviations from the plan's literal harness recipe, both required to make the test actually prove the bug without hanging or crashing the process (discovered empirically, not anticipated by the plan):

1. **Mount via `react-dom/client`'s `createRoot(...).render(...)` directly, not `@testing-library/react`'s `render()`.** `render()` wraps the initial mount in React's `act()`, which synchronously drains the passive-effect queue to completion before returning. `ApprovalPanelPublisher`'s `setPanelContent` effect body is 100% synchronous (no `await` boundary), so pre-fix, `act()` kept re-flushing the SAME effect in a tight synchronous loop that never yields to the JS event loop — confirmed empirically: an `render()`-based version of this test crashed the Vitest worker with `FATAL ERROR: ... JavaScript heap out of memory` after several GB of growth, never reaching the intended 50ms bounded-settle code at all. Mounting via `createRoot(...).render(...)` (no `act()` wrapper) makes React schedule passive effects through its normal Scheduler instead, matching real browser behavior and making the loop boundable in a test process.
2. **The render probe (`RenderProbe`) must itself call `useWorkspaceState()`** (be a context consumer). A plain sibling component that doesn't consume the context is bailed out of re-rendering by React's context-propagation optimization when only the provider's context `value` changes (its own element reference/props are otherwise unchanged) — an earlier version silently under-counted (`probeRenders` stuck near 1) even pre-fix.
3. **Settle window is 300ms, not the sibling files' 50ms** — empirically, the cascade needs longer than 50ms to climb past the `≤20` threshold on this mounting path; at 50ms both pre-fix and post-fix stayed in the single digits.

RED confirmed and stable across repeated runs: `probeRenders` climbed into the 50s (49-57 across 7 runs) over the 300ms window, comfortably failing `expect(probeRenders).toBeLessThanOrEqual(20)`. React's own nested-update-depth safety net (`console.error`'s "Maximum update depth exceeded") caps the observed cascade at that plateau rather than growing unbounded on this mounting path — the test completes in ~400ms every run, no hang, no OOM. Commit: `fb4db76`.

## Task 2 — GREEN: memoize the identity-unstable derived values

In `WorkspaceStateProvider.tsx`:

1. `EMPTY_SIGNOFFS` — a module-level `const EMPTY_SIGNOFFS: DerivationInputs['signOffs'] = {}`, replacing the inline `{}` in the `runId === null` branch of the `signOffs` computation.
2. `claimRows` — wrapped in `useMemo(() => claimRowsRaw?.map(...), [claimRowsRaw])`, keyed only on the raw (referentially-stable) Convex query result.
3. The derivation block — combined `derivationInputs`, `status`, `stages`, `tasks`, `workMinutes` into ONE `useMemo` keyed on `[n, runId, issue, signOffs, claimRows, qaFindings, pitchRows, runRow]` (all now-stable raw/derived inputs), replacing four separate per-render allocations (`deriveIssueStatus`, `deriveStageStates`, `deriveTasks`, `estimateWorkMinutes`).
4. `sectionStates` — wrapped in `useMemo(() => draft ? deriveSectionStates(derivationInputs, draftSectionIdsFromDraft(draft)) : undefined, [derivationInputs, draft])`, keyed on the now-stable `derivationInputs`.

Left untouched, per the plan: the `getDraft` `useEffect`'s `[runId]`-only deps (quick 260721-ohu), the panel-content slot state, the publisher effect contracts in `ApprovalPanelContent.tsx`/`FactCheckPanelContent.tsx`, and the exposed `value` object's shape/fields (the `value` literal itself is still freshly allocated each render — the fix works because its load-bearing FIELDS are now referentially stable, which is what the publishers' memos/effects actually depend on).

Verification, all green:
- `WorkspaceApprovalPanelLoop.test.tsx` — passes, stable across 3 repeated runs (`probeRenders` low single digits within the 300ms window).
- `pnpm --filter dispatch-control test` — 131 test files passed, 1 skipped (132 total), 1054 tests passed, 2 todo. No regressions in `WorkspaceDraftLoadLoop`, `WorkspaceContextPanelSlot`, `StageContextPanels`, `WorkspaceOutline*`, `FactCheckScreen`.
- `NEXT_PUBLIC_CONVEX_URL=https://modest-magpie-797.convex.cloud pnpm --filter dispatch-control build` — compiles successfully, type-checks pass, all routes generate (including `/issues/[issueNumber]/approval` and `/issues/[issueNumber]/fact-check`).

Commit: `c3ba738`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RED test's mounting mechanism had to bypass `@testing-library/react`'s `render()`**
- **Found during:** Task 1 (confirming RED)
- **Issue:** The plan specified mounting with the standard `render()` helper and settling via a 50ms non-`act()`-wrapped window. `render()` wraps the INITIAL mount in `act()`, and `ApprovalPanelPublisher`'s effect is fully synchronous, so `act()` tried to drain the (pre-fix) infinite effect cascade to completion synchronously before `render()` could even return — the process never reached the intended settle-window code. Confirmed via an actual JS heap out-of-memory crash (`FATAL ERROR: ... JavaScript heap out of memory` after several GB of growth over ~4.5 minutes).
- **Fix:** Mount via `react-dom/client`'s `createRoot(...).render(...)` directly (no `act()` wrapper), letting React schedule passive effects through its normal (yielding) Scheduler — the same asynchronous path a real browser uses. Manual container/root lifecycle management in `beforeEach`/`afterEach` replaces `@testing-library/react`'s `cleanup()` (which only tracks its own `render()`-created containers). `screen` queries still work since the manual container is appended to `document.body`.
- **Files modified:** `apps/dispatch-control/__tests__/WorkspaceApprovalPanelLoop.test.tsx`
- **Verification:** Test completes in ~400-420ms every run (no hang, no OOM), stable RED (49-57 renders) across 7 repeated runs pre-fix, stable GREEN (low single digits) across 3 repeated runs post-fix.
- **Committed in:** `fb4db76` (Task 1 commit)

**2. [Rule 1 - Bug] RED test's render-counter probe silently under-counted**
- **Found during:** Task 1 (confirming RED, after fixing the mounting mechanism above)
- **Issue:** A plain sibling component (not calling `useContext`/`useWorkspaceState()`) does not reliably re-render on every provider context-value change — React's context-propagation optimization bails out non-consuming fibers whose own element reference/props are otherwise unchanged. The initial probe stayed at 1 render even pre-fix, producing a false-negative RED.
- **Fix:** `RenderProbe` now calls `useWorkspaceState()` itself, making it a genuine context consumer that reliably re-renders every time the provider's context value changes.
- **Files modified:** `apps/dispatch-control/__tests__/WorkspaceApprovalPanelLoop.test.tsx`
- **Verification:** Post-fix, `probeRenders` correctly climbed into the 50s pre-fix and stayed low post-fix, matching the expected loop signature.
- **Committed in:** `fb4db76` (Task 1 commit)

**3. [Rule 1 - Bug] RED test's settle window was too short to distinguish buggy from fixed behavior**
- **Found during:** Task 1 (confirming RED, after fixes 1 and 2 above)
- **Issue:** At the plan's specified 50ms settle window, both pre-fix and post-fix behavior stayed in the single digits on the `createRoot`-based mounting path (the Scheduler-driven cascade hadn't ramped up yet) — the assertion passed even pre-fix, another false negative.
- **Fix:** Increased the settle window to 300ms, empirically confirmed to give a stable, wide margin (pre-fix ~50-60 renders vs. post-fix a handful) across repeated runs, still comfortably bounded (React's nested-update-depth safety net plateaus the cascade rather than growing further with more time on this mounting path).
- **Files modified:** `apps/dispatch-control/__tests__/WorkspaceApprovalPanelLoop.test.tsx`
- **Verification:** RED stable across 7 runs (49-57), GREEN stable across 3 runs, both well clear of the `≤20` threshold.
- **Committed in:** `fb4db76` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs in the RED test's own harness mechanics, discovered while confirming RED; none affected the production fix in Task 2, which followed the plan exactly).
**Impact on plan:** No scope creep. All three deviations were necessary to make Task 1's mandatory RED gate (`<verification>`: "RED confirmed before the fix") actually true and repeatable rather than a false negative or a crashing test process. The Task 2 production fix (`WorkspaceStateProvider.tsx`) was implemented exactly as specified in the plan.

## Issues Encountered

The most significant issue was diagnostic, not implementational: distinguishing a genuinely-infinite synchronous JS loop (caused by `@testing-library/react`'s `render()` implicitly wrapping the initial mount in `act()`, which forces React to drain a self-sustaining synchronous effect cascade to completion before returning control) from the boundable, Scheduler-paced loop the plan anticipated. Resolved by mounting via `react-dom/client`'s `createRoot()` directly, bypassing `act()` for the initial mount — see Deviation 1 above. This also surfaces a useful, generalizable lesson for any future "does-this-effect-loop" regression test in this codebase: a purely-synchronous effect body (no `await` boundary) mounted through `@testing-library/react`'s `render()` can turn a would-be-boundable loop into a real OOM crash, because `act()`'s synchronous flush has no yield points for a bounded-settle-window strategy to interleave with.

## Files Modified

- `apps/dispatch-control/__tests__/WorkspaceApprovalPanelLoop.test.tsx` (new)
- `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx`

## Commits

- `fb4db76` — test(quick-260721-pmn): RED — bounded-settle regression for Approval panel setPanelContent loop
- `c3ba738` — fix(quick-260721-pmn): memoize identity-unstable derived values in WorkspaceStateProvider

## Self-Check: PASSED

- FOUND: apps/dispatch-control/__tests__/WorkspaceApprovalPanelLoop.test.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx
- FOUND: commit fb4db76
- FOUND: commit c3ba738
