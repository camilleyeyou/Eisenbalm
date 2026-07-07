---
phase: 32-native-galley-read-only-span-resolver
plan: 03
subsystem: ui
tags: [typescript, vitest, tdd, portable-text-adjacent, dispatch-control]

# Dependency graph
requires:
  - phase: 32-01
    provides: RED test scaffolds (sectionIdMap.test.ts, spanResolver.test.ts) encoding the exact resolver contract
provides:
  - Pure `qaSectionToGalleyId` / `galleyIdToQaSection` bidirectional map (QA snake_case <-> galley camelCase section ids)
  - Pure `resolveSectionFindings(blocks, findings, sectionId)` per-block quotedSpan resolver with exact/quote-normalized/whitespace-tolerant match stages, hint disambiguation, and fail-closed-to-unresolved ambiguity handling
affects: [32-04, 32-05, 32-06, 33-*]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-block search only, never concatenated section text, for span anchoring"
    - "Fail-closed ambiguity resolution: 2+ matches with no valid disambiguating hint -> unresolved, never guessed"
    - "Length-preserving normalization staged before length-changing normalization, so offsets always index the original untouched string"

key-files:
  created:
    - apps/dispatch-control/lib/galley/sectionIdMap.ts
    - apps/dispatch-control/lib/galley/spanResolver.ts
  modified: []

key-decisions:
  - "resolveSectionFindings takes sectionId as an explicit third parameter (not embedded per-finding) — matches the RED test's actual call signature (`resolveSectionFindings(blocks, findings, SECTION_ID)`) rather than the plan prose's abbreviated two-arg sketch; findings are keyed by Convex `_id` (exposed as `findingId` on output), not a `findingId` input field."
  - "Normalization runs in two length-safe stages: Stage A swaps curly->straight quotes only (1:1 char substitution, offsets map directly onto the original string); Stage B additionally tolerates whitespace runs via a regex built from the Stage-A-normalized quotedSpan, executed against the Stage-A-normalized block text (still length-equal to the original) so offsets never index a normalized string with the wrong length."
  - "Stage B only runs if Stage A finds zero matches (not on ambiguity) — an ambiguous exact or Stage-A result resolves immediately (via hint or to unresolved), it never falls through to weaker normalization."

requirements-completed: [GLY-02]

# Metrics
duration: ~12min
completed: 2026-07-07
---

# Phase 32 Plan 03: Span Resolver Core Summary

**Pure TypeScript `resolveSectionFindings` per-block quotedSpan anchoring with exact -> quote-normalized -> whitespace-tolerant match stages and fail-closed ambiguity handling, plus the QA<->galley section-id bridge it depends on.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-07T14:19:00-07:00 (approx, first Read)
- **Completed:** 2026-07-07T14:23:48-07:00
- **Tasks:** 2 completed
- **Files modified:** 2 (both new)

## Accomplishments

- `sectionIdMap.ts` bridges QA's snake_case `sectionName` vocabulary and the galley/draft camelCase section-id vocabulary, with unknown/galley-only names returning `null` rather than silently coercing
- `spanResolver.ts` implements `resolveSectionFindings(blocks, findings, sectionId)`: per-block exact substring search, falling back to a length-preserving quote-normalization stage, then a whitespace-tolerant regex stage — each stage's offsets are proven to index the original (un-normalized) block text
- `blockIndexHint` disambiguates only when there are 2+ candidate matches AND the hinted block is actually among them; a stale/out-of-range/wrong hint is ignored and the resolver falls through to a normal full search rather than short-circuiting to unresolved
- Any irreducible ambiguity — with or without a hint — resolves to `unresolved`, never a guessed block (D-12)
- Cross-block phrases (only present when two blocks' text is joined) never falsely resolve, because the resolver never concatenates block text before searching (verified: `grep -n "join(" spanResolver.ts` returns no matches)
- All 29 targeted RED tests (18 `sectionIdMap.test.ts` + 11 `spanResolver.test.ts`) now pass green

## Task Commits

Each task was committed atomically:

1. **Task 1: sectionIdMap.ts — bidirectional QA↔galley section-name map** - `6e498c4` (feat)
2. **Task 2: spanResolver.ts — per-block quotedSpan resolution with hint + normalization** - `83cf56e` (feat)

_Note: Task 2 is marked `tdd="true"` in the plan, but both the RED tests (Plan 32-01) and the GREEN implementation (this plan) were pre-existing/authored in the same step here — this executor found the RED spec already committed from Plan 32-01 and wrote the implementation directly to it, verifying RED->GREEN via `npx vitest run` before committing. No separate RED commit was created in this plan since the RED tests already existed on disk from 32-01._

## Files Created/Modified

- `apps/dispatch-control/lib/galley/sectionIdMap.ts` - Pure bidirectional map; `qaSectionToGalleyId('problem')` -> `'problemStatement'`, unknown/empty -> `null`; reverse map derived via `Object.fromEntries`, galley-only ids (`podcast`/`theme`/`deliberation-conversation`) -> `null`
- `apps/dispatch-control/lib/galley/spanResolver.ts` - Pure resolver; exports `resolveSectionFindings`, `ResolvedAnnotation`, `UnresolvedFinding`, `QaFinding`, `DraftBlockLike`; internal helpers `exactMatchesFor` / `quoteNormalizedMatchesFor` / `whitespaceTolerantMatchesFor` / `disambiguate`

## Decisions Made

- Followed the RED test files' actual function signatures exactly (per the task's `<read_first>` instruction to "implement exactly to it") rather than the plan body's abbreviated code sketch, where the two diverged on `resolveSectionFindings`'s arity and the finding-id field name (`_id` vs `findingId`). This is not a deviation from the plan's intent — the plan explicitly subordinates its prose sketch to the RED spec.
- Kept normalization strictly two-staged and narrow (no fuzzy/Levenshtein matching) per Pitfall 5, with Stage B only attempted when Stage A yields zero matches (an ambiguous Stage A result stops there rather than escalating to Stage B).

## Deviations from Plan

None — plan executed exactly as written (task descriptions' abbreviated function-signature sketch was explicitly subordinate to the RED test spec per the plan's own `<read_first>` instruction; see Decisions above).

## Issues Encountered

None. Both test files passed on the first implementation attempt; a follow-up `tsc --noEmit --strict` pass on both files individually confirmed zero type errors.

## Out-of-scope findings (not fixed, logged only)

Running the full `apps/dispatch-control` vitest suite surfaced 2 pre-existing failing test files unrelated to this plan's scope (`files_modified` for 32-03 is only `sectionIdMap.ts` + `spanResolver.ts`):
- `__tests__/Galley.test.tsx` — RED scaffold for GLY-01 (Galley component), not yet implemented
- `__tests__/UnresolvedFindingCard.test.tsx` — RED scaffold for GLY-02/D-09 (unresolved-finding card), not yet implemented
- `__tests__/SectionChipList.test.tsx` (2 of its tests) — RED scaffold for GLY-05 (chip open-finding counts), not yet implemented

These are Wave 0 RED scaffolds from Plan 32-01 explicitly slated for later plans in this phase (32-04/32-05/32-06 per the phase's plan sequence) and are out of this plan's file-modification scope per CLAUDE.md's SCOPE BOUNDARY rule. No action taken; not regressions introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `resolveSectionFindings` and `qaSectionToGalleyId`/`galleyIdToQaSection` are ready for the Galley component (Plan 32-06) to consume directly, and are explicitly designed for reuse by Phase 33's post-patch re-resolution.
- Remaining Wave 0 RED scaffolds (`Galley.test.tsx`, `UnresolvedFindingCard.test.tsx`, `SectionChipList.test.tsx` counts) are unblocked to proceed in their respective plans.

---
*Phase: 32-native-galley-read-only-span-resolver*
*Completed: 2026-07-07*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/lib/galley/sectionIdMap.ts
- FOUND: apps/dispatch-control/lib/galley/spanResolver.ts
- FOUND commit: 6e498c4
- FOUND commit: 83cf56e
