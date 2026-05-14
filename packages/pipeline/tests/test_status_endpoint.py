"""GET /run/{runId}/status (OPS-02).

Plan 10 will fill in:

- Trigger a run; immediately GET /run/{runId}/status
- Assert response shape: {runId, status, startedAt, completedAt?, durationMs?,
  errorMessage?, agentId?, lastEvent?}
- GET against a nonexistent runId should return a documented response shape
  (404 or null payload — planner decides; matches CONTEXT D-07)

Source: 04-CONTEXT.md D-07 + D-34.
"""
from __future__ import annotations

import pytest


@pytest.mark.skip(reason="Pending Plan 04-10: status endpoint test body")
async def test_status_endpoint_returns_current_state(client, convex_query_fn):
    """OPS-02: GET /run/{runId}/status returns canonical status payload."""
    pass


@pytest.mark.skip(reason="Pending Plan 04-10: status endpoint test body")
async def test_status_endpoint_nonexistent_runid(client):
    """OPS-02: GET /run/{runId}/status with unknown runId returns documented shape."""
    pass
