---
phase: 43-my-tasks-decision-log
plan: 07
subsystem: api
tags: [convex, decision-log, audit-log, fastapi, pipeline, retrofit]

# Dependency graph
requires:
  - phase: 43-02
    provides: "auditLog.writeDecision + auditLog.listDecisions substrate (the ONE shared Convex-side decision-write helper, D-11)"
provides:
  - "issues.ts hold/reopen emit structured decision rows (reason + issueNumber) via writeDecision instead of hand-rolled auditLog.write"
  - "promptVersions.ts activate-with-regression override emits a structured reason + instructionVersion alongside its legacy after-JSON"
  - "charityCorrections.ts append promotes the correction text into the structured reason field"
  - "pipeline-side _emit_audit gains additive reason/issue_number/run_id/instruction_version kwargs"
  - "factcheck.py keep-as-written threads reason + run_id through the extended _emit_audit, so the mandatory operator reason is a structured decision, not just after-JSON"
affects: [43-08, 43-09, 46, 47]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Convex status-only decision mutations call internal.auditLog.writeDecision directly (never hand-roll ctx.runMutation(internal.auditLog.write, {...}) for a reason-requiring action)"
    - "Pipeline content-touching decision actions thread reason/run_id/issue_number/instruction_version through the extended _emit_audit, additive-optional, forwarded into the args dict only when non-None"

key-files:
  created: []
  modified:
    - convex/issues.ts
    - convex/promptVersions.ts
    - convex/charityCorrections.ts
    - apps/dispatch-control/__tests__/auditLogDecision.test.ts
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py
    - packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py
    - packages/pipeline/tests/test_content_patch_endpoints.py
    - packages/pipeline/tests/test_factcheck_endpoints.py

key-decisions:
  - "issues.ts reopen has no reason argument from the caller — synthesized a structured reason ('Reopened (previously held: <heldReason>)' or 'Issue reopened') rather than adding a new required arg to the mutation's public signature, per API_CONTRACTS §40.2 (no signature change)."
  - "charityCorrections.append's free-text 'text' field IS the reason for the registry change — promoted verbatim into the structured reason field rather than wrapping/prefixing it."
  - "promptVersions.activate override kept resourceId as `${agentKey}:${version}` (the existing shape) rather than switching to bare agentKey, to avoid changing an already-asserted-on resourceId shape; instructionVersion (String(version)) and reason are added alongside it."
  - "factcheck.py keep-as-written passes run_id but omits issue_number — claim_checks rows carry no issueNumber/runId->issueNumber join in the current schema, and resolving it would require a new Convex query out of this plan's additive scope ('if resolvable' in the plan's action step)."

requirements-completed: [TSK-06]

# Metrics
duration: 20min
completed: 2026-07-15
---

# Phase 43 Plan 07: Retrofit reason-requiring actions through the shared decision helper Summary

**Hold, reopen, activate-with-regression-override, charity correction, and pipeline keep-as-written all now emit a structured `reason` (+ `issueNumber`/`runId`/`instructionVersion`) decision row via the ONE shared helper (`writeDecision` Convex-side, extended `_emit_audit` pipeline-side), so `auditLog.listDecisions` projects every shipped reason-requiring action uniformly.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-15T17:05:00Z (approx.)
- **Completed:** 2026-07-15T17:21:00Z
- **Tasks:** 2 completed
- **Files modified:** 8

## Accomplishments
- `convex/issues.ts` `hold`/`reopen` now call `internal.auditLog.writeDecision` with structured `reason` + `issueNumber` (promoted from the legacy after-JSON `heldReason`), instead of hand-rolled `internal.auditLog.write`.
- `convex/promptVersions.ts` `activate`'s regression-override branch adds structured `reason` + `instructionVersion` alongside its existing after-JSON shape, via `writeDecision`.
- `convex/charityCorrections.ts` `append` promotes the correction `text` into the structured `reason` field, via `writeDecision`.
- `packages/pipeline/.../api/control.py::_emit_audit` gains additive-optional `reason`/`issue_number`/`run_id`/`instruction_version` kwargs, forwarded into the `auditLog:record` args dict only when non-None (mirrors the existing `before`/`after` pattern).
- `packages/pipeline/.../api/factcheck.py::keep_claim` ("Keep as written") threads the operator's mandatory reason and the claim's `run_id` through the extended `_emit_audit`, so this pipeline-side decision is ALSO a structured row (not just after-JSON).
- `convex/*` synced to `dev:modest-magpie-797` via `pnpm --filter @eisenbalm/convex dev:once` (exit 0).

## Task Commits

Each task was committed atomically:

1. **Task 1: Route Convex-side shipped actions (hold, reopen, activate-override, charity correction) through writeDecision** - `14c3ff7` (feat)
2. **Task 2: Extend pipeline _emit_audit with decision kwargs + wire keep-as-written** - `f445d9c` (feat)

_No plan-metadata-only commit yet — this SUMMARY/STATE/ROADMAP update follows below._

## Files Created/Modified
- `convex/issues.ts` - `hold`/`reopen` route through `writeDecision` with structured `reason`/`issueNumber`
- `convex/promptVersions.ts` - `activate` override emission adds structured `reason`/`instructionVersion`
- `convex/charityCorrections.ts` - `append` promotes correction `text` into structured `reason`
- `apps/dispatch-control/__tests__/auditLogDecision.test.ts` - 3 new tests asserting the retrofitted hold/reopen/charity-correction rows are returned by `listDecisions` with structured fields populated
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` - `_emit_audit` gains the four additive decision kwargs
- `packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py` - `keep_claim` passes `reason`/`run_id` into `_emit_audit`
- `packages/pipeline/tests/test_content_patch_endpoints.py` - 2 new pytests pinning the `_emit_audit` kwarg-forwarding contract (present + omitted)
- `packages/pipeline/tests/test_factcheck_endpoints.py` - extends the keep-as-written happy-path test to assert `reason`/`runId` land in the emitted audit args

## Decisions Made
- `issues.reopen` synthesizes its structured `reason` from the prior `heldReason` rather than requiring a new caller-supplied argument — preserves the existing public mutation signature (no API_CONTRACTS §40.2 change).
- `charityCorrections.append`'s existing `text` field is used verbatim as the decision `reason` (the correction text always doubles as the "why").
- `promptVersions.activate` override keeps its existing `resourceId` (`${agentKey}:${version}`) rather than switching to a bare `agentKey`, to avoid disturbing an already-tested resourceId shape; `instructionVersion` is added as a new, separate field.
- `factcheck.py` keep-as-written omits `issue_number` (only `reason` + `run_id`) — `claim_checks` rows carry no issueNumber and there is no existing runId→issueNumber Convex query to resolve it without adding new out-of-scope query surface; the plan explicitly scoped this as "if resolvable."

## Deviations from Plan

None — plan executed exactly as written. The test files touched (`apps/dispatch-control/__tests__/auditLogDecision.test.ts` was listed in the plan's `files_modified`; `packages/pipeline/tests/test_content_patch_endpoints.py` and `packages/pipeline/tests/test_factcheck_endpoints.py` were not explicitly listed but are the plan's own Task 1/Task 2 instructions to "extend"/"add" a pytest, following the exact precedent pattern already established in `test_content_patch_endpoints.py` for the `before`/`after` kwarg extension).

## Issues Encountered
- `cd packages/pipeline && python -m pytest -k "audit or factcheck"` (the plan's literal Task 2 verify command) fails at COLLECTION due to a pre-existing, unrelated `ModuleNotFoundError: No module named 'respx'` in `tests/lib/test_vercel_client.py` (already logged under Phase 28-03's deferred-items.md). Ran with `--ignore=tests/lib/test_vercel_client.py` instead — 37 passed, 0 failed. Logged in `.planning/phases/43-my-tasks-decision-log/deferred-items.md` under a new `43-07` heading.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Every SHIPPED reason-requiring action (hold, reopen, activate-with-regression-override, charity correction, pipeline keep-as-written) now converges on the one shared decision-write helper and projects uniformly through `auditLog.listDecisions` — the `DecisionLog` component (43-06) renders a complete TSK-06 record for each with zero further wiring.
- 43-08 (Do-not-use reason capture) is net-new work (§43.7, Pitfall 3 — `charities.ts::setStatus` currently emits NO audit row at all) and is unaffected by this plan; it will call `writeDecision` directly following the exact pattern this plan established in `issues.ts`/`charityCorrections.ts`.
- Stage-1 actions (remove-lead / org-override, Phases 46-47) inherit this same shape per D-14 — no further retrofit needed when they ship.

---
*Phase: 43-my-tasks-decision-log*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 8 modified/created files confirmed present on disk; both task commits (`14c3ff7`, `f445d9c`) confirmed in `git log --oneline --all`.
