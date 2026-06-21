"""AUTH-03 seam — FastAPI Clerk JWT dependency stub tests.

Filled in Plan 21-04 when require_clerk_jwt is implemented in
packages/pipeline/src/eisenbalm_pipeline/api/auth.py.

Reference: 21-RESEARCH.md Pattern 4 — require_clerk_jwt Depends() guard.
Pattern: uses PyJWT + JWKS (Clerk's public-key endpoint) for RS256 verification.
         Caches keys by kid. Falls back to local-dev mode when
         CLERK_JWT_ISSUER_DOMAIN is unset (degraded-boot, same as _require_trigger_secret).
         claims["sub"] = Clerk userId → actorId on audit_log / triggeredBy on runs.

The 4 stub tests below reserve the assertion seams so Plan 21-04 can write
failing tests first (RED phase) before implementing the dependency.
"""
import pytest


@pytest.mark.skip(reason="Filled in Plan 21-04: require_clerk_jwt dependency")
def test_require_clerk_jwt_missing_returns_401():
    """No Authorization header → 401 Unauthorized."""
    pass


@pytest.mark.skip(reason="Filled in Plan 21-04: require_clerk_jwt dependency")
def test_require_clerk_jwt_expired_returns_401():
    """Expired JWT → 401 Unauthorized (jwt.ExpiredSignatureError)."""
    pass


@pytest.mark.skip(reason="Filled in Plan 21-04: require_clerk_jwt dependency")
def test_require_clerk_jwt_valid_returns_claims():
    """Valid RS256-signed JWT → 200 with decoded claims dict including 'sub'."""
    pass


@pytest.mark.skip(reason="Filled in Plan 21-04: require_clerk_jwt dependency")
def test_cron_trigger_secret_path_unaffected():
    """Railway cron path (X-Pipeline-Trigger-Secret) is NOT affected by Clerk guard.

    Existing _require_trigger_secret() tests in test_runs.py cover this path;
    this stub confirms that adding require_clerk_jwt to dashboard endpoints
    does not break the cron-secret guard on the /pipeline/run endpoint.
    """
    pass
