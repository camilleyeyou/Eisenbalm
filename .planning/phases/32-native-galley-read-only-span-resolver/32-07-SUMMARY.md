---
phase: 32-native-galley-read-only-span-resolver
plan: 07
subsystem: ui
tags: [react, nextjs, convex, portabletext, review-desk]

# Dependency graph
requires:
  - phase: 32-native-galley-read-only-span-resolver (plans 32-01..32-06)
    provides: the Galley component, GallerySection/GalleryGameSlot, the span resolver (resolveSectionFindings), the QA<->galley section-id bridge (qaSectionToGalleyId), and the draft-read client (getDraft/DraftResponse)
provides:
  - Review Desk defaults to the native galley at /review-desk/[runId] (D-01)
  - SectionChipList upgraded in place with severity-tinted open-finding count badges + an unresolved marker (GLY-05, D-03, D-08, D-09)
  - Chip-click jump-nav (scrollIntoView to #galley-{id}) in galley mode; same chip strip selects the section in edit mode
  - Edit affordance swaps into the Phase 31 SectionEditorPanel and back to the galley
  - Phase 31 PreviewIframe toggle preserved as the soak-cycle fallback (D-02)
affects: [33-annotation-actions-and-decision-rail]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "viewMode state ('galley' | 'edit' | 'iframe') drives one of three mutually-exclusive screen bodies instead of a boolean showPreview flag"
    - "Chip counts computed client-side by re-running the same resolveSectionFindings the galley itself uses, so chip badges and inline annotations never disagree"
    - "galleyAnchorFor() bridges chip section-id vocabulary to the galley's actual DOM anchor ids (handles the theme-has-no-anchor and deliberation-conversation->galley-deliberation exceptions)"

key-files:
  created: []
  modified:
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx

key-decisions:
  - "Sections with no draft blocks to anchor against (game/podcast/theme/deliberation-conversation, and non-specAd bonus variants) tally chip counts by severity only with unresolved forced to 0 -- there's no anchor concept there, so nothing can fail to anchor"
  - "Bonus chip counts resolve against draft.bonus.body rows only when bonusType==='specAd' (mirrors Galley.tsx's own rendering logic exactly, so counts and galley annotations always agree)"
  - "SectionChipCounts requires only {open, unresolved}; the per-severity breakdown (error/warning/info) is optional, so the component works with either a full tally or a minimal caller-supplied shape"
  - "Edit affordance implemented as a header-level 'Edit {label}' button acting on the currently selected chip, rather than an inline per-section control inside Galley.tsx (Galley.tsx wasn't in this plan's files_modified list, and the design left the exact mechanics to executor discretion)"

patterns-established:
  - "switchViewMode()/handleChipSelect() centralize the unsaved-dirty confirm guard so all three view-mode transitions (edit->galley, edit->iframe, chip-switch-while-dirty) share one prompt"

requirements-completed: [GLY-05, GLY-01]

# Metrics
duration: 9min
completed: 2026-07-07
---

# Phase 32 Plan 07: Chip Counts + Page Wiring Summary

**Review Desk now opens on the native galley by default, with SectionChipList upgraded in place to show severity-tinted open-finding count badges and unresolved markers that double as scroll-to-section jump-nav.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-07T22:16:53-07:00
- **Completed:** 2026-07-07T22:25:31-07:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `SectionChipList` gained an optional `counts` prop (`{ open, unresolved, error?, warning?, info? }`) driving a severity-tinted numeric badge (`data-testid="chip-count"`) and an unresolved marker (`data-unresolved="true"` + `aria-label`), while preserving every existing prop and the >=44px focusable button contract
- `page.tsx` re-composed around a `viewMode` state (`'galley'` default | `'edit'` | `'iframe'`) replacing the old boolean `showPreview` flag — galley is now the first thing Andrew sees at `/review-desk/[runId]`
- Chip counts are computed client-side from the live `qaCorrections` Convex feed, resolved per-section with the same `resolveSectionFindings` + `qaSectionToGalleyId` bridge the galley itself uses (open findings only, D-08), so chip badges and inline annotations can never drift apart
- Chip click scrolls to the matching `#galley-{id}` anchor in galley mode (`galleyAnchorFor()` handles the `theme` no-anchor and `deliberation-conversation` -> `galley-deliberation` id exceptions) and selects the editor section in edit mode
- The Phase 31 `SectionEditorPanel` (Edit affordance) and `PreviewIframe` (soak-cycle fallback, D-02) both stay fully wired and reachable from the new header controls

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade SectionChipList in place — finding counts + scroll jump-nav** - `844ca3f` (feat)
2. **Task 2: Re-compose page.tsx — galley default view + counts + edit affordance + iframe fallback** - `9f21779` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx` - adds the optional `counts` prop, severity-tinted count badge, and unresolved marker
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx` - re-composed around `viewMode` ('galley' default | 'edit' | 'iframe'), computes chip counts from live `qaCorrections`, wires chip-click scroll-to-section + Edit affordance + iframe toggle

## Decisions Made
- Sections with no draft blocks to anchor against (game/podcast/theme/deliberation-conversation, plus non-specAd bonus variants) tally by severity only with `unresolved` forced to 0, since there's no anchor concept to fail there — reserving D-09's "unresolved" semantics strictly for genuine anchor-match failures.
- Bonus counts resolve against `draft.bonus.body` only when `bonusType === 'specAd'`, exactly mirroring `Galley.tsx`'s own conditional bonus render, so the chip count and the galley's rendered annotations for bonus never disagree.
- The Edit affordance is a header-level "Edit {selected label}" button rather than a per-section inline control embedded in `Galley.tsx`/`GallerySection.tsx` — those files weren't in this plan's `files_modified` scope, and D-01 explicitly left the exact mechanics to executor discretion.

## Deviations from Plan

None - plan executed exactly as written. `SectionChipCounts`'s per-severity fields (`error`/`warning`/`info`) were made optional (only `open`/`unresolved` required) rather than all-required as the plan's prose literally states, so the existing RED test's narrower `{ open, unresolved }` object type-checks against the prop without modification — this is a type-shape refinement consistent with the plan's intent ("severity-aware... optional `counts` prop"), not a behavioral deviation; page.tsx still always supplies the full severity breakdown.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GLY-01 and GLY-05 are complete: the galley is the default read surface with count-badged jump-nav chips, per-section editing, and the iframe fallback preserved for the soak cycle.
- Phase 33 (annotation actions + decision rail) can build directly on this plan's chip-count computation and the `resolveSectionFindings`/`qaSectionToGalleyId` bridge without any interface changes.
- Manual verification (per `32-VALIDATION.md`) against a real run — galley-as-default, findings inline, chip jump-nav, sandboxed game, iframe toggle — is still pending human sign-off.

---
*Phase: 32-native-galley-read-only-span-resolver*
*Completed: 2026-07-07*

## Self-Check: PASSED
