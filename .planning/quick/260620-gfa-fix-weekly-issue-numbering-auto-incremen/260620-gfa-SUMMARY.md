---
phase: quick-260620-gfa
plan: 01
subsystem: pipeline-api
tags: [issue-numbering, sanity, run-weekly, cron, bugfix]
requires:
  - eisenbalm_pipeline.lib.sanity_client.groq_query
provides:
  - eisenbalm_pipeline.api.runs._resolve_issue_number
  - eisenbalm_pipeline.api.runs.QUERY_MAX_ISSUE_NUMBER
affects:
  - POST /run/weekly (auto-increment issue number on empty-body trigger)
tech-stack:
  added: []
  patterns:
    - "Optional[int]=None sentinel + async resolver (max+1 or base 1) with fail-loud GROQ read"
    - "local import of groq_query inside resolver to avoid circular import at module load"
key-files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
    - packages/pipeline/tests/api/test_runs.py
decisions:
  - "Resolve issue_number BEFORE run_id/Convex row so a failed auto read aborts the trigger with no orphan pipelineRuns row"
  - "Project an OBJECT (issueNumber key) in GROQ so groq_query's `result or []` cannot ambiguously coerce a scalar 0/null"
metrics:
  duration: 5 min
  completed: 2026-06-20
  tasks: 2
  files: 2
requirements: [ISSUE-NUM-01]
---

# Quick 260620-gfa: Fix Weekly Issue Numbering (Auto-Increment) Summary

Empty-body `POST /run/weekly` (manual curl AND the `trigger-weekly` cron, both send `{}`) now resolves a unique issue number = `max(existing weeklyIssue.issueNumber) + 1` via a Sanity GROQ read, instead of defaulting to a hardcoded `999` that made every weekly run `createOrReplace`-overwrite `issue-999` and stay hidden behind the homepage's `order(issueNumber desc)[0]`.

## What Changed

**`packages/pipeline/src/eisenbalm_pipeline/api/runs.py`**
- `RunWeeklyBody.issueNumber` flipped from `int = 999` to `Optional[int] = None`; CONTEXT D-16 comment rewritten to describe auto-increment.
- New module constant `QUERY_MAX_ISSUE_NUMBER = '*[_type == "weeklyIssue"] | order(issueNumber desc)[0]{ issueNumber }'` (object projection, calibrator ordering style).
- New `async def _resolve_issue_number(body_issue_number: Optional[int]) -> int`:
  - explicit value -> returned verbatim, NO Sanity read;
  - `None` -> reads max via `groq_query` (locally imported, like `manual_publish`), normalizes dict/list shapes like `fetch_narrator_by_slug`, returns `max + 1`;
  - empty dataset / missing number -> base `1`;
  - read errors propagate (fail-loud, no swallow).
- `run_weekly` resolves `issue_number = await _resolve_issue_number(body.issueNumber)` once, immediately after `_require_graph`, BEFORE `new_run_id()` / the Convex `pipelineRuns:create` row / `initial_state`. Both the Convex `issueNumber` arg and `initial_state["issue_number"]` now use the resolved value. narratorSlug injection, trigger-secret auth, and the `asyncio.create_task` background pattern unchanged.

**`packages/pipeline/tests/api/test_runs.py`** — appended 6 pure-unit tests (no `client`/Convex fixture):
- `test_run_weekly_body_issue_number_defaults_none`
- `test_resolve_issue_number_auto_increments_from_max_list` (list shape -> max+1)
- `test_resolve_issue_number_auto_increments_from_max_dict` (dict shape -> max+1)
- `test_resolve_issue_number_empty_dataset_base_one`
- `test_resolve_issue_number_explicit_override_skips_read` (asserts `assert_not_awaited`)
- `test_resolve_issue_number_read_failure_propagates` (`pytest.raises(RuntimeError)`)

## Test Results

- `tests/api/test_runs.py`: **8 passed, 4 skipped** (the 4 skips are the pre-existing `client`-fixture tests that skip when env vars are unset — unaffected by this change). All 6 new tests pass.
- Full suite `pytest tests/ -q`: **235 passed, 33 skipped, 0 failed** (skips are env-gated; the 6 Pydantic `BodyBlock` warnings originate in `test_pipeline_real_mode.py` and are pre-existing, unrelated to this change).
- Named regression files (`test_pipeline_e2e.py`, `test_status_endpoint.py`, `test_agent_failure.py`, `test_editor_gate_1_resume.py`): passed + env-gated skips, no failures — they pass an explicit `issueNumber` and so hit the override branch (no Sanity read), staying green untouched.
- narratorSlug tests in `test_runs.py`: passed, untouched.

## Scope Verification

- Only `api/runs.py` and `tests/api/test_runs.py` changed (139 insertions, 3 deletions across 2 files).
- `lib/sanity_client.py` byte-unchanged (0-line diff) — its `issue_id = f"issue-{issue_number}"` / slug construction is exactly what incrementing the number makes correct.
- `grep "issueNumber: int = 999"` returns nothing.
- cli.py, the webhook, the `/run/weekly` auth, the background-task pattern, and the web app were not touched.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- Files: `api/runs.py`, `tests/api/test_runs.py`, SUMMARY.md — all FOUND.
- Commits: `f427cec` (Task 1), `416d413` (Task 2) — both FOUND.
