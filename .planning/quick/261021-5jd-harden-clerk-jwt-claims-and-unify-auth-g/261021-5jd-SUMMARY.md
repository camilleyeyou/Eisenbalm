---
phase: quick-261021-5jd
plan: 01
subsystem: pipeline-auth
tags: [clerk, jwt, fastapi, security]
key-files:
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/auth.py
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py
    - packages/pipeline/src/eisenbalm_pipeline/api/agents.py
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py
    - packages/pipeline/tests/api/test_clerk_auth.py
    - packages/pipeline/tests/api/test_role_gate.py
    - packages/pipeline/tests/test_publish_bridge.py
  created:
    - packages/pipeline/tests/api/test_clerk_verify_real.py
metrics:
  completed: 2026-10-21
---

# Quick 261021-5jd: Harden Clerk JWT claims and unify auth guards

One shared `auth.verify_clerk_token` now enforces issuer match, required `exp`/`iat`/`sub`, 30s leeway, and an `azp` allowlist (DASHBOARD_ALLOWED_ORIGINS, only when both azp and the env are present). It is the only Clerk `jwt.decode` call site; `require_clerk_jwt`, `_require_clerk_jwt_control` and `_require_operator` are thin wrappers using `dev_mode_claims()` (local-dev sentinel / deployed 500 unchanged).

## Commits
- bec5de66 test: failing real-crypto tests (RED)
- b69d6dea fix: shared verifier, thin guards, adapted fakes (GREEN)

## RED result
`test_clerk_verify_real.py`: 12 failed, 23 passed. Failures: wrong issuer, missing sub/exp/iat, azp not allowed, and expired-within-leeway (x2 guards each). Valid, expired, wrong-key, HS256, azp-allowed/absent/skipped, trailing slash, and dev-sentinel cases already passed.

## Final results
- `tests/api tests/test_publish_bridge.py`: 109 passed, 12 skipped (74 baseline + 35 new)
- full `tests`: 883 passed, 38 skipped, 0 failures

## Deviations
- [Rule 3] Removed unused imports (`os` etc.) via `ruff --fix` in control.py/agents.py after the refactor.
- Test fakes adapted as planned (decode signature accepts kwargs; sys.modules jwt patch replaced by `auth.jwt` patch; test_role_gate docstring updated).

## Railway deploy checks (not performed; no deploy)
- `CLERK_JWT_ISSUER_DOMAIN` must equal the session token `iss` exactly (trailing slash tolerated), e.g. `https://<slug>.clerk.accounts.dev` or `https://clerk.<domain>`. Decode a live dashboard token to confirm, or every dashboard call will 401.
- `DASHBOARD_ALLOWED_ORIGINS` must include the exact dispatch-control origin(s); otherwise tokens carrying `azp` get 401.

## Self-Check: PASSED
