---
phase: 39-registry-coverage-memory-strip
plan: 04
subsystem: pipeline
tags: [researcher, corrections, memory, prompt-lab, dedup-key, mem-03]

# Dependency graph
requires:
  - phase: 39-registry-coverage-memory-strip
    plan: 01
    provides: "convex/charityCorrections.ts (append + listByCharityKey) — the corrections read target for this plan"
provides:
  - "Researcher agent re-reads a charity's append-only corrections log on any future mention, injecting them into its research prompt (MEM-03 closed)"
  - "{corrections} placeholder in researcher_user.md, registered in the dispatch-control Prompt Lab VariableRegistry so the save-gate doesn't flag it as unknown"
affects: [39-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared dedup-key reuse across agents: Researcher imports charity_registry.make_dedup_key rather than re-deriving domain-stripping/case-folding logic a 4th time (Pitfall 2 avoidance)"
    - "Fail-open Convex read via convex_query_safe (returns None on any error, logged) — corrections default to [] rather than crashing the run"

key-files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py
    - packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md
    - packages/pipeline/tests/agents/test_researcher.py
    - packages/pipeline/tests/test_prompt_version_seeds.py
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VariableRegistry.ts"

key-decisions:
  - "Corrections read happens immediately after the winning-charity guard and before _build_queries/_build_messages, so the dedupKey + read + log are computed once per run regardless of downstream failures"
  - "_build_corrections_block renders an empty string (not a placeholder header) when there are no corrections, keeping the common no-corrections case byte-equivalent to the pre-Phase-39 prompt shape modulo the added blank line"
  - "Fixed the pre-existing Phase 24 byte-equivalence oracle (test_prompt_version_seeds.py) to also substitute {corrections} -> '' — required because the oracle's hand-reconstructed 'sub' string diverged from the real _build_messages() output the moment the new placeholder was introduced"

requirements-completed: [MEM-03]

# Metrics
duration: ~15min
completed: 2026-07-10
---

# Phase 39 Plan 04: Researcher Corrections Read Summary

**The Researcher now computes a charity's dedupKey via the existing `make_dedup_key` helper, reads `charityCorrections:listByCharityKey`, injects any prior corrections into its research prompt via a new `{corrections}` placeholder, and logs the count — closing the MEM-03 memory loop with zero risk of dedup-key drift.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 completed (RED test, then implementation)
- **Files modified:** 5

## Accomplishments
- `researcher()` reads the winning charity's append-only corrections log on every run, matching by the SAME `dedupKey` format the Convex registry and Scout already use (via `eisenbalm_pipeline.lib.charity_registry.make_dedup_key` — no reimplementation).
- Corrections are injected into the Researcher's user prompt via a new `{corrections}` placeholder in `researcher_user.md`, rendered as a "PRIOR EDITORIAL CORRECTIONS" bulleted block (or empty string when none exist).
- A `log.info(...)` line records the correction count and whether they were injected or none were found — the MEM-03 acceptance criterion ("verifiable in pipeline output/logs for a repeat-charity run") is now concretely testable via `caplog`.
- The read fails open: if Convex is unreachable, `convex_query_safe` returns `None`, corrections default to `[]`, and the run continues uninterrupted (asserted by a dedicated test).
- The Prompt Lab's `VariableRegistry.ts` registers `corrections` in `researcher_user`'s allowed-variable set (plus a description + sample), so adding the new placeholder does not regress PRM-02 (the unknown-variable save-gate would otherwise block saving the researcher_user template).

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing tests for corrections read + log line** - `eab8cb3` (test)
2. **Task 2 (GREEN): Researcher reads + injects corrections; VariableRegistry updated** - `2f8bf5b` (feat)

_TDD task (Task 1 → Task 2) follows the RED → GREEN pattern; both commits verified present via `git log --oneline`._

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` - Added `make_dedup_key`/`convex_query_safe` imports, module logger, `WORKSPACE_ID` constant, the corrections read+log step inside `researcher()`, `_build_corrections_block()` helper, and threaded `corrections` through `_build_messages(...)`
- `packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md` - Added the `{corrections}` placeholder (with a DO-NOT-DELETE comment update) and a closing instruction to account for prior corrections
- `packages/pipeline/tests/agents/test_researcher.py` - Two new tests: `test_researcher_reads_and_injects_corrections` (dedupKey computation, Convex query args, prompt injection, `caplog` count assertion) and `test_researcher_corrections_fail_open_when_convex_down` (Convex-down fail-open path)
- `packages/pipeline/tests/test_prompt_version_seeds.py` - Updated the `researcher_user` byte-equivalence oracle's hand-reconstructed `sub` string to also substitute `{corrections}` → `""`, keeping the pre-existing Phase 24 test green now that the placeholder exists
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VariableRegistry.ts` - Appended `'corrections'` to `VARIABLE_REGISTRY.researcher_user`; added a `VARIABLE_DESCRIPTIONS.corrections` and `VARIABLE_SAMPLES.corrections` entry

## Decisions Made
- Placed the corrections read immediately after the missing-charity guard (before `_build_queries`), per the plan's exact call-site instruction — this keeps the read/log unconditional and independent of the Tavily search phase.
- Kept `_build_corrections_block` returning `""` (not a header-only stub) for the no-corrections case, so a charity with a clean record produces a prompt free of empty "PRIOR EDITORIAL CORRECTIONS" headers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Phase 24 byte-equivalence oracle diverged after adding `{corrections}`**
- **Found during:** Task 2 (full pipeline suite run after implementation)
- **Issue:** `tests/test_prompt_version_seeds.py::test_user_template_seed_byte_equivalence[researcher_user]` failed — its `_expected_and_substituted()` helper hand-reconstructs the "seeded template + substitutions" string for byte-equivalence comparison against the real `_build_messages()` output. That helper's `sub` string only replaced `{charity}` and `{results_block}`, so once the new `{corrections}` placeholder was added to `researcher_user.md`, `sub` retained the literal token while `expected` (from the real `_build_messages()` call, called with no `corrections` arg → defaults to `None` → `""`) had it substituted away.
- **Fix:** Added `.replace("{corrections}", "")` to the `researcher_user` branch's `sub` construction, mirroring the exact substitution `_build_messages()` performs when `corrections` is not supplied.
- **Files modified:** `packages/pipeline/tests/test_prompt_version_seeds.py`
- **Commit:** `2f8bf5b`

---

**Total deviations:** 1 auto-fixed (1 bug fix, pre-existing test regression caused by this plan's own change)
**Impact on plan:** None beyond the one-line test fix — no scope creep, no architectural change.

## Issues Encountered
None beyond the byte-equivalence oracle fix documented above.

## User Setup Required
None — this plan is pipeline/dashboard code only; no external service configuration required. The corrections read depends on the `charityCorrections:listByCharityKey` Convex query landed in Plan 39-01, which is already live.

## Next Phase Readiness
- MEM-03 is closed: a repeat-charity run with a correction on file will show the Researcher reading, injecting, and logging it — verifiable via the pipeline logs (`caplog`-style assertion in production log aggregation) without requiring a live second run to prove the mechanism (the unit tests construct the "this charity has a prior correction" scenario directly, per 39-RESEARCH.md's verification note).
- No blockers for Plan 39-05 (coverage-strip UI) — this plan touched only the Researcher agent + Prompt Lab variable registry, no shared surface with the coverage strip.

---
*Phase: 39-registry-coverage-memory-strip*
*Completed: 2026-07-10*

## Self-Check: PASSED

All modified files verified present on disk; both task commit hashes (`eab8cb3`, `2f8bf5b`) verified present in `git log --oneline --all`.
