---
phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
plan: 05
type: execute
wave: 2
depends_on: [01]
files_modified:
  - apps/dispatch-control/lib/galley/syntheticPortableText.ts
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GallerySection.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ClaimMark.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx
  - apps/dispatch-control/app/globals.css
  - apps/dispatch-control/__tests__/Galley.test.tsx
  - apps/dispatch-control/__tests__/claimProvenance.test.ts
autonomous: true
requirements: [PRV-03]
must_haves:
  truths:
    - "The galley renders a marigold background wash on sourced claims and a rust background wash on unsourced claims, resolved from claim_checks via the existing span-resolver machinery (never guessing)"
    - "The provenance wash is a BACKGROUND only; QA severity annotations keep their underline stroke, so a span carrying both reads as underline-over-wash without collision (D-09)"
    - "The provenance layer is on by default with a galley-toolbar toggle to switch it off for clean reading (D-10)"
    - "Hover on a claim shows source URL + retrieval date; click opens a popover with Open source + Mark checked/Skip, writing claimChecks:setStatus directly (D-11)"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ClaimMark.tsx"
      provides: "marks.claimSpan wash component + hover tooltip + check/skip popover"
      contains: "setStatus"
    - path: "apps/dispatch-control/app/globals.css"
      provides: "provenance wash CSS (marigold sourced / rust unsourced, background only)"
      contains: "galley-claim"
  key_links:
    - from: "claim_checks (useQuery listByRunId)"
      to: "galley wash spans"
      via: "resolveSectionFindings on quotedSpan=text + blockIndexHint, claimId presence → sourced/unsourced"
      pattern: "listByRunId"
    - from: "ClaimMark check/skip popover"
      to: "claim_checks status"
      via: "useMutation(api.claimChecks.setStatus) — Convex-direct (EDT-05 exempt, Pitfall 9)"
      pattern: "setStatus"
---

<objective>
Render provenance as first-class galley states (PRV-03, D-09/D-10/D-11). Sourced claims get a marigold wash, unsourced a rust wash — resolved from `claim_checks` using the exact Phase 32 span-resolver contract, stacked as a second `@portabletext/react` mark alongside the QA `annotation` underline. A toolbar toggle turns the layer off. Hover reveals source + retrieval date; click acts (open source / mark checked / skip) writing the same `claim_checks` status the rail reads.

Purpose: at-a-glance provenance without colliding with QA severity underlines; checking claims where you read them.
Output: claimSpan mark support, ClaimMark component, wash CSS, Galley wiring + toggle.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-CONTEXT.md
@.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-RESEARCH.md
@docs/design/dispatch-control-v2/README.md

<interfaces>
<!-- claim_checks row (Plan 01): {claimIndex, text, claimType, context, status, checkedAt?,
     claimId?, sourceUrl?, retrievedAt?, sectionName?, blockIndexHint?} -->
<!-- claimId present => sourced (marigold); absent => unsourced (rust). -->

<!-- resolveSectionFindings(blocks, findings, sectionId) — reuse directly. QaFinding needs:
     {_id, severity, reason, quotedSpan?, blockIndexHint?}. Map each claim_checks row to a
     "finding" with quotedSpan = row.text, blockIndexHint = row.blockIndexHint. -->

<!-- toSyntheticBlocks(rows, annotations, sectionId) currently builds marks: string[] with
     'ann-<findingId>' keys resolved by components.marks.annotation. Spans already support a
     marks[] array — stacking a 'claim-<...>' key under it is a solved layering problem. -->

<!-- GallerySection components.marks.annotation → AnnotationMark. Add components.marks.claimSpan → ClaimMark. -->

<!-- claimChecks:setStatus(runId, claimIndex, status) — the exact mutation ClaimsChecklist already
     calls directly against Convex (EDT-05 exempt: claim_checks never touches Sanity — Pitfall 9). -->

<!-- Existing wash color tokens (globals.css): --color-marigold #f2b01e, --color-vermilion #e8471d.
     QA error already uses `background: rgba(232,71,29,0.13)` + border-bottom underline. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED tests — claim resolution, marigold/rust wash marks, toggle, mark stacking</name>
  <files>apps/dispatch-control/__tests__/Galley.test.tsx, apps/dispatch-control/__tests__/claimProvenance.test.ts</files>
  <read_first>
    - apps/dispatch-control/__tests__/Galley.test.tsx (render + fixture style)
    - apps/dispatch-control/__tests__/spanResolver.test.ts (resolver assertion style to mirror)
    - apps/dispatch-control/lib/galley/syntheticPortableText.ts
  </read_first>
  <behavior>
    - A claim_checks row with claimId set and text matching a block resolves to a claimSpan mark rendered with a "sourced" wash; a row with claimId absent renders with an "unsourced" wash.
    - A block whose text carries BOTH a QA error finding AND a sourced claim renders a span with both an annotation mark and a claimSpan mark (stacked; toSyntheticBlocks marks[] contains both keys).
    - When the provenance layer is toggled OFF, no galley-claim wash marks render (annotations still render).
    - A claim_checks row with no blockIndexHint/sectionName (legacy) does not crash the galley (it either resolves by text or drops to no-wash — never throws).
  </behavior>
  <action>
    Extend apps/dispatch-control/__tests__/Galley.test.tsx with the wash-on-sourced/rust-on-unsourced + toggle-off assertions (mock useQuery(api.claimChecks.listByRunId) with fixture rows). Create apps/dispatch-control/__tests__/claimProvenance.test.ts for the mark-stacking + legacy-row-safety unit assertions against toSyntheticBlocks + the claim-resolution mapping. RED now.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx __tests__/claimProvenance.test.ts; test $? -ne 0 && echo "RED-as-expected"</automated>
  </verify>
  <acceptance_criteria>
    - `test -f apps/dispatch-control/__tests__/claimProvenance.test.ts` is true
    - `grep -n "sourced\|unsourced\|galley-claim\|toggle" apps/dispatch-control/__tests__/Galley.test.tsx` matches
    - `grep -n "claimChecks\|listByRunId" apps/dispatch-control/__tests__/Galley.test.tsx` matches
    - The two test targets FAIL now (RED gate)
  </acceptance_criteria>
  <done>RED tests encode sourced/unsourced washes, toggle-off, mark stacking, and legacy-row safety.</done>
</task>

<task type="auto">
  <name>Task 2: claimSpan mark support in toSyntheticBlocks + ClaimMark component + wash CSS</name>
  <files>apps/dispatch-control/lib/galley/syntheticPortableText.ts, apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ClaimMark.tsx, GallerySection.tsx, apps/dispatch-control/app/globals.css</files>
  <read_first>
    - apps/dispatch-control/lib/galley/syntheticPortableText.ts (full — marks[] + markDefs machinery)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AnnotationMark.tsx (popover/keyboard/outside-click pattern to mirror)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GallerySection.tsx (components.marks wiring)
    - apps/dispatch-control/app/globals.css L85-160 (.galley-anno / .galley-popover)
  </read_first>
  <action>
    1. In syntheticPortableText.ts, add a second markDef type + resolved-claim input so a span can carry a claimSpan mark stacked with an annotation mark. Add interface `ClaimSpanMarkDef { _type: 'claimSpan'; _key: string; claimIndex: number; provenance: 'sourced' | 'unsourced'; sourceUrl?: string; retrievedAt?: number; status: string }`. Extend `toSyntheticBlocks` to accept an additional `claimAnnotations: ResolvedClaim[]` param (ResolvedClaim mirrors ResolvedAnnotation: blockIndex/start/end + the claim fields), pushing `claim-<claimIndex>` keys into the same `marks[]` breakpoint machinery and appending ClaimSpanMarkDef entries to markDefs. Keep existing annotation behavior byte-identical when claimAnnotations is empty/omitted (default param `= []`).
    2. Create ClaimMark.tsx (`marks.claimSpan` component), a 'use client' component mirroring AnnotationMark's open/close/keyboard(Escape)/outside-click/44px pattern. It renders `<span className="galley-claim" data-provenance={provenance} data-checked={status !== 'pending'}>{children}</span>`; on hover shows a lightweight tooltip (sourceUrl + formatted retrievedAt when provenance==='sourced', or "No source" when unsourced); on click opens a popover (.galley-popover reuse) with an "Open source" link (target=_blank rel=noopener when sourceUrl present) and two buttons "Mark checked" / "Skip" that call `useMutation(api.claimChecks.setStatus)({ runId, claimIndex, status: 'checked'|'skipped' })`. Import `runId` via props (threaded from GallerySection). Do NOT route through a pipeline endpoint (Pitfall 9 — claim_checks is Convex-only, EDT-05 exempt).
    3. In GallerySection.tsx, add `components.marks.claimSpan` → `<ClaimMark ... runId={runId}>` inside the memoized `components` object (add runId already present in props). Thread new props: `claimResolved: ResolvedClaim[]` and `showProvenance: boolean`; when showProvenance is false pass `[]` for claimAnnotations to toSyntheticBlocks so no wash renders.
    4. In globals.css, add provenance wash CSS — BACKGROUND ONLY (no border-bottom, so QA underlines are never overridden — D-09 / Research Open Q3):
    ```css
    .galley-claim { position: relative; }
    .galley-claim[data-provenance="sourced"] { background: linear-gradient(transparent 60%, rgba(242,176,30,0.5) 60%); }
    .galley-claim[data-provenance="unsourced"] { background: rgba(232,71,29,0.13); }
    .galley-claim[data-checked="true"] { opacity: 0.72; }
    ```
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/apps/dispatch-control && npx vitest run __tests__/claimProvenance.test.ts __tests__/syntheticPortableText.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "claimSpan\|ClaimSpanMarkDef\|claimAnnotations" apps/dispatch-control/lib/galley/syntheticPortableText.ts` matches
    - `test -f "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ClaimMark.tsx"` is true and it `grep`s `api.claimChecks.setStatus`
    - `grep -n "galley-claim" apps/dispatch-control/app/globals.css` matches; that block contains NO `border-bottom` (background-only, D-09)
    - `grep -n "claimSpan" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GallerySection.tsx"` matches
    - `npx vitest run __tests__/claimProvenance.test.ts __tests__/syntheticPortableText.test.ts` passes
  </acceptance_criteria>
  <done>toSyntheticBlocks stacks claimSpan marks; ClaimMark renders wash + tooltip + check/skip popover; wash CSS is background-only; existing annotation tests stay green.</done>
</task>

<task type="auto">
  <name>Task 3: Galley wiring (claim_checks subscription + per-section resolve) + toolbar provenance toggle</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx, apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx (full — the resolveFor pattern + LONG_READ_SECTIONS)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx L348-435 (galley toolbar buttons + Galley mount)
    - apps/dispatch-control/lib/galley/spanResolver.ts (resolveSectionFindings — reuse for claim rows)
  </read_first>
  <action>
    1. In Galley.tsx add `const claimRows = (useQuery(api.claimChecks.listByRunId, { runId }) as ClaimCheckRow[] | undefined) ?? []` (ClaimCheckRow: {claimIndex, text, status, claimId?, sourceUrl?, retrievedAt?, sectionName?, blockIndexHint?}). Group claimRows by `sectionName` (the galley section id vocabulary the publisher wrote). Add a `showProvenance: boolean` prop (default handled by parent). For each section, build claim "findings" `{ _id: String(row.claimIndex), severity: 'info', reason: '', quotedSpan: row.text, blockIndexHint: row.blockIndexHint }` and run the EXISTING `resolveSectionFindings(rows, claimFindings, sectionId)`; map resolved entries to ResolvedClaim carrying `claimIndex`, `provenance = row.claimId ? 'sourced' : 'unsourced'`, `sourceUrl`, `retrievedAt`, `status`. Pass `claimResolved` + `showProvenance` into each `<GallerySection>` (the 4 long-read sections + the specAd bonus). Non-prose sections (game/podcast/deliberation/bigBudget/jingle bonus) do NOT get washes (D-06) — leave them unchanged.
    2. In page.tsx, add `const [showProvenance, setShowProvenance] = useState(true)` (default ON — D-10) and a toolbar toggle button next to the existing "Show preview" button: label "Provenance on"/"Provenance off", min-h-[44px], same button styling as its siblings. Pass `showProvenance={showProvenance}` into `<Galley ... />`.
    3. Run the strict build (memory rule: vitest does not type-check).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "claimChecks.listByRunId\|showProvenance" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx"` matches
    - `grep -n "resolveSectionFindings" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx"` shows the claim rows reuse the existing resolver (no new fuzzy matcher)
    - `grep -n "showProvenance\|Provenance o" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx"` shows the default-ON toggle
    - `npx vitest run __tests__/Galley.test.tsx` passes; `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>Galley subscribes to claim_checks, resolves washes per-section via the existing resolver, and a default-ON toolbar toggle controls the provenance layer; vitest + strict build green.</done>
</task>

</tasks>

<verification>
- `cd apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx __tests__/claimProvenance.test.ts __tests__/syntheticPortableText.test.ts` passes.
- `pnpm --filter dispatch-control build` exits 0 (strict type-check).
- MANUAL (35-VALIDATION): open a galley with a span carrying both a QA error underline and a rust/marigold wash; confirm underline-over-wash reads (D-09, Research Open Q3).
</verification>

<success_criteria>
PRV-03 satisfied: sourced (marigold) and unsourced (rust) claims render as first-class galley states via background washes, stacked cleanly under QA underlines, toggleable, with hover-source + in-context check/skip.
</success_criteria>

<output>
After completion, create `.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-05-SUMMARY.md`
</output>
