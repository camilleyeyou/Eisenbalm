"""Phase 47 (Plan 47-01) — guarded-path registration regression test.

docs/API_CONTRACTS.md §47.6: `briefs:insert`, `briefs:patch`, and
`storyLeads:setStatus` MUST be members of `_PIPELINE_SECRET_GUARDED_PATHS` —
without registration, every real call 500s Unauthorized against a live Convex
deployment despite mocked unit tests passing (the 42-03 lesson, also asserted
for the Phase 42/46 paths in test_factcheck_endpoints.py /
test_verify_candidates.py's own call-site assertions).
"""
from __future__ import annotations


def test_brief_mutations_are_secret_guarded():
    from eisenbalm_pipeline.lib.convex_client import _PIPELINE_SECRET_GUARDED_PATHS

    assert "briefs:insert" in _PIPELINE_SECRET_GUARDED_PATHS
    assert "briefs:patch" in _PIPELINE_SECRET_GUARDED_PATHS
    assert "storyLeads:setStatus" in _PIPELINE_SECRET_GUARDED_PATHS


def test_brief_guarded_paths_do_not_disturb_existing_registrations():
    """Sanity check: adding the three Phase 47 paths must not have dropped
    any pre-existing Phase 42/46 registration this test suite depends on."""
    from eisenbalm_pipeline.lib.convex_client import _PIPELINE_SECRET_GUARDED_PATHS

    assert "storyLeads:insert" in _PIPELINE_SECRET_GUARDED_PATHS
    assert "verificationRecords:insert" in _PIPELINE_SECRET_GUARDED_PATHS
    assert "claimChecks:keepAsWritten" in _PIPELINE_SECRET_GUARDED_PATHS
    assert "claimChecks:remove" in _PIPELINE_SECRET_GUARDED_PATHS
