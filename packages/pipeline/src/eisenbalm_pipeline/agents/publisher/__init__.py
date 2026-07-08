"""Publisher package — Phase 4 stub body lives here.

Phase 6 promotes agents/publisher.py to agents/publisher/ (a package) so the
PDF renderer (pdf.py), font helpers (fonts.py), and Jinja2 templates can
co-locate with the @agent_node publisher entrypoint. This file's body is
VERBATIM from the Phase 4 stub publisher.py so:

  - graph/builder.py's `from eisenbalm_pipeline.agents.publisher import publisher`
    still resolves to the same callable.
  - Phase 4 PIP-* integration tests continue to pass without change.
  - Plan 06-07 replaces this stub body with the real Publisher webhook
    coroutine path — at which point the @agent_node here may either stay
    (still called by the graph for pipeline-end Sanity write) or be split
    further. Plan 06-07 decides.

CONTEXT D-18 steps 11 + 12 (canonical write order — Phase 4 lock):

  1. Sanity ``write_issue_draft(state, cost_payload)`` — once, at pipeline end.
     ``pipelineMetadata.runId = state['run_id']`` (Pitfall 6 — nesting matters).
  2. Convex ``pipelineRuns:updateStatus`` with status='awaiting-review' (NOT
     'complete' — Phase 6 webhook flips it to 'complete').
  3. Convex ``deliberationEvents:insert`` eventType='publisher-deploy' —
     emitted by the @agent_node wrapper via emit_event='publisher-deploy'.
"""
from __future__ import annotations

import time

from slugify import slugify

from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.claims import (
    _SECTION_ORDER,
    _SECTION_TO_GALLEY_ID,
    _normalise,
    block_index_hint,
    extract_claims_by_block,
)
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
from eisenbalm_pipeline.lib.cost import cost_payload_to_json, end_run
from eisenbalm_pipeline.lib.sanity_client import (
    get_client as get_sanity_http,
    write_issue_draft,
)

# Workspace ID — matches the canonical WORKSPACE_ID in config_loader.py.
WORKSPACE_ID = "eisenbalm"


def _publisher_payload(state: DispatchState) -> dict:
    return {
        "issueNumber": state["issue_number"],
        "sanityIssueId": state.get("sanity_issue_id"),
        # Plan 06-07 replaces the stub note with real PDF generation.
        "stubPdfNote": "stub-pdf-not-yet-implemented",
    }


@agent_node(
    name="publisher",
    emit_event="publisher-deploy",
    payload_builder=_publisher_payload,
)
async def publisher(state: DispatchState) -> DispatchState:
    run_id = state["run_id"]
    sanity_http = get_sanity_http()

    cost_payload, duration_ms = end_run(run_id)

    winning = state.get("winning_charity") or {}
    if winning and not state.get("winning_charity_sanity_id"):
        state = {
            **state,
            "winning_charity_sanity_id": f"charity-{slugify(winning['name'])}",
        }

    issue_id = await write_issue_draft(sanity_http, state, cost_payload)

    # Phase 35 (PRV-02/PRV-04): sourced + unsourced claim_checks seeding.
    # Extract BEFORE flipping to awaiting-review so claims are ready the instant
    # the run hits the review queue. Wrapped in try/except — claims are
    # best-effort; a Convex failure here must never block the run from landing.
    #
    # Row model (D-13, one-row-per-occurrence, §35.4/§35.5):
    #   1. SOURCED rows come from each prose writer's own `claimSpans`
    #      sidecar, resolved against `state['research']['claims']` for the
    #      real sourceUrl/retrievedAt (never post-hoc fuzzy-matched).
    #   2. UNSOURCED rows are the per-block regex catch-all
    #      (lib.claims.extract_claims_by_block) for everything else, MINUS
    #      any span already covered by a sourced claimSpan in the SAME
    #      (sectionName, blockIndexHint) bucket (D-04/Pitfall — do not
    #      double-list an already-sourced fact as unsourced).
    #   3. Both lists merge into one global claimIndex ordering, stable
    #      across re-runs on the same content.
    try:
        sections = {
            "origin_story": state.get("origin_story"),
            "problem_statement": state.get("problem_statement"),
            "founder_bio": state.get("founder_bio"),
            "case_study": state.get("case_study"),
            "bonus": state.get("bonus"),
        }

        # claimId -> {claimId, text, sourceUrl, retrievedAt} from the
        # Researcher's index-bound mapping (§35.2).
        research_claims = {
            c["claimId"]: c
            for c in ((state.get("research") or {}).get("claims") or [])
            if isinstance(c, dict) and c.get("claimId")
        }

        # SOURCED rows — one per writer-declared claimSpans occurrence.
        # Also tracks, per (sectionName, blockIndexHint), the set of
        # normalised asWritten strings already sourced there, so step 2
        # below can exclude the matching regex catch-all row.
        sourced_rows: list[dict] = []
        covered: dict[tuple[str, int | None], set[str]] = {}

        for key in _SECTION_ORDER:
            section = sections.get(key)
            if not isinstance(section, dict):
                continue
            galley_id = _SECTION_TO_GALLEY_ID[key]
            body = section.get("body")
            for span in section.get("claimSpans") or []:
                if not isinstance(span, dict):
                    continue
                claim_id = span.get("claimId")
                as_written = span.get("asWritten") or ""
                if not claim_id or not as_written:
                    continue
                rc = research_claims.get(claim_id)
                bih = block_index_hint(body, as_written)
                row: dict = {
                    "text": as_written,
                    "claimType": "sourced",
                    "context": as_written[:120],
                    "claimId": claim_id,
                    "sectionName": galley_id,
                }
                # Convex `v.optional()` fields must be OMITTED (not `null`)
                # when absent — mirrors agents/qa/__init__.py's
                # `if hint is not None: payload["blockIndexHint"] = hint`
                # precedent exactly.
                if bih is not None:
                    row["blockIndexHint"] = bih
                source_url = rc.get("sourceUrl") if rc else None
                if source_url is not None:
                    row["sourceUrl"] = source_url
                retrieved_at = rc.get("retrievedAt") if rc else None
                if retrieved_at is not None:
                    row["retrievedAt"] = retrieved_at
                sourced_rows.append(row)
                covered.setdefault((galley_id, bih), set()).add(
                    _normalise(as_written)
                )

        # UNSOURCED rows — per-block regex catch-all, minus anything already
        # covered by a bound sourced claimSpan in the same (section, block).
        unsourced_rows: list[dict] = []
        for row in extract_claims_by_block(sections):
            bucket = (row["sectionName"], row["blockIndexHint"])
            if _normalise(row["text"]) in covered.get(bucket, set()):
                continue
            unsourced_rows.append(row)

        # Merge: iterate sections in canonical order, then blocks in
        # ascending order, sourced-then-unsourced within each block — a
        # stable, deterministic ordering across re-runs (D-13).
        merged_rows: list[dict] = []
        for key in _SECTION_ORDER:
            galley_id = _SECTION_TO_GALLEY_ID[key]
            section_sourced = [
                r for r in sourced_rows if r["sectionName"] == galley_id
            ]
            section_unsourced = [
                r for r in unsourced_rows if r["sectionName"] == galley_id
            ]
            block_keys = sorted(
                {
                    r.get("blockIndexHint")
                    for r in section_sourced + section_unsourced
                },
                key=lambda b: (b is None, b if b is not None else 0),
            )
            for bi in block_keys:
                merged_rows.extend(
                    r for r in section_sourced if r.get("blockIndexHint") == bi
                )
                merged_rows.extend(
                    r for r in section_unsourced if r.get("blockIndexHint") == bi
                )

        claim_rows = [
            {**row, "claimIndex": idx} for idx, row in enumerate(merged_rows)
        ]

        await convex_mutation_safe(
            "claimChecks:insertBatch",
            {
                "workspace_id": WORKSPACE_ID,
                "runId": run_id,
                "claims": claim_rows,
            },
        )
    except Exception as _claims_exc:  # noqa: BLE001
        import logging as _logging
        _logging.getLogger(__name__).warning(
            "Publisher: claims extraction/insert failed (%r) — continuing",
            _claims_exc,
        )

    await convex_mutation_safe(
        "pipelineRuns:updateStatus",
        {
            "runId": run_id,
            "status": "awaiting-review",
            "completedAt": int(time.time() * 1000),
            "durationMs": duration_ms,
            "cost": cost_payload_to_json(cost_payload),
            # Phase 26: persist the Sanity _id so the review/publish endpoint
            # can resolve the Sanity issue from a runId (API_CONTRACTS §26.4).
            "sanityIssueId": issue_id,
        },
    )

    return {
        **state,
        "sanity_issue_id": issue_id,
    }


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
from eisenbalm_pipeline.lib.sanity_client import (
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
    # Phase 26 D-03: also fetch charity website + slug so _run_publisher can
    # upsert the featured charity into the Convex registry (REG-01).
    # Mirrors scout.py:137's `charity->{ name, ..., website }` projection.
    '"charityWebsite": charity->website, '
    '"charitySlug": charity->slug.current, '
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
    # GROQ filter `*[...][0]` returns a single doc, but groq_query wraps the
    # API response's .result, which may be a list (most common) or a single
    # dict depending on projection. Normalize both shapes.
    if isinstance(rows, list):
        issue = rows[0] if rows else None
    elif isinstance(rows, dict):
        issue = rows
    else:
        issue = None
    if not issue:
        raise RuntimeError(f"Publisher: issue {issue_id} not found in Sanity")

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
    # Vercel deploy hook URL is absolute — base_url of the reused client
    # doesn't matter. Prefer the lifespan-registered convex_http (always an
    # httpx.AsyncClient) to avoid constructing a new client per fire.
    vercel_http = getattr(app.state, "convex_http", None) or get_sanity_http()
    try:
        deploy_response = await trigger_vercel_deploy(vercel_http)
        log.info("Publisher: Vercel deploy triggered — %s", deploy_response)
    except Exception as e:  # deploy is non-fatal — the run MUST still finalize.
        # WHK-05: a missed deploy hook is not user-visible (ISR re-renders
        # within 60s) and must never leave a run un-finalized in Convex.
        # Swallow the error, record an observable sentinel, and continue to
        # the step-6 finalization below. The sentinel rides into the
        # publisher-deploy event payload under the "deploy" key (no new
        # eventType, no Convex schema change).
        log.warning(
            "Publisher: Vercel deploy failed after retries — %r. "
            "Continuing to finalize run.",
            e,
        )
        deploy_response = {"error": str(e)}

    # 6. WHK-07: Convex pipelineRuns:updateStatus + publisher-deploy event.
    if run_id is None:
        log.info(
            "Publisher: run_id is None (manually-authored issue) — skipping "
            "Convex updates."
        )
        return
    now_ms = int(time.time() * 1000)
    await convex_mutation_safe(
        "pipelineRuns:updateStatus",
        {
            "runId": run_id,
            "status": "complete",
            "completedAt": now_ms,
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
            "timestamp": now_ms,
        },
    )

    # Phase 26 D-03 / REG-01: upsert the featured charity into the Convex
    # registry so timesFeatured increments and lastFeaturedAt is set.
    #
    # This is the SINGLE correct call site: BOTH the manual publish endpoint
    # (api/review.py) AND the scheduled-publish tick (api/control.py) flow
    # through _flip_sanity_published → webhook → _run_publisher, so the upsert
    # fires exactly once per publish regardless of trigger path.
    #
    # run_id=None branch (manually-authored issues) returns above — the upsert
    # is intentionally skipped for those (no pipeline run / no registry charity).
    #
    # Uses convex_mutation_safe: a registry write failure never un-finalizes the
    # run (CLAUDE.md "Convex mutation fails → log and continue").
    charity_name = issue.get("charityName")
    if charity_name:
        await convex_mutation_safe(
            "charities:upsertFeatured",
            {
                "workspace_id": "eisenbalm",
                "name": charity_name,
                "website": issue.get("charityWebsite"),
                "sanityCharityId": (
                    issue.get("charitySlug")
                    or f"charity-{slugify(charity_name)}"
                ),
            },
        )
        log.info(
            "Publisher: charities:upsertFeatured fired for charity=%r "
            "(timesFeatured++, lastFeaturedAt set — D-03/REG-01).",
            charity_name,
        )

    log.info(
        "Publisher: Convex writes complete (status=complete, "
        "publisher-deploy emitted)."
    )
