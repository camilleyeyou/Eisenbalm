---
phase: 51-section-read-and-fix-in-place
plan: 07
subsystem: ui
tags: [react, portabletext, galley, dispatch-control, vitest, provenance]

# Dependency graph
requires:
  - phase: 51-section-read-and-fix-in-place
    provides: "Plan 51-01's ClaimProvenanceCard phrasingSafe mode and the Galley markSourcedClaims D-09 render filter, plus the preserved unfiltered claimResolvedAll local at both GallerySection call sites"
  - phase: 51-section-read-and-fix-in-place
    provides: "Plan 51-05's findingGroups.ts sibling-selector style/conventions this plan's findingClaimLink.ts follows"
provides:
  - "lib/galley/findingClaimLink.ts -- claimForFinding/buildFindingClaimMap, a pure character-range-overlap intersection selector linking a finding to the tracked claim it sits on"
  - "AnnotationMark's popover now mounts the shared ClaimProvenanceCard (phrasingSafe, read-only, no actions) beneath the reason whenever the finding overlaps a tracked claim -- READ-03's evidence half"
  - "GallerySection's showClaimEvidenceInFindings + claimResolvedForLookup props, and the buildFindingClaimMap lookup that deliberately consumes the UNFILTERED claim array rather than the D-09-filtered render array"
  - "Galley/page.tsx wiring turning the evidence card on for /s/[section], forwarding claimResolvedForLookup={claimResolvedAll} unfiltered on both GallerySection mounts"
  - "ClaimProvenanceCard's Source field now also renders the raw sourceUrl as visible text (not just the derived-host publisher + an href attribute) -- the one shared card, so every caller (Stage 3, Stage 5, ClaimMark, this new popover) gained it identically"
affects: [52]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Render-array vs lookup-array split, consumed one level down: GallerySection's buildFindingClaimMap deliberately reads a second, UNFILTERED prop (claimResolvedForLookup) rather than the D-09-filtered claimResolved prop it already receives for rendering -- the same pattern 51-01 established at the Galley level, now threaded one hop further into the actual lookup site"
    - "Locked test file outside files_modified (AnnotationMark.test.tsx) constrains production code, never the reverse -- when a locked assertion (raw sourceUrl text in the DOM) couldn't be satisfied by the plan's literal snippet alone, the shared component itself was extended rather than the test weakened or a parallel render path forked"

key-files:
  created:
    - apps/dispatch-control/lib/galley/findingClaimLink.ts
    - apps/dispatch-control/__tests__/findingClaimLink.test.ts
  modified:
    - apps/dispatch-control/components/galley/AnnotationMark.tsx
    - apps/dispatch-control/components/galley/GallerySection.tsx
    - apps/dispatch-control/components/galley/Galley.tsx
    - "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"
    - apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx

key-decisions:
  - "Extended the shared ClaimProvenanceCard's Source field to render the raw sourceUrl as its own visible text line, in addition to the existing derived-host sourcePublisher line and the href-only 'Open source' link. Classified as Rule 2 (auto-add missing critical functionality): the locked AnnotationMark.test.tsx evidence-card case (not in this plan's files_modified list, so not editable) and the plan's own must_haves.truths ('shows that claim's source URL... in the popover') both require the literal URL string to be visible DOM text; deriveSourcePublisher's host-only output ('example.org') and the href attribute on the 'Open source' link are both invisible to a reader's plain view and to container.textContent. Because D-09/D-16 forbid a per-caller fork of this card, the fix landed in the ONE shared component -- every existing caller (Stage 3 Fact Check, Stage 5 Approval, ClaimMark's own popover) gains the same visible URL line, additively, with no existing test in ClaimProvenanceCard.test.tsx or ClaimMark.test.tsx asserting an exact-string Source-field match that this would break (verified by grep before editing)."
  - "Named the annotation callback's local `c` (not `linkedClaim`) to match the plan's own field-mapping snippet and its literal acceptance grep (`supportingPassage: c.context`) exactly."

requirements-completed: [READ-03]

# Metrics
duration: ~20min
completed: 2026-08-01
---

# Phase 51 Plan 07: Evidence in the Finding Popover Summary

**A pure character-range finding->claim intersection selector (`findingClaimLink.ts`) feeds `AnnotationMark`'s popover a read-only, phrasing-safe `ClaimProvenanceCard` sourced from the UNFILTERED claim array — so a finding sitting on a sourced claim shows its source URL and retrieved date in the same popover even after D-09 suppresses that claim's own wash.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-01T07:33:00Z
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- `lib/galley/findingClaimLink.ts` created: `claimForFinding`/`buildFindingClaimMap`, a pure (no Convex/React/fetch) selector extending the Phase 45 block-level "related facts" predicate with character-range overlap within the same `blockIndex`. Greater-overlap wins; ties break on the lower `claimIndex` (deterministic, never input order); no overlap => `null`, never a nearest-neighbour guess. 10 passing unit tests cover every `<behavior>` bullet plus empty-input edge cases. `spanResolver.ts` untouched.
- `AnnotationMark.tsx` gained an optional `claim?: ClaimProvenanceView` prop, mounted as `<ClaimProvenanceCard claim={claim} phrasingSafe />` inside a `display:block` span between the reason and the suggested-fix line, wrapped so the whole popover stays valid phrasing content (Pitfall 1). No `actions` passed — READ-03 is "read the evidence," not act on it.
- `GallerySection.tsx` gained `showClaimEvidenceInFindings`/`claimResolvedForLookup` props and a memoized `findingClaimMap` built from `buildFindingClaimMap(resolved, claimResolvedForLookup ?? claimResolved ?? [])` — deliberately the UNFILTERED array, never the D-09-filtered `claimResolved` render array, so a finding overlapping a *sourced* claim (the load-bearing case: `sourceUrl`/`retrievedAt` exist only on sourced rows) still resolves. The `components.annotation` callback maps the linked claim into a `ClaimProvenanceView` using ClaimMark's exact field mapping (`supportingPassage: c.context`, etc.) so the two popovers can never disagree. Both new values are in the `components` `useMemo` dependency array.
- `Galley.tsx` forwards `showClaimEvidenceInFindings` and `claimResolvedForLookup={claimResolvedAll}` (the unfiltered local plan 51-01 preserved) on both `GallerySection` mounts (long-read loop + bonus/specAd). `page.tsx` turns `showClaimEvidenceInFindings` on for the `/s/[section]` route, alongside the existing `showAxisTag`/`generateFixOnAccept`/`markSourcedClaims={false}` props.
- **Deviation:** `ClaimProvenanceCard.tsx`'s Source field now also renders the raw `sourceUrl` as its own visible text line (previously only a derived host name via `deriveSourcePublisher` plus an invisible `href` attribute on "Open source"). Required to satisfy the locked `AnnotationMark.test.tsx` evidence-card assertion and the plan's own must-have truth; landed in the ONE shared card per D-09/D-16 rather than a per-caller fork. Full detail under Deviations below.
- Both previously-red tests are now GREEN: `AnnotationMark.test.tsx`'s evidence-card case, and `Galley.test.tsx`'s real-pipeline `'D-09 and D-20 are independent'` case (asserts, in one render, that a sourced claim carries no `<mark>` while its source URL and `2025-07-01` retrieved date still surface in the overlapping finding's popover). Full `apps/dispatch-control` suite: 148 test files passed / 1 skipped, 1245 tests passed / 2 todo, **0 failed**. `pnpm --filter dispatch-control build` passes clean.

## Task Commits

1. **Task 1: Pure finding-to-claim intersection selector** - `31234f3` (feat)
2. **Task 2: Mount ClaimProvenanceCard phrasing-safe inside AnnotationMark's popover** - `fe4df58` (feat) — includes the ClaimProvenanceCard Source-field deviation fix, required for this task's own locked test to pass

**Plan metadata:** (this commit)

## Files Created/Modified

- `apps/dispatch-control/lib/galley/findingClaimLink.ts` - `claimForFinding`/`buildFindingClaimMap`, pure character-range overlap selector
- `apps/dispatch-control/__tests__/findingClaimLink.test.ts` - 10 unit tests for the selector
- `apps/dispatch-control/components/galley/AnnotationMark.tsx` - New `claim?` prop, mounts the shared card read-only/phrasing-safe beneath the reason
- `apps/dispatch-control/components/galley/GallerySection.tsx` - `showClaimEvidenceInFindings`/`claimResolvedForLookup` props; memoized `findingClaimMap` lookup consuming the unfiltered array; `claim` mapping threaded into `AnnotationMark`
- `apps/dispatch-control/components/galley/Galley.tsx` - `showClaimEvidenceInFindings` prop forwarded, plus `claimResolvedForLookup={claimResolvedAll}` on both `GallerySection` mounts
- `apps/dispatch-control/app/(editorial)/s/[section]/page.tsx` - `showClaimEvidenceInFindings` turned on for the reader route
- `apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx` - Source field now also shows the raw `sourceUrl` as visible text (deviation, see below)

## Decisions Made

See frontmatter `key-decisions` for full rationale on: (1) extending `ClaimProvenanceCard`'s Source field to show the raw URL text, (2) matching the plan's literal `c.context` variable naming for its own acceptance grep.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `ClaimProvenanceCard`'s Source field never rendered the raw `sourceUrl` as visible text**
- **Found during:** Task 2, first run of `AnnotationMark.test.tsx`'s evidence-card verify command
- **Issue:** The plan's Task 2 snippet mounts `<ClaimProvenanceCard claim={claim} phrasingSafe />` alone, with no additional markup. But `ClaimProvenanceCard`'s existing Source field renders only `deriveSourcePublisher(claim.sourceUrl)` (a derived host, e.g. `"example.org"` for `"https://example.org/report"`) plus a retrieved-date suffix — the full raw URL only ever appears as an `href` attribute on the "Open source" link, which is invisible to `container.textContent`. `AnnotationMark.test.tsx`'s locked case (`expect(container.textContent).toContain(claim.sourceUrl as string)`) and `Galley.test.tsx`'s real-pipeline case (`expect(container.textContent).toContain('https://example.org/report')`) both require the literal URL string as DOM text — as does the plan's own must-have truth ("shows that claim's source URL... in the popover"). `AnnotationMark.test.tsx` is not in this plan's `files_modified` list, so it could not be edited to relax this.
- **Fix:** Added a second `Txt` line to `ClaimProvenanceCard`'s Source field rendering `claim.sourceUrl` verbatim (only when present), alongside the existing derived-publisher line — additive, not a replacement. Verified via grep that no test in `ClaimProvenanceCard.test.tsx` or `ClaimMark.test.tsx` asserts an exact-string match on the Source field's prior single-line text that this would break. Per D-09/D-16 (one shared card, never forked), the fix landed in the ONE component so Stage 3 Fact Check, Stage 5 Approval, and `ClaimMark`'s own popover all gained the same visible URL line identically.
- **Files modified:** `apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx`
- **Verification:** `AnnotationMark.test.tsx` (25/25), `Galley.test.tsx` (15/15 incl. the real-pipeline D-09/D-20 case), `ClaimMark.test.tsx` (9/9), `ClaimProvenanceCard.test.tsx` (34/34) all pass; full 148-file suite green afterward.
- **Committed in:** `fe4df58` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical-functionality)
**Impact on plan:** Necessary for the plan's own two locked tests (one of them explicitly outside this plan's editable file list) and its own must-have truth to pass. Additive only — no existing caller's rendered text was removed or changed, only extended.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- READ-03 is now fully delivered: the `phrasingSafe` mode plan 51-01 built has the caller that motivated it, and the D-09 render filter / D-20 lookup are provably independent (pinned by the real-pipeline test).
- Full `apps/dispatch-control` suite: 148 test files passed / 1 skipped, 1245 tests passed / 2 todo, 0 failed. `pnpm --filter dispatch-control build` passes clean.
- `qaCorrections` gained no field; `convex/`, `schemas/`, `packages/pipeline` are untouched (verified via `git status --porcelain`); `lib/galley/spanResolver.ts` is untouched (verified via `git diff --name-only`).
- Review Desk and Voice Pass popovers are byte-identical to before this plan — `showClaimEvidenceInFindings`/`claimResolvedForLookup` are both undefined for those callers, so `findingClaimMap` is always an empty `Map` and `claim` is always `undefined` on `AnnotationMark`.
- No blockers.

---
*Phase: 51-section-read-and-fix-in-place*
*Completed: 2026-08-01*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/lib/galley/findingClaimLink.ts
- FOUND: apps/dispatch-control/__tests__/findingClaimLink.test.ts
- FOUND: apps/dispatch-control/components/galley/AnnotationMark.tsx
- FOUND: apps/dispatch-control/components/galley/GallerySection.tsx
- FOUND: apps/dispatch-control/components/galley/Galley.tsx
- FOUND: apps/dispatch-control/app/(editorial)/s/[section]/page.tsx
- FOUND: apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx
- FOUND: .planning/phases/51-section-read-and-fix-in-place/51-07-SUMMARY.md
- FOUND commit: 31234f3 (Task 1)
- FOUND commit: fe4df58 (Task 2)
