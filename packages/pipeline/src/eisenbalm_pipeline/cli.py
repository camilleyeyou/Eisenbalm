"""CLI entrypoint for one-time operations.

Subcommands:
  setup-checkpointer            - Runs AsyncPostgresSaver.setup() against
                                  Supabase. Idempotent. CONTEXT D-12 +
                                  research Pitfall 3.
  setup-webhook-idempotency     - Creates the webhook_idempotency table for
                                  WHK-04 dedup. Idempotent (CREATE TABLE IF
                                  NOT EXISTS + UNIQUE constraint).
                                  Phase 6 Plan 06-03 + research Pattern 2.

Invocation:
  python -m eisenbalm_pipeline.cli setup-checkpointer
  python -m eisenbalm_pipeline.cli setup-webhook-idempotency

Used by:
  - railway.toml preDeployCommand (Phase 4 + Phase 6 — both subcommands run)
  - Andrew's manual provisioning (CONTEXT D-29 — railway run ...)
"""
from __future__ import annotations

import asyncio
import os
import sys

import psycopg
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

USAGE = (
    "Usage:\n"
    "  python -m eisenbalm_pipeline.cli setup-checkpointer\n"
    "  python -m eisenbalm_pipeline.cli setup-webhook-idempotency"
)


def _require_postgres_url() -> str:
    try:
        return os.environ["SUPABASE_POSTGRES_URL"]
    except KeyError:
        print(
            "ERROR: SUPABASE_POSTGRES_URL is not set. "
            "See packages/pipeline/.env.example for the session pooler format.",
            file=sys.stderr,
        )
        sys.exit(2)


async def setup_checkpointer() -> None:
    """Run AsyncPostgresSaver.setup() against the configured Supabase Postgres.

    Idempotent. Creates the 4 LangGraph checkpoint tables if they don't exist.
    """
    db_url = _require_postgres_url()
    async with AsyncPostgresSaver.from_conn_string(db_url) as cp:
        await cp.setup()
        print("Checkpointer tables created / verified.")


# Phase 6 PLan 06-03 — webhook_idempotency table (research Pattern 2)
WEBHOOK_IDEMPOTENCY_DDL = """
CREATE TABLE IF NOT EXISTS webhook_idempotency (
    id              BIGSERIAL   PRIMARY KEY,
    idempotency_key TEXT        NOT NULL,
    source          TEXT        NOT NULL,
    run_id          TEXT        NULL,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT webhook_idempotency_key_source UNIQUE (source, idempotency_key)
);
CREATE INDEX IF NOT EXISTS webhook_idempotency_received_at_idx
    ON webhook_idempotency (received_at);
"""


async def setup_webhook_idempotency() -> None:
    """Create the webhook_idempotency table for WHK-04 dedup.

    Idempotent: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS. Safe
    to run on every Railway deploy via preDeployCommand. The UNIQUE
    constraint on (source, idempotency_key) is the atomic dedup guarantee
    Sanity retries cannot defeat (research Pattern 2 + Pitfall 6).
    """
    db_url = _require_postgres_url()
    # psycopg autocommit so the DDL is not wrapped in a transaction the
    # Supabase pooler may reject.
    async with await psycopg.AsyncConnection.connect(
        db_url, autocommit=True
    ) as conn:
        async with conn.cursor() as cur:
            # Execute the multi-statement DDL one statement at a time so any
            # error points at the right line.
            for stmt in [s.strip() for s in WEBHOOK_IDEMPOTENCY_DDL.split(";") if s.strip()]:
                await cur.execute(stmt)
    print("webhook_idempotency table created / verified.")


_SUBCOMMANDS = {
    "setup-checkpointer": setup_checkpointer,
    "setup-webhook-idempotency": setup_webhook_idempotency,
}


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in _SUBCOMMANDS:
        print(USAGE, file=sys.stderr)
        sys.exit(1)
    asyncio.run(_SUBCOMMANDS[sys.argv[1]]())


if __name__ == "__main__":
    main()
