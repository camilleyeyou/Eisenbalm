"""Webhook idempotency-key dedup (WHK-04).

Atomic INSERT ON CONFLICT against the `webhook_idempotency` Postgres table
(DDL lives in cli.py::WEBHOOK_IDEMPOTENCY_DDL, run by railway.toml
preDeployCommand). The UNIQUE constraint (source, idempotency_key) is the
atomic guarantee Sanity's retries cannot defeat.

Source: 06-RESEARCH.md Pattern 2 + Pitfall 6.
"""
from __future__ import annotations

from typing import Optional

from psycopg_pool import AsyncConnectionPool


async def claim_idempotency_key(
    pool: AsyncConnectionPool,
    *,
    source: str,
    idempotency_key: str,
    run_id: Optional[str],
) -> bool:
    """Returns True iff this is the first time we've seen (source, idempotency_key).

    Inserts a row into webhook_idempotency. On UNIQUE conflict (duplicate),
    the INSERT is a no-op and RETURNING id yields nothing — return False so
    the caller can short-circuit the webhook handler.

    Caller MUST handle exceptions (e.g., pool closed, table missing): this
    function does NOT swallow psycopg errors — they propagate so the
    webhook handler can decide between "fail loud" and "log + proceed".

    Parameters:
        pool: opened AsyncConnectionPool (typically app.state.pool from FastAPI lifespan).
        source: webhook source identifier — 'sanity-publish' for Phase 6.
        idempotency_key: contents of the idempotency-key header.
        run_id: optional pipelineRuns.runId for cross-reference. May be None.

    Returns:
        True if newly claimed (this is the first delivery).
        False if duplicate (the caller should return early with {"duplicate": True}).
    """
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(
            (
                "INSERT INTO webhook_idempotency (idempotency_key, source, run_id) "
                "VALUES (%s, %s, %s) "
                "ON CONFLICT (source, idempotency_key) DO NOTHING "
                "RETURNING id"
            ),
            (idempotency_key, source, run_id),
        )
        row = await cur.fetchone()
        return row is not None
