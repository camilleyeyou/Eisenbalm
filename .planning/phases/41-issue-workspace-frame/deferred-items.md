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

## Plan 41-12 (per-stage-context-panel-content)

- **`.planning/STATE.md` frontmatter `progress.total_plans` / `progress.completed_plans`
  counters are frozen/stale, unrelated to this plan's changes.** Both
  `state advance-plan` and `state update-progress` ran successfully (the former
  correctly bumped "Current Position" to Plan 12 of 12; the latter reported
  `181/183` — byte-identical to the value recorded at Phase 40's completion,
  commit `66aa813`, well before Phase 41 started). Confirmed via `git show
  66aa813:.planning/STATE.md` that these two numbers have not moved across
  ANY of Phase 41's 12 plan completions (01 through 12), so this is a
  pre-existing tool/data staleness (likely the frontmatter `milestone: v2.0`
  label itself being stale relative to PROJECT.md's actual current milestone,
  v4.0 — the progress tool may be scoped to a milestone definition that no
  longer matches), not something plan 41-12 caused or should attempt to
  guess-fix. Left untouched; `status`, `stopped_at`, and the "Current
  Position" section (all freeform/narrative, not derived from that counter)
  were hand-corrected to accurately reflect Phase 41's completion instead.
