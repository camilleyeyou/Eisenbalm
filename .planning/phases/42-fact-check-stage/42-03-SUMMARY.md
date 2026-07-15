---
phase: 42-fact-check-stage
plan: 03
subsystem: api
tags: [fastapi, convex, content-patch, claim-checks, provenance, fact-check]

# Dependency graph
requires:
  - phase: 42-fact-check-stage
    plan: 01
    provides: "claim_checks additive fields (importance/changedSinceCheck/conflict) + the requirePipelineSecret-guarded claimChecks:markChanged/updateClaim/keepAsWritten/remove/byRunIdAndIndex Convex functions this plan calls"
provides:
  - "_touched_block_indices + _reset_touched_claims helpers in api/content.py — the conservative index-drift algorithm for FCT-07"
  - "patch_section and patch_bonus(specAd) now reset any claim_checks row anchored to a touched block back to unchecked + changedSinceCheck, alongside the existing sign-off revocation"
  - "claimChecks:markChanged registered in convex_client.py's _PIPELINE_SECRET_GUARDED_PATHS (closes a Plan 42-01 gap — the Convex-side guard existed but the Python-side pipelineSecret injection did not)"
affects: [42-04, 42-08, phase-45-agent-revision-generalization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conservative index-drift reset: same-length block edits diff positionally; any length change (insert/delete) treats the whole section as touched rather than attempting unreliable positional matching (over-reset, never under-reset)"
    - "Fail-open side-effect hook mirroring _revoke_active_signoffs: _reset_touched_claims wraps its Convex calls in try/except so a claim-reset failure never blocks the operator's content save"

key-files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/content.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
    - packages/pipeline/tests/test_content_patch_endpoints.py

key-decisions:
  - "_reset_touched_claims is fail-open (try/except, log-and-continue) rather than raising — mirrors the adjacent _revoke_active_signoffs call exactly, so a Convex hiccup while resetting claims never blocks the editor's actual content save"
  - "patch_bonus's specAd reset is gated on `body.blocks is not None` (not just `body.variant == 'specAd'`) — a headline-only specAd save has no blocks payload at all, so calling the diff/reset unconditionally would reference an undefined `blocks` variable"
  - "Added claimChecks:markChanged to convex_client.py's _PIPELINE_SECRET_GUARDED_PATHS (Rule 3 blocking-issue fix) — Plan 42-01 guarded the mutation Convex-side (requirePipelineSecret) but never registered it on the Python side, so calling it without this fix would have failed Unauthorized in any real deployment despite passing mocked unit tests"

patterns-established:
  - "Any future content-patch endpoint that touches claim-anchored prose calls _reset_touched_claims(convex_http, run_id=..., section_name=..., touched=_touched_block_indices(before, after)) immediately after _revoke_active_signoffs, rather than reimplementing the diff/reset logic"

requirements-completed: [FCT-07]

# Metrics
duration: 12min
completed: 2026-07-15
---

# Phase 42 Plan 03: Reset Touched Claims Summary

**`_touched_block_indices` + `_reset_touched_claims` helpers wired into `patch_section` and `patch_bonus`'s specAd branch so an editorial content revision returns any claim anchored to the touched block back to unchecked (`changedSinceCheck`), using a conservative over-reset-never-under-reset algorithm on block-index drift.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-15T05:15Z (approx, prior commit b1191e6 at 16:47 the previous day)
- **Completed:** 2026-07-15T05:23:54-07:00
- **Tasks:** 2 (both `type="auto"`, both `tdd="true"`)
- **Files modified:** 3

## Accomplishments
- `_touched_block_indices(before_blocks, after_blocks)` — a pure, sync helper doing a positional block-text diff; returns `None` ("whole section touched") when block counts differ (insert/delete makes positional diffing unreliable, per 42-RESEARCH.md Pitfall 2), otherwise the exact set of touched indices.
- `_reset_touched_claims(convex_http, *, run_id, section_name, touched)` — reads live `claim_checks` rows for the run via `claimChecks:listByRunId`, and calls `claimChecks:markChanged` for every row in the matching section whose `blockIndexHint` is in `touched`, is `None` (unresolved anchor, reset conservatively), or when `touched is None` (whole-section reset). Fail-open like its sibling `_revoke_active_signoffs`.
- Wired into `patch_section` (reads `before.get("blocks", [])`, the long-read section shape) and into `patch_bonus`'s specAd branch only (reads `before.get("body", [])`, the bonus shape — a different key, exactly as the interface notes required) — gated on `body.blocks is not None` so a headline-only specAd save never references an undefined `blocks` variable. The bigBudget/jingle branches are untouched (plain-string `bonus.body`, exempt).
- Closed a substrate gap from Plan 42-01: `claimChecks:markChanged` is `requirePipelineSecret`-guarded on the Convex side but was never added to `convex_client.py`'s `_PIPELINE_SECRET_GUARDED_PATHS`, so the pipeline's `pipelineSecret` injection wouldn't have fired for it in a real deployment. Added it here since this plan is the first Python-side caller.
- 9 new pytest cases: 6 pure-unit tests for the two helpers (precise same-length reset, whole-section reset on length drift, fail-open on Convex error) + 3 endpoint-integration tests (precise block-1-only reset via `patch_section`, precise block-1-only reset via `patch_bonus` specAd, and a bigBudget-never-resets regression).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add `_touched_block_indices` + `_reset_touched_claims` helpers** - `ffd9bd1` (feat)
2. **Task 2: Wire `_reset_touched_claims` into `patch_section` + `patch_bonus`(specAd)** - `6242cff` (feat)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP update, committed separately per the final-commit step)

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/api/content.py` - New `_touched_block_indices`/`_reset_touched_claims` module-level helpers; `patch_section` and `patch_bonus`'s specAd branch each call `_reset_touched_claims` immediately after their existing `_revoke_active_signoffs` call
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` - `claimChecks:markChanged` added to `_PIPELINE_SECRET_GUARDED_PATHS`
- `packages/pipeline/tests/test_content_patch_endpoints.py` - 9 new tests (6 unit, 3 integration); 2 pre-existing tests (`test_structural_floor_warns_not_blocks`, `test_bonus_patch_variant_shaped`) updated to a path-routed `convex_query` mock so `claimChecks:listByRunId` returns a real list instead of the generic `{sanityIssueId}` stub every other content-patch test uses

## Decisions Made
- **Fail-open on Convex errors**, mirroring `_revoke_active_signoffs` exactly — a claim-reset failure must never block the operator's actual content save. This is a deliberate deviation from the 42-RESEARCH.md illustrative sketch (which didn't wrap the call), applied because it matches the established sibling pattern immediately adjacent in the same function and keeps pre-existing tests (which don't all mock `claimChecks:listByRunId`) robust to the new code path.
- **`body.blocks is not None` guard on the specAd reset call** — the plan's interface notes only said "specAd branch," but the specAd branch's own code already conditions the block-composition logic on `body.blocks is not None` (a headline-only specAd PATCH has no `blocks` key). Reusing that same guard for the reset call avoids a `NameError` on the undefined `blocks` variable and is directly validated by the pre-existing `test_bonus_headline_only_save_omits_body` test, which continues to pass unmodified.
- **Registered `claimChecks:markChanged` in `_PIPELINE_SECRET_GUARDED_PATHS`** (Rule 3 — blocking issue for the feature to function outside of mocked tests). Plan 42-01 added the Convex-side guard but not this Python-side registration; since 42-03 is the first real caller, fixing it here (rather than deferring to a later plan) keeps the feature actually functional end-to-end.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registered `claimChecks:markChanged` in `convex_client.py`'s pipeline-secret-guarded path set**
- **Found during:** Task 1 (adding `_reset_touched_claims`)
- **Issue:** `claimChecks:markChanged` (added in Plan 42-01) is `requirePipelineSecret`-guarded on the Convex side, but `convex_client.py`'s `_PIPELINE_SECRET_GUARDED_PATHS` (the single central point that injects `pipelineSecret` into outgoing mutations) had no entry for it. Calling it in a real deployment would fail `Unauthorized` even though mocked unit tests would pass silently.
- **Fix:** Added `"claimChecks:markChanged"` to `_PIPELINE_SECRET_GUARDED_PATHS` with a comment explaining the Phase 42 call site.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py`
- **Verification:** `grep '"claimChecks:markChanged"'` present in the guarded set; full pipeline test suite (552 tests) still green.
- **Committed in:** `ffd9bd1` (Task 1 commit)

**2. [Rule 1 - Bug] Made `_reset_touched_claims` fail-open on Convex errors**
- **Found during:** Task 2 (wiring into `patch_section`/`patch_bonus`)
- **Issue:** Several pre-existing tests (`test_structural_floor_warns_not_blocks`, the specAd sub-case of `test_bonus_patch_variant_shaped`) mock `_cc.convex_query` with a generic handler that ignores the `path` argument and always returns `{"sanityIssueId": "issue-42"}` — a dict, not a claim-rows list. An unwrapped `_reset_touched_claims` would crash on `for row in rows: row.get(...)` (`AttributeError: 'str' object has no attribute 'get'`) once it started being called from these endpoints, silently 500-ing the content save.
- **Fix:** Wrapped `_reset_touched_claims`'s body in try/except (log-and-continue), mirroring the immediately-adjacent `_revoke_active_signoffs` helper's established fail-open pattern. Also updated the two affected pre-existing tests to a path-routed `convex_query` mock returning a real (empty) list for `claimChecks:listByRunId`, so the precise reset behavior in those tests is exercised honestly rather than relying solely on the fail-open swallow.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/api/content.py`, `packages/pipeline/tests/test_content_patch_endpoints.py`
- **Verification:** `uv run pytest tests/test_content_patch_endpoints.py -x -q` — 29 passed; full suite — 552 passed, 36 skipped.
- **Committed in:** `ffd9bd1` (helper) / `6242cff` (test updates)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes were necessary for the feature to actually work end-to-end (Rule 3) and for the wiring not to regress pre-existing green tests (Rule 1). No scope creep — no new endpoints, fields, or architecture introduced.

## Issues Encountered
None beyond the two auto-fixed items above.

## User Setup Required

None — no external service configuration required. As noted in the 42-01 SUMMARY, the live Convex dev-deployment sync (`pnpm --filter @eisenbalm/convex dev:once`) remains deferred to the Plan 42-08 integration gate; this plan's Python-side changes don't require it (all tests run against convex-test/mocks).

## Next Phase Readiness
- `_reset_touched_claims` is now a stable, reusable hook point: any future content-patch endpoint that touches claim-anchored prose (e.g., Plan 42-04's "Edit claim" / "Ask agent for better evidence" apply step) can call it the same way, immediately after `_revoke_active_signoffs`, rather than reimplementing the diff/reset logic. Per 42-RESEARCH.md Pitfall 3, any endpoint that BOTH content-patches a block AND sets a terminal status on the specific claim being acted on must call `_reset_touched_claims` FIRST and the explicit terminal-status write LAST, so the explicit action always wins over the generic reset — this ordering constraint is documented here for Plan 42-04 to honor.
- No blockers.

---
*Phase: 42-fact-check-stage*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 4 files created/modified this plan were confirmed present on disk; both task commits (`ffd9bd1`, `6242cff`) confirmed present in `git log --oneline --all`.
