"""End-to-end pipeline test (PIP-02, PIP-05, PIP-06, PIP-07, PIP-08, PIP-11, PIP-12).

The headline integration test for the phase. Plan 10 will fill in:

- POST /run/weekly with {issueNumber: 999000+random}
- Poll GET /run/{runId}/status until terminal ('awaiting-review' for stub)
- Assert Sanity issue-{n}.pipelineMetadata.runId == runId
- Assert every Convex table row has runId == runId
- Assert pipelineRuns.cost is a valid JSON string with shape {total, agents}
- Assert pipelineRuns.durationMs > 0
- Cleanup the Sanity draft

Source: 04-CONTEXT.md D-35, 04-RESEARCH.md "Example 4", 04-VALIDATION.md.
"""
from __future__ import annotations

import pytest


@pytest.mark.skip(reason="Pending Plan 04-10: integration test bodies")
async def test_returns_runId(client):
    """PIP-02: POST /run/weekly returns 202 with {runId} body."""
    pass


@pytest.mark.skip(reason="Pending Plan 04-10: integration test bodies")
async def test_pipeline_e2e_runId_threaded_to_all_datastores(
    client, convex_query_fn, sanity_get_issue, sanity_cleanup
):
    """PIP-05 + PIP-06 + PIP-07: runId generated once and threaded into
    every Sanity draft + every Convex row for the run.
    """
    pass


@pytest.mark.skip(reason="Pending Plan 04-10: integration test bodies")
async def test_all_event_types_emitted(client, convex_query_fn, sanity_cleanup):
    """PIP-08: Convex writes occur for every event type during a stub run."""
    pass


@pytest.mark.skip(reason="Pending Plan 04-10: integration test bodies")
async def test_cost_shape(client, convex_query_fn, sanity_cleanup):
    """PIP-11: pipelineRuns.cost JSON string has {total, agents} shape."""
    pass


@pytest.mark.skip(reason="Pending Plan 04-10: integration test bodies")
async def test_duration_ms(client, convex_query_fn, sanity_cleanup):
    """PIP-12: pipelineRuns.durationMs populated and > 0 at terminal state."""
    pass
