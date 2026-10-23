---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 06
type: execute
wave: 3
depends_on: [56-01, 56-02, 56-03, 56-04]
files_modified:
  - apps/dispatch-control/app/(editorial)/s/[section]/page.tsx
  - apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionHeader.tsx
  - apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionEndNav.tsx
  - apps/dispatch-control/app/(editorial)/s/[section]/_components/AgentChangesNote.tsx
  - apps/dispatch-control/app/(editorial)/s/[section]/_components/ExemptSectionNote.tsx
  - apps/dispatch-control/app/(editorial)/s/[section]/_components/EarlierIssueBanner.tsx
  - apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx
  - apps/dispatch-control/__tests__/SectionReaderPage.test.tsx
autonomous: true
requirements: [P56-A1, P56-A2, P56-A3, P56-B4]

must_haves:
  truths:
    - "/s/[section] matches the Section artboard: slab with ghost 'Back to the issue', breadcrumb 'Issue 48 · <charity>', 'Part 3 of 9 · Founder', title, subtitle, toolbar, paragraphs, writers' changes, prev/next"
    - "Text parts are edited paragraph by paragraph in place; Game, Podcast, Look and Deliberation keep their existing Galley bodies inside the same frame"
    - "A published issue's part is read-only with the helper 'This issue is published. Changes after publishing need a new issue.'"
    - "No 'Inspect how this was made', no fact/claim cards, no selection toolbar, no mono caps on the page"
  artifacts:
    - path: "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"
      provides: "Rebuilt Section page"
      contains: "SectionArticle"
    - path: "apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionEndNav.tsx"
      provides: "Previous / All nine parts / Next"
      contains: 'aria-label="Other parts"'
  key_links:
    - from: "page.tsx"
      to: "_components/SectionArticle.tsx"
      via: "text parts render SectionArticle with getRevisionId reading the live draft"
      pattern: "<SectionArticle"
    - from: "page.tsx"
      to: "_components/RewriteThisPart.tsx"
      via: "toolbar"
      pattern: "<RewriteThisPart"
---

<objective>
Rebuild `/s/[section]` (and `?run=`) to the Section artboard, composing the 56-04 paragraph editor and Rewrite helper with the shared slab. Retire the selection-toolbar edit flow, the provenance/inspector hooks, the earlier-issue banner and InPlaceBlockEditor.

Purpose: Locked decision 6; client bug 5; success criterion 3 (no jargon) on the most-used editing page. Replaces the baseline failing test.
Output: rebuilt page + 4 rewritten sub-components, 2 deleted, rewritten SectionReaderPage.test.tsx.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UI-SPEC.md
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/canvas/Section.dc.html
@apps/dispatch-control/app/(editorial)/s/[section]/page.tsx
@apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionArticle.tsx
@apps/dispatch-control/app/(editorial)/s/[section]/_components/RewriteThisPart.tsx
@apps/dispatch-control/lib/editorState.ts

<interfaces>
Existing page.tsx facts: client component; `params` + `searchParams` (thenable-safe via `use()`); reads `?run=`; `useCurrentRun({ runId })`; `getDraft(runId, token)` into state; renders `Galley` for sections; uses `useInspector`, `ClaimProvenanceCard`, `PassageToolbar` selection, `EarlierIssueBanner`, `InPlaceBlockEditor`, `AgentChangesNote`, `ExemptSectionNote`, `SectionEndNav`, `SectionHeader`; `notFound()` for unknown section ids via `EDITABLE_SECTIONS`.
```typescript
// 56-04
SectionArticle({ runId, sectionId, blocks, getRevisionId, readOnly, onSaved, bonusBody? })
RewriteThisPart({ runId, sectionId, bonusType?, published, runStatus?, currentBlocks, getRevisionId, onRewritten, bonusBody? })
// 56-01
PART_ORDER, PART_LABELS, COPY.sectionSlab/backToIssue/sectionToolbarHelper/sectionPublishedHelper/loadFailed/reloadButton
// lib/homeSections.ts deriveHomeSections → rows[].agentChanges (writers' changes count per part)
// lib/issueRouteResolver.ts sectionEditHref(sectionId, runId, currentRunId)
// components/galley/Galley.tsx — keep for game/podcast/theme/deliberation-conversation with hideFindings (read its props; do not edit Galley)
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite SectionHeader, SectionEndNav, AgentChangesNote, ExemptSectionNote</name>
  <files>apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionHeader.tsx, apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionEndNav.tsx, apps/dispatch-control/app/(editorial)/s/[section]/_components/AgentChangesNote.tsx, apps/dispatch-control/app/(editorial)/s/[section]/_components/ExemptSectionNote.tsx</files>
  <read_first>
    - each of the four current files
    - 56-UI-SPEC.md § "6. Section page" (top row, title, toolbar, writers' changes details, prev/next) and § Responsive contract Section + prev/next bullets
    - canvas/Section.dc.html
  </read_first>
  <action>
- `SectionHeader.tsx`: props `{ issueLabel: string /* 'Issue 48 · Kumasi Roofless Schools Trust' */; issueHref: string; partIndex: number /* 1-based */; partLabel: string; title: string; subtitle?: string | null }`. Top row `flex flex-wrap justify-between gap-2`: Link issueLabel (15px ink-soft, hover cobalt) and `Part {partIndex} of 9 · {partLabel}` (15px ink-soft). `h1` Newsreader `text-[32px] leading-[1.1] sm:text-[42px] sm:leading-[1.06] font-semibold`. Subtitle Lora italic `text-[18px] sm:text-[23px] leading-[1.4]` ink-soft max-w-[720px].
- `SectionEndNav.tsx`: props `{ prev: { href: string; index: number; label: string } | null; next: same | null; allHref: string }`. `nav aria-label="Other parts"`: phone stacks three full-width `min-h-[56px]` rows in order Previous, Next, All nine parts (use `order-*` classes); sm+ one row: left ghost block `Previous · Part {i}` / `{label}`, centre link "All nine parts", right ghost block `Next · Part {i}` / `{label}`; missing side omitted. Ghost block = Link with 1px ink border, white, 17px/600 first line, 15px ink-soft second line.
- `AgentChangesNote.tsx`: props `{ count: number; items: string[] }`; return null when count === 0; else `details` (closed) with `summary` 17px/600 `What the writers changed in this part ({count})` (48px min-height) and `ul` of items 15px. Items are plain sentences — if the current source strings contain agent keys or raw finding codes, map them to 'A sentence was reworded to match the sources.' (generic) rather than printing them.
- `ExemptSectionNote.tsx`: props `{ kind: 'game' | 'podcast' | 'theme' | 'deliberation' | 'bonus-media' }`; one Lora 17px ink-soft `p` per kind, verbatim (ASSUMPTION A2: these parts have no Rewrite button and no pencil):
  - game: 'This part is a small game readers play on the website. You can try it below. It can\'t be changed here.'
  - podcast: 'This part is the week\'s audio. Listen below. It can\'t be changed here.'
  - theme: 'These are the colours and fonts for this issue. They can\'t be changed here.'
  - deliberation: 'This is how the writers chose this week\'s charity. It can\'t be changed here.'
  - bonus-media (jingle / bigBudget bonus): 'This bonus is a recording or a big picture, not text. It can\'t be changed here.'
  None may match EDITOR_BANNED_PATTERN.
No `font-mono`, `uppercase`, `tracking-`, or sizes outside 15/17/18/23/26/32/42 in any of the four files.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && grep -nE "font-mono|uppercase|tracking-|textTransform|text-\[(9|10|11|12|13|14|16|19|20|21|22)px\]" "apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionHeader.tsx" "apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionEndNav.tsx" "apps/dispatch-control/app/(editorial)/s/[section]/_components/AgentChangesNote.tsx" "apps/dispatch-control/app/(editorial)/s/[section]/_components/ExemptSectionNote.tsx"; test $? -eq 1</automated>
  </verify>
  <acceptance_criteria>
    - the grep above returns no matches (exit 1)
    - `grep -n 'aria-label="Other parts"' ".../SectionEndNav.tsx"` matches; `grep -n "All nine parts" ".../SectionEndNav.tsx"` matches
    - `grep -n "What the writers changed in this part" ".../AgentChangesNote.tsx"` matches
  </acceptance_criteria>
  <done>Section sub-components match the artboard and copy contract.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Rebuild page.tsx; delete EarlierIssueBanner + InPlaceBlockEditor; rewrite SectionReaderPage.test</name>
  <files>apps/dispatch-control/app/(editorial)/s/[section]/page.tsx, apps/dispatch-control/app/(editorial)/s/[section]/_components/EarlierIssueBanner.tsx, apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx, apps/dispatch-control/__tests__/SectionReaderPage.test.tsx</files>
  <read_first>
    - current page.tsx in full (draft load, searchParams handling, notFound, Galley usage for non-text parts)
    - __tests__/SectionReaderPage.test.tsx mocking setup (reuse its mocks; replace its assertions)
    - 56-UI-SPEC.md § "6. Section page" and § Copywriting "Section page" slab row
  </read_first>
  <behavior>
    - /s/founderBio renders slab sentence 'Read this part and change any words you like. Then go back to the issue to publish it.' with ghost 'Back to the issue' (href '/' or '/?run=<id>' when pinned) and zero [data-primary]
    - shows 'Part 3 of 9 · Founder' and the breadcrumb 'Issue 48 · <charity>'
    - toolbar helper 'Click any paragraph to change the words. Changes save to this issue straight away.' and a 'Rewrite this part' button for founderBio
    - clicking paragraph 2 opens a textarea; Save calls patchSection('run-1','founderBio', { ifRevisionID: <draft.revisionId>, blocks }) 
    - /s/bonus with bonusType 'specAd': Save calls patchBonus, never patchSection (replaces the baseline-failing test)
    - /s/game and /s/podcast: no 'Rewrite this part' button, no pencil, ExemptSectionNote text visible
    - published issue: no pencil buttons, helper 'This issue is published. Changes after publishing need a new issue.'
    - prev/next: founderBio shows 'Previous · Part 2' (Problem) and 'Next · Part 4' (Case study); originStory has no Previous
    - draft load error → 'This page didn't load. Check your connection, then press Reload this page.'
    - unknown section id → notFound
    - textContent never matches EDITOR_BANNED_PATTERN / RUN_ID_PATTERN; no text 'Inspect how this was made'
  </behavior>
  <action>
Rewrite `page.tsx` keeping: 'use client', thenable-safe `params`/`searchParams` handling, `?run=` pinning through `useCurrentRun({ runId })`, `getDraft` load into `draft` state with a `reloadDraft` callback, `notFound()` for ids not in `PART_ORDER`. A `draftRef` holds the latest draft; `getRevisionId = () => draftRef.current!.revisionId` (fresh at save time).
Layout: `NextStepSlab sentence={COPY.sectionSlab} ghost={{ label: COPY.backToIssue, href: issueHref }}` → `article` `bg-[color:var(--color-card)] border border-[color:var(--color-line-strong)] px-4 pt-8 pb-12 sm:px-[clamp(24px,7vw,96px)] sm:pt-12 sm:pb-16` containing `SectionHeader` (issueLabel `Issue ${n} · ${charity ?? 'Charity not chosen yet'}`, issueHref = '/' or `/?run=${runId}` when pinned and not latest; partIndex = PART_ORDER.indexOf(id)+1; partLabel PART_LABELS[id]; title = draft section headline or bonus/game title; subtitle from the draft if present), toolbar strip (`max-w-[720px] border-y border-[color:var(--color-line)] py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`: 15px helper = published ? COPY.sectionPublishedHelper : (exempt ? ExemptSectionNote : COPY.sectionToolbarHelper); right side `<RewriteThisPart ... onRewritten={reloadDraft} />`), body: for originStory/problemStatement/founderBio/caseStudy → `<SectionArticle blocks={draft.sections[id].blocks} ... readOnly={published} onSaved={reloadDraft} />`; bonus with bonusType 'specAd' → SectionArticle over the bonus body blocks with `bonusBody` mapping to the real BonusPatchPayload (same mapping the 56-04 SUMMARY records); game/podcast/theme/deliberation-conversation and non-specAd bonus → existing `Galley` render for that section exactly as today but with `hideFindings` and without passage-selection/inspector handlers, wrapped by ExemptSectionNote. Then `<AgentChangesNote count={row.agentChanges} items={...} />` (row from `deriveHomeSections`), then `<SectionEndNav>` using PART_ORDER neighbours and `sectionEditHref(id, runId, latestRunId)`; allHref = issueHref.
Remove every import of: useInspector, ClaimProvenanceCard, PassageToolbar types, EarlierIssueBanner, InPlaceBlockEditor, Skeleton-free spinners (keep SkeletonLine for loading). `published` = issue published or run status 'complete'.
`git rm` EarlierIssueBanner.tsx and InPlaceBlockEditor.tsx. Rewrite `__tests__/SectionReaderPage.test.tsx` for every behavior bullet (reuse its existing vi.mock setup for convex/react, @clerk/nextjs, @/lib/useCurrentRun, @/lib/contentPatchClient, next/navigation; drop the InspectorProvider wrapper).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/SectionReaderPage.test.tsx __tests__/SectionArticle.test.tsx __tests__/RewriteThisPart.test.tsx __tests__/Galley.test.tsx && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "useInspector\|ClaimProvenanceCard\|PassageToolbar\|EarlierIssueBanner\|InPlaceBlockEditor\|Inspect how this was made" "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` returns nothing
    - `test ! -e "apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx" && test ! -e "apps/dispatch-control/app/(editorial)/s/[section]/_components/EarlierIssueBanner.tsx"`
    - `grep -c "<SectionArticle\|<RewriteThisPart\|<NextStepSlab" "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` >= 3
    - SectionReaderPage.test.tsx passes with 0 failures (baseline failure gone); strict build exits 0 (a build or suite failure caused only by a file owned by a sibling wave-3 plan is NOT this plan's failure — record it in the SUMMARY; the authoritative strict build + full suite is 56-12)
  </acceptance_criteria>
  <done>The Section artboard is live; paragraph edit and Rewrite are wired; old edit flow is gone.</done>
</task>

</tasks>

<verification>
Section tests + Galley tests green; strict build green; full suite has zero failures from this plan's files.
</verification>

<success_criteria>
Section artboard live at desktop and phone classes; P56-B4 proven at page level; client bug 5 closed.
</success_criteria>

<output>
After completion, create `.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-06-SUMMARY.md`
</output>
