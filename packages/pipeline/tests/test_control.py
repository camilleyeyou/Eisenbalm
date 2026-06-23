"""Phase 25 Wave 0 — RED tests for run-control trigger endpoints (RUN-01, RUN-02).

RED state: ``eisenbalm_pipeline.api.control`` does not exist yet. The top-level
import ensures collection FAILS RED until Plan 02 lands the control router. Once
Plan 02 ships, both tests run against a bare FastAPI app mounting the control
router in stub mode (no real Convex / DB).

  test_manual_trigger_records_operator (RUN-01)
    POST /pipeline/run with a Clerk JWT → runs row has triggerSource="manual"
    and triggeredBy set to the JWT sub claim.

  test_tick_kill_switch_noop (RUN-02)
    POST /pipeline/tick when schedule_enabled=false → zero runs:create calls,
    response has status="skipped" and reason="schedule_disabled".
"""
from __future__ import annotations

from eisenbalm_pipeline.api.control import router as control_router  # RED until Plan 02

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient


pytestmark = pytest.mark.anyio


def _build_app() -> FastAPI:
    """Mount only the control router on a bare lifespan-free app."""
    app = FastAPI()
    app.include_router(control_router)
    return app


async def test_manual_trigger_records_operator(
    convex_runs_store,
    convex_config_store,
    monkeypatch,
) -> None:
    """RUN-01: a manual run triggered via POST /pipeline/run records
    triggerSource='manual' and triggeredBy from the Clerk JWT sub claim."""
    # Seed config: no active run, valid caps
    convex_config_store.seed("schedule_enabled", False)
    convex_config_store.seed("per_run_cap_usd", 10.0)
    convex_config_store.seed("monthly_cap_usd", 200.0)

    # In dev mode require_clerk_jwt returns a sentinel subject
    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)

    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/pipeline/run", json={})

    assert response.status_code == 200, response.text
    body = response.json()
    assert "runId" in body

    # Verify the runs:create mutation was called with correct trigger fields
    create_calls = [
        args
        for path, args in convex_runs_store.all_calls()
        if path == "runs:create"
    ]
    assert len(create_calls) >= 1, "Expected at least one runs:create call"
    row = create_calls[0]
    assert row.get("triggerSource") == "manual", (
        f"Expected triggerSource='manual', got {row.get('triggerSource')!r}"
    )
    assert row.get("triggeredBy") is not None, (
        "Expected triggeredBy to be set from Clerk JWT sub claim"
    )


async def test_tick_kill_switch_noop(
    convex_runs_store,
    convex_config_store,
    monkeypatch,
) -> None:
    """RUN-02: POST /pipeline/tick with schedule_enabled=false returns
    status='skipped' with reason='schedule_disabled' and makes zero
    runs:create calls (kill switch is the FIRST check — Pitfall 4.2)."""
    import os
    trigger_secret = "test-trigger-secret-01"
    monkeypatch.setenv("PIPELINE_TRIGGER_SECRET", trigger_secret)

    # Kill switch OFF
    convex_config_store.seed("schedule_enabled", False)

    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/pipeline/tick",
            headers={"X-Pipeline-Trigger-Secret": trigger_secret},
        )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body.get("status") == "skipped", (
        f"Expected status='skipped', got {body.get('status')!r}"
    )
    assert body.get("reason") == "schedule_disabled", (
        f"Expected reason='schedule_disabled', got {body.get('reason')!r}"
    )

    # No runs should have been created
    assert convex_runs_store.mutation_calls("runs:create") == 0, (
        "Kill switch should prevent any runs:create call"
    )
