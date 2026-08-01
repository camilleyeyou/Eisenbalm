---
phase: 51-section-read-and-fix-in-place
plan: 07
type: execute
wave: 5
depends_on: ["51-01", "51-05"]
files_modified:
  - apps/dispatch-control/lib/galley/findingClaimLink.ts
  - apps/dispatch-control/__tests__/findingClaimLink.test.ts
  - apps/dispatch-control/components/galley/AnnotationMark.tsx
  - apps/dispatch-control/components/galley/GallerySection.tsx
  - apps/dispatch-control/components/galley/Galley.tsx
  - apps/dispatch-control/app/(editorial)/s/[section]/page.tsx
  - apps/dispatch-control/__tests__/Galley.test.tsx
autonomous: true
requirements: [READ-03]

must_haves:
  truths:
    - "Opening a marked problem shows the agent's reasoning AND, when the finding sits on a tracked claim, that claim's evidence — source, publisher, supporting passage, retrieved date — in the same popover"
    - "The editor never leaves the paragraph to read the evidence"
    - "A finding overlapping a SOURCED claim shows that claim's source URL and retrieved date in the popover, even though D-09 suppressed the claim's own wash"
    - "A finding with no intersecting claim shows reasoning only, never an empty or blank evidence card"
    - "Review Desk and Voice Pass finding popovers are unchanged"
  artifacts:
    - path: "apps/dispatch-control/lib/galley/findingClaimLink.ts"
      provides: "pure client-side finding->claim intersection selector"
      exports: ["claimForFinding", "buildFindingClaimMap"]
    - path: "apps/dispatch-control/components/galley/AnnotationMark.tsx"
      provides: "ClaimProvenanceCard mounted phrasing-safe beneath the reason"
      contains: "ClaimProvenanceCard"
  key_links:
    - from: "apps/dispatch-control/components/galley/AnnotationMark.tsx"
      to: "apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx"
      via: "phrasingSafe mount inside the popover"
      pattern: "phrasingSafe"
    - from: "apps/dispatch-control/components/galley/GallerySection.tsx"
      to: "apps/dispatch-control/lib/galley/findingClaimLink.ts"
      via: "buildFindingClaimMap over resolved + claimResolved"
      pattern: "buildFindingClaimMap"
---

<objective>
Deliver D-20 / READ-03's second half: mount the shared `ClaimProvenanceCard` inside `AnnotationMark`'s popover, beneath the agent's reasoning, whenever the finding sits on a tracked claim.

Purpose: success criterion 3 is "read the agent's reasoning **and its evidence** without leaving the paragraph." `ClaimProvenanceCard` is mounted today only in `ClaimMark.tsx`, `VoicePassRunView.tsx`, `ReviewDeskRunView.tsx` and `FactCheckScreen.tsx` — never in `AnnotationMark.tsx`. Without this plan the `phrasingSafe` mode added in 51-01 has no caller that motivated it, and READ-03 is half-delivered against three governing documents (D-20, UI-SPEC "Popover Evidence Rendering", RESEARCH's READ-03 row).

The `PassageToolbar` "Related facts" panel is explicitly NOT the answer: it is a selection-driven, block-level panel elsewhere on the page, and reaching it means leaving the paragraph — exactly what SC-3 forbids.

Output: a pure intersection selector with its own unit test, plus a `claim` prop threaded `Galley` → `GallerySection` → `AnnotationMark`.
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
@.planning/phases/51-section-read-and-fix-in-place/51-UI-SPEC.md
@.planning/phases/51-section-read-and-fix-in-place/51-RESEARCH.md

<interfaces>
<!-- Contracts the executor needs. Extracted from live source. Do not re-explore. -->

WHY A CLIENT-SIDE DERIVATION IS REQUIRED (checked, not assumed):
`AnnotationMarkDef` carries no claim-link field, and `convex/schema.ts`'s `qaCorrections`
table has no `claimId`/`claimIndex`. Schema changes are forbidden this phase (ZERO schema
changes). The link therefore MUST be derived client-side. It can be: both sides are
already resolved to the same coordinate space by the SAME resolver.

lib/galley/spanResolver.ts:
  export interface ResolvedAnnotation {
    findingId: string; sectionId: string; blockIndex: number
    start: number; end: number            // char offsets into blocks[blockIndex].text
    severity: 'info' | 'warning' | 'error'; axis?: string
    reason: string; suggestedFix?: string; quotedSpan: string
  }

lib/galley/syntheticPortableText.ts:
  export interface ResolvedClaim {
    claimIndex: number; sectionId?: string; blockIndex: number
    start: number; end: number            // SAME coordinate space — both come from resolveSectionFindings
    provenance: 'sourced' | 'unsourced'
    sourceUrl?: string; retrievedAt?: number; status: string
    text: string; importance?: ClaimImportance; context?: string
  }

THE EXISTING MATCHING SCHEME to extend (Phase 45 "Related facts",
ReviewDeskRunView.tsx:449-451) — block-level only, no character overlap:
  const relatedClaim = relatedFacts
    ? claimRows?.find(row => row.sectionName === relatedFacts.sectionId
                          && row.blockIndexHint === relatedFacts.blockIndex)
    : undefined
This phase needs finer grain than a whole block (a paragraph routinely carries several
claims), so the selector below adds character-range overlap on top of the same
same-block predicate. It does not replace or modify the Phase 45 path.

components/provenance/ClaimProvenanceCard.tsx:
  export interface ClaimProvenanceView {
    text: string; importance?: ClaimImportance; status: string
    sourceUrl?: string; supportingPassage?: string; retrievedAt?: number
    sectionName?: string; confidence?: number; changedSinceCheck?: boolean
  }
  interface ClaimProvenanceCardProps { claim: ClaimProvenanceView; actions?: ClaimCardActions; busy?: boolean }
  // `actions` is OPTIONAL — omit it and the card renders read-only.
  // `phrasingSafe?: boolean` is added by plan 51-01 Task 2.

The EXACT ClaimProvenanceView mapping already used by ClaimMark.tsx:107-114 — reuse it
field-for-field so the two popovers can never disagree:
  { text, importance, status, sourceUrl, supportingPassage: context, retrievedAt, sectionName: sectionId }

components/galley/GallerySection.tsx already receives BOTH sides in scope:
  resolved: ResolvedAnnotation[]        (props line ~72)
  claimResolved?: ResolvedClaim[]       (props line ~84)
and mounts AnnotationMark from a useMemo'd portable-text `components.annotation` callback
(line ~157) whose argument is the `AnnotationMarkDef` (which carries `findingId`).
Its useMemo dep array is at lines ~182-191 — any new prop MUST be added to it.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure finding-to-claim intersection selector</name>
  <files>apps/dispatch-control/lib/galley/findingClaimLink.ts, apps/dispatch-control/__tests__/findingClaimLink.test.ts</files>
  <behavior>
    - A finding and a claim in the same `blockIndex` whose character ranges overlap link together.
    - A finding and a claim in the same block whose ranges do NOT overlap do not link.
    - A finding and a claim with equal ranges but different `blockIndex` do not link.
    - When two claims overlap the same finding, the one with the greater overlap length wins; ties break on the lower `claimIndex` so the result is deterministic.
    - A finding with no overlapping claim returns `null` — never a nearest-neighbour guess.
    - `buildFindingClaimMap` returns a `Map<findingId, ResolvedClaim>` containing only findings that actually matched.
    - The module is pure: no Convex import, no React import, no fetch.
  </behavior>
  <read_first>
    - apps/dispatch-control/lib/galley/spanResolver.ts (the `ResolvedAnnotation` shape and how `start`/`end` are produced, so the coordinate spaces are provably the same)
    - apps/dispatch-control/lib/galley/syntheticPortableText.ts lines 55-80 (`ResolvedClaim`)
    - apps/dispatch-control/lib/galley/findingGroups.ts (created in plan 51-05 Task 2 — match its file style, doc-comment shape and export conventions exactly; this is its sibling)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx lines 445-455 (the Phase 45 block-level `relatedClaim` predicate this extends rather than forks)
    - apps/dispatch-control/__tests__/derivedState.test.ts (the pure-selector test style to match)
  </read_first>
  <action>
Create `apps/dispatch-control/lib/galley/findingClaimLink.ts`, a pure selector in the same style as its sibling `lib/galley/findingGroups.ts`. No Convex, no React, no fetch.

```typescript
/**
 * Phase 51 (READ-03, D-20) — the finding -> tracked-claim link, derived
 * client-side.
 *
 * WHY DERIVED: `qaCorrections` carries no claimId/claimIndex and this phase
 * makes ZERO schema changes. It does not need one: `resolveSectionFindings`
 * resolves BOTH QA findings and claim_checks rows into the same
 * {blockIndex, start, end} coordinate space for the same section, so the link
 * is an intersection over data already on screen.
 *
 * This EXTENDS the Phase 45 "Related facts" predicate
 * (`sectionName === sectionId && blockIndexHint === blockIndex`,
 * ReviewDeskRunView.tsx:449-451) with character-range overlap, because a
 * paragraph routinely carries several claims and a whole-block match would
 * attach the wrong evidence to a finding. It does not modify or replace the
 * Phase 45 path, and it changes nothing in spanResolver.ts.
 *
 * No overlap => null. Never a nearest-neighbour guess: showing the wrong
 * evidence beside a finding is worse than showing none.
 */
export interface SpanLike { blockIndex: number; start: number; end: number }

export function claimForFinding<C extends SpanLike & { claimIndex: number }>(
  finding: SpanLike,
  claims: ReadonlyArray<C>,
): C | null

export function buildFindingClaimMap<
  A extends SpanLike & { findingId: string },
  C extends SpanLike & { claimIndex: number },
>(findings: ReadonlyArray<A>, claims: ReadonlyArray<C>): Map<string, C>
```

Overlap predicate, exactly:
```typescript
const overlaps = (a: SpanLike, c: SpanLike) =>
  a.blockIndex === c.blockIndex && a.start < c.end && c.start < a.end
const overlapLength = (a: SpanLike, c: SpanLike) =>
  Math.min(a.end, c.end) - Math.max(a.start, c.start)
```
`claimForFinding` returns the overlapping claim with the greatest `overlapLength`; on a tie, the lower `claimIndex` wins (deterministic — never input order, which varies with Convex row ordering). Zero-length overlaps do not count (the strict `<` comparisons already exclude them).

Create `apps/dispatch-control/__tests__/findingClaimLink.test.ts` (`.test.ts`, node environment — pure function, no jsdom) with one case per bullet in this task's `<behavior>` block, plus an empty-claims case returning `null` and an empty-findings case returning an empty `Map`.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/findingClaimLink.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `apps/dispatch-control/lib/galley/findingClaimLink.ts` exists
    - `grep -n "export function claimForFinding" apps/dispatch-control/lib/galley/findingClaimLink.ts` matches
    - `grep -n "export function buildFindingClaimMap" apps/dispatch-control/lib/galley/findingClaimLink.ts` matches
    - `grep -n "a.blockIndex === c.blockIndex" apps/dispatch-control/lib/galley/findingClaimLink.ts` matches
    - `grep -n "convex\|from 'react'\|fetch(" apps/dispatch-control/lib/galley/findingClaimLink.ts` returns NO matches
    - `git diff --name-only apps/dispatch-control/lib/galley/spanResolver.ts` returns NO lines (D-10: the resolver is untouched)
    - `cd apps/dispatch-control && npx vitest run __tests__/findingClaimLink.test.ts` exits 0 with at least 7 passing cases
  </acceptance_criteria>
  <done>A pure, tested intersection selector exists beside `findingGroups.ts`; `spanResolver.ts` and the Phase 45 related-facts path are both untouched.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Mount ClaimProvenanceCard phrasing-safe inside AnnotationMark's popover</name>
  <files>apps/dispatch-control/components/galley/AnnotationMark.tsx, apps/dispatch-control/components/galley/GallerySection.tsx, apps/dispatch-control/components/galley/Galley.tsx, apps/dispatch-control/app/(editorial)/s/[section]/page.tsx</files>
  <behavior>
    - A finding whose span overlaps a **sourced** tracked claim shows, in the same popover as its reason: the claim text, its **source URL**, its supporting passage and its **retrieved date** — even though D-09 suppressed that claim's own wash. This is the load-bearing case: `sourceUrl` and `retrievedAt` exist ONLY on sourced claims (convex/schema.ts:481-483 — `claimId`/`sourceUrl`/`retrievedAt` are additive together; absent => unsourced), and with the wash suppressed the finding popover is the only place left to see them.
    - A finding overlapping an unsourced claim shows the card with text and supporting passage and no source/date — correct, because those fields do not exist on that row.
    - A finding with no overlapping claim shows the reason only — no card, no blank fields, no empty container.
    - The popover subtree contains no `div`, `p` or `h3` element (Pitfall 1).
    - A caller that does not opt in (Review Desk, Voice Pass) renders exactly today's popover.
    - Through the REAL pipeline (`Galley` -> `resolveClaimsFor` -> `buildFindingClaimMap` -> `AnnotationMark`) with `markSourcedClaims={false}`, a sourced claim renders no wash AND its source URL and retrieved date still render in the overlapping finding's popover — both asserted in the same render.
  </behavior>
  <read_first>
    - apps/dispatch-control/components/galley/AnnotationMark.tsx (full — the popover at lines ~265-345, and the `<span className="galley-popover__reason">` the card mounts beneath; every popover child today is a `<span style={{ display: 'block' }}>`, a `<button>` or an `<input>`)
    - apps/dispatch-control/components/galley/ClaimMark.tsx lines 100-120 (the EXACT `ClaimProvenanceView` mapping to reuse field-for-field)
    - apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx lines 105-140 and 178-200 (`ClaimProvenanceView`, `ClaimProvenanceCardProps` — note `actions` is optional — and the `phrasingSafe` prop added in plan 51-01 Task 2)
    - apps/dispatch-control/components/galley/GallerySection.tsx lines 67-200 (props: `resolved`, `claimResolved`; the useMemo components object at ~157; its dep array at ~182-191)
    - apps/dispatch-control/components/galley/Galley.tsx lines 119-200 and 355-425 (GalleyProps and the two GallerySection mounts)
    - apps/dispatch-control/app/(editorial)/s/[section]/page.tsx (the Galley mount created in plan 51-04 Task 2)
  </read_first>
  <action>
**`AnnotationMark.tsx`** — add one optional prop:

```typescript
/**
 * Phase 51 (READ-03, D-20) — the tracked claim this finding sits on, when one
 * exists. Rendered as the SHARED ClaimProvenanceCard beneath the reason, in
 * phrasing-safe mode, so evidence is read IN the paragraph (SC-3). Undefined
 * (Review Desk / Voice Pass) leaves today's popover unchanged.
 */
claim?: ClaimProvenanceView
```
Import `ClaimProvenanceCard, { type ClaimProvenanceView }` from `@/components/provenance/ClaimProvenanceCard`.

Render it INSIDE the existing popover, immediately after the `galley-popover__reason` span and BEFORE the `galley-popover__fix` span (evidence explains the reason; the suggested fix follows both), wrapped so the phrasing-content rule holds:

```tsx
{claim && (
  <span className="galley-popover__evidence" style={{ display: 'block', marginTop: 8 }}>
    <ClaimProvenanceCard claim={claim} phrasingSafe />
  </span>
)}
```
Pass NO `actions` — READ-03 is "read the reasoning and its evidence", not act on the claim; the card renders read-only without them. Never a `<div>`, never a nested `<p>`, never a second forked card (Phase 42 D-09: one component).

**`GallerySection.tsx`** — add one optional prop and compute the map once:
```typescript
/** Phase 51 (READ-03, D-20) — mount claim evidence inside finding popovers. */
showClaimEvidenceInFindings?: boolean
```
```typescript
// LOOKUP path — `claimResolvedForLookup`, NOT `claimResolved`.
// `claimResolved` is the D-09 RENDER array, already filtered by
// `markSourcedClaims` in Galley (plan 51-01 Task 3f). Using it here would mean a
// finding could only ever link to an UNSOURCED claim — inverting D-20's own
// field list, since sourceUrl and retrievedAt exist only on SOURCED rows. The
// render question ("does this claim get a wash?") and the lookup question
// ("does this finding overlap any tracked claim?") are independent.
const findingClaimMap = useMemo(
  () =>
    showClaimEvidenceInFindings
      ? buildFindingClaimMap(resolved, claimResolvedForLookup ?? claimResolved ?? [])
      : new Map(),
  [showClaimEvidenceInFindings, resolved, claimResolvedForLookup, claimResolved],
)
```

`GallerySection` therefore takes a second new optional prop beside `showClaimEvidenceInFindings`:
```typescript
/**
 * Phase 51 (READ-03, D-20) — the UNFILTERED resolved claims for this section,
 * used ONLY for finding->claim lookup. `claimResolved` above is the D-09
 * render array and may exclude sourced claims. Falls back to `claimResolved`
 * when absent, so existing callers are unaffected.
 */
claimResolvedForLookup?: ResolvedClaim[]
```
In the portable-text `components.annotation` callback, look the claim up by `value.findingId` and map it with the EXACT same field mapping `ClaimMark.tsx:107-114` uses, so the two popovers can never disagree:
```tsx
const c = findingClaimMap.get(value.findingId)
const claimView = c
  ? { text: c.text, importance: c.importance, status: c.status, sourceUrl: c.sourceUrl,
      supportingPassage: c.context, retrievedAt: c.retrievedAt, sectionName: sectionId }
  : undefined
// …then pass claim={claimView} on <AnnotationMark>
```
ADD `findingClaimMap` (and `showClaimEvidenceInFindings`) to the components `useMemo` dependency array at lines ~182-191 — omitting them means the memo never re-renders when a claim resolves.

**`Galley.tsx`** — add the same optional `showClaimEvidenceInFindings?: boolean` to `GalleyProps`, destructure it, and forward it on BOTH `<GallerySection …>` mounts (the `LONG_READ_SECTIONS` map and the `bonus`/specAd mount). On those same two mounts, ALSO pass `claimResolvedForLookup={claimResolvedAll}` — the unfiltered local plan 51-01 Task 3f deliberately kept alongside `claimResolved={claimsForRender(claimResolvedAll)}`. Do not re-run `resolveClaimsFor`; the unfiltered array already exists at both call sites. Undefined leaves Review Desk and Voice Pass byte-identical (D-24).

**`page.tsx`** — add `showClaimEvidenceInFindings` to the `/s/[section]` Galley mount, alongside the existing `showAxisTag` / `generateFixOnAccept` / `markSourcedClaims={false}` props.

State the D-09 interaction in a code comment, correctly: `markSourcedClaims={false}` stops sourced claims being MARKED as spans, but it must NOT stop them being FOUND. A finding sitting on a **sourced** claim is the load-bearing case for this card — its `sourceUrl` and `retrievedAt` exist (they exist only on sourced rows), and because D-09 suppressed that claim's own wash and popover, this finding popover is the only place left to read them. A finding on an **unsourced** claim is the redundant case: the editor already has an always-visible `ClaimMark` wash and popover on that same span saying "no source", since D-09 suppresses only the sourced mark. Routing the lookup through the filtered render array would deliver exactly the wrong half — that is why `claimResolvedForLookup` exists.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/AnnotationMark.test.tsx -t "evidence in the finding popover"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "ClaimProvenanceCard" apps/dispatch-control/components/galley/AnnotationMark.tsx` matches
    - `grep -n "phrasingSafe" apps/dispatch-control/components/galley/AnnotationMark.tsx` matches
    - `grep -n "actions=" apps/dispatch-control/components/galley/AnnotationMark.tsx` returns NO matches (read-only card)
    - `grep -n "showClaimEvidenceInFindings" apps/dispatch-control/components/galley/Galley.tsx apps/dispatch-control/components/galley/GallerySection.tsx "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` matches in all three
    - `grep -n "buildFindingClaimMap" apps/dispatch-control/components/galley/GallerySection.tsx` matches
    - `grep -n "claimResolvedForLookup" apps/dispatch-control/components/galley/GallerySection.tsx apps/dispatch-control/components/galley/Galley.tsx` matches in BOTH files
    - `grep -n "buildFindingClaimMap(resolved, claimResolved ??" apps/dispatch-control/components/galley/GallerySection.tsx` returns NO matches (the lookup must not read the D-09-filtered render array)
    - `grep -c "claimResolvedForLookup={claimResolvedAll}" apps/dispatch-control/components/galley/Galley.tsx` returns 2 (both GallerySection mounts)
    - `grep -n "claimResolvedForLookup" apps/dispatch-control/components/galley/GallerySection.tsx` appears in the components useMemo dep array region (lines 180-215)
    - `grep -n "findingClaimMap" apps/dispatch-control/components/galley/GallerySection.tsx` appears in the useMemo dep array region (lines 180-210)
    - `grep -n "supportingPassage: c.context" apps/dispatch-control/components/galley/GallerySection.tsx` matches (same mapping as ClaimMark)
    - `cd apps/dispatch-control && npx vitest run __tests__/AnnotationMark.test.tsx __tests__/ClaimMark.test.tsx __tests__/Galley.test.tsx __tests__/GallerySection.test.tsx` exits 0
    - `cd apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx -t 'D-09 and D-20 are independent'` exits 0 — the ONLY test that can catch a lookup routed through the D-09 render filter
    - `cd apps/dispatch-control && npx vitest run __tests__/SectionReaderPage.test.tsx` exits 0
  </acceptance_criteria>
  <done>Opening a marked problem that sits on a tracked claim shows the agent's reasoning and that claim's source, supporting passage and retrieved date in the same popover, as valid phrasing content; findings with no claim show reasoning only; Review Desk and Voice Pass popovers are unchanged.</done>
</task>

</tasks>

<verification>
- `cd apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx -t 'D-09 and D-20 are independent'` exits 0
- `cd apps/dispatch-control && npx vitest run __tests__/findingClaimLink.test.ts __tests__/AnnotationMark.test.tsx __tests__/ClaimMark.test.tsx __tests__/ClaimProvenanceCard.test.tsx __tests__/Galley.test.tsx __tests__/SectionReaderPage.test.tsx` exits 0
- `git status --porcelain convex schemas packages/pipeline` returns NO lines — the link is derived, no schema change
- `git diff --name-only apps/dispatch-control/lib/galley/spanResolver.ts` returns NO lines
</verification>

<success_criteria>
- READ-03's "and its evidence" half is delivered inside `AnnotationMark`'s popover, not via the `PassageToolbar` related-facts panel.
- The link is derived client-side from data already on screen; `qaCorrections` gained no field.
- The `phrasingSafe` mode added in 51-01 now has the caller that motivated it, and the popover emits no block-level element.
- The D-09 render filter and the D-20 lookup are provably independent — pinned by one real-pipeline test asserting both in a single render.
- Review Desk and Voice Pass render exactly as they do today.
</success_criteria>

<output>
After completion, create `.planning/phases/51-section-read-and-fix-in-place/51-07-SUMMARY.md`
</output>
