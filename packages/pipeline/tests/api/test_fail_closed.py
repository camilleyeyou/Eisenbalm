"""Phase 29 D-2/D-3 — fail-closed auth unit tests.

Verifies:
  - assert_deployed_secrets() raises when RAILWAY_ENVIRONMENT_NAME is set and
    either PIPELINE_TRIGGER_SECRET or CLERK_JWT_ISSUER_DOMAIN is unset, and
    is a no-op (local dev) when the marker is absent.
  - Each of the four per-request guards (auth.py::require_clerk_jwt,
    control.py::_require_clerk_jwt_control, agents.py::_require_operator,
    runs.py::_require_trigger_secret) independently fails closed (raises an
    HTTPException, does NOT return the sentinel / does NOT skip) when
    RAILWAY_ENVIRONMENT_NAME is set and their secret is unset.
  - Regression: WITHOUT RAILWAY_ENVIRONMENT_NAME, all four guards keep
    returning/skipping exactly as before (dev-mode convenience unchanged).
  - D-3: the trigger-secret guard rejects a wrong secret (401) and accepts
    the correct one, proving the hmac.compare_digest swap preserves
    behavior.
"""
from __future__ import annotations

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from starlette.requests import Request

from eisenbalm_pipeline.api.agents import _require_operator
from eisenbalm_pipeline.api.auth import assert_deployed_secrets, require_clerk_jwt
from eisenbalm_pipeline.api.control import _require_clerk_jwt_control
from eisenbalm_pipeline.api.runs import _require_trigger_secret

DUMMY_CREDENTIALS = HTTPAuthorizationCredentials(
    scheme="Bearer", credentials="dummy.token.value"
)


def _fake_request(headers: dict[str, str] | None = None) -> Request:
    """Minimal Starlette Request with no real ASGI transport — enough for
    _require_trigger_secret, which only reads request.headers."""
    headers = headers or {}
    encoded = [(k.lower().encode(), v.encode()) for k, v in headers.items()]
    scope = {
        "type": "http",
        "headers": encoded,
        "method": "POST",
        "path": "/run/weekly",
    }
    return Request(scope)


# ── assert_deployed_secrets() ──────────────────────────────────────────────


def test_assert_deployed_secrets_raises_when_trigger_secret_missing(monkeypatch):
    monkeypatch.setenv("RAILWAY_ENVIRONMENT_NAME", "production")
    monkeypatch.delenv("PIPELINE_TRIGGER_SECRET", raising=False)
    monkeypatch.setenv("CLERK_JWT_ISSUER_DOMAIN", "https://example.clerk.accounts.dev")

    with pytest.raises(RuntimeError, match="PIPELINE_TRIGGER_SECRET"):
        assert_deployed_secrets()


def test_assert_deployed_secrets_raises_when_clerk_domain_missing(monkeypatch):
    monkeypatch.setenv("RAILWAY_ENVIRONMENT_NAME", "production")
    monkeypatch.setenv("PIPELINE_TRIGGER_SECRET", "s3cr3t")
    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)

    with pytest.raises(RuntimeError, match="CLERK_JWT_ISSUER_DOMAIN"):
        assert_deployed_secrets()


def test_assert_deployed_secrets_passes_when_both_set(monkeypatch):
    monkeypatch.setenv("RAILWAY_ENVIRONMENT_NAME", "production")
    monkeypatch.setenv("PIPELINE_TRIGGER_SECRET", "s3cr3t")
    monkeypatch.setenv("CLERK_JWT_ISSUER_DOMAIN", "https://example.clerk.accounts.dev")

    assert_deployed_secrets()  # must not raise


def test_assert_deployed_secrets_noop_without_railway_marker(monkeypatch):
    """Regression: local dev (no RAILWAY_ENVIRONMENT_NAME) never raises, even
    when both secrets are unset — existing convenience behavior unchanged."""
    monkeypatch.delenv("RAILWAY_ENVIRONMENT_NAME", raising=False)
    monkeypatch.delenv("PIPELINE_TRIGGER_SECRET", raising=False)
    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)

    assert_deployed_secrets()  # must not raise


# ── require_clerk_jwt (api/auth.py) ────────────────────────────────────────


async def test_require_clerk_jwt_fails_closed_when_deployed(monkeypatch):
    monkeypatch.setenv("RAILWAY_ENVIRONMENT_NAME", "production")
    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)

    with pytest.raises(HTTPException) as exc_info:
        await require_clerk_jwt(DUMMY_CREDENTIALS)
    assert exc_info.value.status_code == 500


async def test_require_clerk_jwt_dev_sentinel_without_railway_marker(monkeypatch):
    """Regression: local dev keeps returning the sentinel dict byte-for-byte."""
    monkeypatch.delenv("RAILWAY_ENVIRONMENT_NAME", raising=False)
    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)

    claims = await require_clerk_jwt(DUMMY_CREDENTIALS)
    assert claims == {"sub": "local-dev-operator"}


# ── _require_clerk_jwt_control (api/control.py) ────────────────────────────


async def test_control_clerk_guard_fails_closed_when_deployed(monkeypatch):
    monkeypatch.setenv("RAILWAY_ENVIRONMENT_NAME", "production")
    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)

    with pytest.raises(HTTPException) as exc_info:
        await _require_clerk_jwt_control(None)
    assert exc_info.value.status_code == 500


async def test_control_clerk_guard_dev_sentinel_without_railway_marker(monkeypatch):
    monkeypatch.delenv("RAILWAY_ENVIRONMENT_NAME", raising=False)
    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)

    claims = await _require_clerk_jwt_control(None)
    assert claims == {"sub": "local-dev-operator"}


# ── _require_operator (api/agents.py) ──────────────────────────────────────


async def test_agents_require_operator_fails_closed_when_deployed(monkeypatch):
    monkeypatch.setenv("RAILWAY_ENVIRONMENT_NAME", "production")
    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)

    with pytest.raises(HTTPException) as exc_info:
        await _require_operator(None)
    assert exc_info.value.status_code == 500


async def test_agents_require_operator_dev_sentinel_without_railway_marker(monkeypatch):
    monkeypatch.delenv("RAILWAY_ENVIRONMENT_NAME", raising=False)
    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)

    claims = await _require_operator(None)
    assert claims == {"sub": "local-dev-operator"}


# ── _require_trigger_secret (api/runs.py) ──────────────────────────────────


def test_trigger_secret_fails_closed_when_deployed(monkeypatch):
    monkeypatch.setenv("RAILWAY_ENVIRONMENT_NAME", "production")
    monkeypatch.delenv("PIPELINE_TRIGGER_SECRET", raising=False)

    with pytest.raises(HTTPException) as exc_info:
        _require_trigger_secret(_fake_request())
    assert exc_info.value.status_code == 500


def test_trigger_secret_dev_skip_without_railway_marker(monkeypatch):
    """Regression: local dev, secret unset -> guard skips with a warning."""
    monkeypatch.delenv("RAILWAY_ENVIRONMENT_NAME", raising=False)
    monkeypatch.delenv("PIPELINE_TRIGGER_SECRET", raising=False)

    _require_trigger_secret(_fake_request())  # must not raise


# ── D-3: constant-time compare correctness ─────────────────────────────────


def test_trigger_secret_rejects_wrong_secret(monkeypatch):
    monkeypatch.delenv("RAILWAY_ENVIRONMENT_NAME", raising=False)
    monkeypatch.setenv("PIPELINE_TRIGGER_SECRET", "correct-secret")

    with pytest.raises(HTTPException) as exc_info:
        _require_trigger_secret(
            _fake_request({"X-Pipeline-Trigger-Secret": "wrong-secret"})
        )
    assert exc_info.value.status_code == 401


def test_trigger_secret_accepts_correct_secret(monkeypatch):
    monkeypatch.delenv("RAILWAY_ENVIRONMENT_NAME", raising=False)
    monkeypatch.setenv("PIPELINE_TRIGGER_SECRET", "correct-secret")

    # Must not raise.
    _require_trigger_secret(
        _fake_request({"X-Pipeline-Trigger-Secret": "correct-secret"})
    )
