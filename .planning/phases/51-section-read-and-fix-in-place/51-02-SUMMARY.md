---
phase: 51-section-read-and-fix-in-place
plan: 02
subsystem: ui
tags: [nextjs, app-router, route-groups, css, react-context]

# Dependency graph
requires:
  - phase: 51-01
    provides: EDITABLE_SECTIONS/SectionMeta promoted to lib/, phrasingSafe ClaimProvenanceCard, label-independent voice-accept trigger
provides:
  - "app/(editorial)/ route group shell — a sibling of app/(dashboard)/ with its own Confirm -> CommandPalette -> Inspector provider stack and zero console chrome"
  - ".section-reader CSS scope — 760px reading measure, 17.5px Lora body, 16px scroll-margin — additive-only to app/globals.css"
affects: [51-04, 51-05, 51-07, 52, 54]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling route-group shells each mount their own independent provider instance when the context's throw-outside-provider contract requires an ancestor that a sibling group does not have (InspectorProvider is not shared across (dashboard) and (editorial))."
    - "Scoped CSS overrides for shared type/scroll-margin rules: wrap the override selector in a new descendant class (.section-reader) rather than editing the shared rule, so unrelated consumers (Review Desk, Voice Pass) are provably untouched."

key-files:
  created:
    - apps/dispatch-control/app/(editorial)/layout.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/layout.tsx
    - apps/dispatch-control/app/globals.css

key-decisions:
  - "Doc comment in the new (editorial) layout describes the no-chrome and no-onboarding-tour constraints without repeating the literal component names (AppSidebar/Masthead/MobileNavDrawer/AutoPublishBanner/OnboardingProvider) — the plan's own Task 1 acceptance criteria greps the file for those exact tokens and expects zero matches, which conflicts with the plan's own suggested doc-comment text; the mechanical no-chrome-imported check was treated as authoritative since that's what genuinely matters (no chrome is imported or rendered)."
  - "middleware.ts left unchanged — its existing Clerk matcher is a catch-all (excludes only _next internals and static file extensions) and already covers /s/:path*, so no matcher edit was needed."

requirements-completed: [READ-01]

# Metrics
duration: 8min
completed: 2026-07-31
---

# Phase 51 Plan 02: Editorial Route Group Shell + Scoped Reading Typography Summary

**New `(editorial)` App Router route group with its own Confirm/CommandPalette/Inspector provider stack and zero console chrome, plus an additive-only `.section-reader` CSS scope (760px measure, 17.5px Lora body, 16px scroll-margin) that leaves `.galley-body` (16.5px) and the shared `[id^='galley-']` (88px) rule byte-unchanged.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `app/(editorial)/layout.tsx` created — a sibling of `app/(dashboard)/`, mounting `ConfirmProvider > CommandPaletteProvider > InspectorProvider` in the load-bearing order (InspectorProvider's panel calls `useConfirm`, so Confirm/CommandPalette must be outer). No `AppSidebar`, `Masthead`, `MobileNavDrawer`, `AutoPublishBanner`, or `OnboardingProvider` — and no `page.tsx` at the group root (D-01 reserves `/` for Phase 52).
- `(dashboard)/layout.tsx` doc comment rescoped from a false app-wide claim ("the ONE place [InspectorProvider] is ever mounted app-wide") to an accurate per-route-group claim, noting the sibling `(editorial)` group's independent instance. Zero code change in that file — verified via a comment-only diff assertion.
- `app/globals.css` gained a new, clearly-commented `.section-reader` block (760px max-width, 24px inline padding; `.section-reader .galley-body` at 17.5px/1.7; `.section-reader [id^='galley-']` at 16px scroll-margin-top) appended at the end of the file — every existing rule, including `.galley-body` (16.5px) and the bare `[id^='galley-']` rule (88px), is unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create app/(editorial)/layout.tsx with its own provider stack and correct the (dashboard) doc comment** - `588c03a` (feat)
2. **Task 2: Add the .section-reader scoped measure, body type and scroll-margin override to globals.css** - `f07d533` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/dispatch-control/app/(editorial)/layout.tsx` - New minimal editorial shell; own Confirm/CommandPalette/Inspector provider stack; no nav/chrome
- `apps/dispatch-control/app/(dashboard)/layout.tsx` - Doc comment only: rescoped the InspectorProvider "mounted app-wide" claim to "mounted for the (dashboard) route group"
- `apps/dispatch-control/app/globals.css` - Appended `.section-reader` scoped block; no existing rule touched

## Decisions Made
- Reworded the new layout's doc comment to avoid the literal strings `AppSidebar`/`Masthead`/`MobileNavDrawer`/`AutoPublishBanner`/`OnboardingProvider` while preserving the same meaning, because the plan's own Task 1 acceptance criteria greps for exactly those tokens and expects no matches — the plan's suggested example comment text (which does use those tokens) would have failed its own mechanical check. Treated the grep-based "no chrome imported/rendered" check as authoritative since that's the actual safety property being verified.
- Left `middleware.ts` untouched: its Clerk route matcher is already a catch-all (`/((?!_next|...\.(?:extensions)).*)`), which covers `/s/:path*` with no edit needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan text] Doc-comment wording adjusted to satisfy the plan's own acceptance-criteria grep**
- **Found during:** Task 1
- **Issue:** The plan's `<action>` prescribed doc-comment text containing "No AppSidebar, no Masthead" and "OnboardingProvider is NOT mounted here," but the same task's `<acceptance_criteria>` greps the new file for `AppSidebar|Masthead|MobileNavDrawer|AutoPublishBanner|OnboardingProvider` and requires zero matches — the two requirements are mutually exclusive as literally specified.
- **Fix:** Kept the doc comment's substance (no chrome components render here; the guided tour is a dashboard-only concern) but paraphrased around the specific proper nouns so the mechanical check (confirming no chrome import/usage) passes.
- **Files modified:** `apps/dispatch-control/app/(editorial)/layout.tsx`
- **Verification:** `grep -n "AppSidebar\|Masthead\|MobileNavDrawer\|AutoPublishBanner\|OnboardingProvider" "apps/dispatch-control/app/(editorial)/layout.tsx"` returns no matches; `grep -n "InspectorProvider"` and `grep -n "ConfirmProvider"` both match as required.
- **Committed in:** `588c03a`

---

**Total deviations:** 1 auto-fixed (1 plan-text inconsistency)
**Impact on plan:** Cosmetic wording only — no functional or scope change. The layout's actual behavior (no chrome, its own provider stack) matches the plan's intent exactly.

## Issues Encountered

- `apps/dispatch-control/__tests__/Galley.test.tsx` has one failing test — `Phase 51 — D-09 and D-20 are independent (real pipeline) > D-09 suppresses the sourced wash while D-20 still surfaces its evidence in the finding popover`. This is **not** a regression caused by this plan: it was already failing identically before either of this plan's commits (confirmed via `git stash`/re-run on the pre-51-02 tree), and `51-00-SUMMARY.md` documents that this exact test is a Wave 0 scaffold exercising both D-09 (shipped in 51-01) **and** D-20 (not shipped until plan 51-07 — "Evidence in the finding popover"). It is expected to stay red until 51-07 lands. `apps/dispatch-control/__tests__/PassageToolbar.test.tsx` passes fully (all tests). This plan's own two changed files (`app/(editorial)/layout.tsx`, `app/globals.css`) are unrelated to `ClaimProvenanceCard`/`AnnotationMark` (the files that test exercises), so no fix was attempted here — out of scope per the deviation-rules scope boundary.

## Next Phase Readiness
- The `(editorial)` route group shell and `.section-reader` typography scope are ready for plan 51-04 (`app/(editorial)/s/[section]/page.tsx`) to build on directly — `useInspector()` now has a provider ancestor in this group, and any wrapper element carrying `.section-reader` will pick up the locked 760px/17.5px/16px values automatically.
- No blockers introduced by this plan. The one known-red test (`Galley.test.tsx` D-09/D-20 case) remains tracked against plan 51-07 as already documented in `51-00-SUMMARY.md`.

---
*Phase: 51-section-read-and-fix-in-place*
*Completed: 2026-07-31*

## Self-Check: PASSED

- FOUND: `apps/dispatch-control/app/(editorial)/layout.tsx`
- FOUND: `.planning/phases/51-section-read-and-fix-in-place/51-02-SUMMARY.md`
- FOUND: commit `588c03a`
- FOUND: commit `f07d533`
