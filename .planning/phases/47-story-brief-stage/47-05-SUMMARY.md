---
phase: 47-story-brief-stage
plan: 05
subsystem: ui
tags: [convex, nextjs, react, vitest, clerk, dispatch-control]

# Dependency graph
requires:
  - phase: 47-01-contracts-convex-store-wave0-tests
    provides: "docs/API_CONTRACTS.md §7/§47 contract, live briefs/story_leads.status Convex store, the LeadCard/LeadActions Wave-0 it.todo scaffolds this plan fills in"
  - phase: 47-04-leads-and-brief-fastapi-endpoints
    provides: "the Clerk-guarded POST /issues/{run_id}/leads/{lead_id}/require and /remove endpoints this plan's clients call"
provides:
  - "WorkspaceStateProvider.storyLeads / verificationRecords / brief — the three centralized Convex subscriptions every remaining Stage-1 component (47-06/47-07/47-08) reads from"
  - "pipelineControlClient.ts::requireLead/removeLead — typed clients calling the 47-04 leads endpoints"
  - "LeadCard.tsx — the never-truncated Stage-1 lead card (BRF-01)"
  - "LeadActions.tsx — Require/Remove+reason wired to requireLead/removeLead, with the shared DecisionLog mounted (BRF-02)"
affects: [47-06-org-options-and-needs-your-decision, 47-07-brief-field-table-and-strengthen, 47-08-story-brief-screen-mount-and-phase-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LeadCard is a pure presentational component (props-only, no useQuery) — the frame reads ws.storyLeads and passes one row at a time, keeping the never-truncated card trivially unit-testable without Convex mocking"
    - "LeadActions mounts the shared DecisionLog component directly (mirrors ApprovalPanelContent's 'always mounted, scoped to runId' idiom) rather than re-implementing a bespoke success/decision surface"

key-files:
  created:
    - "apps/dispatch-control/app/(dashboard)/story-brief/_components/LeadCard.tsx"
    - "apps/dispatch-control/app/(dashboard)/story-brief/_components/LeadActions.tsx"
  modified:
    - "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx"
    - "apps/dispatch-control/lib/pipelineControlClient.ts"
    - "apps/dispatch-control/__tests__/LeadCard.test.tsx"
    - "apps/dispatch-control/__tests__/LeadActions.test.tsx"
    - "apps/dispatch-control/__tests__/FrameChromeCostReadout.test.tsx"
    - "apps/dispatch-control/__tests__/WorkspaceLayout.test.tsx"
    - "apps/dispatch-control/__tests__/WorkspaceContextPanelSlot.test.tsx"

key-decisions:
  - "requirements mark-complete intentionally NOT run for BRF-01/BRF-02 in this plan — REQUIREMENTS.md's own wording ('Stage 1 shows story leads as cards...', 'Operator can Require a lead...') describes operator-VISIBLE capability, and LeadCard/LeadActions are not yet mounted into any reachable route (that's 47-08, story-brief-screen-mount-and-phase-gate). Follows the precedent 47-01's and 47-04's SUMMARYs established explicitly for the same reason."
  - "LeadActions always mounts <DecisionLog runId={runId} /> beneath its controls (not conditionally after a successful Remove) — matches ApprovalPanelContent's precedent of an always-visible, run-scoped Decision log rather than a component-local success toast standing in for it"

patterns-established: []

requirements-completed: []

# Metrics
duration: 15min
completed: 2026-07-16
---

# Phase 47 Plan 05: Workspace Subscriptions + Lead Card Actions Summary

**WorkspaceStateProvider gains storyLeads/verificationRecords/brief subscriptions and pipelineControlClient gains requireLead/removeLead; LeadCard renders every story-lead field in full (never truncated, never tooltip-hidden) and LeadActions gates Remove on a mandatory, Decision-logged reason.**

## Performance

- **Duration:** 15 min (task commits 04:07:47 → 04:14:52 PDT)
- **Started:** 2026-07-16T11:00:00Z (approx.)
- **Completed:** 2026-07-16T11:15:23Z
- **Tasks:** 3
- **Files modified:** 9 (2 new components, 2 new component test suites filled in from Wave-0 scaffolds, 2 lib files, 3 pre-existing test files patched for a mock-shape regression)

## Accomplishments
- `WorkspaceStateProvider.tsx` now centralizes `api.storyLeads.byRunId`, `api.verificationRecords.byRunId`, and `api.briefs.byRunId` (runId-scoped/`'skip'`-guarded exactly like the existing `pitchRows` subscription) and exposes all three on `WorkspaceStateValue` — every remaining Stage-1 plan (47-06/47-07/47-08) reads from here with zero new `useQuery` calls
- `pipelineControlClient.ts` gains `requireLead`/`removeLead`, mirroring `adjudicateGate1`'s Clerk-token fetch/throw shape exactly, calling the 47-04 `/issues/{run_id}/leads/{lead_id}/require` and `/remove` endpoints
- `LeadCard.tsx` (BRF-01): renders premise, dated peg + a real `pegSourceUrl` `<a href>` link, reader energy, charitable angle, category, and confidence — every field in full — plus the brand-risk warning (when `brandRiskFlag`) rendered always-visible/full-text/no-`title=`-attribute, mirroring `CandidateSlate`'s `primaryConcern` block exactly; `repetitionWarning` renders as an additive advisory, never suppressing the rest of the card
- `LeadActions.tsx` (BRF-02): "Require this lead" (no reason) and a reason-gated "Remove" (disabled until the trimmed reason is non-empty) call `requireLead`/`removeLead`; the shared `DecisionLog` component is mounted beneath, run-scoped, per `ApprovalPanelContent`'s established idiom
- Filled both Wave-0 `it.todo` scaffolds: `LeadCard.test.tsx` (6 tests, including the never-truncated brand-risk tripwire copied from `CandidateSlate.test.tsx`) and `LeadActions.test.tsx` (8 tests, including the reason-gate, the exact `removeLead` call shape, the Decision-log surface, and non-silent-failure handling for both actions) — all pass on first implementation, zero `it.todo` remaining for either file

## Task Commits

Each task was committed atomically:

1. **Task 1: storyLeads/verificationRecords/briefs subscriptions + requireLead/removeLead clients** - `0ac5564` (feat)
2. **Task 2: LeadCard.tsx — never-truncated lead card (BRF-01)** - `2c44376` (feat)
3. **Task 3: LeadActions.tsx — Require/Remove+reason (BRF-02)** - `7ddc98f` (feat)

_No dedicated RED/GREEN split commits — Tasks 2/3 were `tdd="true"` but each landed as a single commit containing both the filled test file and the passing component (all assertions passed on first implementation; no separate failing-test commit was meaningful to preserve)._

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx` - adds `storyLeads`/`verificationRecords`/`brief` subscriptions + interface fields + value-object exposure
- `apps/dispatch-control/lib/pipelineControlClient.ts` - adds `requireLead`/`removeLead` + their result types
- `apps/dispatch-control/app/(dashboard)/story-brief/_components/LeadCard.tsx` - new: BRF-01 never-truncated lead card
- `apps/dispatch-control/app/(dashboard)/story-brief/_components/LeadActions.tsx` - new: BRF-02 Require/Remove+reason, mounts `DecisionLog`
- `apps/dispatch-control/__tests__/LeadCard.test.tsx` - Wave-0 scaffold filled: 6 tests
- `apps/dispatch-control/__tests__/LeadActions.test.tsx` - Wave-0 scaffold filled: 8 tests
- `apps/dispatch-control/__tests__/FrameChromeCostReadout.test.tsx` - Rule 3 fix: added `storyLeads`/`verificationRecords`/`briefs` keys to the mocked `@convex/_generated/api` object (unmapped in `fixtureFor()`, resolving to the pre-existing harmless `undefined` default)
- `apps/dispatch-control/__tests__/WorkspaceLayout.test.tsx` - same Rule 3 fix
- `apps/dispatch-control/__tests__/WorkspaceContextPanelSlot.test.tsx` - same Rule 3 fix

## Decisions Made
- **`requirements mark-complete` deferred for BRF-01/BRF-02**, consistent with 47-01's and 47-04's explicit precedent: `.planning/REQUIREMENTS.md`'s own text describes operator-*visible* capability ("Stage 1 shows story leads as cards...", "Operator can Require a lead..."), and `LeadCard`/`LeadActions` aren't mounted into any reachable route yet — that's Plan 47-08 (`story-brief-screen-mount-and-phase-gate`). Both checkboxes remain `[ ]`; they'll flip when 47-08 (or whichever plan actually mounts Stage 1) lands.
- **`DecisionLog` is always mounted**, not conditionally shown only after a successful Remove — matches the `ApprovalPanelContent.tsx` precedent (a persistent, run-scoped log) rather than inventing a component-local success-toast substitute.
- **LeadCard stays a pure, props-only component** (no `useQuery`) — the provider (`ws.storyLeads`) supplies rows; this keeps the never-truncated tripwire test dependency-free, matching the plan's stated design ("taking a single story-lead row from `ws.storyLeads`").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Three pre-existing WorkspaceStateProvider-consumer tests broke on the new subscriptions**
- **Found during:** Task 1 (full-suite regression run after adding the three new `useQuery` calls)
- **Issue:** `FrameChromeCostReadout.test.tsx`, `WorkspaceLayout.test.tsx`, and `WorkspaceContextPanelSlot.test.tsx` each mock `@convex/_generated/api` with a partial `api` object (only the query keys `WorkspaceStateProvider` called *before* this plan). The new `api.storyLeads.byRunId` / `api.verificationRecords.byRunId` / `api.briefs.byRunId` calls threw `TypeError: Cannot read properties of undefined (reading 'byRunId')` because `api.storyLeads` etc. were `undefined` in those mocks — blocking all three test files (8 failing tests) from even rendering `IssueWorkspaceLayout`.
- **Fix:** Added `storyLeads: { byRunId: 'storyLeads:byRunId' }`, `verificationRecords: { byRunId: 'verificationRecords:byRunId' }`, and `briefs: { byRunId: 'briefs:byRunId' }` to each file's mocked `api` object. Each file's `fixtureFor()`/`useQuery` mock implementation already has a `default: return undefined` fallback for unmapped query refs, so the three new subscriptions resolve harmlessly to `undefined` — irrelevant to what those three tests actually verify (cost readout, stage tabs, context-panel slot).
- **Files modified:** `apps/dispatch-control/__tests__/FrameChromeCostReadout.test.tsx`, `apps/dispatch-control/__tests__/WorkspaceLayout.test.tsx`, `apps/dispatch-control/__tests__/WorkspaceContextPanelSlot.test.tsx`
- **Verification:** Full `pnpm --filter dispatch-control test:unit` run: 0 failures both before-Task-1-baseline-count and after (884/34-todo baseline → 898/22-todo after all three tasks, exactly +14 passed / -12 todo matching the 6 LeadCard + 8 LeadActions tests filled in)
- **Committed in:** `0ac5564` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep the pre-existing regression suite green after the new provider subscriptions; no scope creep — only the three affected mocks were touched, no test assertions changed.

## Issues Encountered
- `VoicePassScreen.test.tsx` failed once on a `getByRole('button', { name: /write my own/i })` lookup during a full-suite parallel run, then passed cleanly on two subsequent full-suite runs (including a filtered rerun and a final clean run) — an async-timing flake under parallel load unrelated to this plan's changes (that file/route is untouched here). Not treated as a regression.
- `tsc --noEmit` (the project's `typecheck` script) reports a large number of pre-existing errors across unrelated `__tests__/*.ts(x)` files (e.g. `import.meta.glob` typing, various `strict`-mode "possibly undefined" findings in older convex-test files). None of the errors reference any file this plan touched (`LeadCard`, `LeadActions`, `WorkspaceStateProvider`, `pipelineControlClient`, or the three patched mock files) — confirmed via a targeted grep of the full `tsc` output. Out of scope per the scope-boundary rule; not fixed. The authoritative strict-build gate for this phase is Plan 47-08 per `<project_specific_guidance>`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ws.storyLeads` / `ws.verificationRecords` / `ws.brief` are live on `WorkspaceStateProvider` — Plan 47-06 (org options + Needs-your-decision) and 47-07 (Brief field table + strengthen) can consume them with zero new subscriptions.
- `LeadCard` and `LeadActions` are fully built, tested, and ready to compose into the Stage-1 screen — Plan 47-08 mounts them (plus 47-06/47-07's components) into `story-brief/StoryBriefScreen.tsx`, replacing the provisional `StoryPanelContent.tsx`, and is also where the BRF-01/BRF-02 `REQUIREMENTS.md` checkboxes should flip once the operator can actually reach these components.
- `requireLead`/`removeLead` clients exist and are proven against mocked responses; the real Clerk-guarded FastAPI endpoints they call were already live and tested as of Plan 47-04.
- No blockers. Full `pnpm --filter dispatch-control test:unit` is green: 898 passed / 22 todo / 0 failed (110 files, 105 passed + 5 skipped), confirmed on two consecutive full runs.

---
*Phase: 47-story-brief-stage*
*Completed: 2026-07-16*

## Self-Check: PASSED

All 10 files verified present (WorkspaceStateProvider.tsx, pipelineControlClient.ts, LeadCard.tsx,
LeadActions.tsx, LeadCard.test.tsx, LeadActions.test.tsx, FrameChromeCostReadout.test.tsx,
WorkspaceLayout.test.tsx, WorkspaceContextPanelSlot.test.tsx, this SUMMARY.md). All 3 task commit
hashes (0ac5564, 2c44376, 7ddc98f) verified present in `git log`.
