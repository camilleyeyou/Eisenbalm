"""Quick 260720-gic — hermetic RED-gated regression test for the Publisher
webhook self-echo loop (CONFIRMED production incident: run d9c09fa7 /
issue-999604).

The Publisher's step 3 patches `problemPdf` on the already-published
weeklyIssue doc, which RE-FIRES the Sanity publish webhook. Each echo carries
a FRESH `idempotency-key` header (so the existing WHK-04 header-key dedup
never catches it) and the operator's sign-offs stay active the whole time (so
the §34.5 re-check never blocks it) -> an infinite ~2s publish loop.

This module builds a bare, hermetic FastAPI app (mirrors
tests/test_publish_bridge.py::_build_app) that includes ONLY the webhook
router, so it runs regardless of env — the `client` / `webhook_idempotency_clean`
fixtures in tests/conftest.py SKIP without SUPABASE_POSTGRES_URL and so cannot
carry a RED gate.

TEST A (`test_self_echo_schedules_publisher_once`) is the mandatory RED gate:
against the CURRENT (unfixed) webhooks.py, two webhook deliveries for the
SAME issue_id with DIFFERENT idempotency-keys schedule `_run_publisher` TWICE
(no guard keys the claim on issue_id — only the header key, which differs per
echo). After the fix (quick 260720-gic Task 2), it is scheduled EXACTLY ONCE.

TEST B (`test_single_delivery_still_schedules_once`) asserts the happy path
(a single webhook delivery) is unaffected by the fix.
"""
from __future__ import annotations

import asyncio
import json
import time
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from eisenbalm_pipeline.api.webhooks import router as webhook_router

pytestmark = pytest.mark.anyio

SECRET = "test-secret-32-bytes"


def _build_app() -> FastAPI:
    """Bare hermetic app: webhook router only, manually-set app.state — no
    real Postgres/Convex/Sanity connections, no env dependency."""
    app = FastAPI()
    app.include_router(webhook_router)
    app.state.pool = MagicMock()  # truthy sentinel so `pool is not None` runs
    app.state.convex_http = MagicMock()
    app.state.background_tasks = set()
    return app


def _wire(monkeypatch) -> AsyncMock:
    """Wire the self-echo reproduction: env secret, a STATEFUL fake claim
    modeling the atomic UNIQUE(source, idempotency_key) constraint, a spy on
    _run_publisher, and both sign-offs active (mirrors a legit dashboard
    publish, per tests/api/test_webhook_sanity.py's D-07 guard pattern)."""
    monkeypatch.setenv("SANITY_WEBHOOK_SECRET", SECRET)

    claimed: set[tuple[str, str]] = set()

    async def fake_claim(pool, *, source, idempotency_key, run_id):  # noqa: ARG001
        key = (source, idempotency_key)
        if key in claimed:
            return False
        claimed.add(key)
        return True

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.webhooks.claim_idempotency_key", fake_claim
    )

    pub_spy = AsyncMock(return_value=None)
    monkeypatch.setattr("eisenbalm_pipeline.api.webhooks._run_publisher", pub_spy)

    async def mock_query(http, path, args):  # noqa: ARG001
        if path == "signOffs:activeByRunId":
            return {
                "facts-cleared": {"actorId": "u", "signedAt": 1},
                "sounds-human": {"actorId": "u", "signedAt": 1},
            }
        return None

    monkeypatch.setattr("eisenbalm_pipeline.api.webhooks._cc.convex_query", mock_query)

    return pub_spy


async def _post(client: AsyncClient, encoder, *, idem: str):
    """POST the fixed self-echo reproduction body (issue-999604 / run
    d9c09fa7 — the exact CONFIRMED echo shape) with a FRESH valid signature
    and the given idempotency-key header."""
    body = json.dumps(
        {
            "_id": "issue-999604",
            "issueNumber": 999604,
            "status": "published",
            "runId": "d9c09fa7",
        }
    ).encode()
    ts = int(time.time() * 1000)
    sig = encoder(body, ts, SECRET)
    return await client.post(
        "/webhook/sanity-publish",
        content=body,
        headers={
            "sanity-webhook-signature": sig,
            "idempotency-key": idem,
        },
    )


async def test_self_echo_schedules_publisher_once(
    monkeypatch, sanity_signature_encoder
) -> None:
    """RED GATE: two webhook deliveries for the SAME issue_id with DIFFERENT
    header idempotency-keys (the exact self-echo shape — Publisher's own
    problemPdf patch re-fires the webhook with a fresh Sanity mutation, hence
    a fresh idempotency-key) must schedule `_run_publisher` EXACTLY ONCE.

    Against the CURRENT (unfixed) webhooks.py this fails: pub_spy.await_count
    == 2, because only the header-key dedup exists and it does not fire (each
    echo has a distinct key).
    """
    pub_spy = _wire(monkeypatch)
    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r1 = await _post(client, sanity_signature_encoder, idem="echo-hdr-1")
        r2 = await _post(client, sanity_signature_encoder, idem="echo-hdr-2")

    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text

    # Let the fire-and-forget asyncio.create_task run.
    await asyncio.sleep(0)

    assert pub_spy.await_count == 1, (
        f"expected _run_publisher scheduled exactly once, got "
        f"{pub_spy.await_count} — the self-echo loop is NOT fixed"
    )
    assert r2.json().get("duplicate") == "self-echo", r2.text


async def test_single_delivery_still_schedules_once(
    monkeypatch, sanity_signature_encoder
) -> None:
    """Happy path preserved: a single webhook delivery still schedules the
    Publisher exactly once."""
    pub_spy = _wire(monkeypatch)
    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await _post(client, sanity_signature_encoder, idem="solo-1")

    assert r.status_code == 200, r.text
    assert r.json().get("scheduled") is True, r.text

    await asyncio.sleep(0)

    assert pub_spy.await_count == 1
