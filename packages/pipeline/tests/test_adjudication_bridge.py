"""Phase 37 Plan 02 — Clerk-guarded adjudication bridge (SIG-03, D-12/D-13).

Task 1 (shared resume extraction, interface-first):
  test_resume_paused_run_raises_409_when_not_paused
    _resume_paused_run(app, run_id, charity_name) 409s when the graph's
    checkpoint state.next is empty (not paused).
  test_resume_paused_run_schedules_resume_and_returns
    On a paused graph, schedules the background Command(resume=...) invoke
    and returns {"runId", "resumed": True} immediately (fire-and-forget).

Task 2 (POST /issues/{run_id}/adjudicate bridge):
  test_adjudicate_audits_before_resume
    Audits the operator's pick + reason via _emit_audit BEFORE the resume is
    scheduled ("nothing silent"), then returns the resume result.
  test_adjudicate_non_paused_no_side_effects
    A non-paused run 409s with ZERO audit or resume side effects (the
    paused-guard runs BEFORE the audit write).
  test_adjudicate_never_uses_trigger_secret
    Source-level guard: the adjudicate handler never references
    _require_trigger_secret — auth is _require_clerk_jwt_control only, so the
    operator never handles the server-to-server trigger secret.

Source: 37-02-adjudication-bridge-PLAN.md Tasks 1-2 + 37-CONTEXT.md D-12/D-13.
"""
from __future__ import annotations

import asyncio
import inspect
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from eisenbalm_pipeline.api import runs
from eisenbalm_pipeline.api.control import router as control_router

pytestmark = pytest.mark.anyio


# ── Shared fakes ────────────────────────────────────────────────────────────

def _fake_graph(*, paused: bool) -> SimpleNamespace:
    next_value = ("editor_gate_1",) if paused else ()
    return SimpleNamespace(
        aget_state=AsyncMock(return_value=SimpleNamespace(next=next_value)),
        ainvoke=AsyncMock(return_value={}),
    )


def _fake_app(*, paused: bool) -> SimpleNamespace:
    """Bare app stand-in carrying app.state.{graph, background_tasks, convex_http}."""
    app_state = SimpleNamespace(
        graph=_fake_graph(paused=paused),
        background_tasks=set(),
        convex_http=MagicMock(),
    )
    return SimpleNamespace(state=app_state)


def _build_control_app() -> FastAPI:
    app = FastAPI()
    app.include_router(control_router)
    return app


# ── Task 1: _resume_paused_run extraction ──────────────────────────────────

async def test_resume_paused_run_raises_409_when_not_paused() -> None:
    """Not-paused graph (state.next empty) -> HTTPException(409)."""
    app = _fake_app(paused=False)

    with pytest.raises(HTTPException) as exc_info:
        await runs._resume_paused_run(app, "run-not-paused-001", "SomeCharity")

    assert exc_info.value.status_code == 409


async def test_resume_paused_run_schedules_resume_and_returns() -> None:
    """Paused graph -> schedules Command(resume=...) and returns immediately."""
    app = _fake_app(paused=True)

    result = await runs._resume_paused_run(app, "run-paused-001", "SomeCharity")

    assert result == {"runId": "run-paused-001", "resumed": True}

    # Fire-and-forget: yield to the event loop so the background task runs.
    await asyncio.sleep(0)

    graph = app.state.graph
    assert graph.ainvoke.await_count == 1
    (command,), kwargs = graph.ainvoke.call_args
    assert command.resume == {"editorSelection": "SomeCharity"}
    assert kwargs["config"] == {"configurable": {"thread_id": "run-paused-001"}}


# ── Task 2: POST /issues/{run_id}/adjudicate ───────────────────────────────

async def test_adjudicate_audits_before_resume(monkeypatch) -> None:
    """Audits pick+reason BEFORE scheduling resume; returns the resume result."""
    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)

    app = _build_control_app()
    app.state.graph = _fake_graph(paused=True)
    app.state.background_tasks = set()
    app.state.convex_http = MagicMock()

    import eisenbalm_pipeline.api.control as control_mod

    call_order: list[tuple] = []

    async def fake_emit_audit(http, **kwargs):  # noqa: ARG001
        call_order.append(("audit", kwargs))

    real_resume = control_mod._resume_paused_run

    async def spy_resume(app_arg, run_id, charity_name):
        call_order.append(("resume", run_id, charity_name))
        return await real_resume(app_arg, run_id, charity_name)

    monkeypatch.setattr(control_mod, "_emit_audit", fake_emit_audit)
    monkeypatch.setattr(control_mod, "_resume_paused_run", spy_resume)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/issues/run-adjudicate-001/adjudicate",
            json={"selection": {"charityName": "X"}, "reason": "clearer hook"},
        )

    assert response.status_code == 200, response.text
    assert response.json() == {"runId": "run-adjudicate-001", "resumed": True}

    kinds = [c[0] for c in call_order]
    assert kinds == ["audit", "resume"], (
        f"Expected audit BEFORE resume ('nothing silent'); observed order: {call_order}"
    )

    audit_kwargs = call_order[0][1]
    assert audit_kwargs["action"] == "gate1.adjudicate"
    assert audit_kwargs["resource_type"] == "run"
    assert audit_kwargs["resource_id"] == "run-adjudicate-001"
    after_payload = json.loads(audit_kwargs["after"])
    assert after_payload == {"charityName": "X", "reason": "clearer hook"}


async def test_adjudicate_non_paused_no_side_effects(monkeypatch) -> None:
    """Non-paused run -> 409, with ZERO audit or resume side effects."""
    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)

    app = _build_control_app()
    app.state.graph = _fake_graph(paused=False)
    app.state.background_tasks = set()
    app.state.convex_http = MagicMock()

    import eisenbalm_pipeline.api.control as control_mod

    audit_spy = AsyncMock()
    resume_spy = AsyncMock()
    monkeypatch.setattr(control_mod, "_emit_audit", audit_spy)
    monkeypatch.setattr(control_mod, "_resume_paused_run", resume_spy)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/issues/run-not-paused-002/adjudicate",
            json={"selection": {"charityName": "X"}, "reason": "clearer hook"},
        )

    assert response.status_code == 409, response.text
    audit_spy.assert_not_called()
    resume_spy.assert_not_called()


def test_adjudicate_never_uses_trigger_secret() -> None:
    """Source-level guard: adjudicate auths via Clerk only, never the trigger secret."""
    import eisenbalm_pipeline.api.control as control_mod

    source = inspect.getsource(control_mod.adjudicate)
    assert "_require_trigger_secret" not in source, (
        "adjudicate must never reference _require_trigger_secret — the operator "
        "never handles the server-to-server trigger secret (D-13)"
    )
    assert "_require_clerk_jwt_control" in source, (
        "adjudicate must be guarded by _require_clerk_jwt_control (Clerk JWT)"
    )
