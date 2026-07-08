---
phase: 34-two-sign-off-publish-gate-studio-bypass-retirement
plan: 04
subsystem: api
tags: [fastapi, webhook, convex, sanity, sign-off, security]

# Dependency graph
requires:
  - phase: 34-02
    provides: "convex/signOffs.ts (activeByRunId public query, record/revokeAll pipeline-lane mutations)"
  - phase: 34-03
    provides: "POST /issues/{run_id}/sign-off endpoint + publish/schedule gates restructured on signOffs:activeByRunId"
provides:
  - "_revert_sanity_status (lib/sanity_publish.py) — inverse of _flip_sanity_published, PATCHes weeklyIssue.status back to a parameterized value (default in-review)"
  - "D-07 sign-off re-validation guard in api/webhooks.py::sanity_publish — re-checks signOffs:activeByRunId (or blocks on runId=None) after the HMAC/age/status/idempotency guards and before asyncio.create_task(_run_publisher(...))"
  - "Blocked-bypass side effects: audit row (action=run.publish_bypass_blocked) + deliberationEvents:insert cost-warning/publish-bypass-blocked alert"
affects: [34-06-rail-signoffs-studio-retirement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Webhook-side re-validation: a server-authoritative gate re-checked at the LAST possible point before an irreversible side effect (publisher launch), independent of whichever client (dashboard or Studio) flipped the upstream status flag"
    - "Frozen-union alert reuse: new alert semantics ride the existing deliberationEvents.eventType='cost-warning' literal via an inner JSON discriminator, rather than adding a new literal (mirrors Phase 27 D-04 auto-publish-enabled precedent)"

key-files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py
    - packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py
    - packages/pipeline/tests/api/test_webhook_sanity.py

key-decisions:
  - "A payload with no runId at all (manually-authored Studio draft with no pipeline run behind it) is treated identically to a missing-signoffs bypass — it cannot possibly have sign-offs, so it blocks unconditionally, per Research Open Q#2."
  - "The 3 pre-existing publish-path webhook tests were updated to simulate a legit dashboard publish (both sign-offs active) rather than left unmocked, since the new guard now makes a real signOffs:activeByRunId call on every reach of that code path."

patterns-established:
  - "Studio status-flip bypass closure: flipping Sanity weeklyIssue.status directly (bypassing the dashboard's §34.4 sign-off gate) now gets silently reverted + audited + alerted by the webhook itself — the server, not the client UI, is the enforcement boundary."

requirements-completed: [PUB-02, PUB-04]

# Metrics
duration: ~20min
completed: 2026-07-08
---

# Phase 34 Plan 04: Webhook re-validation + Studio-bypass revert Summary

**The Sanity publish webhook now re-checks `signOffs:activeByRunId` immediately before launching the publisher, reverting Sanity status to `in-review` and blocking (with an audit row + alert) any publish whose sign-offs are missing or whose payload carries no `runId` at all — closing the Studio direct-flip bypass regardless of what Studio's UI allows.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `_revert_sanity_status` added to `lib/sanity_publish.py` as the exact structural mirror of `_flip_sanity_published`, reusing `_dataset()`/`_auth_headers()`/`_API_VERSION`, defaulting to `status="in-review"`.
- `api/webhooks.py::sanity_publish` gained the D-07 guard: after the existing HMAC/age/status/idempotency checks and before `asyncio.create_task(_run_publisher(...))`, it queries `signOffs:activeByRunId` for the payload's `runId`. If either kind is missing — or `runId` is absent entirely — it calls `_revert_sanity_status(..., status="in-review")`, writes an `auditLog:record` row (`action="run.publish_bypass_blocked"`), emits a `deliberationEvents:insert` alert via the frozen `"cost-warning"` literal with an inner `{"eventType": "publish-bypass-blocked", ...}` payload, and returns `{"ok": True, "blocked": "missing_signoffs", "missing": [...]}` without ever calling the publisher. A legitimate dashboard publish (both sign-offs already active from passing the §34.4 gate before the Sanity flip) sails through unchanged.
- `tests/api/test_webhook_sanity.py` extended with 3 new cases covering both-active (proceeds), one-missing (blocks + reverts + audits + alerts), and run-less payload (blocks + reverts) — plus the 3 pre-existing publish-path tests were updated to simulate a legit dashboard publish so their original HMAC/idempotency assertions still hold now that the guard makes a real `signOffs:activeByRunId` call on every reach of that code path.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add `_revert_sanity_status` to lib/sanity_publish.py** - `9463af8` (feat)
2. **Task 2: Insert the D-07 sign-off re-validation guard in webhooks.py + tests** - `d6dd732` (feat)

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py` - `_revert_sanity_status` helper (inverse of `_flip_sanity_published`)
- `packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` - D-07 re-validation guard inserted between the idempotency-dedup block and `asyncio.create_task(_run_publisher(...))`; new imports (`_cc`, `_emit_audit`, `_revert_sanity_status`)
- `packages/pipeline/tests/api/test_webhook_sanity.py` - `_patch_both_signoffs_active` helper; 3 pre-existing tests patched to simulate a legit publish; 3 new D-07 guard test cases

## Decisions Made
- Treated `runId is None` identically to a missing-signoffs block (Research Open Q#2) — a run-less payload cannot possibly carry sign-offs, so there is no ambiguity to resolve.
- Updated (rather than left untouched) the 3 pre-existing webhook tests that reach the guard's code path, since the new guard now performs a real Convex query there; mocking both sign-offs active preserves each test's original intent (signature acceptance, idempotency dedup, missing-idempotency-key tolerance) without conflating it with D-07 behavior, which gets its own dedicated test cases.

## Deviations from Plan

None — plan executed exactly as written. The pre-existing test updates (patching the guard in 3 already-existing tests) were a necessary consequence of Task 2's own acceptance criteria ("Full pipeline suite green"), not a deviation from what the plan specified — the plan's Task 2 `<action>` block explicitly inserts the guard into the same code path those tests exercise.

## Issues Encountered

While verifying Task 2 with real infra env vars sourced (`.env`), the 3 pre-existing webhook tests that reach `request.app.state.background_tasks.add(task)` raised `AttributeError: 'State' object has no attribute 'background_tasks'`. Root-caused to `tests/conftest.py`'s `client` fixture: it builds `httpx.ASGITransport(app=app)` directly, and `httpx==0.28.1`'s `ASGITransport` has no `lifespan` parameter at all, so FastAPI's `lifespan()` (which sets `app.state.background_tasks` et al.) never runs under that fixture. Confirmed **pre-existing and unrelated to this plan** by reproducing the identical failure via `git stash` on unmodified `master`. Independently verified the D-07 guard's correctness end-to-end with a `starlette.testclient.TestClient` smoke test (which does run lifespan) — confirmed the full blocked-bypass flow (no publisher call, revert with `status="in-review"`, audit row, `cost-warning`/`publish-bypass-blocked` alert, correct JSON response). Logged as a deferred, out-of-scope item in `.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/deferred-items.md` with a suggested follow-up (swap the `client` fixture to `starlette.testclient.TestClient` or wrap `ASGITransport` in `asgi-lifespan`'s `LifespanManager`). Verification therefore relied on: (1) the standard unsourced-env skip path (`uv run pytest tests/api/test_webhook_sanity.py -x -q` → 8 skipped, exit 0) and the full suite (`uv run pytest -x -q` → 441 passed / 36 skipped, no regressions vs. the 34-05 baseline of 441 passed / 33 skipped — skip count grew by exactly the 3 new webhook tests, passed count unchanged since this file always skips locally), and (2) the manual lifespan-aware smoke test proving the guard logic itself is correct.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The webhook-side D-07 guard is live and independently enforces the two-sign-off gate regardless of publish trigger source (dashboard flip, scheduled-publish sweep, or a direct Studio status edit).
- 34-06 (rail + Studio retirement, already completed in parallel per `git log`) can reference this guard's revert-and-alert behavior in its Studio read-only-fallback documentation — confirmed already done (`apps/studio/README.md` "Publishing & the console (Phase 34)" section per the 34-06 summary).
- Deferred: the `tests/api/test_webhook_sanity.py` lifespan-fixture gap in `deferred-items.md` is a good candidate for a small standalone `/gsd:quick` or `/gsd:debug` task — it affects any future webhook test authored against the `client` fixture with real infra env vars present, not just this plan.

---
*Phase: 34-two-sign-off-publish-gate-studio-bypass-retirement*
*Completed: 2026-07-08*

## Self-Check: PASSED

All 5 created/modified files found on disk (`lib/sanity_publish.py`, `api/webhooks.py`, `tests/api/test_webhook_sanity.py`, `deferred-items.md`, this SUMMARY); both task commits (`9463af8`, `d6dd732`) found in git history.
