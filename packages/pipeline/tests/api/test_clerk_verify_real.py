"""Real-crypto Clerk JWT verification tests (no jwt mocking).

Uses real RSA keys + real PyJWT against both guards that share the verifier:
auth.require_clerk_jwt and control._require_clerk_jwt_control.
"""
from __future__ import annotations

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from eisenbalm_pipeline.api import auth, control

ISS = "https://example.clerk.accounts.dev"
ORIGINS = "https://dispatch.example.com, https://other.example.com"

_GOOD = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_BAD = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.setenv("CLERK_JWT_ISSUER_DOMAIN", ISS)
    monkeypatch.delenv("RAILWAY_ENVIRONMENT_NAME", raising=False)
    monkeypatch.delenv("DASHBOARD_ALLOWED_ORIGINS", raising=False)
    monkeypatch.setattr(auth, "_fetch_public_key", lambda kid: _GOOD.public_key())


def _mint(key=_GOOD, algorithm="RS256", **overrides) -> str:
    now = int(time.time())
    claims = {
        "sub": "user_abc",
        "iss": ISS,
        "iat": now,
        "nbf": now,
        "exp": now + 300,
        "sid": "sess_1",
    }
    claims.update(overrides)
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, key, algorithm=algorithm, headers={"kid": "k1"})


def _creds(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


GUARDS = [auth.require_clerk_jwt, control._require_clerk_jwt_control]
guards = pytest.mark.parametrize("guard", GUARDS, ids=["auth", "control"])


async def _expect_401(guard, token, detail):
    with pytest.raises(HTTPException) as ei:
        await guard(_creds(token))
    assert ei.value.status_code == 401
    assert ei.value.detail == detail


@guards
async def test_valid_token_accepted(guard):
    claims = await guard(_creds(_mint()))
    assert claims["sub"] == "user_abc"


@guards
async def test_expired_beyond_leeway(guard):
    await _expect_401(guard, _mint(exp=int(time.time()) - 120), "Token expired")


@guards
async def test_expired_within_leeway_passes(guard):
    claims = await guard(_creds(_mint(exp=int(time.time()) - 10)))
    assert claims["sub"] == "user_abc"


@guards
async def test_wrong_key(guard):
    await _expect_401(guard, _mint(key=_BAD), "Invalid token")


@guards
async def test_wrong_issuer(guard):
    await _expect_401(guard, _mint(iss="https://evil.clerk.accounts.dev"), "Invalid token")


@guards
async def test_issuer_env_trailing_slash(guard, monkeypatch):
    monkeypatch.setenv("CLERK_JWT_ISSUER_DOMAIN", ISS + "/")
    claims = await guard(_creds(_mint()))
    assert claims["sub"] == "user_abc"


@guards
@pytest.mark.parametrize("missing", ["sub", "exp", "iat"])
async def test_missing_required_claim(guard, missing):
    await _expect_401(guard, _mint(**{missing: None}), "Invalid token")


@guards
async def test_hs256_rejected(guard):
    tok = jwt.encode(
        {"sub": "u", "iss": ISS, "iat": int(time.time()), "exp": int(time.time()) + 300},
        "x" * 64,
        algorithm="HS256",
        headers={"kid": "k1"},
    )
    await _expect_401(guard, tok, "Invalid token")


@guards
async def test_azp_not_allowed(guard, monkeypatch):
    monkeypatch.setenv("DASHBOARD_ALLOWED_ORIGINS", ORIGINS)
    await _expect_401(guard, _mint(azp="https://attacker.example.com"), "Invalid token")


@guards
async def test_azp_allowed(guard, monkeypatch):
    monkeypatch.setenv("DASHBOARD_ALLOWED_ORIGINS", ORIGINS)
    claims = await guard(_creds(_mint(azp="https://dispatch.example.com")))
    assert claims["sub"] == "user_abc"


@guards
async def test_azp_trailing_slash_in_allowlist(guard, monkeypatch):
    monkeypatch.setenv("DASHBOARD_ALLOWED_ORIGINS", "https://dispatch.example.com/")
    claims = await guard(_creds(_mint(azp="https://dispatch.example.com")))
    assert claims["sub"] == "user_abc"


@guards
async def test_azp_absent_passes(guard, monkeypatch):
    monkeypatch.setenv("DASHBOARD_ALLOWED_ORIGINS", ORIGINS)
    claims = await guard(_creds(_mint()))
    assert claims["sub"] == "user_abc"


@guards
async def test_azp_check_skipped_when_env_unset(guard):
    claims = await guard(_creds(_mint(azp="https://anything.example.com")))
    assert claims["sub"] == "user_abc"


async def test_control_missing_credentials():
    with pytest.raises(HTTPException) as ei:
        await control._require_clerk_jwt_control(None)
    assert ei.value.status_code == 401
    assert ei.value.detail == "Not authenticated"


@guards
async def test_dev_sentinel_when_issuer_unset(guard, monkeypatch):
    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)
    assert await guard(_creds("whatever")) == {"sub": "local-dev-operator"}


@guards
async def test_deployed_without_issuer_500(guard, monkeypatch):
    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)
    monkeypatch.setenv("RAILWAY_ENVIRONMENT_NAME", "production")
    with pytest.raises(HTTPException) as ei:
        await guard(_creds("whatever"))
    assert ei.value.status_code == 500
