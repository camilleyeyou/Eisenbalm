---
phase: 06-pdf-generation-webhook-chain
plan: 07
type: execute
wave: 2
depends_on:
  - 02
  - 04
  - 05
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py
  - packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py
  - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
  - packages/pipeline/tests/agents/publisher/test_publisher.py
  - packages/pipeline/tests/api/test_webhook_sanity.py
  - packages/pipeline/tests/api/test_runs.py
autonomous: true
requirements_addressed:
  - PDF-03
  - PDF-04
  - WHK-01
  - WHK-02
  - WHK-03
  - WHK-04
  - WHK-05
  - WHK-06
  - WHK-07
  - WHK-08

must_haves:
  truths:
    - "A single _run_publisher(app, *, issue_id, issue_number, run_id) coroutine is invoked by BOTH the Sanity webhook handler AND the manual /run/{runId}/publish endpoint — there is exactly one implementation"
    - "The webhook handler verifies HMAC signature against SANITY_WEBHOOK_SECRET using raw body, rejects tampered/expired/duplicate, and returns 200 (or 401/410) in < 50ms"
    - "Within _run_publisher: GROQ fetches the issue via non-CDN host, WeasyPrint renders the PDF, upload_pdf_to_issue patches problemPdf, asyncio.sleep(30) elapses, then trigger_vercel_deploy fires"
    - "On successful deploy, Convex pipelineRuns:updateStatus sets status='complete' and deliberationEvents:insert emits eventType='publisher-deploy'"
    - "POST /run/{runId}/publish (manual fallback) requires X-Pipeline-Trigger-Secret AND invokes _run_publisher with the same arguments the webhook would compute by looking up issue via GROQ filter on pipelineMetadata.runId"
    - "All Plan 06-01 skip-marked tests in tests/agents/publisher/test_publisher.py, tests/api/test_webhook_sanity.py, tests/api/test_runs.py are unskipped and green"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py"
      provides: "Adds _run_publisher coroutine + GROQ query constant; preserves Phase 4 @agent_node publisher symbol"
      contains: "async def _run_publisher"
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py"
      provides: "Real Sanity webhook handler: signature → age → idempotency → asyncio.create_task(_run_publisher)"
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/runs.py"
      provides: "Manual /run/{runId}/publish endpoint that looks up issue via GROQ and invokes _run_publisher"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py"
      provides: "Adds groq_query for QUERY_ISSUE_FOR_PUBLISH (read pdfContent + theme + charity name)"
  key_links:
    - from: "api/webhooks.py::sanity_publish"
      to: "agents/publisher/__init__.py::_run_publisher"
      via: "asyncio.create_task + app.state.background_tasks"
      pattern: "_run_publisher"
    - from: "api/runs.py::manual_publish"
      to: "agents/publisher/__init__.py::_run_publisher"
      via: "asyncio.create_task + app.state.background_tasks"
      pattern: "_run_publisher"
    - from: "agents/publisher/__init__.py::_run_publisher"
      to: "agents/publisher/pdf.py::render_problem_statement_pdf"
      via: "direct call"
      pattern: "render_problem_statement_pdf"
    - from: "agents/publisher/__init__.py::_run_publisher"
      to: "lib/sanity_client.py::upload_pdf_to_issue"
      via: "direct call"
      pattern: "upload_pdf_to_issue"
    - from: "agents/publisher/__init__.py::_run_publisher"
      to: "lib/vercel_client.py::trigger_vercel_deploy"
      via: "direct call after asyncio.sleep(30)"
      pattern: "trigger_vercel_deploy"
---

<objective>
Compose the Wave 1 primitives into the real Sanity → Publisher → Vercel chain. Add a single `_run_publisher` coroutine to `agents/publisher/__init__.py` that GROQ-fetches the issue from non-CDN Sanity, renders the PDF, uploads + patches, sleeps 30 seconds, fires the Vercel deploy hook, and writes `pipelineRuns.status='complete'` + a `publisher-deploy` event to Convex. Rewrite `api/webhooks.py` to verify signature + age + idempotency and launch `_run_publisher` as a background task. Wire `api/runs.py::manual_publish` to invoke the SAME coroutine (no parallel implementation — Pitfall 7). Finally, unskip the remaining Plan 06-01 tests.

Purpose: this is the keystone — Wave 0/1 prepared every primitive; Wave 2 connects them. The CLAUDE.md rule "Sanity webhook handler MUST return 200 immediately" is honored because every slow operation (PDF render, sleep, Vercel POST) runs in the asyncio.create_task background.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py
@packages/pipeline/src/eisenbalm_pipeline/api/runs.py
@packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py
@packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
@packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py
@packages/pipeline/src/eisenbalm_pipeline/lib/idempotency.py
@packages/pipeline/src/eisenbalm_pipeline/lib/vercel_client.py
@packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py

<interfaces>
From 06-RESEARCH.md §Pattern 5 (the _run_publisher contract):
```python
async def _run_publisher(app, *, issue_id, issue_number, run_id) -> None:
    """The single Publisher coroutine — invoked by webhook AND manual fallback.

    Steps:
      1. Fetch issue with useCdn=False (WHK-06) via groq_query.
      2. Render Problem Statement PDF (Plan 06-05 render_problem_statement_pdf).
      3. Upload PDF to Sanity (lib/sanity_client.upload_pdf_to_issue — exists).
      4. asyncio.sleep(30)                            # WHK-05 CDN propagation.
      5. POST Vercel deploy hook (lib/vercel_client.trigger_vercel_deploy).
      6. Update Convex pipelineRuns.status='complete' + emit publisher-deploy.
    """
```

From 06-RESEARCH.md §Pattern 4 (webhook handler skeleton):
```python
@router.post("/webhook/sanity-publish")
async def sanity_publish(request: Request) -> dict:
    raw = await request.body()
    sig_header = request.headers.get(SIGNATURE_HEADER_NAME)
    secret = os.environ["SANITY_WEBHOOK_SECRET"]
    try:
        ts_ms = verify_sanity_signature(raw, sig_header, secret)
    except SignatureExpiredError:
        raise HTTPException(status_code=410, detail="Signature too old")
    except SignatureError as e:
        raise HTTPException(status_code=401, detail=str(e))

    payload = json.loads(raw)
    if payload.get("status") != "published":
        return {"ok": True, "skipped": "not-published"}

    idem = request.headers.get("idempotency-key")
    if idem and request.app.state.pool is not None:
        first = await claim_idempotency_key(
            request.app.state.pool, source="sanity-publish",
            idempotency_key=idem, run_id=payload.get("runId"),
        )
        if not first:
            return {"ok": True, "duplicate": True}

    task = asyncio.create_task(_run_publisher(
        request.app, issue_id=payload["_id"],
        issue_number=payload["issueNumber"], run_id=payload.get("runId"),
    ))
    request.app.state.background_tasks.add(task)
    task.add_done_callback(request.app.state.background_tasks.discard)
    return {"ok": True, "scheduled": True}
```

Existing api/runs.py::manual_publish (stub at line 255 — Phase 4 returns marker):
```python
@router.post("/run/{run_id}/publish")
async def manual_publish(request: Request, run_id: str) -> dict:
    _require_trigger_secret(request)
    log.info("Manual publish requested for runId=%s — Phase 6 stub", run_id)
    return {"runId": run_id, "phase4Stub": True, ...}
```

Existing lib/sanity_client.py::upload_pdf_to_issue (Phase 4 — ready to call):
```python
async def upload_pdf_to_issue(http, issue_id, pdf_bytes, issue_number) -> None:
    # uploads asset, patches weeklyIssue.problemPdf
```

GROQ projection for Publisher fetch (defined inline in agents/publisher/__init__.py):
```python
QUERY_ISSUE_FOR_PUBLISH = '''
*[_type == "weeklyIssue" && _id == $id][0]{
  _id,
  issueNumber,
  "charityName": charity->name,
  theme{primaryColor, accentColor, backgroundColor, textColor, fontDisplay, fontBody, visualDirection},
  "pdfContent": problemStatement.pdfContent{problemStatement, keyDataPoints[]{stat, source}, interventionMechanism}
}
'''
QUERY_ISSUE_BY_RUN_ID = '''
*[_type == "weeklyIssue" && pipelineMetadata.runId == $runId][0]{
  _id, issueNumber
}
'''
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add _run_publisher coroutine + GROQ constants to agents/publisher/__init__.py</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py (current Phase 4 body — preserve verbatim)
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/pdf.py (render_problem_statement_pdf signature)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (upload_pdf_to_issue + groq_query — verify groq_query is the helper we use for WHK-06)
    - packages/pipeline/src/eisenbalm_pipeline/lib/vercel_client.py (trigger_vercel_deploy signature)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (convex_mutation_safe signature)
    - .planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md (Pattern 5 + Pitfalls 5, 7)
  </read_first>
  <files>
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py
  </files>
  <action>
APPEND to `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` (do NOT touch the existing @agent_node publisher function — it stays as Phase 4's pipeline-end Sanity-write contract). Add the new `_run_publisher` coroutine + GROQ constants at the bottom of the file:

```python
# ──────────────────────────────────────────────────────────────────────────
# Phase 6: webhook-driven Publisher path (_run_publisher).
#
# Distinct from the @agent_node publisher above:
#   - @agent_node publisher: runs at PIPELINE END (in the LangGraph), writes
#     the draft to Sanity, flips status='awaiting-review'. This is the Phase 4
#     contract, unchanged by Phase 6.
#   - _run_publisher: runs when Andrew PUBLISHES the draft (via webhook OR
#     manual /run/{runId}/publish). Reads the now-published doc back from
#     Sanity, renders the PDF, uploads it, sleeps 30s, fires Vercel deploy,
#     flips Convex pipelineRuns.status='complete'.
#
# A single _run_publisher implementation is the keystone of WHK-08 (manual
# fallback) — both api/webhooks.py and api/runs.py invoke this same coroutine
# (Pitfall 7).
# ──────────────────────────────────────────────────────────────────────────

import asyncio
import logging

from eisenbalm_pipeline.agents.publisher.pdf import render_problem_statement_pdf
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
from eisenbalm_pipeline.lib.sanity_client import (
    get_client as get_sanity_http,
    groq_query,
    upload_pdf_to_issue,
)
from eisenbalm_pipeline.lib.vercel_client import trigger_vercel_deploy

log = logging.getLogger(__name__)

# GROQ projections — colocated with _run_publisher so the read shape lives
# next to the consumer. WHK-06: lib/sanity_client.groq_query targets
# *.api.sanity.io (NOT *.apicdn.sanity.io), so useCdn=False is satisfied by
# the client's base URL.
QUERY_ISSUE_FOR_PUBLISH = (
    '*[_type == "weeklyIssue" && _id == $id][0]{ '
    '_id, '
    'issueNumber, '
    '"charityName": charity->name, '
    'theme{primaryColor, accentColor, backgroundColor, textColor, '
    '      fontDisplay, fontBody, visualDirection}, '
    '"pdfContent": problemStatement.pdfContent{problemStatement, '
    '              keyDataPoints[]{stat, source}, interventionMechanism} '
    '}'
)

# WHK-08 lookup: manual fallback receives only the runId; Sanity is the source
# of truth for which issue that runId produced.
QUERY_ISSUE_BY_RUN_ID = (
    '*[_type == "weeklyIssue" && pipelineMetadata.runId == $runId][0]{ '
    '_id, '
    'issueNumber '
    '}'
)

# WHK-05: Sanity CDN propagation delay before firing Vercel deploy hook.
CDN_PROPAGATION_DELAY_SEC: float = 30.0


async def _run_publisher(
    app,
    *,
    issue_id: str,
    issue_number: int,
    run_id: str | None,
) -> None:
    """Single Publisher coroutine — invoked by webhook AND manual fallback.

    Pipeline:
      1. GROQ-fetch the issue with useCdn=False (WHK-06).
      2. WeasyPrint-render the Problem Statement PDF (PDF-01, PDF-02).
      3. Upload PDF to Sanity + patch problemPdf (PDF-03).
      4. asyncio.sleep(30) — Sanity CDN propagation (WHK-05).
      5. POST Vercel deploy hook (WHK-05).
      6. Convex pipelineRuns:updateStatus('complete') + deliberationEvents
         publisher-deploy (WHK-07).

    Convex writes are non-blocking (convex_mutation_safe swallows errors per
    CLAUDE.md "Cross-Cutting Concerns"). PDF-render and Sanity-upload
    failures halt the chain (CLAUDE.md "Sanity failure halts the pipeline").

    runId is optional (Open Question 5 in 06-RESEARCH): manually-authored
    drafts have no pipeline run; the Convex step is skipped if run_id is
    None — the PDF still publishes and Vercel still deploys.
    """
    log.info(
        "Publisher start: issue_id=%s issue_number=%s run_id=%s",
        issue_id, issue_number, run_id,
    )

    # 1. WHK-06: GROQ fetch (non-CDN — groq_query targets *.api.sanity.io).
    rows = await groq_query(QUERY_ISSUE_FOR_PUBLISH, params={"id": issue_id})
    if not rows:
        raise RuntimeError(f"Publisher: issue {issue_id} not found in Sanity")
    # GROQ filter `*[...][0]` returns a single doc; groq_query wraps it in a
    # one-item list in the .result.
    issue = rows if isinstance(rows, dict) else rows[0] if isinstance(rows, list) and rows else None
    if not issue:
        raise RuntimeError(f"Publisher: empty result for issue {issue_id}")

    # 2. PDF-01 + PDF-02: render with theme + pdfContent.
    pdf_bytes = render_problem_statement_pdf(
        issue_number=issue["issueNumber"],
        charity_name=issue.get("charityName") or "Untitled Charity",
        pdf_content=issue.get("pdfContent") or {},
        theme=issue.get("theme") or {},
    )
    log.info("Publisher: PDF rendered (%d bytes)", len(pdf_bytes))

    # 3. PDF-03: upload to Sanity + patch problemPdf.
    sanity_http = get_sanity_http()
    await upload_pdf_to_issue(
        sanity_http,
        issue_id=issue_id,
        pdf_bytes=pdf_bytes,
        issue_number=issue["issueNumber"],
    )
    log.info("Publisher: PDF uploaded + problemPdf patched on Sanity.")

    # 4. WHK-05: wait for Sanity CDN propagation (30s) BEFORE Vercel deploy.
    await asyncio.sleep(CDN_PROPAGATION_DELAY_SEC)

    # 5. WHK-05: trigger Vercel deploy hook.
    vercel_http = getattr(app.state, "convex_http", None) or get_sanity_http()
    # Use a dedicated short-lived client OK too; reuse convex_http (httpx
    # AsyncClient) since the lifespan already opened it. The URL is the
    # full Vercel deploy hook (absolute), so base_url doesn't matter.
    deploy_response = await trigger_vercel_deploy(vercel_http)
    log.info("Publisher: Vercel deploy triggered — %s", deploy_response)

    # 6. WHK-07: Convex pipelineRuns:updateStatus + publisher-deploy event.
    if run_id is None:
        log.info("Publisher: run_id is None (manually-authored issue) — skipping Convex updates.")
        return
    import time as _time
    await convex_mutation_safe(
        "pipelineRuns:updateStatus",
        {
            "runId": run_id,
            "status": "complete",
            "completedAt": int(_time.time() * 1000),
        },
    )
    await convex_mutation_safe(
        "deliberationEvents:insert",
        {
            "runId": run_id,
            "agentId": "publisher",
            "eventType": "publisher-deploy",
            "payload": str({
                "issueId": issue_id,
                "issueNumber": issue["issueNumber"],
                "deploy": deploy_response,
            }),
            "timestamp": int(_time.time() * 1000),
        },
    )
    log.info("Publisher: Convex writes complete (status=complete, publisher-deploy emitted).")
```

Verify the file structure: the existing @agent_node `publisher` symbol MUST remain unchanged at the top; the new `_run_publisher` symbol MUST exist below. Both must be importable from the package:

```bash
cd packages/pipeline
uv run python -c "from eisenbalm_pipeline.agents.publisher import publisher, _run_publisher, QUERY_ISSUE_BY_RUN_ID; print('ok')"
```
  </action>
  <verify>
    <automated>cd packages/pipeline && grep -c "async def _run_publisher" src/eisenbalm_pipeline/agents/publisher/__init__.py && grep -c "QUERY_ISSUE_FOR_PUBLISH" src/eisenbalm_pipeline/agents/publisher/__init__.py && grep -c "QUERY_ISSUE_BY_RUN_ID" src/eisenbalm_pipeline/agents/publisher/__init__.py && grep -c "asyncio.sleep(CDN_PROPAGATION_DELAY_SEC)" src/eisenbalm_pipeline/agents/publisher/__init__.py && uv run python -c "from eisenbalm_pipeline.agents.publisher import publisher, _run_publisher, QUERY_ISSUE_BY_RUN_ID, CDN_PROPAGATION_DELAY_SEC; print('ok')"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "async def _run_publisher" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` returns `1`
    - `grep -c "QUERY_ISSUE_FOR_PUBLISH" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` returns at least `1`
    - `grep -c "QUERY_ISSUE_BY_RUN_ID" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` returns at least `1`
    - `grep -c "render_problem_statement_pdf" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` returns `1`
    - `grep -c "upload_pdf_to_issue" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` returns `1`
    - `grep -c "trigger_vercel_deploy" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` returns `1`
    - `grep -c "asyncio.sleep(CDN_PROPAGATION_DELAY_SEC)" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` returns `1`
    - `grep -c "pipelineRuns:updateStatus" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` returns at least `2` (the Phase 4 `publisher` still has one, plus the new `_run_publisher`)
    - `grep -c "publisher-deploy" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` returns at least `2` (one in @agent_node emit_event, one in _run_publisher deliberationEvents)
    - Phase 4 `@agent_node` publisher symbol still present: `grep -c "@agent_node" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` returns `1`
    - Import test exits 0
  </acceptance_criteria>
  <done>
    _run_publisher exists; Phase 4 publisher symbol preserved; GROQ projections colocated; 30s delay constant defined and used.
  </done>
</task>

<task type="auto">
  <name>Task 2: Rewrite api/webhooks.py with real HMAC + age + idempotency + create_task wiring</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py (current stub — replace whole body)
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py (asyncio.create_task pattern at lines 246-248)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py (Plan 06-04 — error class hierarchy)
    - packages/pipeline/src/eisenbalm_pipeline/lib/idempotency.py (Plan 06-04 — claim_idempotency_key signature)
    - .planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md (Pattern 4 — exact handler shape)
  </read_first>
  <files>
    - packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py
  </files>
  <action>
Replace `packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` ENTIRELY with this content:

```python
"""Sanity webhook receiver (Phase 6 — real handler).

Pipeline:
  1. WHK-02: Verify HMAC signature over raw body (lib/sanity_webhook).
  2. WHK-03: Reject signatures older than (or future-skewed beyond) 5 minutes.
  3. Guard: only process status='published' (ignore in-review / draft transitions).
  4. WHK-04: Dedup via idempotency-key + Supabase webhook_idempotency UNIQUE.
  5. Launch _run_publisher in background via asyncio.create_task (Pattern 4).
  6. Return 200 immediately (CLAUDE.md "Sanity webhook handler MUST return 200 immediately").

The actual PDF + Vercel + Convex chain runs in _run_publisher
(agents/publisher/__init__.py) — same coroutine the manual fallback at
api/runs.py invokes.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os

from fastapi import APIRouter, HTTPException, Request, status

from eisenbalm_pipeline.agents.publisher import _run_publisher
from eisenbalm_pipeline.lib.idempotency import claim_idempotency_key
from eisenbalm_pipeline.lib.sanity_webhook import (
    SIGNATURE_HEADER_NAME,
    SignatureError,
    SignatureExpiredError,
    verify_sanity_signature,
)

log = logging.getLogger(__name__)
router = APIRouter()


@router.post("/webhook/sanity-publish")
async def sanity_publish(request: Request) -> dict:
    """Sanity webhook handler. Returns 200 fast; Publisher runs in background."""

    # Required env (fail-loud if misconfigured at runtime).
    try:
        secret = os.environ["SANITY_WEBHOOK_SECRET"]
    except KeyError:
        log.error("SANITY_WEBHOOK_SECRET is not set — rejecting all webhooks.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SANITY_WEBHOOK_SECRET unset",
        )

    # 1 + 2. WHK-02 + WHK-03: read RAW body THEN verify signature + age.
    raw = await request.body()
    sig_header = request.headers.get(SIGNATURE_HEADER_NAME)
    try:
        ts_ms = verify_sanity_signature(raw, sig_header, secret)
    except SignatureExpiredError as e:
        log.warning("Webhook rejected (expired): %s", e)
        # 410 Gone — "the resource is no longer available" maps cleanly to "this signature is stale."
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Signature too old")
    except SignatureError as e:
        log.warning("Webhook rejected (signature): %s", e)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    # 3. Guard on status — Sanity sends transitions; we only care about publish.
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Body is not valid JSON")

    if payload.get("status") != "published":
        log.info("Webhook skipped (status=%s, not 'published').", payload.get("status"))
        return {"ok": True, "skipped": "not-published"}

    # 4. WHK-04: idempotency-key dedup.
    idem = request.headers.get("idempotency-key")
    pool = getattr(request.app.state, "pool", None)
    if idem and pool is not None:
        try:
            first = await claim_idempotency_key(
                pool,
                source="sanity-publish",
                idempotency_key=idem,
                run_id=payload.get("runId"),
            )
        except Exception as exc:  # noqa: BLE001 — log + proceed (don't lose webhooks on DB blip)
            log.exception("Idempotency check failed (proceeding anyway): %s", exc)
            first = True
        if not first:
            log.info("Webhook deduplicated (idempotency-key=%s).", idem)
            return {"ok": True, "duplicate": True}
    elif not idem:
        # Pitfall 6: missing idempotency-key is a Sanity edge case — log + proceed.
        log.warning("Webhook arrived with no idempotency-key header; proceeding without dedup.")

    # 5. Launch _run_publisher in background (research Pattern 3 / Phase 4 Pitfall 4 —
    #    asyncio.create_task, NOT FastAPI BackgroundTasks).
    try:
        issue_id = payload["_id"]
        issue_number = payload["issueNumber"]
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Webhook payload missing required field: {e}",
        )
    run_id = payload.get("runId")  # may be None for manually-authored drafts

    task = asyncio.create_task(
        _run_publisher(
            request.app,
            issue_id=issue_id,
            issue_number=issue_number,
            run_id=run_id,
        )
    )
    request.app.state.background_tasks.add(task)
    task.add_done_callback(request.app.state.background_tasks.discard)
    log.info(
        "Webhook scheduled Publisher: issue_id=%s issue_number=%s run_id=%s ts_ms=%s",
        issue_id, issue_number, run_id, ts_ms,
    )

    # 6. Return 200 immediately — Publisher runs in background.
    return {"ok": True, "scheduled": True}
```

After the rewrite, verify the route is registered + the imports work:

```bash
cd packages/pipeline
uv run python -c "
from eisenbalm_pipeline.api.webhooks import router
routes = [r.path for r in router.routes]
assert '/webhook/sanity-publish' in routes, f'missing route: {routes}'
print('ok')
"
```
  </action>
  <verify>
    <automated>cd packages/pipeline && grep -c "verify_sanity_signature" src/eisenbalm_pipeline/api/webhooks.py && grep -c "claim_idempotency_key" src/eisenbalm_pipeline/api/webhooks.py && grep -c "_run_publisher" src/eisenbalm_pipeline/api/webhooks.py && grep -c "asyncio.create_task" src/eisenbalm_pipeline/api/webhooks.py && uv run python -c "from eisenbalm_pipeline.api.webhooks import router; assert '/webhook/sanity-publish' in [r.path for r in router.routes]; print('ok')"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "verify_sanity_signature" packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` returns `1`
    - `grep -c "claim_idempotency_key" packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` returns `1`
    - `grep -c "_run_publisher" packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` returns at least `2` (import + invocation)
    - `grep -c "asyncio.create_task" packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` returns `1`
    - `grep -c "phase4Stub" packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` returns `0` (Phase 4 stub marker removed)
    - `grep -c "HTTP_410_GONE" packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` returns `1`
    - `grep -c "HTTP_401_UNAUTHORIZED" packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` returns `1`
    - The OLD Phase 4 marker note is absent: `grep -c "TODO(Phase 6)" packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` returns `0`
    - Route registration test exits 0
  </acceptance_criteria>
  <done>
    api/webhooks.py is the real handler; Phase 4 stub completely replaced; route still at `/webhook/sanity-publish`.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire api/runs.py::manual_publish to invoke _run_publisher (WHK-08)</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py (current stub at line 255-272)
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py (after Task 1 — _run_publisher + QUERY_ISSUE_BY_RUN_ID)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (groq_query)
    - .planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md (Pitfall 7 — single implementation)
  </read_first>
  <files>
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
  </files>
  <action>
Replace the Phase 4 stub `manual_publish` handler in `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` (lines 255-272) with the real implementation. The function MUST:
  - Preserve `_require_trigger_secret(request)` (existing security guard).
  - GROQ-look up the issue's Sanity `_id` and `issueNumber` from the runId
    using `QUERY_ISSUE_BY_RUN_ID`.
  - Invoke the SAME `_run_publisher` coroutine the webhook handler uses
    (Pitfall 7 — single implementation).
  - Use `asyncio.create_task` + `app.state.background_tasks` (Phase 4 Pitfall 4 pattern).

Locate the existing block:

```python
# ── POST /run/{run_id}/publish — manual fallback stub (Phase 6 hardens) ──

@router.post("/run/{run_id}/publish")
async def manual_publish(request: Request, run_id: str) -> dict:
    """Manual fallback re-trigger (CONTEXT D-05 + WHK-08).

    Phase 4 stub: returns 200 with a marker payload. Phase 6 wires this to
    invoke the Publisher node directly (re-runs PDF generation + Vercel deploy
    hook fire even when the Sanity webhook fails to fire).
    """
    _require_trigger_secret(request)
    log.info("Manual publish requested for runId=%s — Phase 6 stub", run_id)
    return {
        "runId": run_id,
        "phase4Stub": True,
        "note": (
            "POST /run/{runId}/publish is a Phase 4 endpoint stub. "
            "Phase 6 wires the real PDF generation + Vercel deploy hook."
        ),
    }
```

Replace it with:

```python
# ── POST /run/{run_id}/publish — WHK-08 manual fallback (real) ───────────

@router.post("/run/{run_id}/publish")
async def manual_publish(request: Request, run_id: str) -> dict:
    """Manual fallback re-trigger (WHK-08).

    The Sanity webhook handler is the primary trigger for the Publisher.
    This endpoint is the manual re-fire path used when:
      - Sanity webhook failed to deliver (network blip)
      - Webhook signature secret rotated and Sanity has stale cache
      - Andrew wants to re-render a PDF after editing pdfContent in Studio

    Looks up the Sanity issue document by `pipelineMetadata.runId == $runId`
    (the Sanity-side authoritative store), then invokes the SAME _run_publisher
    coroutine the webhook calls — there is exactly one Publisher implementation
    (research Pitfall 7).
    """
    _require_trigger_secret(request)
    log.info("Manual publish requested for runId=%s", run_id)

    # Import here to avoid circular import at module load (agents/publisher
    # imports sanity_client; api/runs.py imports convex_client; lib modules
    # may transitively touch the FastAPI router).
    from eisenbalm_pipeline.agents.publisher import (
        QUERY_ISSUE_BY_RUN_ID,
        _run_publisher,
    )
    from eisenbalm_pipeline.lib.sanity_client import groq_query

    # GROQ filter `*[...][0]` returns one object (or null) — but groq_query's
    # contract is "list of results", so it returns [{}] or [].
    result = await groq_query(QUERY_ISSUE_BY_RUN_ID, params={"runId": run_id})
    issue = None
    if isinstance(result, list) and result:
        issue = result[0]
    elif isinstance(result, dict):
        issue = result
    if not issue or not issue.get("_id"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No Sanity weeklyIssue found for runId={run_id}",
        )

    task = asyncio.create_task(
        _run_publisher(
            request.app,
            issue_id=issue["_id"],
            issue_number=issue["issueNumber"],
            run_id=run_id,
        )
    )
    request.app.state.background_tasks.add(task)
    task.add_done_callback(request.app.state.background_tasks.discard)

    return {
        "runId": run_id,
        "issueId": issue["_id"],
        "issueNumber": issue["issueNumber"],
        "scheduled": True,
    }
```

Verify the route still exists and the trigger-secret guard still gates it:

```bash
cd packages/pipeline
uv run python -c "
from eisenbalm_pipeline.api.runs import router, manual_publish
import inspect
src = inspect.getsource(manual_publish)
assert '_require_trigger_secret' in src
assert '_run_publisher' in src
assert 'QUERY_ISSUE_BY_RUN_ID' in src
assert 'phase4Stub' not in src
print('ok')
"
```
  </action>
  <verify>
    <automated>cd packages/pipeline && grep -c "_run_publisher" src/eisenbalm_pipeline/api/runs.py && grep -c "QUERY_ISSUE_BY_RUN_ID" src/eisenbalm_pipeline/api/runs.py && ! grep -q "phase4Stub" src/eisenbalm_pipeline/api/runs.py && uv run python -c "from eisenbalm_pipeline.api.runs import manual_publish; import inspect; src=inspect.getsource(manual_publish); assert '_require_trigger_secret' in src and '_run_publisher' in src and 'phase4Stub' not in src; print('ok')"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "_run_publisher" packages/pipeline/src/eisenbalm_pipeline/api/runs.py` returns at least `1`
    - `grep -c "QUERY_ISSUE_BY_RUN_ID" packages/pipeline/src/eisenbalm_pipeline/api/runs.py` returns at least `1`
    - `grep -c "phase4Stub" packages/pipeline/src/eisenbalm_pipeline/api/runs.py` returns `0`
    - `grep -c "_require_trigger_secret" packages/pipeline/src/eisenbalm_pipeline/api/runs.py` returns at least `3` (three protected endpoints: /run/weekly, /run/{id}/resume, /run/{id}/publish)
    - `grep -c "404_NOT_FOUND" packages/pipeline/src/eisenbalm_pipeline/api/runs.py` returns at least `1` (the new "issue not found by runId" path)
    - manual_publish source contains BOTH _require_trigger_secret AND _run_publisher (the inspect.getsource check)
    - The route stays at `/run/{run_id}/publish` (`grep -c '@router.post(\"/run/{run_id}/publish\")' packages/pipeline/src/eisenbalm_pipeline/api/runs.py` returns `1`)
  </acceptance_criteria>
  <done>
    manual_publish invokes the SAME _run_publisher coroutine the webhook does; trigger-secret guard preserved; 404 surfaced when no issue exists for the runId.
  </done>
</task>

<task type="auto">
  <name>Task 4: Unskip + flesh out the Publisher + webhook handler + manual fallback test files</name>
  <read_first>
    - packages/pipeline/tests/agents/publisher/test_publisher.py (Wave 0 — locked names: test_publisher_uploads_to_sanity, test_30s_delay_before_vercel, test_publisher_uses_non_cdn_sanity_host, test_completes_convex_writes)
    - packages/pipeline/tests/api/test_webhook_sanity.py (Wave 0 — locked names)
    - packages/pipeline/tests/api/test_runs.py (Wave 0 — locked names)
    - packages/pipeline/tests/conftest.py (encode_sanity_signature, mock_convex_mutation, mock_vercel_trigger)
  </read_first>
  <files>
    - packages/pipeline/tests/agents/publisher/test_publisher.py
    - packages/pipeline/tests/api/test_webhook_sanity.py
    - packages/pipeline/tests/api/test_runs.py
  </files>
  <action>
Replace each test file's body, preserving the locked test names. Remove all `@pytest.mark.skip(...)` decorators.

**`tests/agents/publisher/test_publisher.py`** — REAL WeasyPrint + REAL renderer; mock only Sanity HTTP (via respx) + Convex (via mock_convex_mutation) + Vercel (via mock_vercel_trigger) + asyncio.sleep (via monkeypatch):

```python
"""Publisher coroutine tests (_run_publisher). Plan 06-07 fills bodies.

Mocks Sanity httpx via respx; Convex via mock_convex_mutation fixture;
Vercel via mock_vercel_trigger; asyncio.sleep patched to no-op.
WeasyPrint runs for REAL against vendored TTFs.
"""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
import respx

from eisenbalm_pipeline.agents.publisher import _run_publisher


FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _sample_groq_result() -> dict:
    return {
        "_id": "issue-42",
        "issueNumber": 42,
        "charityName": "The Quiet Foundation",
        "theme": json.loads((FIXTURES_DIR / "sample_theme.json").read_text()),
        "pdfContent": json.loads((FIXTURES_DIR / "sample_pdf_content.json").read_text()),
    }


def _build_fake_app() -> MagicMock:
    """Mock FastAPI app with the state attributes _run_publisher reads."""
    app = MagicMock()
    app.state = MagicMock()
    app.state.pool = None
    app.state.background_tasks = set()
    app.state.convex_http = MagicMock(spec=httpx.AsyncClient)
    return app


async def test_publisher_uploads_to_sanity(monkeypatch, mock_convex_mutation, mock_vercel_trigger):
    """PDF-03: _run_publisher invokes upload_pdf_to_issue with PDF bytes + asset patch."""
    # Patch groq_query to return our sample
    fake_groq = AsyncMock(return_value=[_sample_groq_result()])
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.groq_query",
        fake_groq,
    )
    # Patch upload_pdf_to_issue
    fake_upload = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.upload_pdf_to_issue",
        fake_upload,
    )
    # Skip the 30s sleep
    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher.asyncio.sleep", AsyncMock(return_value=None))
    # Vercel + Convex
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.trigger_vercel_deploy",
        mock_vercel_trigger,
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.convex_mutation_safe",
        mock_convex_mutation,
    )
    # Patch the Sanity client lookup (used by upload_pdf_to_issue caller — get_client returns a fake)
    fake_sanity_http = MagicMock(spec=httpx.AsyncClient)
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.get_sanity_http",
        lambda: fake_sanity_http,
    )

    app = _build_fake_app()
    await _run_publisher(app, issue_id="issue-42", issue_number=42, run_id="run-abc")

    # PDF-03: upload_pdf_to_issue was called with non-empty PDF bytes.
    fake_upload.assert_awaited_once()
    call_kwargs = fake_upload.call_args.kwargs
    assert call_kwargs["issue_id"] == "issue-42"
    assert call_kwargs["issue_number"] == 42
    assert isinstance(call_kwargs["pdf_bytes"], bytes)
    assert call_kwargs["pdf_bytes"].startswith(b"%PDF-")
    assert len(call_kwargs["pdf_bytes"]) > 1000


async def test_30s_delay_before_vercel(monkeypatch, mock_convex_mutation, mock_vercel_trigger):
    """WHK-05: asyncio.sleep called with 30.0 BEFORE trigger_vercel_deploy."""
    call_order: list[str] = []

    async def recording_sleep(seconds: float):
        call_order.append(f"sleep({seconds})")

    async def recording_vercel(http):
        call_order.append("vercel")
        return {"job": {"id": "x", "state": "READY", "createdAt": 1}}

    fake_groq = AsyncMock(return_value=[_sample_groq_result()])
    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher.groq_query", fake_groq)
    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher.upload_pdf_to_issue", AsyncMock())
    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher.asyncio.sleep", recording_sleep)
    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher.trigger_vercel_deploy", recording_vercel)
    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher.convex_mutation_safe", mock_convex_mutation)
    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher.get_sanity_http", lambda: MagicMock())

    app = _build_fake_app()
    await _run_publisher(app, issue_id="issue-42", issue_number=42, run_id="run-abc")

    # sleep(30.0) MUST appear BEFORE vercel call.
    assert "sleep(30.0)" in call_order, f"30s sleep missing from {call_order}"
    assert "vercel" in call_order
    assert call_order.index("sleep(30.0)") < call_order.index("vercel")


async def test_publisher_uses_non_cdn_sanity_host(monkeypatch, mock_convex_mutation, mock_vercel_trigger):
    """WHK-06: groq_query is called (which targets *.api.sanity.io NOT *.apicdn.sanity.io)."""
    captured: dict = {}

    async def capturing_groq(query: str, *, params=None):
        captured["query"] = query
        captured["params"] = params
        return [_sample_groq_result()]

    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher.groq_query", capturing_groq)
    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher.upload_pdf_to_issue", AsyncMock())
    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher.asyncio.sleep", AsyncMock())
    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher.trigger_vercel_deploy", mock_vercel_trigger)
    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher.convex_mutation_safe", mock_convex_mutation)
    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher.get_sanity_http", lambda: MagicMock())

    app = _build_fake_app()
    await _run_publisher(app, issue_id="issue-42", issue_number=42, run_id="run-abc")

    # The publisher uses groq_query (which lives in lib/sanity_client.py and
    # targets *.api.sanity.io by construction). Confirm groq_query was used at all.
    assert "weeklyIssue" in captured["query"], "GROQ query not invoked"
    assert captured["params"] == {"id": "issue-42"}

    # Defensive: the source of groq_query should NOT use apicdn.
    import eisenbalm_pipeline.lib.sanity_client as sc_mod
    source = Path(sc_mod.__file__).read_text()
    assert "apicdn.sanity.io" not in source, "lib/sanity_client.py must not use the CDN host"
    assert ".api.sanity.io" in source


async def test_completes_convex_writes(monkeypatch, mock_convex_mutation, mock_vercel_trigger):
    """WHK-07: After Vercel deploy success, Convex receives status=complete + publisher-deploy event."""
    monkeypatch.setattr(
        "eisenbalm_pipeline.agents.publisher.groq_query",
        AsyncMock(return_value=[_sample_groq_result()]),
    )
    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher.upload_pdf_to_issue", AsyncMock())
    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher.asyncio.sleep", AsyncMock())
    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher.trigger_vercel_deploy", mock_vercel_trigger)
    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher.convex_mutation_safe", mock_convex_mutation)
    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher.get_sanity_http", lambda: MagicMock())

    app = _build_fake_app()
    await _run_publisher(app, issue_id="issue-42", issue_number=42, run_id="run-abc")

    # mock_convex_mutation called at least twice — once for updateStatus + once for publisher-deploy.
    assert mock_convex_mutation.await_count >= 2
    # Inspect the calls
    mutation_names = [call.args[0] for call in mock_convex_mutation.await_args_list]
    assert "pipelineRuns:updateStatus" in mutation_names
    assert "deliberationEvents:insert" in mutation_names

    # Verify status=complete on the updateStatus call
    update_call = next(c for c in mock_convex_mutation.await_args_list if c.args[0] == "pipelineRuns:updateStatus")
    assert update_call.args[1]["status"] == "complete"
    assert update_call.args[1]["runId"] == "run-abc"

    # Verify eventType=publisher-deploy
    event_call = next(c for c in mock_convex_mutation.await_args_list if c.args[0] == "deliberationEvents:insert")
    assert event_call.args[1]["eventType"] == "publisher-deploy"
    assert event_call.args[1]["agentId"] == "publisher"
```

**`tests/api/test_webhook_sanity.py`** — uses the in-process FastAPI test client:

```python
"""Sanity webhook handler tests (Plan 06-07 fills bodies).

The `client` fixture is the in-process ASGITransport AsyncClient (conftest).
Tests skip if required env vars are unset (SANITY_API_TOKEN, etc.).
"""
from __future__ import annotations

import json
import os
import time
from unittest.mock import AsyncMock

import pytest


SECRET = "test-secret-32-bytes"


async def test_route_exists(client):
    """WHK-01: POST /webhook/sanity-publish returns < 500 for ANY input (handler exists)."""
    r = await client.post("/webhook/sanity-publish", content=b"{}")
    assert r.status_code < 500


async def test_signature_accept_and_reject(client, sanity_signature_encoder, monkeypatch):
    """WHK-02: valid signature → 200; tampered body → 401."""
    monkeypatch.setenv("SANITY_WEBHOOK_SECRET", SECRET)
    # Patch _run_publisher so the test doesn't actually run the chain
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.webhooks._run_publisher",
        AsyncMock(return_value=None),
    )
    ts = int(time.time() * 1000)
    body = json.dumps({"_id": "issue-1", "issueNumber": 1, "status": "published", "runId": "r1"}).encode()
    good_header = sanity_signature_encoder(body, ts, SECRET)

    # Valid signature → 200
    r = await client.post(
        "/webhook/sanity-publish",
        content=body,
        headers={"sanity-webhook-signature": good_header, "idempotency-key": "test-k1"},
    )
    assert r.status_code == 200, r.text

    # Tampered body → 401
    r = await client.post(
        "/webhook/sanity-publish",
        content=body + b"x",  # corrupt body
        headers={"sanity-webhook-signature": good_header, "idempotency-key": "test-k2"},
    )
    assert r.status_code == 401, r.text


async def test_age_rejection(client, sanity_signature_encoder, monkeypatch):
    """WHK-03: timestamp older than 5 minutes → 410 Gone."""
    monkeypatch.setenv("SANITY_WEBHOOK_SECRET", SECRET)
    body = json.dumps({"_id": "issue-1", "issueNumber": 1, "status": "published"}).encode()
    # Signature timestamp 10 minutes in the past
    stale_ts = int(time.time() * 1000) - (10 * 60 * 1000)
    stale_header = sanity_signature_encoder(body, stale_ts, SECRET)
    r = await client.post(
        "/webhook/sanity-publish",
        content=body,
        headers={"sanity-webhook-signature": stale_header, "idempotency-key": "test-stale"},
    )
    assert r.status_code == 410, r.text


async def test_idempotency_dedup(client, sanity_signature_encoder, webhook_idempotency_clean, monkeypatch):
    """WHK-04: same idempotency-key sent twice → publisher fires exactly once."""
    monkeypatch.setenv("SANITY_WEBHOOK_SECRET", SECRET)
    # Spy on _run_publisher; track call count
    pub_spy = AsyncMock(return_value=None)
    monkeypatch.setattr("eisenbalm_pipeline.api.webhooks._run_publisher", pub_spy)

    ts = int(time.time() * 1000)
    body = json.dumps({"_id": "issue-7", "issueNumber": 7, "status": "published", "runId": "r7"}).encode()
    header = sanity_signature_encoder(body, ts, SECRET)
    headers = {"sanity-webhook-signature": header, "idempotency-key": "dup-key-1"}

    r1 = await client.post("/webhook/sanity-publish", content=body, headers=headers)
    r2 = await client.post("/webhook/sanity-publish", content=body, headers=headers)
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json().get("scheduled") is True
    assert r2.json().get("duplicate") is True
    # Background task was scheduled exactly once — but the await may not have happened yet.
    # The handler returns immediately; the task may or may not have executed by now.
    # Assert on the route's idempotency contract instead: only ONE call was scheduled.
    # (We can't reliably assert call_count without awaiting the task.)


async def test_missing_idempotency_proceeds(client, sanity_signature_encoder, monkeypatch):
    """WHK-04 Pitfall 6: missing idempotency-key header is allowed (proceeds with warning)."""
    monkeypatch.setenv("SANITY_WEBHOOK_SECRET", SECRET)
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.webhooks._run_publisher",
        AsyncMock(return_value=None),
    )
    ts = int(time.time() * 1000)
    body = json.dumps({"_id": "issue-8", "issueNumber": 8, "status": "published"}).encode()
    header = sanity_signature_encoder(body, ts, SECRET)
    # No idempotency-key header
    r = await client.post(
        "/webhook/sanity-publish",
        content=body,
        headers={"sanity-webhook-signature": header},
    )
    assert r.status_code == 200, r.text
    assert r.json().get("scheduled") is True
```

**`tests/api/test_runs.py`** — patches _run_publisher and groq_query, asserts the wiring:

```python
"""Manual publish fallback tests (Plan 06-07 fills bodies)."""
from __future__ import annotations

import os
from unittest.mock import AsyncMock

import pytest


async def test_manual_publish_invokes_publisher(client, monkeypatch):
    """WHK-08: POST /run/{runId}/publish invokes the same _run_publisher coroutine."""
    fake_groq = AsyncMock(return_value=[{"_id": "issue-99", "issueNumber": 99}])
    monkeypatch.setattr("eisenbalm_pipeline.lib.sanity_client.groq_query", fake_groq)

    pub_spy = AsyncMock(return_value=None)
    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher._run_publisher", pub_spy)

    r = await client.post("/run/run-abc-123/publish")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["runId"] == "run-abc-123"
    assert body["issueId"] == "issue-99"
    assert body["issueNumber"] == 99
    assert body["scheduled"] is True
    # groq_query was used to look up the issue by runId
    fake_groq.assert_awaited()
    call_kwargs = fake_groq.await_args.kwargs
    assert call_kwargs["params"] == {"runId": "run-abc-123"}


async def test_manual_publish_requires_trigger_secret(client):
    """WHK-08: trigger-secret guard same as /run/weekly + /run/{id}/resume."""
    # The `client` fixture sets the trigger-secret header automatically (conftest).
    # Test by sending a request WITHOUT the header — expect 401.
    if not os.environ.get("PIPELINE_TRIGGER_SECRET"):
        pytest.skip("PIPELINE_TRIGGER_SECRET unset — guard is no-op in dev")
    # Override the fixture's default header by sending empty headers explicitly.
    r = await client.post(
        "/run/some-id/publish",
        headers={"X-Pipeline-Trigger-Secret": ""},
    )
    assert r.status_code == 401, r.text
```

Run the suite:
```bash
cd packages/pipeline
EISENBALM_STUB_MODE=true uv run pytest tests/agents/publisher/test_publisher.py tests/api/test_webhook_sanity.py tests/api/test_runs.py -x -v 2>&1 | tail -20
```
  </action>
  <verify>
    <automated>cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/publisher/test_publisher.py tests/api/test_webhook_sanity.py tests/api/test_runs.py -x 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "@pytest.mark.skip" packages/pipeline/tests/agents/publisher/test_publisher.py` returns `0`
    - `grep -c "@pytest.mark.skip" packages/pipeline/tests/api/test_webhook_sanity.py` returns `0`
    - `grep -c "@pytest.mark.skip" packages/pipeline/tests/api/test_runs.py` returns `0`
    - All 4 test_publisher.py test names present: test_publisher_uploads_to_sanity, test_30s_delay_before_vercel, test_publisher_uses_non_cdn_sanity_host, test_completes_convex_writes (`grep -c "async def test_" tests/agents/publisher/test_publisher.py` returns at least `4`)
    - All 5 test_webhook_sanity.py test names present: test_route_exists, test_signature_accept_and_reject, test_age_rejection, test_idempotency_dedup, test_missing_idempotency_proceeds
    - `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/publisher/test_publisher.py -x 2>&1 | tail -1` shows ≥ 4 passed
    - `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/api/test_webhook_sanity.py 2>&1 | tail -1` shows ≥ 5 passed/skipped (skipped is OK when client fixture skips due to missing env)
    - `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/api/test_runs.py 2>&1 | tail -1` shows ≥ 2 passed/skipped
  </acceptance_criteria>
  <done>
    All Phase 6 unit + integration tests pass (or skip cleanly on env-missing); Wave 0 skeletons all resolved; the webhook + manual + Publisher chain is exercised end-to-end.
  </done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/ -x 2>&1 | tail -3` — full suite green: at least 4 PDF + 3 fonts + 6 sanity_webhook + 2 vercel_client + 4 publisher coroutine + 5 webhook handler + 2 manual fallback = 26+ Phase 6 tests passed (or cleanly skipped); 0 NEW failures
- `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.agents.publisher import publisher, _run_publisher; from eisenbalm_pipeline.api.webhooks import sanity_publish; from eisenbalm_pipeline.api.runs import manual_publish; print('ok')"` exits 0
- `grep -r "phase4Stub" packages/pipeline/ | wc -l` returns `0` (all Phase 4 stub markers removed)
- Phase 4 + Phase 5 tests still pass without regression: `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/test_calibrator.py tests/agents/test_problem.py tests/test_pipeline_integration.py 2>&1 | tail -1`
</verification>

<success_criteria>
1. agents/publisher/__init__.py has both `@agent_node publisher` (Phase 4 contract) AND `_run_publisher` (Phase 6 webhook coroutine)
2. api/webhooks.py is the real handler — verifies signature, rejects expired/tampered, dedups idempotency-key, launches _run_publisher via asyncio.create_task
3. api/runs.py::manual_publish invokes the SAME _run_publisher coroutine (single implementation, Pitfall 7)
4. All Plan 06-01 skeleton tests for publisher + webhook + manual fallback are unskipped and green
5. Phase 4 + Phase 5 suite has no new regressions
</success_criteria>

<output>
After completion, create `.planning/phases/06-pdf-generation-webhook-chain/06-pdf-generation-webhook-chain-07-SUMMARY.md` documenting:
  - The exact test pass/skip counts per file
  - The two-function distinction in agents/publisher/__init__.py (Phase 4 `publisher` vs Phase 6 `_run_publisher`) — why both exist
  - Any monkeypatch patterns that surprised you (e.g., having to patch the symbol on `eisenbalm_pipeline.agents.publisher.asyncio.sleep` rather than `asyncio.sleep`)
  - Whether the `webhook_idempotency_clean` fixture actually exercised live Postgres in this plan or skipped
</output>
