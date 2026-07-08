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

from eisenbalm_pipeline.agents.publisher import _run_publisher, publisher


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


async def test_deploy_failure_is_non_fatal_and_finalizes(
    monkeypatch, mock_convex_mutation
):
    """WHK-05/WHK-07: a deploy failure (after Task 1's bounded retries are
    exhausted) must NOT crash the publisher — the run still finalizes
    (status=complete + publisher-deploy event) and the error sentinel is
    embedded in the publisher-deploy payload (observable failure).
    """
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
    # The deploy raises AFTER its (Task 1) bounded retries are exhausted.
    failing_vercel = AsyncMock(
        side_effect=httpx.HTTPStatusError(
            "429 Too Many Requests",
            request=httpx.Request("POST", "https://x"),
            response=httpx.Response(429),
        )
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.trigger_vercel_deploy",
        failing_vercel,
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.convex_mutation_safe",
        mock_convex_mutation,
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.get_sanity_http", lambda: MagicMock()
    )

    app = _build_fake_app()

    # MUST NOT raise — the deploy failure is swallowed and finalization runs.
    await _run_publisher(
        app, issue_id="issue-42", issue_number=42, run_id="run-abc"
    )

    # Finalization still ran: status=complete + publisher-deploy event.
    mutation_names = [
        call.args[0] for call in mock_convex_mutation.await_args_list
    ]
    assert "pipelineRuns:updateStatus" in mutation_names
    assert "deliberationEvents:insert" in mutation_names

    update_call = next(
        c for c in mock_convex_mutation.await_args_list
        if c.args[0] == "pipelineRuns:updateStatus"
    )
    assert update_call.args[1]["status"] == "complete"
    assert update_call.args[1]["runId"] == "run-abc"

    # The publisher-deploy payload carries the error sentinel (observable).
    event_call = next(
        c for c in mock_convex_mutation.await_args_list
        if c.args[0] == "deliberationEvents:insert"
    )
    assert event_call.args[1]["eventType"] == "publisher-deploy"
    assert "error" in event_call.args[1]["payload"]


async def test_deploy_failure_manual_branch_does_not_crash(
    monkeypatch, mock_convex_mutation
):
    """run_id=None (manually-authored issue): a deploy failure must not crash
    the manual branch either — the try/except wraps both paths, and no Convex
    writes happen (the run_id-None early return is preserved).
    """
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
    failing_vercel = AsyncMock(
        side_effect=httpx.HTTPStatusError(
            "500 Server Error",
            request=httpx.Request("POST", "https://x"),
            response=httpx.Response(500),
        )
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.trigger_vercel_deploy",
        failing_vercel,
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.convex_mutation_safe",
        mock_convex_mutation,
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.get_sanity_http", lambda: MagicMock()
    )

    app = _build_fake_app()

    # MUST NOT raise.
    await _run_publisher(
        app, issue_id="issue-42", issue_number=42, run_id=None
    )

    # run_id=None → early return before Convex writes (branch preserved).
    assert mock_convex_mutation.await_count == 0


def _sample_groq_result_with_website() -> dict:
    """Extended GROQ result that includes charityWebsite + charitySlug (Phase 26 D-03)."""
    base = _sample_groq_result()
    base["charityWebsite"] = "https://quiet.foundation"
    base["charitySlug"] = "charity-the-quiet-foundation"
    return base


async def test_publisher_upserts_featured_charity(
    monkeypatch, mock_convex_mutation, mock_vercel_trigger
):
    """Phase 26 D-03 / REG-01: after status=complete, _run_publisher calls
    charities:upsertFeatured with charity name + website so timesFeatured
    increments and lastFeaturedAt is set exactly once per publish.
    """
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.groq_query",
        AsyncMock(return_value=[_sample_groq_result_with_website()]),
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
    await _run_publisher(app, issue_id="issue-42", issue_number=42, run_id="run-abc")

    # Collect all mutation names called.
    mutation_names = [call.args[0] for call in mock_convex_mutation.await_args_list]

    # charities:upsertFeatured MUST have been called.
    assert "charities:upsertFeatured" in mutation_names, (
        f"Expected charities:upsertFeatured in {mutation_names}"
    )

    # Inspect the upsertFeatured call — must carry name + website (D-03).
    upsert_call = next(
        c for c in mock_convex_mutation.await_args_list
        if c.args[0] == "charities:upsertFeatured"
    )
    upsert_args = upsert_call.args[1]
    assert upsert_args["name"] == "The Quiet Foundation"
    assert upsert_args["website"] == "https://quiet.foundation"
    assert upsert_args["workspace_id"] == "eisenbalm"
    assert "sanityCharityId" in upsert_args


async def test_publisher_upsert_skipped_when_no_charity_name(
    monkeypatch, mock_convex_mutation, mock_vercel_trigger
):
    """Phase 26 D-03: no charities:upsertFeatured if charityName is absent
    (manually-authored issue or missing GROQ projection).
    """
    groq_result = _sample_groq_result()
    groq_result.pop("charityName", None)  # simulate missing charityName

    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.groq_query",
        AsyncMock(return_value=[groq_result]),
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
    await _run_publisher(app, issue_id="issue-42", issue_number=42, run_id="run-abc")

    # charities:upsertFeatured MUST NOT have been called.
    mutation_names = [call.args[0] for call in mock_convex_mutation.await_args_list]
    assert "charities:upsertFeatured" not in mutation_names, (
        "charities:upsertFeatured should not be called when charityName is absent"
    )


# ── Phase 35 (PRV-02/PRV-04): the @agent_node `publisher` claims seeding ─────
#
# Distinct from `_run_publisher` above: `publisher` is the pipeline-end
# @agent_node (LangGraph node) that writes the Sanity draft AND seeds
# claim_checks via claimChecks:insertBatch (see module docstring at the top
# of agents/publisher/__init__.py for the two-coroutine distinction).


async def test_publisher_seeds_sourced_and_unsourced_claim_checks_rows(monkeypatch):
    """Publisher resolves writer claimSpans into sourced claim_checks rows
    (claimId + sourceUrl + retrievedAt + sectionName + blockIndexHint) and
    runs the per-block regex catch-all for everything else as unsourced rows
    (no claimId) — excluding any regex span whose normalized text matches an
    already-sourced span in the SAME (section, block).
    """
    captured_calls: list[tuple[str, dict]] = []

    async def capturing_convex(path: str, args: dict) -> None:
        captured_calls.append((path, args))

    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.get_sanity_http", lambda: MagicMock()
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.write_issue_draft",
        AsyncMock(return_value="issue-42"),
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.convex_mutation_safe",
        capturing_convex,
    )

    state = {
        "run_id": "run-abc123",
        "issue_number": 42,
        "origin_story": {
            "headline": "H",
            "body": [
                {
                    "type": "paragraph",
                    "text": "The charity had a $2.3M budget, founded in 1998.",
                },
            ],
            "claimSpans": [{"claimId": "a-0", "asWritten": "$2.3M"}],
        },
        "problem_statement": None,
        "founder_bio": None,
        "case_study": None,
        "bonus": None,
        "research": {
            "claims": [
                {
                    "claimId": "a-0",
                    "text": "$2.3M",
                    "sourceUrl": "https://x",
                    "retrievedAt": 123,
                },
            ],
        },
    }

    await publisher(state)

    insert_calls = [
        args for path, args in captured_calls if path == "claimChecks:insertBatch"
    ]
    assert insert_calls, "expected claimChecks:insertBatch to be called"
    payload = insert_calls[0]
    # Regression-safe shape: workspace_id + runId + claims still present.
    assert payload["workspace_id"] == "eisenbalm"
    assert payload["runId"] == "run-abc123"
    rows = payload["claims"]

    sourced = [r for r in rows if r.get("claimId")]
    unsourced = [r for r in rows if not r.get("claimId")]

    assert len(sourced) == 1
    sourced_row = sourced[0]
    assert sourced_row["claimId"] == "a-0"
    assert sourced_row["sourceUrl"] == "https://x"
    assert sourced_row["retrievedAt"] == 123
    assert sourced_row["sectionName"] == "originStory"
    assert sourced_row["blockIndexHint"] == 0

    # The bound "$2.3M" span must NOT also appear as an unsourced row.
    assert not any(r["text"] == "$2.3M" for r in unsourced), (
        f"bound span leaked into unsourced rows: {unsourced}"
    )

    # The unbound "1998" date claim IS present, unsourced.
    assert any(
        r["text"] == "1998" and r["sectionName"] == "originStory"
        for r in unsourced
    ), f"expected unbound '1998' date claim in unsourced rows: {unsourced}"

    # Every row (sourced + unsourced) carries a unique claimIndex ordinal.
    indices = [r["claimIndex"] for r in rows]
    assert len(indices) == len(set(indices)), "claimIndex values must be unique"


async def test_publisher_claims_seeding_defensive_when_no_claimspans_or_research(
    monkeypatch,
):
    """No claimSpans / no research claims → all extracted spans land as
    unsourced rows (honest degrade, no crash)."""
    captured_calls: list[tuple[str, dict]] = []

    async def capturing_convex(path: str, args: dict) -> None:
        captured_calls.append((path, args))

    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.get_sanity_http", lambda: MagicMock()
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.write_issue_draft",
        AsyncMock(return_value="issue-42"),
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.convex_mutation_safe",
        capturing_convex,
    )

    state = {
        "run_id": "run-abc456",
        "issue_number": 43,
        "origin_story": {
            "headline": "H",
            "body": [{"type": "paragraph", "text": "Founded in 1998."}],
        },
        "problem_statement": None,
        "founder_bio": None,
        "case_study": None,
        "bonus": None,
    }

    await publisher(state)

    insert_calls = [
        args for path, args in captured_calls if path == "claimChecks:insertBatch"
    ]
    assert insert_calls
    rows = insert_calls[0]["claims"]
    assert rows
    assert all(not r.get("claimId") for r in rows)
    assert all(r["sectionName"] == "originStory" for r in rows)
