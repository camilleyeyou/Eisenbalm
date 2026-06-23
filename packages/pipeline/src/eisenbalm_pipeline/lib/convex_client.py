"""Convex HTTP API client (Phase 4 is the first real caller).

Endpoint: POST {NEXT_PUBLIC_CONVEX_URL}/api/mutation (or /api/query)
Auth: ``Authorization: Convex {CONVEX_DEPLOY_KEY}`` — NOT Bearer.
Error envelope: HTTP 200 with ``{"status": "error", "errorMessage": ...}``.
Must branch on body ``status`` field, NOT response.status_code (Pitfall 7).

Source: docs/API_CONTRACTS.md §3 + 04-RESEARCH.md §6.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

from httpx import AsyncClient

log = logging.getLogger(__name__)

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
    """
    r = await http.post(
        "/api/mutation",
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
