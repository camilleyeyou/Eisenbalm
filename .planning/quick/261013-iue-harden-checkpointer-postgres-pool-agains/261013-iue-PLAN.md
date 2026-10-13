---
phase: quick-261013-iue
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py
  - packages/pipeline/tests/test_checkpointer.py
autonomous: true
requirements: [QUICK-261013-iue]

must_haves:
  truths:
    - "The checkpointer pool checks each connection before lending it, so a connection the Railway proxy already closed gets thrown away and replaced. The caller (AsyncPostgresSaver.aget_tuple) never receives it."
    - "Idle connections are closed after 120s, before Railway's proxy idle-kills them."
    - "TCP keepalives are enabled on every pool connection, so dead peers are detected at the socket level."
    - "Existing behavior is kept: autocommit=True, prepare_threshold=None, row_factory=dict_row, open=False."
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py"
      provides: "Hardened create_pool"
      contains: "check=AsyncConnectionPool.check_connection"
    - path: "packages/pipeline/tests/test_checkpointer.py"
      provides: "DB-free unit test of the pool settings"
      contains: "def test_create_pool_hardened_against_stale_connections"
  key_links:
    - from: "create_pool"
      to: "AsyncConnectionPool(check=..., max_idle=120, kwargs={keepalives...})"
      via: "constructor kwargs"
      pattern: "max_idle=120"
---

<objective>
Harden the LangGraph checkpointer's psycopg AsyncConnectionPool against stale idle connections.

Purpose: run df6e982935b94f10ad15c81311c6445e failed on 2026-10-13 with
`psycopg.OperationalError: consuming input failed: SSL error: unexpected eof while reading`
inside `AsyncPostgresSaver.aget_tuple`. The pool lent out an idle connection that Railway's
Postgres proxy had already closed. The pool only logged "discarding closed connection" after
the failure. This plan adds three safeguards: a check before each connection is lent out,
an idle cap, and TCP keepalives.
Output: updated `create_pool` + docstring, and a new unit test that needs no DB.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py
@packages/pipeline/tests/test_checkpointer.py

<interfaces>
Current create_pool (checkpointer.py):
```python
def create_pool(max_size: int = 10) -> AsyncConnectionPool:
    return AsyncConnectionPool(
        conninfo=_conn_string(),          # reads os.environ["SUPABASE_POSTGRES_URL"]
        max_size=max_size,
        kwargs={"autocommit": True, "prepare_threshold": None, "row_factory": dict_row},
        open=False,
    )
```

Versions: psycopg 3.3.4, psycopg-pool 3.3.1 (locked). Checked locally, a pool built with
open=False and no event loop exposes:
  - `pool._check is AsyncConnectionPool.check_connection`  -> True
  - `pool.max_idle` -> 120 (float/int seconds)
  - `pool.kwargs`   -> the kwargs dict as passed
Building the pool with open=False makes no network connection. The test therefore needs only
SUPABASE_POSTGRES_URL set to a dummy DSN (use pytest's `monkeypatch.setenv`).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add pool hardening settings to create_pool, with a DB-free unit test</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py, packages/pipeline/tests/test_checkpointer.py</files>
  <behavior>
    - test_create_pool_hardened_against_stale_connections (sync test, no DB):
      monkeypatch.setenv("SUPABASE_POSTGRES_URL", "postgresql://user:pw@localhost:5432/db"),
      call create_pool() and assert:
        * pool._check is AsyncConnectionPool.check_connection
        * pool.max_idle == 120
        * pool.kwargs["keepalives"] == 1, ["keepalives_idle"] == 30,
          ["keepalives_interval"] == 10, ["keepalives_count"] == 3
        * kept settings: pool.kwargs["autocommit"] is True, pool.kwargs["prepare_threshold"] is None,
          pool.kwargs["row_factory"] is dict_row
        * pool.closed is True (open=False kept, so no connection is attempted)
      Each assert gets a short message, matching the f-string message style already used in the file.
  </behavior>
  <action>
    RED: append a new section to tests/test_checkpointer.py, using the file's existing
    `# ── name ───` separator style, e.g. `# ── create_pool stale-connection hardening — no live DB needed ──`.
    Inside it, add `test_create_pool_hardened_against_stale_connections(monkeypatch)` as described in
    <behavior>. Import `create_pool` inside the test or at the top next to `assert_tables_exist`.
    Also import `AsyncConnectionPool` from psycopg_pool and `dict_row` from psycopg.rows.
    Add one line for the new test to the module docstring's test list
    (the docstring currently says "Two test functions"; change it to "Three"). Run the test and confirm it fails.

    GREEN: in checkpointer.py `create_pool`, add these constructor arguments:
      `check=AsyncConnectionPool.check_connection`, `max_idle=120`, and kwargs entries
      `"keepalives": 1, "keepalives_idle": 30, "keepalives_interval": 10, "keepalives_count": 3`.
    Keep the existing autocommit / prepare_threshold / row_factory kwargs, `max_size=max_size`, and `open=False`.
    Do not change the signature. Extend the docstring with a "Stale-connection hardening" block
    that explains the 2026-10-13 failure (run df6e982935b94f10ad15c81311c6445e: `SSL error: unexpected
    eof while reading` in AsyncPostgresSaver.aget_tuple, because Railway's Postgres proxy silently
    closed an idle pooled connection) and what each setting does:
      - check -> runs a cheap liveness probe on each connection before it is lent out.
        Dead connections are discarded and replaced, not returned to the caller.
      - max_idle=120 -> closes connections idle longer than 2 min, before the proxy idle-kills them.
      - keepalives* -> libpq TCP keepalives (first probe after 30s idle, every 10s, 3 failures), so dead peers are detected
        at the socket level.
    Do not add retry logic to callers or touch other modules; this change is limited to the pool.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_checkpointer.py -q && uv run pytest -q</automated>
  </verify>
  <done>New test passes; test_assert_tables_exist_raises_on_empty_db still passes (test_setup_idempotent may skip without a DB); full pipeline suite green; create_pool docstring documents the stale-connection rationale.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/test_checkpointer.py -q` is green
- `cd packages/pipeline && uv run pytest -q` is green (no regressions)
- `grep -n "check=AsyncConnectionPool.check_connection\|max_idle=120\|keepalives" packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py` shows all settings
</verification>

<success_criteria>
create_pool builds a pool with check=check_connection, max_idle=120, and TCP keepalives
(1/30/10/3). The existing autocommit/prepare_threshold/row_factory/open=False behavior is unchanged.
A DB-free unit test pins these settings, and the full suite stays green.
</success_criteria>

<output>
After completion, create `.planning/quick/261013-iue-harden-checkpointer-postgres-pool-agains/261013-iue-SUMMARY.md`
</output>
