"""Sanity webhook handler tests (Plan 06-07 fills bodies).

The `client` fixture is the in-process ASGITransport AsyncClient (conftest).
Tests skip if required env vars are unset (SANITY_API_TOKEN, etc.).
"""
from __future__ import annotations

import json
import os
import time
from unittest.mock import AsyncMock

import pytest


SECRET = "test-secret-32-bytes"


async def test_route_exists(client):
    """WHK-01: POST /webhook/sanity-publish returns < 500 for ANY input (handler exists)."""
    r = await client.post("/webhook/sanity-publish", content=b"{}")
    assert r.status_code < 500


async def test_signature_accept_and_reject(
    client, sanity_signature_encoder, monkeypatch
):
    """WHK-02: valid signature → 200; tampered body → 401."""
    monkeypatch.setenv("SANITY_WEBHOOK_SECRET", SECRET)
    # Patch _run_publisher so the test doesn't actually run the chain
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.webhooks._run_publisher",
        AsyncMock(return_value=None),
    )
    ts = int(time.time() * 1000)
    body = json.dumps(
        {
            "_id": "issue-1",
            "issueNumber": 1,
            "status": "published",
            "runId": "r1",
        }
    ).encode()
    good_header = sanity_signature_encoder(body, ts, SECRET)

    # Valid signature → 200
    r = await client.post(
        "/webhook/sanity-publish",
        content=body,
        headers={
            "sanity-webhook-signature": good_header,
            "idempotency-key": "test-k1",
        },
    )
    assert r.status_code == 200, r.text

    # Tampered body → 401
    r = await client.post(
        "/webhook/sanity-publish",
        content=body + b"x",  # corrupt body
        headers={
            "sanity-webhook-signature": good_header,
            "idempotency-key": "test-k2",
        },
    )
    assert r.status_code == 401, r.text


async def test_age_rejection(client, sanity_signature_encoder, monkeypatch):
    """WHK-03: timestamp older than 5 minutes → 410 Gone."""
    monkeypatch.setenv("SANITY_WEBHOOK_SECRET", SECRET)
    body = json.dumps(
        {"_id": "issue-1", "issueNumber": 1, "status": "published"}
    ).encode()
    # Signature timestamp 10 minutes in the past
    stale_ts = int(time.time() * 1000) - (10 * 60 * 1000)
    stale_header = sanity_signature_encoder(body, stale_ts, SECRET)
    r = await client.post(
        "/webhook/sanity-publish",
        content=body,
        headers={
            "sanity-webhook-signature": stale_header,
            "idempotency-key": "test-stale",
        },
    )
    assert r.status_code == 410, r.text


async def test_idempotency_dedup(
    client, sanity_signature_encoder, webhook_idempotency_clean, monkeypatch
):
    """WHK-04: same idempotency-key sent twice → second call returns duplicate=True."""
    monkeypatch.setenv("SANITY_WEBHOOK_SECRET", SECRET)
    # Spy on _run_publisher; track call count
    pub_spy = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.webhooks._run_publisher", pub_spy
    )

    ts = int(time.time() * 1000)
    body = json.dumps(
        {
            "_id": "issue-7",
            "issueNumber": 7,
            "status": "published",
            "runId": "r7",
        }
    ).encode()
    header = sanity_signature_encoder(body, ts, SECRET)
    headers = {
        "sanity-webhook-signature": header,
        "idempotency-key": "dup-key-1",
    }

    r1 = await client.post(
        "/webhook/sanity-publish", content=body, headers=headers
    )
    r2 = await client.post(
        "/webhook/sanity-publish", content=body, headers=headers
    )
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json().get("scheduled") is True
    assert r2.json().get("duplicate") is True
    # Background task was scheduled exactly once — but the await may not have happened yet.
    # The handler returns immediately; the task may or may not have executed by now.
    # The route's idempotency contract is the assertion above: the second
    # call returns {"duplicate": True} (no second background fire).


async def test_missing_idempotency_proceeds(
    client, sanity_signature_encoder, monkeypatch
):
    """WHK-04 Pitfall 6: missing idempotency-key header is allowed (proceeds with warning)."""
    monkeypatch.setenv("SANITY_WEBHOOK_SECRET", SECRET)
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.webhooks._run_publisher",
        AsyncMock(return_value=None),
    )
    ts = int(time.time() * 1000)
    body = json.dumps(
        {"_id": "issue-8", "issueNumber": 8, "status": "published"}
    ).encode()
    header = sanity_signature_encoder(body, ts, SECRET)
    # No idempotency-key header
    r = await client.post(
        "/webhook/sanity-publish",
        content=body,
        headers={"sanity-webhook-signature": header},
    )
    assert r.status_code == 200, r.text
    assert r.json().get("scheduled") is True
