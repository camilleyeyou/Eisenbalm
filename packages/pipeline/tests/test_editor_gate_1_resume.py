"""Editor gate 1 interrupt/resume cycle (PIP-10).

Plan 10 will fill in:

- POST /run/weekly {issueNumber: 999000+random, forceNoWinner: true}
- Poll status until 'awaiting-review'
- POST /run/{runId}/resume {selection: {charityName: 'The Quiet Foundation'}}
- Poll status until terminal 'awaiting-review' (final, post-Publisher)
- Assert Sanity draft has the resumed charity reference

Source: 04-CONTEXT.md D-36 + D-13 + 04-RESEARCH.md §2 + "Example 1".
"""
from __future__ import annotations

import pytest


@pytest.mark.skip(reason="Pending Plan 04-10: interrupt/resume test body")
async def test_editor_gate_1_interrupt_and_resume(
    client, convex_query_fn, sanity_get_issue, sanity_cleanup
):
    """PIP-10: Editor gate 1 interrupt() pauses run, /resume continues to terminal."""
    pass
