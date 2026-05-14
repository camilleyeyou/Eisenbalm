"""AsyncPostgresSaver checkpointer (PIP-09).

Two test functions:

  test_setup_idempotent
    Calls cli.setup_checkpointer() twice; both must succeed (CONTEXT D-12 +
    research Pitfall 3 — setup() acquires an advisory lock and is safe to
    re-run). Then verifies the LangGraph tables exist via assert_tables_exist.
    Drives real DDL against Supabase Postgres — guarded by skipif on
    SUPABASE_POSTGRES_URL (runs in Plan 12's smoke test).

  test_assert_tables_exist_raises_on_empty_db
    Unit-level: assert_tables_exist must raise a clear RuntimeError when the
    checkpoint tables are absent. Self-contained — mocks the psycopg pool's
    cursor so it needs no live database (the to_regclass query returns None,
    mirroring a fresh Supabase project before setup-checkpointer has run).

NOTE: Requires SUPABASE_POSTGRES_URL set to the session pooler (port 5432) per
research §7. Will fail with InvalidSqlStatementName if pointed at port 6543
transaction pooler — that's the canonical "you used the wrong pooler" signal.

Source: 04-CONTEXT.md D-11 + D-12 + 04-RESEARCH.md §1 + Pitfall 1 + Pitfall 3.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

import pytest

from eisenbalm_pipeline.graph.checkpointer import assert_tables_exist


# ── setup() idempotency — needs the graph DB (Plan 12) ────────────────────


_needs_supabase = pytest.mark.skipif(
    not os.environ.get("SUPABASE_POSTGRES_URL"),
    reason=(
        "SUPABASE_POSTGRES_URL not set — setup() idempotency runs real DDL "
        "against Supabase Postgres; Supabase is provisioned in Plan 12 "
        "(Andrew's manual step). Runs green in Plan 12's smoke test."
    ),
)


@_needs_supabase
async def test_setup_idempotent():
    """PIP-09: setup() is safe to call twice; assert_tables_exist passes after."""
    from eisenbalm_pipeline.cli import setup_checkpointer
    from eisenbalm_pipeline.graph.checkpointer import create_pool

    # Call setup twice — both must succeed (advisory-locked DDL).
    await setup_checkpointer()
    await setup_checkpointer()

    # And the LangGraph checkpoint tables now exist.
    pool = create_pool()
    await pool.open()
    try:
        await assert_tables_exist(pool)  # raises RuntimeError if missing
    finally:
        await pool.close()


# ── assert_tables_exist failure mode — no live DB needed ──────────────────


class _FakeCursor:
    """Minimal async cursor stub: to_regclass returns None (tables absent)."""

    async def execute(self, _sql: str) -> None:  # noqa: D401
        return None

    async def fetchone(self) -> dict:
        # Mirrors `SELECT to_regclass('public.checkpoints')` on a fresh DB.
        return {"to_regclass": None}


class _FakeConn:
    def cursor(self):
        @asynccontextmanager
        async def _cm():
            yield _FakeCursor()

        return _cm()


class _FakePool:
    """Stand-in for AsyncConnectionPool — yields a _FakeConn on .connection()."""

    def connection(self):
        @asynccontextmanager
        async def _cm():
            yield _FakeConn()

        return _cm()


async def test_assert_tables_exist_raises_on_empty_db():
    """PIP-09: assert_tables_exist raises a clear RuntimeError on a fresh DB.

    Self-contained — the fake pool returns to_regclass=None for the
    checkpoints table, exactly what Supabase reports before setup() has run.
    The RuntimeError message must point the operator at the CLI command.
    """
    with pytest.raises(RuntimeError) as excinfo:
        await assert_tables_exist(_FakePool())

    msg = str(excinfo.value)
    assert "setup-checkpointer" in msg, (
        f"error must name the CLI fix command; got {msg!r}"
    )
