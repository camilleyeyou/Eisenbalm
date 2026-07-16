---
phase: 49-roles-permissions
plan: 03
subsystem: auth
tags: [fastapi, clerk, jwt, rbac, pytest]

# Dependency graph
requires:
  - phase: 49-roles-permissions (49-01)
    provides: "Contract-first §49 spec (users.role vocabulary, comments table shape, six-action gate inventory, rejection envelopes, verbatim locked labels) in docs/API_CONTRACTS.md"
provides:
  - "_require_editor FastAPI dependency (packages/pipeline/src/eisenbalm_pipeline/api/control.py), layered on _require_clerk_jwt_control, resolving role from the Clerk claims dict"
  - "Server-side role gate wired into three whole-route actions: apply_passage_revision (revision.py), apply_claim_evidence (factcheck.py), publish_issue (review.py) via Depends(_require_editor)"
  - "Server-side role gate wired into record_sign_off (signoffs.py) as an in-handler branch scoped to kind==\"sounds-human\" only — facts-cleared stays ungated"
  - "test_role_gate.py — 13 tests covering all four routes: Collaborator-rejected (403 forbidden_role), Editor-in-chief-accepted, local-dev-sentinel regression, and the facts-cleared-is-not-gated proof"
affects: [49-04-convex-editor-gate, 49-06-role-hook-lockedcontrol, 49-07-wire-locked-controls, 49-09-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Authorization dependency layered on an existing authentication dependency (Depends(_require_editor) wraps Depends(_require_clerk_jwt_control) via FastAPI's dependency-of-a-dependency resolution) rather than duplicating the JWT-decode logic"
    - "In-handler role branch (not a route-level Depends swap) for an endpoint that serves two different authorization requirements on the same route, keyed off a request-body discriminator (kind)"

key-files:
  created:
    - packages/pipeline/tests/api/test_role_gate.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py
    - packages/pipeline/src/eisenbalm_pipeline/api/revision.py
    - packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py
    - packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py
    - packages/pipeline/src/eisenbalm_pipeline/api/review.py

key-decisions:
  - "Monkeypatch target for `jwt` in tests is sys.modules['jwt'] (via monkeypatch.setitem), not the control module's `jwt` attribute — _require_clerk_jwt_control does a LOCAL `import jwt` inside its function body, which re-fetches from sys.modules at call time regardless of any attribute set on the module object (empirically verified, documented inline in the test file)."
  - "Positive/sentinel test cases for the three Depends-swap routes tolerate a 404 (run-not-found, via a universal convex_query->None mock) as the 'reached normal path' proof, per the plan's explicit tolerance for 200/404/409 — avoids needing full business-logic wiring just to prove `!= 403`."
  - "signoffs.py's role check is placed as the first statement inside the `elif body.kind == 'sounds-human':` branch, before its existing open-voice-findings guard, so a Collaborator is rejected before any Convex read for that kind — facts-cleared is architecturally unreachable by this branch and therefore provably ungated."

requirements-completed: [ROL-01, ROL-02]

# Metrics
duration: 20min
completed: 2026-07-16
---

# Phase 49 Plan 03: FastAPI Editor Gate Summary

**Added `_require_editor`, a role-authorization FastAPI dependency layered on the existing Clerk-JWT authentication, and wired it into the three whole-route actions (apply revision, apply claim evidence, publish) plus an in-handler branch on the sign-off endpoint scoped to `kind=="sounds-human"` only — proven by a new 13-case `test_role_gate.py` and a zero-regression full pipeline suite run (692 passed, up from a 679 baseline).**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3/3 completed
- **Files modified:** 5 (+1 new test file)

## Accomplishments
- `_require_editor` added in `control.py`: returns claims unchanged for the local-dev sentinel (`{"sub":"local-dev-operator"}`, D-04) or for a real identity carrying `role=="Editor-in-chief"`; otherwise raises `HTTPException(403, {"reason":"forbidden_role","message":"Editor-in-chief only."})`.
- Three FastAPI routes (`apply_passage_revision`, `apply_claim_evidence`, `publish_issue`) swapped from `Depends(_require_clerk_jwt_control)` to `Depends(_require_editor)` — one-line changes plus one import addition each.
- `record_sign_off` (signoffs.py) gates `kind=="sounds-human"` via an in-handler branch (route-level `Depends(_require_clerk_jwt_control)` unchanged, since `kind=="facts-cleared"` on the same route stays open to Collaborators per D-06/RESEARCH Open Question 2).
- `test_role_gate.py` (13 tests): Collaborator → 403 `forbidden_role` on all four actions; Editor-in-chief → reaches normal path (never 403); local-dev sentinel (no `CLERK_JWT_ISSUER_DOMAIN`) → never 403 (D-04 regression guard); facts-cleared + Collaborator → reaches its normal 409 business-logic path (proves the gate is scoped to `sounds-human` only, not the whole route).
- Full pipeline suite: 692 passed (was 679 before this plan — exactly +13, the new file's case count), 0 failures, 0 pre-existing test files edited.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write test_role_gate.py (RED)** - `71403e9` (test)
2. **Task 2: Add _require_editor and wire the four handlers (GREEN)** - `b2a31d4` (feat)
3. **Task 3: Confirm zero regression across the existing pipeline suite** - no code change; verification-only (see below)

**Plan metadata:** (this commit)

## Files Created/Modified
- `packages/pipeline/tests/api/test_role_gate.py` - New: 13 tests covering the four gated actions (Collaborator-rejected, Editor-accepted, sentinel-regression, facts-cleared-open)
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` - Added `_require_editor` dependency (layered on `_require_clerk_jwt_control`)
- `packages/pipeline/src/eisenbalm_pipeline/api/revision.py` - `apply_passage_revision`: `Depends(_require_clerk_jwt_control)` → `Depends(_require_editor)` + import
- `packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py` - `apply_claim_evidence`: same swap + import
- `packages/pipeline/src/eisenbalm_pipeline/api/review.py` - `publish_issue`: same swap + import; docstring updated to reflect the mixed guard (schedule/reject stay on `_require_clerk_jwt_control`, publish additionally requires Editor-in-chief)
- `packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py` - `record_sign_off`: added in-handler role check at the top of the `kind=="sounds-human"` branch only

## Decisions Made
- Reused the existing `_make_jwt_mock` construction (copied, not cross-imported, from `test_clerk_auth.py`) to avoid cross-test-module import fragility while keeping the exact same mocking shape.
- Used a universal `convex_query -> None` mock (yielding a clean 404 "run not found") as the deterministic "reached normal path" proof for the three Depends-swap routes' positive/sentinel cases, rather than fully wiring each route's success path — the plan explicitly tolerates 200/404/409 for these assertions, and 404 is both simpler to set up and avoids MagicMock-await crashes from an unmocked `convex_http`.
- For signoffs.py, wired `pipelineRuns:byRunId` to return a valid run for all signoffs test cases (rather than 404-shortcutting there too), since the role gate is *inside* the handler after the run lookup — a 404-shortcut would prevent ever reaching the branch under test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's suggested test monkeypatch target for `jwt` does not work; patched `sys.modules['jwt']` instead**
- **Found during:** Task 1 (writing test_role_gate.py)
- **Issue:** The plan's `<action>` block instructed patching `eisenbalm_pipeline.api.control.jwt`. Empirically verified (small standalone repro script) that this has NO effect: `_require_clerk_jwt_control` does a **local** `import jwt` statement inside its function body (not a module-level import), and a local `import jwt` statement, when executed, fetches the module fresh from `sys.modules` and binds it to a local variable — it does not consult the enclosing module's `__dict__` for a pre-existing `jwt` attribute at all. Only `monkeypatch.setattr("eisenbalm_pipeline.api.auth._fetch_public_key", ...)` works as literally described, because that's a `from X import Y` statement, which does perform a live attribute lookup on the module object at call time.
- **Fix:** Patched `sys.modules['jwt']` via `monkeypatch.setitem(sys.modules, "jwt", mock_mod)` instead of `control_mod.jwt`. Documented the reasoning inline in `test_role_gate.py`'s module docstring and the `_set_role_claims` helper's docstring, per the RESEARCH doc's own explicit warning ("verify the exact patch target against the live implementation when the plan writes this test, don't copy this path blindly").
- **Files modified:** `packages/pipeline/tests/api/test_role_gate.py`
- **Verification:** `uv run pytest tests/api/test_role_gate.py -q` — 13/13 passing at GREEN; 4/13 failing (the negative cases) at RED, exactly as expected.
- **Committed in:** `71403e9` (Task 1 commit)

**2. [Rule 1 - Bug] Docstring addition inflated the `Depends(_require_editor)` grep count in review.py**
- **Found during:** Task 2 (verifying acceptance criteria)
- **Issue:** An initial docstring update to `review.py` mentioned the literal string `Depends(_require_editor)` for documentation purposes, which made `grep -c "Depends(_require_editor)" review.py` return 2 instead of 1, breaking the plan's exact-sum-of-3 acceptance check across the three routes.
- **Fix:** Reworded the docstring to say "the `_require_editor` dependency" instead of the literal `Depends(...)` call syntax, restoring the grep sum to exactly 3.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/api/review.py`
- **Verification:** `grep -rc "Depends(_require_editor)" revision.py factcheck.py review.py` sums to 3.
- **Committed in:** `b2a31d4` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bug-class — both test/verification-tooling corrections, no production-logic changes beyond what the plan specified).
**Impact on plan:** No scope creep; both deviations were corrections needed to make the plan's own literal instructions actually work/verify as written.

## Issues Encountered
None beyond the two deviations above.

## User Setup Required
None - no external service configuration required. (The Clerk-side JWT claim/template configuration this plan's gate depends on at runtime is out of scope for 49-03 — it was addressed/verified in 49-02, and this plan's tests mock the decoded claims directly rather than requiring a live Clerk session.)

## Next Phase Readiness
- The FastAPI half of ROL-01/ROL-02 (four actions) is server-enforced and tested. The Convex half (two mutations: `promptVersions.activate`, `charities.setStatus`) remains for Plan 49-04.
- `_require_editor`'s rejection shape (`{"reason":"forbidden_role","message":"Editor-in-chief only."}`) matches docs/API_CONTRACTS.md §49.4 exactly — safe for Plan 49-07 (wiring locked controls) to reference when mapping server rejections to UI states.
- No blockers.

---
*Phase: 49-roles-permissions*
*Completed: 2026-07-16*

## Self-Check: PASSED

All 6 changed/created source files present on disk; both task commits (`71403e9`, `b2a31d4`) found in git history.
