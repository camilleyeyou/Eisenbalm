---
phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
plan: 04
subsystem: pipeline
tags: [pydantic, langgraph, publisher-agent, provenance, claims, convex]

# Dependency graph
requires:
  - phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
    provides: "35-01 claim_checks additive fields (claimId/sourceUrl/retrievedAt/sectionName/blockIndexHint) + insertBatch validator this plan writes through"
  - phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
    provides: "35-02 state['research']['claims'] code-mapped {claimId, text, sourceUrl, retrievedAt} shape this plan resolves sourced rows against"
  - phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
    provides: "35-03 writer claimSpans sidecar ({claimId, asWritten}) on the 5 prose sections this plan reads to build sourced rows"
provides:
  - "lib/claims.py::block_index_hint(blocks, as_written) — corrected flat-shape {type,text} block anchor resolver (fixes the qa/__init__.py children-shape bug for the publisher's own use)"
  - "lib/claims.py::extract_claims_by_block(sections) — per-section/per-block regex catch-all extractor, one row per occurrence, sectionName (galley vocabulary) + blockIndexHint on every row"
  - "publisher() seeds claim_checks with sourced rows (resolved from writer claimSpans + research claims) merged with unsourced rows (regex catch-all minus bound-span exclusion), one global claimIndex ordering"
affects: [36-voice-pass, 37-run-monitor-v2-signal-desk]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Convex v.optional() fields are OMITTED (not passed as null) when absent — reused the pre-existing agents/qa/__init__.py 'if hint is not None: payload[...] = hint' precedent for blockIndexHint/sourceUrl/retrievedAt on sourced rows"
    - "Bound-span exclusion keyed on (sectionName, blockIndexHint) buckets of normalised asWritten strings — a regex catch-all row is dropped only when its normalised text exactly matches a sourced span already covering that same block, never a cross-block or cross-section match"

key-files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/lib/claims.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py
    - packages/pipeline/tests/test_claims_extractor.py
    - packages/pipeline/tests/agents/test_claim_block_index_hint.py
    - packages/pipeline/tests/agents/publisher/test_publisher.py

key-decisions:
  - "Legacy extract_claims/extract_all_claim_types exports left byte-unchanged for Phase 26/33 back-compat per the plan's explicit instruction — extract_claims is no longer called by the publisher's runtime path (superseded by extract_claims_by_block), but remains importable; no test in the suite calls it directly either, so this is a documented, intentional, zero-risk dead-code-but-kept-for-compat state, not a regression"
  - "claimIndex merge order is deterministic: canonical section order (_SECTION_ORDER), then ascending blockIndexHint within a section, sourced-then-unsourced within each block — chosen over a simpler 'all sourced then all unsourced' global split because the plan's own phrasing ('sourced-then-unsourced within a block') implies block-level interleaving, and this ordering is stable/reproducible across re-runs on identical content"
  - "Sourced rows with an unresolvable block_index_hint (asWritten not found verbatim in any block — e.g. writer paraphrased further than the substring search catches) omit blockIndexHint entirely rather than guessing; they still land in the merge under a synthetic (sectionName, None) bucket ordered after all real block indices in that section"

patterns-established:
  - "Local (in-test-function) imports for not-yet-implemented functions in Wave-0-style test files with an existing skip_if_no_module guard — keeps the RED phase isolated to only the new assertions instead of collapsing the whole file to skip"

requirements-completed: [PRV-02, PRV-04]

# Metrics
duration: ~15min
completed: 2026-07-08
---

# Phase 35 Plan 04: Publisher Provenance Seeding Summary

**Publisher now seeds `claim_checks` with one row per claim occurrence — sourced rows resolved from writer `claimSpans` against `state['research']['claims']` (claimId + sourceUrl + retrievedAt + sectionName + blockIndexHint), merged with a corrected per-block regex catch-all for everything else (unsourced, no claimId), excluding any regex span already covered by a bound sourced span in the same block.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3 (TDD: RED → GREEN → GREEN)
- **Files modified:** 5

## Accomplishments
- Added `lib/claims.py::block_index_hint(blocks, as_written)` — reads the flat `BodyBlock.model_dump()` shape (`{"type", "text"}`) directly, fixing the Research Pitfall 1 bug that `agents/qa/__init__.py::_block_index_hint` has (it reads a nested per-block span list, which never exists on this shape)
- Added `lib/claims.py::extract_claims_by_block(sections)` — restructures extraction from Phase 26/33's globally-joined-then-dedup behavior to per-section/per-block, dedup within a block only, so every row carries its own `sectionName` (galley id vocabulary: `originStory`/`problemStatement`/`founderBio`/`caseStudy`/`bonus`) + `blockIndexHint` anchor (D-13 one-row-per-occurrence)
- Rewrote the publisher's claims-seeding block: sourced rows come from each prose section's `claimSpans`, resolved against a `claimId -> research claim` lookup built from `state['research']['claims']`; unsourced rows come from `extract_claims_by_block`, minus any span whose normalised text matches a sourced span already covering the same `(sectionName, blockIndexHint)` bucket; both merge into one global `claimIndex` ordering (canonical section order, blocks ascending, sourced-then-unsourced per block)
- `claimChecks:insertBatch` call shape (`workspace_id`/`runId`/`claims`) is unchanged — regression-safe for any other caller
- Full pipeline pytest suite: 468 passed, 36 skipped, zero regressions (Phase 26 legacy claims tests + Phase 35-01/02/03/05/06 tests all still green)

## Task Commits

Each task was committed atomically:

1. **Task 1: RED tests — flat-shape blockIndexHint, per-block extraction, sourced+unsourced seeding** - `f7a1e5e` (test)
2. **Task 2: lib/claims.py — per-section/per-block extractor + corrected flat-shape blockIndexHint helper** - `d5012bd` (feat)
3. **Task 3: publisher — assemble sourced + unsourced rows and seed claim_checks with additive fields** - `9013165` (feat)

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/lib/claims.py` - `block_index_hint()` + `extract_claims_by_block()` new public functions; legacy `extract_claims`/`extract_all_claim_types` untouched
- `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` - Replaced the single-`extract_claims` claims-seeding block with sourced+unsourced assembly, bound-span exclusion, and global `claimIndex` merge
- `packages/pipeline/tests/agents/test_claim_block_index_hint.py` - New: 7 tests for the flat-shape `block_index_hint` helper (explicitly excludes the qa test's nested-shape fixture)
- `packages/pipeline/tests/test_claims_extractor.py` - 6 new tests for `extract_claims_by_block` (sectionName/blockIndexHint presence, one-row-per-occurrence across sections, per-block-only dedup, unknown-section skip, no `claimIndex` key, all-5-galley-ids mapping)
- `packages/pipeline/tests/agents/publisher/test_publisher.py` - 2 new tests exercising the `publisher()` `@agent_node` directly: sourced+unsourced row assembly with the bound-span exclusion, and a defensive no-claimSpans/no-research-claims degrade case

## Decisions Made
- Kept `extract_claims`/`extract_all_claim_types` byte-unchanged and still exported (Phase 26/33 back-compat, per the plan's explicit instruction), even though the publisher's runtime path no longer calls `extract_claims` — verified no test in the suite calls it directly either, so this is a deliberate, zero-risk "kept for compat, not currently invoked" state rather than a regression
- Chose to OMIT optional Convex fields (`blockIndexHint`, `sourceUrl`, `retrievedAt`) from a row's dict entirely when their value is `None`, rather than including them with a `null` value — mirrors the pre-existing `agents/qa/__init__.py` pattern (`if hint is not None: payload["blockIndexHint"] = hint`) exactly, since Convex's `v.optional()` validators expect the key to be absent (`undefined`), not an explicit JSON `null`
- Merge ordering is canonical-section-order → ascending-block-index → sourced-before-unsourced-within-a-block, which is deterministic across re-runs and matches the plan's literal phrasing ("iterate sections in `_SECTION_ORDER`, sourced-then-unsourced within a block")

## Deviations from Plan

None - plan executed exactly as written. Both TDD tasks' RED and GREEN phases, and Task 3's implementation, matched the plan's action text and acceptance criteria without requiring any auto-fixes. One pre-flight adjustment was made during the RED phase: the `block_index_hint` docstring initially quoted the literal string `block.get("children")` for explanatory purposes, which caused the Task 1 acceptance-criteria grep (`grep -n "children" ...` expected to return nothing) to fail against Task 2's implementation file check — reworded the docstring to describe the shape difference without quoting the literal children-key code string, satisfying the acceptance criterion exactly (a same-task self-correction, not an inter-task deviation).

## Issues Encountered

None. The codebase state matched the plan's `<important_context>` exactly: Wave 1/2 (35-01/02/03) code was present and unmodified on `master`, and Wave 2 plans 35-05/35-06 (executed ahead of this plan, in parallel worktrees, based on the plan text's authoritative row-shape description) were already merged — their `sectionName` vocabulary (`originStory`/`problemStatement`/`founderBio`/`caseStudy`/`bonus`) matches this plan's implementation exactly, confirmed by re-reading both summaries before writing code.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- PRV-02 (writer-to-checklist survival) and PRV-04 (publisher data half) are now fully wired end-to-end: a real pipeline run will populate `claim_checks` with genuine sourced rows (real `sourceUrl`/`retrievedAt` from Tavily) alongside honest unsourced rows, both carrying resolvable `(sectionName, blockIndexHint)` jump anchors
- Plans 35-05 (galley provenance wash) and 35-06 (decision rail source index) — already merged — will now render real sourced/unsourced data on the next live run instead of the all-unsourced honest-degrade state their own summaries documented as expected-until-35-04-lands
- No blockers for Phase 36 (Voice Pass) or Phase 37 (Run Monitor v2 / Signal Desk) — this plan only touched pipeline-side claim seeding, no dispatch-control surface changes were required or made

---
*Phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering*
*Completed: 2026-07-08*

## Self-Check: PASSED

All 5 created/modified files verified present on disk (`lib/claims.py`, `agents/publisher/__init__.py`, `tests/agents/test_claim_block_index_hint.py`, `tests/test_claims_extractor.py`, `tests/agents/publisher/test_publisher.py`); all three task commit hashes (`f7a1e5e`, `d5012bd`, `9013165`) verified present in `git log`.
