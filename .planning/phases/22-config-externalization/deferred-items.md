# Phase 22 — Deferred Items

Out-of-scope discoveries logged during execution (not fixed in-plan).

## DEF-22-01: `tests/api/test_clerk_auth.py` async-fixture flake under `pytest-randomly`

- **Found during:** Plan 22-03 Task 3 full-suite verification.
- **Symptom:** A full `uv run pytest -q` run (default random ordering via `pytest-randomly`) can crash inside the `auth_client` async fixture in `tests/api/test_clerk_auth.py` (event-loop/fixture-teardown interaction), aborting collection of subsequent tests.
- **Scope:** Pre-existing and unrelated to Plan 22-03. Reproduces independently of `graph/state.py` / `config_loader.py` changes; the file passes cleanly in isolation (`pytest tests/api/test_clerk_auth.py` → 4 passed) and the entire suite is green under deterministic ordering (`pytest -q -p no:randomly` → 267 passed / 0 failed). It is an ordering/test-isolation artifact in the Clerk auth fixture, not a logic defect.
- **Recommendation:** Harden the `auth_client` fixture's event-loop lifecycle (or scope) in a dedicated quick task; not blocking config-externalization.
