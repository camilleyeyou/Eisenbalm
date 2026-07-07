---
phase: 30-foundation-design-system-chrome-awaiting-you-inbox
plan: 06
subsystem: ui
tags: [convex, react, next-link, dashboard, dispatch-control, useQuery]

# Dependency graph
requires:
  - phase: 30-04
    provides: The 52px ink Masthead shell + the standalone `AwaitingYouTrigger` export left as an insertion seam for this plan's dropdown
provides:
  - "AwaitingYouInbox.tsx: pure-derivation masthead dropdown aggregating unresolved QA errors, open claim sign-offs, awaiting-review runs (incl. Gate-1 interrupts), and the current-cycle failed run"
  - "Masthead wired to open/close the inbox via useState + a relative-positioned anchor + outside-click backdrop"
  - "A documented, scoped-out gap: no Gate-1-vs-awaiting-review distinction exists at the data layer (flagged for Phase 37 Signal Desk)"
affects: [37-run-monitor-v2-signal-desk]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Convex `useQuery(query, 'skip')` conditional-skip pattern for queries scoped to a not-yet-known current-draft runId"
    - "Mock convex/react `useQuery` by dispatching on the (mocked) query-reference string + args, rather than positional `mockReturnValueOnce` sequencing — resilient to child components adding their own queries"

key-files:
  created:
    - apps/dispatch-control/components/AwaitingYouInbox.tsx
    - apps/dispatch-control/__tests__/AwaitingYouInbox.test.tsx
  modified:
    - apps/dispatch-control/components/Masthead.tsx
    - apps/dispatch-control/__tests__/Masthead.test.tsx

key-decisions:
  - "Gate-1 interrupts and full awaiting-review runs are NOT distinguished — both write the same `status: 'awaiting-review'` literal with no cheap distinguishing field, and no resume UI exists anywhere in the dashboard to route a distinguished interrupt to. Followed the existing ReviewQueue.tsx precedent: route every awaiting-review row to /run-monitor/runs/{runId}/review. A dedicated Gate-1 adjudication UI is out of scope here and belongs to Phase 37 (Signal Desk)."
  - "Blockers (unresolved QA errors, open claim sign-offs) are scoped to the current draft only — defined as the first awaiting-review run's runId, since there should only ever be ~1 in flight. A run mid-pipeline or already complete has no 'current draft' to check blockers against, so those queries are skipped ('skip') until a draft run exists."
  - "Rewrote Masthead.test.tsx's useQuery mock from a positional mockReturnValueOnce sequence to a queryRef+args dispatch table — required because AwaitingYouInbox now mounts inside Masthead and issues 4 more useQuery calls than the pre-existing test sequence accounted for; the dispatch-table approach is robust to any future child adding queries."

patterns-established:
  - "Inbox items are rendered as a single ordered list built by pushing category arrays in blockers-first priority order (QA errors > sign-offs > awaiting-review > failed), rather than 4 separately-styled sections — keeps the 'blockers first' requirement mechanically enforced by array push order."

requirements-completed: [CHR-04]

# Metrics
duration: ~20min
completed: 2026-07-07
---

# Phase 30 Plan 06: Awaiting-You Inbox Summary

**Masthead dropdown aggregating 4 "blocked on a human" categories (unresolved QA errors, open claim sign-offs, awaiting-review runs, current-cycle failed run) purely from existing Convex queries — zero new backend.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `AwaitingYouInbox.tsx` derives all 4 categories client-side from `runs.listForWorkspace`, `runs.latest`, `qaCorrections.byRunId`, and `claimChecks.allSignedOff` — no new Convex table, mutation, or dismiss/snooze state (verified by a source-scan test asserting zero `mutation(` calls)
- Items render blockers-first (unresolved error QA findings → open sign-offs → awaiting-review runs → the current-cycle failed run), each a `next/link` to the working screen it can be resolved on (`/run-monitor/runs/{runId}/review` or `/run-monitor/runs/{runId}`), closing the dropdown on click
- `Masthead.tsx` wires the dropdown to the existing `AwaitingYouTrigger` chip via `useState`, a `relative` anchor container, and a full-screen transparent backdrop that closes the inbox on outside click
- Full dispatch-control suite green (30 files / 242 tests, 2 pre-existing todos unrelated to this plan) and `pnpm --filter dispatch-control build` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: AwaitingYouInbox.tsx — pure-derivation dropdown, blockers-first** - `c69e4ea` (test)
2. **Task 2: Wire the inbox dropdown into the masthead trigger** - `b154c49` (feat)

## Files Created/Modified
- `apps/dispatch-control/components/AwaitingYouInbox.tsx` - Client component deriving + rendering the 4 inbox categories from existing Convex queries
- `apps/dispatch-control/__tests__/AwaitingYouInbox.test.tsx` - Behavior tests (all 4 categories, ordering, empty state, onClose-on-navigate) + a source-scan tripwire for D-09 (no `mutation(` calls)
- `apps/dispatch-control/components/Masthead.tsx` - Adds `useState` open/close, a `relative` anchor wrapping `AwaitingYouTrigger` + `AwaitingYouInbox`, and an outside-click backdrop
- `apps/dispatch-control/__tests__/Masthead.test.tsx` - Reworked the `useQuery` mock from a positional sequence to a queryRef+args dispatch table (required by the inbox's additional queries; also added `qaCorrections`/`claimChecks` to the mocked `api` surface)

## Decisions Made
- Gate-1 interrupts and awaiting-review runs are treated as one category with one route, matching the existing `ReviewQueue.tsx` behavior — see `key-decisions` above and RESEARCH Pitfall 2. This is an explicit, scoped-out gap, not an oversight.
- Current-draft blockers (QA errors, sign-offs) are scoped to `awaitingReview[0]?.runId` only; both dependent queries pass `'skip'` when no draft run exists, avoiding a wasted/undefined query round-trip.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rewrote Masthead.test.tsx's useQuery mock to unblock the full test suite**
- **Found during:** Task 2 (wiring AwaitingYouInbox into Masthead)
- **Issue:** The pre-existing `Masthead.test.tsx` (from Plan 30-04) mocked `convex/react`'s `useQuery` with a positional `mockReturnValueOnce` sequence sized for Masthead's own 4 queries, and its `@convex/_generated/api` mock had no `qaCorrections`/`claimChecks` namespaces. Once `AwaitingYouInbox` was mounted inside `Masthead` (issuing 4 more `useQuery` calls, 2 of them against those missing namespaces), all 8 Masthead tests crashed with `Cannot read properties of undefined (reading 'byRunId')`.
- **Fix:** Rewrote the mock to dispatch by query-reference string + args (mirroring the pattern already used in `AwaitingYouInbox.test.tsx`) and added `qaCorrections.byRunId` / `claimChecks.allSignedOff` to the mocked `api` object. All 8 pre-existing Masthead tests pass unchanged in assertions/intent.
- **Files modified:** `apps/dispatch-control/__tests__/Masthead.test.tsx`
- **Verification:** `pnpm --filter dispatch-control test -- --run` — 29 files / 242 tests passing (was 8 failing before the fix); `pnpm --filter dispatch-control build` exits 0
- **Committed in:** `b154c49` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (blocking test-mock rewrite caused by the required Masthead.tsx change)
**Impact on plan:** Necessary consequence of Task 2's explicit instruction to mount AwaitingYouInbox inside Masthead. No scope creep — the rewritten mock covers the exact same test cases as before, just with a more robust dispatch mechanism.

## Issues Encountered
None beyond the auto-fixed test-mock breakage above.

## Known Stubs
None. Every rendered item is a live Convex-query projection; the empty state ("Nothing needs you right now.") is a real, reachable UI state (not a placeholder) when no category has any items.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CHR-04 complete: the masthead Awaiting-you chip opens a 360px dropdown listing every current human-blocking item, routed to a working screen.
- Explicit gap carried forward to Phase 37 (Signal Desk): Gate-1 interrupts are not distinguishable from ordinary awaiting-review runs at the data layer, and no resume-from-interrupt UI exists anywhere in the dashboard. Signal Desk should either add a distinguishing field (e.g. an explicit `gate1Interrupted` flag set by `editor.py`'s `interrupt()` call) or build adjudication UI that works regardless, and only then should the inbox be revisited to route interrupts differently.

---
*Phase: 30-foundation-design-system-chrome-awaiting-you-inbox*
*Completed: 2026-07-07*

## Self-Check: PASSED

All claimed files and commits verified present:
- FOUND: apps/dispatch-control/components/AwaitingYouInbox.tsx
- FOUND: apps/dispatch-control/__tests__/AwaitingYouInbox.test.tsx
- FOUND: apps/dispatch-control/components/Masthead.tsx
- FOUND: commit c69e4ea (Task 1)
- FOUND: commit b154c49 (Task 2)
