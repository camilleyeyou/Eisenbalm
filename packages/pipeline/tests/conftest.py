"""Shared pytest fixtures for the Eisenbalm pipeline test suite.

Source: 04-RESEARCH.md §10 + 04-VALIDATION.md §Wave 0 Requirements.

Every fixture is defensively guarded so `uv run pytest -v` exits 0 even when:
- Required env vars (Supabase / Convex / Sanity) are not set
- The FastAPI app module (`eisenbalm_pipeline.api.main`) has not yet been wired
  (Plans 06-09 land that surface)

Plan 10 replaces the test bodies that consume these fixtures; the fixture
shapes here are the contract Plan 10 will rely on.
"""
from __future__ import annotations

import os
from typing import Any, Awaitable, Callable, Optional

import pytest
from httpx import ASGITransport, AsyncClient


# ── Env helpers ───────────────────────────────────────────────────────────

REQUIRED_ENV_VARS = (
    "SUPABASE_POSTGRES_URL",
    "NEXT_PUBLIC_CONVEX_URL",
    "CONVEX_DEPLOY_KEY",
    "NEXT_PUBLIC_SANITY_PROJECT_ID",
    "SANITY_API_TOKEN",
    "PIPELINE_TRIGGER_SECRET",
)


def _missing_env() -> Optional[str]:
    """Return the first missing required env var, or None if all set."""
    for name in REQUIRED_ENV_VARS:
        if not os.getenv(name):
            return name
    return None


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


# ── HTTP client fixtures ──────────────────────────────────────────────────


@pytest.fixture
async def client():
    """In-process FastAPI test client. Skips if any required env var is unset
    or if `eisenbalm_pipeline.api.main` is not yet importable (pre-Plan 09).

    Once Plan 09 lands FastAPI, this fixture activates and runs the real app
    in-process via ASGITransport (research §10 — fast, no Railway round-trip).
    """
    missing = _missing_env()
    if missing:
        pytest.skip(f"Required env var not set: {missing}")
    try:
        from eisenbalm_pipeline.api.main import app  # noqa: WPS433
    except ImportError as e:
        pytest.skip(f"FastAPI app not yet wired (Plan 09 pending): {e}")

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={
            "X-Pipeline-Trigger-Secret": os.environ["PIPELINE_TRIGGER_SECRET"],
        },
    ) as c:
        yield c


@pytest.fixture
async def convex_query_fn():
    """Async helper for direct Convex query assertions.

    Usage:
        rows = await convex_query_fn('pipelineRuns:byRunId', {'runId': '...'})

    Skips if any required env var is unset.
    """
    missing = _missing_env()
    if missing:
        pytest.skip(f"Required env var not set: {missing}")

    async with AsyncClient(
        base_url=os.environ["NEXT_PUBLIC_CONVEX_URL"].rstrip("/"),
        timeout=15.0,
    ) as http:

        async def _q(path: str, args: dict) -> Any:
            r = await http.post(
                "/api/query",
                json={"path": path, "args": args, "format": "json"},
                headers={
                    "Authorization": f"Convex {os.environ['CONVEX_DEPLOY_KEY']}",
                },
            )
            r.raise_for_status()
            body = r.json()
            if body.get("status") != "success":
                raise RuntimeError(
                    f"Convex query failed: {path} → {body.get('errorMessage')}"
                )
            return body.get("value")

        yield _q


# ── Cleanup helpers ───────────────────────────────────────────────────────


@pytest.fixture
async def sanity_cleanup() -> Callable[[int], Awaitable[None]]:
    """Returns an async function `await sanity_cleanup(issue_number)` that
    deletes the Sanity draft for `issue-{issue_number}`.

    Used by integration tests for teardown. Tolerant of "not found" responses
    (Sanity mutation returns 200 with no error for missing docs).
    """
    missing = _missing_env()
    if missing:
        pytest.skip(f"Required env var not set: {missing}")

    project = os.environ["NEXT_PUBLIC_SANITY_PROJECT_ID"]
    dataset = os.environ.get("NEXT_PUBLIC_SANITY_DATASET", "production")
    token = os.environ["SANITY_API_TOKEN"]
    api_version = "v2024-01-01"

    async with AsyncClient(
        base_url=f"https://{project}.api.sanity.io",
        timeout=15.0,
    ) as http:

        async def _delete(issue_number: int) -> None:
            issue_id = f"issue-{issue_number}"
            await http.post(
                f"/{api_version}/data/mutate/{dataset}",
                json={"mutations": [{"delete": {"id": issue_id}}]},
                headers={"Authorization": f"Bearer {token}"},
            )

        yield _delete


# ── Sanity GET helper (for asserting pipelineMetadata.runId) ──────────────


@pytest.fixture
async def sanity_get_issue() -> Callable[[int], Awaitable[Optional[dict]]]:
    """Returns `await sanity_get_issue(issue_number)` -> draft doc dict (or None).

    Uses the Sanity `doc/{dataset}/{id}` endpoint (read-only).
    """
    missing = _missing_env()
    if missing:
        pytest.skip(f"Required env var not set: {missing}")

    project = os.environ["NEXT_PUBLIC_SANITY_PROJECT_ID"]
    dataset = os.environ.get("NEXT_PUBLIC_SANITY_DATASET", "production")
    token = os.environ["SANITY_API_TOKEN"]
    api_version = "v2024-01-01"

    async with AsyncClient(
        base_url=f"https://{project}.api.sanity.io",
        timeout=15.0,
    ) as http:

        async def _get(issue_number: int) -> Optional[dict]:
            issue_id = f"issue-{issue_number}"
            r = await http.get(
                f"/{api_version}/data/doc/{dataset}/{issue_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            r.raise_for_status()
            body = r.json()
            docs = body.get("documents") or []
            return docs[0] if docs else None

        yield _get
