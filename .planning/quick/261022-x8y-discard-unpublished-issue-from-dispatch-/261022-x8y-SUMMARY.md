---
phase: quick-261022-x8y
plan: 01
subsystem: pipeline, dispatch-control
tags: [discard, sanity, fastapi, home]
requirements: [QUICK-261022-x8y]
key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/lib/discard.py
    - packages/pipeline/tests/test_discard.py
    - apps/dispatch-control/app/(editorial)/_components/DiscardIssueControl.tsx
    - apps/dispatch-control/__tests__/DiscardIssueControl.test.tsx
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
    - apps/dispatch-control/lib/pipelineControlClient.ts
    - apps/dispatch-control/lib/editorState.ts
    - apps/dispatch-control/app/(editorial)/_components/IssueHome.tsx
    - apps/dispatch-control/__tests__/IssueHome.test.tsx
decisions:
  - Discard reuses the issue number by deleting unpublished issue-N / drafts.issue-N docs.
  - Delete for a live run is deferred to a finally block after the graph stops, so the publisher cannot recreate the draft.
metrics:
  completed: 2026-10-23
---

# Quick 261022-x8y: Discard an unpublished issue

`POST /runs/{run_id}/discard` deletes the unpublished Sanity docs for the issue and lands the run as Stopped. Home gets a quiet "Discard this issue" button behind a confirm.

## Commits
- 1006acc5: pipeline endpoint, lib/discard.py, Sanity helpers, rerun guards, tests
- 3b316171: client, COPY, DiscardIssueControl, IssueHome wiring, tests (see git log)

## Behaviour
- Published issues (Convex publishedAt, run complete, or Sanity published doc) return 409 `reason: published`. The delete query is also guarded by runId, status != published and !defined(publishedAt).
- Live run: sets pending discard and requests cancel. `finish_pending_discard` runs in `finally` of `_execute_run` and the resume task, after the graph stops, then lands cancelled and deletes.
- Idle states go immediately: cancelled status first, then delete. Delete failure gives 502. Retry is idempotent.
- `rerun_agent` refuses cancelled runs and re-checks before writing.
- UI releases a hold best-effort after discard, because the number is reused.

## Gates
- `uv run pytest tests/test_discard.py tests/test_cancel_paused.py tests/test_cancel.py tests/test_reroll.py`: 27 passed
- `pnpm --filter dispatch-control test`: 1109 passed
- `pnpm --filter dispatch-control build`: succeeded
- No convex/ edits, no dev:once needed.

## Deviations
None. Not pushed or deployed.

## Self-Check: PASSED
