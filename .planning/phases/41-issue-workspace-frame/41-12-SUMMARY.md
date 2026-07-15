---
phase: 41-issue-workspace-frame
plan: 12
subsystem: ui
tags: [react-context, convex, typescript, vitest, dispatch-control, workspace-frame, context-panel, gap-closure]

# Dependency graph
requires:
  - phase: 41-issue-workspace-frame
    provides: "WorkspaceStateProvider's panelContent/setPanelContent slot (41-11) + the four already-subscribed arrays (pitchRows/qaFindings/claimRows/signOffs) exposed on useWorkspaceState()"
provides:
  - "5 stage 'panel publisher' client components (Story/Draft/FactCheck/Voice/Approval), each a pure buildXxxPanelContent(...) + a thin effect wrapper that calls setPanelContent on mount and cleans up to null on unmount"
  - "Real, stage-specific, honest-empty content on all 5 Issue Workspace stages' ContextPanel -- closes WSP-03's 'renders stage-appropriate context' gap"
  - "StageContextPanels.test.tsx -- per-stage populated/honest-empty/loading regression coverage for all 5 builders, plus a 5-publisher 'reaches the slot' plumbing test"
affects: [42-fact-check-stage, 43-my-tasks-screen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Panel publisher pattern: a stage page mounts a tiny 'use client' sibling component that reads useWorkspaceState() (never useQuery directly), builds its content via a pure exported function, and publishes it into the frame's persistent ContextPanel slot via an effect with null-cleanup -- so tab switches swap content cleanly and the pure builder is independently unit-testable without rendering the whole provider tree"
    - "vi.hoisted + a single mutable fixture ref to mock a shared hook (useWorkspaceState) once and drive 5 different real component renders from one test file, without needing to mock Convex/Clerk for a pure plumbing check"

key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/DraftPanelContent.tsx
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPanelContent.tsx
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/VoicePanelContent.tsx
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent.tsx
    - apps/dispatch-control/__tests__/StageContextPanels.test.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/page.tsx
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/page.tsx
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/page.tsx
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/page.tsx
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/page.tsx

key-decisions:
  - "Each builder accepts the RAW provider field (pitchRows / qaFindings / claimRows, or an inputs object for Approval) rather than a pre-filtered value, and does its own undefined-vs-empty distinction internally -- keeps the loading/empty/populated honesty rule co-located with the one function every regression test exercises directly"
  - "Approval's readiness board is a deliberate, intentionally-worded DUPLICATE of the Stage 5 rail's own readiness summary (never an import) -- per the gap's explicit extract-or-duplicate allowance -- and even the doc comment avoids naming the rail's read-only board component so a naive grep for that name (used as the plan's own anti-regression acceptance check) stays green"
  - "The 5-publisher plumbing test mocks useWorkspaceState via one vi.hoisted mutable fixture ref rather than mocking 5 different relative import paths individually -- Vitest matches module mocks by resolved file path, not import specifier text, so one vi.mock call intercepts all 5 real publishers' identical (but differently-relative) imports of the same provider module"

patterns-established:
  - "Panel publisher: <stage>/XxxPanelContent.tsx exports a pure buildXxxPanelContent(...) (unit-testable, no hooks) and a default XxxPanelPublisher (a 'use client' effect wrapper, renders null, calls setPanelContent on mount / null on unmount) -- mounted as a fragment sibling of the stage's existing screen in that stage's page.tsx, never modifying the screen itself"

requirements-completed: [WSP-03]

# Metrics
duration: 25min
completed: 2026-07-15
---

# Phase 41 Plan 12: Per-Stage Context Panel Content Summary

**5 pure `buildXxxPanelContent` functions + effect-wrapper publishers feed real, stage-specific detail (lead/org card, open QA items, claim coverage, voice tells, readiness board) into the Issue Workspace's single persistent ContextPanel — closing the last code gap in WSP-03 with zero new Convex subscriptions.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-15T02:10:00Z (approx.)
- **Completed:** 2026-07-15T02:27:00Z
- **Tasks:** 3
- **Files modified:** 15 (5 created components, 5 modified page mounts, 1 created/extended test file across 3 commits)

## Accomplishments

- **Stage 1 (Story):** `StoryPanelContent.tsx` — `buildStoryPanelContent(pitchRows)` renders the selected charity as a lead card (name, location, focus area, scout summary) with remaining candidates listed below; honest "No charity selected yet" / "Loading lead detail…" states. Mounted via `StoryPanelPublisher` in `story/page.tsx`.
- **Stage 2 (Draft):** `DraftPanelContent.tsx` — `buildDraftPanelContent(qaFindings)` filters through the shared `isOpenFinding` predicate and renders one row per open finding (section label + severity label + reason); honest "No open QA items — this draft is clean" / loading states. Mounted via `DraftPanelPublisher` in `draft/page.tsx`.
- **Stage 3 (Fact Check):** `FactCheckPanelContent.tsx` — `buildFactCheckPanelContent(claimRows)` mirrors `FactCheckPlaceholder`'s coverage line ("checked X of Y · N unchecked") plus a read-only claim list with Pending/Checked/Skipped status labels and an "Open source" link when present; honest "No claims extracted yet" for zero claims — never a fake verified/complete state. Mounted via `FactCheckPanelPublisher` in `fact-check/page.tsx`.
- **Stage 4 (Voice):** `VoicePanelContent.tsx` — `buildVoicePanelContent(qaFindings)` filters with the EXACT `isOpenFinding` + `VOICE_AXES` combination `VoicePassRunView`'s tell count uses, so the panel list never disagrees with the header count; honest "No voice tells flagged" / loading states. Mounted via `VoicePanelPublisher` in `voice/page.tsx`.
- **Stage 5 (Approval):** `ApprovalPanelContent.tsx` — `buildApprovalPanelContent({ signOffs, claimRows, tasks, held })` renders a compact readiness board (Fact check / Voice / Held / Blocking items) as an intentional read-only DUPLICATE of the Stage 5 rail's own readiness summary (never imported) — every row always renders explicit text, even in the fully-empty state ("not signed" / "no claims yet" / "none"). Mounted via `ApprovalPanelPublisher` in `approval/page.tsx`.
- All 5 publishers read `useWorkspaceState()` exclusively — confirmed by grep that none of the 5 new files contain `useQuery(` — zero new Convex subscriptions added.
- `StageContextPanels.test.tsx` (new, 20 tests): 3 tests per stage (populated / honest-empty / loading) for all 5 builders, plus a 5-test "publishers reach the slot" plumbing block that mocks `useWorkspaceState` (via one `vi.hoisted` fixture ref) and renders each REAL publisher component, asserting `setPanelContent` is called with a defined node on mount.
- Full `dispatch-control` suite: **83 files passed / 1 skipped (84)**, **659 tests passed / 2 todo (661)** — the 41-11 baseline was 82/639; net +1 file / +20 tests, zero regressions.
- Strict build (`pnpm --filter dispatch-control build`): **"Compiled successfully"**, all 5 stage routes present in the route table, exit 0.

## Task Commits

Each task was committed atomically to master:

1. **Task 1: Stage 1 (Story) + Stage 2 (Draft) panel publishers + mounts + tests** - `98eb465` (feat)
2. **Task 2: Stage 3 (Fact Check) + Stage 4 (Voice) panel publishers + mounts + tests** - `35a4ecd` (feat)
3. **Task 3: Stage 5 (Approval) readiness publisher + mount + tests + full-suite/strict-build gate** - `ef5a81a` (feat)

## Files Created/Modified

- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx` - `buildStoryPanelContent` + `StoryPanelPublisher`
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/page.tsx` - mounts `<StoryPanelPublisher />` as a sibling of `SignalDeskScreen`
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/DraftPanelContent.tsx` - `buildDraftPanelContent` + `DraftPanelPublisher`
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/page.tsx` - mounts `<DraftPanelPublisher />` as a sibling of `ReviewDeskRunView`
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPanelContent.tsx` - `buildFactCheckPanelContent` + `FactCheckPanelPublisher`
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/page.tsx` - mounts `<FactCheckPanelPublisher />` as a sibling of `FactCheckPlaceholder`
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/VoicePanelContent.tsx` - `buildVoicePanelContent` + `VoicePanelPublisher`
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/page.tsx` - mounts `<VoicePanelPublisher />` as a sibling of `VoicePassScreen`
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent.tsx` - `buildApprovalPanelContent` + `ApprovalPanelPublisher`
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/page.tsx` - mounts `<ApprovalPanelPublisher />` as a sibling of `ApprovalStage`
- `apps/dispatch-control/__tests__/StageContextPanels.test.tsx` - 20 tests: 5 stages × 3 (populated/empty/loading) + 5-publisher plumbing block

## Decisions Made

- Each builder takes the raw provider field (not a pre-filtered array) so the `undefined` (loading) vs. empty-array (loaded, nothing there) distinction lives in one place per stage, matching every regression test's three cases directly.
- Approval's readiness board is a deliberate duplicate, never an import, of the Stage 5 rail's own readiness summary — including avoiding naming that component in the doc comment, since the plan's own anti-regression check greps the file for that literal name.
- The plumbing test mocks `useWorkspaceState` once via a single `vi.hoisted` mutable fixture ref rather than mocking the module separately per stage folder — Vitest resolves `vi.mock` by file path, so one mock intercepts all 5 publishers' structurally-identical (but differently-relative) imports of the same provider module, sidestepping the test-mechanics wrinkle flagged in the plan's critical notes.

## Deviations from Plan

None — plan executed exactly as written. One micro-adjustment during self-check: the Approval publisher's doc comment initially named the Stage 5 rail's read-only board component directly, which would have failed the plan's own `! grep -q "DecisionRail"` acceptance check; reworded the comment to describe the same duplication without using that literal name (Rule 1 — a self-caught correctness bug in test/acceptance alignment, fixed inline before commit, not a deviation from the plan's intent).

## Issues Encountered

None. All three tasks' automated `<verify>` grep + test commands passed on the first attempt (after the one doc-comment wording fix above); the full suite and strict build both passed cleanly with no fix-up iterations needed.

## User Setup Required

None — no external service configuration required. No Convex functions were touched by this plan (all 5 publishers read data the provider already subscribes to), so no `dev:once` sync was required.

## Next Phase Readiness

- WSP-03 is now fully closed: all 5 Issue Workspace stages feed real, stage-specific, honest content into the frame's single persistent ContextPanel, closing the sole code gap `41-VERIFICATION.md` found.
- The live demo-path UAT walk (`41-UAT.md` Section 2 — tab/status/publish-lock reactivity, live Convex, no jsdom equivalent) remains the one pending human-verification item for Phase 41, unchanged by this plan (it was already recorded as an expected residual, not a gap).
- `node gsd-tools roadmap get-phase 41` continues to mis-handle this phase's plan count beyond the original 10 (a known quirk, first hit in 41-11) — the Phase 41 ROADMAP.md and STATE.md rows were verified read correctly after the state-update tooling ran and hand-corrected where the tool underreported.
- No blockers identified. Phase 41 is ready to be marked complete.

---
*Phase: 41-issue-workspace-frame*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 6 claimed files found on disk; all 3 task commits (`98eb465`, `35a4ecd`, `ef5a81a`) found in git history.
