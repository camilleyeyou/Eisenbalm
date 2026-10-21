"""GET /healthz — Railway deploy healthcheck (CONTEXT D-34).

Local dev: returns 200 ALWAYS — `ok` reflects whether the lifespan composed
the checkpointer cleanly, so running without provisioning stays usable.

Deployed (RAILWAY_ENVIRONMENT_NAME set): a degraded lifespan (dead DB, bad
config) returns 503 with the same JSON body. The earlier "always 200"
rationale (avoid Railway restart loops) is superseded: failing the deploy
healthcheck keeps the previous healthy deployment live instead of promoting a
dead-DB build. Railway only probes during deploy (railway.toml
healthcheckPath), so this catches a dead DB at boot, not one that dies later.
"""
from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from eisenbalm_pipeline.api.auth import _deployed
from eisenbalm_pipeline.stubs.fake_openrouter import is_stub_mode

router = APIRouter()


@router.get("/healthz", response_model=None)
async def healthz(request: Request) -> dict | JSONResponse:
    """CONTEXT D-34: {ok, checkpointer, stubMode}; 503 when deployed+degraded."""
    # Lifespan registers app.state.checkpointer — if it's None, the lifespan
    # ran in degraded mode (env vars missing or Supabase unreachable).
    checkpointer_state = (
        "connected"
        if getattr(request.app.state, "checkpointer", None) is not None
        else "missing"
    )
    body = {
        "ok": checkpointer_state == "connected",
        "checkpointer": checkpointer_state,
        "stubMode": is_stub_mode(),
    }
    if checkpointer_state == "missing" and _deployed():
        return JSONResponse(status_code=503, content=body)
    return body
