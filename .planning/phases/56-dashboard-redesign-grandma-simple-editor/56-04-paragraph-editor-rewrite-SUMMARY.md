---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 04
subsystem: dispatch-control
tags: [editor, section-page, in-place-edit, rewrite]
requires: [56-01, 56-02]
provides: [SectionArticle, ParagraphRow, RewriteThisPart]
affects: [56-06]
key-files:
  created:
    - apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionArticle.tsx
    - apps/dispatch-control/app/(editorial)/s/[section]/_components/ParagraphRow.tsx
    - apps/dispatch-control/app/(editorial)/s/[section]/_components/RewriteThisPart.tsx
    - apps/dispatch-control/__tests__/SectionArticle.test.tsx
    - apps/dispatch-control/__tests__/RewriteThisPart.test.tsx
decisions:
  - "Keep / Go back is client-side: blocks are snapshotted before reroll and re-applied via patchSection/patchBonus; backend unchanged"
metrics:
  tasks: 2
  files: 5
  completed: 2026-10-22
---

# Phase 56 Plan 04: Paragraph editor and Rewrite this part Summary

Per-paragraph in-place editing (one open at a time, discard confirm, fresh revision id at save) and a "Rewrite this part" helper with a real Go back, built as standalone tested components. Page wiring is plan 56-06.

## Assumption A2 (recorded)

"Rewrite this part" is offered only where `canRewrite` (56-01) allows: originStory, problemStatement, founderBio, caseStudy, and bonus only when `bonusType === 'specAd'`. It is hidden for game, Look (theme), deliberation, podcast, other bonus types, published issues, and while the run is running.

## BonusPatchPayload mapping

`BonusPatchPayload` is `{ ifRevisionID: string; [key: string]: unknown }`. For the bonus part, both components send `{ ifRevisionID: getRevisionId(), body: <ContentBlock[]> }` (the specAd shape, matching InPlaceBlockEditor). The optional `bonusBody(blocks)` prop overrides this for other variants.

## Verification

- 21 tests across SectionArticle.test.tsx and RewriteThisPart.test.tsx pass (mocked patch/reroll clients; the OpenRouter key is revoked so rewrite was not run end to end).
- Strict `pnpm --filter dispatch-control build` passes.

## Deviations from Plan

**[Rule 1 - Bug] Strict build type error:** `AGENT_FOR_SECTION[sectionId]` is `string | undefined`; fixed with `?? sectionId`. Caught only by the strict build, as the repo notes warn.

## Known Stubs

None.

## Commits

- 18e348dc: SectionArticle and ParagraphRow
- 55ce3c9c: RewriteThisPart

## Self-Check: PASSED
