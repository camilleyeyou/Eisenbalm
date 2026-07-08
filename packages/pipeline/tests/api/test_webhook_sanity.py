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

# ── Phase 34 (§34.5, D-07) — D-07 re-validation guard helpers ────────────────
#
# The webhook now re-checks signOffs:activeByRunId before launching the
# publisher. A LEGIT dashboard publish already passed the §34.4 gate before
# flipping Sanity, so both sign-offs are active by the time the webhook
# fires — patch both active so pre-existing test intent (webhook reaches the
# publisher-scheduling path) is preserved.

_BOTH_SIGNOFFS_ACTIVE = {
    "facts-cleared": {"actorId": "user_1", "signedAt": 1},
    "sounds-human": {"actorId": "user_1", "signedAt": 1},
}


def _patch_both_signoffs_active(monkeypatch):
    async def mock_convex_query(http, path, args):
        if path == "signOffs:activeByRunId":
            return dict(_BOTH_SIGNOFFS_ACTIVE)
        return None

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.webhooks._cc.convex_query", mock_convex_query
    )


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
    # D-07 guard: simulate a legit dashboard publish (both sign-offs active)
    # so this signature test still reaches the publisher-scheduling path.
    _patch_both_signoffs_active(monkeypatch)
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
    # D-07 guard: simulate a legit dashboard publish (both sign-offs active).
    _patch_both_signoffs_active(monkeypatch)

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
    # D-07 guard: simulate a legit dashboard publish (both sign-offs active).
    _patch_both_signoffs_active(monkeypatch)
    ts = int(time.time() * 1000)
    body = json.dumps(
        {"_id": "issue-8", "issueNumber": 8, "status": "published", "runId": "r8"}
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


# ── Phase 34 (§34.5, D-07) — sign-off re-validation guard ─────────────────────


async def test_webhook_proceeds_when_both_signoffs_active(
    client, sanity_signature_encoder, monkeypatch
):
    """Both sign-offs active (legit dashboard publish) → publisher IS
    scheduled; no revert, no block."""
    monkeypatch.setenv("SANITY_WEBHOOK_SECRET", SECRET)
    pub_spy = AsyncMock(return_value=None)
    monkeypatch.setattr("eisenbalm_pipeline.api.webhooks._run_publisher", pub_spy)
    revert_spy = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.webhooks._revert_sanity_status", revert_spy
    )
    _patch_both_signoffs_active(monkeypatch)

    ts = int(time.time() * 1000)
    body = json.dumps(
        {
            "_id": "issue-20",
            "issueNumber": 20,
            "status": "published",
            "runId": "r20",
        }
    ).encode()
    header = sanity_signature_encoder(body, ts, SECRET)
    r = await client.post(
        "/webhook/sanity-publish",
        content=body,
        headers={
            "sanity-webhook-signature": header,
            "idempotency-key": "test-both-active",
        },
    )
    assert r.status_code == 200, r.text
    assert r.json().get("scheduled") is True
    assert r.json().get("blocked") is None
    revert_spy.assert_not_called()


async def test_webhook_blocked_when_signoff_missing(
    client, sanity_signature_encoder, monkeypatch
):
    """One sign-off missing → publisher NOT scheduled; Sanity status reverted
    to in-review; an audit row + cost-warning alert are emitted."""
    monkeypatch.setenv("SANITY_WEBHOOK_SECRET", SECRET)
    pub_spy = AsyncMock(return_value=None)
    monkeypatch.setattr("eisenbalm_pipeline.api.webhooks._run_publisher", pub_spy)
    revert_spy = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.webhooks._revert_sanity_status", revert_spy
    )
    audit_spy = AsyncMock(return_value=None)
    monkeypatch.setattr("eisenbalm_pipeline.api.webhooks._emit_audit", audit_spy)

    mutation_calls: list[tuple[str, dict]] = []

    async def mock_convex_query(http, path, args):
        if path == "signOffs:activeByRunId":
            # sounds-human missing.
            return {"facts-cleared": {"actorId": "user_1", "signedAt": 1}}
        return None

    async def mock_convex_mutation(http, path, args):
        mutation_calls.append((path, args))
        return None

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.webhooks._cc.convex_query", mock_convex_query
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.webhooks._cc.convex_mutation", mock_convex_mutation
    )

    ts = int(time.time() * 1000)
    body = json.dumps(
        {
            "_id": "issue-21",
            "issueNumber": 21,
            "status": "published",
            "runId": "r21",
        }
    ).encode()
    header = sanity_signature_encoder(body, ts, SECRET)
    r = await client.post(
        "/webhook/sanity-publish",
        content=body,
        headers={
            "sanity-webhook-signature": header,
            "idempotency-key": "test-missing-signoff",
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("blocked") == "missing_signoffs"
    assert data.get("missing") == ["sounds-human"]
    pub_spy.assert_not_called()
    revert_spy.assert_awaited_once()
    assert revert_spy.call_args.args[1] == "issue-21"
    assert revert_spy.call_args.kwargs.get("status") == "in-review"
    audit_spy.assert_awaited_once()
    assert audit_spy.call_args.kwargs.get("action") == "run.publish_bypass_blocked"
    assert any(path == "deliberationEvents:insert" for path, _ in mutation_calls)
    cost_warning_calls = [
        args for path, args in mutation_calls if path == "deliberationEvents:insert"
    ]
    assert cost_warning_calls[0]["eventType"] == "cost-warning"
    inner_payload = json.loads(cost_warning_calls[0]["payload"])
    assert inner_payload["eventType"] == "publish-bypass-blocked"


async def test_webhook_blocked_when_run_id_absent(
    client, sanity_signature_encoder, monkeypatch
):
    """payload.runId absent (run-less manually-authored draft) → BLOCKED
    identically; the run-less spirit of D-07 (Research Open Q#2)."""
    monkeypatch.setenv("SANITY_WEBHOOK_SECRET", SECRET)
    pub_spy = AsyncMock(return_value=None)
    monkeypatch.setattr("eisenbalm_pipeline.api.webhooks._run_publisher", pub_spy)
    revert_spy = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.webhooks._revert_sanity_status", revert_spy
    )
    audit_spy = AsyncMock(return_value=None)
    monkeypatch.setattr("eisenbalm_pipeline.api.webhooks._emit_audit", audit_spy)
    # Guard should short-circuit on run_id is None WITHOUT even querying
    # signOffs:activeByRunId — but patch it anyway so a regression that DOES
    # query doesn't hit real Convex.
    query_spy = AsyncMock(return_value={})
    monkeypatch.setattr("eisenbalm_pipeline.api.webhooks._cc.convex_query", query_spy)
    mutation_spy = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.webhooks._cc.convex_mutation", mutation_spy
    )

    ts = int(time.time() * 1000)
    body = json.dumps(
        {"_id": "issue-22", "issueNumber": 22, "status": "published"}
    ).encode()  # no runId key at all
    header = sanity_signature_encoder(body, ts, SECRET)
    r = await client.post(
        "/webhook/sanity-publish",
        content=body,
        headers={
            "sanity-webhook-signature": header,
            "idempotency-key": "test-no-run-id",
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("blocked") == "missing_signoffs"
    pub_spy.assert_not_called()
    revert_spy.assert_awaited_once()
    assert revert_spy.call_args.args[1] == "issue-22"
    audit_spy.assert_awaited_once()
    assert audit_spy.call_args.kwargs.get("action") == "run.publish_bypass_blocked"
