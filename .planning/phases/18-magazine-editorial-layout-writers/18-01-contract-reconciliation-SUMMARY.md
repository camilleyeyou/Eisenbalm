---
phase: 18-magazine-editorial-layout-writers
plan: "01"
subsystem: docs/planning
tags: [api-contracts, requirements, body-shape, portable-text, phase-18]
dependency_graph:
  requires: []
  provides:
    - "MEL-01..MEL-08 requirement definitions in REQUIREMENTS.md"
    - "API_CONTRACTS.md §7 body fields typed list[dict] with BodyBlock discriminated union"
    - "API_CONTRACTS.md §2.2 compose_section_body call path documented"
    - "API_CONTRACTS.md §2.4 four new block builders + compose_section_body documented"
  affects:
    - "Plans 18-02..18-06 — locked contract surface, cannot drift"
tech_stack:
  added: []
  patterns:
    - "BodyBlock Pydantic discriminated union (Paragraph | Heading | Blockquote)"
    - "compose_section_body serializer pattern"
key_files:
  created:
    - ".planning/phases/18-magazine-editorial-layout-writers/18-01-contract-reconciliation-SUMMARY.md"
  modified:
    - ".planning/REQUIREMENTS.md"
    - "docs/API_CONTRACTS.md"
decisions:
  - "body fields in §7 TypedDicts changed from str to list[dict] — TypedDict can't express discriminated union; Pydantic at writer enforces shape"
  - "BodyBlock explainer inserted after BonusContent (last of the three TypedDicts)"
  - "§2.2 note added after _build_bonus function, before §2.3"
  - "§2.4 new section added as sub-section below text_to_portable_text, before §2.5"
  - "No inline Plan 18-03 number reference in §2.2 note — plan says 'Plan 18-03 adds' in §2.4; kept consistent with CONTEXT.md phrasing"
metrics:
  duration: "5 min"
  completed: "2026-05-30"
  tasks_completed: 3
  files_modified: 2
---

# Phase 18 Plan 01: Contract Reconciliation Summary

Contract amendments completed before any code changes, honoring the CLAUDE.md hard rule ("no schema/payload change without docs/API_CONTRACTS.md first"). Eight MEL requirements added. Three §s in API_CONTRACTS.md amended to document the Phase 18 BodyBlock discriminated union, compose_section_body serializer, and four new Portable Text block builders.

## What Was Done

### Task 1: MEL-01..MEL-08 added to REQUIREMENTS.md

- Inserted `### Magazine Editorial Layout — Writer Structure (Phase 18)` section between SHOP-11 and `## v2 Requirements` (after line 185)
- 8 requirements with full descriptions:
  - MEL-01: 5 sections emit ≥2 h2/h3 blocks (GROQ post-condition verified)
  - MEL-02: 5 sections emit ≥1 blockquote block
  - MEL-03: Voice-isolation tripwires stay green (byte-equivalence)
  - MEL-04: QA rubric gains structural-variety axis; JudgeFinding.axis extended
  - MEL-05: Zero-regression matrix (≥200 pipeline pytest, ≥234 web vitest)
  - MEL-06: Live frontend HTML scan: ≥2 h2 + ≥1 blockquote per section container
  - MEL-07: Cost per writer call ≤15% increase
  - MEL-08: BigBudgetBonus/JingleBonus body stays str (negative test asserts no validator)
- Traceability table: 8 new MEL-* rows appended after SHOP-11
- Coverage footer updated: 95 → 103 total v1 requirements
- Last updated trailer updated to 2026-05-30

### Task 2: API_CONTRACTS.md §7 — body fields re-typed

- `SectionContent.body`: `str` → `list[dict]   # Phase 18: discriminated-union BodyBlock`
- `CaseStudyContent.body`: `str` → `list[dict]   # Phase 18: discriminated-union BodyBlock`
- `BonusContent.body`: `str` → `list[dict]   # Phase 18: discriminated-union BodyBlock`
- Inserted `## Phase 18: BodyBlock discriminated union` section after BonusContent (before Theme)
- Verbatim BodyBlock union code block (Paragraph/Heading/Blockquote) embedded
- Documents _enforce_structural_floor validator and retry path
- Documents BigBudget/Jingle body stays str (D-04)
- Documents pdfContent unchanged (D-03)
- Notes blocks.py location (Plan 18-03)

### Task 3: API_CONTRACTS.md §2.2 + §2.4 — compose_section_body documented

- §2.2: `**Phase 18 update (long-read sections):**` note added after `_build_bonus` function
  - Explains 5 long-read sections use compose_section_body instead of text_to_portable_text
  - Documents bigBudget/jingle branch still uses text_to_portable_text (D-04)
  - Documents _build_bonus dispatch logic
- §2.4: `### Phase 18: Portable Text block builders (long-read sections)` sub-section added
  - block_paragraph, block_h2, block_h3, block_blockquote signatures documented
  - compose_section_body dispatch logic documented
  - Confirms no Sanity schema change (h2/h3/blockquote accepted natively)
  - Notes PortableTextRenderer.tsx handlers dead-coded at live URL (Phase 10 activated)

## Verification Results

All acceptance criteria passed:

- `grep -c "^- \[ \] \*\*MEL-0[1-8]\*\*:" .planning/REQUIREMENTS.md` → 8
- `grep -c "| MEL-0[1-8] | Phase 18:" .planning/REQUIREMENTS.md` → 8
- `grep -c "v1 requirements: 103 total" .planning/REQUIREMENTS.md` → 1
- `grep -c "^- \[x\] \*\*SHOP-" .planning/REQUIREMENTS.md` → 11 (SHOP entries unchanged)
- `awk '/^### Magazine Editorial Layout/{m=NR} /^## v2 Requirements/{v=NR} END{print (m<v && m>0 && v>0) ? "OK" : "FAIL"}' .planning/REQUIREMENTS.md` → OK
- `grep -c "Phase 18: BodyBlock discriminated union" docs/API_CONTRACTS.md` → 1
- `grep -c "BodyBlock = Annotated\[" docs/API_CONTRACTS.md` → 1
- `grep -c "Field(discriminator='type')" docs/API_CONTRACTS.md` → 1
- `grep -c "_enforce_structural_floor" docs/API_CONTRACTS.md` → 1
- `grep -c "^    body: str" docs/API_CONTRACTS.md` → 0 (all three re-typed)
- `grep -c "body: list\[dict\]" docs/API_CONTRACTS.md` → 3
- `grep "pdfContent" docs/API_CONTRACTS.md` → present (D-03 preserved)
- `grep -c "compose_section_body" docs/API_CONTRACTS.md` → 4 (≥3 required)
- `grep -c "block_h2\|block_h3\|block_blockquote\|block_paragraph" docs/API_CONTRACTS.md` → all ≥2
- `grep -c "Phase 18 update (long-read sections)" docs/API_CONTRACTS.md` → 1
- `grep -c "Phase 18: Portable Text block builders" docs/API_CONTRACTS.md` → 1
- `grep -c "text_to_portable_text" docs/API_CONTRACTS.md` → 10 (≥2 preserved)
- `grep -c "BigBudgetBonus.body\|JingleBonus.body" docs/API_CONTRACTS.md` → 3 (≥1 required)
- `grep -c "MEL-0[1-8]" .planning/REQUIREMENTS.md` → 17 (≥16 required)
- `grep -c "Phase 18:" docs/API_CONTRACTS.md` → 5 (≥5 required)
- No tests touched: this plan modifies docs + planning files only

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan produces no code stubs. All content is documentation.

## Self-Check: PASSED

Files confirmed:
- `.planning/REQUIREMENTS.md` — exists, contains MEL-01..MEL-08
- `docs/API_CONTRACTS.md` — exists, contains BodyBlock union + compose_section_body

Commits confirmed:
- 83bf2fa — chore(18-01): add MEL-01..MEL-08 requirements to REQUIREMENTS.md
- 4968e96 — chore(18-01): amend API_CONTRACTS.md §7 — re-type body fields to list[dict]
- 2ef2cee — chore(18-01): amend API_CONTRACTS.md §2.2 + §2.4 — compose_section_body + block helpers
