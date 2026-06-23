"""
Wave 0 scaffold — Phase 26 REG-01/REG-02: Scout charity registry dedup tests.

Pre-written stubs for the Scout's registry integration, implemented in Plan 26-02.

Key behaviours being scaffolded:
  1. registry_dedup_skips_featured: Scout must not pitch charities already in
     the registry with status='featured' or 'blocklisted'.
  2. registry_load_empty_fallback: If the Convex registry is unreachable (network
     error, cold environment, etc.), the Scout falls back gracefully to an empty
     dedup set rather than crashing the pipeline.

All tests skip if the Scout module or registry loader is not yet present.

Implementation target (Plan 26-02):
  eisenbalm_pipeline/agents/scout.py — must call charity_registry.load_dedup_keys()
  eisenbalm_pipeline/lib/charity_registry.py — load_dedup_keys(workspace_id) -> set[str]
    Calls convex.query("charities:listForDedup", workspace_id=workspace_id)
    Returns {dedupKey for each row} or set() on error.
"""

import pytest

# ── Import guards ─────────────────────────────────────────────────────────────

try:
    from eisenbalm_pipeline.lib.charity_registry import (  # type: ignore[import]
        load_dedup_keys,
        make_dedup_key,
    )
    _REGISTRY_LIB_AVAILABLE = True
except ImportError:
    _REGISTRY_LIB_AVAILABLE = False
    load_dedup_keys = None
    make_dedup_key = None

skip_if_no_registry = pytest.mark.skipif(
    not _REGISTRY_LIB_AVAILABLE,
    reason="eisenbalm_pipeline.lib.charity_registry not yet implemented (Plan 26-02)",
)


# ── make_dedup_key ────────────────────────────────────────────────────────────


@skip_if_no_registry
def test_make_dedup_key_format():
    """
    Dedup key must match the Convex bareDomain + pipe format:
      `name.strip().lower() + '|' + bareDomain(website)`
    """
    key = make_dedup_key("Riverside Community Trust", "https://www.riversidetrust.org/about")
    assert "|" in key, "Dedup key must contain pipe separator"
    name_part, domain_part = key.split("|", 1)
    assert name_part == "riverside community trust"
    assert domain_part == "riversidetrust.org"


@skip_if_no_registry
def test_make_dedup_key_strips_www():
    """www. prefix is stripped from domain in dedup key."""
    key = make_dedup_key("Elmwood Project", "https://www.elmwoodproject.org")
    _, domain_part = key.split("|", 1)
    assert not domain_part.startswith("www."), "www. must be stripped from domain"


@skip_if_no_registry
def test_make_dedup_key_handles_missing_website():
    """Missing/empty website → empty domain part (no crash)."""
    key = make_dedup_key("Mystery Charity", None)
    assert "|" in key
    _, domain_part = key.split("|", 1)
    assert domain_part == ""


# ── registry_dedup_skips_featured ─────────────────────────────────────────────


@skip_if_no_registry
def test_registry_dedup_skips_featured(monkeypatch):
    """
    The Scout must not pitch charities whose dedupKey appears in the registry
    as featured or blocklisted.

    This test monkeypatches the Convex HTTP call to return a known set of
    featured/blocklisted keys, then verifies that load_dedup_keys returns them.
    The Scout's candidate-filtering code is covered in Plan 26-02 tests.
    """
    featured_rows = [
        {
            "_id": "charity_id_1",
            "name": "Riverside Community Trust",
            "domain": "riversidetrust.org",
            "dedupKey": "riverside community trust|riversidetrust.org",
            "status": "featured",
        },
        {
            "_id": "charity_id_2",
            "name": "Blocked Org",
            "domain": "blockedorg.net",
            "dedupKey": "blocked org|blockedorg.net",
            "status": "blocklisted",
        },
    ]

    # Mock the underlying Convex query; exact module path to be confirmed in Plan 26-02
    try:
        import eisenbalm_pipeline.lib.convex_client as cc  # type: ignore[import]
        monkeypatch.setattr(
            cc, "charities_list_for_dedup",
            lambda workspace_id: featured_rows,
            raising=False,
        )
    except (ImportError, AttributeError):
        pytest.skip("convex_client not yet available — update monkeypatch target in Plan 26-02")

    dedup_keys = load_dedup_keys("eisenbalm")
    assert isinstance(dedup_keys, set)
    assert "riverside community trust|riversidetrust.org" in dedup_keys
    assert "blocked org|blockedorg.net" in dedup_keys


@skip_if_no_registry
def test_registry_skips_candidates_in_dedup(monkeypatch):
    """
    Candidate-status rows are NOT in the dedup set.
    The Scout should only avoid re-pitching featured|blocklisted charities;
    a charity that was previously pitched as a candidate can be re-pitched.
    """
    rows = [
        {
            "_id": "charity_id_3",
            "name": "Candidate Charity",
            "domain": "candidatecharity.org",
            "dedupKey": "candidate charity|candidatecharity.org",
            "status": "candidate",  # NOT featured or blocklisted
        },
    ]

    try:
        import eisenbalm_pipeline.lib.convex_client as cc  # type: ignore[import]
        monkeypatch.setattr(
            cc, "charities_list_for_dedup",
            lambda workspace_id: rows,
            raising=False,
        )
    except (ImportError, AttributeError):
        pytest.skip("convex_client not yet available — update monkeypatch target in Plan 26-02")

    dedup_keys = load_dedup_keys("eisenbalm")
    # Candidate rows should NOT be in the dedup exclusion set
    assert "candidate charity|candidatecharity.org" not in dedup_keys, (
        "Candidate-status charities must NOT be in the dedup exclusion set"
    )


# ── registry_load_empty_fallback ──────────────────────────────────────────────


@skip_if_no_registry
def test_registry_load_empty_fallback(monkeypatch):
    """
    If the Convex registry is unreachable (network error, cold environment),
    load_dedup_keys must return an empty set rather than crashing the pipeline.

    This ensures the Scout can still run (and pitch charities) even when
    the registry is temporarily unavailable — duplicates are better than crashes.
    """
    def mock_convex_error(workspace_id: str):
        raise ConnectionError("Convex is unreachable in CI/cold environment")

    try:
        import eisenbalm_pipeline.lib.convex_client as cc  # type: ignore[import]
        monkeypatch.setattr(
            cc, "charities_list_for_dedup",
            mock_convex_error,
            raising=False,
        )
    except (ImportError, AttributeError):
        pytest.skip("convex_client not yet available — update monkeypatch target in Plan 26-02")

    # Must not raise; must return empty set
    dedup_keys = load_dedup_keys("eisenbalm")
    assert isinstance(dedup_keys, set), "load_dedup_keys must return a set on network error"
    assert len(dedup_keys) == 0, "load_dedup_keys must return empty set on network error"
