"""Agent failure path (OPS-01).

Plan 10 will fill in:

- POST /run/weekly {forceFailAgent: 'researcher'}
- Poll status until 'failed'
- Assert pipelineRuns.errorMessage starts with 'researcher:'
- Assert pipelineRuns.completedAt populated

Source: 04-CONTEXT.md D-37 + D-27.
"""
from __future__ import annotations

import pytest


@pytest.mark.skip(reason="Pending Plan 04-10: failure path test body")
async def test_forced_agent_failure_marks_run_failed(client, convex_query_fn):
    """OPS-01: An agent that raises ends the run as 'failed' with agentId + error."""
    pass
