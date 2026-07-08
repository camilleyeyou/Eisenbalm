---
phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
plan: 05
subsystem: ui
tags: [react, portabletext, convex, galley, provenance, dispatch-control]

# Dependency graph
requires:
  - phase: 35-01-contract-and-convex-schema-foundation
    provides: "claim_checks additive fields (claimId, sourceUrl, retrievedAt, sectionName, blockIndexHint) + insertBatch/listByRunId/setStatus"
  - phase: 32-native-galley-read-only-span-resolver
    provides: "toSyntheticBlocks/resolveSectionFindings + GallerySection/AnnotationMark stacking machinery this plan extends"
provides:
  - "toSyntheticBlocks claimSpan mark stacking (ClaimSpanMarkDef, ResolvedClaim) alongside the existing annotation marks"
  - "ClaimMark component: marigold/rust provenance wash + hover tooltip + check/skip popover writing directly to claim_checks"
  - "Galley claim_checks subscription + per-section resolution reusing resolveSectionFindings + a default-ON showProvenance toggle"
affects: [35-06-decision-rail-source-index]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Second independent mark family (claimSpan) stacked on the same span as annotation via the same breakpoint/marks[] machinery — background wash vs. border-bottom underline never collide because they render as separate nested DOM elements (D-09)"
    - "Claim-resolution reuses the QA resolver verbatim (claim_checks row -> QaFinding shape -> resolveSectionFindings -> re-hydrate with provenance) instead of a new fuzzy matcher"

key-files:
  created:
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ClaimMark.tsx"
    - "apps/dispatch-control/__tests__/claimProvenance.test.ts"
  modified:
    - "apps/dispatch-control/lib/galley/syntheticPortableText.ts"
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GallerySection.tsx"
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx"
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx"
    - "apps/dispatch-control/app/globals.css"
    - "apps/dispatch-control/__tests__/Galley.test.tsx"

key-decisions:
  - "Claim rows are grouped by row.sectionName directly (no qaSectionToGalleyId bridge) because the Plan 35-04 publisher (per its plan text) writes sectionName already in the galley id vocabulary (originStory/problemStatement/founderBio/caseStudy/bonus) — unlike qaCorrections' separate vocabulary"
  - "No new claim-resolution module was added — the mapping (claim_checks row -> QaFinding -> resolveSectionFindings -> ResolvedClaim) lives inline in Galley.tsx, matching the plan's files_modified list exactly"
  - "Tooltip uses the native HTML title attribute (sourceUrl + retrieved date, or 'No source') rather than a custom hover component — simplest correct implementation for a D-11 requirement with no dedicated test coverage specified"

patterns-established:
  - "Provenance wash CSS is background-only (no border-bottom) by design so it always composes safely under any future QA-style underline mark"

requirements-completed: [PRV-03]

# Metrics
duration: ~30min
completed: 2026-07-08
---

# Phase 35 Plan 05: Galley Provenance Wash Summary

**Marigold/rust provenance washes stacked onto galley spans via a second `claimSpan` PortableText mark, resolved from `claim_checks` through the existing QA span-resolver, with a default-ON toolbar toggle and an in-context check/skip popover writing straight to Convex.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments
- `toSyntheticBlocks` now accepts a `claimAnnotations` param and stacks `claimSpan` markDefs alongside `annotation` markDefs on the same span (byte-identical output when the param is empty/omitted — verified against the pre-existing `syntheticPortableText.test.ts` suite)
- New `ClaimMark.tsx` renders the wash (`.galley-claim` + `data-provenance` + `data-checked`), a native-tooltip hover state (source URL + retrieval date, or "No source"), and a click popover with "Open source" + "Mark checked" + "Skip" — the latter two calling `claimChecks:setStatus` directly (Convex-only, EDT-05 exempt per Pitfall 9, mirroring `ClaimsChecklist`)
- `GallerySection` wires `components.marks.claimSpan` and threads `claimResolved`/`showProvenance` through to `toSyntheticBlocks`
- `Galley.tsx` subscribes to `claimChecks:listByRunId`, groups rows by `sectionName` (already in the galley id vocabulary — no mapping bridge needed), and resolves each section's claims via the SAME `resolveSectionFindings` the QA annotations use — never a new matcher
- `page.tsx` gained a default-ON "Provenance on"/"Provenance off" toolbar toggle next to "Show preview", threaded into `<Galley showProvenance={...} />`
- CSS wash (`globals.css`) is background-only — no underline treatment — so it composes under a QA annotation's border-bottom without collision (D-09)

## Task Commits

Each task was committed atomically:

1. **Task 1: RED tests — claim resolution, marigold/rust wash marks, toggle, mark stacking** - `c174815` (test)
2. **Task 2: claimSpan mark support in toSyntheticBlocks + ClaimMark component + wash CSS** - `605ef87` (feat)
3. **Task 3: Galley wiring (claim_checks subscription + per-section resolve) + toolbar provenance toggle** - `2b6d31d` (feat)

_Note: Task 1 is a TDD RED commit; Tasks 2/3 are the corresponding GREEN implementation commits._

## Files Created/Modified
- `apps/dispatch-control/lib/galley/syntheticPortableText.ts` - `ResolvedClaim`/`ClaimSpanMarkDef`/`SyntheticMarkDef` types; `toSyntheticBlocks` stacks claim marks alongside annotation marks
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ClaimMark.tsx` - new `marks.claimSpan` component: wash + tooltip + check/skip popover
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GallerySection.tsx` - wires `claimSpan` mark + `claimResolved`/`showProvenance` props
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx` - `claim_checks` subscription, per-section resolution reusing `resolveSectionFindings`, `showProvenance` prop
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx` - default-ON provenance toolbar toggle
- `apps/dispatch-control/app/globals.css` - `.galley-claim` background-only wash CSS
- `apps/dispatch-control/__tests__/Galley.test.tsx` - sourced/unsourced wash, toggle-off, legacy-row-safety assertions
- `apps/dispatch-control/__tests__/claimProvenance.test.ts` - new: claim-resolution mapping + mark-stacking unit tests

## Decisions Made
- Claim rows are grouped by `sectionName` directly, with no `qaSectionToGalleyId`-style bridge, since the publisher (Plan 35-04, not yet executed but its plan text is authoritative on the row shape) writes `sectionName` already in the galley section-id vocabulary
- Kept the claim-resolution mapping logic inline in `Galley.tsx` rather than extracting a new module, matching the plan's exact `files_modified` list; `claimProvenance.test.ts` validates the same mapping pattern locally against the existing `resolveSectionFindings` export
- Implemented the hover tooltip with the native `title` attribute (simplest correct approach for a requirement with no dedicated test coverage specified in the plan)

## Deviations from Plan

None - plan executed as written. One out-of-scope pre-existing issue was discovered and logged rather than fixed (see below, not a deviation from THIS plan's scope).

## Issues Encountered

**Worktree was stale relative to master.** This worktree's branch was 151 commits behind `master` (still at the Phase 30 completion point), so Phase 35's plan files, `35-01`'s Convex schema/codegen, and Phases 31-34's galley/editor code didn't exist locally. Fast-forward merged (`git merge --ff-only master`) since the branch had zero unique commits of its own — a pure catch-up, no conflict risk. Also ran `pnpm install` at the workspace root since the worktree had no `node_modules` yet.

**Pre-existing, unrelated `pnpm --filter dispatch-control build` failure.** The strict build fails during static export with `Could not find Convex client!` on `/eval-center` (a Phase 30 placeholder page) or `/run-monitor` (non-deterministic across runs) — reproduced on a clean `.next` cache and on the commit immediately before this plan's Task 3 changes, confirming it predates and is unrelated to Plan 35-05. Logged to `.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/deferred-items.md` per the scope boundary (not fixed). The build's own "Compiled successfully" + type-check steps passed cleanly before the unrelated page's prerender failure, and the full `apps/dispatch-control` vitest suite (45 files / 386 tests) passed with zero regressions, which is the evidence this plan's code is type- and logic-correct.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 35-06 (Decision Rail source index) can build on the same `claim_checks` additive fields and the `resolveSectionFindings`-based resolution pattern established here
- The provenance wash currently has no real data to render against in a live run until Plans 35-02/35-03/35-04 (Researcher claims, writer claimSpans, publisher seeding) execute — the galley code is ready and defensively handles the empty/legacy-row case (verified by the "legacy claim_checks row" test)
- MANUAL verification pending (35-VALIDATION.md item, not automatable here): once a real run has both a QA finding and a sourced/unsourced claim on overlapping text, visually confirm the underline-over-wash read in a browser (D-09)
- `pnpm --filter dispatch-control build`'s pre-existing static-export failure (unrelated to this plan) should be picked up by whichever phase next touches dispatch-control build/deploy configuration

---
*Phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering*
*Completed: 2026-07-08*

## Self-Check: PASSED

All 8 created/modified source files + this SUMMARY.md + deferred-items.md verified present on disk; all three task commit hashes (c174815, 605ef87, 2b6d31d) verified present in `git log`.
