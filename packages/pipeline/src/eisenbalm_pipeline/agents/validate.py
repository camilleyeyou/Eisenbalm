"""validate_sections — join node after the 7 parallel writers (CONTEXT D-14).

NOT decorated with @agent_node (research §4) because:
  1. Doesn't emit a deliberation event (no agentId in the brief's 14-agent list).
  2. Writes pipelineRuns.status='failed' directly with a special errorMessage
     prefix 'partial-failure: ...' (CONTEXT D-26 keeps the status enum locked
     — see convex/schema.ts lines 9-14: 'running' | 'awaiting-review' |
     'complete' | 'failed').
  3. Wrapping it would double-write the failed status.

Source: 04-RESEARCH.md §4 + PITFALLS.md §1.3 + CONTEXT D-14/D-26.
"""
from __future__ import annotations

import os
import time

from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe

# MED-02: must match graph.builder._SUPPRESSED exactly (lockstep — see Pitfall 2).
_SUPPRESSED = os.environ.get("DESIGNAGENT_SUPPRESSED", "").lower() in ("1", "true", "yes")

# The 7 DispatchState fields produced by the parallel writers (CONTEXT D-18).
# Note: Design writes `theme`, not `design`. When DESIGNAGENT_SUPPRESSED=true,
# the design node is dropped from the graph and `theme` is never populated —
# so we must also drop "theme" from REQUIRED_FIELDS in lockstep.
REQUIRED_FIELDS: tuple[str, ...] = (
    "origin_story",
    "problem_statement",
    "founder_bio",
    "case_study",
    "game",
    "bonus",
    *(() if _SUPPRESSED else ("theme",)),
)


async def validate_sections(state: DispatchState) -> DispatchState:
    """Assert every required section field is populated; halt with a
    descriptive errorMessage if anything is missing.

    Pass-through on success — the merged state from the 7 parallel writers
    flows downstream to QA unchanged.
    """
    missing = [f for f in REQUIRED_FIELDS if not state.get(f)]
    if missing:
        await convex_mutation_safe(
            "pipelineRuns:updateStatus",
            {
                "runId": state["run_id"],
                "status": "failed",
                "completedAt": int(time.time() * 1000),
                # CONTEXT D-26 routing: prefix `partial-failure:` to keep the
                # status enum locked while still signaling the failure mode.
                "errorMessage": f"partial-failure: missing sections {missing}",
            },
        )
        # Raising halts the graph; the checkpoint records the partial state.
        raise RuntimeError(f"partial-failure: missing sections {missing}")
    return state
