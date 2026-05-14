---
phase: 04-pipeline-skeleton
plan: 10
type: execute
wave: 3
depends_on:
  - "04-05"
  - "04-09"
files_modified:
  - packages/pipeline/tests/test_pipeline_e2e.py
  - packages/pipeline/tests/test_editor_gate_1_resume.py
  - packages/pipeline/tests/test_agent_failure.py
  - packages/pipeline/tests/test_status_endpoint.py
  - packages/pipeline/tests/test_checkpointer.py
  - packages/pipeline/tests/agents/test_stub_fixtures.py
autonomous: true
requirements:
  - PIP-06
  - PIP-10
  - OPS-01
  - PIP-04
must_haves:
  truths:
    - "test_pipeline_e2e.py runs a stub pipeline end-to-end via ASGITransport (research §10) and asserts: (a) /run/weekly returns 32-char hex runId; (b) status reaches 'awaiting-review'; (c) Sanity issue-{n}.pipelineMetadata.runId equals the response runId; (d) every Convex table row has the same runId; (e) pipelineRuns.cost is JSON-parseable with shape {total, agents}; (f) pipelineRuns.durationMs > 0 (PIP-06 + PIP-05 + PIP-07 + PIP-08 + PIP-11 + PIP-12)"
    - "test_editor_gate_1_resume.py exercises forceNoWinner: status becomes 'awaiting-review', POST /resume with valid charity name resumes the graph to terminal (PIP-10)"
    - "test_agent_failure.py exercises forceFailAgent='researcher': status becomes 'failed', errorMessage starts with 'researcher:' (OPS-01)"
    - "test_status_endpoint.py asserts the GET /run/{runId}/status response shape (OPS-02) AND that nonexistent runId returns 404"
    - "test_checkpointer.py exercises setup() idempotency — calling setup_checkpointer twice does not error; Supabase tables are created (PIP-09)"
    - "agents/test_stub_fixtures.py parametrizes over the 15 fixture functions and asserts each returns a dict with expected top-level keys matching DispatchState fields (PIP-04)"
    - "All previously-skipped tests from Plan 05 are now active (skip decorators removed); pytest still skips them when SUPABASE_POSTGRES_URL is not set — that's expected (manual env required)"
  artifacts:
    - path: "packages/pipeline/tests/test_pipeline_e2e.py"
      provides: "Headline PIP-06 e2e test + PIP-08 event-types test + PIP-11 cost-shape test + PIP-12 durationMs test"
      contains: "pipelineMetadata"
    - path: "packages/pipeline/tests/test_editor_gate_1_resume.py"
      provides: "PIP-10 interrupt/resume test"
      contains: "forceNoWinner"
    - path: "packages/pipeline/tests/test_agent_failure.py"
      provides: "OPS-01 failure-path test"
      contains: "forceFailAgent"
    - path: "packages/pipeline/tests/agents/test_stub_fixtures.py"
      provides: "PIP-04 parametrized stub-fixture shape test"
      contains: "parametrize"
  key_links:
    - from: "test_pipeline_e2e.py"
      to: "Sanity REST API + Convex /api/query"
      via: "sanity_get_issue fixture (Plan 05) + convex_query_fn fixture (Plan 05)"
      pattern: "pipelineMetadata.runId"
    - from: "test_editor_gate_1_resume.py"
      to: "POST /run/{runId}/resume"
      via: "AsyncClient (Plan 05 client fixture) + selection.charityName='The Quiet Foundation' (Phase 2 D-16)"
      pattern: "resume"
---

<objective>
Replace every `@pytest.mark.skip` decorator + `pass` body in the six test files Plan 05 scaffolded with real, exercise-the-full-stack assertions. This is the Nyquist verification surface for PIP-04, PIP-06, PIP-10, and OPS-01 — when this plan lands green, every Phase 4 requirement that has an automated test is verified.

The tests run in-process via ASGITransport against the real FastAPI app (research §10 — fast, no Railway round-trip). They hit the real Sanity production dataset (writing to `issue-{999000+random}` which avoids colliding with the demo `issue-1`) and the real production Convex deployment. Tests clean up via the `sanity_cleanup` fixture; Convex rows stay (scoped to unique runId so they don't pollute future runs per research §10 cleanup note).

Purpose: PIP-04 (stub-fixture TypedDict shapes) + PIP-06 (headline e2e) + PIP-10 (interrupt/resume) + OPS-01 (failure path). Plan 12 (Andrew's smoke test) provides the manual evidence to close PIP-01 and OPS-03; this plan closes the rest.
Output: All pytest tests have real bodies. `uv run pytest -v` either passes (env vars set + Supabase ready) or skips with informative messages (env vars missing).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-pipeline-skeleton/04-CONTEXT.md
@.planning/phases/04-pipeline-skeleton/04-RESEARCH.md
@.planning/phases/04-pipeline-skeleton/04-VALIDATION.md
@packages/pipeline/tests/conftest.py
@packages/pipeline/tests/test_pipeline_e2e.py
@packages/pipeline/tests/test_editor_gate_1_resume.py
@packages/pipeline/tests/test_agent_failure.py
@packages/pipeline/tests/test_status_endpoint.py
@packages/pipeline/tests/test_checkpointer.py
@packages/pipeline/tests/agents/test_stub_fixtures.py
@packages/pipeline/src/eisenbalm_pipeline/api/main.py
@packages/pipeline/src/eisenbalm_pipeline/api/runs.py
@packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py
</context>

<tasks>

<task type="auto">
  <name>Task 1: test_pipeline_e2e.py — replace all skipped tests with real assertions (PIP-06 + PIP-08 + PIP-11 + PIP-12)</name>
  <files>packages/pipeline/tests/test_pipeline_e2e.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-35 (PIP-06 integration test — full 7-step flow)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Example 4" lines 999-1064 (reference test impl)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §10 cleanup snippet (Sanity delete pattern)
    - packages/pipeline/tests/conftest.py (Plan 05 — available fixtures: client, convex_query_fn, sanity_cleanup, sanity_get_issue)
    - packages/pipeline/tests/test_pipeline_e2e.py (Plan 05 — current skip skeletons to replace)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-18 step 12 (stub Publisher leaves status='awaiting-review', NOT 'complete')
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-22 (cost JSON shape: {total: float, agents: {agent: {tokens_in, tokens_out, usd, duration_ms}}})
  </read_first>
  <action>
    Rewrite `packages/pipeline/tests/test_pipeline_e2e.py`:

    ```python
    """End-to-end pipeline test (PIP-02, PIP-05, PIP-06, PIP-07, PIP-08, PIP-11, PIP-12).

    Strategy (research §10):
      - In-process via ASGITransport (client fixture from conftest.py)
      - Hit real production Sanity + Convex
      - Use unique issueNumber = 999000 + (time % 100000) to avoid clobbering demo
      - Stub Publisher leaves status='awaiting-review' (CONTEXT D-18 step 12)
      - Clean up via sanity_cleanup fixture; Convex rows stay (scoped to runId)
    """
    from __future__ import annotations
    import asyncio
    import json
    import time

    import pytest


    POLL_INTERVAL_S = 0.5
    POLL_TIMEOUT_S = 30.0
    TERMINAL_STATES = {"awaiting-review", "complete", "failed"}


    async def _poll_until_terminal(client, run_id: str) -> dict:
        """Poll GET /run/{run_id}/status until terminal or timeout. Returns final row."""
        deadline = time.monotonic() + POLL_TIMEOUT_S
        last_status: dict = {}
        while time.monotonic() < deadline:
            r = await client.get(f"/run/{run_id}/status")
            assert r.status_code == 200, f"status endpoint failed: {r.status_code}"
            last_status = r.json()
            if last_status.get("status") in TERMINAL_STATES:
                return last_status
            await asyncio.sleep(POLL_INTERVAL_S)
        raise TimeoutError(
            f"Run {run_id} did not reach terminal in {POLL_TIMEOUT_S}s; "
            f"last_status={last_status}"
        )


    def _unique_issue_number() -> int:
        # CONTEXT D-35: 999000 + (int(time.time()) % 100000) — cheap unique
        return 999000 + (int(time.time()) % 100000)


    async def test_returns_runId(client):
        """PIP-02: POST /run/weekly returns 32-char hex runId."""
        r = await client.post(
            "/run/weekly", json={"issueNumber": _unique_issue_number()}
        )
        assert r.status_code == 200, r.text
        run_id = r.json().get("runId")
        assert isinstance(run_id, str), "runId must be a string"
        assert len(run_id) == 32, f"runId must be 32-char hex (uuid4().hex); got {run_id}"
        assert "-" not in run_id, "runId must not contain dashes"


    async def test_pipeline_e2e_runId_threaded_to_all_datastores(
        client, convex_query_fn, sanity_get_issue, sanity_cleanup
    ):
        """PIP-05 + PIP-06 + PIP-07: runId threaded across Sanity + every Convex table."""
        issue_number = _unique_issue_number()
        try:
            r = await client.post(
                "/run/weekly", json={"issueNumber": issue_number}
            )
            assert r.status_code == 200
            run_id = r.json()["runId"]

            final = await _poll_until_terminal(client, run_id)
            assert final["status"] == "awaiting-review", final

            # PIP-07: Sanity draft exists with pipelineMetadata.runId == run_id
            doc = await sanity_get_issue(issue_number)
            assert doc is not None, f"Sanity draft issue-{issue_number} not found"
            assert doc["pipelineMetadata"]["runId"] == run_id, (
                f"Sanity pipelineMetadata.runId mismatch: "
                f"{doc['pipelineMetadata'].get('runId')} != {run_id}"
            )

            # PIP-06: every Convex table row has matching runId
            pipeline_run = await convex_query_fn(
                "pipelineRuns:byRunId", {"runId": run_id}
            )
            assert pipeline_run is not None
            assert pipeline_run["runId"] == run_id

            for query_path in (
                "pitchLog:byRunId",
                "deliberationEvents:byRunId",
                "agentVotes:byRunId",
                "qaCorrections:byRunId",
            ):
                rows = await convex_query_fn(query_path, {"runId": run_id})
                assert isinstance(rows, list)
                for row in rows:
                    assert row.get("runId") == run_id, (
                        f"{query_path}: row.runId != {run_id}: {row}"
                    )
        finally:
            await sanity_cleanup(issue_number)


    async def test_all_event_types_emitted(client, convex_query_fn, sanity_cleanup):
        """PIP-08: every expected deliberationEvents eventType fires during the stub run.

        Phase 4 stub emits: advocate-argument (3x), editor-decision (1x),
        section-draft (7x), qa-correction (1x), editor-final (1x),
        publisher-deploy (1x). Calibrator + Scout + Researcher do NOT emit
        via the wrapper in Phase 4 (CONTEXT D-18 + Plan 07 notes).
        """
        issue_number = _unique_issue_number()
        try:
            r = await client.post(
                "/run/weekly", json={"issueNumber": issue_number}
            )
            run_id = r.json()["runId"]
            await _poll_until_terminal(client, run_id)

            events = await convex_query_fn(
                "deliberationEvents:byRunId", {"runId": run_id}
            )
            event_types = {e["eventType"] for e in events}
            # The 5 event types Phase 4 stub MUST emit.
            for required in (
                "advocate-argument",
                "editor-decision",
                "section-draft",
                "qa-correction",
                "editor-final",
                "publisher-deploy",
            ):
                assert required in event_types, (
                    f"Missing eventType {required}; got {event_types}"
                )
        finally:
            await sanity_cleanup(issue_number)


    async def test_cost_shape(client, convex_query_fn, sanity_cleanup):
        """PIP-11: pipelineRuns.cost is JSON-parseable with shape {total, agents}."""
        issue_number = _unique_issue_number()
        try:
            r = await client.post(
                "/run/weekly", json={"issueNumber": issue_number}
            )
            run_id = r.json()["runId"]
            await _poll_until_terminal(client, run_id)

            pr = await convex_query_fn("pipelineRuns:byRunId", {"runId": run_id})
            cost_str = pr.get("cost")
            assert cost_str is not None, "pipelineRuns.cost was not written"
            cost = json.loads(cost_str)
            assert "total" in cost
            assert "agents" in cost
            assert isinstance(cost["total"], (int, float))
            assert isinstance(cost["agents"], dict)
            # Stub mode: every agent records 0 USD; total should be 0.0
            assert cost["total"] == 0.0
        finally:
            await sanity_cleanup(issue_number)


    async def test_duration_ms(client, convex_query_fn, sanity_cleanup):
        """PIP-12: pipelineRuns.durationMs is populated and > 0."""
        issue_number = _unique_issue_number()
        try:
            r = await client.post(
                "/run/weekly", json={"issueNumber": issue_number}
            )
            run_id = r.json()["runId"]
            await _poll_until_terminal(client, run_id)

            pr = await convex_query_fn("pipelineRuns:byRunId", {"runId": run_id})
            duration = pr.get("durationMs")
            assert duration is not None
            assert isinstance(duration, (int, float))
            assert duration > 0
        finally:
            await sanity_cleanup(issue_number)
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_pipeline_e2e.py --collect-only -q 2>&1 | grep -E "test_(returns_runId|pipeline_e2e|all_event_types|cost_shape|duration_ms)" | wc -l | grep -v "^0$"</automated>
  </verify>
  <done>
    - All 5 tests in test_pipeline_e2e.py have real bodies (no `pass`, no `@pytest.mark.skip`)
    - Tests are collected by pytest (verified via --collect-only)
    - Tests run cleanly when env vars are set; skip cleanly when not (conftest's `_missing_env` check)
    - PIP-02, PIP-05, PIP-06, PIP-07, PIP-08, PIP-11, PIP-12 all covered
  </done>
</task>

<task type="auto">
  <name>Task 2: test_editor_gate_1_resume.py — interrupt/resume cycle (PIP-10)</name>
  <files>packages/pipeline/tests/test_editor_gate_1_resume.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-36 (forceNoWinner test: status='awaiting-review' mid-run; resume with selection.charityName; assert terminal completion)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-08 (resume body shape: {selection: {charityName: str}})
    - packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py (QUIET_FOUNDATION_NAME constant — use the demo charity for resume)
    - packages/pipeline/tests/test_pipeline_e2e.py (Task 1 just wrote — reuse _poll_until_terminal, _unique_issue_number helpers via shared module OR copy them; copy is simpler for Phase 4)
  </read_first>
  <action>
    Rewrite `packages/pipeline/tests/test_editor_gate_1_resume.py`:

    ```python
    """Editor gate 1 interrupt/resume (PIP-10 + CONTEXT D-36).

    Strategy:
      1. POST /run/weekly with forceNoWinner=true → triggers interrupt() in editor
      2. Poll status until 'awaiting-review' (the Editor wrote it BEFORE interrupt)
      3. POST /run/{runId}/resume with selection.charityName = 'The Quiet Foundation'
      4. Poll status — should reach terminal 'awaiting-review' (final, post-Publisher)
      5. Assert Sanity draft was written with the resumed charity reference
    """
    from __future__ import annotations
    import asyncio
    import time

    import pytest


    POLL_INTERVAL_S = 0.5
    POLL_TIMEOUT_S = 30.0


    async def _poll_for_status(client, run_id: str, target_statuses: set) -> dict:
        deadline = time.monotonic() + POLL_TIMEOUT_S
        last: dict = {}
        while time.monotonic() < deadline:
            r = await client.get(f"/run/{run_id}/status")
            last = r.json() if r.status_code == 200 else {"status": "404"}
            if last.get("status") in target_statuses:
                return last
            await asyncio.sleep(POLL_INTERVAL_S)
        raise TimeoutError(
            f"Run {run_id} did not reach {target_statuses}; last={last}"
        )


    def _unique_issue_number() -> int:
        return 999000 + (int(time.time()) % 100000)


    async def test_editor_gate_1_interrupt_and_resume(
        client, convex_query_fn, sanity_get_issue, sanity_cleanup
    ):
        """PIP-10: forceNoWinner → interrupt → awaiting-review → resume → terminal."""
        issue_number = _unique_issue_number()
        try:
            # 1. Trigger with forceNoWinner=true
            r = await client.post(
                "/run/weekly",
                json={"issueNumber": issue_number, "forceNoWinner": True},
            )
            assert r.status_code == 200, r.text
            run_id = r.json()["runId"]

            # 2. Poll for 'awaiting-review' (Editor gate 1 wrote it before interrupt)
            mid = await _poll_for_status(
                client, run_id, {"awaiting-review", "failed"}
            )
            assert mid["status"] == "awaiting-review", (
                f"Expected awaiting-review on interrupt; got {mid}"
            )

            # 3. Resume with the demo charity from stubs.fixtures
            r = await client.post(
                f"/run/{run_id}/resume",
                json={"selection": {"charityName": "The Quiet Foundation"}},
            )
            assert r.status_code == 200, r.text
            assert r.json().get("resumed") is True

            # 4. Poll for terminal — stub Publisher leaves status='awaiting-review'
            # (CONTEXT D-18 step 12). To differentiate "post-resume terminal" from
            # the mid-run "awaiting-review", we check that the Sanity draft now
            # exists (pre-resume, the Sanity write hadn't happened yet because the
            # graph was paused at Editor gate 1).
            deadline = time.monotonic() + POLL_TIMEOUT_S
            while time.monotonic() < deadline:
                doc = await sanity_get_issue(issue_number)
                if doc and doc.get("pipelineMetadata", {}).get("runId") == run_id:
                    break
                await asyncio.sleep(POLL_INTERVAL_S)
            else:
                pytest.fail(
                    f"Sanity draft for issue-{issue_number} never appeared "
                    f"after resume of runId {run_id}"
                )

            # 5. Assert the winning charity reference is "The Quiet Foundation"
            assert doc["charity"]["_ref"] == "charity-the-quiet-foundation"

            # 6. Final status should be 'awaiting-review' AND have completedAt
            final = await client.get(f"/run/{run_id}/status")
            final_data = final.json()
            assert final_data["status"] == "awaiting-review"
            assert final_data.get("completedAt") is not None
            assert final_data.get("durationMs") is not None
        finally:
            await sanity_cleanup(issue_number)
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_editor_gate_1_resume.py --collect-only -q 2>&1 | grep -F "test_editor_gate_1_interrupt_and_resume"</automated>
  </verify>
  <done>
    - test_editor_gate_1_resume.py has a real body (no `pass`, no `@pytest.mark.skip`)
    - Exercises forceNoWinner → interrupt → resume → terminal flow per CONTEXT D-36
    - Asserts Sanity charity ref is "charity-the-quiet-foundation" (Phase 2 demo charity reuse)
  </done>
</task>

<task type="auto">
  <name>Task 3: test_agent_failure.py + test_status_endpoint.py — OPS-01 + OPS-02</name>
  <files>packages/pipeline/tests/test_agent_failure.py, packages/pipeline/tests/test_status_endpoint.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-37 (forceFailAgent='researcher' → status='failed' + errorMessage starts with 'researcher:')
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-27 (errorMessage format: `{agentId}: {ExceptionClass}: {msg}`)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-07 (status endpoint response shape)
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py (status returns 404 for nonexistent runId)
  </read_first>
  <action>
    **`packages/pipeline/tests/test_agent_failure.py`**:

    ```python
    """Agent failure path (OPS-01 + CONTEXT D-37).

    Strategy: forceFailAgent='researcher' → wrapper raises RuntimeError →
    pipelineRuns:updateStatus status='failed' + errorMessage='researcher: RuntimeError: ...'.
    """
    from __future__ import annotations
    import asyncio
    import time

    import pytest


    POLL_INTERVAL_S = 0.5
    POLL_TIMEOUT_S = 20.0


    def _unique_issue_number() -> int:
        return 999000 + (int(time.time()) % 100000)


    async def test_forced_agent_failure_marks_run_failed(client, convex_query_fn):
        """OPS-01: forceFailAgent → status='failed' with agentId-prefixed errorMessage."""
        issue_number = _unique_issue_number()
        r = await client.post(
            "/run/weekly",
            json={"issueNumber": issue_number, "forceFailAgent": "researcher"},
        )
        assert r.status_code == 200
        run_id = r.json()["runId"]

        # Poll until failed (researcher runs after editor gate 1 — should fail fast)
        deadline = time.monotonic() + POLL_TIMEOUT_S
        final: dict = {}
        while time.monotonic() < deadline:
            r2 = await client.get(f"/run/{run_id}/status")
            final = r2.json()
            if final.get("status") == "failed":
                break
            await asyncio.sleep(POLL_INTERVAL_S)
        else:
            pytest.fail(
                f"Run {run_id} did not reach 'failed' in {POLL_TIMEOUT_S}s; "
                f"last={final}"
            )

        # CONTEXT D-27 format: f'{agentId}: {ExceptionClass}: {msg}'
        err = final.get("errorMessage") or ""
        assert err.startswith("researcher:"), (
            f"errorMessage should start with 'researcher:'; got {err!r}"
        )
        assert "RuntimeError" in err, f"Expected RuntimeError in {err!r}"
        assert final.get("completedAt") is not None
    ```

    **`packages/pipeline/tests/test_status_endpoint.py`**:

    ```python
    """GET /run/{runId}/status (OPS-02 + CONTEXT D-07)."""
    from __future__ import annotations
    import asyncio
    import time

    import pytest


    def _unique_issue_number() -> int:
        return 999000 + (int(time.time()) % 100000)


    async def test_status_endpoint_returns_current_state(client, convex_query_fn, sanity_cleanup):
        """OPS-02: GET /run/{runId}/status returns canonical response shape."""
        issue_number = _unique_issue_number()
        try:
            r = await client.post(
                "/run/weekly", json={"issueNumber": issue_number}
            )
            run_id = r.json()["runId"]

            # Status immediately after trigger should be 'running' (or already
            # advanced if the stub completed extremely fast)
            await asyncio.sleep(0.2)
            r = await client.get(f"/run/{run_id}/status")
            assert r.status_code == 200
            body = r.json()
            # Required keys per CONTEXT D-07
            for key in (
                "runId", "status", "startedAt",
                "completedAt", "durationMs", "errorMessage",
            ):
                assert key in body, f"Missing key {key} in status response"
            assert body["runId"] == run_id
            assert body["status"] in {
                "running", "awaiting-review", "complete", "failed"
            }
        finally:
            await sanity_cleanup(issue_number)


    async def test_status_endpoint_nonexistent_runid(client):
        """OPS-02: GET against an unknown runId returns 404 (CONTEXT D-07 + Plan 09)."""
        r = await client.get("/run/nonexistent-runid-test/status")
        assert r.status_code == 404
        assert "Run not found" in (r.json().get("detail") or "")
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_agent_failure.py tests/test_status_endpoint.py --collect-only -q 2>&1 | grep -E "test_(forced_agent_failure|status_endpoint)"</automated>
  </verify>
  <done>
    - test_agent_failure.py exercises forceFailAgent='researcher' and asserts the errorMessage format
    - test_status_endpoint.py asserts the response shape AND the 404-on-nonexistent behavior
    - All tests have real bodies (no skip, no pass)
  </done>
</task>

<task type="auto">
  <name>Task 4: test_checkpointer.py + agents/test_stub_fixtures.py — PIP-09 + PIP-04</name>
  <files>packages/pipeline/tests/test_checkpointer.py, packages/pipeline/tests/agents/test_stub_fixtures.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §1 (checkpointer.setup() idempotent — calling twice OK)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md Pitfall 3 (cli.py:setup_checkpointer for the integration test)
    - packages/pipeline/src/eisenbalm_pipeline/cli.py (Plan 08 — setup_checkpointer async fn)
    - packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py (Plan 08 — assert_tables_exist for post-setup verification)
    - packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py (Plan 06 — 15 fixture functions)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-16 (every fixture returns structurally-valid partial state)
    - docs/API_CONTRACTS.md §7 (DispatchState field names — TypedDict)
  </read_first>
  <action>
    **`packages/pipeline/tests/test_checkpointer.py`**:

    ```python
    """AsyncPostgresSaver checkpointer (PIP-09 + research §1 + Pitfall 3).

    NOTE: Requires SUPABASE_POSTGRES_URL pointing at session pooler (port 5432).
    """
    from __future__ import annotations
    import os

    import pytest


    async def test_setup_idempotent():
        """PIP-09: setup() is safe to call twice; assert_tables_exist passes after."""
        if not os.getenv("SUPABASE_POSTGRES_URL"):
            pytest.skip("SUPABASE_POSTGRES_URL not set")

        from eisenbalm_pipeline.cli import setup_checkpointer
        from eisenbalm_pipeline.graph.checkpointer import (
            assert_tables_exist,
            create_pool,
        )

        # Call setup twice — both must succeed
        await setup_checkpointer()
        await setup_checkpointer()

        # And the tables exist
        pool = create_pool()
        await pool.open()
        try:
            await assert_tables_exist(pool)  # raises if missing
        finally:
            await pool.close()
    ```

    **`packages/pipeline/tests/agents/test_stub_fixtures.py`**:

    ```python
    """Stub fixture TypedDict-shape validation (PIP-04).

    Parametrized over the 15 fixture functions in stubs/fixtures.py.
    Each fixture returns a partial DispatchState update; this test asserts
    the returned dict's top-level keys belong to the canonical DispatchState
    (API_CONTRACTS §7).
    """
    from __future__ import annotations
    from typing import Callable

    import pytest

    from eisenbalm_pipeline.graph.state import DispatchState
    from eisenbalm_pipeline.stubs import fixtures


    DISPATCH_STATE_FIELDS = set(DispatchState.__annotations__.keys())


    @pytest.fixture(scope="module")
    def candidates_for_advocate():
        return fixtures.scout_candidates()["candidates"]


    # Each entry: (fixture name, callable, set of expected top-level keys).
    FIXTURE_CASES = [
        ("calibrator_output", lambda: fixtures.calibrator_output(), {"style_brief"}),
        ("scout_candidates", lambda: fixtures.scout_candidates(), {"candidates"}),
        # advocate_scored needs candidates — handled separately
        (
            "editor_decision_output",
            lambda: fixtures.editor_decision_output("The Quiet Foundation"),
            {"editor_decision", "runner_up_notes", "deliberation_transcript"},
        ),
        ("research_output", lambda: fixtures.research_output(), {"research"}),
        ("origin_story_output", lambda: fixtures.origin_story_output(), {"origin_story"}),
        ("problem_output", lambda: fixtures.problem_output(), {"problem_statement", "problem_pdf_content"}),
        ("founder_bio_output", lambda: fixtures.founder_bio_output(), {"founder_bio"}),
        ("case_study_output", lambda: fixtures.case_study_output(), {"case_study"}),
        ("game_output", lambda: fixtures.game_output(), {"game"}),
        ("bonus_output", lambda: fixtures.bonus_output(), {"bonus"}),
        ("design_output", lambda: fixtures.design_output(), {"theme"}),
        ("qa_output", lambda: fixtures.qa_output(), {"qa_corrections"}),
        ("editor_final_output", lambda: fixtures.editor_final_output(), {"editor_final_notes"}),
        ("publisher_output", lambda: fixtures.publisher_output(), {"sanity_issue_id"}),
    ]


    @pytest.mark.parametrize(
        "fixture_name,fixture_call,expected_keys",
        FIXTURE_CASES,
        ids=[name for name, _, _ in FIXTURE_CASES],
    )
    def test_stub_fixture_returns_valid_dispatch_state_shape(
        fixture_name: str, fixture_call: Callable, expected_keys: set
    ):
        """PIP-04: fixture's returned dict has the expected DispatchState keys."""
        result = fixture_call()
        assert isinstance(result, dict), (
            f"{fixture_name} should return dict; got {type(result)}"
        )
        actual_keys = set(result.keys())
        assert actual_keys == expected_keys, (
            f"{fixture_name} keys mismatch: expected {expected_keys}, got {actual_keys}"
        )
        # Every returned key must belong to DispatchState (locked contract).
        unknown = actual_keys - DISPATCH_STATE_FIELDS
        assert not unknown, (
            f"{fixture_name} returned non-DispatchState keys: {unknown}"
        )


    def test_advocate_scored_shape(candidates_for_advocate):
        """advocate_scored takes input candidates; verify it returns scored list."""
        result = fixtures.advocate_scored(candidates_for_advocate)
        assert set(result.keys()) == {"candidates"}
        assert all(
            isinstance(c.get("advocateScore"), int) for c in result["candidates"]
        )
        assert all(
            isinstance(c.get("advocateArgument"), str)
            for c in result["candidates"]
        )
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_checkpointer.py tests/agents/test_stub_fixtures.py -v 2>&1 | tail -10</automated>
  </verify>
  <done>
    - test_checkpointer.py exercises setup() twice via cli.setup_checkpointer + assert_tables_exist
    - agents/test_stub_fixtures.py parametrizes over 14 fixture functions + advocate_scored extra test
    - Each fixture's returned top-level keys are asserted to belong to DispatchState
    - Tests skip cleanly when SUPABASE_POSTGRES_URL missing (test_checkpointer); stub fixture tests don't need env vars
  </done>
</task>

</tasks>

<verification>
After all four tasks:

1. `cd packages/pipeline && uv run pytest -v 2>&1 | tail -15` shows no skip markers from Plan 05 (Plan 10 removed them).

2. `grep -c "@pytest.mark.skip" packages/pipeline/tests/*.py packages/pipeline/tests/agents/*.py` returns 0 — all skip decorators removed.

3. Stub-fixture tests run WITHOUT any env vars set (don't depend on Sanity/Convex/Supabase) — `cd packages/pipeline && env -i HOME=$HOME PATH=$PATH uv run pytest tests/agents/test_stub_fixtures.py -v` should pass.

4. With env vars set + Supabase ready + checkpointer setup ran: all tests pass green.

5. Without env vars set: tests skip cleanly via conftest fixtures (no errors).
</verification>

<success_criteria>
- PIP-04: 14 stub fixtures verified via parametrized test (test_stub_fixtures.py)
- PIP-06: headline e2e test asserts Sanity pipelineMetadata.runId == Convex rows' runId
- PIP-10: forceNoWinner + resume cycle exercised; Sanity draft post-resume has correct charity reference
- OPS-01: forceFailAgent produces status='failed' + errorMessage with agent-id prefix
- OPS-02: status endpoint response shape + 404 on missing runId verified
- PIP-09: setup() idempotency verified by calling twice
- Plan 05's skip skeletons are fully replaced; `uv run pytest -v` either passes (env ready) or skips (env missing) cleanly
</success_criteria>

<output>
Create `.planning/phases/04-pipeline-skeleton/04-10-integration-tests-SUMMARY.md` recording:
- All 6 test files now have real assertions (no skip decorators, no pass-bodies)
- Whether the integration tests passed against the live Supabase/Sanity/Convex when run locally (Andrew or engineer reports)
- The exact pytest summary line (`X passed, Y skipped` — Y should be 0 if env is set)
- Forward link to Plan 11 (documentation rewrites README using the verified test commands) and Plan 12 (Andrew's deploy-side smoke test)
</output>
