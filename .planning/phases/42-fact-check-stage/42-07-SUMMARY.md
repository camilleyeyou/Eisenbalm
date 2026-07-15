---
phase: 42-fact-check-stage
plan: 07
subsystem: ui
tags: [react, nextjs, convex, fact-check, provenance, claims, galley, dispatch-control]

# Dependency graph
requires:
  - phase: 42-fact-check-stage
    plan: 06
    provides: "The shared ClaimProvenanceCard + deriveSourcePublisher/deriveClaimAgent/deriveClaimChipState/CHIP_META field-mapping helpers this plan's Draft (ClaimMark) and Approval (SourceIndex) surfaces now consume without forking"
provides:
  - "ResolvedClaim + ClaimSpanMarkDef extended with text/importance/context (+ sectionId on the markDef) so the Draft galley chain can feed the shared card real (non-blank) fields"
  - "Galley.tsx::resolveClaimsFor threads text/importance/context from the full claim_checks rows onto each ResolvedClaim (mirrors Phase 35's provenance threading exactly)"
  - "ClaimMark popover content is now the SAME shared ClaimProvenanceCard Stage 3/Approval render — FCT-04's 'same component reused in Draft' is literally true"
  - "A compact ClaimProvenanceRow exported from ClaimProvenanceCard.tsx (reuses the identical field-mapping helpers) so Approval's SourceIndex renders claims through the ONE mapping"
affects: [42-08, phase-44-inspector, phase-45-agent-revision-generalization, phase-49-rbac]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Field-threading pattern (FCT-04): the shared card's fields (text/importance/context) ride the SAME ResolvedClaim/ClaimSpanMarkDef/resolveClaimsFor chain Phase 35 built for sourceUrl/retrievedAt/status — no new matcher, no new subscription"
    - "One card, two layouts: ClaimProvenanceCard (full, six actions) for Stage 3/Draft; ClaimProvenanceRow (compact, caller-supplied controls via children) for Approval's per-claim list — both share deriveSourcePublisher/deriveClaimAgent/deriveClaimChipState/CHIP_META (D-16, never a forked derivation)"

key-files:
  created: []
  modified:
    - apps/dispatch-control/lib/galley/syntheticPortableText.ts
    - apps/dispatch-control/components/galley/Galley.tsx
    - apps/dispatch-control/components/galley/ClaimMark.tsx
    - apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx
    - apps/dispatch-control/__tests__/ClaimMark.test.tsx
    - apps/dispatch-control/__tests__/claimProvenance.test.ts

key-decisions:
  - "ClaimSpanMarkDef gained sectionId (in addition to text/importance/context) so the card's sectionName->agent derivation resolves in the Draft popover; ResolvedClaim already carried sectionId, so this only propagates it onto the markDef"
  - "ClaimMark keeps a Skip control ALONGSIDE the shared card: the card's six-action set has no Skip slot (a Draft-only claim_checks action), and the card's Confirm is wired to the exact claimChecks:setStatus('checked') mutation Mark-checked always called — no forked write path"
  - "Approval uses the compact ClaimProvenanceRow rather than the full card per row (a full six-action card per row would be far too heavy for the list, and Approval only exposes check/skip/jump per D-12/D-14) — the row reuses the SAME field-mapping helpers, so it is a lighter layout, not a second mapping"
  - "ClaimProvenanceRow omits the source-publisher line for unsourced rows (SourceIndex already groups those under an 'Unsourced' heading); the full ClaimProvenanceCard still renders 'Unsourced' honestly (D-08) — this is a layout choice, not a change to deriveSourcePublisher"

patterns-established:
  - "Any future claim-detail surface feeds the shared ClaimProvenanceCard/ClaimProvenanceRow from components/provenance/ClaimProvenanceCard.tsx; the fields reach a galley-rendered claim by riding ResolvedClaim/ClaimSpanMarkDef (never a new subscription or matcher)"

requirements-completed: []  # FCT-04 intentionally NOT marked complete here — deferred to phase completion (42-08), per every prior 42-plan's convention

# Metrics
duration: ~20min
completed: 2026-07-15
---

# Phase 42 Plan 07: Draft + Approval Card Reuse Summary

**Stage 2 Draft's ClaimMark popover and Stage 5 Approval's SourceIndex now consume the ONE shared ClaimProvenanceCard (and its field-mapping helpers), fed real claim text/importance/context threaded end-to-end through the Draft galley chain — FCT-04's "same component reused in Draft, Approval" is literally true with zero Phase 35 regression.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-15T06:29-07:00
- **Completed:** 2026-07-15T06:40-07:00
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 7

## Accomplishments

- **Threaded the card's fields through the Draft galley chain (Task 1).** `ResolvedClaim` and `ClaimSpanMarkDef` (`syntheticPortableText.ts`) gained `text`/`importance`/`context` (plus `sectionId` on the markDef), mirroring exactly how Phase 35 threaded `sourceUrl`/`retrievedAt`/`status`. `toSyntheticBlocks` copies them onto the claimSpan markDef; `Galley.tsx::resolveClaimsFor` reads them off the full `claim_checks` rows it already subscribes to (`listByRunId`) — no new subscription, no new matcher, still `resolveSectionFindings(quotedSpan=row.text)`. This closes checker Blocker 1: without it the card would have rendered `text:''`/`importance:undefined` and silently under-delivered FCT-04 for Draft.
- **ClaimMark's popover now renders the shared card (Task 1).** The forked popover body was replaced with `<ClaimProvenanceCard>` fed the threaded fields. Preserved exactly: the `.galley-claim` wash + `data-provenance`/`data-checked` attributes, the `open || focusOpen` trigger, the `onUnsourcedClaimClick` click-through (Stage 2 → Fact Check), and the Mark-checked/Skip `claimChecks:setStatus` actions (the card's Confirm wires to `setStatus('checked')`; a Skip control is kept alongside for the Draft-only action the card has no slot for).
- **Approval's SourceIndex reuses the shared mapping (Task 2).** A compact `ClaimProvenanceRow` was extracted from `ClaimProvenanceCard.tsx` — reusing the identical `deriveSourcePublisher`/`deriveClaimAgent`/`deriveClaimChipState`/`CHIP_META`/`formatRetrievedAt` helpers — and `SourceIndex.tsx` now renders each per-claim row through it (importance, status chip label+icon, source + derived publisher, supporting passage, agent), keeping its own check/skip/jump/open-source controls as `children`. The D-14 unsourced-pinned + sourced-grouped-by-section layout and the D-12 "source ≠ verified" invariant are untouched.
- **Never-blank regression guards added.** `ClaimMark.test.tsx` now asserts the shared card renders with the EXACT non-empty claim text and its importance tier (the checker-mandated "silently blank" guard); `claimProvenance.test.ts` asserts `text`/`importance`/`context`/`sectionId` reach both the resolved claim and the claimSpan markDef. Every prior behavioral assertion (mark stacking, click-through, focus-parity, "Open source") stays green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Thread fields + render shared card in ClaimMark** - `d230706` (feat)
2. **Task 2: Reuse shared card mapping in SourceIndex** - `2680300` (feat)

**Plan metadata:** this SUMMARY + STATE/ROADMAP update, committed separately (final-commit step).

## Files Created/Modified

- `apps/dispatch-control/lib/galley/syntheticPortableText.ts` - `ResolvedClaim`/`ClaimSpanMarkDef` extended with `text`/`importance`/`context` (+ `ClaimImportance` type, `sectionId` on the markDef); `toSyntheticBlocks` copies them onto the claimSpan markDef
- `apps/dispatch-control/components/galley/Galley.tsx` - `ClaimCheckRow` local type + `resolveClaimsFor` thread `text`/`importance`/`context` from the full rows onto each `ResolvedClaim`
- `apps/dispatch-control/components/galley/ClaimMark.tsx` - popover content replaced with the shared `ClaimProvenanceCard` (fed a `ClaimProvenanceView` from the markDef); wash/focus/click-through/Skip preserved
- `apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx` - new exported `ClaimProvenanceRow` (compact layout over the identical field-mapping helpers)
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx` - per-claim rows rendered via `ClaimProvenanceRow`; local `ClaimCheckRow` extended with `importance`/`context`; ad-hoc `statusLabel` removed
- `apps/dispatch-control/__tests__/ClaimMark.test.tsx` - fixtures gained non-empty `text`/`importance`; new describe block asserts the shared card renders with real text + importance tier and a Skip control
- `apps/dispatch-control/__tests__/claimProvenance.test.ts` - `resolveClaims` fixture helper + `ResolvedClaim` fixtures thread the new fields; asserts they reach the resolved claim and the markDef

## Decisions Made

- **`ClaimSpanMarkDef` gained `sectionId`** (beyond the plan's literal `text`/`importance`/`context` list) so the card's `sectionName → agent` derivation resolves inside the Draft popover. `ResolvedClaim` already carried `sectionId`; this only propagates it onto the markDef. Additive/optional, backward-compatible.
- **ClaimMark keeps a Skip control alongside the shared card.** The card's six-action set (Confirm/Edit/Replace-source/Ask-agent/Remove/Keep) has no Skip; Skip is a Draft-only `claim_checks` action. The card's Confirm is wired to the exact `claimChecks:setStatus('checked')` mutation "Mark checked" always called — no forked write path, no new endpoint.
- **Approval uses the compact `ClaimProvenanceRow`, not the full card per row.** A full six-action card per row is far too heavy for a whole-run list, and Approval only exposes check/skip/jump (D-12/D-14). The row reuses the SAME helpers — one source of truth (D-16).
- **`ClaimProvenanceRow` omits the source-publisher line for unsourced rows.** SourceIndex already groups unsourced claims under their own "Unsourced" heading; repeating "Unsourced" per row would be redundant and (in tests) collide with `getByText(/^unsourced$/i)` matching the header. The full card (Stage 3/Draft, no such heading) still shows "Unsourced" honestly (D-08). This is a layout choice, not a change to `deriveSourcePublisher`.

## Deviations from Plan

None - plan executed exactly as written. The two additive decisions above (`sectionId` on the markDef; the compact-row layout for Approval) are within the plan's own stated discretion ("If a full card per row is too heavy for the list, extract a compact `ClaimProvenanceRow`...").

## Issues Encountered

- The compact `ClaimProvenanceRow`'s first draft rendered `deriveSourcePublisher`'s "Unsourced" fallback per unsourced row, which false-matched `DecisionRail.test.tsx`'s `getByText(/^unsourced$/i)` (the group header) with two elements. Resolved by omitting the publisher line for unsourced rows (SourceIndex already labels them via the group heading) — a layout fix, not a helper change. Full suite green afterward.

## User Setup Required

None - pure console-side reuse of already-shipped components. No new Convex functions, no new pipeline endpoints, no env changes. (The outstanding Convex dev-deployment sync noted in 42-01/42-04/42-06 remains deferred to Plan 42-08's integration gate.)

## Next Phase Readiness

- FCT-04's "the SAME component reused in Draft, Approval" is now literally true AND the Draft card is fed real (non-blank) claim data. One `ClaimProvenanceCard` (+ helpers) is consumed by Stage 3 Fact Check (42-06), Stage 2 Draft (ClaimMark, this plan), and Stage 5 Approval (SourceIndex, this plan). The Phase 44 inspector's Sources tab is the remaining reuse site (out of scope here).
- `pnpm --filter dispatch-control test:unit` → **743 passed | 2 todo** (86 files passed, 1 skipped); `pnpm --filter dispatch-control build` → **exit 0**; `dispatch-control-no-sanity-write.test.ts` stays green (neither `ClaimMark` nor `SourceIndex` introduces a Sanity import — both still route only through `claimChecks:setStatus`).
- No blockers. 42-08 (integration gate) is next: it runs the deferred Convex dev-deployment sync and the phase-level verification, and marks FCT-04 complete at phase completion.

---
*Phase: 42-fact-check-stage*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 7 modified files + the SUMMARY confirmed present on disk. Both task commits (`d230706`, `2680300`) confirmed present in `git log --oneline --all`. Full suite green (743 passed | 2 todo); `pnpm --filter dispatch-control build` exits 0.
