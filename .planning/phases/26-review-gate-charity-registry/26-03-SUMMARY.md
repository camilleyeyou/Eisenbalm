---
phase: 26-review-gate-charity-registry
plan: "03"
subsystem: pipeline-review-endpoints
tags: [fastapi, review-gate, sanity, convex, registry, publisher]
dependency_graph:
  requires: [26-01]
  provides: [review-endpoints, sanity-flip-helper, scheduled-publish-sweep, registry-upsert-on-publish]
  affects: [pipeline, convex-registry, dispatch-control-dashboard]
tech_stack:
  added: [api/review.py, lib/sanity_publish.py]
  patterns: [clerk-jwt-guard, claims-signoff-gate, shared-flip-helper, tick-sweep, registry-upsert-once]
key_files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/api/review.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py
    - packages/pipeline/tests/agents/publisher/test_publisher.py
    - packages/pipeline/tests/test_review_endpoints.py
    - packages/pipeline/tests/test_scheduler.py
decisions:
  - "registry upsert (charities:upsertFeatured) placed in _run_publisher step-6 so both manual publish endpoint and scheduled tick fire it exactly once per publish via the webhook chain (D-03)"
  - "scheduled-publish sweep inserted before STEP 2 cadence gate in pipeline_tick so due runs publish even when no new run is due that tick (D-02)"
  - "_flip_sanity_published placed in lib/sanity_publish.py (not api/) so it is importable by both api/review.py and api/control.py without circular imports"
  - "pre-existing test failures in test_tool_limits.py + test_pipeline_real_mode.py caused by parallel plan 26-02 scout.py modifications — out of scope for 26-03, documented as deferred"
metrics:
  duration: "17 minutes"
  completed: "2026-06-23"
  tasks_completed: 3
  files_modified: 8
---

# Phase 26 Plan 03: Pipeline Review Endpoints Summary

JWT-guarded publish/schedule/reject review endpoints with server-side claims gate, shared Sanity-flip helper, hourly-tick scheduled-publish sweep, and publisher registry upsert wired once per publish.

## Tasks Completed

### Task 1: Publisher writes sanityIssueId + upserts featured charity; create shared _flip_sanity_published helper

**Commit:** `8b99f05`

- `publisher` @agent_node: `pipelineRuns:updateStatus` awaiting-review now passes `sanityIssueId=issue_id` (API_CONTRACTS §26.4) so the publish endpoint can resolve the Sanity doc from a runId.
- `QUERY_ISSUE_FOR_PUBLISH` extended with `"charityWebsite": charity->website` and `"charitySlug": charity->slug.current` projections, mirroring scout.py's charity dereference pattern.
- `_run_publisher` step-6: after `status="complete"` mutation, calls `charities:upsertFeatured` via `convex_mutation_safe` (non-blocking) — fires once per publish regardless of trigger path (D-03/REG-01). Skipped for `run_id=None` (manually-authored issues).
- New `lib/sanity_publish.py`: `async def _flip_sanity_published(http, sanity_issue_id)` PATCH-es `weeklyIssue.status="published"` on Sanity. Docstring explicitly states it does NOT call `_run_publisher` directly.
- New tests: `test_publisher_upserts_featured_charity` (asserts `charities:upsertFeatured` called with correct name+website) and `test_publisher_upsert_skipped_when_no_charity_name`.

### Task 2: Create api/review.py — publish/schedule/reject endpoints + mount on app

**Commit:** `946112d`

- `POST /issues/{run_id}/publish`: guards run-exists/awaiting-review/allSignedOff/sanityIssueId, calls `_flip_sanity_published`, writes `reviewActions:record` + `auditLog:record`.
- `POST /issues/{run_id}/schedule`: same guards + `scheduledAt > now` guard, calls `runs:setScheduledPublish`, writes review + audit rows.
- `POST /issues/{run_id}/reject`: run-exists guard only (no claims gate), writes `reviewActions:record` + audit, does NOT change run status.
- All three routes use `Depends(_require_clerk_jwt_control)` (dev-mode sentinel when `CLERK_JWT_ISSUER_DOMAIN` unset).
- Router mounted in `api/main.py`.
- Tests: `test_publish_requires_claims_signoff`, `test_publish_success`, `test_schedule_writes_scheduled_at`, `test_reject_records_action` — all passing.

### Task 3: Extend pipeline_tick with the scheduled-publish sweep (D-02)

**Commit:** `4000421`

- `_flip_sanity_published` imported into `api/control.py`.
- Sweep inserted immediately AFTER the kill switch (STEP 1) and BEFORE the cadence gate (STEP 2): queries `runs:dueForPublish`, calls `_flip_sanity_published` + `runs:setScheduledPublish(None)` per due run, continues regardless of cadence gate outcome.
- All tick return shapes (triggered/skipped/run_in_progress/budget) include `"scheduledPublished": [...]`.
- New test `test_tick_fires_due_scheduled_runs`: verifies sweep fires and returns `scheduledPublished: ["run-due-01"]` even when `_is_due` returns False.

## Deviations from Plan

None — plan executed exactly as written.

## Deferred Issues

5 pre-existing test failures caused by parallel plan 26-02 modifications to `scout.py`, `convex_client.py`, `test_tool_limits.py`, and `test_pipeline_real_mode.py`:
- `tests/agents/test_tool_limits.py::test_wrapper_emits_tool_limit_event_on_overrun`
- `tests/agents/test_tool_limits.py::test_wrapper_event_emits_before_status_failed`
- `tests/test_pipeline_real_mode.py::test_full_graph_runs_to_publisher`
- `tests/test_pipeline_real_mode.py::test_model_versions_voice_critical_populated`
- `tests/test_pipeline_real_mode.py::test_design_suppressed_graph_completes_without_theme`

These fail due to `scout._load_featured_keys` attribute not existing in the base module — changes introduced by plan 26-02 (scout registry integration). Out of scope for 26-03.

## Self-Check

**Files created/verified:**

- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py` — FOUND
- `packages/pipeline/src/eisenbalm_pipeline/api/review.py` — FOUND
- `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` — FOUND (modified)

**Commits verified:**
- `8b99f05` — Task 1
- `946112d` — Task 2
- `4000421` — Task 3

**Tests:**
- 16 plan-specific tests: all PASSING
- Full suite (excluding parallel-agent pre-existing failures): 338 passed, 32 skipped

## Self-Check: PASSED
