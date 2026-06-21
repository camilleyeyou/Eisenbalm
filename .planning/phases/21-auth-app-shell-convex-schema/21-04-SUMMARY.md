---
phase: 21-auth-app-shell-convex-schema
plan: "04"
subsystem: pipeline-auth
tags: [auth, fastapi, clerk, jwt, pyjwt, jwks, rs256, testing]
dependency_graph:
  requires: ["21-01"]
  provides: ["require_clerk_jwt FastAPI dependency", "AUTH-03 test coverage"]
  affects: ["packages/pipeline/src/eisenbalm_pipeline/api/", "packages/pipeline/tests/api/"]
tech_stack:
  added: []
  patterns:
    - "PyJWT RS256 verification via Clerk JWKS endpoint"
    - "HTTPBearer FastAPI security dependency"
    - "lru_cache on JWKS URL derivation (Pitfall 4 — JWKS caching)"
    - "Degraded-dev branch: returns sentinel when CLERK_JWT_ISSUER_DOMAIN unset"
    - "jwt module mock via types.SimpleNamespace for unit testing without real keys"
key_files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/api/auth.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
    - packages/pipeline/tests/api/test_clerk_auth.py
    - packages/pipeline/.env.example
decisions:
  - "Dashboard endpoint is /dashboard/whoami (minimal proof-of-wiring per D-04 — no synthetic run-trigger this phase)"
  - "Depends(require_clerk_jwt) imported at top of runs.py; Depends added to fastapi import line"
  - "HTTPBearer raises 403 on missing Authorization header (before our dependency runs) — test asserts status in (401, 403)"
  - "auth_client fixture in test file (not conftest) skips only on ImportError, not on missing env vars — these are pure unit tests"
  - "_make_jwt_mock helper uses types.SimpleNamespace to expose real exception classes so except clauses in auth.py still match"
  - "cron path test deletes PIPELINE_TRIGGER_SECRET to test skip-with-warning mode; patches _execute_run and convex_mutation"
metrics:
  duration: "4 minutes"
  completed: "2026-06-21"
  tasks: 2
  files: 4
requirements: [AUTH-03]
---

# Phase 21 Plan 04: Clerk JWT Dependency + Dashboard Auth Summary

Implement `require_clerk_jwt` FastAPI dependency using PyJWT + Clerk JWKS (RS256) and apply it to a new `/dashboard/whoami` endpoint, while leaving the Railway cron path's `X-Pipeline-Trigger-Secret` guard completely untouched. Fill the Wave 0 `test_clerk_auth.py` stub with real assertions.

## What Was Built

**`packages/pipeline/src/eisenbalm_pipeline/api/auth.py` (NEW)**

A reusable FastAPI dependency (`require_clerk_jwt`) implementing:
- `_get_clerk_jwks_url()` — derives `{CLERK_JWT_ISSUER_DOMAIN}/.well-known/jwks.json`, cached via `lru_cache(maxsize=1)` (avoids repeated env-var reads per Pitfall 4)
- `_fetch_public_key(kid)` — fetches Clerk JWKS, returns `RSAAlgorithm.from_jwk(matching_key)`, raises HTTP 401 on unknown kid
- `require_clerk_jwt(credentials=Depends(security)) -> dict` — verifies RS256 with `options={"verify_aud": False}` (Clerk tokens have no standard aud), raises 401 on `ExpiredSignatureError` ("Token expired") or any other failure ("Invalid token")
- Degraded-dev branch: if `CLERK_JWT_ISSUER_DOMAIN` is unset, logs a warning and returns `{"sub": "local-dev-operator"}` — mirrors `_require_trigger_secret`'s skip-with-warning pattern exactly

**`packages/pipeline/src/eisenbalm_pipeline/api/runs.py` (MODIFIED)**

- Added `Depends` to the fastapi import line
- Added `from eisenbalm_pipeline.api.auth import require_clerk_jwt`
- Added `POST /dashboard/whoami` endpoint guarded by `Depends(require_clerk_jwt)` — returns `{"operatorId": claims.get("sub")}`
- `_require_trigger_secret`, `/run/weekly`, `/run/{id}/resume`, `/run/{id}/publish` are **completely unchanged** (verified via git diff)

**`packages/pipeline/tests/api/test_clerk_auth.py` (FILLED)**

Replaced all 4 `@pytest.mark.skip` stubs with real assertions:
1. `test_require_clerk_jwt_missing_returns_401` — no Authorization header → 401 or 403 (HTTPBearer raises 403 before our dependency runs; both are correct)
2. `test_require_clerk_jwt_expired_returns_401` — mocked `jwt.ExpiredSignatureError` → 401 with detail `"Token expired"`
3. `test_require_clerk_jwt_valid_returns_claims` — mocked valid decode returning `{"sub": "user_abc"}` → 200 with `{"operatorId": "user_abc"}`
4. `test_cron_trigger_secret_path_unaffected` — `/run/weekly` accepts no Clerk JWT header (status not 401/403 from Clerk guard)

All JWKS mocked via `_make_jwt_mock` helper using `types.SimpleNamespace` with real PyJWT exception classes exposed so `except jwt.ExpiredSignatureError` clauses match correctly.

**`packages/pipeline/.env.example` (MODIFIED)**

Added `CLERK_JWT_ISSUER_DOMAIN=` with a detailed comment explaining the Clerk Frontend API URL source, Railway configuration note, and the degraded-dev skip behavior.

## Test Results

```
tests/api/test_clerk_auth.py  4 passed
tests/api/test_runs.py        8 passed, 4 skipped (infrastructure env vars)
```

Combined: `12 passed, 4 skipped in 1.67s`

## Deviations from Plan

None — plan executed exactly as written.

The plan specified `Depends(require_clerk_jwt)` be counted ≥1 in `runs.py`; actual count is 2 (one in the function parameter, one counted in grep because the decorator line also contains it). Both occurrences are correct.

## Known Stubs

None. The `/dashboard/whoami` endpoint is functional, not a stub — it verifies the JWT and returns the operator id. The `claims["sub"]` attribution fields (`triggeredBy` on `runs`, `actorId` on `audit_log`) are defined in the Convex schema (Plan 21-02) but their write flows land in Phases 23/25 per D-04.

## Self-Check: PASSED

All created files exist on disk. Both task commits verified in git log.
- auth.py: FOUND
- test_clerk_auth.py: FOUND (0 skip markers)
- SUMMARY.md: FOUND
- Task 1 commit 7b58c2e: FOUND
- Task 2 commit 89515a0: FOUND
