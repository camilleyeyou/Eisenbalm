---
phase: 51-section-read-and-fix-in-place
plan: 03
type: execute
wave: 2
depends_on: ["51-00"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/useReviewedSections.ts
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryDeskGrid.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFocusView.tsx
  - apps/dispatch-control/__tests__/StoryDeskGrid.test.tsx
autonomous: true
requirements: [READ-08]

must_haves:
  truths:
    - "No localStorage bookkeeping of reviewed sections exists anywhere in the app"
    - "The Review Desk still renders a progress header, a per-card status badge and a next-section footer link — all driven by open-finding counts"
    - "Nothing in the Review Desk can be ticked by hand to change a section's state"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryDeskGrid.tsx"
      provides: "derived card status + derived progress header"
      contains: "counts?.open"
  key_links:
    - from: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx"
      to: "chipCounts"
      via: "next-needs-you nav computed from open counts, not from isReviewed"
      pattern: "nextNeedsYou"
---

<objective>
Delete the manual "mark reviewed" bookkeeping layer entirely (D-25) and replace what it powered on the Review Desk with state derived from open findings.

Purpose: D-25 and the v5.0 ROADMAP preamble are unambiguous — "the `useReviewedSections` localStorage layer is DELETED... section state is derived from open findings, never a manual mark." Research (Pitfall 4) confirmed the hook is not a one-file deletion: `reviewedIds`, `reviewed` and `onToggleReviewed` are *required* props of `StoryDeskGrid.tsx` and `StoryFocusView.tsx`, feeding the progress header, the "✓ Reviewed" badge and the "Next unreviewed" footer. Deleting the hook without touching them will not compile.

Output: the hook file gone, three Review Desk files driven by `chipCounts` open counts, and no "mark reviewed" affordance anywhere.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/51-section-read-and-fix-in-place/51-CONTEXT.md
@.planning/phases/51-section-read-and-fix-in-place/51-RESEARCH.md

<interfaces>
<!-- Contracts the executor needs. Extracted from live source. Do not re-explore. -->

The exhaustive blast radius (grep-confirmed, these are ALL the sites):
  ReviewDeskRunView.tsx:17   doc comment describing useReviewedSections
  ReviewDeskRunView.tsx:52   import { useReviewedSections } from './_components/useReviewedSections'
  ReviewDeskRunView.tsx:218  const { reviewed: reviewedIds, isReviewed, toggle: toggleReviewed } = useReviewedSections(runId)
  ReviewDeskRunView.tsx:469  function nextUnreviewedAfter(currentId: string): { id: string; label: string } | null
  ReviewDeskRunView.tsx:473  if (candidate && !isReviewed(candidate.id)) return candidate
  ReviewDeskRunView.tsx:501  <StoryDeskGrid … reviewedIds={reviewedIds} … />
  ReviewDeskRunView.tsx:515  <StoryFocusView … reviewed={isReviewed(storySectionId)} … />
  ReviewDeskRunView.tsx:516                    onToggleReviewed={() => toggleReviewed(storySectionId)}
  ReviewDeskRunView.tsx:541                    nextUnreviewed={nextUnreviewedAfter(storySectionId)}
  StoryFocusView.tsx:44      onToggleReviewed: () => void            (required prop)
  StoryFocusView.tsx:67      nextUnreviewed: { id: string; label: string } | null
  StoryFocusView.tsx:271     the "unreviewed"/"reviewed" meta text
  StoryFocusView.tsx:275-281 the "✓ Mark reviewed" / "Reviewed" button
  StoryFocusView.tsx:437-439 the "Next unreviewed: {label} →" footer link
  StoryDeskGrid.tsx:20       reviewedIds: ReadonlySet<string>        (required prop)
  StoryDeskGrid.tsx:129      const reviewedCount = EDITABLE_SECTIONS.filter(s => reviewedIds.has(s.id)).length
  StoryDeskGrid.tsx:134      if (reviewedIds.has(section.id)) continue
  StoryDeskGrid.tsx:174      const reviewed = reviewedIds.has(section.id)
  StoryDeskGrid.tsx:200-204  the "✓ Reviewed" badge
  __tests__/StoryDeskGrid.test.tsx:43,61  reviewedIds={new Set()}

StoryDeskGrid.tsx current status derivation (the thing being re-based):
  type CardStatus = 'done' | 'mustfix' | 'review' | 'clean'
  function statusFor(counts: SectionChipCounts | undefined, reviewed: boolean): CardStatus {
    if (reviewed) return 'done'
    if ((counts?.error ?? 0) > 0) return 'mustfix'
    if ((counts?.warning ?? 0) > 0) return 'review'
    return 'clean'
  }
  TOP_RULE.done = green top border; TOP_RULE.mustfix = vermilion; TOP_RULE.review = marigold

The already-derived counts object BOTH components already receive:
  export interface SectionChipCounts { open: number; unresolved: number; error?: number; warning?: number; info?: number }
  chipCounts: Record<string, SectionChipCounts>
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Re-base StoryDeskGrid on open-finding counts and drop the reviewedIds prop</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryDeskGrid.tsx, apps/dispatch-control/__tests__/StoryDeskGrid.test.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryDeskGrid.tsx (full — the props interface at ~line 17, `statusFor` at ~108, the progress header at ~124-160, the card loop at ~170-210 and the "✓ Reviewed" badge at ~200)
    - apps/dispatch-control/__tests__/StoryDeskGrid.test.tsx (the two `reviewedIds={new Set()}` call sites that must be removed)
    - apps/dispatch-control/lib/derivedState.ts lines 270-320 (`deriveSectionStates` — the vocabulary this alignment mirrors: `must-fix` when any error, `review` when openCount > 0, `clean` otherwise)
  </read_first>
  <action>
Remove `reviewedIds: ReadonlySet<string>` from `StoryDeskGridProps` and from the component's destructured parameters. Then make these four exact substitutions:

1. `statusFor` loses its second parameter and derives everything from open counts. Replace the whole function with:

    function statusFor(counts: SectionChipCounts | undefined): CardStatus {
      if ((counts?.error ?? 0) > 0) return 'mustfix'
      if ((counts?.open ?? 0) > 0) return 'review'
      return 'done'
    }

   `'done'` now means "no open findings" and keeps its existing green top rule — a section reads done because it has nothing open, never because someone ticked it (D-25). Leave the `CardStatus` union, `TOP_RULE`, `CHIP_CLASS` and `chipToneFor` exactly as they are; the `'clean'` variant simply becomes unreachable. Do NOT delete it — `chipToneFor` maps `'done'` onto the `'clean'` ChipTone and that mapping must keep working.

2. Progress header — replace
     `const reviewedCount = EDITABLE_SECTIONS.filter(s => reviewedIds.has(s.id)).length`
   with
     `const cleanCount = EDITABLE_SECTIONS.filter(s => (chipCounts[s.id]?.open ?? 0) === 0).length`
   and rename every downstream use (`progressPercent` numerator, the header copy). Change the header's visible word from "reviewed" to "clean" — e.g. `{cleanCount} of {total} clean`. Do not invent new header structure; substitute the word and the variable only.

3. The must-fix/review tally loop — replace
     `if (reviewedIds.has(section.id)) continue`
   with nothing (delete the line). The tally now simply counts sections by their own counts, which is the honest number.

4. The badge — replace
     `const reviewed = reviewedIds.has(section.id)` … `{reviewed && <span …>&#10003; Reviewed</span>}`
   with a status-derived badge:
     `const status = statusFor(counts)` (already computed one line below — reuse it, do not compute twice)
     `{status === 'done' && <span …>&#10003; Clean</span>}`
   Keep the badge's existing className and positioning byte-for-byte; only the condition and the word change. "Clean" is the vocabulary already used by the adjacent, already-derived mark in `StoryFocusView.tsx` (`Clean` / `{n} open` / `{n} must fix`) — this aligns the two rather than inventing a third word.

In `__tests__/StoryDeskGrid.test.tsx`, delete both `reviewedIds={new Set()}` props. Change nothing else in that file — the remaining assertions are the regression guard proving the grid still renders.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/StoryDeskGrid.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "reviewedIds" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryDeskGrid.tsx"` returns NO matches
    - `grep -n "reviewedIds" apps/dispatch-control/__tests__/StoryDeskGrid.test.tsx` returns NO matches
    - `grep -n "counts?.open ?? 0" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryDeskGrid.tsx"` matches
    - `grep -n "Reviewed" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryDeskGrid.tsx"` returns NO matches
    - `grep -n "Clean" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryDeskGrid.tsx"` matches
    - `cd apps/dispatch-control && npx vitest run __tests__/StoryDeskGrid.test.tsx` exits 0
  </acceptance_criteria>
  <done>`StoryDeskGrid` takes no `reviewedIds`; card status, the progress header and the badge all derive from `chipCounts[...].open`; its test passes with the prop removed.</done>
</task>

<task type="auto">
  <name>Task 2: Strip the mark-reviewed affordance from StoryFocusView and ReviewDeskRunView, then delete the hook</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFocusView.tsx, apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx, apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/useReviewedSections.ts</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFocusView.tsx (full — props at lines 40-70, the destructure at ~145-170, the meta line at ~271, the Mark-reviewed button at ~275-281, the already-derived `Clean` / `{n} open` / `{n} must fix` mark at ~112-134, and the footer at ~437-439)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx (full — the doc comment at ~17, the import at 52, the hook call at 218, `nextUnreviewedAfter` at 469-476, and the three prop sites at 501/515-516/541)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/useReviewedSections.ts (full — confirm nothing else in the file is exported and used elsewhere before deleting)
  </read_first>
  <action>
**`StoryFocusView.tsx`:**
- Delete the `reviewed: boolean` and `onToggleReviewed: () => void` props from the props interface and from the destructure.
- Delete the "✓ Mark reviewed" / "Reviewed" button entirely (lines ~275-281). There is nothing left to toggle — a button that writes to nothing is worse than no button (D-25). Do not replace it with a different action.
- The meta line at ~271 that reads "unreviewed"/"reviewed": replace the reviewed-derived word with the section's own open-finding state, reusing the counts already in scope. Use exactly the existing adjacent vocabulary: `Clean` when there are no open findings, `{n} open` otherwise — the same words the already-derived mark right beside it (lines ~112-134) uses. Never introduce a third vocabulary.
- Rename the prop `nextUnreviewed: { id: string; label: string } | null` to `nextNeedsYou: { id: string; label: string } | null` and change the footer copy at ~437-439 from `Next unreviewed: {label} →` to `Next that needs you: {label} →`. "Unreviewed" is bookkeeping language for a thing that no longer exists.

**`ReviewDeskRunView.tsx`:**
- Delete the import at line 52 and the hook call at line 218.
- Delete the `useReviewedSections` paragraph from the file's doc comment at ~line 17 (replace it with a one-line note: "quick/Phase 51 D-25: the localStorage 'Mark reviewed' layer was deleted — every section state here derives from open findings.").
- Rewrite `nextUnreviewedAfter` as `nextNeedsYouAfter(currentId: string)`: walk `EDITABLE_SECTIONS` forward from `currentId + 1` and return the first candidate whose `chipCounts[candidate.id]?.open` is greater than 0; return `null` if none. Use the same `chipCounts` object already passed to `StoryDeskGrid`/`StoryFocusView` — do not add a query, a selector or a second counts source.
- Remove `reviewedIds={reviewedIds}` from the `<StoryDeskGrid>` mount, remove `reviewed={…}` and `onToggleReviewed={…}` from the `<StoryFocusView>` mount, and change `nextUnreviewed={nextUnreviewedAfter(storySectionId)}` to `nextNeedsYou={nextNeedsYouAfter(storySectionId)}`.

**Then delete the file** `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/useReviewedSections.ts` with `git rm`.

Touch nothing else in `ReviewDeskRunView.tsx` — every other behaviour on the Review Desk stays exactly as shipped (D-24).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/StoryDeskGrid.test.tsx __tests__/SectionChipList.test.tsx && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `test ! -f "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/useReviewedSections.ts"` succeeds
    - `grep -rn "useReviewedSections" apps/dispatch-control --include=*.ts --include=*.tsx` returns NO matches
    - `grep -rn "reviewDesk:reviewed" apps/dispatch-control` returns NO matches (the localStorage key is gone)
    - `grep -rn "onToggleReviewed\|reviewedIds\|isReviewed\|nextUnreviewed" apps/dispatch-control --include=*.ts --include=*.tsx` returns NO matches
    - `grep -rn "Mark reviewed" apps/dispatch-control --include=*.tsx` returns NO matches
    - `grep -n "nextNeedsYou" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFocusView.tsx" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx"` matches in both files
    - `grep -n "Next that needs you" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFocusView.tsx"` matches
    - `pnpm --filter dispatch-control build` exits 0 — this is the ONLY gate that catches the missing-required-prop class of break (Pitfall 4; Vitest does not type-check)
  </acceptance_criteria>
  <done>The hook file, its localStorage key and every reviewed-prop site are gone; the Review Desk's progress, badge and footer nav all derive from open findings; the strict build passes.</done>
</task>

</tasks>

<verification>
- `grep -rn "useReviewedSections\|reviewedIds\|localStorage" apps/dispatch-control/app/\(dashboard\)/review-desk` returns no bookkeeping matches
- `pnpm --filter dispatch-control test` exits 0
- `pnpm --filter dispatch-control build` exits 0
</verification>

<success_criteria>
- No manual "mark reviewed" affordance, prop, hook or localStorage key exists anywhere in the app.
- Review Desk's progress header, per-card badge and next-section footer are computed from `chipCounts[...].open`.
- The strict Next.js build passes — proving the deletion did not leave a required prop dangling.
</success_criteria>

<output>
After completion, create `.planning/phases/51-section-read-and-fix-in-place/51-03-SUMMARY.md`
</output>
