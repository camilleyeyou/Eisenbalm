---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 06
subsystem: dispatch-control
tags: [editor-ui, section-page, in-place-editing]
requires: [56-01, 56-02, 56-03, 56-04]
provides: ["/s/[section] rebuilt to the Section artboard"]
affects: [56-12]
key-files:
  created: []
  modified:
    - apps/dispatch-control/app/(editorial)/s/[section]/page.tsx
    - apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionHeader.tsx
    - apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionEndNav.tsx
    - apps/dispatch-control/app/(editorial)/s/[section]/_components/AgentChangesNote.tsx
    - apps/dispatch-control/app/(editorial)/s/[section]/_components/ExemptSectionNote.tsx
    - apps/dispatch-control/__tests__/SectionReaderPage.test.tsx
  deleted:
    - apps/dispatch-control/app/(editorial)/s/[section]/_components/EarlierIssueBanner.tsx
    - apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx
decisions:
  - "published = deriveHomeFooter kind 'published' (issue.published or run status complete), same signal as Home"
  - "Non-text parts keep Galley (hideFindings, no handlers) under an ExemptSectionNote; Look renders plain swatches (Galley has no theme branch)"
  - "Specific agent-applied fixes are listed as plain sentences; the rest read as a generic reworded-sentence line"
metrics:
  tasks: 2
  completed: 2026-10-22
---

# Phase 56 Plan 06: Section Page Summary

`/s/[section]` (and `?run=`) now follows the Section artboard: slab with a ghost "Back to the issue", breadcrumb, "Part N of 9 · Label", title, toolbar with Rewrite, paragraph-by-paragraph in-place editing, a closed "What the writers changed" list, and Previous / All nine parts / Next.

## Commits
- aada449a: rewrite SectionHeader, SectionEndNav, AgentChangesNote, ExemptSectionNote
- b7dfea6b: rebuild page.tsx, delete EarlierIssueBanner and InPlaceBlockEditor, rewrite SectionReaderPage tests

## What changed
- Text parts and the specAd bonus use SectionArticle; the bonus saves through patchBonus with `{ ifRevisionID, body }`. The revision id is read from a ref at save time.
- Game, Podcast, Deliberation and non-text bonuses show an exempt note plus the existing Galley body, with no Rewrite and no pencil.
- Published issues are read-only with the published helper line.
- Removed from the page: inspector, claim provenance cards, passage selection toolbar, earlier-issue banner, in-place block editor.
- Load failure shows the plain message and a "Reload this page" button; unknown ids call `notFound()`.

## Verification
- New SectionReaderPage test: 11 tests passing (slab, breadcrumb, patchSection / patchBonus payloads, exempt parts, published read-only, prev/next, error, 404, banned-pattern and run-id scans).
- `pnpm --filter dispatch-control build` (strict): green.
- Full `pnpm --filter dispatch-control test`: 113 files passed, 1 skipped, 1042 tests passed.

## Deviations from Plan
- Task 1's four sub-components already existed with the old API, so they were rewritten in place. No other deviations.

## Known Stubs
None. Unwritten text parts show "This part isn't written yet."

## Self-Check: PASSED
