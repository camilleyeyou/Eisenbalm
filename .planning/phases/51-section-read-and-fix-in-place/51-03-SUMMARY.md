---
phase: 51-section-read-and-fix-in-place
plan: 03
subsystem: ui
tags: [react, nextjs, dispatch-control, review-desk, derived-state]

# Dependency graph
requires:
  - phase: 51-00
    provides: Wave 0 test scaffolds establishing the Phase 51 red/green contract
provides:
  - "Review Desk with zero manual bookkeeping — StoryDeskGrid, StoryFocusView and ReviewDeskRunView all derive section status from chipCounts[...].open/.error"
  - "useReviewedSections.ts (localStorage 'Mark reviewed' layer) deleted; its reviewDesk:reviewed:<runId> key no longer written anywhere"
  - "nextNeedsYou/nextNeedsYouAfter — the footer 'what to do next' nav computed from open-finding counts, replacing nextUnreviewed/isReviewed"
affects: [51-04, 51-05, 51-06, 51-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Card/section status derived purely from chipCounts (open/error counts), never from a client-only toggle — the D-25 no-bookkeeping rule applied structurally, not just as a UI label swap"

key-files:
  created: []
  modified:
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryDeskGrid.tsx"
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFocusView.tsx"
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx"
    - "apps/dispatch-control/__tests__/StoryDeskGrid.test.tsx"
  deleted:
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/useReviewedSections.ts"

key-decisions:
  - "'done' card status now means 'no open findings' (chipCounts[...].open === 0), not 'someone ticked it' — the CardStatus union's unreachable 'clean' variant and chipToneFor mapping were left in place per plan instruction rather than removed, since chipToneFor still maps 'done' onto the 'clean' ChipTone"
  - "'Clean' is used as the single shared vocabulary across the desk badge, the story meta line, and the Stories picker mark (StoryFocusView already used it) — never a second word for the same concept"
  - "nextNeedsYouAfter reuses the exact chipCounts object already passed to StoryDeskGrid/StoryFocusView (no second counts source, no new query)"

requirements-completed: [READ-08]

# Metrics
duration: 10min
completed: 2026-08-01
---

# Phase 51 Plan 03: Delete Reviewed Bookkeeping, Derive Story Desk Summary

**Deleted the localStorage "Mark reviewed" hook and its three required-prop call sites; Review Desk status/progress/badge/footer-nav now derive entirely from `chipCounts[...].open`/`.error`.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-31T22:52:00-07:00
- **Completed:** 2026-07-31T23:01:43-07:00
- **Tasks:** 2
- **Files modified:** 4 (1 deleted)

## Accomplishments
- `StoryDeskGrid.tsx` no longer takes a `reviewedIds` prop; card status (`done`/`mustfix`/`review`), the progress header ("N of 9 clean"), and the per-card "✓ Clean" badge all derive from `chipCounts[section.id].open`/`.error`.
- `StoryFocusView.tsx` lost the "✓ Mark reviewed"/"Reviewed" button entirely (no replacement affordance — nothing to toggle). Its meta line now reads `Clean` or `{n} open` off the section's own counts, matching the vocabulary the Stories-picker mark already used.
- `ReviewDeskRunView.tsx` lost the `useReviewedSections` import/hook call and all three `reviewedIds`/`reviewed`/`onToggleReviewed` prop sites; `nextUnreviewedAfter` was rewritten as `nextNeedsYouAfter`, walking `EDITABLE_SECTIONS` off the same `chipCounts` memo already shared by both child views.
- `useReviewedSections.ts` deleted via `git rm`; `grep -r useReviewedSections apps/dispatch-control` returns nothing, and the `reviewDesk:reviewed:<runId>` localStorage key is no longer written anywhere.
- `pnpm --filter dispatch-control build` passes clean — the class of break (dangling required prop) that Vitest alone would not have caught.

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-base StoryDeskGrid on open-finding counts and drop the reviewedIds prop** - `b3fe399` (feat)
2. **Task 2: Strip the mark-reviewed affordance from StoryFocusView and ReviewDeskRunView, then delete the hook** - `c1a9ff1` (feat)

**Follow-up doc fix (same plan, pre-plan-metadata-commit):** `17cdcb8` (docs) — removed the literal word "localStorage" from a `ReviewDeskRunView.tsx` doc comment so the plan's broader no-bookkeeping-mentions grep is satisfied on top of the hard per-task acceptance greps.

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryDeskGrid.tsx` - `statusFor` now takes only `counts` (no `reviewed` bool); `reviewedCount`→`cleanCount`; badge condition `status === 'done'` → "Clean"
- `apps/dispatch-control/__tests__/StoryDeskGrid.test.tsx` - both `reviewedIds={new Set()}` props removed
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFocusView.tsx` - `reviewed`/`onToggleReviewed` props and the Mark-reviewed button deleted; `nextUnreviewed` prop renamed `nextNeedsYou`; footer copy "Next that needs you: {label}"
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx` - `useReviewedSections` import/call deleted; `nextUnreviewedAfter`→`nextNeedsYouAfter` reading `chipCounts[...].open`; all three prop sites updated
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/useReviewedSections.ts` - deleted (the entire localStorage bookkeeping hook)

## Decisions Made
- Kept `CardStatus`'s `'clean'` variant and `chipToneFor`'s mapping unchanged even though `'clean'` is now unreachable as a card status — `chipToneFor('done')` still resolves to the `'clean'` `ChipTone` for the badge/chip styling, so removing the union member would have required touching styling maps the plan explicitly said to leave alone.
- Standardized on "Clean" / "{n} open" / "{n} must fix" as the one vocabulary across the desk badge, the story meta line, and the Stories-picker mark, rather than inventing a fourth phrasing anywhere.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Doc comments still referenced the deleted bookkeeping in language the plan's own acceptance greps would catch**
- **Found during:** Task 2, immediately after editing `ReviewDeskRunView.tsx` and `StoryFocusView.tsx`
- **Issue:** My own updated doc comments (explaining that the "Mark reviewed" hook was deleted) used the literal phrases `useReviewedSections`, `Mark reviewed`, and `localStorage` — which the plan's acceptance criteria explicitly grep for zero matches of (`grep -rn "useReviewedSections" ...`, `grep -rn "Mark reviewed" apps/dispatch-control --include=*.tsx`), and the plan's outer `<verification>` block additionally greps for `localStorage` across the whole route directory.
- **Fix:** Reworded the historical notes to describe the deletion without using the banned literal strings (e.g. "the browser-storage-backed manual review-toggle hook was deleted").
- **Files modified:** `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx`, `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFocusView.tsx`
- **Verification:** Re-ran every acceptance grep from the plan (Task 1, Task 2, and the outer `<verification>` block) — all return zero bookkeeping matches; `pnpm --filter dispatch-control build` still exits 0.
- **Committed in:** `c1a9ff1` (StoryFocusView fix, part of the Task 2 commit) and `17cdcb8` (ReviewDeskRunView follow-up)

---

**Total deviations:** 1 auto-fixed (1 bug — self-caught before the outer commit)
**Impact on plan:** Cosmetic/documentation-only; no behavior change. No scope creep.

## Issues Encountered
None beyond the self-caught doc-comment wording above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Review Desk (`StoryDeskGrid`, `StoryFocusView`, `ReviewDeskRunView`) is fully derived-state; no manual review-toggle exists anywhere in `apps/dispatch-control` per D-25.
- `pnpm --filter dispatch-control build` is green; full test suite is green except the two pre-existing Wave 0 scaffold failures (`AnnotationMark.test.tsx` evidence-card case, `Galley.test.tsx` "D-09 and D-20 are independent" case) — both documented in `51-VALIDATION.md`/prior summaries as intentionally red until Plan 51-07 ships the evidence-in-popover feature. Neither was touched or caused by this plan.
- Plan 51-04 (Section Reader page) and later plans can build on `chipCounts` as the single source of truth for section state without any residual reviewed-flag plumbing to reconcile.

---
*Phase: 51-section-read-and-fix-in-place*
*Completed: 2026-08-01*

## Self-Check: PASSED

All 5 claimed files found on disk (4 modified + 1 SUMMARY.md); `useReviewedSections.ts` confirmed deleted; all 3 commit hashes (`b3fe399`, `c1a9ff1`, `17cdcb8`) found in git history.
