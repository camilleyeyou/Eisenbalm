"""Vercel deploy hook trigger tests (Plan 06-04 fills bodies).

Uses respx to mock the HTTP call — never actually fires a deploy.

quick-260620-hp3 adds bounded-retry/backoff coverage. Backoff sleep is
patched at ``eisenbalm_pipeline.lib.vercel_client.asyncio.sleep`` with an
AsyncMock so the suite never actually sleeps.
"""
from __future__ import annotations

import os
from unittest.mock import AsyncMock

import httpx
import pytest
import respx

from eisenbalm_pipeline.lib.vercel_client import (
    _MAX_ATTEMPTS,
    trigger_vercel_deploy,
)

HOOK_URL = "https://api.vercel.com/v1/integrations/deploy/test-hook-id"


async def test_trigger_posts_to_hook_url(monkeypatch):
    """WHK-05: trigger_vercel_deploy POSTs (no body, no auth) to VERCEL_DEPLOY_HOOK_URL."""
    monkeypatch.setenv("VERCEL_DEPLOY_HOOK_URL", HOOK_URL)
    sleep_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "eisenbalm_pipeline.lib.vercel_client.asyncio.sleep", sleep_mock
    )
    async with respx.mock(assert_all_called=True) as router:
        route = router.post(HOOK_URL).mock(
            return_value=httpx.Response(
                201, json={"job": {"id": "abc", "state": "READY", "createdAt": 1}}
            )
        )
        async with httpx.AsyncClient() as http:
            result = await trigger_vercel_deploy(http)
        assert route.called
        assert route.calls.last.request.method == "POST"
        # No body
        assert route.calls.last.request.content == b""
        # No Authorization header
        header_names = {k.lower() for k, _ in route.calls.last.request.headers.raw}
        assert b"authorization" not in header_names
        assert result == {"job": {"id": "abc", "state": "READY", "createdAt": 1}}
        # Happy path MUST NOT sleep.
        sleep_mock.assert_not_awaited()


async def test_trigger_raises_on_non_2xx(monkeypatch):
    """WHK-05: persistent 5xx from Vercel raises after retries are exhausted."""
    monkeypatch.setenv("VERCEL_DEPLOY_HOOK_URL", HOOK_URL)
    monkeypatch.setattr(
        "eisenbalm_pipeline.lib.vercel_client.asyncio.sleep",
        AsyncMock(return_value=None),
    )
    # 500 on every call (assert_all_called=False so the retry loop may call
    # the route multiple times) — it must still ultimately raise.
    async with respx.mock(assert_all_called=False) as router:
        router.post(HOOK_URL).mock(return_value=httpx.Response(500))
        async with httpx.AsyncClient() as http:
            with pytest.raises(httpx.HTTPStatusError):
                await trigger_vercel_deploy(http)


async def test_retries_on_429_then_succeeds(monkeypatch):
    """A transient 429 is retried; the subsequent 2xx is returned."""
    monkeypatch.setenv("VERCEL_DEPLOY_HOOK_URL", HOOK_URL)
    sleep_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "eisenbalm_pipeline.lib.vercel_client.asyncio.sleep", sleep_mock
    )
    job = {"job": {"id": "j1", "state": "READY", "createdAt": 1}}
    responses = [
        httpx.Response(429),
        httpx.Response(201, json=job),
    ]
    async with respx.mock(assert_all_called=False) as router:
        router.post(HOOK_URL).mock(side_effect=responses)
        async with httpx.AsyncClient() as http:
            result = await trigger_vercel_deploy(http)
    assert result == job
    # One retry → exactly one backoff sleep.
    sleep_mock.assert_awaited_once()


async def test_retries_on_500_then_succeeds(monkeypatch):
    """A transient 5xx is retried; the subsequent 2xx is returned."""
    monkeypatch.setenv("VERCEL_DEPLOY_HOOK_URL", HOOK_URL)
    sleep_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "eisenbalm_pipeline.lib.vercel_client.asyncio.sleep", sleep_mock
    )
    job = {"job": {"id": "j2", "state": "READY", "createdAt": 1}}
    responses = [
        httpx.Response(503),
        httpx.Response(200, json=job),
    ]
    async with respx.mock(assert_all_called=False) as router:
        router.post(HOOK_URL).mock(side_effect=responses)
        async with httpx.AsyncClient() as http:
            result = await trigger_vercel_deploy(http)
    assert result == job
    sleep_mock.assert_awaited_once()


async def test_honors_retry_after_header(monkeypatch):
    """A 429 carrying a parseable Retry-After header sleeps that many seconds."""
    monkeypatch.setenv("VERCEL_DEPLOY_HOOK_URL", HOOK_URL)
    sleep_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "eisenbalm_pipeline.lib.vercel_client.asyncio.sleep", sleep_mock
    )
    job = {"job": {"id": "j3", "state": "READY", "createdAt": 1}}
    responses = [
        httpx.Response(429, headers={"Retry-After": "2"}),
        httpx.Response(201, json=job),
    ]
    async with respx.mock(assert_all_called=False) as router:
        router.post(HOOK_URL).mock(side_effect=responses)
        async with httpx.AsyncClient() as http:
            result = await trigger_vercel_deploy(http)
    assert result == job
    # Retry-After: 2 → sleep called with exactly 2 (int seconds).
    sleep_mock.assert_awaited_once_with(2)


async def test_no_retry_on_404(monkeypatch):
    """A non-transient 4xx (404) raises immediately, with no retry/backoff."""
    monkeypatch.setenv("VERCEL_DEPLOY_HOOK_URL", HOOK_URL)
    sleep_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "eisenbalm_pipeline.lib.vercel_client.asyncio.sleep", sleep_mock
    )
    async with respx.mock(assert_all_called=False) as router:
        route = router.post(HOOK_URL).mock(return_value=httpx.Response(404))
        async with httpx.AsyncClient() as http:
            with pytest.raises(httpx.HTTPStatusError):
                await trigger_vercel_deploy(http)
        # Called exactly once — no retry.
        assert route.call_count == 1
    # No backoff for a bad hook URL.
    sleep_mock.assert_not_awaited()


async def test_retries_exhausted_raises(monkeypatch):
    """Persistent 429 raises after the bounded number of attempts."""
    monkeypatch.setenv("VERCEL_DEPLOY_HOOK_URL", HOOK_URL)
    sleep_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "eisenbalm_pipeline.lib.vercel_client.asyncio.sleep", sleep_mock
    )
    async with respx.mock(assert_all_called=False) as router:
        route = router.post(HOOK_URL).mock(return_value=httpx.Response(429))
        async with httpx.AsyncClient() as http:
            with pytest.raises(httpx.HTTPStatusError):
                await trigger_vercel_deploy(http)
        # All attempts consumed.
        assert route.call_count == _MAX_ATTEMPTS
    # Backoff slept between attempts but NOT after the final failure.
    assert sleep_mock.await_count == _MAX_ATTEMPTS - 1
