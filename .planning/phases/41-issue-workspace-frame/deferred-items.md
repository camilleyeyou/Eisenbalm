# Deferred Items — Phase 41

Out-of-scope discoveries logged during plan execution but NOT fixed (per
execute-plan Scope Boundary rule). Each entry notes which plan surfaced it.

## Plan 41-03 (galley-claim-focus-clickthrough)

- **Pre-existing `tsc --noEmit` failures, unrelated to this plan's files**
  (`ClaimMark.tsx`, `GallerySection.tsx`, `Galley.tsx`, `globals.css` all
  typecheck clean). Surfaced while confirming the wave build per the plan's
  Task 2 note. Not touched — none of these files were modified by 41-03:
  - `__tests__/syntheticPortableText.test.ts` — several `TS18048` possibly-undefined
    errors plus `TS2339`/`TS2769` errors from a test helper narrowing
    `SyntheticMarkDef` to `{ findingId: string }` without accounting for the
    `ClaimSpanMarkDef` variant (added in Phase 35) which has no `findingId`.
  - `__tests__/voicePassAxis.test.ts` — `TS2339` (`import.meta.glob` not on
    `ImportMeta`) and two `TS2532` possibly-undefined errors.
  - `__tests__/WriterExpansion.test.tsx` — one `TS2345` (`HTMLElement | undefined`
    not assignable) at line 103.
