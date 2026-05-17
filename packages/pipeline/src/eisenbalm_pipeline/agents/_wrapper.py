"""@agent_node decorator — Phase 4 -> Phase 5 stable contract (CONTEXT D-15).

Phase 5 changes ONLY the agent function bodies. This decorator stays as-is.

Owns:
  - try/except around the agent body (CONTEXT D-15)
  - Convex deliberationEvents:insert on success (when emit_event is set)
  - Cost recording via lib.cost.record_cost (stub mode: 0 tokens, 0 USD)
  - Iteration limit attribute (CONTEXT D-25 — stored on function; enforced in Phase 5)
  - Test toggle _force_fail_agent (CONTEXT D-37)
  - errorMessage format per CONTEXT D-27: f'{agentId}: {ExceptionClass}: {msg}'

Source: 04-RESEARCH.md §"Pattern 5" — copied verbatim with minor formatting.

Re-entry idempotency (RESEARCH §2): the wrapper does NOT emit duplicate
deliberation events when a node runs twice on resume. LangGraph's
``interrupt()`` raises inside the wrapped function, so the success path
(which emits the event) never runs on the pre-interrupt pass. On resume,
the function re-runs from the top; interrupt() returns the resume value;
the function returns; emit fires exactly once.
"""
from __future__ import annotations

import functools
import json
import logging
import time
from typing import Any, Awaitable, Callable, Optional

from langgraph.errors import GraphInterrupt

from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
from eisenbalm_pipeline.lib.cost import record_cost
from eisenbalm_pipeline.lib.errors import AgentToolCallLimitExceeded

log = logging.getLogger(__name__)


def agent_node(
    *,
    name: str,
    emit_event: Optional[str] = None,
    payload_builder: Optional[Callable[[DispatchState], dict]] = None,
    max_tool_calls: Optional[int] = None,
) -> Callable:
    """Wrap an agent body with the standard cross-cutting concerns.

    Args:
        name: agent_id (matches agentProfile.agentId in Sanity — e.g. 'scout').
            Used as agentId in deliberationEvents and as the prefix in
            errorMessage on failure (CONTEXT D-27).
        emit_event: If provided, emit a ``deliberationEvents:insert`` with this
            eventType on successful agent completion. One of:
            'scout-finding' | 'advocate-argument' | 'editor-decision' |
            'section-draft' | 'qa-correction' | 'editor-final' |
            'publisher-deploy'.
        payload_builder: Optional fn that takes the post-run state and returns
            a dict for the deliberationEvents.payload JSON string. Called only
            when emit_event is set.
        max_tool_calls: Stored on the function as ``_max_tool_calls``. Phase 4
            doesn't enforce (stubs don't call tools); Phase 5 reads this
            attribute on entry to enforce AGT-18.

    Phase 4 -> Phase 5 contract: this signature does NOT change.
    """

    def decorator(
        fn: Callable[[DispatchState], Awaitable[DispatchState]],
    ) -> Callable[[DispatchState], Awaitable[DispatchState]]:
        # Stored for Phase 5 iteration-limit enforcement (AGT-18).
        fn._max_tool_calls = max_tool_calls  # type: ignore[attr-defined]

        @functools.wraps(fn)
        async def wrapped(state: DispatchState) -> DispatchState:
            start = time.monotonic()
            run_id = state["run_id"]

            # Test toggle: forced agent failure (CONTEXT D-37 / OPS-01).
            # Raises BEFORE fn(state) runs, mirroring research Pattern 5.
            if state.get("_force_fail_agent") == name:
                err = RuntimeError(
                    f"Forced failure for testing (agent={name})"
                )
                await convex_mutation_safe(
                    "pipelineRuns:updateStatus",
                    {
                        "runId": run_id,
                        "status": "failed",
                        "completedAt": int(time.time() * 1000),
                        # CONTEXT D-27 format: f'{agentId}: {ExceptionClass}: {msg}'
                        "errorMessage": f"{name}: RuntimeError: {err}",
                    },
                )
                raise err

            try:
                new_state = await fn(state)
                duration_ms = int((time.monotonic() - start) * 1000)

                # Emit the deliberation event for live visualization.
                # NOTE: emit happens AFTER fn returns. If fn calls
                # interrupt(), that raises BaseException out of this try
                # block and the emit is skipped. Resume re-runs fn from the
                # top; emit fires exactly once on the successful pass.
                if emit_event:
                    payload = (
                        payload_builder(new_state) if payload_builder else {}
                    )
                    await convex_mutation_safe(
                        "deliberationEvents:insert",
                        {
                            "runId": run_id,
                            "agentId": name,
                            "eventType": emit_event,
                            "payload": json.dumps(payload),
                        },
                    )

                # Record cost (stub mode: 0 tokens, 0 USD; duration is real).
                record_cost(
                    run_id,
                    name,
                    tokens_in=0,
                    tokens_out=0,
                    usd=0.0,
                    duration_ms=duration_ms,
                )
                return new_state

            except GraphInterrupt:
                # NOT a failure — graph is pausing for human-in-the-loop.
                # Editor gate 1 already wrote status='awaiting-review' to
                # Convex BEFORE calling interrupt() (CONTEXT D-13 +
                # research §2 idempotency-before-interrupt). LangGraph
                # checkpoints state via the AsyncPostgresSaver; resume
                # re-runs this node from the top. Do NOT touch Convex.
                raise

            except AgentToolCallLimitExceeded as e:
                # AGT-18 / D-21 (Plan 05-14): emit a dedicated
                # deliberationEvents row with eventType='agent-tool-limit-exceeded'
                # BEFORE falling through to the generic failure write. The
                # event row gives Andrew + the deliberation UI a typed
                # signal that the agent overran its tool budget vs. some
                # other kind of failure. Event emission is best-effort — a
                # transient Convex error here must not mask the underlying
                # RuntimeError on the failure path.
                try:
                    await convex_mutation_safe(
                        "deliberationEvents:insert",
                        {
                            "runId": run_id,
                            "agentId": name,
                            "eventType": "agent-tool-limit-exceeded",
                            "payload": json.dumps({
                                "agentId": getattr(e, "agent_id", name),
                                "attempts": getattr(e, "attempts", None),
                                "limit": getattr(
                                    e, "limit", max_tool_calls,
                                ),
                                "message": str(e),
                            }),
                        },
                    )
                except Exception as emit_exc:  # noqa: BLE001 — best-effort
                    log.warning(
                        "agent-tool-limit-exceeded event emit failed: %r",
                        emit_exc,
                    )
                error_msg = f"{name}: {type(e).__name__}: {e}"
                log.exception("Agent %s raised: %s", name, error_msg)
                await convex_mutation_safe(
                    "pipelineRuns:updateStatus",
                    {
                        "runId": run_id,
                        "status": "failed",
                        "completedAt": int(time.time() * 1000),
                        "errorMessage": error_msg,
                    },
                )
                raise

            except Exception as e:
                # CONTEXT D-27: f'{agentId}: {ExceptionClass}: {msg}'
                error_msg = f"{name}: {type(e).__name__}: {e}"
                log.exception("Agent %s raised: %s", name, error_msg)
                await convex_mutation_safe(
                    "pipelineRuns:updateStatus",
                    {
                        "runId": run_id,
                        "status": "failed",
                        "completedAt": int(time.time() * 1000),
                        "errorMessage": error_msg,
                    },
                )
                raise  # propagate so LangGraph checkpoints the failure

        # Preserve max_tool_calls on the wrapped function for Phase 5
        # introspection through the decorator chain.
        wrapped._max_tool_calls = max_tool_calls  # type: ignore[attr-defined]
        return wrapped

    return decorator
