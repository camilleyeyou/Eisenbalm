"""In-process sliding-window rate limiter for LLM-spending routes.

SINGLE-INSTANCE ASSUMPTION: state lives in this process's memory. That is
correct only because Railway runs exactly one pipeline instance; a restart
resets every window. If the service ever scales horizontally, move the
counters to Redis/Postgres. The dev-mode sentinel sub ("local-dev-operator")
shares one bucket, which is fine for local use.

Limits (per Clerk ``sub``):
  - "llm"        10/min, 60/hour — shared by test-run, score, brief strengthen
                 preview, revise preview, voice-rewrite, claim evidence preview
  - "shadow-run"  2/min, 10/hour — a full Scout discovery (many LLM + search calls)

Denied attempts are NOT recorded, so a blocked caller never extends their own
lockout. Stdlib only.
"""
from __future__ import annotations

import collections
import math
import threading
import time
from typing import Callable, Optional

from fastapi import Depends, HTTPException

_MINUTE = 60.0
_HOUR = 3600.0

LLM_PER_MINUTE = 10
LLM_PER_HOUR = 60
SHADOW_PER_MINUTE = 2
SHADOW_PER_HOUR = 10


class SlidingWindowLimiter:
    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._hits: dict[tuple[str, str], collections.deque] = {}
        self._lock = threading.Lock()

    def check(
        self, bucket: str, key: str, *, per_minute: int, per_hour: int
    ) -> Optional[int]:
        """Record a hit and return None, or return retry-after seconds (denied)."""
        now = self._clock()
        with self._lock:
            hits = self._hits.setdefault((bucket, key), collections.deque())
            while hits and hits[0] <= now - _HOUR:
                hits.popleft()
            in_minute = [t for t in hits if t > now - _MINUTE]
            retry = 0.0
            if len(in_minute) >= per_minute:
                retry = max(retry, in_minute[0] + _MINUTE - now)
            if len(hits) >= per_hour:
                retry = max(retry, hits[0] + _HOUR - now)
            if retry > 0:
                return max(1, math.ceil(retry))
            hits.append(now)
            return None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


_LIMITER = SlidingWindowLimiter()


def reset_rate_limits() -> None:
    """Clear all windows (tests)."""
    _LIMITER.reset()


def rate_limit(
    bucket: str, *, per_minute: int, per_hour: int, auth: Callable
) -> Callable:
    """Dependency factory. ``auth`` is the route's existing guard; FastAPI
    caches it per request, so auth still runs once."""

    async def _dep(claims: dict = Depends(auth)) -> None:
        key = (claims or {}).get("sub") or "anonymous"
        retry = _LIMITER.check(bucket, key, per_minute=per_minute, per_hour=per_hour)
        if retry is not None:
            raise HTTPException(
                status_code=429,
                detail={"reason": "rate_limited", "bucket": bucket, "retryAfter": retry},
                headers={"Retry-After": str(retry)},
            )

    return _dep


def llm_rate_limit(auth: Callable) -> Callable:
    return rate_limit("llm", per_minute=LLM_PER_MINUTE, per_hour=LLM_PER_HOUR, auth=auth)


def shadow_rate_limit(auth: Callable) -> Callable:
    return rate_limit(
        "shadow-run", per_minute=SHADOW_PER_MINUTE, per_hour=SHADOW_PER_HOUR, auth=auth
    )
