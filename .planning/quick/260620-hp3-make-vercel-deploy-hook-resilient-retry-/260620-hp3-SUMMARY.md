---
phase: quick-260620-hp3
plan: 01
subsystem: pipeline-publisher
tags: [vercel, deploy-hook, retry, resilience, convex, finalization]
requires:
  - lib/vercel_client.trigger_vercel_deploy
  - agents/publisher._run_publisher
  - lib/convex_client.convex_mutation_safe
provides:
  - "trigger_vercel_deploy: bounded retry/backoff on transient (429/5xx) failures, Retry-After honoring, no-retry on non-transient 4xx"
  - "_run_publisher: deploy is non-fatal; run finalization (status=complete + publisher-deploy event) always executes when run_id is set"
affects:
  - packages/pipeline/src/eisenbalm_pipeline/lib/vercel_client.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py
tech-stack:
  added: []
  patterns:
    - "module-level asyncio.sleep for patchable backoff in tests"
    - "non-fatal external-call wrapper with observable error sentinel in event payload"
key-files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/lib/vercel_client.py
    - packages/pipeline/tests/lib/test_vercel_client.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py
    - packages/pipeline/tests/agents/publisher/test_publisher.py
decisions:
  - "Deploy failure is observable via the existing publisher-deploy event payload (sentinel {\"error\": ...} under the \"deploy\" key) — no new Convex eventType, no schema change"
  - "Retry lives INSIDE trigger_vercel_deploy (single import symbol preserved) so caller/test patch surface is unchanged"
metrics:
  duration: ~12 min
  completed: 2026-06-21
---

# Quick 260620-hp3: Resilient Vercel Deploy Hook + Guaranteed Finalization Summary

Bounded retry/backoff for the Vercel deploy hook (transient 429/5xx, Retry-After-aware) plus a non-fatal deploy in `_run_publisher` so a missed deploy hook never leaves a pipeline run un-finalized in Convex.

## What Changed

The Publisher's Vercel deploy-hook call was fragile in two ways: (1) a single transient 429/5xx aborted the deploy on first attempt, and (2) the resulting unhandled `httpx.HTTPStatusError` killed the publisher AFTER the PDF upload + Sanity patch but BEFORE Convex finalization (status=complete + publisher-deploy event), leaving the run orphaned. Two coordinated tasks fixed both.

### Task 1 — Bounded retry/backoff in `trigger_vercel_deploy` (commit `f5a8542`, ALREADY COMMITTED on master)

Task 1 was implemented and committed to master prior to this execution (commit `f5a8542`). It was NOT re-implemented here; it was cherry-picked into the worktree (as the worktree base did not yet contain it) so Task 2 could build and verify on top of the real Task 1 surface.

- `import asyncio` added module-level so backoff sleeps are patchable at `eisenbalm_pipeline.lib.vercel_client.asyncio.sleep`.
- Module constants `_MAX_ATTEMPTS = 3` and `_BASE_BACKOFF_SEC = 1.0`.
- `trigger_vercel_deploy(http: AsyncClient) -> dict` now loops up to `_MAX_ATTEMPTS`:
  - 2xx → return `r.json()` (happy path unchanged, no sleep).
  - Transient (429 or 5xx) → on the last attempt `raise_for_status()` (no sleep after final); otherwise compute delay (parseable integer `Retry-After` wins, else `_BASE_BACKOFF_SEC * 2**attempt_index`), `await asyncio.sleep(delay)`, continue.
  - Non-transient (any other non-2xx, e.g. 401/404) → `raise_for_status()` immediately, no retry, no sleep.
- Signature and 2xx return shape preserved; `KeyError` on unset `VERCEL_DEPLOY_HOOK_URL` preserved.
- Tests (`tests/lib/test_vercel_client.py`): happy path, persistent-5xx-raises, 429-then-success (one sleep), Retry-After honored (sleep called with `2`), no-retry-on-404, retries-exhausted-raises (`_MAX_ATTEMPTS - 1` sleeps).

### Task 2 — Non-fatal deploy + guaranteed finalization in `_run_publisher` (commit `fda0e4f`, THIS execution)

Only step 5 (the deploy call) changed; steps 1-4 and the step-6 Convex writes are structurally intact.

- Wrapped `await trigger_vercel_deploy(vercel_http)` in `try/except Exception`. On failure: log a warning and set `deploy_response = {"error": str(e)}`, then continue.
- The existing step-6 publisher-deploy event already embeds `deploy_response` under the `"deploy"` key, so the sentinel makes the failure observable with no new payload key, no new eventType, and no Convex schema change.
- The `run_id is None` early-return branch is preserved and stays AFTER the deploy block, so the try/except wraps both the run-backed and manual paths (a deploy failure no longer crashes the manual branch either).
- `convex_mutation_safe` calls left exactly as-is (fire-and-forget).
- Tests added to `tests/agents/publisher/test_publisher.py`:
  - `test_deploy_failure_is_non_fatal_and_finalizes` — deploy raises `httpx.HTTPStatusError`; `_run_publisher` does not raise; Convex receives `pipelineRuns:updateStatus` with `status=="complete"` and a `publisher-deploy` event whose payload contains `"error"`.
  - `test_deploy_failure_manual_branch_does_not_crash` — `run_id=None`; deploy raises; `_run_publisher` does not raise and issues zero Convex writes (early-return branch preserved).

## How It Works

On publish, `_run_publisher` GROQ-fetches the issue, renders + uploads the PDF, sleeps for CDN propagation, then fires the deploy hook. `trigger_vercel_deploy` now absorbs transient hiccups (bounded retries with backoff). If the deploy still fails after exhausting retries, the publisher catches it, records `{"error": "..."}`, and proceeds to mark the run `complete` in Convex while emitting the `publisher-deploy` event carrying the error sentinel. A missed deploy is self-healing (ISR re-renders within ~60s) and now always leaves an observable, finalized run.

## Deviations from Plan

### Worktree did not contain Task 1's commit (resolved)

The execution prompt stated the worktree already contained Task 1's changes. In fact the worktree base (`c083d88`) predated Task 1's commit `f5a8542`, and the worktree's `vercel_client.py`/`test_vercel_client.py` were still the pre-Task-1 versions.

- **Found during:** initial state verification before editing.
- **Issue:** Task 2 depends on the Task 1 surface for an accurate regression run (`tests/lib/test_vercel_client.py` must exercise the retry tests), and the constraint mandates running that file.
- **Fix (Rule 3 — blocking issue):** cherry-picked `f5a8542` into the worktree (landed as `7ff0f1b`) so the worktree reflects the stated reality. No re-implementation of Task 1 logic; the cherry-pick is byte-equivalent to `f5a8542`.
- **Files modified by the cherry-pick:** `lib/vercel_client.py`, `tests/lib/test_vercel_client.py` (Task 1's own files — within the plan's allowed surface).
- **Commit:** `7ff0f1b` (cherry-pick of `f5a8542`).

No other deviations. Task 2 itself touched only the two allowed files.

## Test Results

Run under the project uv env with `--with respx` (respx is not in the manifest and was NOT added):

- `tests/agents/publisher/test_publisher.py` + `tests/lib/test_vercel_client.py`: **13 passed**.
- Regression sweep (`tests/lib/test_vercel_client.py tests/agents/publisher/ tests/api/test_webhook_sanity.py tests/api/test_runs.py`): **31 passed, 9 skipped** (skips are env-gated integration fixtures).
- Broader suite (`tests/ -q`): **242 passed, 33 skipped, 6 warnings** (warnings are pre-existing Pydantic `BodyBlock` serialization notices, unrelated to this task).

## Verification

- `git diff --stat -- convex/schema.ts` → empty (no Convex schema change).
- Task 2 commit `fda0e4f` changed only `agents/publisher/__init__.py` and `tests/agents/publisher/test_publisher.py`.
- `vercel_client.py` not touched in Task 2 (Task 1 owns it).

## Commits

- `f5a8542` — Task 1 (pre-existing on master; cherry-picked into worktree as `7ff0f1b`): bounded retry/backoff in `trigger_vercel_deploy`.
- `fda0e4f` — Task 2 (this execution): make Vercel deploy non-fatal in `_run_publisher`.

## Self-Check: PASSED

- Files: all four (publisher `__init__.py`, publisher test, `vercel_client.py`, SUMMARY) FOUND.
- Commits: `fda0e4f` (Task 2) and `f5a8542` (Task 1) FOUND.
- Sentinel `deploy_response = {"error": str(e)}` present in publisher.
