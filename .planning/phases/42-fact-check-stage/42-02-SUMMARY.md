---
phase: 42-fact-check-stage
plan: 02
subsystem: pipeline
tags: [python, pydantic, langgraph, researcher, publisher, fact-check, provenance]

# Dependency graph
requires:
  - phase: 42-fact-check-stage
    plan: "01"
    provides: "claim_checks additive importance/changedSinceCheck/conflict fields + insertBatch importance pass-through (Convex substrate this plan's publisher write now populates)"
  - phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
    provides: "the claimId-keyed research_claims lookup + sourced/unsourced claim_checks row merge this plan extends with importance"
provides:
  - "ClaimOutput.importance: Literal['Load-bearing','Supporting','Incidental'] = 'Supporting' — the Researcher's per-claim importance tier (FCT-01, D-02)"
  - "_map_claims() — extracted, independently pure/testable mapped_claims construction in researcher.py, now carrying importance through alongside claimId/sourceUrl/retrievedAt"
  - "Publisher sourced rows carry importance from the research_claims[claimId] lookup (Supporting fallback when unresolved)"
  - "Publisher unsourced (extract_claims_by_block) rows carry importance='Supporting' (D-03 fallback — never silently Load-bearing)"
affects: [42-03, 42-04, 42-05, 42-06, 42-07, 42-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function extraction for testability: the Researcher's mapped_claims construction loop was pulled out of the async researcher() node into a standalone _map_claims() helper so importance-default behavior is unit-testable without any network/LLM call"
    - "Publisher merge-site field threading: new claim fields (importance) are added at the exact site an existing field (sourceUrl/retrievedAt) is already threaded through the same rc = research_claims.get(claim_id) lookup, keeping the sourced/unsourced merge logic in one place"

key-files:
  created:
    - packages/pipeline/tests/test_researcher_importance.py
    - packages/pipeline/tests/test_publisher_importance.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py

key-decisions:
  - "Extracted the mapped_claims construction loop into a new _map_claims() pure function (not specified verbatim by the plan, which described an inline loop edit) so Task 1's test file could unit-test the mapping behavior directly rather than reconstructing/duplicating the loop logic inside the test — the plan's own <action> text explicitly sanctioned this ('call the mapping helper or reconstruct the small loop')"
  - "Publisher importance tests exercise the REAL publisher() agent node (not a reconstructed/duplicated merge snippet) by monkeypatching the Sanity write (write_issue_draft) + Convex mutation boundary (convex_mutation_safe, patched independently in both agents/publisher/__init__.py's and agents/_wrapper.py's own bound namespaces, since both import the function directly) and capturing the claimChecks:insertBatch payload — this proves the actual merge code path rather than an isolated reimplementation"

patterns-established:
  - "Any future publisher merge-logic test should monkeypatch agents.publisher.write_issue_draft / agents.publisher.get_sanity_http / agents.publisher.convex_mutation_safe AND agents._wrapper.convex_mutation_safe (both directly-imported bindings) rather than patching lib.convex_client.convex_mutation_safe, which would not affect either already-bound reference"

requirements-completed: [FCT-01]

# Metrics
duration: 20min
completed: 2026-07-15
---

# Phase 42 Plan 02: Researcher + Publisher Importance Summary

**The Researcher now emits a `Load-bearing`/`Supporting`/`Incidental` importance tier on every claim (default `Supporting`), and the publisher threads that tier onto every `claim_checks` row it seeds at generation time — sourced rows via the existing `claimId` → `research_claims` lookup, unsourced regex-catch-all rows via a hard `Supporting` fallback.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-15 (immediately following 42-01 completion)
- **Completed:** 2026-07-15
- **Tasks:** 2 (both `type="auto"`, both `tdd="true"`)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `ClaimOutput` (researcher.py) gains `importance: Literal['Load-bearing', 'Supporting', 'Incidental'] = 'Supporting'` — the Researcher's structured-output schema now asks for and defaults this field exactly like every other `ClaimOutput` field (D-02).
- The mapped-claims construction loop (previously inline inside the `researcher()` async node) was extracted into a new pure `_map_claims()` function that carries `importance` through alongside the existing `claimId`/`sourceUrl`/`retrievedAt` mapping — independently unit-testable with zero network/LLM dependency.
- `agents/publisher/__init__.py`'s sourced-row construction now sets `row["importance"] = rc.get("importance", "Supporting") if rc else "Supporting"` immediately after the existing `sourceUrl`/`retrievedAt` threading — a claimId that resolves in `research_claims` copies its importance; one that doesn't (rc is `None`) falls back to `Supporting`, never a fabricated `Load-bearing` (D-03).
- The unsourced (`extract_claims_by_block`) row loop now stamps `row["importance"] = "Supporting"` on every row before append, so deterministic regex-caught facts always carry a defined, non-blank importance.
- 12 new pytest tests (8 in `test_researcher_importance.py`, 4 in `test_publisher_importance.py`) prove every behavior in both tasks' `<behavior>` lists, including exercising the *real* `publisher()` node end-to-end (Sanity/Convex network boundary monkeypatched) rather than a reconstructed merge snippet.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add importance to Researcher ClaimOutput + mapped_claims** - `c574965` (feat)
2. **Task 2: Carry importance through the publisher claim-merge onto sourced + unsourced rows** - `28a4772` (feat)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP update, committed separately per the final-commit step)

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` - `ClaimOutput.importance` field; mapped_claims loop extracted into `_map_claims()`, now importance-carrying
- `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` - sourced-row `importance` from `research_claims` lookup (Supporting fallback); unsourced-row `importance="Supporting"` stamp
- `packages/pipeline/tests/test_researcher_importance.py` - 8 tests: `ClaimOutput` explicit/default/all-three-literal-values importance; `_map_claims` explicit/default/every-row-carries-key/out-of-range-index/claimId-and-source-mapping-preserved
- `packages/pipeline/tests/test_publisher_importance.py` - 4 tests exercising the real `publisher()` node: sourced-row-copies-importance, sourced-row-defaults-when-unresolved, unsourced-rows-all-Supporting, every-row-carries-importance-key

## Decisions Made
- **Extracted `_map_claims()` as a standalone pure function** rather than leaving the mapping inline in `researcher()`, so Task 1's tests could call it directly with hand-built `raw_claims` dicts (no network, no `ResearchOutputModel`/`acomplete` involved) — matches the plan's own "call the mapping helper or reconstruct the small loop" allowance. All plan-specified grep-checked literal strings (`importance: Literal[...] = 'Supporting'`, `"importance": claim_dict.get("importance", "Supporting")`) remain present verbatim in the file.
- **Publisher tests call the actual `publisher()` async agent node**, not a duplicated/reimplemented merge snippet, to prove the real code path. This required monkeypatching `write_issue_draft`, `get_sanity_http`, and `convex_mutation_safe` — the latter patched in *both* `agents.publisher` and `agents._wrapper`'s own module namespaces, since both do `from ... import convex_mutation_safe` (a direct-name import), so patching the source module (`lib.convex_client`) alone would not intercept either already-bound reference.

## Deviations from Plan

None — plan executed exactly as written. One implementation-detail note worth recording: the plan's Task 1 `<action>` describes editing "the mapped_claims construction loop (~lines 231-243)" in place; this was implemented as an equivalent-behavior extraction into a new `_map_claims()` function (called from the same site) rather than an in-place inline edit, because the plan's own `<action>` text explicitly permits this ("unit-test the mapped-claims dict-construction path (call the mapping helper or reconstruct the small loop)"). Every acceptance-criteria grep pattern from the plan still matches verbatim against the resulting file.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. This plan's changes (researcher.py, publisher/__init__.py) are pure Python pipeline code with no new environment variables, dependencies, or Convex/Sanity schema changes (the Convex `importance` field itself was already added in Plan 42-01). No live Convex sync is needed for this plan's own tests (they mock the network boundary entirely) or for the Researcher/publisher code paths themselves.

## Next Phase Readiness
- FCT-01's generation-time half is now fully wired: every `claim_checks` row the publisher writes (sourced or unsourced) carries a resolvable `importance` tier. Per the phase's own reconciliation note, FCT-01 is not marked complete in `REQUIREMENTS.md` yet — it is only fully delivered once `importance` reaches the UI (later plans in this phase read/render it). The `requirements mark-complete` step is intentionally deferred to phase completion, per the convention Plan 42-01 already established.
- Plan 42-03 (reset touched claims) and downstream plans (42-04 endpoints, 42-05 derived selectors, 42-06 provenance card/Stage 3 screen) can now assume every live `claim_checks` row has a real `importance` value — no plan needs to special-case a missing/undefined importance on freshly-generated rows (only legacy pre-Phase-42 rows, which the D-03 "Supporting" convention already covers per Plan 42-01's schema work).
- No blockers.

---
*Phase: 42-fact-check-stage*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 4 files (2 created, 2 modified) confirmed present on disk; both task commits (`c574965`, `28a4772`) confirmed present in `git log --oneline --all`.
