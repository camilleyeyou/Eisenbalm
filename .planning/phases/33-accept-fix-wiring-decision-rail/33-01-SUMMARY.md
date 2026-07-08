---
phase: 33-accept-fix-wiring-decision-rail
plan: 01
subsystem: api
tags: [api-contracts, fastapi, convex, sanity, qa-findings, publish-gate, span-resolver]

# Dependency graph
requires:
  - phase: 31-content-patch-endpoints-full-editing
    provides: "§31 patch machinery (patch_issue_field, ifRevisionID guard, _emit_audit before/after, get_issue_draft blocks) the accept endpoint composes"
  - phase: 32-native-galley-read-only-span-resolver
    provides: "§32.1 blockIndexHint field + client spanResolver.ts the §33.5 Python port mirrors"
  - phase: 26-review-gate-charity-registry
    provides: "publish/schedule guard chain the §33.4 open_error_findings gate slots into; claimChecks:setStatus the checkedAt stamp lands in"
provides:
  - "docs/API_CONTRACTS.md §33 — the frozen Phase 33 contract: findings accept/dismiss/reopen endpoints, qaCorrections resolution fields + setResolution mutation + byId query, claim_checks.checkedAt, publish/schedule open_error_findings 409 gate, server-side span-resolver spec, editor-memo `notes` key correction, pitchLog:selectedByRunId hook-card query, verification-summary sources"
affects: [33-02, 33-03, 33-04, 33-05, phase-34-two-sign-off-gate, phase-35-provenance, phase-37-signal-desk]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Contract-first: §33 written before any endpoint/schema code (CLAUDE.md hard rule)", "409 detail vocabulary fixed in contract: already_resolved, accept_unavailable, span_not_resolved, revision_mismatch, not_resolved, open_error_findings"]

key-files:
  created: []
  modified:
    - docs/API_CONTRACTS.md

key-decisions:
  - "Three separate verb endpoints (accept/dismiss/reopen) rather than one /resolution endpoint — cleaner 409 vocabularies and audit-log readability (research recommendation adopted)"
  - "schedule_issue gets the SAME open_error_findings gate as publish_issue (Pitfall 8 — tick-sweep bypass closed), documented explicitly in §33.4"
  - "Editor memo payload key documented as `notes` (per agents/editor.py), correcting CONTEXT D-16's `editor_final_notes` wording"
  - "setResolution is pipeline-lane (requirePipelineSecret + _PIPELINE_SECRET_GUARDED_PATHS, both edits together); qaCorrections:insert public GAM-05 exception explicitly UNCHANGED"

patterns-established:
  - "Resolution enum with legacy-bool sync: resolution optional union + accepted:boolean kept in sync for Phase 26 back-compat"
  - "Anchor-state-blind blocking: error findings gate Publish regardless of span resolvability (D-11b)"

requirements-completed: [GLY-03, GLY-04, EDT-04, EDT-06]

# Metrics
duration: 6min
completed: 2026-07-08
---

# Phase 33 Plan 01: Contract Amendment Summary

**§33 contract frozen in docs/API_CONTRACTS.md: three findings endpoints with a fixed 409 vocabulary, additive qaCorrections resolution fields + pipeline-lane setResolution, claim_checks.checkedAt, the anchor-state-blind open_error_findings publish/schedule gate, and the server-side span-resolver spec — all before any code exists**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-08T04:47:47Z
- **Completed:** 2026-07-08T04:53:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `## Phase 33 — Accept-Fix Wiring + Decision Rail` (§33.1–§33.7) inserted between the §32.1 block's closing note and the `## Error handling rules` appendix, matching §31/§32 heading + prose style, with the additive-only closing italic note
- Every shape downstream plans 33-02..33-05 need is now verbatim in the contract: endpoint paths (`POST /issues/{run_id}/findings/{finding_id}/accept|dismiss|reopen`), request/response bodies, all six 409 reason strings, the exact Convex field validators, mutation arg shapes, and the three-stage never-guess resolver algorithm
- D-16 payload-key correction (`notes`, not `editor_final_notes`) and Pitfall 8 schedule-gate parity are locked into the contract so no downstream plan can regress them
- Zero Phase 34 scope leaked: forbidden two-sign-off strings count remains 0 (pre-edit baseline preserved)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write §33 contract into docs/API_CONTRACTS.md** - `7ab16ff` (docs)

## Files Created/Modified

- `docs/API_CONTRACTS.md` - +182 lines: §33.1 qaCorrections resolution fields + setResolution/byId; §33.2 claim_checks.checkedAt; §33.3 findings endpoints with full flows; §33.4 publish/schedule open_error_findings gate; §33.5 span_resolver.py spec; §33.6 editor-memo `notes` key; §33.7 hook card (pitchLog:selectedByRunId) + verification summary sources

## Decisions Made

- Adopted the research recommendation of three verb endpoints over a single `/resolution` state-transition endpoint (discretion item resolved in the contract).
- Documented `schedule_issue` gate parity explicitly rather than leaving it to implementer discretion — the contract now closes the tick-sweep bypass by fiat.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Note: `convex/CLAUDE.md` directs reading `convex/_generated/ai/guidelines.md`, which does not exist in the repo (already verified in 33-RESEARCH.md) — existing `convex/*.ts` patterns were used as authoritative for the documented mutation shapes.

## Known Stubs

None — docs-only change; no code or UI surfaces touched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 33-02..33-05 (Convex schema/mutations, pipeline resolver + findings endpoints + gate, dashboard popover/rail) can implement §33 verbatim with zero shape discretion remaining.
- All acceptance greps green: 3 endpoint paths, exact resolution validator string, requirePipelineSecret + _PIPELINE_SECRET_GUARDED_PATHS, schedule_issue, selectedByRunId, §32 < §33 < Error-handling ordering, forbidden Phase-34 strings = 0.

## Self-Check: PASSED

- FOUND: docs/API_CONTRACTS.md (modified, +182 lines)
- FOUND: .planning/phases/33-accept-fix-wiring-decision-rail/33-01-SUMMARY.md
- FOUND: commit 7ab16ff

---
*Phase: 33-accept-fix-wiring-decision-rail*
*Completed: 2026-07-08*
