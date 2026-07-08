"""Convex HTTP API client (Phase 4 is the first real caller).

Endpoint: POST {NEXT_PUBLIC_CONVEX_URL}/api/mutation (or /api/query)
Auth: ``Authorization: Convex {CONVEX_DEPLOY_KEY}`` — NOT Bearer.
Error envelope: HTTP 200 with ``{"status": "error", "errorMessage": ...}``.
Must branch on body ``status`` field, NOT response.status_code (Pitfall 7).

Source: docs/API_CONTRACTS.md §3 + 04-RESEARCH.md §6.

Phase 29 — D-1: ``convex_mutation`` centrally injects a shared
``pipelineSecret`` into every outgoing mutation whose Convex function
actually declares that arg (read from ``PIPELINE_CONVEX_SECRET``).
Convex-side guards (``convex/lib/auth.ts::requirePipelineSecret`` /
``requireOperatorOrPipeline``) validate this against the Convex deployment's
own ``PIPELINE_CONVEX_SECRET`` env var with a constant-time compare. This is
a SINGLE injection point — the ~25 D-1-guarded call sites across
agents/*.py, api/*.py, and lib/*.py need NO edits. ``convex_query`` is NOT
touched (queries are unguarded — read-only, no auth lockdown in this phase).

IMPORTANT: injection is scoped to ``_PIPELINE_SECRET_GUARDED_PATHS`` (below),
NOT unconditional for every path. Convex's args validators reject any
UNDECLARED field with a hard "Unexpected field" error (verified empirically
against convex-test) — unconditionally merging `pipelineSecret` into every
mutation call would break the handful of pre-existing internalMutation calls
this phase does not touch (e.g. `agentRuns:*`, called via the same admin
deploy-key path but out of D-1's enumerated scope) and any FUTURE mutation
added without a `pipelineSecret` arg. Keep this set in sync with
`convex/*.ts` whenever a new pipeline-facing mutation is guarded.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

from httpx import AsyncClient

log = logging.getLogger(__name__)

# Phase 29 — D-1: exact set of Convex mutation paths that ENFORCE the pipeline
# secret (their handler calls requirePipelineSecret / requireOperatorOrPipeline).
# Mirrors convex/*.ts. These are the only paths that get `pipelineSecret`
# injected below.
#
# Deliberately EXCLUDED (do NOT add):
#   - qaCorrections:insert — declares an OPTIONAL `pipelineSecret` arg only so
#     the field is accepted, but IGNORES it in the handler (GAM-05 public
#     exception — also called anonymously from apps/web). Injecting a secret
#     there would be meaningless; since the arg is optional, omitting it is
#     valid and keeps this set semantically "paths that enforce the secret".
#   - agentRuns:* and every other untouched mutation — their validators do NOT
#     declare `pipelineSecret`, and Convex rejects any undeclared arg with a
#     hard "Unexpected field" error, so they must be sent unchanged.
_PIPELINE_SECRET_GUARDED_PATHS = frozenset(
    {
        "pipelineRuns:create",
        "pipelineRuns:updateStatus",
        "runs:create",
        "runs:updateStatus",
        "runs:requestCancel",
        "runs:setConfigSnapshot",
        "runs:setScheduledPublish",
        "deliberationEvents:insert",
        "agentVotes:insert",
        "pitchLog:insert",
        "pitchLog:markSelected",
        "claimChecks:insertBatch",
        # Phase 33 (§33.1): pipeline-lane resolution flip for the findings
        # accept/dismiss/reopen endpoints — handler calls requirePipelineSecret.
        "qaCorrections:setResolution",
        "reviewActions:record",
        "auditLog:record",
        "charities:upsertFeatured",
        "charities:seedFromPublished",
        "charities:upsertCandidate",
        "pipelineConfig:upsert",
    }
)

# Module-level shared client. Constructed in FastAPI lifespan (CONTEXT D-33)
# and registered via set_client().
_CLIENT: Optional[AsyncClient] = None


def set_client(client: AsyncClient) -> None:
    """Register the shared AsyncClient (FastAPI lifespan calls this)."""
    global _CLIENT
    _CLIENT = client


def get_client() -> AsyncClient:
    """Return the registered shared client; raise if unset."""
    if _CLIENT is None:
        raise RuntimeError(
            "Convex client not registered. "
            "FastAPI lifespan must call set_client(http) at startup."
        )
    return _CLIENT


async def convex_mutation(http: AsyncClient, path: str, args: dict) -> Any:
    """Call a Convex mutation. Raises on HTTP error OR Convex validator error.

    Args:
        http: AsyncClient with base_url set to NEXT_PUBLIC_CONVEX_URL.
        path: e.g. ``'pipelineRuns:create'``.
        args: validator-shaped args dict.

    Returns:
        The ``value`` field from a successful Convex response.

    Raises:
        httpx.HTTPStatusError: on non-2xx HTTP response.
        RuntimeError: on HTTP 200 with body ``status='error'`` (Pitfall 7).

    Phase 29 — D-1: injects ``pipelineSecret`` into args here (the single
    central point — do NOT add per-call-site secret handling) for every path
    in ``_PIPELINE_SECRET_GUARDED_PATHS``; all other paths (e.g. `agentRuns:*`,
    untouched dashboard-only mutations) are sent unchanged, since Convex
    rejects any argument the target function's validator doesn't declare.
    ``os.environ.get(..., "")`` (not ``[...]``) so a missing env var fails
    closed on the CONVEX side (Unauthorized) rather than raising a KeyError
    here.
    """
    if path in _PIPELINE_SECRET_GUARDED_PATHS:
        merged_args = {**args, "pipelineSecret": os.environ.get("PIPELINE_CONVEX_SECRET", "")}
    else:
        merged_args = args
    r = await http.post(
        "/api/mutation",
        json={"path": path, "args": merged_args, "format": "json"},
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Convex {os.environ['CONVEX_DEPLOY_KEY']}",
        },
    )
    r.raise_for_status()
    body = r.json()
    if body.get("status") != "success":
        raise RuntimeError(
            f"Convex mutation failed: path={path} args={args} "
            f"err={body.get('errorMessage')}"
        )
    return body.get("value")


async def convex_mutation_safe(path: str, args: dict) -> None:
    """Fire-and-forget variant per CONTEXT D-20.

    Convex failures log + continue. Uses module-level shared client.
    """
    client = _CLIENT
    if client is None:
        log.warning(
            "convex_mutation_safe called before set_client(); dropping: %s",
            path,
        )
        return
    try:
        await convex_mutation(client, path, args)
    except Exception as e:
        log.warning("convex_mutation_safe failed: %s %s — %r", path, args, e)


async def convex_query(http: AsyncClient, path: str, args: dict) -> Any:
    """Call a Convex query. Used by GET /run/{runId}/status and tests."""
    r = await http.post(
        "/api/query",
        json={"path": path, "args": args, "format": "json"},
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Convex {os.environ['CONVEX_DEPLOY_KEY']}",
        },
    )
    r.raise_for_status()
    body = r.json()
    if body.get("status") != "success":
        raise RuntimeError(
            f"Convex query failed: path={path} → {body.get('errorMessage')}"
        )
    return body.get("value")


def charities_list_for_dedup(workspace_id: str) -> list[dict]:
    """Synchronous shim used by charity_registry.load_dedup_keys.

    In production this calls the Convex ``charities:listForDedup`` query
    synchronously via a blocking asyncio.run_coroutine_threadsafe approach —
    but since the pipeline is already async, callers should prefer
    ``convex_query_safe("charities:listForDedup", {"workspace_id": workspace_id})``
    and await it.

    This stub exists as a monkeypatching seam for test_scout_registry.py.
    The real implementation is the async ``convex_query_safe`` path inside
    ``charity_registry.load_dedup_keys``.

    DO NOT call this function directly in production code.
    """
    raise NotImplementedError(
        "charities_list_for_dedup is a test seam only. "
        "Use await convex_query_safe('charities:listForDedup', ...) in production."
    )


async def convex_query_safe(path: str, args: dict) -> Any:
    """Fire-safe query variant (RUN-04 cancel-flag poll).

    Uses the module-level shared client. Returns None on any error — a missed
    poll just delays cancel by one node (fail-OPEN is intentional; a Convex
    blip must never crash a node).

    NOTE: agent_wrapper.py imports this as a module attribute
    (``import eisenbalm_pipeline.lib.convex_client as _cc``, then
    ``_cc.convex_query_safe``) so that monkeypatch.setattr(_cc, ...) reaches
    this call site in tests. The internal call goes through ``convex_query``
    which is ALSO patchable at the module level.
    """
    client = _CLIENT
    if client is None:
        log.warning(
            "convex_query_safe called before set_client(); returning None: %s",
            path,
        )
        return None
    try:
        return await convex_query(client, path, args)
    except Exception as e:
        log.warning("convex_query_safe failed: %s %s — %r", path, args, e)
        return None
