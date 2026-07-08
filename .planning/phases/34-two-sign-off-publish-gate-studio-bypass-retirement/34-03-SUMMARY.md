---
phase: 34-two-sign-off-publish-gate-studio-bypass-retirement
plan: 03
subsystem: api
tags: [fastapi, pydantic, convex, review-gate, sign-off, pipeline]

# Dependency graph
requires:
  - phase: 34-01
    provides: "docs/API_CONTRACTS.md §34.1-§34.9 frozen shapes for the sign_offs table, signOffs.ts functions, the sign-off endpoint, the gate restructure, and the guarded-paths additions"
provides:
  - "POST /issues/{run_id}/sign-off (Clerk-JWT-guarded) recording facts-cleared or sounds-human sign-offs"
  - "facts-cleared prerequisites (claims-signoff + open-error-findings) relocated verbatim from review.py into the sign-off endpoint"
  - "publish_issue and schedule_issue gated on signOffs:activeByRunId (409 missing_signoffs) instead of the two relocated checks"
  - "signOffs:record and signOffs:revokeAll added to _PIPELINE_SECRET_GUARDED_PATHS"
affects: [34-04-webhook-revalidation-revert, 34-05-auto-revoke-on-mutation, 34-06-rail-signoffs-studio-retirement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side gate relocation: machine-checkable prerequisites moved from the action endpoint (publish) to the attestation-recording endpoint (sign-off), so publish/schedule collapse to one clean 409 story (missing_signoffs)"
    - "Router module mirrors findings.py shape: APIRouter() + WORKSPACE_ID + _require_clerk_jwt_control + _emit_audit clone"

key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py
    - packages/pipeline/tests/test_signoffs_endpoints.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/review.py
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
    - packages/pipeline/tests/test_review_endpoints.py

key-decisions:
  - "The claims-signoff + open-error-findings checks were deleted from review.py entirely (not duplicated) — they now live exclusively in api/signoffs.py's facts-cleared branch, per D-04"
  - "No manual revoke endpoint and no override path were added, per D-03/D-06 — a missing/ambiguous sign-off always resolves to not-signed"
  - "signOffs:activeByRunId and signOffs:listByRunId were deliberately NOT added to _PIPELINE_SECRET_GUARDED_PATHS (public reads, per §34.8 Pitfall 2)"

patterns-established:
  - "Two-sign-off publish gate: publish_issue/schedule_issue check signOffs:activeByRunId and 409 missing_signoffs listing exactly which kind(s) are absent"

requirements-completed: [PUB-01, PUB-04]

# Metrics
duration: ~15min
completed: 2026-07-08
---

# Phase 34 Plan 03: Sign-off endpoints + publish gate restructure Summary

**New `POST /issues/{run_id}/sign-off` endpoint records facts-cleared/sounds-human attestations (facts-cleared carrying the relocated claims + open-error prerequisites); publish/schedule now 409 `missing_signoffs` unless both are active, with the old direct claims/error checks fully removed from review.py.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- `api/signoffs.py` — the single new router implementing D-01/D-05/D-06: `facts-cleared` re-enforces `claimChecks:allSignedOff` (409 `claims_not_signed_off`) and the anchor-blind open-error-findings scan (409 `open_error_findings`, D-11b), `sounds-human` is fully ungated, both record via `signOffs:record` and emit one `signoff.recorded` audit row
- `review.py`'s `publish_issue` and `schedule_issue` gates restructured (D-04/D-09): the two relocated checks are gone, replaced by a single `signOffs:activeByRunId` read that 409s `missing_signoffs` with the exact list of absent kinds when either sign-off is inactive
- `signoffs.router` registered in `main.py`; `signOffs:record` + `signOffs:revokeAll` added to `_PIPELINE_SECRET_GUARDED_PATHS` (§34.8) — the public `activeByRunId`/`listByRunId` reads were deliberately left unguarded

## Task Commits

Each task was committed atomically:

1. **Task 1: api/signoffs.py — POST /issues/{run_id}/sign-off with relocated facts prerequisites** - `e442585` (feat)
2. **Task 2: Register signoffs router + add signOffs paths to the secret-guarded set** - `bec08f9` (chore)
3. **Task 3: Restructure publish_issue + schedule_issue gates** - `048e55e` (feat)

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py` - New router: `POST /issues/{run_id}/sign-off`
- `packages/pipeline/tests/test_signoffs_endpoints.py` - 6-case behavior matrix (facts-cleared success/both 409s, sounds-human ungated, invalid kind 422, nonexistent run 404)
- `packages/pipeline/src/eisenbalm_pipeline/api/review.py` - `publish_issue`/`schedule_issue` gate restructure; module + function docstrings updated
- `packages/pipeline/src/eisenbalm_pipeline/api/main.py` - `signoffs` import + `app.include_router(signoffs.router)`
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` - `signOffs:record` + `signOffs:revokeAll` added to `_PIPELINE_SECRET_GUARDED_PATHS`
- `packages/pipeline/tests/test_review_endpoints.py` - replaced claims/open-error assertions on publish/schedule with `missing_signoffs` cases (both-active-passes, one-missing-409, none-active-409); trailing Phase 33 open-error section replaced with a pointer comment to its new home

## Decisions Made
- None beyond what §34.3/§34.4/§34.8 of `docs/API_CONTRACTS.md` already froze — implemented verbatim per the contract-first plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `convex/signOffs.ts` (Plan 34-02, a parallel wave-2 plan) had not yet landed when Task 1 was authored, but since all pytest coverage monkeypatches `_cc.convex_query`/`convex_mutation` at the Python boundary (mirroring the existing `test_review_endpoints.py` harness), the endpoint and gate logic did not need the real Convex functions to exist to be fully tested. By the time this plan's tasks finished, 34-02 had landed in parallel (`git log` shows `0dd6349 docs(34-02): complete convex-sign-offs-table plan` interleaved between this plan's commits), so the real `signOffs:record`/`signOffs:activeByRunId` functions are now present for end-to-end wiring in later plans.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `api/signoffs.py` and the restructured `review.py` gate are ready for 34-04 (webhook re-validation + revert), which reads the same `signOffs:activeByRunId` shape to block Studio-authored bypass publishes.
- 34-05 (auto-revoke on mutation) can now call `signOffs:revokeAll` (already secret-guarded) from every content-mutating endpoint without further `convex_client.py` changes.
- 34-06 (dashboard rail + Studio retirement) can wire `POST /issues/{run_id}/sign-off` directly — the endpoint, 409 reasons, and response shape are final per §34.3.
- Full pipeline suite: 440 passed / 33 skipped (baseline before this plan was 435 passed / 33 skipped — net +5, reflecting +6 new sign-off tests and a net -1 in `test_review_endpoints.py` after removing the 3 obsolete claims/open-error assertions and adding 2 missing-signoffs assertions).

---
*Phase: 34-two-sign-off-publish-gate-studio-bypass-retirement*
*Completed: 2026-07-08*

## Self-Check: PASSED

All 6 created/modified files found on disk; all 3 task commits (`e442585`, `bec08f9`, `048e55e`) found in git history.
