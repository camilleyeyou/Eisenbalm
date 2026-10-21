"""Quick 261021-5pr — SlidingWindowLimiter + rate_limit dependency."""
from __future__ import annotations

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from eisenbalm_pipeline.lib import rate_limit as rl
from eisenbalm_pipeline.lib.rate_limit import SlidingWindowLimiter


class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


def _lim():
    c = Clock()
    return c, SlidingWindowLimiter(clock=c)


def test_eleventh_in_minute_denied_with_retry_after():
    c, lim = _lim()
    for _ in range(10):
        assert lim.check("llm", "u", per_minute=10, per_hour=60) is None
        c.t += 1
    # first hit at t=1000, now t=1010 -> expires at 1060 -> 50s
    assert lim.check("llm", "u", per_minute=10, per_hour=60) == 50


def test_window_frees_after_60s():
    c, lim = _lim()
    for _ in range(10):
        lim.check("llm", "u", per_minute=10, per_hour=60)
    assert lim.check("llm", "u", per_minute=10, per_hour=60) is not None
    c.t += 61
    assert lim.check("llm", "u", per_minute=10, per_hour=60) is None


def test_hour_cap_independent():
    c, lim = _lim()
    for _ in range(6):
        for _ in range(10):
            assert lim.check("llm", "u", per_minute=10, per_hour=60) is None
        c.t += 61
    retry = lim.check("llm", "u", per_minute=10, per_hour=60)
    assert retry is not None and retry > 60


def test_independent_keys_and_buckets():
    _, lim = _lim()
    for _ in range(10):
        lim.check("llm", "a", per_minute=10, per_hour=60)
    assert lim.check("llm", "a", per_minute=10, per_hour=60) is not None
    assert lim.check("llm", "b", per_minute=10, per_hour=60) is None
    assert lim.check("other", "a", per_minute=10, per_hour=60) is None


def test_denied_attempts_not_recorded():
    c, lim = _lim()
    for _ in range(2):
        lim.check("s", "u", per_minute=2, per_hour=10)
    for _ in range(50):
        assert lim.check("s", "u", per_minute=2, per_hour=10) is not None
    c.t += 61  # only the 2 real hits matter
    assert lim.check("s", "u", per_minute=2, per_hour=10) is None


def test_dependency_429_shape_and_anonymous_fallback(monkeypatch):
    seen = {}

    def fake_check(bucket, key, *, per_minute, per_hour):
        seen["key"] = key
        return 7

    monkeypatch.setattr(rl._LIMITER, "check", fake_check)

    async def auth() -> dict:
        return {}

    app = FastAPI()

    @app.post("/x", dependencies=[Depends(rl.rate_limit("llm", per_minute=1, per_hour=1, auth=auth))])
    async def x():
        return {}

    r = TestClient(app).post("/x")
    assert r.status_code == 429
    assert r.headers["Retry-After"] == "7"
    assert r.json()["detail"] == {"reason": "rate_limited", "bucket": "llm", "retryAfter": 7}
    assert seen["key"] == "anonymous"
