"""AsyncPostgresSaver lifecycle factory (CONTEXT D-11, D-12 + research §1).

FastAPI lifespan (Plan 09) calls:
  pool = create_pool()
  await pool.open()
  checkpointer = create_checkpointer(pool)
  await assert_tables_exist(pool)   # fail-fast if setup() never ran
  graph = build_graph(checkpointer)

On shutdown: await pool.close().

The setup() DDL lives in cli.py:setup_checkpointer (Task 4 below).
It is INTENTIONALLY NOT called on every startup (research Pitfall 3).
"""
from __future__ import annotations

import logging
import os

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

log = logging.getLogger(__name__)


def _conn_string() -> str:
    """Read SUPABASE_POSTGRES_URL (Railway Postgres connection string).

    NOTE: the var name is a legacy misnomer — this database moved from
    Supabase to a Railway Postgres plugin on 2026-06-12. It must be a
    connection string that supports prepared statements (AsyncPostgresSaver
    uses them via psycopg) — NOT a transaction-mode pooler connection.
    See packages/pipeline/.env.example for the current Railway-accurate
    guidance; 04-RESEARCH.md Pitfall 1 + Pitfall 2 for the original rationale.
    """
    try:
        return os.environ["SUPABASE_POSTGRES_URL"]
    except KeyError as exc:
        raise RuntimeError(
            "SUPABASE_POSTGRES_URL is required. See packages/pipeline/.env.example. "
            "Use the Railway Postgres connection string (Railway project -> "
            "Postgres plugin -> Connect tab), not a transaction-mode pooler "
            "connection (breaks AsyncPostgresSaver's prepared statements)."
        ) from exc


def create_pool(max_size: int = 10) -> AsyncConnectionPool:
    """Construct (but do not open) the psycopg AsyncConnectionPool.

    Defensive defaults (research Pitfall 1):
      - prepare_threshold=None  -> disable prepared statements (PgBouncer-safe).
        Degrades gracefully if env ever points at the transaction pooler.
      - autocommit=True         -> required by AsyncPostgresSaver.
      - row_factory=dict_row    -> required for AsyncPostgresSaver internal queries
                                   AND for assert_tables_exist's dict-style lookup.

    Stale-connection hardening: run df6e982935b94f10ad15c81311c6445e failed on
    2026-10-13 with `psycopg.OperationalError: consuming input failed: SSL
    error: unexpected eof while reading` inside AsyncPostgresSaver.aget_tuple.
    Railway's Postgres proxy had silently closed an idle pooled connection and
    the pool lent it out anyway.
      - check=check_connection -> cheap liveness probe on each connection before
        it is lent out; dead connections are discarded and replaced, never
        returned to the caller.
      - max_idle=120           -> close connections idle longer than 2 minutes,
        before the proxy idle-kills them.
      - keepalives*            -> libpq TCP keepalives (first probe after 30s
        idle, every 10s, 3 failures) so dead peers are detected at the socket
        level.
    """
    return AsyncConnectionPool(
        conninfo=_conn_string(),
        max_size=max_size,
        check=AsyncConnectionPool.check_connection,
        max_idle=120,
        kwargs={
            "autocommit": True,
            "prepare_threshold": None,
            "row_factory": dict_row,
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 3,
        },
        open=False,
    )


def create_checkpointer(pool: AsyncConnectionPool) -> AsyncPostgresSaver:
    """Construct the AsyncPostgresSaver backed by the given pool."""
    return AsyncPostgresSaver(pool)


async def assert_tables_exist(pool: AsyncConnectionPool) -> None:
    """Fail-fast check: do the LangGraph checkpoint tables exist?

    Raises RuntimeError with a clear error message pointing at the CLI
    if the tables are missing (research Pattern 1 + Pitfall 3).
    """
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT to_regclass('public.checkpoints')")
            row = await cur.fetchone()
            if not row or row.get("to_regclass") is None:
                raise RuntimeError(
                    "AsyncPostgresSaver tables not found in the Railway Postgres "
                    "database. Run once: "
                    "`python -m eisenbalm_pipeline.cli setup-checkpointer` "
                    "(or rely on the Railway preDeployCommand in railway.toml)."
                )
    log.info("AsyncPostgresSaver tables verified.")
