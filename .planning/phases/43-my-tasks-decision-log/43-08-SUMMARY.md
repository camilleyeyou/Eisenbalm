---
phase: 43-my-tasks-decision-log
plan: 08
subsystem: api
tags: [convex, decision-log, audit-log, registry, ui, react]

# Dependency graph
requires:
  - phase: 43-02
    provides: "auditLog.writeDecision + auditLog.listDecisions substrate (the ONE shared Convex-side decision-write helper, D-11)"
  - phase: 43-07
    provides: "the writeDecision-call pattern (requireOperator actor + before/after snapshot + reason) established across issues.ts/promptVersions.ts/charityCorrections.ts"
provides:
  - "charities.setStatus requires a non-empty reason for the blocklist ('blocklisted') transition and throws otherwise; non-blocklist transitions (candidate/featured, unblocklist) stay reason-free"
  - "charities.setStatus emits a structured 'charity.blocklisted' decision row via writeDecision on blocklist — closes the Phase 26 no-audit gap (zero audit_log rows previously)"
  - "RegistryTable's blocklist confirm popover collects a required reason via a labeled textarea, disabling confirm until non-empty"
affects: [43-09, 46, 47, 49]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Do-not-use now matches the Hold/reopen/charity-correction shape from 43-07: requireOperator actor -> validate reason -> ctx.db.patch -> internal.auditLog.writeDecision with before/after JSON snapshot"

key-files:
  created:
    - apps/dispatch-control/__tests__/charitiesDoNotUse.test.ts
  modified:
    - convex/charities.ts
    - apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx
    - apps/dispatch-control/vitest.config.ts

key-decisions:
  - "Amended the existing setStatus mutation with an optional reason arg (guarded to required-when-blocklisting) rather than adding a dedicated markDoNotUse mutation — the plan left this to implementation discretion; amending setStatus avoids duplicating the status-validation/charity-lookup logic and keeps RegistryTable's single mutation reference."
  - "blocklistReason lives in RegistryTable component state (not per-row), reset on popover open/cancel/success — matches the existing confirmingBlocklistId/pendingAction single-active-row pattern already in the file."
  - "Confirm button is guarded client-side (disabled while reason is empty) AND server-side (mutation throws) — belt-and-suspenders, consistent with how issues.hold's UI + mutation both guard reason today."

requirements-completed: [TSK-06]

# Metrics
duration: 6min
completed: 2026-07-15
---

# Phase 43 Plan 08: Do-not-use reason capture Summary

**`charities.setStatus` now rejects a blocklist transition without a reason and emits a structured `charity.blocklisted` decision row via the shared `writeDecision` helper; `RegistryTable`'s blocklist confirm popover gained a required reason textarea — closing the Phase 26 gap where blocklisting a charity wrote zero audit rows.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-15T10:24:00-07:00 (approx.)
- **Completed:** 2026-07-15T10:29:11-07:00
- **Tasks:** 3 completed (RED → GREEN TDD on Task 1/2, then Task 3)
- **Files modified:** 4 (1 created)

## Accomplishments
- New `apps/dispatch-control/__tests__/charitiesDoNotUse.test.ts` (edge-runtime convex-test) pins: blocklisting without a reason throws, blocklisting with a reason patches status AND emits a `charity.blocklisted` decision row (visible via `auditLog.listDecisions`), and non-blocklist transitions (unblocklist back to `candidate`) stay reason-free.
- `convex/charities.ts` `setStatus` gained an optional `reason` arg; the `'blocklisted'` target now requires a non-empty trimmed reason (throws `'A reason is required to mark a charity Do not use.'` otherwise) and, on success, calls `internal.auditLog.writeDecision` with `action: 'charity.blocklisted'`, `resourceType: 'charity'`, `resourceId`, a `before`/`after` status snapshot, and the reason.
- `RegistryTable.tsx`'s inline blocklist confirmation popover gained a labeled, required `<textarea>` ("Why mark Do not use?") bound to new `blocklistReason` state, reset on popover open/cancel/success. The confirm button is disabled while the trimmed reason is empty (in addition to the existing pending guard). `handleBlocklist` now passes `reason: blocklistReason.trim()` to `setStatus`; `handleUnblocklist` is unchanged.
- `convex/*` synced to `dev:modest-magpie-797` via `pnpm --filter @eisenbalm/convex dev:once` (exit 0, no deploy error).

## Task Commits

Each task was committed atomically:

1. **Task 1: RED convex-test — blocklist requires reason + emits decision row** - `01beb9c` (test)
2. **Task 2: Enforce reason + emit writeDecision in charities.setStatus, then sync Convex** - `1f9e431` (feat)
3. **Task 3: Reason textarea in the RegistryTable blocklist confirm flow** - `ee977ed` (feat)

_Note: Task 1 was RED (3 failing tests, confirmed via `pnpm --filter dispatch-control test`), Task 2 turned it GREEN (3 passing) and re-verified the full 91-file/786-test suite plus a clean Convex sync._

## Files Created/Modified
- `apps/dispatch-control/__tests__/charitiesDoNotUse.test.ts` - New edge-runtime convex-test pinning the three <behavior> bullets against `charities.setStatus`
- `apps/dispatch-control/vitest.config.ts` - Registered the new test file under `environmentMatchGlobs` (edge-runtime)
- `convex/charities.ts` - `setStatus` gains `reason: v.optional(v.string())`, required-when-blocklisting enforcement, and a `writeDecision` emission (`action: 'charity.blocklisted'`)
- `apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx` - `blocklistReason` state + required textarea in the blocklist confirm popover; `handleBlocklist` passes the trimmed reason to the mutation

## Decisions Made
- Amended `setStatus` in place (optional `reason` arg, required only for the `'blocklisted'` target) rather than adding a dedicated `markDoNotUse` mutation — both were contract-acceptable per §43.7; amending avoids duplicating status validation/charity lookup and keeps `RegistryTable` on a single mutation reference.
- `blocklistReason` is single-row component state (not per-charity-id keyed), matching the existing `confirmingBlocklistId`/`pendingAction` single-active-row UI pattern already in the file — only one blocklist popover can be open at a time.
- Client-side disabled-button guard AND server-side throw both enforce the non-empty reason (belt-and-suspenders), matching how `issues.hold` is guarded today.

## Deviations from Plan

None - plan executed exactly as written. The plan explicitly left "amend `setStatus` vs. new `markDoNotUse` mutation" to implementation discretion; amending `setStatus` was chosen and is documented above, not a deviation from the contract.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Do-not-use is now the last TSK-06 reason-requiring action wired through the shared `writeDecision` helper (alongside Hold/reopen/charity-correction/activate-override/keep-as-written from 43-07) — `auditLog.listDecisions` (and the My Tasks Decision Log component, Plan 43-06) now project a `charity.blocklisted` row for every blocklist decision made from here forward.
- Ready for 43-09 (integration gate): full suites + strict build + Convex sync all confirmed green in this plan; no known blockers.

---
*Phase: 43-my-tasks-decision-log*
*Completed: 2026-07-15*

## Self-Check: PASSED

All created/modified files confirmed present on disk; all three task commit hashes (`01beb9c`, `1f9e431`, `ee977ed`) confirmed present in `git log`.
