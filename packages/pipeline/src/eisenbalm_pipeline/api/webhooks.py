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

import eisenbalm_pipeline.lib.convex_client as _cc
from eisenbalm_pipeline.agents.publisher import _run_publisher
from eisenbalm_pipeline.api.control import _emit_audit
from eisenbalm_pipeline.lib.idempotency import claim_idempotency_key
from eisenbalm_pipeline.lib.sanity_publish import _revert_sanity_status
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

    # Phase 34 (§34.5, D-07, PUB-02) — re-validate sign-off state before the
    # publisher runs. Closes the Studio status-flip bypass: a direct flip skips the
    # dashboard's §34.4 gate, so its sign-offs are absent and this reverts + blocks.
    # A LEGIT dashboard publish flips Sanity only AFTER its gate passed, so both
    # sign-offs are already active here and this check passes — no race.
    convex_http = getattr(request.app.state, "convex_http", None)
    sanity_http = getattr(request.app.state, "sanity_http", None)
    active = (
        await _cc.convex_query(convex_http, "signOffs:activeByRunId", {"runId": run_id})
        if run_id else {}
    ) or {}
    missing = [k for k in ("facts-cleared", "sounds-human") if k not in active]
    if run_id is None or missing:
        log.warning("Webhook publish BLOCKED — run=%s missing=%s", run_id, missing)
        try:
            await _revert_sanity_status(sanity_http, issue_id, status="in-review")
        except Exception:  # noqa: BLE001 — still return 200; the block already happened by not launching the publisher
            log.exception("revert failed for issue=%s (publisher still NOT launched)", issue_id)
        await _emit_audit(
            convex_http, actor_id="webhook", action="run.publish_bypass_blocked",
            resource_type="run", resource_id=run_id or issue_id,
            after=json.dumps({"missing": missing, "reason": "missing_signoffs" if run_id else "no_run_id"}),
        )
        # §34.6b — reuse the FROZEN deliberationEvents.eventType union (Phase 27 D-04:
        # do NOT add a new literal). Outer "cost-warning" routes to notification
        # dispatch; the real semantic name rides in the inner payload. Known tradeoff:
        # the alert email subject renders "budget" (same as auto-publish-enabled).
        try:
            await _cc.convex_mutation(convex_http, "deliberationEvents:insert", {
                "runId": run_id or issue_id,
                "agentId": "webhook",
                "eventType": "cost-warning",
                "payload": json.dumps({"eventType": "publish-bypass-blocked", "runId": run_id, "missing": missing}),
            })
        except Exception:  # noqa: BLE001
            log.warning("bypass alert emit failed for run=%s (non-blocking)", run_id)
        return {"ok": True, "blocked": "missing_signoffs", "missing": missing}

    # ── Self-echo guard (quick 260720-gic) ──────────────────────────────────
    # Publisher step 3 patches problemPdf on the already-published doc, which
    # RE-FIRES this webhook. Each echo carries a DISTINCT header idempotency-key
    # (so the WHK-04 dedup above never catches it) and the operator's sign-offs
    # stay active (so the §34.5 gate above never blocks it) → an infinite ~2s
    # publish loop (CONFIRMED: run d9c09fa7 / issue-999604).
    #
    # Atomically claim (publisher-run, issue_id) BEFORE scheduling: the FIRST
    # webhook for a published issue wins and schedules; every problemPdf echo
    # finds it claimed → skip. INSERT ON CONFLICT is race-safe by construction,
    # so this holds even though Publisher patches problemPdf (step 3) BEFORE it
    # writes status=complete (step 6). A DISTINCT source keeps these rows off the
    # header-key dedup namespace. Placed AFTER the sign-off gate so a blocked/
    # reverted publish does NOT consume the claim (a later legit publish must pass).
    # Operator re-publish is unaffected: publish_manual (control.py) and
    # manual_publish (runs.py) call _run_publisher DIRECTLY, not via this webhook.
    if pool is not None:
        try:
            first_publish = await claim_idempotency_key(
                pool,
                source="publisher-run",
                idempotency_key=issue_id,
                run_id=run_id,
            )
        except Exception as exc:  # noqa: BLE001 — a DB blip must not drop a real publish
            log.exception(
                "publisher-run claim failed for issue=%s (proceeding): %s",
                issue_id,
                exc,
            )
            first_publish = True
        if not first_publish:
            log.info(
                "publisher already scheduled for %s, skipping self-echo",
                issue_id,
            )
            return {"ok": True, "duplicate": "self-echo"}

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
