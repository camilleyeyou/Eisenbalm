#!/usr/bin/env python
"""Phase 40 (D-05) — one-shot backfill of the Convex `issues` table.

Creates one `issues` row per distinct existing `issueNumber` found across
`pipelineRuns` (enumerated via `runs:listForWorkspace` + `pipelineRuns:byRunId`
— there is no dedicated "list all pipelineRuns" query today, so this avoids
adding a new Convex query just for a one-shot script), then marks each issue
`published` whose corresponding Sanity `weeklyIssue` document has
`status == 'published'`.

Both Convex mutations this script calls (`issues:ensureByNumber`,
`issues:markPublished`) are idempotent — re-running this script is always
safe, whether run before or after the Convex functions from Plan 40-02 are
deployed (an undeployed function surfaces as a clear, non-swallowed error
below rather than a silent no-op).

Run AFTER the Convex functions from Plan 40-02 are deployed:

    cd packages/pipeline && uv run python scripts/backfill_issues.py

Requires:
    - NEXT_PUBLIC_CONVEX_URL — Convex HTTP API base URL
    - CONVEX_DEPLOY_KEY      — Convex deploy key (read-write)
    - SANITY_API_TOKEN       — Sanity read token (read-only is sufficient)

Optional:
    - SANITY_PROJECT_ID      — defaults to env var or config (from sanity_client.py)
    - NEXT_PUBLIC_SANITY_DATASET — defaults to "production"

Source: docs/API_CONTRACTS.md §40.2; 40-RESEARCH.md "Backfill script pattern
to replicate for D-05"; scripts/backfill_charity_registry.py (structural
precedent — standalone httpx.AsyncClient, dry-run token fallback, idempotent
mutation loop, asyncio.run(main())).
"""
from __future__ import annotations

import asyncio
import os
import sys

from httpx import AsyncClient

from eisenbalm_pipeline.lib.convex_client import convex_mutation, convex_query
from eisenbalm_pipeline.lib.sanity_client import API_VERSION, _dataset

# Workspace slug — must match WORKSPACE_ID everywhere in the pipeline.
WORKSPACE_ID = "eisenbalm"

# Sanity GROQ: every published weekly issue's issueNumber + Sanity doc id.
_GROQ_PUBLISHED = (
    '*[_type == "weeklyIssue" && status == "published"]'
    '{ issueNumber, "sanityId": _id }'
)


def _build_convex_client() -> AsyncClient:
    """Construct standalone Convex AsyncClient (mirrors the FastAPI lifespan)."""
    url = os.environ.get("NEXT_PUBLIC_CONVEX_URL", "").rstrip("/")
    if not url:
        raise RuntimeError("NEXT_PUBLIC_CONVEX_URL is not set")
    return AsyncClient(base_url=url, timeout=30.0)


def _sanity_project_id() -> str:
    """Retrieve project ID from environment (SANITY_PROJECT_ID)."""
    pid = os.environ.get("SANITY_PROJECT_ID", "")
    if not pid:
        raise RuntimeError("SANITY_PROJECT_ID is not set")
    return pid


def _build_sanity_client() -> AsyncClient:
    """Construct a standalone Sanity HTTP client."""
    project_id = os.environ.get("SANITY_PROJECT_ID") or _sanity_project_id()
    base_url = f"https://{project_id}.api.sanity.io"
    return AsyncClient(base_url=base_url, timeout=30.0)


async def _fetch_distinct_issue_numbers(convex_http: AsyncClient) -> list[int]:
    """Enumerate every distinct issueNumber that has ever had a pipeline run.

    There is no "list all pipelineRuns" query today, so this reads
    runs:listForWorkspace (one row per run, includes runId) then resolves
    each run's issueNumber via pipelineRuns:byRunId — both existing queries,
    no new Convex query added for this one-shot script.
    """
    runs = (
        await convex_query(
            convex_http, "runs:listForWorkspace", {"workspace_id": WORKSPACE_ID}
        )
        or []
    )
    numbers: set[int] = set()
    for run in runs:
        run_id = run.get("runId")
        if not run_id:
            continue
        pr = await convex_query(convex_http, "pipelineRuns:byRunId", {"runId": run_id})
        if pr and isinstance(pr.get("issueNumber"), int):
            numbers.add(pr["issueNumber"])
    return sorted(numbers)


async def _fetch_published_issue_numbers(sanity_http: AsyncClient) -> dict[int, str]:
    """Return {issueNumber: sanityId} for every published weeklyIssue.

    On error (missing token, Sanity unreachable): prints a warning and
    returns {} (dry-run fallback, mirrors backfill_charity_registry.py).
    """
    token = os.environ.get("SANITY_API_TOKEN", "")
    if not token:
        print("WARN: SANITY_API_TOKEN unset — skipping Sanity fetch (dry-run mode)")
        return {}

    try:
        r = await sanity_http.get(
            f"/{API_VERSION}/data/query/{_dataset()}",
            params={"query": _GROQ_PUBLISHED},
            headers={"Authorization": f"Bearer {token}"},
        )
        r.raise_for_status()
        body = r.json()
        rows: list[dict] = body.get("result") or []
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: Sanity GROQ failed: {exc!r}")
        return {}

    result: dict[int, str] = {}
    for row in rows:
        n = row.get("issueNumber")
        sanity_id = row.get("sanityId")
        if isinstance(n, int) and sanity_id:
            result[n] = sanity_id
    return result


async def main() -> None:
    """Main backfill entrypoint.

    Workflow:
      1. Enumerate distinct issueNumbers from pipelineRuns (via Convex).
      2. Call issues:ensureByNumber for each — idempotent insert-if-absent.
      3. Fetch published issueNumbers from Sanity, call issues:markPublished
         for each.

    A mutation failure (e.g. the Convex functions from Plan 40-02 aren't
    deployed yet — a 404-shaped error from convex_mutation) is NOT swallowed:
    it propagates out of main() and the __main__ guard below exits non-zero
    with a clear FATAL message.
    """
    print("=" * 60)
    print("Phase 40 — Issues Table Backfill (D-05)")
    print(f"Workspace: {WORKSPACE_ID}")
    print("=" * 60)

    numbers: list[int] = []
    published: dict[int, str] = {}

    convex_http = _build_convex_client()
    try:
        # ── Step 1: enumerate distinct issueNumbers ─────────────────────────
        print("\n[1/3] Enumerating distinct issueNumbers from pipelineRuns…")
        numbers = await _fetch_distinct_issue_numbers(convex_http)
        print(f"      Found {len(numbers)} distinct issueNumber(s): {numbers}")

        # ── Step 2: ensure an issues row exists for each ────────────────────
        print("\n[2/3] Ensuring an issues row exists for each…")
        for n in numbers:
            result = await convex_mutation(
                convex_http,
                "issues:ensureByNumber",
                {"workspace_id": WORKSPACE_ID, "issueNumber": n},
            )
            print(f"        • issue #{n}: {result!r}")

        # ── Step 3: mark published issues from Sanity ───────────────────────
        print("\n[3/3] Marking published issues from Sanity…")
        sanity_http = _build_sanity_client()
        try:
            published = await _fetch_published_issue_numbers(sanity_http)
        finally:
            await sanity_http.aclose()

        for n, sanity_id in published.items():
            await convex_mutation(
                convex_http,
                "issues:markPublished",
                {
                    "workspace_id": WORKSPACE_ID,
                    "issueNumber": n,
                    "sanityIssueId": sanity_id,
                },
            )
    finally:
        await convex_http.aclose()

    print(
        f"\n[DONE] backfill_issues: ensured {len(numbers)} issues, "
        f"marked {len(published)} published"
    )
    print("       Re-run is safe — both mutations are idempotent.")
    print("=" * 60)


if __name__ == "__main__":
    # Exit with a non-zero status code if the backfill fails so CI can detect it.
    try:
        asyncio.run(main())
    except Exception as exc:  # noqa: BLE001
        print(f"\nFATAL: {exc!r}", file=sys.stderr)
        sys.exit(1)
