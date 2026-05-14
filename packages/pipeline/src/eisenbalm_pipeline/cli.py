"""CLI entrypoint for one-time operations.

Currently exposes one subcommand:
  setup-checkpointer  - Runs AsyncPostgresSaver.setup() against Supabase.
                        Idempotent. CONTEXT D-12 + research Pitfall 3.

Invocation:
  python -m eisenbalm_pipeline.cli setup-checkpointer

Used by:
  - railway.toml preDeployCommand (Plan 01 wired this)
  - Andrew's manual provisioning (CONTEXT D-29 — railway run ...)
"""
from __future__ import annotations

import asyncio
import os
import sys

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver


async def setup_checkpointer() -> None:
    """Run AsyncPostgresSaver.setup() against the configured Supabase Postgres.

    Idempotent: creates the 4 LangGraph tables (checkpoints, checkpoint_writes,
    checkpoint_blobs, checkpoint_migrations) if they don't exist. Acquires an
    advisory lock during DDL — safe under concurrent invocation, but should
    only run once per deploy in practice.

    Uses AsyncPostgresSaver.from_conn_string() (single-use async-with) — the
    lifespan path in graph/checkpointer.py uses AsyncConnectionPool +
    AsyncPostgresSaver(pool) because that pattern reuses connections across
    many requests; here we just need a single connection for a one-shot DDL.
    Both patterns coexist per research §1.
    """
    try:
        db_url = os.environ["SUPABASE_POSTGRES_URL"]
    except KeyError:
        print(
            "ERROR: SUPABASE_POSTGRES_URL is not set. "
            "See packages/pipeline/.env.example for the session pooler format.",
            file=sys.stderr,
        )
        sys.exit(2)

    async with AsyncPostgresSaver.from_conn_string(db_url) as cp:
        await cp.setup()
        print("Checkpointer tables created / verified.")


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] != "setup-checkpointer":
        print(
            "Usage: python -m eisenbalm_pipeline.cli setup-checkpointer",
            file=sys.stderr,
        )
        sys.exit(1)
    asyncio.run(setup_checkpointer())


if __name__ == "__main__":
    main()
