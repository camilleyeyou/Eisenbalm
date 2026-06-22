# Phase 22 — Deferred Items

Out-of-scope discoveries logged during execution (not fixed in-plan).

## DEF-22-01: `tests/api/test_clerk_auth.py` async-fixture flake under `pytest-randomly`

- **Found during:** Plan 22-03 Task 3 full-suite verification.
- **Symptom:** A full `uv run pytest -q` run (default random ordering via `pytest-randomly`) can crash inside the `auth_client` async fixture in `tests/api/test_clerk_auth.py` (event-loop/fixture-teardown interaction), aborting collection of subsequent tests.
- **Scope:** Pre-existing and unrelated to Plan 22-03. Reproduces independently of `graph/state.py` / `config_loader.py` changes; the file passes cleanly in isolation (`pytest tests/api/test_clerk_auth.py` → 4 passed) and the entire suite is green under deterministic ordering (`pytest -q -p no:randomly` → 267 passed / 0 failed). It is an ordering/test-isolation artifact in the Clerk auth fixture, not a logic defect.
- **Recommendation:** Harden the `auth_client` fixture's event-loop lifecycle (or scope) in a dedicated quick task; not blocking config-externalization.

## DEF-22-02: `tests/agents/test_calibrator.py::test_voice_constants` stale signature

- **Found during:** Plan 22-04 Task 3 full-suite verification.
- **Symptom:** `test_voice_constants` calls `_build_messages(issue_number=..., previous_bonus_types=..., chosen_bonus_type=...)` but the current `calibrator._build_messages()` signature requires an additional keyword-only `state` argument → `TypeError: _build_messages() missing 1 required keyword-only argument: 'state'`.
- **Scope:** Pre-existing and unrelated to Plan 22-04 — `git diff f264f1e..HEAD` for this plan touched zero calibrator files (only `scripts/seed_phase22.py`, `scripts/verify_prompt_seed.py`, `tests/lib/test_prompt_seed.py`). The `state` kwarg was added to `_build_messages` in an earlier phase (narrator-awareness, Phase 16) without updating this one test. The full suite is otherwise green (`279 passed, 1 failed`).
- **Recommendation:** Update the test to pass a minimal `state` dict (mirroring the other calibrator tests) in a dedicated quick task; not blocking config-externalization.
