"""Publisher coroutine tests (_run_publisher). Plan 06-07 fills bodies.

Mocks Sanity httpx (groq_query + upload_pdf_to_issue) at the publisher
module's import sites; mocks Convex via mock_convex_mutation; mocks Vercel
via mock_vercel_trigger; asyncio.sleep patched to no-op.
WeasyPrint runs for REAL against vendored TTFs.
"""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import httpx

from eisenbalm_pipeline.agents.publisher import _run_publisher


FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _sample_groq_result() -> dict:
    return {
        "_id": "issue-42",
        "issueNumber": 42,
        "charityName": "The Quiet Foundation",
        "theme": json.loads((FIXTURES_DIR / "sample_theme.json").read_text()),
        "pdfContent": json.loads(
            (FIXTURES_DIR / "sample_pdf_content.json").read_text()
        ),
    }


def _build_fake_app() -> MagicMock:
    """Mock FastAPI app with the state attributes _run_publisher reads."""
    app = MagicMock()
    app.state = MagicMock()
    app.state.pool = None
    app.state.background_tasks = set()
    app.state.convex_http = MagicMock(spec=httpx.AsyncClient)
    return app


async def test_publisher_uploads_to_sanity(
    monkeypatch, mock_convex_mutation, mock_vercel_trigger
):
    """PDF-03: _run_publisher invokes upload_pdf_to_issue with PDF bytes + asset patch."""
    # Patch groq_query at the publisher module's import site
    fake_groq = AsyncMock(return_value=[_sample_groq_result()])
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.groq_query",
        fake_groq,
    )
    # Patch upload_pdf_to_issue at the publisher module's import site
    fake_upload = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.upload_pdf_to_issue",
        fake_upload,
    )
    # Skip the 30s sleep — patch on the module's asyncio binding
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.asyncio.sleep",
        AsyncMock(return_value=None),
    )
    # Vercel + Convex
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.trigger_vercel_deploy",
        mock_vercel_trigger,
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.convex_mutation_safe",
        mock_convex_mutation,
    )
    # Patch get_sanity_http (publisher imports it as `get_sanity_http`)
    fake_sanity_http = MagicMock(spec=httpx.AsyncClient)
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.get_sanity_http",
        lambda: fake_sanity_http,
    )

    app = _build_fake_app()
    await _run_publisher(
        app, issue_id="issue-42", issue_number=42, run_id="run-abc"
    )

    # PDF-03: upload_pdf_to_issue was called with non-empty PDF bytes.
    fake_upload.assert_awaited_once()
    call_args = fake_upload.call_args
    # upload_pdf_to_issue signature: (http, issue_id=, pdf_bytes=, issue_number=)
    # We pass http positionally and the rest as kwargs.
    call_kwargs = call_args.kwargs
    assert call_kwargs["issue_id"] == "issue-42"
    assert call_kwargs["issue_number"] == 42
    assert isinstance(call_kwargs["pdf_bytes"], bytes)
    assert call_kwargs["pdf_bytes"].startswith(b"%PDF-")
    assert len(call_kwargs["pdf_bytes"]) > 1000


async def test_30s_delay_before_vercel(
    monkeypatch, mock_convex_mutation, mock_vercel_trigger
):
    """WHK-05: asyncio.sleep called with 30.0 BEFORE trigger_vercel_deploy."""
    call_order: list[str] = []

    async def recording_sleep(seconds: float):
        call_order.append(f"sleep({seconds})")

    async def recording_vercel(http):
        call_order.append("vercel")
        return {"job": {"id": "x", "state": "READY", "createdAt": 1}}

    fake_groq = AsyncMock(return_value=[_sample_groq_result()])
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.groq_query", fake_groq
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.upload_pdf_to_issue", AsyncMock()
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.asyncio.sleep", recording_sleep
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.trigger_vercel_deploy",
        recording_vercel,
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.convex_mutation_safe",
        mock_convex_mutation,
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.get_sanity_http", lambda: MagicMock()
    )

    app = _build_fake_app()
    await _run_publisher(
        app, issue_id="issue-42", issue_number=42, run_id="run-abc"
    )

    # sleep(30.0) MUST appear BEFORE vercel call.
    assert "sleep(30.0)" in call_order, (
        f"30s sleep missing from {call_order}"
    )
    assert "vercel" in call_order
    assert call_order.index("sleep(30.0)") < call_order.index("vercel")


async def test_publisher_uses_non_cdn_sanity_host(
    monkeypatch, mock_convex_mutation, mock_vercel_trigger
):
    """WHK-06: groq_query is called (which targets *.api.sanity.io NOT *.apicdn.sanity.io)."""
    captured: dict = {}

    async def capturing_groq(query: str, *, params=None):
        captured["query"] = query
        captured["params"] = params
        return [_sample_groq_result()]

    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.groq_query", capturing_groq
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.upload_pdf_to_issue", AsyncMock()
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.asyncio.sleep", AsyncMock()
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.trigger_vercel_deploy",
        mock_vercel_trigger,
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.convex_mutation_safe",
        mock_convex_mutation,
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.get_sanity_http", lambda: MagicMock()
    )

    app = _build_fake_app()
    await _run_publisher(
        app, issue_id="issue-42", issue_number=42, run_id="run-abc"
    )

    # The publisher uses groq_query (which lives in lib/sanity_client.py and
    # targets *.api.sanity.io by construction). Confirm groq_query was used.
    assert "weeklyIssue" in captured["query"], "GROQ query not invoked"
    assert captured["params"] == {"id": "issue-42"}

    # Defensive: the source of groq_query should NOT use apicdn.
    import eisenbalm_pipeline.lib.sanity_client as sc_mod
    source = Path(sc_mod.__file__).read_text()
    assert "apicdn.sanity.io" not in source, (
        "lib/sanity_client.py must not use the CDN host"
    )
    assert ".api.sanity.io" in source


async def test_completes_convex_writes(
    monkeypatch, mock_convex_mutation, mock_vercel_trigger
):
    """WHK-07: After Vercel deploy success, Convex receives status=complete + publisher-deploy event."""
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.groq_query",
        AsyncMock(return_value=[_sample_groq_result()]),
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.upload_pdf_to_issue", AsyncMock()
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.asyncio.sleep", AsyncMock()
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.trigger_vercel_deploy",
        mock_vercel_trigger,
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.convex_mutation_safe",
        mock_convex_mutation,
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.get_sanity_http", lambda: MagicMock()
    )

    app = _build_fake_app()
    await _run_publisher(
        app, issue_id="issue-42", issue_number=42, run_id="run-abc"
    )

    # mock_convex_mutation called at least twice — once for updateStatus + once for publisher-deploy.
    assert mock_convex_mutation.await_count >= 2

    # Inspect the calls — extract mutation names
    mutation_names = [
        call.args[0] for call in mock_convex_mutation.await_args_list
    ]
    assert "pipelineRuns:updateStatus" in mutation_names
    assert "deliberationEvents:insert" in mutation_names

    # Verify status=complete on the updateStatus call
    update_call = next(
        c for c in mock_convex_mutation.await_args_list
        if c.args[0] == "pipelineRuns:updateStatus"
    )
    assert update_call.args[1]["status"] == "complete"
    assert update_call.args[1]["runId"] == "run-abc"

    # Verify eventType=publisher-deploy
    event_call = next(
        c for c in mock_convex_mutation.await_args_list
        if c.args[0] == "deliberationEvents:insert"
    )
    assert event_call.args[1]["eventType"] == "publisher-deploy"
    assert event_call.args[1]["agentId"] == "publisher"
