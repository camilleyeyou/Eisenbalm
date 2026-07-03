---
phase: 29-deployment-hardening-code-fixes
plan: 02
subsystem: pipeline-auth
tags: [fastapi, fail-closed, hmac, constant-time-compare, restart-reconciliation, langgraph, dependencies]

# Dependency graph
requires:
  - phase: 29-deployment-hardening-code-fixes
    plan: 01
    provides: central pipelineSecret injection in convex_client.py::convex_mutation (reconcile.py relies on this, adds no secret handling of its own)
provides:
  - "_deployed()/assert_deployed_secrets() helpers in api/auth.py — RAILWAY_ENVIRONMENT_NAME deployed-env marker"
  - "Fail-closed auth: require_clerk_jwt, _require_clerk_jwt_control, _require_operator, _require_trigger_secret all 500 in a deployed env instead of granting the local-dev-operator sentinel"
  - "Constant-time trigger-secret compare (hmac.compare_digest) in runs.py"
  - "api/reconcile.py::reconcile_orphaned_runs() startup sweep — unsticks Convex runs orphaned by a Railway restart"
  - "pyjwt + requests declared directly in pyproject.toml dependencies"
affects: [29-03, 29-04, 29-05, deployment, pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deployed-env marker gate (RAILWAY_ENVIRONMENT_NAME) wrapping the existing 'secret unset -> sentinel/skip' idiom: raise in a deployed env, keep the sentinel/skip in local dev — byte-for-byte regression-safe"
    - "Boot-time fail-fast placed OUTSIDE/BEFORE the lifespan's degraded-boot try/except so it cannot be swallowed into a healthy-looking degraded boot"
    - "Startup reconciliation sweep reusing existing termination mutations (no new Convex schema/function) for a single-process architecture where 'running' at boot == orphaned by definition"

key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/api/reconcile.py
    - packages/pipeline/tests/api/test_fail_closed.py
    - packages/pipeline/tests/api/test_reconciliation.py
  modified:
    - packages/pipeline/pyproject.toml
    - packages/pipeline/uv.lock
    - packages/pipeline/src/eisenbalm_pipeline/api/auth.py
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py
    - packages/pipeline/src/eisenbalm_pipeline/api/agents.py
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py

key-decisions:
  - "RAILWAY_ENVIRONMENT_NAME (not RAILWAY_ENVIRONMENT) is the deployed-env marker, per 29-RESEARCH.md's live verification against Railway's current variables reference — no existing test sets it, so gating fail-closed behind its presence keeps the pre-existing 354-test baseline green while closing the real vulnerability"
  - "assert_deployed_secrets() is called at the very top of main.py's lifespan, BEFORE and OUTSIDE the degraded-boot try/except, so a misconfigured deployed process cannot have its fatal error caught and logged as 'expected for local dev' and boot healthy anyway (plan-checker advisory fix)"
  - "D-3 correctness case + reconciliation edge-case tests landed in test_fail_closed.py / test_reconciliation.py rather than editing test_runs.py — the plan explicitly permitted this alternative location"
  - "Fixed a self-inflicted acceptance-criteria collision: reconcile.py's docstring originally said 'no new Convex schema' which itself matched the negative grep for the literal word 'schema' — reworded to 'no new Convex table' to keep the check meaningful"

requirements-completed: [D-2, D-3, D-4, D-5]

# Metrics
duration: ~7m
completed: 2026-07-03
---

# Phase 29 Plan 02: Pipeline Auth Fail-Closed + Constant-Time Compare + Restart Reconciliation + Deps Summary

**FastAPI auth guards now refuse traffic instead of opening the door in a Railway-deployed environment with a missing secret, the trigger-secret compare is timing-safe, a startup sweep unsticks any Convex run left "running" by a mid-run restart, and PyJWT/requests are declared as direct dependencies instead of riding transitively on a dead `supabase` package.**

## Performance

- **Duration:** ~7 min
- **Tasks:** 3
- **Files modified:** 10 (3 created, 7 modified)

## Accomplishments

- Added `pyjwt>=2.8.0` and `requests>=2.31.0` directly to `pyproject.toml`'s `[project.dependencies]` (both are imported directly in `api/auth.py`, previously only transitive via `supabase`/`tavily-python`) and re-ran `uv lock`.
- Added `_deployed()` (checks `RAILWAY_ENVIRONMENT_NAME`) and `assert_deployed_secrets()` (boot-time fail-fast requiring both `PIPELINE_TRIGGER_SECRET` and `CLERK_JWT_ISSUER_DOMAIN` when deployed) to `api/auth.py`.
- Wrapped all four fail-open sentinel/skip branches so each independently raises `HTTPException(500)` in a deployed environment instead of granting local-dev access: `auth.py::require_clerk_jwt`, `control.py::_require_clerk_jwt_control`, `agents.py::_require_operator`, `runs.py::_require_trigger_secret`. Local dev (marker absent) is byte-for-byte unchanged.
- Swapped `runs.py`'s trigger-secret comparison from `provided != expected` to `hmac.compare_digest(...)` (falsy-guard kept first, since `compare_digest(None, x)` raises `TypeError`).
- Added `api/reconcile.py::reconcile_orphaned_runs()` — queries `runs:listForWorkspace`, and for every row still `status == "running"` at boot (which, in this single-process architecture, is orphaned by definition), calls the SAME `runs:updateStatus` + `pipelineRuns:updateStatus` mutation pair `_execute_run`'s cancel/cost-cap path already uses. No new Convex table or function. Degrades to a logged warning + 0 on any Convex failure — never blocks boot.
- Wired both into `api/main.py`'s lifespan: `assert_deployed_secrets()` at the very top, outside the degraded-boot `try/except`; `reconcile_orphaned_runs(convex_http)` on the clean-boot path only, after `convex_client.set_client()`, before `yield`.
- Added 18 new unit tests across `test_fail_closed.py` (fail-closed + dev-mode regression for all four guards, plus D-3 constant-time-compare correctness) and `test_reconciliation.py` (orphan-only sweep, no-op when nothing orphaned, degrades on Convex query failure, keeps sweeping after one row's mutation fails).

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare deps (D-5) + fail-closed auth (D-2) + constant-time compare (D-3)** — `1b23588` (feat)
2. **Task 2: Restart reconciliation sweep (D-4) + wire into lifespan** — `12a3888` (feat)
3. **Task 3: Unit tests for fail-closed auth, constant-time compare, and reconciliation** — `751309e` (test)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified

- `packages/pipeline/pyproject.toml`, `uv.lock` — direct `pyjwt`/`requests` deps, re-locked (118 packages resolved).
- `packages/pipeline/src/eisenbalm_pipeline/api/auth.py` — `_deployed()`, `assert_deployed_secrets()`, `require_clerk_jwt` fail-closed branch.
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` — `_require_clerk_jwt_control` fail-closed branch (imports `_deployed`).
- `packages/pipeline/src/eisenbalm_pipeline/api/agents.py` — `_require_operator` fail-closed branch (imports `_deployed`).
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` — `_require_trigger_secret` fail-closed branch + `hmac.compare_digest` swap.
- `packages/pipeline/src/eisenbalm_pipeline/api/reconcile.py` — new: `reconcile_orphaned_runs()`.
- `packages/pipeline/src/eisenbalm_pipeline/api/main.py` — wires `assert_deployed_secrets()` (pre-try) and `reconcile_orphaned_runs()` (clean-boot path) into the lifespan.
- `packages/pipeline/tests/api/test_fail_closed.py` — new: 15 tests.
- `packages/pipeline/tests/api/test_reconciliation.py` — new: 4 tests.

## Decisions Made

- Followed 29-RESEARCH.md's corrected env-var name (`RAILWAY_ENVIRONMENT_NAME`, not the CONTEXT's `RAILWAY_ENVIRONMENT` guess) — verified live against Railway's current variables reference.
- Placed `assert_deployed_secrets()` before/outside the lifespan's blanket `try/except Exception`, per the plan's explicit fix for a plan-checker advisory: a genuinely misconfigured deployed process must not have its fatal boot error caught and logged as "expected for local dev" and then boot healthy anyway.
- Put the D-3 correctness test and all D-4 edge cases in `test_fail_closed.py`/`test_reconciliation.py` rather than editing `test_runs.py` — the plan explicitly allowed either location.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `reconcile.py`'s own docstring tripped its acceptance-criteria negative-grep**
- **Found during:** Task 2 verification
- **Issue:** The acceptance criterion `grep -c "internalMutation\|schema" packages/pipeline/src/eisenbalm_pipeline/api/reconcile.py` must equal 0 (proving no new Convex schema/function was added), but the file's own explanatory docstring used the literal phrase "no new Convex schema or function," which the same grep matched, producing a false-positive failure of the check.
- **Fix:** Reworded the docstring to "no new Convex table or function is added anywhere," preserving the same meaning without tripping the literal-string check.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/api/reconcile.py`
- **Verification:** `grep -c "internalMutation\|schema" .../reconcile.py` → 0.
- **Committed in:** `12a3888` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1, cosmetic — no functional change)
**Impact on plan:** None on behavior; purely a wording fix to satisfy the plan's own verification grep.

## Issues Encountered

None — all three tasks executed cleanly against a pre-verified codebase (Plan 01's Convex-side `pipelineSecret` injection was already in place and required no changes here).

## User Setup Required

None new. This plan ships code only; the external secret-provisioning steps flagged in Plan 01's summary (`PIPELINE_CONVEX_SECRET`, `STRIPE_TO_CONVEX_SECRET` on Convex/Railway/Vercel) are unrelated and still pending as documented there. Per 29-RESEARCH.md's own flagged caveat, a **manual post-deploy smoke check** is recommended once this ships to Railway: deliberately leave `PIPELINE_TRIGGER_SECRET` or `CLERK_JWT_ISSUER_DOMAIN` unset on a Railway preview/staging deploy and confirm the boot-time assertion actually prevents the service from reporting healthy (this cannot be verified locally, since `RAILWAY_ENVIRONMENT_NAME` is only ever auto-injected by Railway itself).

## Next Phase Readiness

- D-2/D-3/D-4/D-5 complete. Remaining Phase 29 plans (web route/dead-subs/checkout cleanup, ESLint/typecheck/favicon, env-var docs) are independent and unblocked.
- Full pipeline suite green: `uv run pytest -q` → 372 passed, 33 skipped (354 baseline + 18 new tests, 0 regressions).
- `uv run python -c "import jwt, requests"` exits 0; `uv lock` succeeded (118 packages resolved).
- Grep confirmations: `compare_digest` in `runs.py`, `RAILWAY_ENVIRONMENT_NAME` in both `auth.py` and `main.py`, `provided != expected` count is 0.

---
*Phase: 29-deployment-hardening-code-fixes*
*Completed: 2026-07-03*

## Self-Check: PASSED

- FOUND: packages/pipeline/src/eisenbalm_pipeline/api/reconcile.py
- FOUND: packages/pipeline/tests/api/test_fail_closed.py
- FOUND: packages/pipeline/tests/api/test_reconciliation.py
- FOUND: .planning/phases/29-deployment-hardening-code-fixes/29-02-SUMMARY.md
- FOUND commit: 1b23588 (Task 1)
- FOUND commit: 12a3888 (Task 2)
- FOUND commit: 751309e (Task 3)
