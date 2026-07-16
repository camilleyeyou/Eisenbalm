# Phase 45 — Deferred Items (out of scope, logged not fixed)

## `tests/lib/test_vercel_client.py` — missing `respx` module (pre-existing, unrelated to Plan 45-01)

- **Found during:** Plan 45-01 Task 3, running the full pipeline pytest suite to verify Wave-0
  scaffolding kept the suite green.
- **Symptom:** `python -m pytest` (no `--ignore`) fails collection with
  `ModuleNotFoundError: No module named 'respx'` in `tests/lib/test_vercel_client.py`, which
  aborts the whole run (`1 skipped, 1 error`) before any other test executes.
- **Root cause:** `respx>=0.21` is declared in `packages/pipeline/pyproject.toml`'s dependency
  list but is not installed in this environment's Python (`pip show respx` reports "not found").
  `test_vercel_client.py` was added in commit `f5a8542` (an unrelated prior quick task adding
  retry/backoff to `trigger_vercel_deploy`), predating this phase.
- **Scope decision:** Out of scope per CLAUDE.md's SCOPE BOUNDARY — this failure is not caused by
  any Plan 45-01 change and touches an unrelated module (`lib/vercel_client.py`). Not fixed here.
- **Verification workaround used for this plan:** `python -m pytest -q --ignore=tests/lib/test_vercel_client.py`
  confirms the rest of the pipeline suite is green: **575 passed, 40 skipped** (0 failed), plus the
  4 new Wave-0 skips from this plan's `test_revision_endpoints.py` (import-skip) and `test_budget.py`
  (3 skipif'd tests) already included in that count.
- **Suggested fix (future phase/session):** either add `respx` to the environment's installed
  packages (`pip install respx` / re-sync the venv against `pyproject.toml`) or, if `respx` is no
  longer desired, remove the dependency declaration and the test file together.
