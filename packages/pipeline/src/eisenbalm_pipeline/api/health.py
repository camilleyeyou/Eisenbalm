"""GET /healthz — Railway healthcheck (CONTEXT D-34).

Railway expects a 200 within 60s of boot; a failing healthcheck triggers a
restart loop (research §9). /healthz therefore returns 200 ALWAYS — the
`ok` field reflects whether the lifespan composed the checkpointer cleanly.
"""
from __future__ import annotations

from fastapi import APIRouter, Request

from eisenbalm_pipeline.stubs.fake_openrouter import is_stub_mode

router = APIRouter()


@router.get("/healthz")
async def healthz(request: Request) -> dict:
    """Return 200 with lifespan health summary.

    CONTEXT D-34: {ok, checkpointer, stubMode}.
    """
    # Lifespan registers app.state.checkpointer — if it's None, the lifespan
    # ran in degraded mode (env vars missing or Supabase unreachable).
    checkpointer_state = (
        "connected"
        if getattr(request.app.state, "checkpointer", None) is not None
        else "missing"
    )
    return {
        "ok": checkpointer_state == "connected",
        "checkpointer": checkpointer_state,
        "stubMode": is_stub_mode(),
    }
