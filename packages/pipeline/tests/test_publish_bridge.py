"""Phase 50 Plan 05 (WBN-03, D-11/D-12) — Clerk-guarded Publisher-restart
bridge tests (docs/API_CONTRACTS.md §50.1).

POST /issues/{run_id}/publish-manual (api/control.py::publish_manual):
  test_missing_auth_rejected_401
    No Authorization header (CLERK_JWT_ISSUER_DOMAIN set, i.e. a "deployed"
    posture) -> 401, no side effects.
  test_collaborator_rejected_403
    A Collaborator-role Clerk claim -> 403 {"reason": "forbidden_role"},
    BEFORE the handler body (groq lookup / publisher invoke / audit) ever
    runs — mirrors tests/api/test_role_gate.py's pattern for the other five
    Editor-in-chief-only actions (§49.4).
  test_editor_invokes_publisher_and_audits
    An Editor-in-chief claim resolves the Sanity issue for run_id, audits
    BEFORE scheduling ("nothing silent"), and schedules the SAME
    `_run_publisher` coroutine `manual_publish` (WHK-08) invokes — called
    with the run_id (mirrors tests/api/test_runs.py's
    test_manual_publish_invokes_publisher pattern).
  test_sentinel_regression_resolves_editor
    D-04: with CLERK_JWT_ISSUER_DOMAIN unset, the local-dev sentinel
    ({"sub": "local-dev-operator"}) resolves to Editor-in-chief — reaches
    the normal path, never 403.
  test_publish_manual_never_uses_trigger_secret
    Source-level guard: the handler never references
    _require_trigger_secret — auth is _require_editor (Clerk) only, so the
    operator never handles the server-to-server trigger secret. Mirrors
    tests/test_adjudication_bridge.py::test_adjudicate_never_uses_trigger_secret.

Source: 50-05-failed-run-recovery-rail-honest-restart-PLAN.md Task 1 +
docs/API_CONTRACTS.md §50.1 + tests/api/test_role_gate.py (auth-mock
construction) + tests/api/test_runs.py (groq_query/_run_publisher patch
targets) + tests/test_adjudication_bridge.py (control_router app harness).
"""
from __future__ import annotations

import asyncio
import inspect
import sys
import types
from unittest.mock import AsyncMock, MagicMock

import jwt as _real_jwt
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from eisenbalm_pipeline.api.control import router as control_router

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


# ── _make_jwt_mock / _set_role_claims — construction copied verbatim from
#    tests/api/test_role_gate.py (see that file for the canonical version) ──


def _make_jwt_mock(
    unverified_header: dict,
    decode_raises: Exception | None = None,
    decode_returns: dict | None = None,
):
    mock_mod = types.SimpleNamespace()

    def get_unverified_header(token):  # noqa: ARG001
        return unverified_header

    def decode(token, key, algorithms, options):  # noqa: ARG001
        if decode_raises is not None:
            raise decode_raises
        return decode_returns or {}

    mock_mod.get_unverified_header = get_unverified_header
    mock_mod.decode = decode
    mock_mod.ExpiredSignatureError = _real_jwt.ExpiredSignatureError
    mock_mod.DecodeError = _real_jwt.DecodeError
    mock_mod.InvalidTokenError = _real_jwt.InvalidTokenError
    return mock_mod


def _set_role_claims(monkeypatch, *, role: str | None, sub: str = "user_x"):
    """Force the non-degraded Clerk verification path with a mocked decode
    returning the given role claim (or no role key at all when role=None)."""
    monkeypatch.setenv("CLERK_JWT_ISSUER_DOMAIN", "https://example.clerk.accounts.dev")
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.auth._fetch_public_key", lambda kid: "dummy-key"
    )
    claims = {"sub": sub}
    if role is not None:
        claims["role"] = role
    monkeypatch.setitem(
        sys.modules,
        "jwt",
        _make_jwt_mock(
            unverified_header={"kid": "k1", "alg": "RS256"},
            decode_returns=claims,
        ),
    )


AUTH_HEADER = {"Authorization": "Bearer test.token.value"}


def _build_app() -> FastAPI:
    app = FastAPI()
    app.include_router(control_router)
    app.state.convex_http = MagicMock()
    app.state.background_tasks = set()
    return app


def _wire_publisher(monkeypatch, *, issue: dict | None):
    """Patch the SAME two seams manual_publish's own test suite patches
    (tests/api/test_runs.py) — groq_query at its canonical home, and
    _run_publisher on the publisher module (both are locally imported by
    the handler at call time, so patching the module attribute is live)."""
    fake_groq = AsyncMock(return_value=issue)
    monkeypatch.setattr("eisenbalm_pipeline.lib.sanity_client.groq_query", fake_groq)

    pub_spy = AsyncMock(return_value=None)
    monkeypatch.setattr("eisenbalm_pipeline.agents.publisher._run_publisher", pub_spy)

    return fake_groq, pub_spy


# ── test_missing_auth_rejected_401 ─────────────────────────────────────────


async def test_missing_auth_rejected_401(monkeypatch) -> None:
    """No Authorization header, deployed-like posture (CLERK_JWT_ISSUER_DOMAIN
    set) -> 401, with zero side effects (groq/publisher never called)."""
    monkeypatch.setenv("CLERK_JWT_ISSUER_DOMAIN", "https://example.clerk.accounts.dev")
    fake_groq, pub_spy = _wire_publisher(
        monkeypatch, issue={"_id": "issue-99", "issueNumber": 99}
    )

    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/issues/run-no-auth-001/publish-manual")

    assert response.status_code == 401, response.text
    fake_groq.assert_not_called()
    pub_spy.assert_not_called()


# ── test_collaborator_rejected_403 ─────────────────────────────────────────


async def test_collaborator_rejected_403(monkeypatch) -> None:
    """A Collaborator-role token is rejected 403 forbidden_role BEFORE the
    handler body (groq lookup / publisher invoke / audit) ever runs."""
    fake_groq, pub_spy = _wire_publisher(
        monkeypatch, issue={"_id": "issue-99", "issueNumber": 99}
    )
    _set_role_claims(monkeypatch, role="Collaborator", sub="user_collab")

    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/issues/run-collab-001/publish-manual", headers=AUTH_HEADER
        )

    assert response.status_code == 403, response.text
    assert response.json()["detail"]["reason"] == "forbidden_role"
    fake_groq.assert_not_called()
    pub_spy.assert_not_called()


# ── test_editor_invokes_publisher_and_audits ───────────────────────────────


async def test_editor_invokes_publisher_and_audits(monkeypatch) -> None:
    """An Editor-in-chief claim resolves the issue, audits BEFORE scheduling
    ("nothing silent"), and schedules the SAME _run_publisher coroutine
    manual_publish (WHK-08) invokes, called with this run_id."""
    fake_groq, pub_spy = _wire_publisher(
        monkeypatch, issue={"_id": "issue-99", "issueNumber": 99}
    )
    _set_role_claims(monkeypatch, role="Editor-in-chief", sub="user_editor")

    import eisenbalm_pipeline.api.control as control_mod

    audit_calls: list[dict] = []

    async def fake_emit_audit(http, **kwargs):  # noqa: ARG001
        audit_calls.append(kwargs)

    monkeypatch.setattr(control_mod, "_emit_audit", fake_emit_audit)

    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/issues/run-editor-001/publish-manual", headers=AUTH_HEADER
        )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body == {
        "runId": "run-editor-001",
        "issueId": "issue-99",
        "issueNumber": 99,
        "scheduled": True,
    }

    # groq_query was used to look up the issue by runId.
    fake_groq.assert_awaited()
    assert fake_groq.await_args.kwargs["params"] == {"runId": "run-editor-001"}

    # Audit fired exactly once, BEFORE the response is returned.
    assert len(audit_calls) == 1
    assert audit_calls[0]["action"] == "publisher.manual_restart"
    assert audit_calls[0]["resource_type"] == "run"
    assert audit_calls[0]["resource_id"] == "run-editor-001"
    assert audit_calls[0]["actor_id"] == "user_editor"

    # Fire-and-forget: yield to the event loop so the background task runs.
    await asyncio.sleep(0)

    pub_spy.assert_awaited_once()
    call_kwargs = pub_spy.await_args.kwargs
    assert call_kwargs["run_id"] == "run-editor-001"
    assert call_kwargs["issue_id"] == "issue-99"
    assert call_kwargs["issue_number"] == 99


async def test_editor_404_when_no_sanity_issue(monkeypatch) -> None:
    """No Sanity weeklyIssue for run_id -> 404, with no audit/publisher
    side effects (mirrors manual_publish's own 404 behavior)."""
    fake_groq, pub_spy = _wire_publisher(monkeypatch, issue=None)
    _set_role_claims(monkeypatch, role="Editor-in-chief", sub="user_editor")

    import eisenbalm_pipeline.api.control as control_mod

    audit_spy = AsyncMock()
    monkeypatch.setattr(control_mod, "_emit_audit", audit_spy)

    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/issues/run-missing-001/publish-manual", headers=AUTH_HEADER
        )

    assert response.status_code == 404, response.text
    audit_spy.assert_not_called()
    pub_spy.assert_not_called()


# ── test_sentinel_regression_resolves_editor ───────────────────────────────


async def test_sentinel_regression_resolves_editor(monkeypatch) -> None:
    """D-04: with CLERK_JWT_ISSUER_DOMAIN unset, the local-dev sentinel
    ({"sub": "local-dev-operator"}) resolves to Editor-in-chief — reaches the
    normal path (never 403), header-free."""
    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)
    _wire_publisher(monkeypatch, issue={"_id": "issue-1", "issueNumber": 1})

    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/issues/run-sentinel-001/publish-manual")

    assert response.status_code != 403, response.text


# ── test_publish_manual_never_uses_trigger_secret ──────────────────────────


def test_publish_manual_never_uses_trigger_secret() -> None:
    """Source-level guard: publish_manual auths via _require_editor (Clerk)
    only, never the server-to-server trigger secret."""
    import eisenbalm_pipeline.api.control as control_mod

    source = inspect.getsource(control_mod.publish_manual)
    assert "_require_trigger_secret" not in source, (
        "publish_manual must never reference _require_trigger_secret — the "
        "operator never handles the server-to-server trigger secret."
    )
    assert "_require_editor" in source, (
        "publish_manual must be guarded by _require_editor (Editor-in-chief "
        "Clerk claim)."
    )
