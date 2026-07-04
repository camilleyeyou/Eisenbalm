"""CLI entrypoint for one-time operations.

Subcommands:
  setup-checkpointer            - Runs AsyncPostgresSaver.setup() against the
                                  Railway Postgres database (SUPABASE_POSTGRES_URL
                                  is a legacy misnomer; the DB moved off Supabase
                                  on 2026-06-12). Idempotent. CONTEXT D-12 +
                                  research Pitfall 3.
  setup-webhook-idempotency     - Creates the webhook_idempotency table for
                                  WHK-04 dedup. Idempotent (CREATE TABLE IF
                                  NOT EXISTS + UNIQUE constraint).
                                  Phase 6 Plan 06-03 + research Pattern 2.
  trigger-weekly                - POSTs an empty JSON body to
                                  {PIPELINE_SELF_URL}/run/weekly with the
                                  X-Pipeline-Trigger-Secret header. Exits 0 on
                                  success (printing the returned runId) and
                                  nonzero with a stderr message on missing
                                  secret / non-2xx / network error so a Railway
                                  cron service marks failed runs. Reads
                                  PIPELINE_TRIGGER_SECRET + PIPELINE_SELF_URL
                                  from env. Implements V2-03.

Invocation:
  python -m eisenbalm_pipeline.cli setup-checkpointer
  python -m eisenbalm_pipeline.cli setup-webhook-idempotency
  python -m eisenbalm_pipeline.cli trigger-weekly

Used by:
  - railway.toml preDeployCommand (Phase 4 + Phase 6 — both setup subcommands)
  - Andrew's manual provisioning (CONTEXT D-29 — railway run ...)
  - A SEPARATE Railway cron service (schedule `0 14 * * 4`) runs
    `trigger-weekly` — NOT the always-on web service. The web service must
    never exit; a cron job must fire and exit. See packages/pipeline/README.md
    "Weekly cron trigger (V2-03)".
"""
from __future__ import annotations

import asyncio
import os
import sys

import httpx
import psycopg
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

USAGE = (
    "Usage:\n"
    "  python -m eisenbalm_pipeline.cli setup-checkpointer\n"
    "  python -m eisenbalm_pipeline.cli setup-webhook-idempotency\n"
    "  python -m eisenbalm_pipeline.cli trigger-weekly"
)

# Production Railway domain the `trigger-weekly` subcommand POSTs to when
# PIPELINE_SELF_URL is unset. Point PIPELINE_SELF_URL at a staging URL to
# trigger a non-prod deploy.
DEFAULT_PIPELINE_SELF_URL = "https://eisenbalm-pipeline-production.up.railway.app"


def _require_postgres_url() -> str:
    try:
        return os.environ["SUPABASE_POSTGRES_URL"]
    except KeyError:
        print(
            "ERROR: SUPABASE_POSTGRES_URL is not set. "
            "See packages/pipeline/.env.example for the Railway Postgres "
            "connection string format (this var now points at Railway "
            "Postgres, not Supabase).",
            file=sys.stderr,
        )
        sys.exit(2)


async def setup_checkpointer() -> None:
    """Run AsyncPostgresSaver.setup() against the configured Railway Postgres.

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
    # psycopg autocommit so the DDL is not wrapped in a transaction a
    # connection pooler may reject.
    async with await psycopg.AsyncConnection.connect(
        db_url, autocommit=True
    ) as conn:
        async with conn.cursor() as cur:
            # Execute the multi-statement DDL one statement at a time so any
            # error points at the right line.
            for stmt in [s.strip() for s in WEBHOOK_IDEMPOTENCY_DDL.split(";") if s.strip()]:
                await cur.execute(stmt)
    print("webhook_idempotency table created / verified.")


async def trigger_weekly() -> None:
    """Fire the weekly run by POSTing to {PIPELINE_SELF_URL}/pipeline/tick (Phase 25 RUN-03).

    Run by a SEPARATE Railway cron service (schedule `0 14 * * 4`), NOT the
    always-on web service. The cron only FIRES the trigger; the web service
    runs the actual graph in a long-lived background task (the graph pauses at
    Editor Gate 1 for hours/days — far longer than a cron job should live).

    /pipeline/tick applies the full five-step guard (kill switch → _is_due →
    one-at-a-time → budget projection → fire) so the CLI no longer needs to
    duplicate any of that logic. Previous endpoint /run/weekly is retained for
    direct manual use but is no longer the canonical cron path.

    Exits 0 on a 2xx response (printing the returned runId or skip reason).
    Exits nonzero with a stderr message on missing secret / non-2xx / network
    error so Railway marks the cron run as failed.
    """
    secret = os.environ.get("PIPELINE_TRIGGER_SECRET")
    if not secret:
        print(
            "ERROR: PIPELINE_TRIGGER_SECRET is not set — cannot authenticate "
            "/pipeline/tick.",
            file=sys.stderr,
        )
        sys.exit(2)

    base_url = os.environ.get(
        "PIPELINE_SELF_URL", DEFAULT_PIPELINE_SELF_URL
    ).rstrip("/")
    url = f"{base_url}/pipeline/tick"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                url,
                headers={"X-Pipeline-Trigger-Secret": secret},
                json={},
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        print(
            f"ERROR: POST {url} returned {exc.response.status_code}: "
            f"{exc.response.text[:500]}",
            file=sys.stderr,
        )
        sys.exit(1)
    except httpx.HTTPError as exc:
        print(f"ERROR: request to {url} failed: {exc}", file=sys.stderr)
        sys.exit(1)

    body = resp.json()
    if body.get("status") == "skipped":
        # /pipeline/tick returns {"status": "skipped", "reason": "..."} when
        # a guard (kill switch, not-due, one-at-a-time, budget) fires.
        # This is a successful cron response — Railway marks the job as passed.
        print(f"Tick skipped: reason={body.get('reason')}")
    else:
        run_id = body.get("runId")
        print(f"Triggered weekly run: runId={run_id}")


_SUBCOMMANDS = {
    "setup-checkpointer": setup_checkpointer,
    "setup-webhook-idempotency": setup_webhook_idempotency,
    "trigger-weekly": trigger_weekly,
}


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in _SUBCOMMANDS:
        print(USAGE, file=sys.stderr)
        sys.exit(1)
    asyncio.run(_SUBCOMMANDS[sys.argv[1]]())


if __name__ == "__main__":
    main()
