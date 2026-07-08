---
phase: 34-two-sign-off-publish-gate-studio-bypass-retirement
plan: 05
subsystem: api
tags: [fastapi, convex, sign-off, audit, content-patch, findings]

# Dependency graph
requires:
  - phase: 34-02
    provides: "signOffs Convex table + signOffs:record/revokeAll mutations, secret-guarded"
  - phase: 34-03
    provides: "sign-off endpoints + publish gate, facts-cleared prerequisite relocated to sign-off time"
provides:
  - "_revoke_active_signoffs shared helper (fail-open, co-located with _emit_audit in control.py)"
  - "Auto-revoke on every content mutation: 9 content.py patch/upload routes + 3 findings.py routes + rerun_agent"
affects: [34-06-decision-rail-live-signoff-subscription]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-open Convex side-effect helper (mirrors _emit_audit): wrap mutation in try/except, log.warning on failure, never raise — the operator's primary action (content save) is never blocked by a secondary write"
    - "Call _revoke_active_signoffs immediately after _emit_audit at every content-mutating call site, reusing the same convex http var already in scope"

key-files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py
    - packages/pipeline/src/eisenbalm_pipeline/api/content.py
    - packages/pipeline/src/eisenbalm_pipeline/api/findings.py
    - packages/pipeline/tests/test_content_patch_endpoints.py
    - packages/pipeline/tests/test_findings_endpoints.py

key-decisions:
  - "reopen and dismiss both revoke sign-offs (not just accept) — they change the facts-cleared PREREQUISITE basis (open-error findings posture), closing the gate-integrity hole created by relocating that check to sign-off time in 34-03"
  - "Each call site passes a short, endpoint-specific reason string (e.g. 'section edited', 'theme edited', 'finding reopened') rather than a single generic reason, for a more legible audit/rail experience"

patterns-established:
  - "Shared fail-open helper for non-blocking secondary Convex writes triggered by a primary content mutation"

requirements-completed: [PUB-01, PUB-04]

# Metrics
duration: 12min
completed: 2026-07-08
---

# Phase 34 Plan 05: Auto-Revoke on Mutation Summary

**Every content-mutating pipeline endpoint (9 content patches, 3 findings actions, 1 section re-roll) now fail-open-revokes both active sign-offs via a shared `_revoke_active_signoffs` helper, closing the gate-integrity hole where a post-sign-off edit or reopened finding could otherwise leave a stale attestation active.**

## Performance

- **Duration:** 12 min
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added `_revoke_active_signoffs(http, *, run_id, reason)` to `control.py`, co-located with `_emit_audit`, calling the secret-guarded `signOffs:revokeAll` Convex mutation inside a try/except (fail-open — a revoke failure never blocks the operator's content save)
- Hooked all 9 `content.py` PATCH/POST routes (patch_section, patch_headline, patch_theme, patch_game, patch_pdf_data_points, patch_bonus, patch_deliberation_conversation, patch_podcast_transcript, upload_content_asset) to call the helper immediately after their existing `_emit_audit`
- Hooked all 3 `findings.py` routes (accept_finding, dismiss_finding, reopen_finding) — reopen/dismiss explicitly documented as closing the D-04/§34.3 facts-cleared prerequisite gate-integrity hole
- Hooked `control.py::rerun_agent` — re-rolling a section is a content mutation too
- Extended `test_content_patch_endpoints.py` and `test_findings_endpoints.py` with assertions that `signOffs:revokeAll` fires with the run's id after a successful mutation

## Task Commits

1. **Task 1: Add _revoke_active_signoffs helper + hook rerun_agent (control.py)** - `cbfd924` (feat)
2. **Task 2: Hook all 9 content.py patches + 3 findings.py routes** - `933f423` (feat)

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` - added `_revoke_active_signoffs` helper; hooked `rerun_agent`
- `packages/pipeline/src/eisenbalm_pipeline/api/content.py` - imported the helper; hooked all 9 content-mutating routes
- `packages/pipeline/src/eisenbalm_pipeline/api/findings.py` - imported the helper; hooked accept/dismiss/reopen
- `packages/pipeline/tests/test_content_patch_endpoints.py` - added `test_theme_patch_revokes_signoffs`
- `packages/pipeline/tests/test_findings_endpoints.py` - extended accept/dismiss/reopen happy-path tests with revoke assertions

## Decisions Made
- reopen and dismiss both revoke sign-offs (not just accept) since they alter the facts-cleared prerequisite basis — this is the specific gate-integrity fix called out in the plan objective
- Per-endpoint reason strings (short, human-legible) rather than one generic string, since the rail (34-06) will read these live

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `signOffs:revokeAll` now fires from every content-mutation path; 34-06 (live rail subscription to `signOffs:activeByRunId`) can build on this with confidence that any edit will flip the rail red with zero polling
- Full pipeline suite green (441 passed / 33 skipped, no regressions) — includes both new revoke-assertion tests and the full pre-existing matrix

---
*Phase: 34-two-sign-off-publish-gate-studio-bypass-retirement*
*Completed: 2026-07-08*

## Self-Check: PASSED

- FOUND: packages/pipeline/src/eisenbalm_pipeline/api/control.py
- FOUND: packages/pipeline/src/eisenbalm_pipeline/api/content.py
- FOUND: packages/pipeline/src/eisenbalm_pipeline/api/findings.py
- FOUND: .planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-05-SUMMARY.md
- FOUND commit: cbfd924
- FOUND commit: 933f423
