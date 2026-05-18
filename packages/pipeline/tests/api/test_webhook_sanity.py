"""Sanity webhook handler tests. Plan 06-07 unskips."""
from __future__ import annotations

import pytest


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (WHK-01)")
async def test_route_exists(client):
    """WHK-01: POST /webhook/sanity-publish returns < 500 for ANY input (handler exists)."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (WHK-02)")
async def test_signature_accept_and_reject(client, sanity_signature_encoder, monkeypatch):
    """WHK-02: valid signature → 200; tampered body → 401."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (WHK-03)")
async def test_age_rejection(client, sanity_signature_encoder, monkeypatch):
    """WHK-03: timestamp older than 5 minutes → 410 Gone."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (WHK-04)")
async def test_idempotency_dedup(client, sanity_signature_encoder, webhook_idempotency_clean, monkeypatch):
    """WHK-04: same idempotency-key sent twice → publisher fires exactly once."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (WHK-04 Pitfall 6)")
async def test_missing_idempotency_proceeds(client, sanity_signature_encoder, monkeypatch):
    """WHK-04 Pitfall 6: missing idempotency-key header is allowed (proceeds with warning)."""
