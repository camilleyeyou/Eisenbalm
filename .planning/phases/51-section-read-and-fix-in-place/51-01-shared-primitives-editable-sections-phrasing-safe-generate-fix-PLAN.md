---
phase: 51-section-read-and-fix-in-place
plan: 01
type: execute
wave: 2
depends_on: ["51-00"]
files_modified:
  - apps/dispatch-control/lib/editableSections.ts
  - apps/dispatch-control/lib/derivedState.ts
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx
  - apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx
  - apps/dispatch-control/components/galley/ClaimMark.tsx
  - apps/dispatch-control/components/galley/AnnotationMark.tsx
  - apps/dispatch-control/components/galley/GallerySection.tsx
  - apps/dispatch-control/components/galley/Galley.tsx
autonomous: true
requirements: [READ-02, READ-03, READ-07, READ-08]

must_haves:
  truths:
    - "EDITABLE_SECTIONS is importable from shared lib/ and Review Desk still compiles via a re-export"
    - "ClaimProvenanceCard can render without any block-level element, so it may legally mount inside a galley popover"
    - "A voice finding with no stored suggestedFix still offers Accept when the caller passes generateFixOnAccept, regardless of the accept label string"
    - "Voice Pass's existing 'Accept rewrite' behaviour is unchanged"
  artifacts:
    - path: "apps/dispatch-control/lib/editableSections.ts"
      provides: "EDITABLE_SECTIONS + SectionMeta canonical home"
      exports: ["EDITABLE_SECTIONS", "SectionMeta"]
    - path: "apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx"
      provides: "phrasingSafe render mode"
      contains: "phrasingSafe"
    - path: "apps/dispatch-control/components/galley/AnnotationMark.tsx"
      provides: "generateFixOnAccept prop + axis tag"
      contains: "generateFixOnAccept"
  key_links:
    - from: "apps/dispatch-control/lib/derivedState.ts"
      to: "apps/dispatch-control/lib/editableSections.ts"
      via: "import EDITABLE_SECTIONS"
      pattern: "from '\\./editableSections'"
    - from: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx"
      to: "apps/dispatch-control/lib/editableSections.ts"
      via: "re-export"
      pattern: "export \\{ EDITABLE_SECTIONS"
    - from: "apps/dispatch-control/components/galley/Galley.tsx"
      to: "apps/dispatch-control/components/galley/AnnotationMark.tsx"
      via: "showAxisTag + generateFixOnAccept threaded through GallerySection"
      pattern: "showAxisTag"
---

<objective>
Land the four shared, additive primitives every other Phase 51 plan depends on, without changing a single byte of behaviour on Review Desk or Voice Pass.

Purpose: `/s/[section]` cannot be built until (a) `EDITABLE_SECTIONS` lives somewhere a non-`(dashboard)` route may import from, (b) `ClaimProvenanceCard` can legally nest inside a galley popover, (c) `AnnotationMark`'s Accept no longer depends on the literal string `'Accept rewrite'`, and (d) the Fact/Voice/Source tag exists on the marks.

Output: `lib/editableSections.ts` (new), a `phrasingSafe` mode on `ClaimProvenanceCard`, a `generateFixOnAccept` prop + `showAxisTag` prop on `AnnotationMark`, a `showAxisTag` prop on `ClaimMark`, and both threaded `Galley` → `GallerySection` → mark.
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
@.planning/phases/51-section-read-and-fix-in-place/51-UI-SPEC.md

<interfaces>
<!-- Contracts the executor needs. Extracted from live source. Do not re-explore. -->

apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx (current, lines ~26-57):
```typescript
export interface SectionMeta {
  id: string
  label: string
}

/** The 9 editable surfaces, in reading order (RESEARCH Field Inventory). */
export const EDITABLE_SECTIONS: SectionMeta[] = [
  { id: 'originStory', label: 'Origin Story' },
  { id: 'problemStatement', label: 'Problem' },
  { id: 'founderBio', label: 'Founder Bio' },
  { id: 'caseStudy', label: 'Case Study' },
  { id: 'bonus', label: 'Bonus' },
  { id: 'game', label: 'Game' },
  { id: 'deliberation-conversation', label: 'Deliberation' },
  { id: 'podcast', label: 'Podcast' },
  { id: 'theme', label: 'Theme' },
]
```

apps/dispatch-control/lib/derivedState.ts line 24 (the upward import to fix):
```typescript
import { EDITABLE_SECTIONS } from '../app/(dashboard)/review-desk/[runId]/_components/SectionChipList'
```

apps/dispatch-control/components/galley/AnnotationMark.tsx (current, line ~146 + props):
```typescript
export interface AnnotationMarkDef {
  findingId: string
  severity: 'info' | 'warning' | 'error'
  axis?: string
  reason: string
  suggestedFix?: string
  quotedSpan?: string
}
const acceptLabel = labels?.accept ?? 'Accept fix'
const isRewriteVariant = labels?.accept === 'Accept rewrite'
// gate today: {canAct && (isRewriteVariant || value.suggestedFix) && <button>…}
// and:        {!isRewriteVariant && !value.suggestedFix && <span>Accept unavailable — no suggested fix.</span>}
```

apps/dispatch-control/lib/galley/axisPartition.ts exports `FACTUAL_AXES` and `VOICE_AXES` (ReadonlySet<string>).
FACTUAL_AXES = precision, cross-section-consistency, structural-variety, hard-rule
VOICE_AXES  = gravity, sentiment, irony-signaling, machine-tell

apps/dispatch-control/components/galley/GallerySection.tsx (line ~157) mounts the mark like this today:
```tsx
annotation: ({ value, children }) => (
  <AnnotationMark value={value} runId={runId} sectionId={sectionId} revisionId={revisionId}
    reloadDraft={reloadDraft} onEditSection={onEditSection} onInspect={onInspect} labels={labels}>
    {children}
  </AnnotationMark>
),
claimSpan: ({ value, children }) => (
  <ClaimMark value={value as ClaimSpanMarkDef} runId={runId} onUnsourcedClaimClick={onUnsourcedClaimClick}>
    {children}
  </ClaimMark>
),
```
The `components` object is inside a `useMemo` whose dep array is
`[runId, sectionId, revisionId, reloadDraft, onEditSection, onInspect, labels, onUnsourcedClaimClick]`
— any new prop MUST be added to that dep array.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Promote EDITABLE_SECTIONS/SectionMeta into shared lib and re-export (D-17)</name>
  <files>apps/dispatch-control/lib/editableSections.ts, apps/dispatch-control/lib/derivedState.ts, apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx (full — the definitions being moved and the default component that consumes them)
    - apps/dispatch-control/lib/derivedState.ts lines 1-40 (the upward import at line 24) and lines 270-320 (deriveSectionStates, which iterates EDITABLE_SECTIONS)
    - apps/dispatch-control/__tests__/SectionChipList.test.tsx (the regression suite that must keep passing unmodified)
  </read_first>
  <action>
Create `apps/dispatch-control/lib/editableSections.ts` as the new canonical home. It must contain, verbatim, the `SectionMeta` interface and the `EDITABLE_SECTIONS` array exactly as they exist today in `SectionChipList.tsx` — same nine entries, same ids, same labels, same order:

```typescript
/**
 * Phase 51 (D-17) — canonical home for the nine editable sections.
 *
 * Promoted OUT of app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx
 * so shared selectors (lib/derivedState.ts) and the new (editorial) route group
 * can import it without reaching upward into an old-console route-private
 * _components folder. SectionChipList.tsx re-exports both symbols so every
 * existing importer keeps compiling unchanged.
 */
export interface SectionMeta {
  id: string
  label: string
}

/** The 9 editable surfaces, in reading order (RESEARCH Field Inventory). */
export const EDITABLE_SECTIONS: SectionMeta[] = [
  { id: 'originStory', label: 'Origin Story' },
  { id: 'problemStatement', label: 'Problem' },
  { id: 'founderBio', label: 'Founder Bio' },
  { id: 'caseStudy', label: 'Case Study' },
  { id: 'bonus', label: 'Bonus' },
  { id: 'game', label: 'Game' },
  { id: 'deliberation-conversation', label: 'Deliberation' },
  { id: 'podcast', label: 'Podcast' },
  { id: 'theme', label: 'Theme' },
]
```

In `SectionChipList.tsx`: DELETE the local `SectionMeta` interface declaration and the local `EDITABLE_SECTIONS` const, and replace them with an import + re-export so every existing importer of `.../SectionChipList` keeps compiling with zero edits:

```typescript
import { EDITABLE_SECTIONS, type SectionMeta } from '@/lib/editableSections'
export { EDITABLE_SECTIONS }
export type { SectionMeta }
```

(The file already uses `EDITABLE_SECTIONS` as the `sections` prop default — that keeps working from the import.)

In `lib/derivedState.ts`: change line 24 from
`import { EDITABLE_SECTIONS } from '../app/(dashboard)/review-desk/[runId]/_components/SectionChipList'`
to
`import { EDITABLE_SECTIONS } from './editableSections'`

Do NOT change `deriveSectionStates`' logic — READ-08's "any section with open findings" maps directly to the existing `openCount > 0`, so no extension is needed (D-16/D-17). Do NOT touch any other importer of `SectionChipList`; the re-export is what keeps them working.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/SectionChipList.test.tsx __tests__/derivedState.test.ts __tests__/runSections.test.ts __tests__/WorkspaceOutline.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `apps/dispatch-control/lib/editableSections.ts` exists and `grep -c "id: '" apps/dispatch-control/lib/editableSections.ts` returns 9
    - `grep -n "deliberation-conversation" apps/dispatch-control/lib/editableSections.ts` matches
    - `grep -n "review-desk/\[runId\]/_components/SectionChipList" apps/dispatch-control/lib/derivedState.ts` returns NO matches
    - `grep -n "from './editableSections'" apps/dispatch-control/lib/derivedState.ts` matches
    - `grep -n "export { EDITABLE_SECTIONS }" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx"` matches
    - `grep -n "export const EDITABLE_SECTIONS" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx"` returns NO matches
    - `cd apps/dispatch-control && npx vitest run __tests__/SectionChipList.test.tsx __tests__/derivedState.test.ts __tests__/runSections.test.ts __tests__/WorkspaceOutline.test.tsx` exits 0 with those test files UNMODIFIED (`git diff --name-only` must not list them)
  </acceptance_criteria>
  <done>EDITABLE_SECTIONS/SectionMeta live in `lib/editableSections.ts`; `derivedState.ts` imports downward; `SectionChipList.tsx` re-exports; four existing test files pass unmodified.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add a phrasingSafe render mode to ClaimProvenanceCard and use it in ClaimMark (Pitfall 1, D-20)</name>
  <files>apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx, apps/dispatch-control/components/galley/ClaimMark.tsx</files>
  <behavior>
    - When `phrasingSafe` is unset/false, the card renders exactly the markup it renders today (block-level `div`/`p`/`h3`) — every existing `ClaimProvenanceCard.test.tsx` assertion passes unmodified.
    - When `phrasingSafe` is true, the rendered subtree contains ZERO `div`, `p`, `h3`, `h2`, `ul`, `li` elements — every one of them becomes `<span style={{ display: 'block' }}>` carrying the same className, same text, same order.
    - `ClaimMark`'s popover (a `<span role="dialog" className="galley-popover">`) mounts the card with `phrasingSafe` so its own already-shipped popover stops emitting block-in-phrasing markup.
    - `ClaimProvenanceRow` (the separate lighter export at the bottom of the same file, used by Approval's SourceIndex) is NOT changed at all.
  </behavior>
  <read_first>
    - apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx (full 523 lines — every `div`/`p`/`h3` must be converted under the flag, and `ClaimProvenanceRow` at the bottom must be left alone)
    - apps/dispatch-control/components/galley/ClaimMark.tsx (full — the `<span role="dialog">` popover at ~line 190 and the `<ClaimProvenanceCard>` mount inside it)
    - apps/dispatch-control/components/galley/AnnotationMark.tsx lines 265-345 (the phrasing-safe convention to mirror: every popover child is `<span style={{ display: 'block' }}>`, never a `<div>`)
    - apps/dispatch-control/__tests__/ClaimProvenanceCard.test.tsx and apps/dispatch-control/__tests__/ClaimMark.test.tsx (assertions that must keep passing)
  </read_first>
  <action>
Add an optional prop to `ClaimProvenanceCard`:

```typescript
/**
 * Phase 51 (D-20, Pitfall 1) — render every container as
 * `<span style={{ display: 'block' }}>` instead of `<div>`/`<p>`/`<h3>` so this
 * card can legally mount inside a galley popover, which is PHRASING CONTENT
 * (it renders inside the galley's <p> elements). Visual output is unchanged —
 * only the element types change. Default false = today's block markup,
 * byte-identical for every existing caller.
 */
phrasingSafe?: boolean
```

Implementation shape — introduce two local element aliases at the top of the component body and use them for EVERY container/text node in the returned tree:

```tsx
const Box = phrasingSafe ? 'span' : 'div'
const Txt = phrasingSafe ? 'span' : 'p'
const boxStyle = phrasingSafe ? ({ display: 'block' } as React.CSSProperties) : undefined
```

Then convert mechanically, preserving className and children exactly:
- every `<div className="X">…</div>` → `<Box className="X" style={boxStyle}>…</Box>`
- every `<p className="X">…</p>` → `<Txt className="X" style={boxStyle}>…</Txt>`
- every `<h3 className="X">…</h3>` → `<Txt className="X" style={boxStyle}>…</Txt>` (in phrasingSafe mode a heading is not phrasing content either; keep the `<h3>` in the default branch)
- If any `style={...}` already exists on a converted node, merge: `style={phrasingSafe ? { display: 'block', ...existing } : existing}`.
- `<button>`, `<input>`, `<textarea>`, `<a>`, `<span>` are already phrasing content — leave them exactly as they are.
- Do NOT change any className, any copy string, any handler, any conditional. This is an element-type change only.
- Leave the separate `ClaimProvenanceRow` export at the bottom of the file completely untouched (it renders inside Approval's SourceIndex, which is not phrasing-constrained).

In `ClaimMark.tsx`: pass `phrasingSafe` on the `<ClaimProvenanceCard …>` mount inside the `<span role="dialog" className="galley-popover">` popover. This is the opportunistic fix of the already-shipped nesting bug on Review Desk / Voice Pass — a strict DOM-validity improvement, no visual or behavioural change.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/ClaimProvenanceCard.test.tsx __tests__/ClaimMark.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "phrasingSafe" apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx` matches at least 3 times (prop declaration, destructure, alias)
    - `grep -n "phrasingSafe" apps/dispatch-control/components/galley/ClaimMark.tsx` matches
    - `grep -n "ClaimProvenanceRow" apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx` still matches (the export was not removed)
    - `cd apps/dispatch-control && npx vitest run __tests__/ClaimProvenanceCard.test.tsx __tests__/ClaimMark.test.tsx` exits 0
    - The Wave-0 structural assertion added by plan 51-00 (`expect(container.querySelector('.galley-popover div')).toBeNull()` in ClaimMark.test.tsx) passes
  </acceptance_criteria>
  <done>`ClaimProvenanceCard` renders zero block-level elements under `phrasingSafe`; `ClaimMark`'s popover uses it; all existing card/mark tests pass; `ClaimProvenanceRow` unchanged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Re-base the voice-rewrite trigger onto generateFixOnAccept and add the Fact/Voice/Source tag (Pitfall 2, D-07, D-08)</name>
  <files>apps/dispatch-control/components/galley/AnnotationMark.tsx, apps/dispatch-control/components/galley/ClaimMark.tsx, apps/dispatch-control/components/galley/GallerySection.tsx, apps/dispatch-control/components/galley/Galley.tsx</files>
  <behavior>
    - A finding with `axis: 'machine-tell'` and NO `suggestedFix`, rendered with `labels={{ accept: 'Accept rewrite' }}` and no `generateFixOnAccept`, still shows a working Accept button (Voice Pass regression — unchanged).
    - The SAME finding rendered with `labels={{ accept: 'Accept suggestion' }}` AND `generateFixOnAccept` shows a working Accept button labelled "Accept suggestion" (the new surface).
    - The SAME finding rendered with `labels={{ accept: 'Accept suggestion' }}` and NO `generateFixOnAccept` still shows "Accept unavailable — no suggested fix." (Review Desk behaviour preserved).
    - With `showAxisTag`, a finding whose axis is in `FACTUAL_AXES` renders the visible text "Fact" adjacent to the span; an axis in `VOICE_AXES` renders "Voice"; an `undefined` axis renders "Fact".
    - With `showAxisTag`, a `ClaimMark` whose `provenance === 'unsourced'` renders the visible text "Source" adjacent to the span; a `sourced` claim renders no tag.
    - Without `showAxisTag` (Review Desk / Voice Pass), no tag renders anywhere.
  </behavior>
  <read_first>
    - apps/dispatch-control/components/galley/AnnotationMark.tsx (full — `isRewriteVariant` at ~line 146, `handleAccept` at ~219, the action row at ~305-320, and the `<mark>` element at ~270)
    - apps/dispatch-control/components/galley/ClaimMark.tsx (full — the `<mark className="galley-claim">` element and the `provenance` value)
    - apps/dispatch-control/components/galley/GallerySection.tsx lines 60-200 (props interface, the `useMemo` components object at ~157, and its dep array at ~182-191)
    - apps/dispatch-control/components/galley/Galley.tsx lines 119-190 (GalleyProps) and 360-425 (the two `<GallerySection …>` mounts that must both receive the new props)
    - apps/dispatch-control/lib/galley/axisPartition.ts (FACTUAL_AXES / VOICE_AXES membership)
    - apps/dispatch-control/__tests__/AnnotationMark.test.tsx and apps/dispatch-control/__tests__/Galley.test.tsx (must keep passing)
  </read_first>
  <action>
**3a — `AnnotationMark.tsx`, label-independent accept trigger.** Add two optional props to `AnnotationMarkProps`:

```typescript
/**
 * Phase 51 (D-08, Pitfall 2) — label-INDEPENDENT trigger for the on-demand
 * voice rewrite. Was keyed off `labels?.accept === 'Accept rewrite'`, which
 * silently breaks the moment a caller uses a neutral label vocabulary.
 * When true, Accept is offered even with no stored `suggestedFix` and
 * `handleAccept` generates one via voicePassClient.rewrite first.
 */
generateFixOnAccept?: boolean
/**
 * Phase 51 (D-07) — render a small always-visible Fact/Voice text tag
 * adjacent to the marked span, readable WITHOUT opening the popover.
 * Undefined (Review Desk / Voice Pass) renders no tag — unchanged.
 */
showAxisTag?: boolean
```

Replace the single line
`const isRewriteVariant = labels?.accept === 'Accept rewrite'`
with
`const isRewriteVariant = generateFixOnAccept === true || labels?.accept === 'Accept rewrite'`

Do NOT change anything else about `isRewriteVariant`'s downstream use — the accept-availability gate (`canAct && (isRewriteVariant || value.suggestedFix)`), the "Accept unavailable — no suggested fix." branch, and `handleAccept`'s `if (!value.suggestedFix) { rewrite(...) }` all keep working as-is. Voice Pass, which passes `labels.accept === 'Accept rewrite'` and no new prop, is bit-for-bit unchanged.

Leave the "Suggested house voice:" vs "Suggested:" line keyed off `isRewriteVariant` as it is (it now also reads "Suggested house voice:" on the new surface for voice findings, which is correct and matches D-08's "same mechanics, neutral action labels").

**3b — `AnnotationMark.tsx`, the Fact/Voice tag.** Add at the top of the file:
`import { FACTUAL_AXES, VOICE_AXES } from '@/lib/galley/axisPartition'`

Compute inside the component:
```typescript
// D-07 / UI-SPEC tag table: FACTUAL_AXES -> 'Fact', VOICE_AXES -> 'Voice',
// undefined axis -> 'Fact' (conservative default, matching axisPartition's
// own convention). Never blank, never a third catch-all label.
const axisTag = value.axis === undefined
  ? 'Fact'
  : VOICE_AXES.has(value.axis)
    ? 'Voice'
    : FACTUAL_AXES.has(value.axis)
      ? 'Fact'
      : 'Fact'
```

Render it immediately AFTER the `<mark>` element, inside the same outer wrapper `<span>`, gated on `showAxisTag`:

```tsx
{showAxisTag && (
  <span
    className="galley-anno-tag"
    aria-hidden="false"
    style={{
      marginLeft: 4,
      fontFamily: 'var(--font-ui)',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '.04em',
      textTransform: 'uppercase',
      color: 'var(--color-ink-soft)',
      whiteSpace: 'nowrap',
    }}
  >
    {axisTag}
  </span>
)}
```

The DOM text stays sentence-case `Fact`/`Voice` (uppercasing is CSS only) so screen readers announce a word — UI-SPEC Typography, locked. The colour is `var(--color-ink-soft)` for EVERY axis — the tag is deliberately not colour-coded per kind (UI-SPEC Color, locked); `data-severity` remains the only colour-bearing signal. No `lucide-react` icon — text only.

**3c — `ClaimMark.tsx`, the Source tag.** Add the same `showAxisTag?: boolean` prop with the same doc-comment shape. Render, immediately after the claim `<mark>` element and only when `showAxisTag && value.provenance === 'unsourced'`, the identical `<span className="galley-claim-tag" …>` with the text `Source` and the exact same inline style object as 3b. A `sourced` claim renders no tag (D-09).

**3d — `GallerySection.tsx`, thread both props.** Add to `GallerySectionProps`:
```typescript
// Phase 51 (D-08, Pitfall 2) — forwarded unmodified into every AnnotationMark.
generateFixOnAccept?: boolean
// Phase 51 (D-07) — forwarded into every AnnotationMark AND ClaimMark.
showAxisTag?: boolean
```
Destructure them, pass `generateFixOnAccept={generateFixOnAccept}` and `showAxisTag={showAxisTag}` on the `<AnnotationMark>` mount and `showAxisTag={showAxisTag}` on the `<ClaimMark>` mount inside the `useMemo` components object, and ADD both names to that `useMemo`'s dependency array (currently `[runId, sectionId, revisionId, reloadDraft, onEditSection, onInspect, labels, onUnsourcedClaimClick]`) — omitting them means the memo never re-renders when they change.

**3e — `Galley.tsx`, thread both props.** Add to `GalleyProps`:
```typescript
/**
 * Phase 51 (D-08, Pitfall 2) — forwarded unmodified to every GallerySection.
 * Set true on /s/[section] so a rule-only voice tell stays acceptable under
 * D-08's neutral labels. Undefined leaves today's render unaffected.
 */
generateFixOnAccept?: boolean
/**
 * Phase 51 (D-07) — Fact/Voice/Source text tags adjacent to every marked
 * span. Undefined (Review Desk / Voice Pass) leaves today's render unaffected.
 */
showAxisTag?: boolean
```
Destructure both in the component signature and pass them on BOTH `<GallerySection …>` mounts (the `LONG_READ_SECTIONS` map at ~line 360 and the `bonus`/specAd mount at ~line 405). Do not touch any other Galley behaviour.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/AnnotationMark.test.tsx __tests__/ClaimMark.test.tsx __tests__/Galley.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "generateFixOnAccept" apps/dispatch-control/components/galley/AnnotationMark.tsx apps/dispatch-control/components/galley/GallerySection.tsx apps/dispatch-control/components/galley/Galley.tsx` matches in all three files
    - `grep -n "generateFixOnAccept === true || labels?.accept === 'Accept rewrite'" apps/dispatch-control/components/galley/AnnotationMark.tsx` matches exactly once
    - `grep -n "showAxisTag" apps/dispatch-control/components/galley/AnnotationMark.tsx apps/dispatch-control/components/galley/ClaimMark.tsx apps/dispatch-control/components/galley/GallerySection.tsx apps/dispatch-control/components/galley/Galley.tsx` matches in all four files
    - `grep -n "FACTUAL_AXES" apps/dispatch-control/components/galley/AnnotationMark.tsx` matches
    - `grep -n "generateFixOnAccept," apps/dispatch-control/components/galley/GallerySection.tsx` appears in the useMemo dep array region (lines 180-200)
    - `grep -rn "lucide-react" apps/dispatch-control/components/galley/` returns NO matches
    - `cd apps/dispatch-control && npx vitest run __tests__/AnnotationMark.test.tsx __tests__/ClaimMark.test.tsx __tests__/Galley.test.tsx` exits 0, including the Wave-0 `generateFixOnAccept` regression cases and the Fact/Voice/Source tag cases
  </acceptance_criteria>
  <done>Accept for a fix-less voice finding is driven by an explicit prop, not a label string; Voice Pass unchanged; Fact/Voice/Source tags render only when the caller opts in; both props are threaded Galley → GallerySection → mark with correct memo deps.</done>
</task>

</tasks>

<verification>
- `cd apps/dispatch-control && npx vitest run __tests__/SectionChipList.test.tsx __tests__/derivedState.test.ts __tests__/runSections.test.ts __tests__/WorkspaceOutline.test.tsx __tests__/AnnotationMark.test.tsx __tests__/ClaimMark.test.tsx __tests__/ClaimProvenanceCard.test.tsx __tests__/Galley.test.tsx` exits 0
- `git diff --stat` shows NO changes under `app/(dashboard)/` other than `SectionChipList.tsx`
- No new npm dependency: `git diff --name-only` does not list `package.json` or any lockfile
</verification>

<success_criteria>
- `lib/editableSections.ts` is the canonical EDITABLE_SECTIONS home; `derivedState.ts` no longer imports upward from a route-private `_components` folder; Review Desk compiles via re-export.
- `ClaimProvenanceCard` has a `phrasingSafe` mode that emits zero block-level elements, and `ClaimMark` uses it.
- `AnnotationMark` offers Accept for a fix-less voice finding based on `generateFixOnAccept`, not on the string `'Accept rewrite'`.
- Fact/Voice/Source tags exist behind `showAxisTag` and are off by default.
- Every touched existing test file passes unmodified.
</success_criteria>

<output>
After completion, create `.planning/phases/51-section-read-and-fix-in-place/51-01-SUMMARY.md`
</output>
