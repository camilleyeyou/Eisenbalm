---
phase: 36-voice-pass-de-slop-screen
plan: 07
subsystem: ui
tags: [nextjs, react, next-navigation, useSearchParams, useRouter, dispatch-control, voice-pass, review-desk]

# Dependency graph
requires:
  - phase: 36-voice-pass-de-slop-screen (36-04)
    provides: the Voice Pass screen mounting the promoted Galley scoped to VOICE_AXES
  - phase: 36-voice-pass-de-slop-screen (36-06)
    provides: the AnnotationMark voice-tell label variant (Accept rewrite / Write my own / Keep-not-a-tell) and VoicePassRail
provides:
  - "Review Desk reads an ?edit=<sectionId>[&finding=<findingId>] deep-link and opens the Phase 31 SectionEditorPanel on mount, once per mount"
  - "Voice Pass's 'Write my own' action deep-links into that Review Desk editor instead of being an inert no-op"
affects: [37-run-monitor-v2-signal-desk, any-future-voice-pass-or-review-desk-editing-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-screen deep-link via query param + once-per-mount ref guard (deepLinkAppliedRef), rather than building a duplicate editor surface"
    - "Reuse-in-place over new surfaces — the phase's established pattern, now applied to cross-screen navigation"

key-files:
  created: []
  modified:
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx"
    - "apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx"
    - "apps/dispatch-control/__tests__/VoicePassScreen.test.tsx"

key-decisions:
  - "Deep-link into the EXISTING Review Desk SectionEditorPanel rather than building a second inline editor on Voice Pass — zero new editing machinery, matches D-09 literally"
  - "Deep-link fires at most once per mount via a useRef guard, gated on the draft being loaded, so it never re-fires on later in-page navigation (chip clicks, Back to galley)"

patterns-established:
  - "Query-param deep-link entry into an existing view-mode state machine (?edit=<id>[&finding=<id>] -> handleEditSection) as the standard way to route a second screen into a screen-local editor"

requirements-completed: [VOX-02]

# Metrics
duration: ~27min
completed: 2026-07-09
---

# Phase 36 Plan 07: Voice Pass "Write My Own" Gap Closure Summary

**Review Desk gains a `?edit=<sectionId>[&finding=<findingId>]` deep-link entry into its Phase 31 section editor; Voice Pass's "Write my own" action now pushes to it instead of being an inert no-op — closing the VOX-02/D-09 gap flagged by the Phase 36 verifier.**

## Performance

- **Duration:** ~27 min
- **Started:** 2026-07-09T14:52:00Z (approx.)
- **Completed:** 2026-07-09T15:18:19Z
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- Review Desk (`review-desk/[runId]/page.tsx`) now reads `?edit=`/`?finding=` from `useSearchParams()` and calls the existing `handleEditSection` once the draft has loaded, guarded by a `deepLinkAppliedRef` so it fires at most once per mount and never re-triggers on later in-app navigation.
- Voice Pass (`voice-pass/[runId]/page.tsx`)'s `handleEditSection` — previously an intentionally inert stub — now builds `/review-desk/{runId}?edit={sectionId}&finding={findingId}` (finding omitted when absent) and calls `router.push()`.
- All three VOX-02 tell actions (Accept rewrite, Write my own, Keep-not-a-tell) are now fully functional; D-09 ("Write my own = Edit inline") is satisfied with zero new editor surface.
- `VoicePassScreen.test.tsx` gained a `next/navigation` `useRouter` mock (via `vi.hoisted`) and a new test that clicks through the actual rendered voice-tell mark/popover UI and asserts the resulting `push()` URL contains `review-desk`, `edit=`, and `finding=`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Review Desk opens the section editor from an ?edit= deep-link** - `39ed301` (feat)
2. **Task 2: Wire Voice Pass "Write my own" to the Review Desk edit deep-link** - `8836467` (feat)

**Plan metadata:** (this commit) — docs: complete plan

_Note: both tasks were marked `tdd="true"` in the plan; Task 1 had no new dedicated test file in its file list (verified via the full vitest suite + build, per its own acceptance criteria) — Task 2 added the one new test the plan specified._

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx` - adds `useSearchParams` read + once-per-mount deep-link effect calling the existing `handleEditSection`
- `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx` - replaces the inert `handleEditSection` stub with a `router.push()` to the Review Desk `?edit=` deep-link
- `apps/dispatch-control/__tests__/VoicePassScreen.test.tsx` - mocks `next/navigation`'s `useRouter`; adds a test asserting the "Write my own" click pushes the expected deep-link URL

## Decisions Made
- Reused the Review Desk's existing `handleEditSection`/`viewMode` state machine rather than adding a second editor surface to Voice Pass — the plan's own stated lowest-cost fix, and consistent with the phase's "reuse-in-place over new surfaces" pattern (rules.py, judge.py, qaCorrections, findings.py, AnnotationMark all reused elsewhere in this phase).
- Used a `useRef` guard (`deepLinkAppliedRef`) rather than clearing the query param after use — simpler, no router.replace() needed, and the effect naturally can't re-fire since the ref persists for the component's lifetime.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria (grep checks, targeted test run, full vitest suite, strict build) were met without needing any Rule 1-3 auto-fixes.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Phase 36 verification gap (VOX-02 "Write my own" inert stub) is closed. All four VOX-01..04 requirements are now fully satisfied end-to-end.
- Manual verification is still recommended (not blocking): from `/voice-pass`, click a machine-tell, click "Write my own", confirm landing in the Review Desk editor focused on that section with the finding's reason visible — carried in `36-07-HUMAN-UAT.md`/phase HUMAN-UAT as appropriate.
- No blockers for Phase 37 (Run Monitor v2 / Signal Desk) or any future editing work on Review Desk/Voice Pass.

---
*Phase: 36-voice-pass-de-slop-screen*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx`
- FOUND: `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx`
- FOUND: `apps/dispatch-control/__tests__/VoicePassScreen.test.tsx`
- FOUND commit `39ed301` (Task 1)
- FOUND commit `8836467` (Task 2)
