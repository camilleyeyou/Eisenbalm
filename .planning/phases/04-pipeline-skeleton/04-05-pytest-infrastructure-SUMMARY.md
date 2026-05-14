---
phase: 04-pipeline-skeleton
plan: 05
subsystem: testing
tags: [pytest, pytest-asyncio, httpx, asgi-transport, conftest, test-skeleton, wave-0]
dependency_graph:
  requires:
    - phase: 04-pipeline-skeleton/01
      provides: "pyproject.toml [tool.pytest.ini_options] (asyncio_mode='auto', testpaths=['tests']) + dev-deps pytest>=8.3, pytest-asyncio>=0.24, respx>=0.21"
  provides:
    - "packages/pipeline/tests/ directory tree (tests/, tests/agents/)"
    - "conftest.py with shared async fixtures: client, convex_query_fn, sanity_cleanup, sanity_get_issue"
    - "6 skip-marked test file skeletons covering every Wave 0 requirement listed in 04-VALIDATION.md"
    - "Green test suite: uv run pytest -v from packages/pipeline/ collects 25 tests, all skipped, exits 0"
  affects:
    - "Unblocks Wave 1/2/3 (Plans 04-02 through 04-09) — every subsequent plan can run uv run pytest -x after every task commit without breakage"
    - "Plan 04-10 (integration tests) plugs into the existing test files — replaces @pytest.mark.skip decorators with real assertions, no restructuring needed"
tech_stack:
  added: []
  patterns:
    - "Defensive fixture skips: every fixture that depends on real infra (Supabase / Convex / Sanity / FastAPI app) calls pytest.skip(...) on missing prerequisites instead of raising — so pytest stays green from day one"
    - "ASGITransport in-process client (research §10): httpx.AsyncClient(transport=ASGITransport(app=app)) avoids Railway round-trip; lazy import of eisenbalm_pipeline.api.main inside the fixture body so the test suite collects even before Plan 09 wires the app"
    - "Skip-decorator scaffolding: every test ships with @pytest.mark.skip(reason='Pending Plan 04-10: ...') + a docstring naming the requirement IDs it covers — Plan 10 lifts the decorators in one commit"
    - "Requirement-ID-as-docstring convention: grep -rn 'PIP-0X' tests/ surfaces which test file owns a given req"
key_files:
  created:
    - "packages/pipeline/tests/__init__.py"
    - "packages/pipeline/tests/agents/__init__.py"
    - "packages/pipeline/tests/conftest.py"
    - "packages/pipeline/tests/test_pipeline_e2e.py"
    - "packages/pipeline/tests/test_editor_gate_1_resume.py"
    - "packages/pipeline/tests/test_agent_failure.py"
    - "packages/pipeline/tests/test_status_endpoint.py"
    - "packages/pipeline/tests/test_checkpointer.py"
    - "packages/pipeline/tests/agents/test_stub_fixtures.py"
  modified: []
decisions:
  - "Adopted research §10's ASGITransport pattern verbatim — Plan 10 will use the in-process client for the entire integration suite (no localhost or Railway round-trip)"
  - "Six required env vars enforced as a single tuple (REQUIRED_ENV_VARS) — first-missing wins the skip reason for fast diagnosis"
  - "Editor counted as TWO agents in test_stub_fixtures.py parametrize list (editor_gate_1, editor_final) — matches CONTEXT D-05's split into gate 1 + final; produces 15 parametrized cases (14 agents + editor split)"
  - "test_pipeline_e2e.py split into 5 separate test functions instead of one mega-test — each test owns one assertion family (returns_runId, runId_threaded, all_event_types, cost_shape, duration_ms) for granular failure signals"
  - "Parametrized stub fixture test deliberately KEPT in Plan 05 (not deferred to Plan 10) — the AGENT_NAMES list is the contract that Plan 06 (stub fixtures) will write fixtures against, so listing them here freezes the inventory"
requirements_completed: []
metrics:
  duration: "3min"
  completed: "2026-05-13"
---

# Phase 04 Plan 05: Pytest Infrastructure Summary

**Wave 0 test scaffolding: conftest.py with in-process ASGI client + Convex/Sanity helpers, plus 6 skip-marked test files (25 cases) so `uv run pytest -v` exits 0 from day one of Wave 1.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-13T19:38:46Z (PLAN_START_EPOCH 1778725926)
- **Completed:** 2026-05-13T19:42:09Z
- **Tasks:** 2
- **Files modified:** 0 (9 created)

## Accomplishments

- **`tests/conftest.py`** ships four async fixtures (`client`, `convex_query_fn`, `sanity_cleanup`, `sanity_get_issue`) plus the `anyio_backend` selector. Each fixture defensively skips when its required env vars are unset or when its target module (`eisenbalm_pipeline.api.main`) isn't yet importable — so the suite stays green across every Wave 1-3 commit, regardless of which downstream plan has landed.
- **Six test file skeletons** cover the full Wave 0 requirement list from 04-VALIDATION.md: e2e flow (5 cases), interrupt/resume cycle (1 case), agent failure path (1 case), status endpoint (2 cases), checkpointer idempotency (1 case), and parametrized stub fixture shape (15 cases). Every test function has a `@pytest.mark.skip(reason="Pending Plan 04-10: ...")` decorator and a docstring naming the requirement IDs it covers.
- **25 tests collected, 25 skipped, 0 failed, exit 0** — verified by `cd packages/pipeline && uv run pytest -v` after Task 2. Matches the plan's predicted count exactly.

## Task Commits

Each task was committed atomically with `--no-verify` (parallel-executor mode):

1. **Task 1: Create conftest.py + tests package init files** - `52ff3e8` (test)
2. **Task 2: Scaffold 6 skip-marked test files covering Wave 0 requirements** - `9ce72e2` (test)

## Files Created

- `packages/pipeline/tests/__init__.py` - Empty, marks tests/ as a package for pytest discovery
- `packages/pipeline/tests/agents/__init__.py` - Empty, marks tests/agents/ as a sub-package
- `packages/pipeline/tests/conftest.py` - Shared fixtures: client (ASGITransport), convex_query_fn (raw httpx Convex), sanity_cleanup (delete by issue id), sanity_get_issue (GET by doc id), anyio_backend, REQUIRED_ENV_VARS tuple
- `packages/pipeline/tests/test_pipeline_e2e.py` - 5 skip-marked tests for PIP-02/05/06/07/08/11/12 (the headline e2e flow)
- `packages/pipeline/tests/test_editor_gate_1_resume.py` - 1 skip-marked test for PIP-10 (interrupt/resume)
- `packages/pipeline/tests/test_agent_failure.py` - 1 skip-marked test for OPS-01 (forced agent failure → run status='failed')
- `packages/pipeline/tests/test_status_endpoint.py` - 2 skip-marked tests for OPS-02 (status shape, unknown-runId behavior)
- `packages/pipeline/tests/test_checkpointer.py` - 1 skip-marked test for PIP-09 (AsyncPostgresSaver.setup() idempotent)
- `packages/pipeline/tests/agents/test_stub_fixtures.py` - 15 parametrized skip-marked cases for PIP-04 (one per agent: calibrator..publisher, editor split into gate_1 + final)

## Decisions Made

See `decisions` block in frontmatter. Highlights:

- **Defensive skip on missing env vars** — first-missing wins the skip reason. Engineers running pytest locally without a fully provisioned Supabase/Convex/Sanity stack see clean skips, not crashes.
- **ASGITransport over httpx.URL("http://localhost:...")** — the in-process pattern from research §10 is faster, eliminates port juggling, and works in CI without a separate uvicorn process.
- **Editor counted twice in PIP-04 parametrize list** (`editor_gate_1`, `editor_final`) — matches CONTEXT D-05 which splits editor into gate 1 (interrupt) + final (QA review). Yields 15 cases.
- **5 separate test functions in `test_pipeline_e2e.py`** instead of one mega-test — granular failure signals for Plan 10. Test names map directly to requirement IDs.

## Deviations from Plan

None — plan executed exactly as written. The conftest.py and all 6 test files match the plan's verbatim reference code line-for-line (minor docstring wording aside).

## Issues Encountered

None.

## Validation Evidence

```
$ cd packages/pipeline && uv run pytest -v
============================= test session starts ==============================
platform darwin -- Python 3.11.11, pytest-8.4.2, pluggy-1.6.0
configfile: pyproject.toml
testpaths: tests
plugins: langsmith-0.8.4, asyncio-0.26.0, respx-0.23.1, anyio-4.13.0
asyncio: mode=Mode.AUTO
collected 25 items

tests/agents/test_stub_fixtures.py::...[calibrator] SKIPPED         [  4%]
tests/agents/test_stub_fixtures.py::...[scout] SKIPPED              [  8%]
tests/agents/test_stub_fixtures.py::...[advocate] SKIPPED           [ 12%]
tests/agents/test_stub_fixtures.py::...[editor_gate_1] SKIPPED      [ 16%]
tests/agents/test_stub_fixtures.py::...[researcher] SKIPPED         [ 20%]
tests/agents/test_stub_fixtures.py::...[origin_story] SKIPPED       [ 24%]
tests/agents/test_stub_fixtures.py::...[problem] SKIPPED            [ 28%]
tests/agents/test_stub_fixtures.py::...[founder_bio] SKIPPED        [ 32%]
tests/agents/test_stub_fixtures.py::...[case_study] SKIPPED         [ 36%]
tests/agents/test_stub_fixtures.py::...[game] SKIPPED               [ 40%]
tests/agents/test_stub_fixtures.py::...[bonus] SKIPPED              [ 44%]
tests/agents/test_stub_fixtures.py::...[design] SKIPPED             [ 48%]
tests/agents/test_stub_fixtures.py::...[qa] SKIPPED                 [ 52%]
tests/agents/test_stub_fixtures.py::...[editor_final] SKIPPED       [ 56%]
tests/agents/test_stub_fixtures.py::...[publisher] SKIPPED          [ 60%]
tests/test_agent_failure.py::test_forced_agent_failure_marks_run_failed SKIPPED [ 64%]
tests/test_checkpointer.py::test_setup_idempotent SKIPPED           [ 68%]
tests/test_editor_gate_1_resume.py::test_editor_gate_1_interrupt_and_resume SKIPPED [ 72%]
tests/test_pipeline_e2e.py::test_returns_runId SKIPPED              [ 76%]
tests/test_pipeline_e2e.py::test_pipeline_e2e_runId_threaded_to_all_datastores SKIPPED [ 80%]
tests/test_pipeline_e2e.py::test_all_event_types_emitted SKIPPED    [ 84%]
tests/test_pipeline_e2e.py::test_cost_shape SKIPPED                 [ 88%]
tests/test_pipeline_e2e.py::test_duration_ms SKIPPED                [ 92%]
tests/test_status_endpoint.py::test_status_endpoint_returns_current_state SKIPPED [ 96%]
tests/test_status_endpoint.py::test_status_endpoint_nonexistent_runid SKIPPED [100%]

============================= 25 skipped in 0.04s ==============================

$ echo $?
0
```

- `grep -F "ASGITransport" packages/pipeline/tests/conftest.py` → 3 hits (import, docstring mention, fixture body). ✓
- Each test file has ≥1 `@pytest.mark.skip` decorator (test_pipeline_e2e=5, test_status_endpoint=2, others=1 each). ✓
- pyproject.toml `[tool.pytest.ini_options]` block is intact from Plan 04-01 (asyncio_mode='auto', testpaths=['tests']) — not modified. ✓

## Forward Link to Plan 10

Plan 04-10 (integration tests) **will**:

1. Remove every `@pytest.mark.skip(reason="Pending Plan 04-10: ...")` decorator from the 6 test files
2. Replace each `pass` body with real assertions per the contract sketched in each test's docstring
3. Fill in the parametrized stub fixture import in `tests/agents/test_stub_fixtures.py` once Plan 06 lands the fixture functions
4. NOT modify `tests/conftest.py` (fixtures here are the final shape — Plan 10 consumes them as-is)

Plan 10 declares the requirement IDs (PIP-04, PIP-06, PIP-10, OPS-01, etc.) in its frontmatter; Plan 05 declares no requirements (pure scaffolding).

## Self-Check: PASSED

- All 9 files created (verified via `git log --oneline -2` showing 52ff3e8 + 9ce72e2).
- Both commits exist in `git log --oneline`.
- `uv run pytest -v` exits 0 with 25 skipped tests.
- ASGITransport present in conftest.py (3 hits).
- Each of the 6 test files contains ≥1 `@pytest.mark.skip` decorator.

---
*Phase: 04-pipeline-skeleton*
*Completed: 2026-05-13*
