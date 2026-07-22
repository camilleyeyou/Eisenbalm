---
quick: 260721-ohu
type: execute
status: complete
requirements: [OHU-01]
completed: 2026-07-21
---

# Quick 260721-ohu: Fix infinite render loop on content review pages Summary

Dropped Clerk's `getToken` from three draft-load reactive dependency arrays (kept `runId`), stopping an infinite refetch/re-render loop that froze content-having review/approval pages.

## What Happened

Content-having review pages (e.g. `/issues/999606/approval`) froze with dead clicks. Root cause: the authoritative draft-load effect/callback in `WorkspaceStateProvider`, `ReviewDeskRunView`, and `VoicePassRunView` all depended on `[runId, getToken]`. Clerk's `getToken` is usually referentially stable but churns (new reference) under auth-state changes / token refresh / dev-instance rate-limiting (the runaway Publisher webhook loop from quick 260720-gic earlier hammered Clerk's dev instance). When it churns, the draft-load effect refires every render; on a CONTENT run `getDraft` succeeds and `setDraft(result)` stores a fresh object → React re-renders → effect refires → infinite loop → pinned main thread → dead clicks. Contentless runs don't loop (`setDraft(null)` when already `null` is a React bail-out) — this explains why paused/contentless approval pages worked but content-bearing ones froze.

Fix: at each draft-load site, `getToken`'s reference identity was removed as a reactive trigger, without changing correctness — `getToken()` is still called fresh inside each async function and always returns a current valid token regardless of which reference was captured (standard Clerk-in-`useEffect` guidance). `runId` stays reactive everywhere so the draft still refetches on run change.

## Task 1 — RED: loop-bound regression test

Created `apps/dispatch-control/__tests__/WorkspaceDraftLoadLoop.test.tsx`, mirroring `WorkspaceOutlineEmptyState.test.tsx`'s mock harness (same `next/navigation`, `@convex/_generated/api`, `convex/react` mocks, same `fixtureFor` resolving `runId === 'run-7'`) with two divergences:
1. `@clerk/nextjs`'s `useAuth()` returns a NEW `getToken` reference on every call (`vi.fn(async () => 'tok-clerk')` created fresh inside the mock factory) — simulating Clerk's dev-instance reference churn.
2. `getDraft` persistently (`mockResolvedValue`, not `*Once`) resolves to a run WITH content, so every effect firing pre-fix triggers an identical `setDraft`.

Assertion: render, settle a bounded 50ms window (deliberately NOT wrapped in `act()` — an `act()`-wrapped await would chase an infinite effect flush pre-fix and hang the test runner), then assert `getDraft` was called exactly once.

RED confirmed: pre-fix, `getDraft` was called 2 times over the 50ms window (not 1), proving the effect refires under a churning `getToken`. Commit: `e23ceed`.

## Task 2 — GREEN: drop getToken from the three draft-load deps

Applied the minimal deps change at each site, leaving effect/callback bodies, `getToken()` call sites, mount effects, and the 260720-ig5 `draftContentAbsent` logic untouched:

1. **`WorkspaceStateProvider.tsx`** (primary) — draft-load `useEffect` deps `[runId, getToken]` → `[runId]`, with `eslint-disable-next-line react-hooks/exhaustive-deps` + a justification comment.
2. **`ReviewDeskRunView.tsx`** — `reloadDraft` `useCallback` deps `[runId, getToken]` → `[runId]`. Chose the `useCallback` (not the mount effect, which depends on `[reloadDraft]`) because the churn enters through `reloadDraft`'s identity — stabilizing `reloadDraft` per-runId both breaks the loop and preserves `reloadDraft`'s reuse as a prop after accept / `revision_mismatch` refetch (`reloadDraft={reloadDraft}` at ~L525, `onApplied={reloadDraft}` at ~L593 post-comment-insertion).
3. **`VoicePassRunView.tsx`** — same change as ReviewDeskRunView. The second `getToken` usage (deep-check re-run, ~L219) was left untouched.
4. **`issues/page.tsx`** — comment-only addition above the repetition-note effect noting it's already safe against `getToken` churn via the `noteFetchedRef` one-shot guard; deps (`[getToken]`) intentionally unchanged (no risk-introduction).

Task 1's loop test now passes: `getDraft` called exactly once under a churning `getToken`. Both mandatory gates green:
- `pnpm --filter dispatch-control test`: 130 test files passed, 1 skipped (131 total), 1053 tests passed, 2 todo.
- `NEXT_PUBLIC_CONVEX_URL=https://modest-magpie-797.convex.cloud pnpm --filter dispatch-control build`: exits 0, compiles successfully, type-checks pass, all 32 routes generate.

Grep confirmed all three modified deps arrays are `[runId]` (no other `}, [runId, ...])` combos changed) and every `getToken()` call site remains intact. Commit: `561dad5`.

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed as separate atomic commits (RED then GREEN), per success criteria.

## Files Modified

- `apps/dispatch-control/__tests__/WorkspaceDraftLoadLoop.test.tsx` (new)
- `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx`
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx`
- `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx`
- `apps/dispatch-control/app/(dashboard)/issues/page.tsx` (comment only)

## Commits

- `e23ceed` — test(quick-260721-ohu): RED — loop-bound regression for draft-load getToken churn
- `561dad5` — fix(quick-260721-ohu): drop getToken from draft-load reactive deps (keep runId)

## Self-Check: PASSED

- FOUND: apps/dispatch-control/__tests__/WorkspaceDraftLoadLoop.test.tsx
- FOUND: commit e23ceed
- FOUND: commit 561dad5
