---
phase: 48-brief-entry-point
plan: 06
subsystem: ui
tags: [react, nextjs, convex, dispatch-control, stage-1, brief-entry-point]

# Dependency graph
requires:
  - phase: 48-01
    provides: "convex/schema.ts runs.entryMode field + Doc<'runs'> type carrying entryMode"
  - phase: 48-02
    provides: "the skip-guarded StoryBriefScreen.test.tsx entryMode==='brief' Wave-0 test block"
  - phase: 48-03
    provides: "verify_candidates persisting a single VerificationRecord for the human-supplied org on a brief run"
provides:
  - "ws.entryMode ('discovery' | 'brief' | undefined) on WorkspaceStateProvider's context value"
  - "BriefOrgCard.tsx — the brief-mode single-org card reading the human org's VerificationRecord"
  - "StoryBriefScreen's entryMode==='brief' branch (BriefOrgCard + honest no-leads copy instead of the misleading discovery empty-copy)"
affects: [48-07-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derive UI flags from an already-subscribed Convex query instead of adding a new useQuery (ws.entryMode from the existing runRow subscription)"
    - "Separate mode-specific component (BriefOrgCard) rather than branching inside an existing Scout/Advocate-shaped component (OrgOptionSlate)"

key-files:
  created:
    - "apps/dispatch-control/app/(dashboard)/story-brief/_components/BriefOrgCard.tsx"
  modified:
    - "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx"
    - "apps/dispatch-control/app/(dashboard)/story-brief/_components/StoryBriefScreen.tsx"

key-decisions:
  - "formatCheckedAt copied into BriefOrgCard.tsx (not imported) — it is a private, unexported helper in OrgOptionSlate.tsx, and the plan's files_modified list excludes OrgOptionSlate.tsx"
  - "BriefOrgCard is a wholly separate component, not a branch inside OrgOptionSlate — matches 48-RESEARCH Open Question 3's recommendation (OrgOptionSlate's joinCandidates logic is Scout/pitchLog-shaped and does not apply to a single human-supplied org)"

patterns-established:
  - "Advisory verification concern rendering: a killed/failed VerificationRecord check is surfaced with a marigold-text note plus the always-visible vermilion 'Main concern' block, but never removes the org or blocks the render (D-11)"

requirements-completed: [ENT-01, ENT-03, ENT-04]

# Metrics
duration: 7min
completed: 2026-07-16
---

# Phase 48 Plan 06: Stage-1 Brief-Mode Render Summary

**Closed the under-scope RESEARCH flagged: a brief-started run's Stage 1 now renders the human-supplied organization and its persisted VerificationRecord via a new `BriefOrgCard`, instead of the discovery-mode `OrgOptionSlate`/`story_leads` empty-state copy that would otherwise hide it.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-16T15:24:00Z (approx, first Read call)
- **Completed:** 2026-07-16T15:33:48Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `ws.entryMode` (`'discovery' | 'brief' | undefined`) now available to every Stage-1 consumer, derived from the already-subscribed `runRow` query — no new Convex subscription added.
- New `BriefOrgCard` component renders the single human-org `VerificationRecord` persisted by `verify_candidates` on a brief run — org name, verification-with-dates line, an advisory (never-blocking) flagged-concern note when `killed`, and an always-visible, never-truncated "Main concern" block (D-11's never-truncated discipline, reused from `OrgOptionSlate`).
- `StoryBriefScreen` branches on `ws.entryMode === 'brief'`: the Leads section shows an honest "Started from a hand-authored brief — no story leads" instead of the misleading discovery "No leads yet.", and `BriefOrgCard` replaces `OrgOptionSlate`. Discovery-mode rendering (leads slate, `OrgOptionSlate`, `NeedsYourDecisionCard`) is untouched.
- The Wave-0 skip-guarded `StoryBriefScreen.test.tsx` brief-mode `describe` block (previously skipped via `ENTRY_MODE_WIRED` source-scan) now runs and passes: 11/11 tests in the file, including all 3 new brief-mode assertions (no discovery-mode leads copy, no `OrgOptionSlate` empty-state copy, human org name + verification line render).

## Task Commits

Each task was committed atomically:

1. **Task 1: Thread runRow.entryMode onto the workspace context value** - `2041fb8` (feat)
2. **Task 2: Add BriefOrgCard.tsx — the single human-org card reading its VerificationRecord** - `d9baa24` (feat)
3. **Task 3: Branch StoryBriefScreen on entryMode === 'brief'** - `4131e52` (feat)

_No TDD tasks in this plan — verification was build-compile + the pre-existing skip-guarded test suite turning green._

## Files Created/Modified

- `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx` - Added `entryMode` to `WorkspaceStateValue` interface and derived it from the existing `runRow` subscription (no new query)
- `apps/dispatch-control/app/(dashboard)/story-brief/_components/BriefOrgCard.tsx` - New component: renders `verificationRecords[0]` (the single human-org record) with loading/verifying/rendered states, verification-with-dates line, advisory flagged-concern note, and always-visible Main Concern block
- `apps/dispatch-control/app/(dashboard)/story-brief/_components/StoryBriefScreen.tsx` - Added `isBrief` flag; branched the Leads section empty-copy and the org-options mount (`BriefOrgCard` vs `OrgOptionSlate`) on it

## Decisions Made

- **`formatCheckedAt` copied, not imported:** `OrgOptionSlate.tsx`'s `formatCheckedAt` is a private (unexported) module-level function, and the plan's `files_modified` list for this plan excludes `OrgOptionSlate.tsx`. Copying a 6-line pure date-formatting helper is lower-risk than widening `OrgOptionSlate`'s exports for a file this plan is not scoped to touch. `VerificationRecordRow` (already exported) is imported directly, as the plan specifies.
- **Separate `BriefOrgCard` component, not a branch inside `OrgOptionSlate`:** Matches 48-RESEARCH's own Open Question 3 recommendation — `OrgOptionSlate`'s entire `joinCandidates` logic is Scout/Advocate/pitchLog-shaped and irrelevant to a brief run's single pre-verified org; mixing the two data-join stories in one file would have made both harder to reason about and test independently.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' acceptance criteria (grep checks + build/test commands) passed without requiring any auto-fix.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. `runs.entryMode` was already live-synced to Convex as part of Plan 48-01 (this plan only reads it, never writes to Convex).

## Next Phase Readiness

- Stage 1 now renders meaningfully for both discovery-started and brief-started runs, closing the ENT-01/ENT-03/ENT-04 gap the CONTEXT under-scoped and RESEARCH flagged (Pattern 4).
- `pnpm --filter dispatch-control build` exits 0 (verified directly, not through a masked `tail`/`grep || echo` pipe per the plan-checker's flag).
- `pnpm --filter dispatch-control test:unit` (full suite, run directly via `npx vitest run` to bypass the `--` filter-argument pass-through quirk observed with `pnpm --filter ... test:unit -- <pattern>`) is 939/939 passed, 111/112 files passed (1 pre-existing unrelated skip), 2 pre-existing todos — zero regressions.
- Ready for Plan 48-07 (integration gate): the brief-mode Stage-1 render is the last piece of console-side work this milestone's brief-entry-point flow needed; 48-07 can now run the full cross-boundary (pipeline + Convex + console) integration verification.

---
*Phase: 48-brief-entry-point*
*Completed: 2026-07-16*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/story-brief/_components/BriefOrgCard.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/story-brief/_components/StoryBriefScreen.tsx
- FOUND: .planning/phases/48-brief-entry-point/48-06-SUMMARY.md
- FOUND commit: 2041fb8
- FOUND commit: d9baa24
- FOUND commit: 4131e52
