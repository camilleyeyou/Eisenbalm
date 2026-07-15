---
phase: 42-fact-check-stage
plan: 07
type: execute
wave: 5
depends_on: ["42-06"]
files_modified:
  - apps/dispatch-control/lib/galley/syntheticPortableText.ts
  - apps/dispatch-control/components/galley/Galley.tsx
  - apps/dispatch-control/components/galley/ClaimMark.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx
  - apps/dispatch-control/__tests__/ClaimMark.test.tsx
  - apps/dispatch-control/__tests__/claimProvenance.test.ts
autonomous: true
requirements: [FCT-04]

must_haves:
  truths:
    - "Stage 2 Draft's claim popover (ClaimMark) renders the SAME ClaimProvenanceCard content on claim selection — with REAL claim text, importance, and supporting passage threaded through (not a forked copy, not silently blank)"
    - "Stage 5 Approval's SourceIndex per-claim rows render the SAME card's field mapping — the claims checklist is source-bound via the shared component"
    - "The shipped Phase 35 galley claim rendering (marigold-underline sourced / rust unsourced, focus-parity, click-through) and the facts-cleared prerequisite are NOT regressed"
  artifacts:
    - path: "apps/dispatch-control/lib/galley/syntheticPortableText.ts"
      provides: "ResolvedClaim + ClaimSpanMarkDef extended with text/importance/context so the card's fields reach ClaimMark"
      contains: "importance"
    - path: "apps/dispatch-control/components/galley/Galley.tsx"
      provides: "resolveClaimsFor threads text/importance/context/sectionName from claim_checks rows onto ResolvedClaim"
      contains: "importance"
    - path: "apps/dispatch-control/components/galley/ClaimMark.tsx"
      provides: "popover content sourced from the shared ClaimProvenanceCard (fed real claim fields)"
      contains: "ClaimProvenanceCard"
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx"
      provides: "per-claim rows rendered via the shared card's field mapping"
      contains: "ClaimProvenanceCard"
  key_links:
    - from: "Galley.tsx resolveClaimsFor -> toSyntheticBlocks -> ClaimMark"
      to: "components/provenance/ClaimProvenanceCard.tsx"
      via: "the threaded text/importance/context reaching the shared card (D-09, FCT-04)"
      pattern: "ClaimProvenanceCard"
---

<objective>
Satisfy FCT-04's "the SAME component reused in Draft, Approval" by refactoring Stage 2's ClaimMark popover and Stage 5's SourceIndex to consume the shared ClaimProvenanceCard (built in Plan 42-06) — AND threading the fields the card needs (text, importance, supporting passage, sectionName) all the way through the Draft galley chain, WITHOUT regressing the shipped Phase 35 rendering. Sequenced LAST because it touches shipped surfaces (42-RESEARCH Wave G, higher risk).

Purpose: D-09 forbids three near-identical claim-rendering surfaces; FCT-04 names the reuse in Draft + Approval as a requirement (inspector reuse is Phase 44, out of scope). CRITICAL (checker Blocker 1): today the Draft chain (`syntheticPortableText.ts::ResolvedClaim`/`ClaimSpanMarkDef` built by `Galley.tsx::resolveClaimsFor`) carries only `{claimIndex, sectionId?, blockIndex, start, end, provenance, sourceUrl?, retrievedAt?, status}` — there is NO `text`/`importance`/`context`/`sectionName`, so a naive card reuse would render with `text:''`/`importance:undefined` and silently under-deliver FCT-04 for Draft. This plan threads those fields through (option a — mirrors exactly how Phase 35 threaded sourceUrl/retrievedAt/status).
Output: extended ResolvedClaim/ClaimSpanMarkDef + resolveClaimsFor threading; ClaimMark + SourceIndex consuming the shared card; galley/claim regression tests still green, plus a NEW assertion that real claim text/importance reaches the card.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/42-fact-check-stage/42-CONTEXT.md
@.planning/phases/42-fact-check-stage/42-RESEARCH.md

<interfaces>
<!-- Verified from the current repo tree. -->

components/provenance/ClaimProvenanceCard.tsx (Plan 42-06) — the shared card + deriveSourcePublisher/deriveClaimAgent + ClaimProvenanceView shape { text, importance?, status, sourceUrl?, supportingPassage?, retrievedAt?, sectionName?, confidence? } + optional ClaimCardActions.

lib/galley/syntheticPortableText.ts:
  interface ResolvedClaim (lines 44-56) TODAY: { claimIndex, sectionId?, blockIndex, start, end, provenance:'sourced'|'unsourced', sourceUrl?, retrievedAt?, status } — NO text/importance/context.
  interface ClaimSpanMarkDef (lines 82-90) TODAY: { _type:'claimSpan', _key, claimIndex, provenance, sourceUrl?, retrievedAt?, status } — NO text/importance/context.
  toSyntheticBlocks(rows, {sectionId, claimAnnotations}) builds the claimSpan markDefs from ResolvedClaim.

components/galley/Galley.tsx:
  interface ClaimCheckRow (lines 84-92) TODAY: { claimIndex, text, status, claimId?, sourceUrl?, retrievedAt?, sectionName?, blockIndexHint? } — HAS text (used as quotedSpan) but NOT importance/context; local type, extend additively.
  useQuery(api.claimChecks.listByRunId,{runId}) returns FULL rows (so importance/context ARE available on the raw rows).
  resolveClaimsFor(sectionId, rows) (lines 239-266): maps rows -> QaFinding (quotedSpan=row.text) -> resolveSectionFindings -> re-hydrates ResolvedClaim with claimIndex/sectionId/blockIndex/start/end/provenance/sourceUrl/retrievedAt/status. THIS is where the new fields get threaded.

components/galley/ClaimMark.tsx — @portabletext marks.claimSpan; wash + popover; onUnsourcedClaimClick click-through; Mark checked/Skip via claimChecks:setStatus.

review-desk/[runId]/_components/SourceIndex.tsx — Approval per-claim list; its own useQuery(listByRunId) full rows; local ClaimCheckRow (lines 32-41): { claimIndex, text, status, checkedAt?, claimId?, sourceUrl?, retrievedAt?, sectionName? } — extend additively with importance?/context? for the card mapping.

Regression tests present: __tests__/ClaimMark.test.tsx, __tests__/claimProvenance.test.ts (mark-stacking + claim-resolution; the latter constructs ResolvedClaim fixtures), __tests__/dispatch-control-no-sanity-write.test.ts.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Thread text/importance/context/sectionName through the Draft galley chain and render the shared card in ClaimMark</name>
  <files>apps/dispatch-control/lib/galley/syntheticPortableText.ts, apps/dispatch-control/components/galley/Galley.tsx, apps/dispatch-control/components/galley/ClaimMark.tsx, apps/dispatch-control/__tests__/ClaimMark.test.tsx, apps/dispatch-control/__tests__/claimProvenance.test.ts</files>
  <read_first>
    - apps/dispatch-control/lib/galley/syntheticPortableText.ts (ResolvedClaim lines 44-56; ClaimSpanMarkDef lines 82-90; toSyntheticBlocks claimSpan markDef construction — the exact place new fields must be copied onto the markDef)
    - apps/dispatch-control/components/galley/Galley.tsx (ClaimCheckRow interface lines 84-92; resolveClaimsFor lines 239-266 — the re-hydration map that must add the new fields; note the raw rows from listByRunId already carry importance/context)
    - apps/dispatch-control/components/galley/ClaimMark.tsx (full file — the popover body to replace with the card, the value:ClaimSpanMarkDef it reads)
    - apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx (ClaimProvenanceView shape it expects)
    - apps/dispatch-control/__tests__/ClaimMark.test.tsx AND __tests__/claimProvenance.test.ts (fixtures to extend so the new fields are asserted; today claimProvenance.test.ts builds ResolvedClaim fixtures — add text/importance there)
  </read_first>
  <action>
Thread the card's fields end-to-end (option a — the Phase 35 threading pattern):
1. In lib/galley/syntheticPortableText.ts: extend `ResolvedClaim` with `text: string; importance?: 'Load-bearing'|'Supporting'|'Incidental'; context?: string` (sectionId already present → the card's sectionName). Extend `ClaimSpanMarkDef` with the same `text`/`importance`/`context`. In `toSyntheticBlocks`, copy `text`/`importance`/`context`/`sectionId` from each ResolvedClaim onto the claimSpan markDef it builds.
2. In components/galley/Galley.tsx: extend the local `ClaimCheckRow` interface with `importance?: 'Load-bearing'|'Supporting'|'Incidental'; context?: string` (text already present). In `resolveClaimsFor`'s re-hydration `.map((r) => ({...}))` (lines 254-266), add `text: row?.text ?? ''`, `importance: row?.importance`, `context: row?.context`, and keep `sectionId` (already set). Do NOT change the resolution logic (still QaFinding quotedSpan=row.text via resolveSectionFindings — never a new matcher).
3. In components/galley/ClaimMark.tsx: replace ONLY the popover CONTENT with `<ClaimProvenanceCard claim={{ text: value.text, importance: value.importance, status: value.status, sourceUrl: value.sourceUrl, supportingPassage: value.context, retrievedAt: value.retrievedAt, sectionName: value.sectionId, confidence: undefined }} actions={{ onOpenSource, onConfirm/onSkip via claimChecks:setStatus }}/>`. Preserve EXACTLY: the `.galley-claim` wash + data-provenance/data-checked attributes, the open||focusOpen popover trigger, the onUnsourcedClaimClick click-through (Stage 2 → Fact Check), and the Mark-checked/Skip actions (still claimChecks:setStatus, operator-guarded — Draft is not where the six pipeline actions live). Do NOT change the mark rendering, focus-parity, or the no-Sanity-write property.
Update __tests__/claimProvenance.test.ts ResolvedClaim fixtures to include a non-empty `text` and an `importance`, and update __tests__/ClaimMark.test.tsx to pass a ClaimSpanMarkDef with a non-empty `text` + `importance` and ASSERT that exact claim text and the importance tier appear in the rendered popover/card (this is the checker-mandated guard against the "silently blank" failure). Keep every existing behavioral assertion (mark stacking, click-through, focus-parity, "Open source") green.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- __tests__/ClaimMark.test.tsx __tests__/claimProvenance.test.ts && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "importance" apps/dispatch-control/lib/galley/syntheticPortableText.ts` matches inside BOTH ResolvedClaim and ClaimSpanMarkDef; `grep -n "text" apps/dispatch-control/lib/galley/syntheticPortableText.ts` shows text on ClaimSpanMarkDef
    - `grep -n "text: row" apps/dispatch-control/components/galley/Galley.tsx` and `grep -n "importance: row" apps/dispatch-control/components/galley/Galley.tsx` both match (resolveClaimsFor threads them)
    - `grep -n "ClaimProvenanceCard" apps/dispatch-control/components/galley/ClaimMark.tsx` matches; ClaimMark.tsx still contains the `.galley-claim` wash and the onUnsourcedClaimClick click-through
    - `__tests__/ClaimMark.test.tsx` contains a test that asserts a NON-EMPTY claim text string AND an importance tier render in the popover (the fixture's claim-text literal is asserted present)
    - `pnpm --filter dispatch-control test:unit -- __tests__/ClaimMark.test.tsx __tests__/claimProvenance.test.ts` exits 0 AND `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>Draft's claim popover renders the shared card fed REAL claim text/importance/supporting-passage (threaded through ResolvedClaim/ClaimSpanMarkDef/resolveClaimsFor exactly like Phase 35 threaded the provenance fields); the never-blank failure mode is caught by a test; the Phase 35 wash/focus/click-through behavior is unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Refactor SourceIndex (Approval) per-claim rows to use the shared card mapping</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx (full file — the ClaimCheckRow interface lines 32-41; the unsourced-pinned + sourced-grouped layout; the check/skip control; the D-12 "source ≠ verified" invariant)
    - apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx (the shared field mapping + deriveSourcePublisher/deriveClaimAgent to reuse per row)
    - apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts (the tripwire that must stay green after this edit)
  </read_first>
  <action>
Refactor SourceIndex.tsx so each per-claim row renders via the shared ClaimProvenanceCard's field mapping (importance, status chip label+icon, source + derived publisher, supporting passage, retrieval date, agent) instead of the ad-hoc row rendering — reusing deriveSourcePublisher/deriveClaimAgent from the shared card. Extend the local `ClaimCheckRow` interface additively with `importance?: 'Load-bearing'|'Supporting'|'Incidental'; context?: string` (the component already subscribes to full rows via listByRunId, so these values are present). Preserve EXACTLY: the unsourced-pinned-on-top + sourced-grouped-by-section-in-reading-order layout (D-14), the check/skip control writing claimChecks:setStatus (operator-guarded), and the D-12 invariant that checking a claim never revokes a sign-off. Keep the component's runId prop + listByRunId subscription unchanged. If a full card per row is too heavy for the list, extract a compact `ClaimProvenanceRow` from the shared card that reuses the SAME field-mapping helpers (still one source of truth — do NOT fork the mapping).
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "ClaimProvenanceCard|deriveSourcePublisher|deriveClaimAgent|ClaimProvenanceRow" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx` matches (reuses the shared mapping, not a fork)
    - SourceIndex.tsx local ClaimCheckRow now includes `importance` and `context`
    - SourceIndex.tsx still contains its check/skip `claimChecks.setStatus` control and the unsourced-grouping logic
    - `pnpm --filter dispatch-control test:unit` exits 0 (incl. dispatch-control-no-sanity-write.test.ts)
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>Approval's SourceIndex renders claims through the shared card's field mapping (fed importance + supporting passage from its full-row subscription); the Phase 35/34 approval behavior + no-Sanity-write tripwire are intact.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test:unit` fully green (ClaimMark w/ real-text assertion, claimProvenance, SourceIndex, no-sanity-write).
- `pnpm --filter dispatch-control build` exits 0.
- FCT-04's "same component reused in Draft, Approval" is now literally true AND the Draft card is fed real claim data (not blank).
</verification>

<success_criteria>
FCT-04 fully satisfied: ONE ClaimProvenanceCard (and its shared field-mapping helpers) is consumed by Stage 3 Fact Check (Plan 42-06), Stage 2 Draft (ClaimMark, fed real threaded fields), and Stage 5 Approval (SourceIndex) — no forked copies, no silently-blank fields — with zero regression to the shipped galley/approval rendering.
</success_criteria>

<output>
After completion, create `.planning/phases/42-fact-check-stage/42-07-SUMMARY.md`.
</output>
