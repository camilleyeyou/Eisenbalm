"""AsyncPostgresSaver checkpointer (PIP-09).

Plan 10 will fill in:

- Call `setup_checkpointer()` twice; both succeed (idempotent —
  CONTEXT D-12 + research Pitfall 3)
- Assert the four tables exist in Supabase Postgres:
  checkpoints, checkpoint_writes, checkpoint_blobs, checkpoint_migrations
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
    """PIP-09: AsyncPostgresSaver.setup() can be invoked repeatedly without error."""
    pass
