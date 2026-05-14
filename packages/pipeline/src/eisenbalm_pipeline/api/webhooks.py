"""Sanity webhook receiver (Phase 4 stub; Phase 6 hardens).

Phase 4 endpoint shape only — returns 200 with a marker payload so:
  1. Sanity webhook configuration tests against this URL pass.
  2. The route lives at the correct path for Phase 6 to wire.

Phase 6 will add HMAC verification, sanity-transaction-time age check,
idempotency-key deduplication via Supabase, 30s delay before Vercel deploy
hook, and actual Publisher trigger. See API_CONTRACTS §5.3.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Request

log = logging.getLogger(__name__)
router = APIRouter()


@router.post("/webhook/sanity-publish")
async def sanity_publish(request: Request) -> dict:
    """Phase 4 stub — returns 200 immediately.

    # TODO(Phase 6): HMAC verification, age check, idempotency-key dedup.
    Phase 6 will:
      - Verify HMAC against SANITY_WEBHOOK_SECRET using request.body() raw
      - Reject if sanity-transaction-time is older than 5 minutes
      - Deduplicate via idempotency-key header
      - Wait 30 seconds before triggering the Vercel deploy hook
      - Invoke the Publisher node for the runId in payload
    """
    log.info(
        "POST /webhook/sanity-publish (Phase 4 stub) — headers=%s",
        dict(request.headers),
    )
    return {
        "ok": True,
        "phase4Stub": True,
        "note": (
            "POST /webhook/sanity-publish is a Phase 4 endpoint stub. "
            "Phase 6 wires the full HMAC + idempotency + Vercel deploy chain."
        ),
    }
