---
phase: 44-inspect-how-this-was-made
plan: 02
subsystem: database
tags: [convex, schema, pipeline, python, truncation-honesty]

# Dependency graph
requires:
  - phase: 44-01
    provides: "docs/API_CONTRACTS.md §44 — the InspectorArtifact contract, including §44.5's inputKeys field spec, written before this plan's code"
provides:
  - "agent_run_payloads.inputKeys — additive-optional untruncated top-level input key list"
  - "savePayload mutation accepting + persisting inputKeys"
  - "agent_wrapper.py::_snapshot_input_keys() — untruncated key emission computed independently of the truncated inputSnapshot string"
  - "pytest proof that inputKeys survives truncation intact (the INS-03 truncation-honesty guarantee)"
affects: [44-04-missing-inputs-diff-and-divergence, 44-09-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive-optional Convex schema evolution (v.optional on a new field, no migration/backfill, legacy rows keep working)"
    - "Compute an untruncated companion field from the SAME source data BEFORE truncation, rather than trying to recover it after the fact"

key-files:
  created: []
  modified:
    - convex/schema.ts
    - convex/agentRuns.ts
    - packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py
    - packages/pipeline/tests/test_agent_wrapper.py

key-decisions:
  - "inputKeys is derived from the same _INPUT_KEYS whitelist as _snapshot_input(), computed independently (never by parsing the truncated JSON string) — guarantees the key list can never lose a key to the ~2000-char cap"
  - "No data migration for legacy rows — 44-04's diff falls back to a truncation-approximate note when inputKeys is absent, per the contract's hard rule"

patterns-established:
  - "When a truncated snapshot needs an exact companion signal, persist the cheap untruncated derivative (keys only) alongside it rather than attempting to parse it back out of the truncated string"

requirements-completed: [INS-03]

# Metrics
duration: 6min
completed: 2026-07-15
---

# Phase 44 Plan 02: Additive inputKeys Schema + Pipeline Substrate Summary

**Additive-optional `agent_run_payloads.inputKeys` field (schema + `savePayload` mutation + pipeline emitter) gives the Phase 44 missing-inputs diff an exact, truncation-proof "supplied" key set instead of an approximate one.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-15T12:46:00-07:00
- **Completed:** 2026-07-15T12:48:00-07:00
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `agent_run_payloads.inputKeys: v.optional(v.array(v.string()))` added to `convex/schema.ts`, and `savePayload`'s `args` + upsert body thread it through exactly like `inputSnapshot`/`outputSnapshot` — additive-optional, no migration.
- `agent_wrapper.py` gained `_snapshot_input_keys()`, a pure helper that reuses the existing `_INPUT_KEYS` whitelist to compute the untruncated top-level key list, wired into the same `savePayload` mutation call already emitting `inputSnapshot`/`outputSnapshot`.
- Two new pytest cases prove the guarantee that matters: `inputKeys` matches the expected `_INPUT_KEYS` slice for a real agent (`founder_bio`), and — the load-bearing one — a >2000-char state value truncates `inputSnapshot` (`"...[truncated]"` present) while `inputKeys` still lists every expected key.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add agent_run_payloads.inputKeys to schema + savePayload mutation** - `b078881` (feat)
2. **Task 2: Emit untruncated inputKeys from the pipeline + extend pytest** - `2d61f00` (feat)

## Files Created/Modified
- `convex/schema.ts` - `agent_run_payloads` table gains `inputKeys: v.optional(v.array(v.string()))`
- `convex/agentRuns.ts` - `savePayload` mutation `args` + insert/patch body thread `inputKeys` through
- `packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py` - new `_snapshot_input_keys()` helper; `wrapped()`'s `savePayload` emit now includes `"inputKeys"`
- `packages/pipeline/tests/test_agent_wrapper.py` - two new tests: expected-key-list assertion + truncation-survives-intact assertion

## Decisions Made
- `_snapshot_input_keys()` is computed independently of `_snapshot_input()` (both read `_INPUT_KEYS` + `state` directly) rather than deriving one from the other, so a future change to `_truncate()`'s behavior can never silently start dropping keys from `inputKeys`.
- No backfill/migration script for legacy `agent_run_payloads` rows — matches every prior Phase 35/42/43 additive-field precedent and the contract's explicit instruction (§44.5).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. Per CLAUDE.md/MEMORY: committing `convex/*.ts` is not the same as deploying it — the Phase 44 integration gate (44-09) runs the Convex dev sync (`pnpm --filter @eisenbalm/convex dev:once`) before the schema is live in `modest-magpie-797`.

## Next Phase Readiness
- The `inputKeys` substrate is ready for 44-04 (missing-inputs diff), which can now compute an exact `declared − supplied` diff for any run produced after this plan lands, and fall back to a truncation-approximate note for legacy rows.
- No blockers. `pnpm --filter dispatch-control build` and `pytest tests/test_agent_wrapper.py` both green.

---
*Phase: 44-inspect-how-this-was-made*
*Completed: 2026-07-15*

## Self-Check: PASSED

All created/modified files verified present; both task commit hashes (`b078881`, `2d61f00`) verified present in git history.
