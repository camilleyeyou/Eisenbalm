"""Clerk JWT authentication dependency for FastAPI dashboard-control endpoints.

Source: 21-RESEARCH.md Pattern 4 — require_clerk_jwt Depends() guard.

Usage:
    from eisenbalm_pipeline.api.auth import require_clerk_jwt

    @router.post("/pipeline/whoami")
    async def my_endpoint(claims: dict = Depends(require_clerk_jwt)):
        operator_id = claims["sub"]  # Clerk userId — actorId for audit rows

Design mirrors _require_trigger_secret() in api/runs.py:
  - If CLERK_JWT_ISSUER_DOMAIN is unset (local dev), logs a warning and
    returns a sentinel dict {"sub": "local-dev-operator"} so local dev
    and the test suite work without live Clerk.
  - If the env var is set, verifies the JWT against Clerk's JWKS endpoint
    (RS256, no aud check — Clerk tokens have no standard aud claim).
  - Raises HTTP 401 on ExpiredSignatureError ("Token expired") or any other
    verification failure ("Invalid token").

claims["sub"] is the Clerk user ID — used as actorId on audit_log rows and
triggeredBy on runs rows from Phase 21 onward.
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache

import jwt
import requests
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

log = logging.getLogger(__name__)

security = HTTPBearer()


@lru_cache(maxsize=1)
def _get_clerk_jwks_url() -> str:
    """Derive the Clerk JWKS endpoint URL from CLERK_JWT_ISSUER_DOMAIN.

    Cached with lru_cache(maxsize=1) so the URL construction only runs once
    per process, avoiding repeated env-var reads (Pitfall 4 — JWKS caching).
    Raises RuntimeError if the env var is not set (caller guards this).
    """
    domain = os.environ.get("CLERK_JWT_ISSUER_DOMAIN", "")
    if not domain:
        raise RuntimeError("CLERK_JWT_ISSUER_DOMAIN not set")
    return f"{domain.rstrip('/')}/.well-known/jwks.json"


def _fetch_public_key(kid: str) -> object:
    """Fetch the RSA public key for the given key ID from Clerk's JWKS endpoint.

    Makes a synchronous GET to the JWKS URL (acceptable: only called once per
    unique kid in a process lifetime; Clerk rotates keys infrequently).
    Returns an RSAAlgorithm key object suitable for jwt.decode().
    Raises HTTP 401 if the kid is not found in the JWKS response.
    """
    from jwt.algorithms import RSAAlgorithm  # noqa: PLC0415 — local import

    jwks_url = _get_clerk_jwks_url()
    jwks = requests.get(jwks_url, timeout=5).json()
    for key_data in jwks.get("keys", []):
        if key_data.get("kid") == kid:
            return RSAAlgorithm.from_jwk(key_data)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unknown kid in JWT header",
    )


async def require_clerk_jwt(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """FastAPI dependency: verify a Clerk-issued JWT, return decoded claims.

    Degrades gracefully when CLERK_JWT_ISSUER_DOMAIN is unset (local dev):
    logs a warning and returns {"sub": "local-dev-operator"} — mirrors
    _require_trigger_secret()'s skip-with-warning degraded-boot behaviour.

    On successful verification, returns the full decoded JWT claims dict.
    claims["sub"] is the Clerk user ID — the actorId for audit_log rows and
    triggeredBy for runs rows.

    Raises:
        HTTP 401 "Token expired"   — jwt.ExpiredSignatureError
        HTTP 401 "Invalid token"   — any other verification failure
        HTTP 403                   — no Authorization header (HTTPBearer raises
                                     this automatically before this function runs)
    """
    if not os.environ.get("CLERK_JWT_ISSUER_DOMAIN"):
        log.warning(
            "CLERK_JWT_ISSUER_DOMAIN unset — skipping Clerk JWT check "
            "(local dev). Set it in any deployed environment."
        )
        return {"sub": "local-dev-operator"}

    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        public_key = _fetch_public_key(header["kid"])
        claims = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False},  # Clerk tokens have no standard aud
        )
        return claims
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        )
    except HTTPException:
        raise  # re-raise 401 from _fetch_public_key (unknown kid)
    except Exception as exc:  # noqa: BLE001 — catch-all for any other JWT error
        log.warning("Clerk JWT verification failed: %r", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
