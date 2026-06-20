"""Vercel deploy hook trigger (WHK-05).

POSTs to `VERCEL_DEPLOY_HOOK_URL` with no body and no auth — the URL itself
is the credential. Returns the Vercel response body, which includes
`{job: {id, state, createdAt}}`.

TRANSIENT failures (HTTP 429 + 5xx) are retried with a bounded
exponential-ish backoff (honoring a parseable `Retry-After` header when
present). Non-transient 4xx (e.g. 401/404 — a bad/disabled hook URL) raise
immediately. After the bounded number of attempts the last transient error
is re-raised so the caller can decide fatality.

Source: https://vercel.com/docs/deploy-hooks + 06-RESEARCH.md Code Examples.
"""
from __future__ import annotations

import asyncio
import logging
import os

from httpx import AsyncClient

log = logging.getLogger(__name__)

# Bounded retry budget: total POST attempts (including the first) on a
# transient failure. With 3 attempts there are at most 2 backoff sleeps.
_MAX_ATTEMPTS = 3

# Base backoff (seconds). Delay for retry #n (0-indexed attempt) is
# _BASE_BACKOFF_SEC * 2**attempt_index, unless the response carries a
# parseable integer Retry-After header (which then wins).
_BASE_BACKOFF_SEC = 1.0


def _is_transient(status_code: int) -> bool:
    """A transient (retryable) status: rate-limit (429) or any 5xx."""
    return status_code == 429 or 500 <= status_code <= 599


def _retry_delay(response, attempt_index: int) -> float | int:
    """Compute the backoff delay before the next attempt.

    Prefers a parseable integer ``Retry-After`` header (seconds); falls back
    to exponential-ish backoff ``_BASE_BACKOFF_SEC * 2**attempt_index``.
    """
    retry_after = response.headers.get("retry-after")
    if retry_after is not None:
        try:
            return int(retry_after)
        except (ValueError, TypeError):
            pass
    return _BASE_BACKOFF_SEC * (2 ** attempt_index)


async def trigger_vercel_deploy(http: AsyncClient) -> dict:
    """Fire the Vercel deploy hook with bounded retry on transient failures.

    Parameters:
        http: an open httpx.AsyncClient. Caller controls lifecycle; we do
              NOT construct a new client per call (research §"Don't
              Hand-Roll" — reuse the pool registered on app.state).

    Behavior:
        - 2xx: return the parsed JSON (happy path — no sleep).
        - 429 or 5xx (transient): retry up to ``_MAX_ATTEMPTS`` total, sleeping
          a backoff (Retry-After-aware) between attempts via the module-level
          ``asyncio.sleep`` (patchable in tests). After the final attempt,
          ``raise_for_status()`` re-raises the transient error.
        - any other non-2xx (e.g. 401/404): ``raise_for_status()`` immediately
          (no retry, no sleep) — a bad hook URL won't fix itself.

    Returns:
        Parsed JSON response — typically `{"job": {"id": ..., "state": ...,
        "createdAt": ...}}` per Vercel's documented response shape.

    Raises:
        httpx.HTTPStatusError: on a non-transient status (immediately) or
        after the transient-retry budget is exhausted — caller decides
        whether to surface it as a Convex deliberationEvents error.
        KeyError: if VERCEL_DEPLOY_HOOK_URL is unset (fail-loud).
    """
    url = os.environ["VERCEL_DEPLOY_HOOK_URL"]
    log.info("Triggering Vercel deploy hook (URL redacted in logs).")

    for attempt_index in range(_MAX_ATTEMPTS):
        r = await http.post(url, timeout=30.0)

        if r.is_success:
            return r.json()

        if not _is_transient(r.status_code):
            # Non-transient (e.g. 401/404) — raise immediately, no retry.
            r.raise_for_status()

        # Transient (429 / 5xx).
        is_last_attempt = attempt_index == _MAX_ATTEMPTS - 1
        if is_last_attempt:
            # Budget exhausted — surface the error (no sleep after the last).
            r.raise_for_status()

        delay = _retry_delay(r, attempt_index)
        log.warning(
            "Vercel deploy hook returned %s (transient) — retrying in %ss "
            "(attempt %d/%d).",
            r.status_code, delay, attempt_index + 1, _MAX_ATTEMPTS,
        )
        await asyncio.sleep(delay)

    # Unreachable: the loop either returns on success or raises on the last
    # attempt. Present only to satisfy static analysis / guard regressions.
    raise RuntimeError("trigger_vercel_deploy: exhausted retries without raising")
