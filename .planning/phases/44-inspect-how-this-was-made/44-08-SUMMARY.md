---
phase: 44-inspect-how-this-was-made
plan: 08
subsystem: ui
tags: [react, nextjs, convex, inspector, dispatch-control, derived-state, my-tasks, review-desk, story]

# Dependency graph
requires:
  - phase: 44-06
    provides: "components/inspector/InspectorProvider.tsx's useInspector()/openInspector, mounted once at the (dashboard) root layout -- the opener every entry point below calls"
  - phase: 44-03
    provides: "lib/inspectorArtifact.ts's encodeArtifactKey/resolveInspectorStep -- the 'rec'/'org'/'founder'/'claim' artifact-type encoding this plan consumes"
provides:
  - "lib/derivedState.ts::deriveTasks populates DerivedTask.insp (encoded artifact-key string) for qa-finding tasks (type 'founder', locator = sectionName) and claim tasks (type 'claim', locator = claimId); sign-off tasks deliberately leave it unset"
  - "MyTasksScreen.tsx's 'Inspect context' button is now live -- enabled + calling openInspector(task.insp) whenever a task carries insp, reserved only for the two sign-off rows"
  - "DecisionRail.tsx's 'Agent editor's recommendation' section gains an 'Inspect how this was made' affordance resolving to the rec artifact (editor_final)"
  - "StoryPanelContent.tsx's winner card gains an 'Inspect how this was made' affordance resolving to the org artifact (scout) -- a LIVE entry point, not a Phase 46/47 reserved stub"
affects: [44-09-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function-with-optional-callback: buildStoryPanelContent(pitchRows, onInspect?) keeps the story panel's render function Convex/hook-free and directly testable, while the real publisher supplies onInspect via useInspector() + the workspace's runId"
    - "Optional-prop-with-no-op-default: MyTasksList's openInspector prop defaults to () => {} so the pure render half stays callable (and its existing fixture-driven tests pass unmodified) without threading a live inspector context through every test"
    - "useInspector() ripple: any component that starts calling useInspector() must be wrapped in <InspectorProvider> everywhere it's rendered in tests (DecisionRail.test.tsx's 36 render call sites, StageContextPanels.test.tsx's Story publisher plumbing test) -- same ripple 44-07 hit with FactCheckScreen/VoicePassScreen"

key-files:
  created: []
  modified:
    - apps/dispatch-control/lib/derivedState.ts
    - apps/dispatch-control/__tests__/derivedState.test.ts
    - "apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx"
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx"
    - apps/dispatch-control/__tests__/DecisionRail.test.tsx
    - "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx"
    - apps/dispatch-control/__tests__/StageContextPanels.test.tsx

key-decisions:
  - "Kept qa-finding insp anchoring at type:'founder' for BOTH factual and voice-axis findings (no ternary branching), per RESEARCH: a voice-axis finding still traces back to the same section writer, so there is exactly one artifact type to anchor to regardless of axis."
  - "MyTasksList's openInspector prop is optional with a () => {} default (not a required prop) so the existing MyTasksScreen.test.tsx fixtures -- none of which set task.insp -- continue to exercise the disabled branch unmodified; only the default-export MyTasksScreen wrapper (never rendered directly in tests) supplies the live useInspector() callback."
  - "StoryPanelContent's org affordance lives on the winner card only, not the candidate list items -- the resolver's org type always resolves to scout regardless of locator (no per-candidate differentiation exists yet), so a single winner-card entry point satisfies the live, non-degraded org path without adding UI that would functionally duplicate the same artifact."
  - "Every new button label reads 'Inspect how this was made', matching the exact wording 44-07 already established on the draft/voice/fact-check entry points -- the plan's DecisionRail task text suggested a shorter 'Inspect' label with an icon, but the rail's own existing action buttons (Publish, Hold, Re-run, Transcript) are icon-free plain-text buttons, so matching the rail's real styling (per the task's own instruction) took precedence over the generic label suggestion."

patterns-established: []

requirements-completed: [INS-01]

# Metrics
duration: ~20min
completed: 2026-07-15
---

# Phase 44 Plan 08: Entry Points — Approval, My Tasks, Org Summary

**Wired the final three of six "Inspect how this was made" entry points (approval recommendation → editor_final, My Tasks → qa/claim artifacts, brief org card → scout) to the single shared `openInspector`, and populated `DerivedTask.insp` in `deriveTasks` — the field My Tasks needed that had been declared but never assigned since Phase 43.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-15T21:12:37Z (approx, STATE.md session start)
- **Completed:** 2026-07-15T21:31:28Z
- **Tasks:** 3
- **Files modified:** 7 (4 source, 3 test)

## Accomplishments

- `lib/derivedState.ts::deriveTasks` now calls `encodeArtifactKey` to set `DerivedTask.insp` on qa-finding tasks (`type: 'founder'`, `locator: sectionName`) and claim tasks (`type: 'claim'`, `locator: claimId`) — the field was declared on `DerivedTask` since Phase 43 but never assigned in any of the three task-construction blocks; sign-off tasks (`signoff-facts`/`signoff-voice`) deliberately leave it unset per 44-RESEARCH Open Question 1 (no single natural artifact anchors a sign-off gate)
- `MyTasksScreen.tsx`'s reserved "Inspect context" button is now live: enabled and calling `openInspector(task.insp)` for every qa/claim task; stays reserved (disabled, with an honest title) for the two sign-off rows that never carry `insp`
- `DecisionRail.tsx`'s "Agent editor's recommendation" section gained an "Inspect how this was made" button, rendered only when a recommendation exists, calling `openInspector({ type: 'rec', runId, locator: '' })` — resolves to `editor_final`
- `StoryPanelContent.tsx`'s winner card gained an "Inspect how this was made" button calling `openInspector({ type: 'org', runId, locator: winner._id })` — resolves to `scout`. Confirmed as a LIVE entry point (Scout's pitchLog is real for every run to date), not gated behind any Phase 46/47 reserved state, correcting CONTEXT.md's more pessimistic characterization per 44-RESEARCH's "State of the Art" table
- With this plan, all six of the phase's required entry points (draft passage, voice finding, fact-check claim, approval recommendation, My Tasks, brief org) now open the same shared inspector panel
- Extended `derivedState.test.ts` with 4 new tests covering the `insp` field's decode round-trip for qa (factual and voice-axis), claim, and sign-off (unset) tasks
- Full `pnpm --filter dispatch-control build` and `pnpm --filter dispatch-control test` (96 files, 834 tests, 2 pre-existing unrelated `it.todo`s) both pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Populate DerivedTask.insp in deriveTasks + cover it in derivedState.test.ts** - `f1ecab2` (feat)
2. **Task 2: Enable My Tasks "Inspect context" + wire the approval recommendation Inspect** - `93423a1` (feat)
3. **Task 3: Wire the brief organization card (live, resolves to scout)** - `b5665c6` (feat)

## Files Created/Modified

- `apps/dispatch-control/lib/derivedState.ts` - `deriveTasks` now imports `encodeArtifactKey` and sets `insp` on qa-finding + claim task-construction blocks; sign-off block untouched (still omits `insp`)
- `apps/dispatch-control/__tests__/derivedState.test.ts` - new `describe` block: decode-round-trip coverage for qa (factual + voice-axis), claim, and sign-off `insp` values via `parseArtifactKey`
- `apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx` - `MyTasksList` gains an optional `openInspector` prop (default no-op); the "Inspect context" button branches live/reserved on `task.insp`; the default-export wrapper supplies `useInspector().openInspector`
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` - calls `useInspector()`; "Agent editor's recommendation" section renders an "Inspect how this was made" button (rec artifact) alongside the memo text, only when a recommendation exists
- `apps/dispatch-control/__tests__/DecisionRail.test.tsx` - added a `renderRail()` helper wrapping every `<DecisionRail>` render in `<InspectorProvider>` (36 call sites, via a single substring `replace_all`)
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx` - `buildStoryPanelContent` takes an optional `onInspect` param; the winner card renders an "Inspect how this was made" button when supplied; `StoryPanelPublisher` wires it via `useInspector()` + `useWorkspaceState().runId`
- `apps/dispatch-control/__tests__/StageContextPanels.test.tsx` - wraps the Story publisher's plumbing-block render in `<InspectorProvider>`

## Decisions Made

- **Qa-finding `insp` anchors to `type: 'founder'` regardless of factual/voice-axis distinction.** The plan's own action text showed a ternary that evaluates to `'founder'` on both branches — a voice-axis finding still traces back to the same section writer as a factual one, so there is genuinely one artifact type here, not two. Added an explicit test (`a voice-axis qa-finding task ALSO anchors to founder`) to lock this in rather than leaving it implicit.
- **`MyTasksList.openInspector` is optional with a `() => {}` default, not a required prop.** The existing `MyTasksScreen.test.tsx` fixtures (`makeActiveTask()` etc.) never set `insp`, so they always exercise the disabled branch; making the prop required would have forced editing that test file for no functional gain. Only the default-export `MyTasksScreen` (never rendered directly in any test) supplies the live `useInspector()` callback.
- **The org affordance lives only on the winner card, not per-candidate.** `resolveInspectorStep`'s `org` case always resolves to `scout` regardless of `locator` (§44.3) — there is no per-candidate differentiation in the resolved artifact today, so adding a second entry point on each candidate row would not surface different content, just duplicate the same affordance. Kept to the winner card per the plan's literal `openInspector({ type: 'org', runId, locator: winner._id ?? '' })` example.
- **Button label is "Inspect how this was made" everywhere, including DecisionRail**, matching 44-07's established wording on the draft/voice/fact-check entry points exactly, and DecisionRail's own icon-free plain-text button convention (Publish/Hold/Re-run/Transcript) — the plan's suggested shorter "Inspect" label with an icon was not followed since it would have been visually inconsistent with the rail's real existing buttons and with the other five entry points' established copy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wrapped `DecisionRail.test.tsx`'s 36 render call sites in `<InspectorProvider>`**
- **Found during:** Task 2 verification (`pnpm --filter dispatch-control test`)
- **Issue:** `DecisionRail` now calls `useInspector()` (for the new recommendation Inspect button), but its existing test file rendered `<DecisionRail>` directly, unwrapped, in 36 places. `useInspector()` throws `'useInspector must be used within an InspectorProvider'` outside a provider — a direct, unavoidable consequence of the required wiring, not a pre-existing bug.
- **Fix:** Added a `renderRail(ui)` helper wrapping `render()` in `<InspectorProvider>`, then replaced every `render(<DecisionRail` call-site prefix with `renderRail(<DecisionRail` via a single exact-substring `replace_all` (safe since the render call is always immediately followed by `<DecisionRail`, regardless of props). `activeKey` stays `null` throughout — no test clicks Inspect, so no new Convex reads or panel renders are exercised.
- **Files modified:** `apps/dispatch-control/__tests__/DecisionRail.test.tsx`
- **Verification:** `pnpm --filter dispatch-control test -- __tests__/DecisionRail.test.tsx` — 37 tests passing, zero failures
- **Committed in:** `93423a1` (Task 2 commit)

**2. [Rule 3 - Blocking] Wrapped `StageContextPanels.test.tsx`'s Story-publisher plumbing render in `<InspectorProvider>`**
- **Found during:** Task 3 verification (`pnpm --filter dispatch-control test`)
- **Issue:** `StoryPanelPublisher` now calls `useInspector()` (to supply the winner card's `onInspect`), but its one plumbing-block test (`'Story publisher calls setPanelContent on mount with a defined node'`) rendered `<StoryPanelPublisher />` directly, unwrapped. Same class of failure as #1 above, isolated to the single render call that mounts the real publisher component (the three `buildStoryPanelContent(...)` unit tests earlier in the file are unaffected — that function's new `onInspect` param is optional).
- **Fix:** Wrapped that one `render(<StoryPanelPublisher />)` call in `<InspectorProvider>`.
- **Files modified:** `apps/dispatch-control/__tests__/StageContextPanels.test.tsx`
- **Verification:** `pnpm --filter dispatch-control test -- __tests__/StageContextPanels.test.tsx` — 20 tests passing, zero failures
- **Committed in:** `b5665c6` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both blocking, both the same class of `useInspector()`-outside-provider ripple 44-07 already established a precedent for)
**Impact on plan:** Both fixes are the necessary, unavoidable consequence of the plan's own required wiring — no scope creep, no forked components, no new Convex reads introduced by either test change.

## Issues Encountered

None beyond the two test-wrapping fixes documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All six of the phase's required "Inspect how this was made" entry points (INS-01) are now live: draft passage, voice finding, fact-check claim detail (44-07) plus approval recommendation, My Tasks, brief org card (this plan) — every one calls the same `useInspector().openInspector` with the correct artifact key.
- `DerivedTask.insp` is populated for every task type that has a natural single artifact (qa findings, claims) and deliberately absent for the two that don't (sign-offs) — the honest, documented state 44-RESEARCH recommended.
- `pnpm --filter dispatch-control build` and `pnpm --filter dispatch-control test` (96 files / 834 tests, 2 pre-existing unrelated `it.todo`s) both green. No blockers for 44-09's integration gate.

---
*Phase: 44-inspect-how-this-was-made*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/lib/derivedState.ts
- FOUND: apps/dispatch-control/__tests__/derivedState.test.ts
- FOUND: apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx
- FOUND: apps/dispatch-control/__tests__/DecisionRail.test.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx
- FOUND: apps/dispatch-control/__tests__/StageContextPanels.test.tsx
- FOUND: f1ecab2 (Task 1 commit)
- FOUND: 93423a1 (Task 2 commit)
- FOUND: b5665c6 (Task 3 commit)
