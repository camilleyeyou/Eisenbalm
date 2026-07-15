---
phase: 42-fact-check-stage
plan: 01
subsystem: database
tags: [convex, schema, fact-check, provenance, contract-first]

# Dependency graph
requires:
  - phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
    provides: "claim_checks table with claimId/sourceUrl/retrievedAt/sectionName/blockIndexHint provenance fields"
  - phase: 41-issue-workspace-frame
    provides: "Stage 3 Fact Check placeholder + WorkspaceStateProvider claimRows subscription this phase's downstream plans replace"
provides:
  - "§42 Fact Check Stage contract in docs/API_CONTRACTS.md (claim shape, importance field, six action endpoints, FCT-06 request/apply contract, changedSinceCheck/conflict fields)"
  - "claim_checks additive fields: importance (Load-bearing/Supporting/Incidental), changedSinceCheck, conflict"
  - "Five new pipeline-lane claimChecks.ts functions: byRunIdAndIndex, updateClaim, markChanged, keepAsWritten, remove"
  - "insertBatch importance pass-through; setStatus clears changedSinceCheck on checked/skipped"
affects: [42-02, 42-03, 42-04, 42-05, 42-06, 42-07, 42-08, phase-45-agent-revision-generalization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contract-first schema/endpoint documentation (§42) written before any implementation code, amending §26.2/§35.4/§31 in place — mirrors the Ph31/35/36 precedent"
    - "Pipeline-lane-only Convex mutations (requirePipelineSecret) for content-adjacent claim state, mirroring qaCorrections.ts::setResolution — reachable only through the future api/factcheck.py router, never directly from the dashboard"
    - "Soft-delete via terminal status string ('removed') rather than a boolean flag, satisfying allSignedOff's existing `status !== 'pending'` gate with zero code change to that function"

key-files:
  created:
    - apps/dispatch-control/__tests__/claimChecksFactcheck.test.ts
  modified:
    - docs/API_CONTRACTS.md
    - convex/schema.ts
    - convex/claimChecks.ts
    - apps/dispatch-control/vitest.config.ts

key-decisions:
  - "importance/changedSinceCheck/conflict added as additive v.optional fields on claim_checks, exactly mirroring the Phase 35 provenance field precedent — legacy rows omit them and are treated as 'Supporting' by convention (never persisted as a fabricated value)"
  - "Keep-as-written reuses status:'checked' rather than introducing a new status literal, per D-08's locked 5-value chip vocabulary having no separate 'Kept' state — the audit_log row (built in a later plan) is the distinguishing record"
  - "Remove is a soft-delete via status:'removed', chosen over a boolean removed flag so allSignedOff's existing status !== 'pending' predicate requires zero code change"
  - "§42 documents a reconciliation between the Annotations doc's cross-domain 'State model' vocabulary and CONTEXT.md's locked D-08 per-claim chip vocabulary — D-08 is authoritative for this phase's UI, a deliberate documented choice"

patterns-established:
  - "Any future claim-mutating pipeline endpoint resolves its target row via claimChecks:byRunIdAndIndex (public read) before calling the appropriate secret-guarded mutation, rather than duplicating the by_runId + claimIndex lookup"

requirements-completed: [FCT-01, FCT-05, FCT-06, FCT-07]

# Metrics
duration: 15min
completed: 2026-07-15
---

# Phase 42 Plan 01: Contract + Schema + Convex Substrate Summary

**§42 Fact Check Stage contract written first, then claim_checks gains additive `importance`/`changedSinceCheck`/`conflict` fields plus five pipeline-lane Convex functions (byRunIdAndIndex/updateClaim/markChanged/keepAsWritten/remove) that let the pipeline update, mark-changed, keep, or soft-remove a single claim by (runId, claimIndex).**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-15T04:41Z (prior commit) / plan work began immediately after
- **Completed:** 2026-07-15T04:54:34Z
- **Tasks:** 2 (both `type="auto"`, Task 2 `tdd="true"`)
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- `docs/API_CONTRACTS.md` §42 written BEFORE any code — covers the claim shape, the `importance` field and its D-03 fallback invariant, all five `claimChecks.ts` functions, the six-action `api/factcheck.py` endpoint family (write-boundary classification table), the FCT-06 preview/apply contract, the `_reset_touched_claims` hook amendment to §31, the provenance card field-sourcing table, and an explicit D-08 chip-vocabulary reconciliation note.
- `convex/schema.ts`'s `claim_checks` table gained three additive-optional fields (`importance`, `changedSinceCheck`, `conflict`) immediately after `blockIndexHint`, with zero changes to existing fields or indexes.
- `convex/claimChecks.ts` gained `byRunIdAndIndex` (public read), `updateClaim`, `markChanged`, `keepAsWritten`, and `remove` (all `requirePipelineSecret`-guarded), plus an `importance` pass-through on `insertBatch` and a `changedSinceCheck`-clearing amendment to `setStatus` when flipping to `checked`/`skipped`.
- New convex-test file (`claimChecksFactcheck.test.ts`, 9 tests) proves every behavior in the plan's `<behavior>` list, including the `allSignedOff` regression: a pending unsourced/no-importance row blocks the gate; Confirm (existing `setStatus`) + `keepAsWritten` + `remove` all independently unblock it with zero changes to `allSignedOff`/`listByRunId` themselves.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the §42 contract into docs/API_CONTRACTS.md** - `0346de4` (docs)
2. **Task 2: Extend claim_checks schema + claimChecks.ts functions** - `aa689ba` (feat)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP update, committed separately per the final-commit step)

## Files Created/Modified
- `docs/API_CONTRACTS.md` - New `## §42 — Fact Check Stage (Phase 42)` section (§42.1–§42.7)
- `convex/schema.ts` - `claim_checks` gains `importance`/`changedSinceCheck`/`conflict` (additive optional)
- `convex/claimChecks.ts` - `insertBatch` importance pass-through; `setStatus` clears `changedSinceCheck`; new `byRunIdAndIndex`/`updateClaim`/`markChanged`/`keepAsWritten`/`remove`
- `apps/dispatch-control/vitest.config.ts` - registered `claimChecksFactcheck.test.ts` under the `edge-runtime` environment glob
- `apps/dispatch-control/__tests__/claimChecksFactcheck.test.ts` - new convex-test coverage (9 tests)

## Decisions Made
- **Keep-as-written reuses `status: 'checked'`** rather than a new status literal — D-08's locked 5-value per-claim chip vocabulary has no separate "Kept" state; a later plan's mandatory-reason + `audit_log` row is the sole distinguishing record. Matches the recommendation in 42-RESEARCH.md's Open Question 1.
- **Remove is a soft-delete via `status: 'removed'`**, not a boolean `removed` flag — this satisfies `allSignedOff`'s existing `status !== 'pending'` predicate and `listByRunId`'s existing shape with zero code change to either function (42-RESEARCH.md Open Question 2 / Pitfall 4), verified by the new regression test.
- **`updateClaim`'s patch is field-presence-gated** (`if (x !== undefined) patch.x = x`) rather than always spreading all three optional args, so a caller can update only `sourceUrl` (Replace-source) without touching `text` (verified in the test: `text` stays untouched after a `sourceUrl`-only update).

## Deviations from Plan

None — plan executed exactly as written. One clarification worth recording: the plan's Task 1 acceptance criterion `grep -c "## §42" docs/API_CONTRACTS.md returns 1` returns `8` in practice, because every subsection heading (`### §42.1`, `### §42.2`, …) contains the substring `## §42` (e.g., `### §42.1` = `#`+`##`+` §42.1`, which matches `## §42` starting at its second character). This is not a defect — the identical substring-collision happens for every prior contract section using the same subsection style (`grep -c "## §35"` → 7, `grep -c "## §31"` → 9, `grep -c "## §40"` → 10, all verified). The load-bearing check — the task's own `<verify><automated>` command using `grep -q` (existence, not count) — passed cleanly, and the exact-heading check (`grep -n "^## §42"`) confirms exactly one true section header exists.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. Per 42-RESEARCH.md's Environment Availability table and the phase's own `<verification>` note, the live Convex dev-deployment sync (`pnpm --filter @eisenbalm/convex dev:once`) is intentionally deferred to the Plan 42-08 integration gate — committing `convex/schema.ts`/`convex/claimChecks.ts` here does NOT deploy them to the dev Convex deployment. A future plan in this phase (or 42-08 itself) must run the sync before any endpoint that calls these new functions can work against a live deployment.

## Next Phase Readiness
- The schema/Convex substrate for the entire Phase 42 dependency graph now exists: Wave B (Researcher/publisher `importance` plumbing), Wave C (`_reset_touched_claims` in `content.py`), Wave D (the six-action + evidence endpoints in `api/factcheck.py`), Wave E (derived selectors), and Wave F (the shared provenance card + Stage 3 screen) can all now build against a fixed §42 contract and a `claim_checks` table that already carries the three new fields.
- No blockers. The Convex dev-deployment sync remains outstanding (by design, deferred to 42-08) — any downstream plan that needs to exercise these functions against a live Convex deployment (rather than convex-test) must run `pnpm --filter @eisenbalm/convex dev:once` first.

---
*Phase: 42-fact-check-stage*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 5 files created/modified this plan were confirmed present on disk; both task commits (`0346de4`, `aa689ba`) confirmed present in `git log --oneline --all`.
