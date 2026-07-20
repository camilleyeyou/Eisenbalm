---
task: quick-260720-i3c
title: Harden registry endpoints to degrade-never-500
subsystem: pipeline (FastAPI api/registry.py)
tags: [reliability, registry, sanity, convex, error-handling]
requirements: [REGISTRY-DEGRADE-NEVER-500]
key-files:
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/registry.py
    - packages/pipeline/tests/test_repetition_note.py
    - packages/pipeline/tests/test_registry_coverage.py
decisions:
  - "Broad `except Exception` (not narrow httpx.HTTPStatusError) in both endpoints — read-only dashboard decorations whose only contract is never break the page; a narrow catch would let an unanticipated error class (JSON decode, Convex RuntimeError variant) re-introduce the exact 500 being eliminated. Mirrors existing broad-catch precedent in control.py:131."
  - "Convex and Sanity failures are caught INDEPENDENTLY per endpoint, not with one wrapping try/except — a Sanity-only 401 must not discard rows Convex already returned successfully."
  - "repetition_note's sample_size is computed from the Convex rows BEFORE the Sanity try/except, so a Sanity-only failure still reports the real Convex-known count (not 0)."
metrics:
  duration: ~15 min
  completed: 2026-07-20
---

# Quick Task 260720-i3c: Harden registry endpoints to degrade-never-500 Summary

Both `GET /registry/repetition-note` and `GET /registry/coverage-strip` now catch Convex and Sanity failures independently in each endpoint, log a WARNING with traceback, and return a neutral, well-typed 200 instead of propagating to a 500 — closing the bug that froze the operator's Issues page when `SANITY_API_TOKEN` was invalid.

## What Changed

`packages/pipeline/src/eisenbalm_pipeline/api/registry.py`:
- `coverage_strip`: wrapped the `_cc.convex_query(...)` call in `try/except Exception` (degrades to `rows = []` on failure) and the `_sc.groq_query(...)` call in a separate `try/except Exception` (degrades to `sanity_rows = []` on failure). Each failure logs `log.warning(..., exc_info=True)` with a distinct message identifying which call failed.
- `repetition_note`: same independent try/except pattern around `convex_query` and `groq_query`. Critically, `sample_size = len(rows)` is computed immediately after the Convex try/except block — **before** the Sanity call — so a Sanity-only failure still reports the real Convex-known `sampleSize`, not 0.
- Downstream code (the `by_id`/`result` construction in `coverage_strip`; the `compute_repetition_note(sanity_rows)` call in `repetition_note`) is completely unchanged — the except blocks produce the same `[]` value the existing "no ids" branch already produced, so the happy path and the legacy no-sanityCharityId path are byte-identical to before.

`packages/pipeline/tests/test_repetition_note.py` and `test_registry_coverage.py`:
- Added `import httpx` to each.
- Added `test_repetition_note_degrades_on_sanity_failure`: Convex returns 8 fully-linked rows, `groq_query.side_effect` is an `httpx.HTTPStatusError(401)`. Asserts 200, `note is None`, `avoid == []`, `sampleSize == 8` (preserved from Convex, not zeroed).
- Added `test_coverage_strip_degrades_on_sanity_failure`: Convex returns the 2-row fixture, `groq_query.side_effect` is the same 401 error. Asserts 200, both Convex rows survive (`data[0]["name"] == "Charity A"`), and every row's `cause`/`geo`/`signal` are `None`.

## RED/GREEN Verification

**RED (Task 1, commit `5bd02a7`):** Both new tests confirmed FAILING against the pre-fix `registry.py` — the `httpx.HTTPStatusError` propagated unhandled through the endpoint, verified via the full pytest traceback showing the raw exception surfacing from `registry.py:65` (`coverage_strip`) and the equivalent line in `repetition_note`, exactly matching the production diagnosis in the plan. Neither test passed pre-fix, so the plan's premise was confirmed correct before proceeding.

**GREEN (Task 2, commit `c211232`):** Both new tests pass. Full gate:
```
cd packages/pipeline && uv run pytest tests/ -q
712 passed, 38 skipped, 11 warnings in 20.39s
```
All pre-existing registry/repetition happy-path tests (`test_coverage_strip_joins_cause_geo_signal`, `test_coverage_strip_skips_missing_sanity_id`, and all five `test_repetition_note_*` tests) remain green and unmodified — the happy-path response shapes are byte-stable.

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed as scoped; only the 3 files listed in `files_modified` were touched (confirmed via `git diff --stat` across both commits).

## Reviewed-and-Left (intentionally out of scope)

Per the plan's `<design_principle>`, the following `groq_query` callers were reviewed and deliberately NOT touched:
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` (e.g. publish-manual and related operator-action endpoints)
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py`

These are operator-ACTION endpoints (not passive read-only decorations) where a loud failure on a bad Sanity token is arguably the correct behavior — the operator needs to know their publish action didn't go through, rather than have it silently degrade. The operational fix (rotating `SANITY_API_TOKEN`) resolves these separately and is out of scope for this task.

`groq_query`'s auth/token handling (`sanity_client.py`), `convex_client.py`, and the frontend were also untouched, per scope.

## Deploy Note

This fix has NOT been pushed or deployed. Per the plan's notes: pushing `master` to Railway auto-deploys the pipeline, which will ship this fix. The operator's separate `SANITY_API_TOKEN` rotation (already done per the plan's verified diagnosis) is what restores the *real* (non-degraded) chips/notes — this fix only guarantees the endpoints never 500 regardless of token validity going forward.

## Self-Check: PASSED

- FOUND: packages/pipeline/src/eisenbalm_pipeline/api/registry.py
- FOUND: packages/pipeline/tests/test_repetition_note.py
- FOUND: packages/pipeline/tests/test_registry_coverage.py
- FOUND commit 5bd02a7 (RED tests)
- FOUND commit c211232 (GREEN fix)
- Full pipeline test suite: 712 passed, 38 skipped, 0 failed
