---
phase: 04-pipeline-skeleton
plan: 05
type: execute
wave: 1
depends_on:
  - "04-01"
files_modified:
  - packages/pipeline/tests/conftest.py
  - packages/pipeline/tests/__init__.py
  - packages/pipeline/tests/agents/__init__.py
  - packages/pipeline/tests/test_pipeline_e2e.py
  - packages/pipeline/tests/test_editor_gate_1_resume.py
  - packages/pipeline/tests/test_agent_failure.py
  - packages/pipeline/tests/test_status_endpoint.py
  - packages/pipeline/tests/test_checkpointer.py
  - packages/pipeline/tests/agents/test_stub_fixtures.py
autonomous: true
requirements: []
must_haves:
  truths:
    - "`uv run pytest -v` exits 0 from day one (placeholder tests use `pytest.mark.skip` until Wave 2/3 lands real implementations)"
    - "`conftest.py` exports the `client` fixture (in-process ASGITransport pointing at `eisenbalm_pipeline.api.main:app` — wrapped in skip if module not yet importable) AND the `convex_query_fn` helper AND cleanup helpers"
    - "Test file scaffolds exist for every Wave 0 gap in VALIDATION.md: test_pipeline_e2e.py, test_editor_gate_1_resume.py, test_agent_failure.py, test_status_endpoint.py, test_checkpointer.py, agents/test_stub_fixtures.py"
    - "pyproject.toml pytest config is already set by Plan 01 (`asyncio_mode = 'auto'`, `testpaths = ['tests']`)"
    - "No real assertions yet — each test file has a `@pytest.mark.skip(reason='Pending Plan NN')` skeleton that Plan 10 replaces with the actual assertions"
  artifacts:
    - path: "packages/pipeline/tests/conftest.py"
      provides: "Shared fixtures: client, convex_query_fn, env loader, cleanup helpers"
      contains: "ASGITransport"
    - path: "packages/pipeline/tests/test_pipeline_e2e.py"
      provides: "Placeholder for PIP-02/05/06/07/08/11/12 e2e test"
      contains: "@pytest.mark.skip"
    - path: "packages/pipeline/tests/test_editor_gate_1_resume.py"
      provides: "Placeholder for PIP-10 interrupt/resume test"
      contains: "@pytest.mark.skip"
    - path: "packages/pipeline/tests/test_agent_failure.py"
      provides: "Placeholder for OPS-01 failure path test"
      contains: "@pytest.mark.skip"
    - path: "packages/pipeline/tests/test_status_endpoint.py"
      provides: "Placeholder for OPS-02 status endpoint test"
      contains: "@pytest.mark.skip"
    - path: "packages/pipeline/tests/test_checkpointer.py"
      provides: "Placeholder for PIP-09 checkpointer setup test"
      contains: "@pytest.mark.skip"
    - path: "packages/pipeline/tests/agents/test_stub_fixtures.py"
      provides: "Placeholder for PIP-04 parametrized per-agent TypedDict shape test"
      contains: "@pytest.mark.skip"
  key_links:
    - from: "tests/conftest.py:client fixture"
      to: "eisenbalm_pipeline.api.main:app (Plan 09)"
      via: "AsyncClient(transport=ASGITransport(app=app))"
      pattern: "ASGITransport"
    - from: "Plan 10 (integration tests)"
      to: "Test file scaffolds laid here"
      via: "Plan 10 replaces the @pytest.mark.skip decorators with real assertions"
      pattern: "pytest.mark.skip"
---

<objective>
Land the Wave 0 test infrastructure listed in `04-VALIDATION.md` so subsequent plans land green. This plan creates `conftest.py` with shared fixtures (the ASGITransport in-process client, env loader, Convex query helper, Sanity cleanup helper) plus skeleton test files for every requirement that needs a test (per VALIDATION §"Wave 0 Requirements"). Each test file ships with `@pytest.mark.skip(reason='Pending Plan NN')` decorators so `uv run pytest -v` exits 0 immediately. Plan 10 replaces the skip decorators with real assertions once Wave 3 wires the FastAPI app.

Rationale: VALIDATION §"Sampling Rate" requires `uv run pytest -x` to pass after every task commit during Waves 1-3. Without Wave 0 infrastructure, every subsequent plan would either (a) introduce broken tests that fail every commit, or (b) skip testing entirely. Plan 05 ensures the test surface is green from day one and Plan 10 fills in the assertions when there's something to assert against.

Purpose: Operational health — Nyquist sampling cadence holds from Wave 1 onward.
Output: A passing test suite (everything skipped) + the fixtures and structure Plan 10 needs.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-pipeline-skeleton/04-CONTEXT.md
@.planning/phases/04-pipeline-skeleton/04-RESEARCH.md
@.planning/phases/04-pipeline-skeleton/04-VALIDATION.md
@packages/pipeline/pyproject.toml
</context>

<interfaces>
<!-- pytest-asyncio + httpx ASGITransport pattern from research §10 verbatim. -->

```python
# tests/conftest.py reference (research §10):
import os
import pytest
from httpx import AsyncClient, ASGITransport


@pytest.fixture
def anyio_backend():
    return 'asyncio'


@pytest.fixture
async def client():
    """In-process FastAPI test client via ASGITransport.

    Skips if SUPABASE_POSTGRES_URL is not set (manual env needed for lifespan).
    """
    if not os.getenv('SUPABASE_POSTGRES_URL'):
        pytest.skip('SUPABASE_POSTGRES_URL not set; integration test skipped')
    from eisenbalm_pipeline.api.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url='http://test',
        headers={'X-Pipeline-Trigger-Secret': os.environ['PIPELINE_TRIGGER_SECRET']},
    ) as c:
        yield c
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Create conftest.py + tests/__init__.py + tests/agents/__init__.py</name>
  <files>packages/pipeline/tests/__init__.py, packages/pipeline/tests/agents/__init__.py, packages/pipeline/tests/conftest.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §10 "pytest + pytest-asyncio + httpx integration test pattern" — full conftest.py reference (copy verbatim, ADAPT skip conditions)
    - .planning/phases/04-pipeline-skeleton/04-VALIDATION.md §"Wave 0 Requirements" (`conftest.py` must export client fixture, env loading helper, Convex cleanup helper, Sanity cleanup helper)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Sanity cleanup" snippet at the end of §10 (mutation `delete` shape for cleanup)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-35 (PIP-06 test polls /run/{runId}/status; expects terminal status 'awaiting-review')
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-31 (env vars list — required for integration tests)
  </read_first>
  <action>
    **Step A — Create empty `__init__.py` files** so pytest discovers the tests/ and tests/agents/ directories as packages:

    `packages/pipeline/tests/__init__.py`:
    ```python
    ```

    `packages/pipeline/tests/agents/__init__.py`:
    ```python
    ```

    (Both empty files — required for pytest auto-discovery in src/ layout.)

    **Step B — Write `packages/pipeline/tests/conftest.py`**:

    ```python
    """Shared pytest fixtures for the Eisenbalm pipeline test suite.

    Source: 04-RESEARCH.md §10 + 04-VALIDATION.md §Wave 0 Requirements.
    """
    from __future__ import annotations
    import os
    from typing import Any, Awaitable, Callable, Optional

    import pytest
    from httpx import AsyncClient, ASGITransport


    # ── Env helpers ───────────────────────────────────────────────────────────

    REQUIRED_ENV_VARS = (
        "SUPABASE_POSTGRES_URL",
        "NEXT_PUBLIC_CONVEX_URL",
        "CONVEX_DEPLOY_KEY",
        "NEXT_PUBLIC_SANITY_PROJECT_ID",
        "SANITY_API_TOKEN",
        "PIPELINE_TRIGGER_SECRET",
    )


    def _missing_env() -> Optional[str]:
        """Return the first missing required env var, or None if all set."""
        for name in REQUIRED_ENV_VARS:
            if not os.getenv(name):
                return name
        return None


    @pytest.fixture
    def anyio_backend() -> str:
        return "asyncio"


    # ── HTTP client fixtures ──────────────────────────────────────────────────

    @pytest.fixture
    async def client():
        """In-process FastAPI test client. Skips if any required env var is unset
        or if eisenbalm_pipeline.api.main is not yet importable (pre-Plan 09).

        Once Plan 09 lands FastAPI, this fixture activates and runs the real app
        in-process via ASGITransport (research §10 — fast, no Railway round-trip).
        """
        missing = _missing_env()
        if missing:
            pytest.skip(f"Required env var not set: {missing}")
        try:
            from eisenbalm_pipeline.api.main import app  # noqa: WPS433
        except ImportError as e:
            pytest.skip(f"FastAPI app not yet wired (Plan 09 pending): {e}")

        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport,
            base_url="http://test",
            headers={
                "X-Pipeline-Trigger-Secret": os.environ["PIPELINE_TRIGGER_SECRET"],
            },
        ) as c:
            yield c


    @pytest.fixture
    async def convex_query_fn() -> Any:
        """Async helper for direct Convex query assertions.

        Usage:
            rows = await convex_query_fn('pipelineRuns:byRunId', {'runId': '...'})
        """
        missing = _missing_env()
        if missing:
            pytest.skip(f"Required env var not set: {missing}")

        async with AsyncClient(
            base_url=os.environ["NEXT_PUBLIC_CONVEX_URL"].rstrip("/"),
        ) as http:

            async def _q(path: str, args: dict) -> Any:
                r = await http.post(
                    "/api/query",
                    json={"path": path, "args": args, "format": "json"},
                    headers={
                        "Authorization": f"Convex {os.environ['CONVEX_DEPLOY_KEY']}",
                    },
                )
                r.raise_for_status()
                body = r.json()
                if body.get("status") != "success":
                    raise RuntimeError(
                        f"Convex query failed: {path} → {body.get('errorMessage')}"
                    )
                return body.get("value")

            yield _q


    # ── Cleanup helpers ───────────────────────────────────────────────────────

    @pytest.fixture
    async def sanity_cleanup() -> Callable[[int], Awaitable[None]]:
        """Returns an async function `await sanity_cleanup(issue_number)`
        that deletes the Sanity draft for `issue-{issue_number}`.

        Used by integration tests for teardown. Tolerant of "not found"
        responses (mutation returns 200 with no error for missing docs).
        """
        missing = _missing_env()
        if missing:
            pytest.skip(f"Required env var not set: {missing}")

        project = os.environ["NEXT_PUBLIC_SANITY_PROJECT_ID"]
        dataset = os.environ.get("NEXT_PUBLIC_SANITY_DATASET", "production")
        token = os.environ["SANITY_API_TOKEN"]
        api_version = "v2024-01-01"

        async with AsyncClient(
            base_url=f"https://{project}.api.sanity.io",
            timeout=15.0,
        ) as http:

            async def _delete(issue_number: int) -> None:
                issue_id = f"issue-{issue_number}"
                await http.post(
                    f"/{api_version}/data/mutate/{dataset}",
                    json={"mutations": [{"delete": {"id": issue_id}}]},
                    headers={"Authorization": f"Bearer {token}"},
                )

            yield _delete


    # ── Sanity GET helper (for asserting pipelineMetadata.runId) ──────────────

    @pytest.fixture
    async def sanity_get_issue() -> Callable[[int], Awaitable[Optional[dict]]]:
        """Returns `await sanity_get_issue(issue_number)` -> draft doc dict (or None).

        Uses the Sanity 'doc/{dataset}/{id}' endpoint (read-only).
        """
        missing = _missing_env()
        if missing:
            pytest.skip(f"Required env var not set: {missing}")

        project = os.environ["NEXT_PUBLIC_SANITY_PROJECT_ID"]
        dataset = os.environ.get("NEXT_PUBLIC_SANITY_DATASET", "production")
        token = os.environ["SANITY_API_TOKEN"]
        api_version = "v2024-01-01"

        async with AsyncClient(
            base_url=f"https://{project}.api.sanity.io",
            timeout=15.0,
        ) as http:

            async def _get(issue_number: int) -> Optional[dict]:
                issue_id = f"issue-{issue_number}"
                r = await http.get(
                    f"/{api_version}/data/doc/{dataset}/{issue_id}",
                    headers={"Authorization": f"Bearer {token}"},
                )
                r.raise_for_status()
                body = r.json()
                docs = body.get("documents") or []
                return docs[0] if docs else None

            yield _get
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest --collect-only -q 2>&1 | head -5 || true && uv run python -c "import sys; sys.path.insert(0, 'tests'); import conftest; print('conftest imports OK')"</automated>
  </verify>
  <done>
    - `packages/pipeline/tests/__init__.py` and `packages/pipeline/tests/agents/__init__.py` exist (empty)
    - `packages/pipeline/tests/conftest.py` exists and imports without error
    - Exports fixtures: `client`, `convex_query_fn`, `sanity_cleanup`, `sanity_get_issue`, plus `anyio_backend`
    - Every fixture handles missing env vars by calling `pytest.skip(...)` — no hard ImportError on `uv run pytest`
  </done>
</task>

<task type="auto">
  <name>Task 2: Create test file skeletons (6 files) with pytest.mark.skip placeholders</name>
  <files>packages/pipeline/tests/test_pipeline_e2e.py, packages/pipeline/tests/test_editor_gate_1_resume.py, packages/pipeline/tests/test_agent_failure.py, packages/pipeline/tests/test_status_endpoint.py, packages/pipeline/tests/test_checkpointer.py, packages/pipeline/tests/agents/test_stub_fixtures.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-VALIDATION.md §"Wave 0 Requirements" (full list of test files required)
    - .planning/phases/04-pipeline-skeleton/04-VALIDATION.md §"Per-Task Verification Map" (which req IDs each test file covers)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-35 (PIP-06 e2e flow), D-36 (PIP-10 interrupt/resume), D-37 (OPS-01 failure path)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Example 4" lines ~999-1064 (canonical e2e test shape)
  </read_first>
  <action>
    Write each test file with a skip decorator + a docstring describing what it WILL assert once Plan 10 fills it in. Each file imports the relevant conftest fixtures so the skeleton compiles.

    **`packages/pipeline/tests/test_pipeline_e2e.py`** (covers PIP-02, PIP-05, PIP-06, PIP-07, PIP-08, PIP-11, PIP-12):

    ```python
    """End-to-end pipeline test (PIP-02, PIP-05, PIP-06, PIP-07, PIP-08, PIP-11, PIP-12).

    Plan 10 will fill in:
    - POST /run/weekly with {issueNumber: 999000+random}
    - Poll GET /run/{runId}/status until terminal ('awaiting-review' for stub)
    - Assert Sanity issue-{n}.pipelineMetadata.runId == runId
    - Assert every Convex table row has runId == runId
    - Assert pipelineRuns.cost is a valid JSON string with shape {total, agents}
    - Assert pipelineRuns.durationMs > 0
    - Cleanup the Sanity draft

    Source: 04-CONTEXT.md D-35, 04-RESEARCH.md "Example 4", 04-VALIDATION.md.
    """
    from __future__ import annotations
    import pytest


    @pytest.mark.skip(reason="Pending Plan 04-10: integration test bodies")
    async def test_returns_runId(client):
        pass


    @pytest.mark.skip(reason="Pending Plan 04-10: integration test bodies")
    async def test_pipeline_e2e_runId_threaded_to_all_datastores(
        client, convex_query_fn, sanity_get_issue, sanity_cleanup
    ):
        pass


    @pytest.mark.skip(reason="Pending Plan 04-10: integration test bodies")
    async def test_all_event_types_emitted(client, convex_query_fn, sanity_cleanup):
        pass


    @pytest.mark.skip(reason="Pending Plan 04-10: integration test bodies")
    async def test_cost_shape(client, convex_query_fn, sanity_cleanup):
        pass


    @pytest.mark.skip(reason="Pending Plan 04-10: integration test bodies")
    async def test_duration_ms(client, convex_query_fn, sanity_cleanup):
        pass
    ```

    **`packages/pipeline/tests/test_editor_gate_1_resume.py`** (covers PIP-10):

    ```python
    """Editor gate 1 interrupt/resume cycle (PIP-10).

    Plan 10 will fill in:
    - POST /run/weekly {issueNumber: 999000+random, forceNoWinner: true}
    - Poll status until 'awaiting-review'
    - POST /run/{runId}/resume {selection: {charityName: 'The Quiet Foundation'}}
    - Poll status until terminal 'awaiting-review' (final, post-Publisher)
    - Assert Sanity draft has the resumed charity reference

    Source: 04-CONTEXT.md D-36 + D-13 + 04-RESEARCH.md §2 + "Example 1".
    """
    from __future__ import annotations
    import pytest


    @pytest.mark.skip(reason="Pending Plan 04-10: interrupt/resume test body")
    async def test_editor_gate_1_interrupt_and_resume(
        client, convex_query_fn, sanity_get_issue, sanity_cleanup
    ):
        pass
    ```

    **`packages/pipeline/tests/test_agent_failure.py`** (covers OPS-01):

    ```python
    """Agent failure path (OPS-01).

    Plan 10 will fill in:
    - POST /run/weekly {forceFailAgent: 'researcher'}
    - Poll status until 'failed'
    - Assert pipelineRuns.errorMessage starts with 'researcher:'
    - Assert pipelineRuns.completedAt populated

    Source: 04-CONTEXT.md D-37 + D-27.
    """
    from __future__ import annotations
    import pytest


    @pytest.mark.skip(reason="Pending Plan 04-10: failure path test body")
    async def test_forced_agent_failure_marks_run_failed(client, convex_query_fn):
        pass
    ```

    **`packages/pipeline/tests/test_status_endpoint.py`** (covers OPS-02):

    ```python
    """GET /run/{runId}/status (OPS-02).

    Plan 10 will fill in:
    - Trigger a run; immediately GET /run/{runId}/status
    - Assert response shape: {runId, status, startedAt, completedAt?, durationMs?, errorMessage?, agentId?, lastEvent?}
    - GET against a nonexistent runId should return a documented response shape (404 or null payload — planner decides; matches CONTEXT D-07)

    Source: 04-CONTEXT.md D-07 + D-34.
    """
    from __future__ import annotations
    import pytest


    @pytest.mark.skip(reason="Pending Plan 04-10: status endpoint test body")
    async def test_status_endpoint_returns_current_state(client, convex_query_fn):
        pass


    @pytest.mark.skip(reason="Pending Plan 04-10: status endpoint test body")
    async def test_status_endpoint_nonexistent_runid(client):
        pass
    ```

    **`packages/pipeline/tests/test_checkpointer.py`** (covers PIP-09):

    ```python
    """AsyncPostgresSaver checkpointer (PIP-09).

    Plan 10 will fill in:
    - Call `setup_checkpointer()` twice; both succeed (idempotent — CONTEXT D-12 + research Pitfall 3)
    - Assert the four tables exist in Supabase Postgres: checkpoints, checkpoint_writes, checkpoint_blobs, checkpoint_migrations
    - Optionally: run a tiny graph through to verify checkpoint write/read round-trip

    NOTE: Requires SUPABASE_POSTGRES_URL set to the session pooler (port 5432) per
    research §7. Will fail with InvalidSqlStatementName if pointed at port 6543
    transaction pooler — that's the canonical "you used the wrong pooler" signal.

    Source: 04-CONTEXT.md D-11 + D-12 + 04-RESEARCH.md §1 + Pitfall 1 + Pitfall 3.
    """
    from __future__ import annotations
    import pytest


    @pytest.mark.skip(reason="Pending Plan 04-10: checkpointer test body")
    async def test_setup_idempotent():
        pass
    ```

    **`packages/pipeline/tests/agents/test_stub_fixtures.py`** (covers PIP-04):

    ```python
    """Stub fixture TypedDict shape validation (PIP-04).

    Plan 10 will parametrize over the 14 agent fixtures and assert each
    returns a partial DispatchState with the required keys for its agent.

    Source: 04-CONTEXT.md D-16, 04-VALIDATION.md, docs/CLAUDE_CODE_BRIEF.md
    §"The nine-agent pipeline".

    The 14 agents (CONTEXT D-05):
    calibrator, scout, advocate, editor (gate 1 + final), researcher,
    origin_story, problem, founder_bio, case_study, game, bonus, design,
    qa, publisher.
    """
    from __future__ import annotations
    import pytest


    AGENT_NAMES = [
        "calibrator", "scout", "advocate", "editor_gate_1", "researcher",
        "origin_story", "problem", "founder_bio", "case_study",
        "game", "bonus", "design", "qa", "editor_final", "publisher",
    ]


    @pytest.mark.skip(reason="Pending Plan 04-10: parametrize over stub fixtures")
    @pytest.mark.parametrize("agent_name", AGENT_NAMES)
    def test_stub_fixture_returns_valid_dispatch_state_shape(agent_name):
        pass
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest -v 2>&1 | tail -5 && uv run pytest -v 2>&1 | grep -E "(passed|skipped|error)" | head -3</automated>
  </verify>
  <done>
    - All six test files exist with `@pytest.mark.skip` decorators
    - `uv run pytest -v` exits 0 (skips are OK; no errors)
    - Total skipped count: 5 (test_pipeline_e2e) + 1 (resume) + 1 (failure) + 2 (status) + 1 (checkpointer) + 15 (parametrized stub fixtures) = 25 skipped tests, 0 passed, 0 errors
    - Plan 10 will replace every `pass` body + remove every `@pytest.mark.skip` decorator
  </done>
</task>

</tasks>

<verification>
After both tasks:

1. `cd packages/pipeline && uv run pytest -v` exits 0 with output containing "25 skipped" (or close to — exact count may vary if planner uses different parametrize sizes).
2. No `ImportError` or `CollectionError` from any test file.
3. `conftest.py` fixtures are correctly skipping when env vars are missing — confirmed by running `unset SUPABASE_POSTGRES_URL; uv run pytest -v` and observing skips (no failures).
4. `grep -F "ASGITransport" packages/pipeline/tests/conftest.py` succeeds.
5. `grep -c "@pytest.mark.skip" packages/pipeline/tests/*.py packages/pipeline/tests/agents/*.py` returns >= 6 (one per file at minimum).

Plan 10 owns replacing the skip decorators with real assertions.
</verification>

<success_criteria>
- Test infrastructure is green from day one — `uv run pytest -v` exits 0 after every Wave 1+ commit.
- VALIDATION §"Wave 0 Requirements" checklist is satisfied: all 6 test files + conftest.py + pytest config (Plan 01 already wrote the pytest config).
- Plan 10 (integration tests) can plug into existing test files without restructuring.
- Fixtures correctly skip on missing env vars instead of crashing — researchers, executors, and CI all get clean skips.
</success_criteria>

<output>
Create `.planning/phases/04-pipeline-skeleton/04-05-pytest-infrastructure-SUMMARY.md` recording:
- The exact skipped-test count from `uv run pytest -v`
- Forward link to Plan 10 (replaces every `@pytest.mark.skip` + `pass` body with real assertions)
</output>
