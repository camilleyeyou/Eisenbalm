---
phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
plan: 01
subsystem: database
tags: [convex, contract-first, provenance, claims, api-contracts]

# Dependency graph
requires:
  - phase: 33-accept-fix-wiring-decision-rail
    provides: "claim_checks.checkedAt additive-field precedent + qaCorrections sectionName/blockIndexHint pattern this plan mirrors"
  - phase: 26-review-gate-charity-registry
    provides: "claim_checks table + claimChecks:insertBatch mutation this plan extends"
provides:
  - "docs/API_CONTRACTS.md §35 — full provenance contract (ClaimOutput, code-side research claim shape, ClaimSpanRef writer sidecar, claim_checks additive fields, one-row-per-occurrence row model, ResearchOutput drift decision)"
  - "convex/schema.ts claim_checks table with five additive optional provenance fields (claimId, sourceUrl, retrievedAt, sectionName, blockIndexHint)"
  - "convex/claimChecks.ts insertBatch validator + handler accepting and persisting the five provenance fields"
  - "Regenerated Convex codegen output consumable by later Phase 35 plans"
affects: [35-02-researcher-index-bound-claims, 35-03-writer-claimspans, 35-04-publisher-provenance-seeding, 35-05-galley-provenance-wash, 35-06-decision-rail-source-index]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contract-first documentation landed in docs/API_CONTRACTS.md before any schema/agent code (CLAUDE.md hard rule) — mirrors the §31/§32/§33/§34 precedent"
    - "Additive-optional Convex fields for zero-migration schema upgrades (claimId/sourceUrl/retrievedAt/sectionName/blockIndexHint all v.optional) — legacy rows degrade honestly to unsourced"
    - "One-row-per-occurrence claim_checks model documented as a deliberate, visible change from Phase 26's per-run-dedup behavior"

key-files:
  created: []
  modified:
    - docs/API_CONTRACTS.md
    - convex/schema.ts
    - convex/claimChecks.ts

key-decisions:
  - "ResearchOutput TypedDict drift (Pitfall 3) documented as KNOWN and left unchanged this phase — Phase 35 only adds the new claims field; reconciling the stale foundingMoment/verifiedFacts/etc. fields is explicitly out of scope"
  - "claim_checks row model moves to one-row-per-occurrence (not dedup-across-sections) so every checklist row can carry its own sectionName/blockIndexHint jump-link target — documented as a visible, intentional checklist-size change from Phase 26"
  - "ClaimSpanRef writer sidecar kept flat (claimId + asWritten only, no oneOf/discriminated union) per the graph/blocks.py Anthropic oneOf-rejection production incident"

patterns-established:
  - "Provenance additive fields mirror the qaCorrections sectionName/blockIndexHint precedent exactly, keeping the two annotation systems (QA findings vs claim provenance) structurally consistent"

requirements-completed: [PRV-01, PRV-02, PRV-03, PRV-04]

# Metrics
duration: ~15min
completed: 2026-07-08
---

# Phase 35 Plan 01: Contract and Convex Schema Foundation Summary

**Amended API_CONTRACTS.md with the full Phase 35 provenance contract (index-bound Researcher claims, flat writer claimSpans sidecar, one-row-per-occurrence claim_checks) before landing five additive optional Convex fields on claim_checks and extending insertBatch to accept them.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Wrote `## §35 — Provenance (Phase 35)` in `docs/API_CONTRACTS.md` documenting six sub-sections: the LLM `ClaimOutput{text, sourceIndex}` shape, the code-assembled research claim shape written to `state["research"]["claims"]`, the writer `ClaimSpanRef` sidecar (flat, no `oneOf`), the `claim_checks` additive-field amendment to §26.2, the `insertBatch` signature change plus the one-row-per-occurrence row-model decision, and the `ResearchOutput` TypedDict drift note (documented as known/out-of-scope, not silently ignored)
- Added five additive optional fields to Convex `claim_checks` (`claimId`, `sourceUrl`, `retrievedAt`, `sectionName`, `blockIndexHint`), mirroring the existing `qaCorrections` `sectionName`/`blockIndexHint` precedent
- Extended `claimChecks:insertBatch`'s validator and insert handler to accept and persist the same five fields, verified Convex omits `undefined` optionals so legacy callers are unaffected
- Regenerated Convex types (`convex codegen`, exit 0) and confirmed `dispatch-control` still builds clean (`next build`, exit 0, all 20 routes)

## Task Commits

Each task was committed atomically:

1. **Task 1: Amend docs/API_CONTRACTS.md — add §35 Provenance contract + update §26.2** - `2517ba6` (docs)
2. **Task 2: Add claim_checks additive optional fields + extend insertBatch + regenerate Convex types** - `3c06482` (feat)

## Files Created/Modified
- `docs/API_CONTRACTS.md` - New §35 section (six sub-sections, ~175 lines) documenting the claim model, writer claimSpans, claim_checks additive fields, one-row-per-occurrence, and the ResearchOutput drift decision
- `convex/schema.ts` - `claim_checks` table gains five additive optional provenance fields
- `convex/claimChecks.ts` - `insertBatch` validator + handler extended with the same five fields, passed through on insert

## Decisions Made
- Documented the `ResearchOutput`/`ResearchOutputModel` naming drift (Research Pitfall 3) as a known, pre-existing issue and explicitly left the broken `research_lines` fields unchanged — Phase 35 only adds the new `claims` field, per the plan's task instructions
- Confirmed the one-row-per-occurrence row model change (D-13) is the correct read of the plan and documented it prominently in §35.5 as a deliberate, visible behavior change from Phase 26's per-run dedup
- Added an explicit `§35 claim_checks additive field` inline comment on the `sectionName` field in the §35.4 code block so the field's provenance context is self-documenting on the same line (verification-friendly, no functional effect)
- **Requirement tracking:** this plan's frontmatter lists all four phase requirements (`[PRV-01, PRV-02, PRV-03, PRV-04]`), but the other five plans in this phase each declare a scoped subset (35-02 → PRV-01, 35-03 → PRV-02, 35-04 → PRV-02/PRV-04, 35-05 → PRV-03, 35-06 → PRV-04) matching the actual Researcher/writer/galley/rail implementation work. Since this plan only lands the contract + additive schema (no Researcher, writer, galley, or rail code), marking all four requirements complete now would misrepresent phase progress in REQUIREMENTS.md. Ran `requirements mark-complete` per the standard step, saw it flip all four to `[x]`, and reverted `.planning/REQUIREMENTS.md` back to `[ ]`/`Planned` — leaving requirement completion to the plans that actually implement each capability (35-02 through 35-06)

## Deviations from Plan

None - plan executed exactly as written. Both tasks' automated verify commands and acceptance criteria passed without requiring any auto-fixes.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. `convex codegen` ran against the existing deployed Convex backend and succeeded; no new environment variables or dashboard steps needed.

## Next Phase Readiness

- Plan 35-02 (Researcher index-bound claims) can now implement `ClaimOutput`/`ResearchOutputModel.claims` against the authoritative §35.1/§35.2 contract text
- Plan 35-03 (Writer claimSpans) can implement `ClaimSpanRef` on the five prose writers against §35.3 verbatim
- Plan 35-04 (Publisher provenance seeding) can seed `claim_checks` rows with the five new fields via the now-extended `insertBatch` — no further schema work needed
- Plans 35-05/35-06 (galley wash, decision rail source index) can read the five additive fields from `claim_checks` with full confidence legacy rows degrade honestly to unsourced

---
*Phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering*
*Completed: 2026-07-08*

## Self-Check: PASSED

All created/modified files verified present on disk (docs/API_CONTRACTS.md, convex/schema.ts, convex/claimChecks.ts, this SUMMARY.md); both task commit hashes (2517ba6, 3c06482) verified present in git log.
