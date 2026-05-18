"""Sanity webhook receiver (Phase 6 — real handler).

Pipeline:
  1. WHK-02: Verify HMAC signature over raw body (lib/sanity_webhook).
  2. WHK-03: Reject signatures older than (or future-skewed beyond) 5 minutes.
  3. Guard: only process status='published' (ignore in-review / draft transitions).
  4. WHK-04: Dedup via idempotency-key + Supabase webhook_idempotency UNIQUE.
  5. Launch _run_publisher in background via asyncio.create_task (Pattern 4).
  6. Return 200 immediately (CLAUDE.md "Sanity webhook handler MUST return 200 immediately").

The actual PDF + Vercel + Convex chain runs in _run_publisher
(agents/publisher/__init__.py) — same coroutine the manual fallback at
api/runs.py invokes.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os

from fastapi import APIRouter, HTTPException, Request, status

from eisenbalm_pipeline.agents.publisher import _run_publisher
from eisenbalm_pipeline.lib.idempotency import claim_idempotency_key
from eisenbalm_pipeline.lib.sanity_webhook import (
    SIGNATURE_HEADER_NAME,
    SignatureError,
    SignatureExpiredError,
    verify_sanity_signature,
)

log = logging.getLogger(__name__)
router = APIRouter()


@router.post("/webhook/sanity-publish")
async def sanity_publish(request: Request) -> dict:
    """Sanity webhook handler. Returns 200 fast; Publisher runs in background."""

    # Required env (fail-loud if misconfigured at runtime).
    try:
        secret = os.environ["SANITY_WEBHOOK_SECRET"]
    except KeyError:
        log.error("SANITY_WEBHOOK_SECRET is not set — rejecting all webhooks.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SANITY_WEBHOOK_SECRET unset",
        )

    # 1 + 2. WHK-02 + WHK-03: read RAW body THEN verify signature + age.
    raw = await request.body()
    sig_header = request.headers.get(SIGNATURE_HEADER_NAME)
    try:
        ts_ms = verify_sanity_signature(raw, sig_header, secret)
    except SignatureExpiredError as e:
        log.warning("Webhook rejected (expired): %s", e)
        # 410 Gone — "the resource is no longer available" maps cleanly to
        # "this signature is stale."
        raise HTTPException(
            status_code=status.HTTP_410_GONE, detail="Signature too old"
        )
    except SignatureError as e:
        log.warning("Webhook rejected (signature): %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e)
        )

    # 3. Guard on status — Sanity sends transitions; we only care about publish.
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Body is not valid JSON",
        )

    if payload.get("status") != "published":
        log.info(
            "Webhook skipped (status=%s, not 'published').",
            payload.get("status"),
        )
        return {"ok": True, "skipped": "not-published"}

    # 4. WHK-04: idempotency-key dedup.
    idem = request.headers.get("idempotency-key")
    pool = getattr(request.app.state, "pool", None)
    if idem and pool is not None:
        try:
            first = await claim_idempotency_key(
                pool,
                source="sanity-publish",
                idempotency_key=idem,
                run_id=payload.get("runId"),
            )
        except Exception as exc:  # noqa: BLE001 — log + proceed (don't lose webhooks on DB blip)
            log.exception(
                "Idempotency check failed (proceeding anyway): %s", exc
            )
            first = True
        if not first:
            log.info("Webhook deduplicated (idempotency-key=%s).", idem)
            return {"ok": True, "duplicate": True}
    elif not idem:
        # Pitfall 6: missing idempotency-key is a Sanity edge case — log + proceed.
        log.warning(
            "Webhook arrived with no idempotency-key header; proceeding "
            "without dedup."
        )

    # 5. Launch _run_publisher in background (research Pattern 3 / Phase 4
    #    Pitfall 4 — asyncio.create_task, NOT FastAPI BackgroundTasks).
    try:
        issue_id = payload["_id"]
        issue_number = payload["issueNumber"]
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Webhook payload missing required field: {e}",
        )
    run_id = payload.get("runId")  # may be None for manually-authored drafts

    task = asyncio.create_task(
        _run_publisher(
            request.app,
            issue_id=issue_id,
            issue_number=issue_number,
            run_id=run_id,
        )
    )
    request.app.state.background_tasks.add(task)
    task.add_done_callback(request.app.state.background_tasks.discard)
    log.info(
        "Webhook scheduled Publisher: issue_id=%s issue_number=%s run_id=%s "
        "ts_ms=%s",
        issue_id,
        issue_number,
        run_id,
        ts_ms,
    )

    # 6. Return 200 immediately — Publisher runs in background.
    return {"ok": True, "scheduled": True}
