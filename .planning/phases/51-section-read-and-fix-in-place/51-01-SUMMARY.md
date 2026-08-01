---
phase: 51-section-read-and-fix-in-place
plan: 01
subsystem: ui
tags: [react, portabletext, galley, dispatch-control, vitest]

# Dependency graph
requires:
  - phase: 51-section-read-and-fix-in-place
    provides: Plan 51-00's Wave 0 test scaffolds (the RED cases this plan turns GREEN)
  - phase: 45-review-desk-passage-toolbar-inspector-wiring
    provides: Galley/AnnotationMark/ClaimMark/ClaimProvenanceCard/GallerySection shared galley components this plan extends
provides:
  - lib/editableSections.ts — EDITABLE_SECTIONS/SectionMeta importable from outside the (dashboard) route group (D-17)
  - ClaimProvenanceCard phrasingSafe render mode (zero block-level elements, D-20/Pitfall 1), used by ClaimMark's popover
  - AnnotationMark generateFixOnAccept — label-independent trigger for the on-demand voice rewrite (D-08, Pitfall 2)
  - AnnotationMark/ClaimMark showAxisTag — always-visible Fact/Voice/Source text tags (D-07), off by default
  - Galley markSourcedClaims opt-out — sourced claims can be resolved OUT of the render path entirely, emitting no <mark> (D-09), plus a preserved unfiltered claimResolvedAll local at both call sites for plan 51-07
affects: [51-04-section-reader-page, 51-05, 51-07-evidence-in-the-finding-popover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Element-type alias pair (Box/Txt = span-or-div/span-or-p based on a boolean prop) to make an existing block-markup component legally mountable as phrasing content, without a second copy of the component"
    - "Render-question vs lookup-question split: a boolean render filter (markSourcedClaims) is applied to a resolver's OUTPUT via a named helper, never inside the resolver itself, so an unfiltered array survives for an unrelated consumer (51-07's finding->claim lookup)"

key-files:
  created:
    - apps/dispatch-control/lib/editableSections.ts
  modified:
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx
    - apps/dispatch-control/lib/derivedState.ts
    - apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx
    - apps/dispatch-control/components/galley/ClaimMark.tsx
    - apps/dispatch-control/components/galley/AnnotationMark.tsx
    - apps/dispatch-control/components/galley/GallerySection.tsx
    - apps/dispatch-control/components/galley/Galley.tsx

key-decisions:
  - "None of this plan's four declared requirements (READ-02/03/07/08) are marked complete in REQUIREMENTS.md — mirroring 51-00's precedent, this plan ships only the shared, opt-in primitives (showAxisTag, phrasingSafe, generateFixOnAccept, markSourcedClaims, EDITABLE_SECTIONS); every primitive defaults to off/unused, so no requirement is user-observable until plan 51-04 (the /s/[section] page) turns them on."
  - "Renamed the bonus call site's local from the plan-suggested ad-hoc name to the literal identifier `claimResolvedAll` (matching the long-read-section call site exactly) so both sites are structurally identical and both satisfy the acceptance grep for that name."

requirements-completed: []

# Metrics
duration: 17min
completed: 2026-07-31
---

# Phase 51 Plan 01: Shared Primitives — Editable Sections, Phrasing-Safe, Generate-Fix Summary

**Four additive, opt-in primitives (EDITABLE_SECTIONS relocation, ClaimProvenanceCard phrasingSafe mode, AnnotationMark generateFixOnAccept + Fact/Voice/Source tags, Galley markSourcedClaims render filter) land with zero behavior change to Review Desk or Voice Pass, turning 9 of Wave 0's pre-written RED tests GREEN.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-07-31T22:19:07-07:00
- **Completed:** 2026-07-31T22:35:30-07:00
- **Tasks:** 3
- **Files modified:** 8 (7 modified, 1 created)

## Accomplishments

- Promoted `EDITABLE_SECTIONS`/`SectionMeta` out of the review-desk route-private `_components` folder into `lib/editableSections.ts` (D-17); `lib/derivedState.ts` now imports downward instead of reaching upward into a route folder; `SectionChipList.tsx` re-exports both symbols so every existing importer compiles unchanged
- Added a `phrasingSafe` render mode to `ClaimProvenanceCard` (element-type alias pair: `div`/`p`/`h3` become `span style={{display:'block'}}`, zero visual/behavior change under the default) and wired it into `ClaimMark`'s popover, fixing an already-shipped block-in-phrasing DOM-nesting bug on Review Desk / Voice Pass for free
- Made `AnnotationMark`'s on-demand voice-rewrite trigger label-independent via a new `generateFixOnAccept` prop, while keeping the literal `labels?.accept === 'Accept rewrite'` match ORed in so Voice Pass is bit-for-bit unchanged
- Added `showAxisTag` to both `AnnotationMark` (Fact/Voice text tag, sourced from `FACTUAL_AXES`/`VOICE_AXES`) and `ClaimMark` (Source tag, unsourced claims only) — both off by default, threaded through `GallerySection`'s memoized `components` object with both new props added to its dependency array
- Added a `markSourcedClaims` opt-out to `Galley` (default `true`): a new `claimsForRender` helper filters the render-bound `claimResolved` array so a sourced claim, when suppressed, emits no `<mark>` element at all (genuine DOM removal); the unfiltered resolution is kept in a `claimResolvedAll` local at both `GallerySection` call sites (long-read map + bonus/specAd) for plan 51-07's finding→claim lookup — the filter never touches `resolveClaimsFor` itself, and neither `globals.css` wash rule was touched
- Ran the full `apps/dispatch-control` test suite (1205 passed / 2 intentionally-scoped-to-51-07 failed / 18 skipped) and a strict `next build` (clean) after every task

## Task Commits

1. **Task 1: Promote EDITABLE_SECTIONS/SectionMeta into shared lib and re-export (D-17)** - `ccee25e` (feat)
2. **Task 2: Add a phrasingSafe render mode to ClaimProvenanceCard and use it in ClaimMark (Pitfall 1, D-20)** - `b3efe46` (feat)
3. **Task 3: Re-base the voice-rewrite trigger onto generateFixOnAccept, add the Fact/Voice/Source tag, and add the markSourcedClaims opt-out (Pitfall 2, D-07, D-08, D-09)** - `ff73a79` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `apps/dispatch-control/lib/editableSections.ts` - New canonical home for `EDITABLE_SECTIONS`/`SectionMeta`
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx` - Imports + re-exports both symbols instead of declaring them locally
- `apps/dispatch-control/lib/derivedState.ts` - Imports `EDITABLE_SECTIONS` from `./editableSections` instead of the route-private folder
- `apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx` - New `phrasingSafe` prop; `Box`/`Txt` element aliases render every container/text node as `span` under the flag; `ClaimProvenanceRow` untouched
- `apps/dispatch-control/components/galley/ClaimMark.tsx` - Mounts `ClaimProvenanceCard` with `phrasingSafe`; new `showAxisTag` prop renders a "Source" tag for unsourced claims only
- `apps/dispatch-control/components/galley/AnnotationMark.tsx` - New `generateFixOnAccept` prop (ORed into `isRewriteVariant`); new `showAxisTag` prop renders a "Fact"/"Voice" tag sourced from `FACTUAL_AXES`/`VOICE_AXES` (undefined axis → "Fact")
- `apps/dispatch-control/components/galley/GallerySection.tsx` - Threads `generateFixOnAccept`/`showAxisTag` into every `AnnotationMark`/`ClaimMark` mount; both added to the `components` `useMemo` dependency array
- `apps/dispatch-control/components/galley/Galley.tsx` - New `generateFixOnAccept`/`showAxisTag` props forwarded to both `GallerySection` mounts; new `markSourcedClaims` prop (default `true`) + `claimsForRender` helper filtering the render-bound claim array at both call sites while preserving `claimResolvedAll` unfiltered

## Decisions Made

- **Requirements left unchecked.** This plan's frontmatter declares `requirements: [READ-02, READ-03, READ-07, READ-08]`, but none are marked complete in `REQUIREMENTS.md`. Every primitive this plan ships (`showAxisTag`, `phrasingSafe`, `generateFixOnAccept`, `markSourcedClaims`, `EDITABLE_SECTIONS`) is additive and defaults to off/unused — nothing an editor can actually observe changes until plan 51-04's `/s/[section]` page turns them on. Marking these complete now would misrepresent the phase's progress, mirroring 51-00's own documented reasoning for the same requirement set.
- **`claimResolvedAll` naming made literal at both Galley.tsx call sites.** The plan's suggested snippet uses `claimResolvedAll` at "both claim call sites"; the bonus/specAd site's natural name (`bonusClaimResolvedAll`) would not have matched the acceptance grep's exact lowercase substring, so it was renamed to the bare `claimResolvedAll` (a different function scope than the long-read map's per-iteration local of the same name — no collision) for both structural consistency and grep-exactness.

## Deviations from Plan

None - plan executed exactly as written. The only implementation-level correction (not a deviation from the plan's design, a Rule-1-adjacent naming fix during self-verification) was renaming the bonus call site's local variable to `claimResolvedAll`, documented above under Decisions Made.

## Issues Encountered

- Two Wave-0 test cases in this plan's own verify scope (`AnnotationMark.test.tsx`'s "renders the claim provenance card beneath the reason..." and `Galley.test.tsx`'s "D-09 suppresses the sourced wash while D-20 still surfaces its evidence...") remain RED after this plan — both were pre-documented in 51-00's SUMMARY as requiring plan 51-07's evidence-card/finding-claim-lookup wiring in addition to this plan's `markSourcedClaims`. Confirmed via source inspection that `showClaimEvidenceInFindings`/`buildFindingClaimMap` do not exist anywhere in the codebase yet (grep-confirmed) — implementing them here would be out of this plan's scope (Task 3's own `<action>` block never mentions a `claim` prop on `AnnotationMark`). Left red per the scope boundary; not a regression.

## User Setup Required

None - no external service configuration required.

## Requirements Note

See "Decisions Made" above — `requirements mark-complete` was deliberately NOT run for READ-02/03/07/08. This plan ships foundational primitives only; the requirements become user-observable in plan 51-04 (and 51-07 for READ-03's evidence card specifically).

## Next Phase Readiness

- Plan 51-04 (`/s/[section]` page) can now import `EDITABLE_SECTIONS` from `lib/editableSections.ts`, pass `showAxisTag`/`generateFixOnAccept` to `Galley`, and rely on `markSourcedClaims={false}` to make D-09's "only unsourced claims are marked" literally true.
- Plan 51-07 (evidence in the finding popover) has both `claimResolvedAll` locals in `Galley.tsx` ready to consume for its finding→claim lookup, and `ClaimProvenanceCard`'s `phrasingSafe` mode ready for its own popover mount.
- Full `apps/dispatch-control` suite: 1205 passed, 2 failed (both explicitly out-of-scope for this plan per Wave-0's documented red/green split — see Issues Encountered), 18 skipped, 2 todo. Strict `next build` clean after every task.
- No blockers.

---
*Phase: 51-section-read-and-fix-in-place*
*Completed: 2026-07-31*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/lib/editableSections.ts
- FOUND: apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx
- FOUND: apps/dispatch-control/lib/derivedState.ts
- FOUND: apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx
- FOUND: apps/dispatch-control/components/galley/ClaimMark.tsx
- FOUND: apps/dispatch-control/components/galley/AnnotationMark.tsx
- FOUND: apps/dispatch-control/components/galley/GallerySection.tsx
- FOUND: apps/dispatch-control/components/galley/Galley.tsx
- FOUND: .planning/phases/51-section-read-and-fix-in-place/51-01-SUMMARY.md
- FOUND commit: ccee25e (Task 1)
- FOUND commit: b3efe46 (Task 2)
- FOUND commit: ff73a79 (Task 3)
