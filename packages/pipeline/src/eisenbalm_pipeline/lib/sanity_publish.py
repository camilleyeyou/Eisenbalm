"""Shared Sanity-status flip helper — Phase 26 D-01.

Reused by:
  - api/review.py  POST /issues/{run_id}/publish  (manual review approval)
  - api/control.py pipeline_tick scheduled-publish sweep (D-02)

Both paths converge here so the Sanity-flip + webhook chain fires exactly once
per publish regardless of trigger source.

NOTE: This helper does NOT call _run_publisher directly.  Flipping the Sanity
weeklyIssue.status to "published" fires the existing Sanity webhook
(api/webhooks.py), which calls asyncio.create_task(_run_publisher(...)).
All PDF generation, Vercel deploy, and Convex pipelineRuns:updateStatus
status="complete" happen inside _run_publisher — NOT here.
"""
from __future__ import annotations

import logging
import os

from httpx import AsyncClient

log = logging.getLogger(__name__)

_API_VERSION = "v2024-01-01"


def _dataset() -> str:
    return os.environ.get("NEXT_PUBLIC_SANITY_DATASET", "production")


def _auth_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {os.environ['SANITY_API_TOKEN']}",
        "Content-Type": "application/json",
    }


async def _flip_sanity_published(http: AsyncClient, sanity_issue_id: str) -> None:
    """PATCH weeklyIssue.status to "published" on Sanity.

    Uses the Sanity mutate/patch endpoint — identical request style to
    ``lib/sanity_client.py`` (which this module intentionally mirrors so both
    live in lib/ with the same auth/API-version patterns).

    On HTTP or Sanity error the exception propagates — callers (publish
    endpoint + tick sweep) handle/log it.  A failed flip means the issue is
    NOT published; the caller must surface the error to the operator.

    This helper does NOT call _run_publisher directly.  Flipping the Sanity
    status to "published" fires the existing Sanity webhook
    (api/webhooks.py → asyncio.create_task(_run_publisher(...))) so PDF
    generation and Vercel deploy happen via the proven webhook path (D-01).
    """
    dataset = _dataset()
    r = await http.post(
        f"/{_API_VERSION}/data/mutate/{dataset}",
        json={
            "mutations": [
                {
                    "patch": {
                        "id": sanity_issue_id,
                        "set": {"status": "published"},
                    }
                }
            ]
        },
        headers=_auth_headers(),
    )
    r.raise_for_status()
    log.info(
        "_flip_sanity_published: %s status=published (webhook will invoke _run_publisher)",
        sanity_issue_id,
    )


async def _revert_sanity_status(
    http: AsyncClient, sanity_issue_id: str, *, status: str = "in-review"
) -> None:
    """Inverse of _flip_sanity_published (§34.7, D-07) — reverts a Studio-flip
    bypass attempt. 'in-review' is the valid non-published weeklyIssue.status
    value (apps/studio/schemas/weeklyIssue.ts). On error the exception
    propagates to the caller (the webhook logs + still returns 200)."""
    dataset = _dataset()
    r = await http.post(
        f"/{_API_VERSION}/data/mutate/{dataset}",
        json={"mutations": [{"patch": {"id": sanity_issue_id, "set": {"status": status}}}]},
        headers=_auth_headers(),
    )
    r.raise_for_status()
    log.info("_revert_sanity_status: %s status=%s (publish bypass blocked)", sanity_issue_id, status)
