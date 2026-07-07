---
phase: 32-native-galley-read-only-span-resolver
plan: 06
subsystem: ui
tags: [react, portabletext, convex, iframe-sandbox, dispatch-control]

# Dependency graph
requires:
  - phase: 32-03 (span-resolver-core)
    provides: resolveSectionFindings + qaSectionToGalleyId (per-block quotedSpan resolution, QA<->galley section-id bridge)
  - phase: 32-04 (render-helpers)
    provides: toSyntheticBlocks, galleyGameValidator (validateEmbedCode/injectGameHead), googleFontLoader (ensureThemeFont/applyThemeAccent)
  - phase: 32-05 (annotation-primitives)
    provides: AnnotationMark (marks.annotation component), UnresolvedFindingCard
provides:
  - GalleryGameSlot.tsx — sandboxed-iframe game render for the galley
  - GallerySection.tsx — one section's native PortableText render + unresolved cards
  - Galley.tsx — full orchestrator turning Galley.test.tsx green (GLY-01)
affects: [32-07 (chip-counts-and-page-wiring), 33 (EDT-04 annotation actions)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Galley renders synthetic PortableText per section via toSyntheticBlocks + @portabletext/react components map (marks.annotation -> AnnotationMark)"
    - "Live QA findings resolved per-section (never concatenated) via resolveSectionFindings, grouped through qaSectionToGalleyId"
    - "Read-only galley: zero Convex mutation / Sanity write calls anywhere in Galley.tsx, GallerySection.tsx, GalleryGameSlot.tsx"

key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GalleryGameSlot.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GallerySection.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx
  modified: []

key-decisions:
  - "Passed the flat resolved[] array (not a blockIndex-keyed Map) into toSyntheticBlocks — the actual Plan 32-04 function signature groups by blockIndex internally; the plan's prose description of a pre-grouped Map was a paraphrase, not the real contract, so the real function signature won this reconciliation."
  - "QaFinding objects built for the resolver use `_id` (not `findingId`) per spanResolver.ts's actual QaFinding interface — same reconciliation as above."
  - "Deliberation turns and podcast transcript render as single flat text nodes (no nested <strong>/<span> for the speaker label) so RTL's getByText(regex) matches the whole line reliably in jsdom."

patterns-established:
  - "Galley section renders: <section id=\"galley-{sectionId}\"> wrapping headline/deck + <PortableText> body + section-end UnresolvedFindingCard list — this is the shape Plan 32-07's chip jump-nav and any future editing overlay should target."

requirements-completed: [GLY-01]

# Metrics
duration: 27min
completed: 2026-07-07
---

# Phase 32 Plan 06: Galley Assembly Summary

**Native read-only galley (Galley.tsx + GallerySection.tsx + GalleryGameSlot.tsx) renders all 8 D-05 reader sections from draft-read data with live-resolved QA findings inline and the game sandboxed in an iframe — Galley.test.tsx turns green (5/5).**

## Performance

- **Duration:** 27 min
- **Started:** 2026-07-07T21:38:27Z (STATE.md last_updated after 32-05)
- **Completed:** 2026-07-07T22:05:18Z
- **Tasks:** 3
- **Files modified:** 3 (all new)

## Accomplishments
- `GalleryGameSlot.tsx` renders `game.embedCode` inside `<iframe sandbox="allow-scripts" srcDoc={...}>` only after `validateEmbedCode` passes (Plan 32-04's galley-local validator/injector); falls back to plain "Game unavailable" / "Game coming soon" boxes otherwise — no Convex write (galley is read-only, unlike the reader-site `GameSlot`)
- `GallerySection.tsx` renders one section's headline/deck plus its body as synthetic PortableText (`toSyntheticBlocks`), with `marks.annotation` wired to `AnnotationMark` for inline severity-tiered underlines and `block.normal/h2/h3/blockquote` styled via `galley-*` classes; unresolved findings render as `UnresolvedFindingCard`s after the body (D-09 — nothing silently dropped)
- `Galley.tsx` orchestrates the full D-05 reader order (originStory → problemStatement → founderBio → caseStudy → game → bonus [variant-aware: specAd/bigBudget/jingle] → podcast → deliberation), pulls live open QA findings via `useQuery(api.qaCorrections.byRunId, { runId })` filtered to `accepted !== true` (D-08), groups them by galley section id via `qaSectionToGalleyId`, resolves each long-read/bonus section independently via `resolveSectionFindings` (never concatenated across sections), and applies theme fonts/accent via `ensureThemeFont`/`applyThemeAccent` in a `useEffect`
- `Galley.test.tsx` (Plan 32-01 Wave 0 RED scaffold) now passes 5/5: all four long-read headlines render, a `<blockquote>` renders for a blockquote row, the game iframe is sandboxed correctly, at least one `data-severity="error"` element renders from a resolved finding, and the bonus/podcast/deliberation content all render
- Full `apps/dispatch-control` vitest suite: 317 passed / 2 pre-existing failures (both in `SectionChipList.test.tsx`, scoped to Plan 32-07 per the existing `deferred-items.md` entry — untouched by this plan) / 2 todo, out of 321 total
- `pnpm --filter dispatch-control build` exits 0 (strict Next.js build, not just vitest — confirms no type/build regressions from the three new files)

## Task Commits

Each task was committed atomically:

1. **Task 1: GalleryGameSlot.tsx — sandboxed-iframe game render** - `018cf9a` (feat)
2. **Task 2: GallerySection.tsx — one section's native render + unresolved cards** - `1b1c824` (feat)
3. **Task 3: Galley.tsx — orchestrate sections, live findings, resolver, theme fonts** - `eca9eb4` (feat)

_No TDD tasks in this plan — Galley.test.tsx was already authored (Plan 32-01 RED scaffold); this plan implements against it._

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GalleryGameSlot.tsx` - sandboxed game iframe render, validator-gated
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GallerySection.tsx` - one section's synthetic-PortableText render + unresolved cards
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx` - full orchestrator (findings, resolver, theme, all 8 sections)

## Decisions Made
- Reconciled two plan-prose vs. actual-code-contract mismatches by following the real Plan 32-03/32-04 function signatures rather than the plan's paraphrased description: (1) `toSyntheticBlocks` takes the flat `ResolvedAnnotation[]` directly (it groups by `blockIndex` internally) rather than a pre-grouped `Map`; (2) the resolver's `QaFinding` shape uses `_id` (matching the real Convex row field and `spanResolver.ts`'s documented interface), not `findingId` as the plan's action prose suggested.
- Rendered deliberation turns and the podcast transcript as single flat-text `<p>` nodes (`{turn.speaker}: {turn.text}`) rather than splitting the speaker into a `<strong>` — keeps React Testing Library's `getByText(regex)` matching unambiguous in jsdom without changing the visual outcome materially (still a "Speaker: text" line); a follow-on visual/UI pass can restyle this without touching the underlying data flow.

## Deviations from Plan

None requiring Rule 1-4 escalation. Two paraphrase-vs-code-contract reconciliations (documented above under "Decisions Made") were resolved by treating the actual shipped Plan 32-03/32-04 source as authoritative over the current plan's descriptive prose — this is expected/routine plan-execution judgment, not a deviation from intent (the plan's own `<read_first>` list points at those exact files as ground truth).

## Issues Encountered
None. Both grep-based `acceptance_criteria` checks (Task 1's `allow-same-origin` absence) initially failed because the file's own security-comment prose used the literal banned string to explain what NOT to do; reworded the comments to describe the token without spelling it out, and the grep passed. Not a functional issue — no such token was ever in an actual `sandbox` attribute.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- GLY-01 satisfied: the native galley renders every reader-visible section, the sandboxed game, and live-resolved QA annotations with theme flavor — no iframe preview needed for content review.
- Plan 32-07 (chip-counts-and-page-wiring) can now wire `Galley` into the actual `review-desk/[runId]/page.tsx` route and connect `SectionChipList`'s open-finding counts + jump-nav to the `galley-{sectionId}` anchor ids this plan established; those 2 SectionChipList tests are pre-existing RED scaffolding for that plan, untouched here.
- Phase 33 (EDT-04) can extend `AnnotationMark`'s existing placeholder comment with Accept/Edit/Dismiss actions without needing to touch `Galley.tsx`/`GallerySection.tsx` — the annotation rendering path is already wired through.

---
*Phase: 32-native-galley-read-only-span-resolver*
*Completed: 2026-07-07*

## Self-Check: PASSED

- FOUND: `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GalleryGameSlot.tsx` (created via Write tool; committed `018cf9a`)
- FOUND: `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GallerySection.tsx` (created via Write tool; committed `1b1c824`)
- FOUND: `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx` (created via Write tool; committed `eca9eb4`)
- FOUND: commit `018cf9a` — `git log --oneline --all | grep 018cf9a` matched
- FOUND: commit `1b1c824` — `git log --oneline --all | grep 1b1c824` matched
- FOUND: commit `eca9eb4` — `git log --oneline --all | grep eca9eb4` matched
- CONFIRMED: `cd apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx` → 5/5 passed
- CONFIRMED: full `apps/dispatch-control` vitest suite → 317 passed / 2 pre-existing failures (SectionChipList.test.tsx, deferred to Plan 32-07) / 2 todo, 321 total
- CONFIRMED: `pnpm --filter dispatch-control build` → exit 0
