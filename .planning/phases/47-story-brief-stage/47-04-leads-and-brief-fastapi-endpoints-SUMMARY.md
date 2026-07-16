---
phase: 47-story-brief-stage
plan: 04
subsystem: api
tags: [fastapi, convex, clerk, audit-log, pydantic, pytest]

# Dependency graph
requires:
  - phase: 47-01-contracts-convex-store-wave0-tests
    provides: "docs/API_CONTRACTS.md §7/§47 contract, live briefs table (insert/patch/byRunId) + story_leads.status/setStatus, the three guarded pipeline-secret paths (briefs:insert, briefs:patch, storyLeads:setStatus)"
provides:
  - "api/leads.py — Clerk-guarded POST /issues/{run_id}/leads/{lead_id}/require and /remove (BRF-02), mirroring factcheck.py::keep_claim/delete_claim"
  - "api/brief.py — Clerk-guarded PATCH /issues/{run_id}/brief (BRF-05) and POST /issues/{run_id}/brief/{field}/strengthen/preview + /apply (BRF-06), generalizing revision.py's preview/apply pair to a Brief field scope"
  - "revision.py::_fetch_brief_context now reads the real briefs:byRunId row (operator-edited source of truth) ahead of the pre-Phase-47 degraded Sanity-proxy fallback"
  - "leads.router and brief.router registered on the FastAPI app (main.py)"
  - "17 new endpoint tests (test_leads_endpoints.py, test_brief_endpoints.py) covering 422-on-empty-reason, audit-before-write, Decision-log projection, and preview-zero-mutation"
affects: [47-05-workspace-subscriptions-lead-card-actions, 47-07-brief-field-table-and-strengthen, 47-08-story-brief-screen-mount-and-phase-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Require-vs-Remove Decision-log split: Require passes no reason= kwarg and no reason key in its after-JSON, so auditLog.ts::isDecisionRow excludes it; Remove passes structured reason=/run_id= kwargs so it projects into the shared Decision log — same split factcheck.py's Confirm-vs-Keep establishes"
    - "Field-scoped revision generalization: brief.py's strengthen/preview+apply reuse revision.py's read-only-preview / audited-apply shape (budget guard, acomplete, briefs:patch) rather than forking a third revision engine — apply additionally passes a structured reason= (unlike revise/apply's unreasoned passage_revised row) so accepting a strengthened field surfaces in the Decision log per the plan's explicit requirement"

key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/api/leads.py
    - packages/pipeline/src/eisenbalm_pipeline/api/brief.py
    - packages/pipeline/tests/test_leads_endpoints.py
    - packages/pipeline/tests/test_brief_endpoints.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py
    - packages/pipeline/src/eisenbalm_pipeline/api/revision.py

key-decisions:
  - "Require-a-lead is FastAPI-routed (not a bare Convex mutation) for consistency with Remove, per RESEARCH Pattern 3 — but its _emit_audit call omits reason= and keeps 'reason' out of the after-JSON so it stays out of the Decision log (a routine status flip, not a decision)"
  - "Brief field-strengthen preview does ZERO Convex writes (no cost-recording mutation, unlike revision.py's passage-revision preview) — the plan's action text explicitly says 'NO Convex write, NO _emit_audit' for this endpoint, so cost attribution for this specific action type is accepted as an intentional simplification, not carried over from revise/preview"
  - "Brief field-strengthen apply DOES pass a structured reason= kwarg to _emit_audit (a synthesized 'Applied agent-strengthened {field}.' string) — unlike revise/apply's unreasoned passage_revised row — because the plan's must_haves explicitly require '+ audit_log + Decision-log entry' for this action"
  - "leads.py::_load_lead and brief.py::_fetch_current_field both read via the existing byRunId list/single-row queries (no new Convex by-id query added) — matches the plan's additive-only, no-new-endpoint-shapes constraint"

patterns-established:
  - "Pattern: reason-optional vs reason-mandatory FastAPI action pairs both call the same underlying setStatus/patch mutation, differing only in whether _emit_audit receives reason=/run_id= — the Decision log inclusion is entirely a function of that one kwarg (auditLog.ts::isDecisionRow), not a separate write path"

requirements-completed: [BRF-02, BRF-05, BRF-06]

# Metrics
duration: 13min
completed: 2026-07-16
---

# Phase 47 Plan 04: Leads and Brief FastAPI Endpoints Summary

**Clerk-guarded FastAPI write boundaries for Require/Remove-a-lead (BRF-02) and Brief edit + agent-strengthen (BRF-05/06), reusing the factcheck.py keep/delete and revision.py preview/apply shapes verbatim — no bare dashboard Convex mutations, no third revision engine.**

## Performance

- **Duration:** 13 min (task commits 03:51:26 → 03:56:44 PDT)
- **Started:** 2026-07-16T10:45:00Z (approx.)
- **Completed:** 2026-07-16T10:57:08Z
- **Tasks:** 2
- **Files modified:** 6 (2 new endpoint modules, 2 new test files, main.py registration, revision.py's `_fetch_brief_context` rewire)

## Accomplishments
- `api/leads.py`: Require (no reason, stays out of the Decision log) and Remove (reason mandatory, 422 on empty, writes `storyLeads:setStatus` + a `reason=`/`run_id=`-carrying `auditLog:record` row) — mirrors `factcheck.py::keep_claim`/`delete_claim` exactly (BRF-02)
- `api/brief.py`: PATCH `/issues/{run_id}/brief` (guarded direct field edit, BRF-05) and the two-step "Ask an agent to strengthen" pair — `strengthen/preview` (read-only, budget-guarded, zero Convex writes) and `strengthen/apply` (writes via `briefs:patch`, emits a reason-carrying audit row so it surfaces in the Decision log) — generalizing `revision.py`'s preview/apply pattern to a Brief field scope, exactly as Phase 45 generalized FCT-06 (BRF-06)
- `revision.py::_fetch_brief_context` now prefers a live `briefs:byRunId` read over the pre-Phase-47 degraded Sanity-proxy stub, falling back to that proxy on any Convex miss/failure — "Match the brief" on later passage revisions now reads the operator-edited Brief
- Both routers registered in `main.py`; 17 new endpoint tests all green; full pipeline regression suite (682 tests) stays green with zero failures

## Task Commits

Each task was committed atomically:

1. **Task 1: api/leads.py — Require/Remove lead endpoints (BRF-02)** - `f1534a7` (feat)
2. **Task 2: api/brief.py — PATCH brief + field-strengthen preview/apply; wire _fetch_brief_context** - `43aac3b` (feat)

_No TDD tasks in this plan — both are `type="auto"` endpoint-implementation work._

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/api/leads.py` - Require/Remove lead endpoints (BRF-02)
- `packages/pipeline/src/eisenbalm_pipeline/api/brief.py` - PATCH brief + field-strengthen preview/apply endpoints (BRF-05/06)
- `packages/pipeline/src/eisenbalm_pipeline/api/revision.py` - `_fetch_brief_context` now reads `briefs:byRunId` first; call site in `preview_passage_revision` updated to pass `convex_http`/`run_id`
- `packages/pipeline/src/eisenbalm_pipeline/api/main.py` - `leads.router` and `brief.router` registered
- `packages/pipeline/tests/test_leads_endpoints.py` - 8 tests (require happy-path/404, remove 422/happy-path/404, router registration, guarded-path check)
- `packages/pipeline/tests/test_brief_endpoints.py` - 9 tests (PATCH validate/write, strengthen preview zero-mutation + 409 cost-cap, strengthen apply write+decision-logged audit, router registration, guarded-path check)

## Decisions Made
- **Require stays FastAPI-routed but out of the Decision log:** matches RESEARCH Pattern 3's recommendation to route both actions through one pipeline boundary for consistency, while `auditLog.ts::isDecisionRow`'s `reason`-presence predicate cleanly separates "routine status flip" (Require) from "decision" (Remove) without a second write path.
- **Brief strengthen/preview issues zero Convex writes** (no `agentRuns:completed` cost-recording call, unlike `revision.py`'s passage-revision preview) — the plan's task action text explicitly states "NO Convex write, NO _emit_audit" for this endpoint; followed literally rather than importing revision.py's cost-attribution behavior wholesale.
- **Brief strengthen/apply passes a synthesized `reason=`** (`"Applied agent-strengthened {field}."`) to `_emit_audit`, unlike `revise/apply`'s unreasoned `passage_revised` row — required because the plan's must-haves explicitly call for a "Decision-log entry," and the apply request body (`{newText}`) carries no operator-supplied reason field to forward instead.
- **No new Convex by-id query added** for either `story_leads` or `briefs` single-row lookups — both `_load_lead` (leads.py) and `_fetch_current_field` (brief.py) filter/read via the existing `byRunId` queries, keeping this plan additive-only per the contract §47.4/§47.6 (no new Convex function signatures beyond what 47-01 already landed).

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria were met on first implementation; no auto-fixes, no blocking issues, no architectural questions.

## Issues Encountered

None. The one thing worth flagging for future plans: `uv run pytest tests/api/ tests/ -q` (the exact command quoted in this plan's `<project_specific_guidance>`) collects only 54 tests when both paths are given together — a pytest path-overlap quirk specific to this repo's `testpaths = ["tests"]` config, unrelated to this plan's changes. `uv run pytest tests/ -q` alone correctly collects and runs the full 682-test suite (645 passed / 37 skipped, matching 47-01's baseline exactly). Future plans citing the two-path form should use `tests/` alone instead.

## User Setup Required

None - no external service configuration required.

## Requirements Traceability Note

This plan's frontmatter lists `requirements: [BRF-02, BRF-05, BRF-06]`, and the backend contract for
all three is now fully implemented and tested. However, per this plan's own `<project_specific_guidance>`
("The frontend clients that call these land in 47-05 (leads) and 47-07 (brief) — this plan is the
backend endpoints + tests only"), the REQUIREMENTS.md items themselves describe end-to-end
**operator-visible** capability ("Operator can Require a lead...", "the section writers draft *from*
it", "Operator can ask an agent to strengthen...") that isn't actually usable until the dashboard UI
wires into these endpoints. Following the precedent 47-01's SUMMARY established explicitly (deferring
`requirements mark-complete` for requirements whose visible behavior a later plan delivers), `state
add-decision`/`state record-*` were run for this plan, but `requirements mark-complete` was
intentionally NOT run for BRF-02/BRF-05/BRF-06 here. All three checkboxes in `.planning/REQUIREMENTS.md`
remain `[ ]`; they will flip when 47-05 (leads UI) and 47-07 (Brief field table + strengthen UI) land
the consuming frontend — whichever plan(s) actually deliver the visible behavior.

## Next Phase Readiness

- `api/leads.py` and `api/brief.py` are live, tested, and registered — Plan 47-05 (workspace subscriptions + lead-card actions) can call `require`/`remove` directly via a thin `pipelineControlClient.ts` wrapper with no further backend work.
- Plan 47-07 (Brief field table + strengthen UI) has both the PATCH-brief boundary and the strengthen preview/apply pair ready to wire into `RevisionFlow`-shaped components with a Brief-field-scoped `passage` prop, per RESEARCH Pattern 6.
- `revision.py::_fetch_brief_context`'s live `briefs:byRunId` read means any operator edit to the Brief (via this plan's PATCH/apply endpoints) immediately improves the "Match the brief" context on the NEXT passage-revision preview — no additional wiring needed.
- No blockers. The full pipeline pytest suite (682 tests, 645 passed / 37 skipped) is green with zero regressions from this plan's changes.

---
*Phase: 47-story-brief-stage*
*Completed: 2026-07-16*

## Self-Check: PASSED

All 6 files verified present (leads.py, brief.py, revision.py, main.py, test_leads_endpoints.py,
test_brief_endpoints.py). Both task commit hashes (f1534a7, 43aac3b) verified present in `git log`.
