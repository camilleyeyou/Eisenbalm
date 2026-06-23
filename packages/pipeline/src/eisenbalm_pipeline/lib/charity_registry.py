"""Charity registry helpers for Phase 26 REG-01/REG-02.

Provides the dedup key construction and registry loading functions the Scout
uses to skip already-featured or blocklisted charities.

The single authoritative dedup source is the Convex ``charities`` table
(D-03). The Scout no longer consults Sanity GROQ for dedup.

Source: docs/API_CONTRACTS.md §26.1/§26.6 + 26-RESEARCH.md Pattern 5.
"""
from __future__ import annotations

import logging

import eisenbalm_pipeline.lib.convex_client as _cc

log = logging.getLogger(__name__)


# ── Dedup key helpers ─────────────────────────────────────────────────────────


def _domain_of(url: str | None) -> str:
    """Extract bare domain (no scheme, no path, no www.) from a URL.

    Mirrors ``scout.py:_domain_of()`` exactly so dedup keys are consistent
    between Scout candidate construction and registry storage.
    """
    if not url:
        return ""
    no_scheme = url.split("://", 1)[-1]
    domain = no_scheme.split("/", 1)[0].lower().strip()
    return domain[4:] if domain.startswith("www.") else domain


def make_dedup_key(name: str, website: str | None) -> str:
    """Construct a dedup key from charity name and website.

    Format: ``name.strip().lower() + "|" + bareDomain(website)``

    The pipe separator makes the two components clearly distinct and matches
    the Convex ``charities.dedupKey`` computation in API_CONTRACTS §26.1.

    Args:
        name: Charity name (may contain mixed case / leading-trailing whitespace).
        website: Raw website URL (may be None or empty).

    Returns:
        ``"name_lower|domain"`` — e.g. ``"puppies behind bars|puppiesbehindbarsinc.org"``
        If ``website`` is None/empty, the domain part is empty:
        ``"mystery charity|"``
    """
    name_part = name.strip().lower()
    domain_part = _domain_of(website)
    return f"{name_part}|{domain_part}"


# ── Registry loading ──────────────────────────────────────────────────────────


def load_dedup_keys(workspace_id: str) -> set[str]:
    """Load the featured + blocklisted dedup keys from the Convex registry.

    Returns a set of ``dedupKey`` strings for every featured or blocklisted
    charity in the workspace. Candidate-status rows are intentionally excluded —
    a charity that was only ever a candidate can be re-pitched.

    On any error (Convex unreachable, cold environment, missing token) this
    function logs a warning and returns an empty set so the Scout can still
    run (first-run safety). Duplicates are better than pipeline crashes.

    Args:
        workspace_id: Convex workspace slug (e.g. ``"eisenbalm"``).

    Returns:
        ``set[str]`` of dedupKey strings for featured/blocklisted rows.
        Empty set on error (NOT None — always returns a set).

    Note:
        This function calls ``_cc.charities_list_for_dedup`` which is a
        monkeypatching seam for tests (see convex_client.py). In tests,
        monkeypatch sets ``_cc.charities_list_for_dedup`` to a function that
        returns the desired rows. In production the actual async Convex query
        is driven via the async ``_load_registry_keys`` function in ``scout.py``.
    """
    try:
        rows = _cc.charities_list_for_dedup(workspace_id)
        dedup_keys: set[str] = set()
        for row in rows:
            # Only featured and blocklisted rows belong in the dedup set.
            # Candidate rows are intentionally omitted (REG-02: only skip if
            # already featured or permanently blocklisted).
            status = row.get("status", "")
            if status not in ("featured", "blocklisted"):
                continue
            key = row.get("dedupKey")
            if key:
                dedup_keys.add(key)
        return dedup_keys
    except Exception as exc:  # noqa: BLE001
        log.warning(
            "charity_registry: load_dedup_keys failed (%r) — empty fallback",
            exc,
        )
        return set()
