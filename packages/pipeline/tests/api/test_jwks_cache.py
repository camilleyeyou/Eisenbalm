"""Unit tests for the Clerk JWKS cache in api/auth.py."""
from __future__ import annotations

import jwt
import pytest
import requests
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from eisenbalm_pipeline.api import auth


class _Resp:
    def __init__(self, kids):
        self._kids = kids

    def raise_for_status(self):
        pass

    def json(self):
        return {"keys": [{"kid": k} for k in self._kids]}


@pytest.fixture(autouse=True)
def _setup(monkeypatch):
    monkeypatch.setenv("CLERK_JWT_ISSUER_DOMAIN", "https://example.clerk.accounts.dev")
    auth._reset_jwks_cache()
    auth._get_clerk_jwks_url.cache_clear()
    monkeypatch.setattr(
        jwt.algorithms.RSAAlgorithm, "from_jwk", staticmethod(lambda j: f"key-{j['kid']}")
    )
    yield
    auth._reset_jwks_cache()
    auth._get_clerk_jwks_url.cache_clear()


def _fake_get(monkeypatch, responder):
    calls = []

    def get(url, timeout):
        calls.append(url)
        return responder()

    monkeypatch.setattr(auth.requests, "get", get)
    return calls


def test_cache_hit_within_ttl(monkeypatch):
    calls = _fake_get(monkeypatch, lambda: _Resp(["k1"]))
    assert auth._fetch_public_key("k1") == "key-k1"
    assert auth._fetch_public_key("k1") == "key-k1"
    assert len(calls) == 1


def test_kid_miss_refetches_once(monkeypatch):
    state = {"kids": ["k1"]}
    calls = _fake_get(monkeypatch, lambda: _Resp(state["kids"]))
    monkeypatch.setattr(auth, "_JWKS_MIN_REFETCH_S", 0)
    auth._fetch_public_key("k1")
    state["kids"] = ["k1", "k2"]
    assert auth._fetch_public_key("k2") == "key-k2"
    assert len(calls) == 2


def test_unknown_kid_after_refetch_401(monkeypatch):
    calls = _fake_get(monkeypatch, lambda: _Resp(["k1"]))
    monkeypatch.setattr(auth, "_JWKS_MIN_REFETCH_S", 0)
    auth._fetch_public_key("k1")
    with pytest.raises(HTTPException) as ei:
        auth._fetch_public_key("nope")
    assert ei.value.status_code == 401
    assert len(calls) == 2


def test_fetch_failure_503(monkeypatch):
    def boom():
        raise requests.ConnectionError("down")

    _fake_get(monkeypatch, boom)
    with pytest.raises(HTTPException) as ei:
        auth._fetch_public_key("k1")
    assert ei.value.status_code == 503


def test_json_failure_503(monkeypatch):
    class Bad(_Resp):
        def json(self):
            raise ValueError("bad json")

    _fake_get(monkeypatch, lambda: Bad([]))
    with pytest.raises(HTTPException) as ei:
        auth._fetch_public_key("k1")
    assert ei.value.status_code == 503


def test_stale_key_served_when_refresh_fails(monkeypatch):
    mode = {"fail": False}

    def responder():
        if mode["fail"]:
            raise requests.ConnectionError("down")
        return _Resp(["k1"])

    _fake_get(monkeypatch, responder)
    t = {"now": 1000.0}
    monkeypatch.setattr(auth.time, "monotonic", lambda: t["now"])
    assert auth._fetch_public_key("k1") == "key-k1"
    t["now"] += auth._JWKS_TTL_S + 1
    mode["fail"] = True
    assert auth._fetch_public_key("k1") == "key-k1"


async def test_require_clerk_jwt_outage_is_503(monkeypatch):
    monkeypatch.setattr(auth.jwt, "get_unverified_header", lambda t: {"kid": "k1"})

    def boom():
        raise requests.ConnectionError("down")

    _fake_get(monkeypatch, boom)
    with pytest.raises(HTTPException) as ei:
        await auth.require_clerk_jwt(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials="x")
        )
    assert ei.value.status_code == 503
