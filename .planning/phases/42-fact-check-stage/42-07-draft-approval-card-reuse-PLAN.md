---
phase: 42-fact-check-stage
plan: 07
type: execute
wave: 5
depends_on: ["42-06"]
files_modified:
  - apps/dispatch-control/components/galley/ClaimMark.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx
  - apps/dispatch-control/__tests__/ClaimMark.test.tsx
  - apps/dispatch-control/__tests__/claimProvenance.test.ts
autonomous: true
requirements: [FCT-04]

must_haves:
  truths:
    - "Stage 2 Draft's claim popover (ClaimMark) renders the SAME ClaimProvenanceCard content on claim selection — not a forked copy (D-09)"
    - "Stage 5 Approval's SourceIndex per-claim rows render the SAME card's field mapping — the claims checklist is source-bound via the shared component"
    - "The shipped Phase 35 galley claim rendering (marigold-underline sourced / rust unsourced, focus-parity, click-through) and the facts-cleared prerequisite are NOT regressed"
  artifacts:
    - path: "apps/dispatch-control/components/galley/ClaimMark.tsx"
      provides: "popover content sourced from the shared ClaimProvenanceCard (or its shared field-mapping)"
      contains: "ClaimProvenanceCard"
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx"
      provides: "per-claim rows rendered via the shared card's field mapping"
      contains: "ClaimProvenanceCard"
  key_links:
    - from: "ClaimMark.tsx + SourceIndex.tsx"
      to: "components/provenance/ClaimProvenanceCard.tsx"
      via: "the one shared card / field-mapping consumed by all render contexts (D-09, FCT-04)"
      pattern: "ClaimProvenanceCard"
---

<objective>
Satisfy FCT-04's "the SAME component reused in Draft, Approval" by refactoring Stage 2's ClaimMark popover and Stage 5's SourceIndex to consume the shared ClaimProvenanceCard (built in Plan 42-06) — WITHOUT regressing the shipped Phase 35 galley rendering. Sequenced LAST because it touches shipped surfaces (42-RESEARCH Wave G, higher risk).

Purpose: D-09 explicitly forbids three near-identical claim-rendering surfaces. FCT-04 names the reuse in Draft + Approval as a requirement (the inspector reuse is Phase 44, out of scope here). Consolidating them now means future claim-UI changes touch one place.
Output: ClaimMark + SourceIndex consuming the shared card; galley/claim regression tests still green.
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

components/provenance/ClaimProvenanceCard.tsx (Plan 42-06) — the shared card + deriveSourcePublisher/deriveClaimAgent + ClaimProvenanceView shape + optional ClaimCardActions.

components/galley/ClaimMark.tsx — @portabletext marks.claimSpan component (Phase 35). Renders the .galley-claim wash; hover/focus opens a popover with "Open source" + Mark checked/Skip (claimChecks:setStatus). Props include onUnsourcedClaimClick (Stage 2 click-through to Fact Check). The popover CONTENT is what should source from the shared card; the wash/mark behavior + focus-parity + click-through stay unchanged.

review-desk/[runId]/_components/SourceIndex.tsx — Approval per-claim list. Unsourced (no claimId) pinned on top, sourced grouped by section (fixed galley reading order). Each row has a check/skip control (claimChecks:setStatus). D-12 invariant: a source existing ≠ verified — checking never revokes a sign-off. The per-row field rendering should source from the shared card's mapping.

Regression tests already present: __tests__/ClaimMark.test.tsx, __tests__/claimProvenance.test.ts (mark-stacking + claim-resolution), __tests__/dispatch-control-no-sanity-write.test.ts.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor ClaimMark popover to render the shared ClaimProvenanceCard content</name>
  <files>apps/dispatch-control/components/galley/ClaimMark.tsx, apps/dispatch-control/__tests__/ClaimMark.test.tsx</files>
  <read_first>
    - apps/dispatch-control/components/galley/ClaimMark.tsx (full file — the popover body, the open/focusOpen state, onUnsourcedClaimClick click-through, the setStatus affordances)
    - apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx (the shared card + ClaimProvenanceView shape it expects)
    - apps/dispatch-control/__tests__/ClaimMark.test.tsx AND __tests__/claimProvenance.test.ts (the exact behaviors that must stay green: mark stacking, focus-parity, click-through, "Open source")
  </read_first>
  <action>
Refactor ONLY the popover CONTENT of ClaimMark.tsx to render `<ClaimProvenanceCard claim={mappedView} actions={...}/>` (or the card's shared field-mapping) instead of the hand-rolled popover body, mapping the resolved claim's fields into ClaimProvenanceView (text, importance, status, sourceUrl, supportingPassage=context, retrievedAt, sectionName, confidence). Preserve EXACTLY: the `.galley-claim` wash + data-provenance/data-checked attributes, the open || focusOpen popover trigger logic, the onUnsourcedClaimClick click-through (Stage 2 → Fact Check), and the Mark-checked/Skip actions (still claimChecks:setStatus, operator-guarded — Draft is not where the six pipeline actions live). Do NOT change the mark rendering, focus-parity, or the no-Sanity-write property.
Update __tests__/ClaimMark.test.tsx if the popover DOM structure changed, keeping every behavioral assertion (mark stacking, click-through, focus-parity, source link). Keep claimProvenance.test.ts green.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- __tests__/ClaimMark.test.tsx __tests__/claimProvenance.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "ClaimProvenanceCard" apps/dispatch-control/components/galley/ClaimMark.tsx` matches
    - ClaimMark.tsx still contains the `.galley-claim` wash and the onUnsourcedClaimClick click-through (grep both)
    - `pnpm --filter dispatch-control test:unit -- __tests__/ClaimMark.test.tsx __tests__/claimProvenance.test.ts` exits 0
  </acceptance_criteria>
  <done>Draft's claim popover renders the shared card content; the Phase 35 wash/focus/click-through behavior is unchanged and tests are green.</done>
</task>

<task type="auto">
  <name>Task 2: Refactor SourceIndex (Approval) per-claim rows to use the shared card mapping</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx (full file — the unsourced-pinned + sourced-grouped layout, the check/skip control, the D-12 "source ≠ verified" invariant)
    - apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx (the shared field mapping to reuse per row)
    - apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts (the tripwire that must stay green after this edit)
  </read_first>
  <action>
Refactor SourceIndex.tsx so each per-claim row renders via the shared ClaimProvenanceCard's field mapping (importance, status chip label+icon, source + derived publisher, supporting passage, retrieval date, agent) instead of the ad-hoc row rendering — reusing deriveSourcePublisher/deriveClaimAgent from the shared card. Preserve EXACTLY: the unsourced-pinned-on-top + sourced-grouped-by-section-in-reading-order layout (D-14), the check/skip control writing claimChecks:setStatus (operator-guarded), and the D-12 invariant that checking a claim never revokes a sign-off. Keep the component's runId prop + listByRunId subscription unchanged. If a full card per row is too heavy for the list, extract a compact `ClaimProvenanceRow` from the shared card that reuses the SAME field-mapping helpers (still one source of truth — do NOT fork the mapping).
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "ClaimProvenanceCard|deriveSourcePublisher|deriveClaimAgent|ClaimProvenanceRow" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx` matches (reuses the shared mapping, not a fork)
    - SourceIndex.tsx still contains its check/skip `claimChecks.setStatus` control and the unsourced-grouping logic
    - `pnpm --filter dispatch-control test:unit` exits 0 (incl. dispatch-control-no-sanity-write.test.ts)
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>Approval's SourceIndex renders claims through the shared card's field mapping; the Phase 35/34 approval behavior + no-Sanity-write tripwire are intact.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test:unit` fully green (ClaimMark, claimProvenance, SourceIndex, no-sanity-write).
- `pnpm --filter dispatch-control build` exits 0.
- FCT-04's "same component reused in Draft, Approval" is now literally true (inspector reuse is Phase 44).
</verification>

<success_criteria>
FCT-04 fully satisfied: ONE ClaimProvenanceCard (and its shared field-mapping helpers) is consumed by Stage 3 Fact Check (Plan 42-06), Stage 2 Draft (ClaimMark), and Stage 5 Approval (SourceIndex) — no forked copies — with zero regression to the shipped galley/approval rendering.
</success_criteria>

<output>
After completion, create `.planning/phases/42-fact-check-stage/42-07-SUMMARY.md`.
</output>
