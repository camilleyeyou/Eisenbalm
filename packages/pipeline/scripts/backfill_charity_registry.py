#!/usr/bin/env python
"""Phase 26 (REG-01) — one-shot backfill of the Convex charity registry.

Reads every published weekly issue from Sanity (GROQ), then upserts each
linked charity into the Convex ``charities`` table with status='featured'.

The ``charities:seedFromPublished`` mutation is idempotent — running this script
multiple times is safe and leaves no duplicate rows. As of Quick 260717-41s,
``timesFeatured`` is DERIVED from row multiplicity: the mutation tallies how
many rows carry each charity's dedupKey (name.lower()|domain) and SETs
``timesFeatured`` to that count, so this script sends ONE row per published
issue (not deduped by name) — the row multiplicity IS the signal.

Run AFTER the Convex functions from Phase 26 are deployed and the Sanity token
is available:

    cd packages/pipeline && uv run python scripts/backfill_charity_registry.py

Requires:
    - NEXT_PUBLIC_CONVEX_URL — Convex HTTP API base URL
    - CONVEX_DEPLOY_KEY      — Convex deploy key (read-write)
    - SANITY_API_TOKEN       — Sanity read token (read-only is sufficient)

Optional:
    - SANITY_PROJECT_ID      — defaults to env var or config (from sanity_client.py)
    - SANITY_DATASET         — defaults to "production"

Source: 26-RESEARCH.md Pattern 10; docs/API_CONTRACTS.md §26.1 + §26.6.
"""
from __future__ import annotations

import asyncio
import os
import sys

from httpx import AsyncClient

from eisenbalm_pipeline.lib.convex_client import convex_mutation
from eisenbalm_pipeline.lib.sanity_client import API_VERSION, _dataset

# Workspace slug — must match WORKSPACE_ID everywhere in the pipeline.
WORKSPACE_ID = "eisenbalm"

# Sanity GROQ: all charities linked to published weekly issues.
# Follows the charity reference (``charity->``) to get name, slug, website.
# Excludes drafts (``!(_id in path("drafts.**"))``): the script authenticates
# with SANITY_API_TOKEN, so drafts ARE visible, and a `drafts.*` copy of a
# published issue also carries status=="published" — without this exclusion
# it would be counted a second time now that Change 1 below removed the
# caller-side name-dedup that used to mask this.
_GROQ_FEATURED = (
    '*[_type == "weeklyIssue" && status == "published" && defined(charity) '
    '&& !(_id in path("drafts.**"))]'
    '.charity->{ name, "slug": slug.current, website }'
)


def _build_convex_client() -> AsyncClient:
    """Construct standalone Convex AsyncClient (mirrors the FastAPI lifespan)."""
    url = os.environ.get("NEXT_PUBLIC_CONVEX_URL", "").rstrip("/")
    if not url:
        raise RuntimeError("NEXT_PUBLIC_CONVEX_URL is not set")
    return AsyncClient(base_url=url, timeout=30.0)


def _build_sanity_client() -> AsyncClient:
    """Construct a standalone Sanity HTTP client."""
    project_id = os.environ.get("SANITY_PROJECT_ID") or _sanity_project_id()
    dataset = _dataset()
    base_url = f"https://{project_id}.api.sanity.io"
    return AsyncClient(base_url=base_url, timeout=30.0)


def _sanity_project_id() -> str:
    """Retrieve project ID from environment (SANITY_PROJECT_ID)."""
    pid = os.environ.get("SANITY_PROJECT_ID", "")
    if not pid:
        raise RuntimeError("SANITY_PROJECT_ID is not set")
    return pid


async def _fetch_published_charities(sanity_http: AsyncClient) -> list[dict]:
    """Run GROQ against Sanity and return a list of {name, slug, website} rows.

    On error (missing token, Sanity unreachable): prints a warning and returns [].
    """
    token = os.environ.get("SANITY_API_TOKEN", "")
    if not token:
        print("WARN: SANITY_API_TOKEN unset — skipping Sanity fetch (dry-run mode)")
        return []

    try:
        r = await sanity_http.get(
            f"/{API_VERSION}/data/query/{_dataset()}",
            params={"query": _GROQ_FEATURED},
            headers={"Authorization": f"Bearer {token}"},
        )
        r.raise_for_status()
        body = r.json()
        rows: list[dict] = body.get("result") or []
        return rows
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: Sanity GROQ failed: {exc!r}")
        return []


def _normalise_rows(rows: list[dict]) -> list[dict]:
    """Build seed rows — ONE per published issue, no name-based dedup.

    Convex ``charities:seedFromPublished`` (Quick 260717-41s) now DERIVES
    ``timesFeatured`` from row multiplicity: it tallies how many rows share a
    charity's dedupKey and SETs the counter to that tally. Deduping by name
    here would collapse every charity to a single row, so the mutation would
    always compute a tally of 1 regardless of how many issues actually
    featured it. The GROQ query returns one row per published issue; that
    multiplicity must survive to the mutation for the tally to mean anything.

    Same-name/different-website charities are correctly kept as separate
    charities by the mutation's `name|domain` dedupKey — the old name-only
    dedup here would have silently collapsed them into one row.
    """
    result: list[dict] = []
    for row in rows:
        name = (row.get("name") or "").strip()
        if not name:
            continue
        seed_row: dict = {"name": name}
        website = (row.get("website") or "").strip()
        if website:
            seed_row["website"] = website
        slug = (row.get("slug") or "").strip()
        if slug:
            # Sanity charity document _id uses the slug convention:
            # "charity-{slug}" — as set by write_charity in sanity_client.py.
            seed_row["sanityCharityId"] = f"charity-{slug}"
        result.append(seed_row)
    return result


async def main() -> None:
    """Main backfill entrypoint.

    Workflow:
      1. Fetch published charities from Sanity via GROQ.
      2. Normalise (one row per published issue — no name dedup).
      3. Call charities:seedFromPublished on Convex.
      4. Print a summary.
    """
    print("=" * 60)
    print("Phase 26 — Charity Registry Backfill")
    print(f"Workspace: {WORKSPACE_ID}")
    print("=" * 60)

    # ── Step 1: fetch from Sanity ─────────────────────────────────────────────
    sanity_http = _build_sanity_client()
    try:
        print("\n[1/3] Fetching published charities from Sanity…")
        raw_rows = await _fetch_published_charities(sanity_http)
        print(f"      Found {len(raw_rows)} raw row(s) from GROQ")
    finally:
        await sanity_http.aclose()

    # ── Step 2: normalise ─────────────────────────────────────────────────────
    print("\n[2/3] Normalising rows…")
    seed_rows = _normalise_rows(raw_rows)
    print(f"      {len(seed_rows)} row(s) to seed (one per published issue)")

    if not seed_rows:
        print("\n      Nothing to seed — exiting (idempotent run or empty Sanity).")
        return

    for r in seed_rows:
        print(f"        • {r['name']!r:40s}  website={r.get('website', '(none)')}")

    # ── Step 3: upsert via Convex ─────────────────────────────────────────────
    print("\n[3/3] Calling charities:seedFromPublished on Convex…")
    convex_http = _build_convex_client()
    try:
        result = await convex_mutation(
            convex_http,
            "charities:seedFromPublished",
            {
                "workspace_id": WORKSPACE_ID,
                "rows": seed_rows,
            },
        )
        print(f"      Convex response: {result!r}")
    finally:
        await convex_http.aclose()

    # ── Done ─────────────────────────────────────────────────────────────────
    print("\n[DONE] Backfill complete.")
    print(f"       Sent {len(seed_rows)} row(s) (one per published issue) with status='featured'.")
    print("       Re-run is safe — charities:seedFromPublished is idempotent.")
    print("=" * 60)


if __name__ == "__main__":
    # Exit with a non-zero status code if the backfill fails so CI can detect it.
    try:
        asyncio.run(main())
    except Exception as exc:  # noqa: BLE001
        print(f"\nFATAL: {exc!r}", file=sys.stderr)
        sys.exit(1)
