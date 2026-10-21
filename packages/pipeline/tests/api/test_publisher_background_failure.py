"""Quick 261021-5pr — publisher background failure handling (webhook path)
and off-loop PDF render."""
from __future__ import annotations

import asyncio
import json
import threading
import time
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from eisenbalm_pipeline.api.webhooks import router as webhook_router

pytestmark = pytest.mark.anyio

SECRET = "test-secret-32-bytes"
MOD = "eisenbalm_pipeline.api.webhooks"


def _build_app(pool=True) -> FastAPI:
    app = FastAPI()
    app.include_router(webhook_router)
    app.state.pool = MagicMock() if pool else None
    app.state.convex_http = MagicMock()
    app.state.background_tasks = set()
    return app


def _wire(monkeypatch, *, publisher, claim=None, run_id="run-1"):
    monkeypatch.setenv("SANITY_WEBHOOK_SECRET", SECRET)
    monkeypatch.setattr(
        f"{MOD}.claim_idempotency_key",
        claim or AsyncMock(return_value=True),
    )
    release = AsyncMock(return_value=True)
    monkeypatch.setattr(f"{MOD}.release_idempotency_key", release)
    monkeypatch.setattr(f"{MOD}._run_publisher", publisher)
    safe = AsyncMock()
    monkeypatch.setattr(f"{MOD}._cc.convex_mutation_safe", safe)

    async def mock_query(http, path, args):  # noqa: ARG001
        return {"facts-cleared": {"a": 1}, "sounds-human": {"a": 1}}

    monkeypatch.setattr(f"{MOD}._cc.convex_query", mock_query)
    return release, safe


async def _post(app, encoder, run_id="run-1"):
    payload = {"_id": "issue-1", "issueNumber": 1, "status": "published"}
    if run_id:
        payload["runId"] = run_id
    body = json.dumps(payload).encode()
    ts = int(time.time() * 1000)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post(
            "/webhook/sanity-publish",
            content=body,
            headers={
                "sanity-webhook-signature": encoder(body, ts, SECRET),
                "idempotency-key": f"k-{time.time_ns()}",
            },
        )
    assert r.status_code == 200, r.text
    await asyncio.gather(*list(app.state.background_tasks), return_exceptions=True)
    return r


async def test_failure_releases_claim_and_marks_failed(monkeypatch, sanity_signature_encoder):
    release, safe = _wire(monkeypatch, publisher=AsyncMock(side_effect=RuntimeError("x" * 900)))
    app = _build_app()
    await _post(app, sanity_signature_encoder)
    release.assert_awaited_once()
    assert release.await_args.kwargs == {"source": "publisher-run", "idempotency_key": "issue-1"}
    name, args = safe.await_args.args
    assert name == "pipelineRuns:updateStatus"
    assert args["runId"] == "run-1" and args["status"] == "failed"
    assert len(args["errorMessage"]) <= 500 and "completedAt" in args


async def test_failure_without_run_id_still_releases(monkeypatch):
    # The webhook sign-off gate blocks run_id=None before scheduling, so test
    # the wrapper directly (manual drafts could reach it via future callers).
    from eisenbalm_pipeline.api.webhooks import _publish_with_claim_cleanup

    release, safe = _wire(monkeypatch, publisher=AsyncMock(side_effect=RuntimeError("boom")))
    with pytest.raises(RuntimeError):
        await _publish_with_claim_cleanup(
            MagicMock(), pool=MagicMock(), claimed=True,
            issue_id="issue-1", issue_number=1, run_id=None,
        )
    release.assert_awaited_once()
    safe.assert_not_awaited()


async def test_no_claim_no_release_pool_none(monkeypatch, sanity_signature_encoder):
    release, safe = _wire(monkeypatch, publisher=AsyncMock(side_effect=RuntimeError("boom")))
    await _post(_build_app(pool=False), sanity_signature_encoder)
    release.assert_not_awaited()
    safe.assert_awaited_once()


async def test_no_release_when_claim_call_raised(monkeypatch, sanity_signature_encoder):
    release, _ = _wire(
        monkeypatch,
        publisher=AsyncMock(side_effect=RuntimeError("boom")),
        claim=AsyncMock(side_effect=RuntimeError("db down")),
    )
    await _post(_build_app(), sanity_signature_encoder)
    release.assert_not_awaited()


async def test_patch_attempted_failure_keeps_claim(monkeypatch, sanity_signature_encoder):
    exc = RuntimeError("502 after commit")
    exc.problem_pdf_patch_attempted = True
    release, safe = _wire(monkeypatch, publisher=AsyncMock(side_effect=exc))
    await _post(_build_app(), sanity_signature_encoder)
    release.assert_not_awaited()
    safe.assert_awaited_once()  # run still marked failed


async def test_success_does_nothing_extra(monkeypatch, sanity_signature_encoder):
    release, safe = _wire(monkeypatch, publisher=AsyncMock(return_value=None))
    await _post(_build_app(), sanity_signature_encoder)
    release.assert_not_awaited()
    safe.assert_not_awaited()


async def test_pdf_render_runs_off_main_thread(monkeypatch):
    from eisenbalm_pipeline.agents import publisher as pub

    seen: dict = {}

    def fake_render(**kw):
        seen["tid"] = threading.get_ident()
        return b"%PDF"

    monkeypatch.setattr(pub, "render_problem_statement_pdf", fake_render)
    monkeypatch.setattr(
        pub, "groq_query",
        AsyncMock(return_value=[{"issueNumber": 1, "charityName": "C"}]),
    )
    monkeypatch.setattr(pub, "get_sanity_http", lambda: MagicMock())
    monkeypatch.setattr(pub, "upload_pdf_to_issue", AsyncMock())
    monkeypatch.setattr(pub, "CDN_PROPAGATION_DELAY_SEC", 0)
    monkeypatch.setattr(pub, "trigger_vercel_deploy", AsyncMock(return_value={}))
    monkeypatch.setattr(pub, "convex_mutation_safe", AsyncMock())
    app = MagicMock()
    await pub._run_publisher(app, issue_id="i", issue_number=1, run_id=None)
    assert seen["tid"] != threading.get_ident()
