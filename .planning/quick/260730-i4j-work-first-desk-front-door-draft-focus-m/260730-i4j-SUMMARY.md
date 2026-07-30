---
phase: quick-260730-i4j
plan: 01
subsystem: ui
tags: [nextjs, react, convex, dispatch-control, navigation, information-architecture]

# Dependency graph
requires:
  - phase: 40-issue-status-and-derived-state
    provides: lib/derivedState.ts (deriveIssueStatus, deriveStageStates, deriveTasks, estimateWorkMinutes, deriveRunCostUsd, deriveRunCapUsd)
  - phase: 41-issue-workspace-frame
    provides: WorkspaceOutline, ContextPanel, the 3-column FrameChrome grid, WorkspaceStateProvider
  - phase: 43-my-tasks
    provides: MyTasksScreen's severity-grouped task list precedent, computeSessionStates
  - phase: 24-review-desk (via quick 260724-i5n)
    provides: StoryFocusView, StoryOutlineTab, resolveSectionFindings, EDITABLE_SECTIONS
provides:
  - "/desk — a work-first front door: run band + severity-grouped task ledger (deriveTasks) + quiet strip"
  - Root redirect and first Editorial nav item now point at /desk; /issues unchanged as the archive
  - lib/scheduleLabel.ts — extracted schedule-label helpers (shared by /issues and /desk)
  - lib/derivedState.ts gains TASK_SEVERITY_RENDER_ORDER + formatElapsed
  - Draft stage frame drops both rails (WorkspaceOutline, ContextPanel) — the story canvas runs full width
  - StoryFindingsRail — a story-scoped, conditional 292px open-findings rail rendered inside the Draft canvas
  - "Stories" disclosure in StoryFocusView's crumb row, restoring the outline's jump + state-mark capability
  - AnnotationMark's <mark> carries id="finding-{findingId}" as the rail's jump anchor
affects: [issues-workspace, review-desk, my-tasks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure DeskBody (props-only, no Convex) + thin DeskScreen data wrapper — the MyTasksList/MyTasksScreen precedent, reused"
    - "Tri-state run-band status ({kind:'loading'|'unknown'|'ok'|'none'}) so 'still loading' is never confused with 'confirmed absent'"
    - "Conditional 3-column-vs-full-width frame branch keyed on currentStageSegment, gated once in FrameChrome"
    - "Story-scoped findings rail returns null (not collapsed) when a story is clean — zero-state IS the full-width canvas"

key-files:
  created:
    - apps/dispatch-control/lib/scheduleLabel.ts
    - apps/dispatch-control/app/(dashboard)/desk/page.tsx
    - apps/dispatch-control/app/(dashboard)/desk/_components/DeskScreen.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFindingsRail.tsx
    - apps/dispatch-control/__tests__/DeskScreen.test.tsx
    - apps/dispatch-control/__tests__/DraftFocusFrame.test.tsx
    - apps/dispatch-control/__tests__/StoryFindingsRail.test.tsx
    - .planning/quick/260730-i4j-work-first-desk-front-door-draft-focus-m/mockups/10-desk-worklist.html
    - .planning/quick/260730-i4j-work-first-desk-front-door-draft-focus-m/mockups/12-draft-one-rail.html
    - .planning/quick/260730-i4j-work-first-desk-front-door-draft-focus-m/mockups/13-clickpath.html
  modified:
    - apps/dispatch-control/lib/derivedState.ts
    - apps/dispatch-control/lib/nav.ts
    - apps/dispatch-control/app/(dashboard)/page.tsx
    - apps/dispatch-control/app/(dashboard)/issues/page.tsx
    - apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/page.tsx
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/DraftPanelContent.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFocusView.tsx
    - apps/dispatch-control/components/galley/AnnotationMark.tsx
    - apps/dispatch-control/__tests__/nav.test.ts
    - apps/dispatch-control/__tests__/WorkspaceContextPanelSlot.test.tsx
    - apps/dispatch-control/__tests__/WorkspaceOutlineEmptyState.test.tsx
    - apps/dispatch-control/__tests__/WorkspaceDraftLoadLoop.test.tsx

key-decisions:
  - "Desk's run-band state is a 4-kind union ({loading, unknown, ok, none}), not the 3-kind precedent IssueCard/issues-page use — 'still loading whether an issue exists' and 'confirmed no issue exists' needed to render differently, and conflating them would have shown 'No issue in progress' during the initial issuesList fetch."
  - "The Draft-stage frame branch lives in ONE place (FrameChrome's grid, keyed on draftFocus = currentStageSegment === 'draft') rather than per-stage-page opt-outs — every other stage's markup is untouched, byte-for-byte."
  - "StoryFindingsRail does not implement Dismiss (mockup shows one) — Accept/Edit/Dismiss stay exclusively in AnnotationMark's popover; Jump-to-it scrolls to and clicks the mark, opening that same popover, so Dismiss is one interaction away without forking the annotation system."

requirements-completed: [DESK-01, DESK-02, DESK-03, DRAFT-01, DRAFT-02, DRAFT-03]

# Metrics
duration: ~45min
completed: 2026-07-30
---

# Quick 260730-i4j: Work-First Desk Front Door + Draft Focus Summary

**A new `/desk` front door (run band + deriveTasks() ledger + quiet strip) replaces the Issues-home root redirect, and the Draft stage drops both frame rails in favor of one conditional 292px story-scoped findings rail — zero new Convex queries, zero pipeline changes.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-07-30
- **Tasks:** 3 completed (Task 2 and Task 3 both `tdd="true"`)
- **Files modified:** 24 (10 created, 14 modified)

## Accomplishments

- **The Desk (`/desk`).** One run band (issue number, status chip, elapsed, cost vs. budget, claim coverage, a 5-cell stage strip with written state labels) plus every open task from `deriveTasks()`, grouped Must fix / Review recommended / Worth knowing, each row deep-linking to its existing `primary.href`. A quiet strip demotes the four blocks the old Issues home led with (next discovery, held, recently published, new issue) to a single bottom row, all linking to `/issues`. Root redirect and the first Editorial nav item now point here; `/issues` is byte-unchanged and stays reachable as the archive.
- **Draft focus.** `issues/[issueNumber]/layout.tsx`'s `FrameChrome` now branches its content grid on `currentStageSegment === 'draft'`: Draft renders `{children}` full width with no `WorkspaceOutline` and no `ContextPanel`; every other stage keeps the unchanged 3-column `232px/1fr/320px` frame.
- **StoryFindingsRail.** A new pure, story-scoped open-findings rail rendered inside `StoryFocusView`'s Draft tab panel — only when the open story has open findings and isn't mid-edit. A clean story runs the full canvas width (the rail returns `null`, never a collapsed shell). Reuses `AnnotationMark`'s existing popover for Accept/Edit/Dismiss via a scroll-and-click "Jump to it" — no forked resolution UI.
- **Stories picker.** A `Stories` disclosure in `StoryFocusView`'s crumb row restores the outline's two capabilities (jump to any of the 9 sections, per-section state mark) at zero extra clicks, now that the left rail is gone on Draft.
- Shared plumbing: `lib/scheduleLabel.ts` (extracted, not duplicated, from `issues/page.tsx`) and `lib/derivedState.ts`'s new `TASK_SEVERITY_RENDER_ORDER` / `formatElapsed` are the single source both the Desk and My Tasks now consume.

## Task Commits

Each task was committed atomically; Tasks 2 and 3 (both `tdd="true"`) each have a RED test commit followed by a GREEN implementation commit:

1. **Task 1: Shared plumbing + /desk route scaffolding + root redirect** - `5e56acb` (feat)
2. **Task 2 (RED): failing test for DeskBody** - `ba00698` (test)
2. **Task 2 (GREEN): implement the Desk** - `5204fa5` (feat)
3. **Task 3 (RED): failing tests for Draft-focus frame + findings rail** - `6cb8913` (test)
3. **Task 3 (GREEN): Draft focus — conditional frame, story-scoped findings rail, story picker** - `d577006` (feat)

## Files Created/Modified

- `apps/dispatch-control/lib/scheduleLabel.ts` (new) - `DEFAULT_CADENCE`/`readConfigValue`/`formatScheduledForLabel`, extracted verbatim from `issues/page.tsx`
- `apps/dispatch-control/lib/derivedState.ts` - adds `TASK_SEVERITY_RENDER_ORDER` (shared severity-bucket render order) and `formatElapsed` (wall-clock-independent elapsed-time formatter)
- `apps/dispatch-control/lib/nav.ts` - `Desk` is now the first Editorial nav item, ahead of `Issues`
- `apps/dispatch-control/app/(dashboard)/page.tsx` - root redirect now targets `/desk` (was `/issues`)
- `apps/dispatch-control/app/(dashboard)/issues/page.tsx` - imports the extracted schedule helpers; rendered output unchanged
- `apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx` - imports `TASK_SEVERITY_RENDER_ORDER` instead of a private duplicate array
- `apps/dispatch-control/app/(dashboard)/desk/page.tsx` (new) - the `/desk` route mount
- `apps/dispatch-control/app/(dashboard)/desk/_components/DeskScreen.tsx` (new) - `DeskBody` (pure) + `DeskScreen` (Convex wrapper): run band, severity-grouped task ledger, quiet strip
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx` - `FrameChrome` branches the content grid on `draftFocus`; Draft renders full width, every other stage unchanged
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/page.tsx` - unmounts the now-orphaned `<DraftPanelPublisher />`
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/DraftPanelContent.tsx` - header note only; `buildDraftPanelContent` untouched and still tested
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFocusView.tsx` - adds the `Stories` disclosure to the crumb row; wraps the Draft tab panel in a conditional grid + renders `StoryFindingsRail`
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFindingsRail.tsx` (new) - the pure, story-scoped open-findings rail
- `apps/dispatch-control/components/galley/AnnotationMark.tsx` - additive `id`/`data-finding-id` on the `<mark>` (the rail's jump anchor)
- `apps/dispatch-control/__tests__/nav.test.ts` - updated first-Editorial-item assertion (Desk, then Issues)
- `apps/dispatch-control/__tests__/DeskScreen.test.tsx` (new) - 11 tests covering every `DeskBody` behavior bullet
- `apps/dispatch-control/__tests__/DraftFocusFrame.test.tsx` (new) - 3 tests mounting the real `IssueWorkspaceLayout` at Draft vs. Fact Check
- `apps/dispatch-control/__tests__/StoryFindingsRail.test.tsx` (new) - 4 pure-fixture tests
- `apps/dispatch-control/__tests__/WorkspaceContextPanelSlot.test.tsx` - pathname moved to `/issues/7/fact-check` (ContextPanel no longer mounts on Draft)
- `apps/dispatch-control/__tests__/WorkspaceOutlineEmptyState.test.tsx` - pathname moved to `/issues/7/story` (outline no longer mounts on Draft)
- `apps/dispatch-control/__tests__/WorkspaceDraftLoadLoop.test.tsx` - pathname moved to `/issues/7/fact-check` (deviation — see below)

## Decisions Made

- The Desk's run-band state is a 4-kind union (`loading`/`unknown`/`ok`/`none`) rather than the 3-kind `IssueCard`/`issues/page.tsx` precedent — distinguishing "we don't yet know if an issue exists" from "confirmed: no issue in progress" prevents a false "No issue in progress" flash during the initial `issuesList` fetch.
- The Draft-stage frame branch lives in exactly one place (`FrameChrome`'s content grid, keyed on `draftFocus`) — every other stage's 3-column markup is untouched byte-for-byte, and no per-stage-page opt-out was needed.
- `StoryFindingsRail` deliberately omits the mockup's `Dismiss` action — Accept/Edit/Dismiss stay exclusively inside `AnnotationMark`'s existing popover; `Jump to it` scrolls to and clicks the mark, opening that same popover, so building a second dismiss-with-reason flow (forking the annotation system) was avoided.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `WorkspaceDraftLoadLoop.test.tsx`'s sanity assertion broke after the Draft-focus frame change**
- **Found during:** Task 3, running the full `pnpm vitest run` suite after the frame conditional landed
- **Issue:** This pre-existing test (not in the plan's file list) mocks pathname `/issues/7/draft` and used `screen.findByTestId('outline-row-originStory')` purely as a sanity check that draft content actually loaded before asserting the loop-avoidance behavior. Since Draft no longer mounts `WorkspaceOutline`, that node never appears, and the test failed — a direct, mechanical casualty of the same root change the plan explicitly repaired in two sibling test files.
- **Fix:** Moved the mocked pathname to `/issues/7/fact-check` (same fix pattern as `WorkspaceContextPanelSlot.test.tsx` / `WorkspaceOutlineEmptyState.test.tsx`, which the plan named directly) — the draft-load effect under test lives in `WorkspaceStateProvider`, above the frame's per-stage rail branching, so which stage is active is incidental to the behavior being proven.
- **Files modified:** `apps/dispatch-control/__tests__/WorkspaceDraftLoadLoop.test.tsx`
- **Verification:** Full `pnpm vitest run` — 142 test files, 1129 tests, all passing.
- **Committed in:** `d577006` (part of the Task 3 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking test regression, same root cause and same fix pattern as two tests the plan already named).
**Impact on plan:** None on scope or behavior; the fix is a test-fixture-only change with no functional effect.

## Issues Encountered

None. The interfaces section (derivedState.ts exports, issueRouteResolver hrefs, SectionChipList/SectionChipCounts, spanResolver types, StoryFocusView's existing props) matched the codebase exactly — no re-exploration or architectural surprises.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced — every Desk field derives from `lib/derivedState.ts` over already-subscribed Convex queries, and the findings rail consumes the same `resolveSectionFindings` output the Draft tab's galley already renders.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Both mandatory verification gates pass: `pnpm --filter dispatch-control test` (142 test files, 1129 tests, 1 skipped, 2 todo) and `pnpm --filter dispatch-control build` (strict Next.js production build, `/desk` present in the route manifest). No Convex schema, pipeline, or backend changes were made — `deriveTasks`/`deriveIssueStatus`/`deriveStageStates` are consumed, never modified. `?story=&tab=`, `?edit=&finding=`, the hashchange jump-nav, and `useReviewedSections` are all unbroken. Nothing blocks follow-on work.

---
*Quick task: 260730-i4j*
*Completed: 2026-07-30*

## Self-Check: PASSED

All 23 claimed created/modified files verified present on disk. All 5 commit hashes (`5e56acb`, `ba00698`, `5204fa5`, `6cb8913`, `d577006`) verified present in `git log`. `pnpm --filter dispatch-control test` (142 test files, 1129 tests) and `pnpm --filter dispatch-control build` (strict Next.js production build, `/desk` present in the route manifest) both verified green.
