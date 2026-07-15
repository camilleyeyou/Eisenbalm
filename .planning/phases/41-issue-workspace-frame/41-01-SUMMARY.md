---
phase: 41-issue-workspace-frame
plan: 01
subsystem: ui
tags: [typescript, vitest, derived-state, dispatch-control, pure-selectors]

# Dependency graph
requires:
  - phase: 40-mission-control-issue-workspace-scaffold
    provides: "lib/derivedState.ts (DerivationInputs, deriveStageStates, deriveTasks), lib/issueRouteResolver.ts, SectionChipList.tsx EDITABLE_SECTIONS, lib/galley/sectionIdMap.ts qaSectionToGalleyId, lib/galley/findingState.ts isOpenFinding, lib/contentPatchClient.ts DraftResponse"
provides:
  - "deriveSectionStates(inputs, draftSectionIds) — per-section 5-state selector (clean/review/must-fix/changed-since-review/not-generated)"
  - "draftSectionIdsFromDraft(draft) — the single 'which sections are generated' presence source, shared by the outline (41-05) and the Stage-2 canvas (41-08)"
  - "issueStoryHref / issueDraftHref / issueFactCheckHref / issueApprovalHref pure route builders"
  - "deriveTasks' draft/claim/facts-signoff task hrefs retargeted from /review to /draft"
affects: [41-05-workspace-state-outline-panel, 41-06-workspace-frame-layout-nav, 41-08-stage2-draft-recomposition, 41-09-stage5-approval-publish-preview]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Section-level derived-state selector sibling to the existing stage-level one, sharing the same primitives (isOpenFinding, qaSectionToGalleyId) at a narrower grain"
    - "Single presence-source function (draftSectionIdsFromDraft) consumed by two independent UI surfaces (outline + canvas) to make disagreement structurally impossible"
    - "Reserved-but-unproduced union member (changed-since-review) documented with an explicit invariant test rather than omitted from the type"

key-files:
  created: []
  modified:
    - apps/dispatch-control/lib/derivedState.ts
    - apps/dispatch-control/__tests__/derivedState.test.ts
    - apps/dispatch-control/lib/issueRouteResolver.ts
    - apps/dispatch-control/__tests__/issueRouteResolver.test.ts

key-decisions:
  - "deriveSectionStates takes draftSectionIds as an explicit second argument (not internally derived) so callers can pass either draftSectionIdsFromDraft(draft) or a hand-built Set for isolated unit tests"
  - "changed-since-review is kept in the SectionState union (per the plan's literal instruction) but is asserted, via an explicit invariant test, to never be produced by deriveSectionStates in Phase 41"
  - "issueReviewHref is left untouched/exported (not deprecated or removed) since review/page.tsx still imports it until Plan 41-06"

patterns-established:
  - "Pattern: section-level state selectors live in derivedState.ts as siblings to stage-level ones, built from the same shared open-finding/section-id primitives"
  - "Pattern: one function (draftSectionIdsFromDraft) is the sole authority for a fact two independent surfaces must never disagree about"

requirements-completed: [WSP-01, WSP-02, WSP-07]

# Metrics
duration: 12min
completed: 2026-07-15
---

# Phase 41 Plan 01: Selectors + Route Helpers Summary

**Added `deriveSectionStates` (5-state per-section selector) and `draftSectionIdsFromDraft` (the shared draft-presence source for the outline and Stage-2 canvas), plus four Phase-41 stage href builders, with `deriveTasks` retargeted from `/review` to `/draft`.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-15T05:24:58Z
- **Completed:** 2026-07-15T05:33:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `deriveSectionStates(inputs, draftSectionIds)`: per-`EDITABLE_SECTIONS`-entry state (`clean`/`review`/`must-fix`/`changed-since-review`/`not-generated`), grouping open QA findings via `qaSectionToGalleyId` + `isOpenFinding` — the section-level sibling to the existing stage-level `deriveStageStates`.
- `draftSectionIdsFromDraft(draft)`: the single "which sections are generated" source of truth, checking long-read sections via the byte-identical `(draft.sections[id]?.blocks ?? []).length > 0` predicate the Stage-2 canvas (41-08) will render, and the remaining galley sections (bonus/game/podcast/deliberation-conversation/theme) via non-empty top-level payload checks. Type-only `DraftResponse` import keeps the module free of runtime Convex/React/fetch coupling.
- Four new pure route builders in `issueRouteResolver.ts`: `issueStoryHref`, `issueDraftHref`, `issueFactCheckHref`, `issueApprovalHref` (D-05/D-06). `issueReviewHref` and `issueVoiceHref` are unchanged/kept.
- `deriveTasks`' draft/QA-finding, claim, and facts-signoff task hrefs now resolve via `issueDraftHref` instead of `issueReviewHref` (the live post-Phase-41 route); the voice-signoff href via `issueVoiceHref` is untouched.
- Anti-regression test proves a clean, claim-less, finding-less but *generated* section (non-empty draft blocks) reads `'clean'`, never `'not-generated'` — presence comes from real draft content, never inferred absent from side-tables a clean section legitimately lacks.
- Invariant test proves `deriveSectionStates` never emits `'changed-since-review'` in Phase 41 (no content-patch-touch data source exists yet per 41-RESEARCH Open Q3) — every section resolves to one of the four reachable states.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add deriveSectionStates selector + draftSectionIdsFromDraft source (WSP-02/WSP-07)** - `87ca41a` (feat)
2. **Task 2: Add stage href builders to issueRouteResolver (WSP-01, D-05/D-06)** - `14103b4` (feat)

_Note: Task 2's commit also includes a one-line optional-chaining fix in a Task-1-authored test assertion (`result.originStory?.state`), required to satisfy `noUncheckedIndexedAccess` — caught by `tsc --noEmit` before this plan's commit, not a separate deviation._

## Files Created/Modified
- `apps/dispatch-control/lib/derivedState.ts` - adds `SectionState`, `SectionStateResult`, `deriveSectionStates`, `draftSectionIdsFromDraft`; retargets `deriveTasks`' draft/claim/facts-signoff hrefs to `issueDraftHref`
- `apps/dispatch-control/__tests__/derivedState.test.ts` - 12 new test cases covering the 5-state vocabulary, the SAME-SOURCE anti-regression, the changed-since-review invariant, and presence-source parity
- `apps/dispatch-control/lib/issueRouteResolver.ts` - adds `issueStoryHref`/`issueDraftHref`/`issueFactCheckHref`/`issueApprovalHref`
- `apps/dispatch-control/__tests__/issueRouteResolver.test.ts` - 4 new exact-string assertions for the new hrefs

## Decisions Made
- `deriveSectionStates` accepts `draftSectionIds` as an explicit parameter rather than deriving it internally from a `DraftResponse`, so the function stays testable in isolation with hand-built `Set`s while still supporting the canvas-parity fixture-driven cases the plan requires.
- Kept `changed-since-review` in the `SectionState` union (as the plan's literal `<action>` text specifies) rather than omitting it, backed by an explicit "never produced" invariant test rather than a code comment alone.
- Left `issueReviewHref` fully intact (not marked deprecated) since `issues/[issueNumber]/page.tsx` still imports it — removing or renaming it now would break the Wave 1-2 build ahead of Plan 41-06.

## Deviations from Plan

None - plan executed exactly as written. One incidental fix was needed and is documented below under Rule 1 (bug caught by the type checker, not a design deviation).

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a `noUncheckedIndexedAccess` type error in a newly-added test assertion**
- **Found during:** Task 2 (running `tsc --noEmit` as a courtesy check before committing, per CLAUDE.md memory "vitest doesn't type-check")
- **Issue:** `apps/dispatch-control` has `noUncheckedIndexedAccess: true`; `result.originStory.state` (a `Record<string, SectionStateResult>` index access) is typed `SectionStateResult | undefined`, so the direct `.state` property access in the SAME-SOURCE anti-regression test failed `tsc --noEmit`.
- **Fix:** Changed the two assertions to `result.originStory?.state` (optional chaining) — semantically identical for the test's purpose (an undefined result would still correctly fail the `toBe('clean')` assertion).
- **Files modified:** `apps/dispatch-control/__tests__/derivedState.test.ts`
- **Verification:** `pnpm exec tsc --noEmit` no longer reports any error referencing `derivedState.test.ts`, `derivedState.ts`, `issueRouteResolver.ts`, `SectionChipList.tsx`, or `contentPatchClient.ts`; vitest suite re-run green (26/26 in that file).
- **Committed in:** `14103b4` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Zero scope creep — a pre-existing project-wide `tsconfig.base.json` strictness setting (`noUncheckedIndexedAccess`) surfaced a type error in a test I had just written; fixed in place before commit.

## Issues Encountered

None beyond the type-check fix documented above. `tsc --noEmit` on the whole `apps/dispatch-control` workspace surfaces ~20 pre-existing errors in unrelated files (`syntheticPortableText.test.ts`, `voicePassAxis.test.ts`, `WriterExpansion.test.tsx`) — confirmed unrelated to this plan (none of the touched files appear in that error set) and out of this plan's scope per CLAUDE.md SCOPE BOUNDARY; not fixed, not logged to a separate deferred-items file since they predate this plan and are unrelated to any file this plan modified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `deriveSectionStates` and `draftSectionIdsFromDraft` are ready for Plan 41-05 (Workspace outline/state provider) to consume directly.
- `draftSectionIdsFromDraft`'s long-read presence predicate is documented as the exact byte-for-byte rule Plan 41-08's Stage-2 canvas must also implement (`(section?.blocks ?? []).length === 0` for "not generated") — Plan 41-08 should NOT re-derive this independently.
- `issueDraftHref`/`issueStoryHref`/`issueFactCheckHref`/`issueApprovalHref` are ready for Plan 41-06 (frame layout/nav) and downstream stage pages to consume.
- `issueReviewHref` remains live and imported by `issues/[issueNumber]/page.tsx` — Plan 41-06/41-08 will retire that usage when the frame/redirect land.
- No blockers identified for Wave 2 (Plans 41-02 through 41-05, which depend on 41-01 per the phase's dependency graph).

---
*Phase: 41-issue-workspace-frame*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 5 claimed files found on disk; both task commits (`87ca41a`, `14103b4`) found in git history.
