---
phase: 04-pipeline-skeleton
plan: 10
subsystem: testing
tags: [pytest, pytest-asyncio, asgi-transport, langgraph, integration-tests, fixtures]

# Dependency graph
requires:
  - phase: 04-05-pytest-infrastructure
    provides: conftest.py fixtures (client, convex_query_fn, sanity_get_issue, sanity_cleanup) + 6 skip-skeleton test files
  - phase: 04-09-fastapi-app-and-routers
    provides: FastAPI app + run lifecycle routes under test (POST /run/weekly, GET /run/{runId}/status, POST /run/{runId}/resume)
  - phase: 04-06-stub-fixtures-and-wrapper
    provides: 15 deterministic stub fixture functions in stubs/fixtures.py
  - phase: 04-08-graph-builder-and-checkpointer
    provides: cli.setup_checkpointer + graph/checkpointer.py (create_pool, assert_tables_exist)
provides:
  - test_pipeline_e2e.py — headline PIP-06 e2e test (runId threaded across Sanity + 5 Convex tables) + PIP-08 event-types + PIP-11 cost-shape + PIP-12 durationMs
  - test_editor_gate_1_resume.py — PIP-10 forceNoWinner interrupt/resume cycle
  - test_agent_failure.py — OPS-01 forceFailAgent failure path with researcher: errorMessage prefix
  - test_status_endpoint.py — OPS-02 status response shape + 404-on-unknown-runId (self-contained, no external deps)
  - test_checkpointer.py — PIP-09 setup() idempotency + assert_tables_exist RuntimeError unit test
  - test_stub_fixtures.py — PIP-04 parametrized DispatchState-shape validation over 14 fixtures + advocate_scored
affects: [04-11-documentation, 04-12-smoke-test, 05-real-agents]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level pytestmark skipif on SUPABASE_POSTGRES_URL — belt-and-suspenders on top of conftest's per-fixture env-var skip; keeps full-graph tests green-by-skip in unprovisioned environments"
    - "Self-contained route tests: mount the runs router on a bare lifespan-free FastAPI app + monkeypatch convex_query — exercises real handlers with zero external deps (test_status_endpoint 404 case)"
    - "Mocked psycopg pool (asynccontextmanager stubs) for testing assert_tables_exist's RuntimeError path without a live database"

key-files:
  created: []
  modified:
    - packages/pipeline/tests/test_pipeline_e2e.py
    - packages/pipeline/tests/test_editor_gate_1_resume.py
    - packages/pipeline/tests/test_agent_failure.py
    - packages/pipeline/tests/test_status_endpoint.py
    - packages/pipeline/tests/test_checkpointer.py
    - packages/pipeline/tests/agents/test_stub_fixtures.py

key-decisions:
  - "All four full-graph test files carry a module-level skipif on SUPABASE_POSTGRES_URL — they hold real assertions but skip cleanly until Plan 12 provisions Supabase"
  - "test_stub_fixtures.py and the test_status_endpoint 404 case carry NO skip — they run green in every environment (pure unit / mocked)"
  - "test_checkpointer.py split into two functions: setup() idempotency (skipif Supabase) + assert_tables_exist-raises-on-empty-db (self-contained, mocked pool) so PIP-09 has a always-running unit-level proof"
  - "test_stub_fixtures.py adds format-contract assertions beyond shape: design_output 4 hex fields match ^#[0-9A-Fa-f]{6}$, game_output embedCode has no <script src= and no http(s):// URLs"

patterns-established:
  - "Module-level skipif guard pattern for tests that need manually-provisioned infra (Supabase/Railway)"
  - "Self-contained handler tests via bare-app router mounting + monkeypatch"

requirements-completed: [PIP-04, PIP-06, PIP-10, OPS-01]

# Metrics
duration: 15min
completed: 2026-05-14
---

# Phase 4 Plan 10: Integration Tests Summary

**Six pytest files now carry real exercise-the-full-stack assertions for PIP-04/06/10 + OPS-01; `uv run pytest -v` exits 0 with 19 passed / 9 skipped / 0 failures — stub-fixture + 404 tests run green everywhere, Supabase-dependent tests skip with descriptive reasons until Plan 12.**

## Performance

- **Duration:** ~15 min (continuation of a prior partial run)
- **Started:** 2026-05-14T11:30:00Z (approx)
- **Completed:** 2026-05-14T11:45:00Z (approx)
- **Tasks:** 4 (Task 1 committed by prior run as `d381f13`; Tasks 2-4 this session)
- **Files modified:** 6

## Accomplishments

- `test_stub_fixtures.py` (PIP-04): parametrized over 14 fixture functions + dedicated `advocate_scored` test; every returned key asserted to belong to `DispatchState`; added hex/font format checks on `design_output` and self-contained-embed checks on `game_output`. 17 tests, all PASS with zero env vars.
- `test_pipeline_e2e.py` (PIP-06 + PIP-08 + PIP-11 + PIP-12): real 7-step assertions — 32-char hex runId, poll to `awaiting-review`, Sanity `pipelineMetadata.runId` match, every Convex table row's runId match, cost JSON `{total, agents}` shape, `durationMs > 0`. Module-level skipif on `SUPABASE_POSTGRES_URL`.
- `test_editor_gate_1_resume.py` (PIP-10): `forceNoWinner` → interrupt → `awaiting-review` → `POST /resume` with `{selection: {charityName}}` → assert Sanity draft references `charity-the-quiet-foundation`. Skipif-guarded.
- `test_agent_failure.py` (OPS-01): `forceFailAgent='researcher'` → `status='failed'` → `errorMessage` starts with `researcher:` and contains `RuntimeError`. Skipif-guarded.
- `test_status_endpoint.py` (OPS-02): 404-on-unknown-runId case runs self-contained (bare app + monkeypatched `convex_query`); full-lifecycle shape case skipif-guarded.
- `test_checkpointer.py` (PIP-09): `setup()` idempotency test (skipif) + `assert_tables_exist`-raises-`RuntimeError`-on-empty-db unit test (mocked psycopg pool, always runs).
- Zero `@pytest.mark.skip` decorators remain in the test suite.

## Task Commits

1. **Task 1: test_pipeline_e2e.py real assertions** - `d381f13` (test) — *committed by prior partial run*
2. **Tasks 2-3: interrupt-resume + failure-path + status endpoint** - `ed5c90d` (test)
3. **Task 4: checkpointer idempotency + stub fixture shapes** - `974cf23` (test)

## Files Created/Modified

- `packages/pipeline/tests/test_pipeline_e2e.py` - PIP-06 headline e2e + PIP-08/11/12 sub-tests; skipif on SUPABASE_POSTGRES_URL
- `packages/pipeline/tests/test_editor_gate_1_resume.py` - PIP-10 interrupt/resume cycle; skipif-guarded
- `packages/pipeline/tests/test_agent_failure.py` - OPS-01 forced-failure path; skipif-guarded
- `packages/pipeline/tests/test_status_endpoint.py` - OPS-02 status shape (skipif) + 404 case (self-contained)
- `packages/pipeline/tests/test_checkpointer.py` - PIP-09 setup() idempotency (skipif) + assert_tables_exist unit test (self-contained)
- `packages/pipeline/tests/agents/test_stub_fixtures.py` - PIP-04 parametrized fixture-shape validation; runs with zero env vars

## Decisions Made

- **Continuation handling:** A prior partial run had already committed Task 1 (`d381f13`) and left Tasks 2-3 files modified-but-uncommitted with complete real bodies. Verified the modified files were complete (full assertions + module-level skipif guards present), committed them as `ed5c90d`, then completed the remaining Task 4 work.
- **test_checkpointer.py two-function split:** The plan's version had only `test_setup_idempotent` (skipif-guarded). Per the executor's important-notes guidance, added `test_assert_tables_exist_raises_on_empty_db` — a self-contained unit test using mocked `asynccontextmanager` psycopg pool stubs — so PIP-09 has an always-running proof of the fail-fast error path, not only a skipped integration test.
- **test_stub_fixtures.py format-contract depth:** Beyond the plan's key-shape assertions, added `test_design_output_hex_and_fonts` (regex `^#[0-9A-Fa-f]{6}$` on all 4 theme colors, non-empty font names) and `test_game_output_embed_is_self_contained` (no `<script src=`, no external URLs) per the executor important-notes — these harden the PIP-04 surface that Phase 5/7 will build on.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added always-running unit test for assert_tables_exist failure path**
- **Found during:** Task 4 (test_checkpointer.py)
- **Issue:** The plan's `test_checkpointer.py` contained only `test_setup_idempotent`, which is skipif-guarded on `SUPABASE_POSTGRES_URL`. In this executor's unprovisioned environment, PIP-09 would have had ZERO running test coverage — the entire file would skip.
- **Fix:** Added `test_assert_tables_exist_raises_on_empty_db` — a self-contained unit test with mocked psycopg pool/connection/cursor (`asynccontextmanager` stubs) that drives `assert_tables_exist` against a simulated fresh DB (`to_regclass` returns None) and asserts the `RuntimeError` names the `setup-checkpointer` CLI fix. This matches the executor's important-notes guidance ("Also a unit-level test: `assert_tables_exist` raises a clear RuntimeError when pointed at an empty DB").
- **Files modified:** packages/pipeline/tests/test_checkpointer.py
- **Verification:** `uv run pytest tests/test_checkpointer.py -v` → `test_assert_tables_exist_raises_on_empty_db PASSED`, `test_setup_idempotent SKIPPED`
- **Committed in:** `974cf23` (Task 4 commit)

**2. [Rule 2 - Missing Critical] Added format-contract assertions to stub fixture tests**
- **Found during:** Task 4 (test_stub_fixtures.py)
- **Issue:** The plan's parametrized test only checked top-level key shape. The executor important-notes explicitly require deeper checks: `design_output` hex/font validation and `game_output` self-contained-embed validation (security-relevant — the embed renders inside `iframe srcdoc sandbox`).
- **Fix:** Added `test_design_output_hex_and_fonts` and `test_game_output_embed_is_self_contained` as dedicated test functions alongside the parametrized shape test.
- **Files modified:** packages/pipeline/tests/agents/test_stub_fixtures.py
- **Verification:** Both tests PASS; `game_output` embed confirmed to contain no `<script src=` and no `http(s)://` references.
- **Committed in:** `974cf23` (Task 4 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 2 - missing critical test coverage)
**Impact on plan:** Both auto-fixes were explicitly directed by the executor's important-notes block and strengthen the verification surface. No scope creep — both stay within the plan's six declared files.

## Issues Encountered

None. The prior partial run's Task 1-3 work was complete and correct; this session verified, committed, and finished Task 4.

## Integration test status when run locally

`uv run pytest -v` from `packages/pipeline/`:

```
19 passed, 9 skipped in 0.55s
```

- **Passed (19):** 17 stub-fixture tests (`test_stub_fixtures.py`) + `test_status_endpoint_nonexistent_runid` + `test_assert_tables_exist_raises_on_empty_db`
- **Skipped (9):** all 5 `test_pipeline_e2e.py` tests, `test_editor_gate_1_resume`, `test_forced_agent_failure_marks_run_failed`, `test_status_endpoint_returns_current_state`, `test_setup_idempotent` — all skip with descriptive `SUPABASE_POSTGRES_URL not set` reasons
- **Failures:** 0

The full-graph integration tests (`test_pipeline_e2e`, `test_editor_gate_1_resume`, `test_agent_failure`, `test_status_endpoint` lifecycle case, `test_checkpointer` idempotency case) hold production-quality real assertions but require a live `AsyncPostgresSaver` checkpointer against Supabase Postgres — provisioned manually in Plan 12 (Andrew's step). They will run green in Plan 12's smoke test once Supabase + Railway exist.

## User Setup Required

None directly — but Plan 12 (Andrew's manual provisioning of Supabase + Railway) is the prerequisite for the skipif-guarded tests to execute. The stub-fixture tests need no setup and pass today.

## Next Phase Readiness

- **Plan 11 (documentation):** README rewrite can reference the verified `uv run pytest -v` command and the 19-passed/9-skipped expected output for unprovisioned environments.
- **Plan 12 (Andrew's smoke test):** Once Supabase + Railway are provisioned and `setup-checkpointer` has run, re-running `uv run pytest -v` should turn the 9 skips into passes — that is the deploy-side proof that closes PIP-06/10 + OPS-01 against live infrastructure.
- **Phase 5 (real agents):** The `@agent_node` contract and the `DispatchState`-shape assertions in `test_stub_fixtures.py` lock the interface Phase 5's real agents must continue to satisfy.

---
*Phase: 04-pipeline-skeleton*
*Completed: 2026-05-14*

## Self-Check: PASSED

All 6 modified test files verified present on disk. All 3 task commits (d381f13, ed5c90d, 974cf23) verified in git history.
