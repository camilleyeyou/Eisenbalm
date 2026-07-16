---
phase: 45-agent-revision
plan: 01
subsystem: api
tags: [contract-first, fastapi, vitest, pytest, wave-0-scaffold, agent-revision]

# Dependency graph
requires:
  - phase: 42-fact-check-stage
    provides: "the FCT-06 evidence/preview+apply pair and its request/response shape (§42.4/§42.4a), which §45 generalizes"
  - phase: 44-inspect-how-this-was-made
    provides: "the InspectorFooter reserved 'Ask agent to revise' button (§44.7) that §45.6 flips live"
provides:
  - "docs/API_CONTRACTS.md §45 — the binding passage-revision contract (7 direction-chip identifiers, revise/preview+apply shapes, cost-guard 409, apply audit ordering)"
  - "apps/dispatch-control/lib/blockIndexFromKey.ts — real, green pure helper reversing the synthetic block _key into a numeric block index"
  - "5 vitest Wave-0 scaffold files (PassageToolbar/DirectionChips/RevisionComparisonCard/RevisionFlow/FrameChromeCostReadout) enumerating every VALIDATION case as it.todo"
  - "2 pytest Wave-0 scaffold files (test_revision_endpoints.py import-skip-guarded, test_budget.py skipif-guarded) giving Plans 45-02/45-03 an automated feedback signal"
affects: [45-02, 45-03, 45-04, 45-05, 45-06, 45-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contract-first amendment (§45) written before any endpoint/UI code, mirroring §31/§35/§42/§44"
    - "importorskip-guarded pytest module vs skipif-guarded pytest module (two distinct Wave-0 skip idioms, chosen per whether the target module exists at all vs exists-but-missing-one-function)"
    - "it.todo scaffold files with zero imports of not-yet-existing modules (44-01 precedent, reused verbatim)"

key-files:
  created:
    - apps/dispatch-control/lib/blockIndexFromKey.ts
    - apps/dispatch-control/__tests__/blockIndexFromKey.test.ts
    - apps/dispatch-control/__tests__/PassageToolbar.test.tsx
    - apps/dispatch-control/__tests__/DirectionChips.test.tsx
    - apps/dispatch-control/__tests__/RevisionComparisonCard.test.tsx
    - apps/dispatch-control/__tests__/RevisionFlow.test.tsx
    - apps/dispatch-control/__tests__/FrameChromeCostReadout.test.tsx
    - packages/pipeline/tests/test_revision_endpoints.py
    - packages/pipeline/tests/test_budget.py
    - .planning/phases/45-agent-revision/deferred-items.md
  modified:
    - docs/API_CONTRACTS.md

key-decisions:
  - "§45 locks the 7 DirectionChip identifiers (make_clearer/make_more_specific/tighten/match_brief/reduce_repetition/try_another_approach/custom) exactly as proposed in 45-RESEARCH Open Question #2 — client and server implement against this verbatim"
  - "§45.2 documents the apply-body quotedText divergence from §42.4a explicitly as deliberate (passages have no stored Convex row, Pitfall 3), pre-empting a future 'simplify to match evidence/apply' mistake"
  - "test_revision_endpoints.py uses pytest.importorskip (whole module, api/revision.py does not exist) while test_budget.py uses a skipif predicate (budget.py exists, only would_exceed_run_cap is missing) — two different Wave-0 skip idioms chosen to match each module's actual state"

patterns-established:
  - "Wave-0 pytest scaffolds pick importorskip vs skipif based on whether the whole target module or just one function is missing"

requirements-completed: [REV-01, REV-02, REV-03, REV-04, REV-05]

# Metrics
duration: 12min
completed: 2026-07-16
---

# Phase 45 Plan 01: Contract + Wave-0 Test Stubs Summary

**Locked §45's passage-revision contract (7 chip identifiers, revise/preview+apply shapes, cost-guard 409) in API_CONTRACTS.md, shipped the one real Wave-0 artifact (`blockIndexFromKey`, green), and scaffolded 7 test files across pytest and vitest so both full suites stay green while giving Plans 45-02 through 45-06 an automated activation signal.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-16T00:54:00Z (approx.)
- **Completed:** 2026-07-16T01:06:42Z
- **Tasks:** 3
- **Files modified:** 10 (1 modified, 9 created)

## Accomplishments
- `docs/API_CONTRACTS.md` gained a new §45 section (§45.1–§45.6) documenting the 7 direction-chip identifiers, the `revise/preview`/`revise/apply` endpoint pair generalizing §42.4a, the read-only preview / atomic-audited-apply split, the per-issue cost guard (409 `cost_cap_exceeded`), and the toolbar/entry-point wiring — before any endpoint or UI code exists
- `blockIndexFromKey.ts` — a real, green pure helper reversing the synthetic block `_key` (`row-{sectionId}-{blockIndex}`) into its numeric index, with 6 passing test cases
- 2 pytest Wave-0 scaffolds (`test_revision_endpoints.py`, `test_budget.py`) and 5 vitest Wave-0 scaffolds (`PassageToolbar`, `DirectionChips`, `RevisionComparisonCard`, `RevisionFlow`, `FrameChromeCostReadout`) — all skip/todo cleanly today, activating as later 45-xx plans land
- Confirmed the full console vitest suite (840 passed, 24 todo, 0 failed) and the full pipeline pytest suite (575 passed, 40 skipped, 0 failed — excluding one pre-existing, unrelated collection error) both stay green

## Task Commits

Each task was committed atomically:

1. **Task 1: Amend docs/API_CONTRACTS.md with §45** - `4e4156e` (docs)
2. **Task 2: blockIndexFromKey pure helper (real, green) + its test** - `7adfe6f` (test)
3. **Task 3: Scaffold the remaining Wave-0 test files** - `a5b2412` (test)

**Plan metadata:** (this commit, follows)

## Files Created/Modified
- `docs/API_CONTRACTS.md` - new §45 section (7 chip identifiers, revise/preview+apply contract, cost-guard 409, apply audit ordering)
- `apps/dispatch-control/lib/blockIndexFromKey.ts` - real pure helper, exported `blockIndexFromKey`
- `apps/dispatch-control/__tests__/blockIndexFromKey.test.ts` - 6 green tests covering every `<behavior>` case
- `apps/dispatch-control/__tests__/PassageToolbar.test.tsx` - 6 `it.todo` cases (REV-01)
- `apps/dispatch-control/__tests__/DirectionChips.test.tsx` - 4 `it.todo` cases (REV-02)
- `apps/dispatch-control/__tests__/RevisionComparisonCard.test.tsx` - 4 `it.todo` cases (REV-03)
- `apps/dispatch-control/__tests__/RevisionFlow.test.tsx` - 5 `it.todo` cases (REV-04)
- `apps/dispatch-control/__tests__/FrameChromeCostReadout.test.tsx` - 3 `it.todo` cases (REV-05)
- `packages/pipeline/tests/test_revision_endpoints.py` - `importorskip`-guarded; 7 real test functions (directive/preview/apply/cost_attribution) that activate once Plan 45-03 lands `api/revision.py`
- `packages/pipeline/tests/test_budget.py` - `skipif`-guarded; 3 real test functions covering `would_exceed_run_cap`, activating once Plan 45-02 lands it
- `.planning/phases/45-agent-revision/deferred-items.md` - logs a pre-existing, unrelated `respx`-missing collection error out of scope for this plan

## Decisions Made
- §45 locks the 7 `DirectionChip` identifiers exactly per 45-RESEARCH's proposal (Open Question #2) so client (45-04) and server (45-03) never drift on internal naming
- Documented the apply-body `quotedText` shape divergence from §42.4a explicitly in §45.2, as a deliberate choice (not an oversight) per 45-RESEARCH Pitfall 3
- Chose `pytest.importorskip` for `test_revision_endpoints.py` (whole target module `api/revision.py` doesn't exist yet) versus a `skipif` predicate for `test_budget.py` (target module `budget.py` exists; only the `would_exceed_run_cap` function is missing) — matching each module's actual current state rather than using one uniform idiom

## Deviations from Plan

None - plan executed exactly as written. The `blockIndexFromKey` implementation added one small defensive guard beyond the plan's literal wording (an explicit `tail === ''` check to prevent `Number('') === 0` from misparsing a bare `'row-'` key as block index 0) — this is a Rule 1 (bug-prevention) micro-fix within the same task, not a scope change; all six specified `<behavior>` cases still pass unchanged.

## Issues Encountered
- Running the full pipeline pytest suite uncovered a pre-existing, unrelated collection error: `tests/lib/test_vercel_client.py` imports `respx`, which is declared in `pyproject.toml` but not installed in this environment. This predates Phase 45 (introduced in commit `f5a8542`, an unrelated prior quick task) and is out of scope per CLAUDE.md's SCOPE BOUNDARY. Logged to `deferred-items.md` rather than fixed; verified the rest of the suite (575 passed, 40 skipped, 0 failed) is green via `--ignore=tests/lib/test_vercel_client.py`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- §45 is locked and ready for Plan 45-02 (shared prose-patch core + cost primitives) and Plan 45-03 (the revision endpoint itself) to implement verbatim — no field name, path, or identifier remains to be invented
- `test_revision_endpoints.py` and `test_budget.py` will activate automatically (no test-file edits needed) as soon as `api/revision.py` and `budget.py::would_exceed_run_cap` land
- The 5 vitest scaffolds give Plans 45-04/45-05/45-06 a checklist of every VALIDATION case to convert from `it.todo` to a live assertion
- No blockers for Plan 45-02

---
*Phase: 45-agent-revision*
*Completed: 2026-07-16*

## Self-Check: PASSED

All 12 created/modified files confirmed present on disk; all 3 task commit hashes (`4e4156e`, `7adfe6f`, `a5b2412`) confirmed present in `git log`.
