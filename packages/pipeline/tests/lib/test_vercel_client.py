"""Vercel deploy hook trigger tests (Plan 06-04 fills bodies).

Uses respx to mock the HTTP call — never actually fires a deploy.
"""
from __future__ import annotations

import os

import httpx
import pytest
import respx

from eisenbalm_pipeline.lib.vercel_client import trigger_vercel_deploy

HOOK_URL = "https://api.vercel.com/v1/integrations/deploy/test-hook-id"


async def test_trigger_posts_to_hook_url(monkeypatch):
    """WHK-05: trigger_vercel_deploy POSTs (no body, no auth) to VERCEL_DEPLOY_HOOK_URL."""
    monkeypatch.setenv("VERCEL_DEPLOY_HOOK_URL", HOOK_URL)
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


async def test_trigger_raises_on_non_2xx(monkeypatch):
    """WHK-05: 4xx/5xx from Vercel raises so caller can log + continue."""
    monkeypatch.setenv("VERCEL_DEPLOY_HOOK_URL", HOOK_URL)
    async with respx.mock(assert_all_called=False) as router:
        router.post(HOOK_URL).mock(return_value=httpx.Response(500))
        async with httpx.AsyncClient() as http:
            with pytest.raises(httpx.HTTPStatusError):
                await trigger_vercel_deploy(http)
