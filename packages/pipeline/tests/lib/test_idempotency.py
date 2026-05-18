"""Postgres webhook_idempotency tests (Plan 06-04 fills bodies).

NOTE: These tests require a live Supabase Postgres reachable via
SUPABASE_POSTGRES_URL with the webhook_idempotency table created
(setup-webhook-idempotency CLI). The webhook_idempotency_clean fixture
TRUNCATEs before each test for isolation. Tests skip if env unset.
"""
from __future__ import annotations

import pytest

from eisenbalm_pipeline.lib.idempotency import claim_idempotency_key


async def test_dedup_returns_true_on_first(webhook_idempotency_clean):
    """WHK-04: first claim_idempotency_key call returns True."""
    pool = webhook_idempotency_clean
    first = await claim_idempotency_key(
        pool,
        source="sanity-publish",
        idempotency_key="key-001",
        run_id="run-abc",
    )
    assert first is True


async def test_dedup_returns_false_on_second(webhook_idempotency_clean):
    """WHK-04: second call with same (source, idempotency_key) returns False."""
    pool = webhook_idempotency_clean
    first = await claim_idempotency_key(
        pool, source="sanity-publish", idempotency_key="key-002", run_id="run-x"
    )
    second = await claim_idempotency_key(
        pool, source="sanity-publish", idempotency_key="key-002", run_id="run-x"
    )
    assert first is True
    assert second is False


async def test_different_source_independent(webhook_idempotency_clean):
    """WHK-04: same idempotency_key under different source values are independent."""
    pool = webhook_idempotency_clean
    a = await claim_idempotency_key(
        pool, source="sanity-publish", idempotency_key="key-003", run_id=None
    )
    b = await claim_idempotency_key(
        pool, source="future-source", idempotency_key="key-003", run_id=None
    )
    assert a is True
    assert b is True  # different source → no conflict
