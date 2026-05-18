"""Vercel deploy hook trigger (WHK-05).

POSTs to `VERCEL_DEPLOY_HOOK_URL` with no body and no auth — the URL itself
is the credential. Returns the Vercel response body, which includes
`{job: {id, state, createdAt}}`.

Source: https://vercel.com/docs/deploy-hooks + 06-RESEARCH.md Code Examples.
"""
from __future__ import annotations

import logging
import os

from httpx import AsyncClient

log = logging.getLogger(__name__)


async def trigger_vercel_deploy(http: AsyncClient) -> dict:
    """Fire the Vercel deploy hook. Raises on non-2xx.

    Parameters:
        http: an open httpx.AsyncClient. Caller controls lifecycle; we do
              NOT construct a new client per call (research §"Don't
              Hand-Roll" — reuse the pool registered on app.state).

    Returns:
        Parsed JSON response — typically `{"job": {"id": ..., "state": ...,
        "createdAt": ...}}` per Vercel's documented response shape.

    Raises:
        httpx.HTTPStatusError: on 4xx/5xx — caller decides whether to retry
        or surface as a Convex deliberationEvents error.
        KeyError: if VERCEL_DEPLOY_HOOK_URL is unset (fail-loud).
    """
    url = os.environ["VERCEL_DEPLOY_HOOK_URL"]
    log.info("Triggering Vercel deploy hook (URL redacted in logs).")
    r = await http.post(url, timeout=30.0)
    r.raise_for_status()
    return r.json()
