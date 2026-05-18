"""Publisher coroutine integration tests (_run_publisher).

Mocks Sanity httpx via respx; mocks Convex mutations via mock_convex_mutation;
mocks asyncio.sleep + lib.vercel_client.trigger_vercel_deploy to keep tests fast.
Plan 06-07 unskips.
"""
from __future__ import annotations

import pytest


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (PDF-03)")
async def test_publisher_uploads_to_sanity(mock_convex_mutation, mock_vercel_trigger):
    """PDF-03: _run_publisher invokes upload_pdf_to_issue with PDF bytes + asset patch."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (WHK-05)")
async def test_30s_delay_before_vercel(mock_convex_mutation, mock_vercel_trigger, monkeypatch):
    """WHK-05: asyncio.sleep called with 30.0 BEFORE trigger_vercel_deploy."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (WHK-06)")
async def test_publisher_uses_non_cdn_sanity_host():
    """WHK-06: groq_query is called against *.api.sanity.io (NOT *.apicdn.sanity.io)."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (WHK-07)")
async def test_completes_convex_writes(mock_convex_mutation, mock_vercel_trigger):
    """WHK-07: After Vercel deploy success, Convex receives status=complete + publisher-deploy event."""
