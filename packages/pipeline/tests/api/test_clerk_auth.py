"""AUTH-03 — FastAPI Clerk JWT dependency unit tests.

Implements the 4 assertion seams reserved in Plan 21-01.
Reference: 21-RESEARCH.md Pattern 4 — require_clerk_jwt Depends() guard.

Strategy:
- All tests mock the JWKS network call (no real Clerk endpoint hit).
- Tests that assert 401 behaviour set CLERK_JWT_ISSUER_DOMAIN via monkeypatch
  to force the non-degraded verification path (otherwise the dev-skip branch
  returns the sentinel and there's no 401 to observe).
- Uses a lightweight in-process AsyncClient rather than the `client` fixture
  (which skips when full infrastructure env vars are absent) so these pure
  unit tests always run.
"""
from __future__ import annotations

import os

import jwt
import pytest
from httpx import ASGITransport, AsyncClient


# ── Fixture: minimal in-process client for auth tests ────────────────────
#
# The shared `client` fixture in conftest.py skips on any missing env var.
# For auth unit tests we only need the FastAPI app importable — no Postgres,
# no Convex, no Sanity. We skip only if the module cannot be imported at all.

@pytest.fixture
async def auth_client():
    """In-process test client for auth-focused tests.

    Skips only if the FastAPI app module cannot be imported (e.g., pre-wiring).
    Does NOT require infrastructure env vars — the app's lifespan runs in
    degraded mode (graph=None), which is fine for auth endpoint tests.
    """
    try:
        from eisenbalm_pipeline.api.main import app  # noqa: WPS433
    except ImportError as exc:
        pytest.skip(f"FastAPI app not importable: {exc}")

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        # No X-Pipeline-Trigger-Secret — dashboard endpoints use Clerk JWT, not cron secret
    ) as c:
        yield c


# ── Test 1: missing Authorization header → 401 / 403 ─────────────────────


async def test_require_clerk_jwt_missing_returns_401(auth_client, monkeypatch):
    """No Authorization header → HTTPBearer raises 403 (auto-raise on missing
    credentials), or our dependency raises 401. Either is acceptable because
    HTTPBearer in FastAPI raises 403 for missing credentials by default.

    With CLERK_JWT_ISSUER_DOMAIN set we are in the non-degraded path, but
    HTTPBearer itself rejects the request before our dependency runs.
    """
    monkeypatch.setenv("CLERK_JWT_ISSUER_DOMAIN", "https://example.clerk.accounts.dev")

    r = await auth_client.post("/dashboard/whoami")
    # HTTPBearer raises 403 on absent credentials; our guard raises 401 on invalid.
    # Both are acceptable — the key invariant is that no access is granted.
    assert r.status_code in (401, 403), (
        f"Expected 401 or 403 with no Authorization header, got {r.status_code}: {r.text}"
    )


# ── Test 2: expired JWT → 401 with detail "Token expired" ────────────────


async def test_require_clerk_jwt_expired_returns_401(auth_client, monkeypatch):
    """Expired JWT → 401 Unauthorized with detail 'Token expired'.

    Mocks _fetch_public_key and jwt.decode (in the auth module namespace) to
    simulate ExpiredSignatureError without needing a real RS256 key pair.
    """
    monkeypatch.setenv("CLERK_JWT_ISSUER_DOMAIN", "https://example.clerk.accounts.dev")

    # Patch _fetch_public_key to return a dummy key object (value doesn't matter
    # because jwt.decode is also patched below).
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.auth._fetch_public_key",
        lambda kid: "dummy-key",
    )

    # Patch jwt.get_unverified_header in the auth module namespace to return a
    # header dict with a known kid so _fetch_public_key can be called.
    import eisenbalm_pipeline.api.auth as auth_mod

    def fake_get_unverified_header(token):
        return {"kid": "test-kid-1", "alg": "RS256"}

    monkeypatch.setattr(auth_mod, "jwt", _make_jwt_mock(
        unverified_header={"kid": "test-kid-1", "alg": "RS256"},
        decode_raises=jwt.ExpiredSignatureError("Signature has expired"),
    ))

    r = await auth_client.post(
        "/dashboard/whoami",
        headers={"Authorization": "Bearer bogus.expired.token"},
    )
    assert r.status_code == 401, f"Expected 401 for expired token, got {r.status_code}: {r.text}"
    assert r.json().get("detail") == "Token expired", r.json()


# ── Test 3: valid JWT → 200 with operatorId = sub claim ──────────────────


async def test_require_clerk_jwt_valid_returns_claims(auth_client, monkeypatch):
    """Valid RS256-signed JWT → 200 with body {operatorId: '<clerk-user-id>'}.

    Mocks get_unverified_header, _fetch_public_key, and jwt.decode to return
    a controlled claims dict without needing a real key pair.
    """
    monkeypatch.setenv("CLERK_JWT_ISSUER_DOMAIN", "https://example.clerk.accounts.dev")

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.auth._fetch_public_key",
        lambda kid: "dummy-key",
    )

    import eisenbalm_pipeline.api.auth as auth_mod

    monkeypatch.setattr(auth_mod, "jwt", _make_jwt_mock(
        unverified_header={"kid": "test-kid-2", "alg": "RS256"},
        decode_returns={"sub": "user_abc", "iat": 9999999999, "exp": 9999999999},
    ))

    r = await auth_client.post(
        "/dashboard/whoami",
        headers={"Authorization": "Bearer valid.rs256.token"},
    )
    assert r.status_code == 200, f"Expected 200 for valid token, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("operatorId") == "user_abc", (
        f"Expected operatorId='user_abc', got: {body}"
    )


# ── Test 4: cron path is NOT affected by Clerk guard ─────────────────────


async def test_cron_trigger_secret_path_unaffected(auth_client, monkeypatch):
    """/run/weekly uses _require_trigger_secret (cron path), NOT Clerk JWT.

    When PIPELINE_TRIGGER_SECRET is unset, the cron guard skips with a logged
    warning (degraded-dev mode). No Clerk Authorization header should be needed.

    We monkeypatch _execute_run to avoid spawning a real graph task (no
    infra env available in unit tests), and convex_mutation to avoid a
    real Convex call.
    """
    # Ensure Clerk domain is set to force the non-degraded Clerk path — but
    # the cron endpoint must NOT require a Clerk header regardless.
    monkeypatch.setenv("CLERK_JWT_ISSUER_DOMAIN", "https://example.clerk.accounts.dev")

    # Clear PIPELINE_TRIGGER_SECRET so the cron guard runs in skip-with-warning mode.
    monkeypatch.delenv("PIPELINE_TRIGGER_SECRET", raising=False)

    # Stub out the background task and Convex write so the test doesn't hang.
    from unittest.mock import AsyncMock

    async def fake_execute_run(app, run_id, initial_state, config):
        pass  # no-op — we only care about the HTTP response code

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.runs._execute_run", fake_execute_run
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.lib.convex_client.convex_mutation",
        AsyncMock(return_value={"status": "success"}),
    )

    # POST to the cron endpoint with NO Authorization header — should not 401.
    r = await auth_client.post(
        "/run/weekly",
        json={"issueNumber": 9999},
        # Deliberately NO Authorization header — cron path uses X-Pipeline-Trigger-Secret
    )
    # When the lifespan runs in degraded mode (no SUPABASE_POSTGRES_URL),
    # _require_graph raises 503. The key assertion is that we did NOT get
    # 401 or 403 due to missing Clerk JWT — the cron path never checks for it.
    assert r.status_code not in (401, 403), (
        f"Cron path /run/weekly must NOT require a Clerk JWT header. "
        f"Got {r.status_code}: {r.text}"
    )


# ── Helper: mock jwt module ───────────────────────────────────────────────


def _make_jwt_mock(
    unverified_header: dict,
    decode_raises: Exception | None = None,
    decode_returns: dict | None = None,
):
    """Build a minimal mock of the jwt module for use with monkeypatch.setattr.

    The mock exposes:
      - .get_unverified_header(token) -> unverified_header
      - .decode(token, key, algorithms, options) -> decode_returns  (or raises decode_raises)
      - .ExpiredSignatureError  (the real class, so except clauses work)

    This avoids touching the real PyJWT module globally while letting the
    auth dependency under test call both functions via `jwt.` attribute access.
    """
    import types

    mock_mod = types.SimpleNamespace()

    def get_unverified_header(token):  # noqa: ARG001
        return unverified_header

    def decode(token, key, algorithms, options):  # noqa: ARG001
        if decode_raises is not None:
            raise decode_raises
        return decode_returns or {}

    mock_mod.get_unverified_header = get_unverified_header
    mock_mod.decode = decode
    # Expose the real exception classes so except clauses in auth.py still match.
    mock_mod.ExpiredSignatureError = jwt.ExpiredSignatureError
    mock_mod.DecodeError = jwt.DecodeError
    mock_mod.InvalidTokenError = jwt.InvalidTokenError

    return mock_mod
