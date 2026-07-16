---
phase: 49-roles-permissions
plan: 03
type: execute
wave: 2
depends_on: ["49-01"]
files_modified:
  - packages/pipeline/tests/api/test_role_gate.py
  - packages/pipeline/src/eisenbalm_pipeline/api/control.py
  - packages/pipeline/src/eisenbalm_pipeline/api/revision.py
  - packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py
  - packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py
  - packages/pipeline/src/eisenbalm_pipeline/api/review.py
autonomous: true
requirements: [ROL-01, ROL-02]

must_haves:
  truths:
    - "A Collaborator-role token calling apply revision, apply claim evidence, publish, or a sounds-human sign-off is rejected server-side with HTTP 403 {reason:'forbidden_role'}."
    - "An Editor-in-chief-role token reaches each route's normal success/precondition path (not 403)."
    - "The local-dev sentinel {'sub':'local-dev-operator'} still resolves to Editor-in-chief, so every existing header-free pipeline test stays green with zero edits."
    - "facts-cleared sign-offs are NOT role-gated (only sounds-human is) — the signoffs gate is an in-handler branch, not a route Depends swap."
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/control.py"
      provides: "_require_editor dependency layered on _require_clerk_jwt_control"
      contains: "async def _require_editor"
    - path: "packages/pipeline/tests/api/test_role_gate.py"
      provides: "positive + negative + sentinel-regression coverage for all 4 FastAPI gated routes"
      contains: "forbidden_role"
  key_links:
    - from: "revision.py / factcheck.py / review.py route handlers"
      to: "_require_editor"
      via: "Depends(_require_editor) replacing Depends(_require_clerk_jwt_control)"
      pattern: "Depends\\(_require_editor\\)"
    - from: "signoffs.py record_sign_off"
      to: "_require_editor (in-handler, kind=='sounds-human' only)"
      via: "conditional role check inside the handler, NOT a Depends swap"
      pattern: "sounds-human"
---

<objective>
Add role authorization to the four FastAPI-gated actions. Test-first: write `test_role_gate.py` (RED — the routes are not yet gated), then add `_require_editor` in control.py and wire it into the four handlers (three via `Depends` swap, sign-offs via an in-handler branch scoped to `kind=="sounds-human"`).

Purpose: ROL-01/ROL-02 on the FastAPI surface. Additive authorization on top of the existing `_require_clerk_jwt_control` authentication — do NOT regress the write-boundary / `_emit_audit` / sign-off-revocation pattern.
Output: `_require_editor` in control.py; four handlers gated; a single `test_role_gate.py` proving all four reject a Collaborator.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/49-roles-permissions/49-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
From control.py:83 — the base auth dependency _require_editor layers on (returns the decoded `claims` dict; sentinel `{"sub":"local-dev-operator"}` when CLERK_JWT_ISSUER_DOMAIN unset):
```python
async def _require_clerk_jwt_control(credentials=Depends(_optional_bearer)) -> dict: ...
```
Existing gated handler signatures (each already imports _require_clerk_jwt_control + _emit_audit from api.control):
```python
# revision.py:355
async def apply_passage_revision(request, run_id, body, claims: dict = Depends(_require_clerk_jwt_control)) -> dict
# factcheck.py:546
async def apply_claim_evidence(request, run_id, claim_index, body, claims: dict = Depends(_require_clerk_jwt_control)) -> dict
# review.py:67
async def publish_issue(request, run_id, claims: dict = Depends(_require_clerk_jwt_control)) -> dict
# signoffs.py:55 — handles BOTH kinds; gate ONLY kind=="sounds-human"
async def record_sign_off(request, run_id, body, claims: dict = Depends(_require_clerk_jwt_control)) -> dict
```
Test helper to reuse verbatim: packages/pipeline/tests/api/test_clerk_auth.py :: _make_jwt_mock(unverified_header=..., decode_returns=...)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write test_role_gate.py (RED) — all 4 FastAPI routes</name>
  <files>packages/pipeline/tests/api/test_role_gate.py</files>
  <read_first>
    - packages/pipeline/tests/api/test_clerk_auth.py (the `_make_jwt_mock` helper + how it monkeypatches `jwt` and `_fetch_public_key`)
    - .planning/phases/49-roles-permissions/49-RESEARCH.md "### Testing the rejection (FastAPI)" code example + the note about the correct monkeypatch target for `jwt`
    - packages/pipeline/tests/test_control.py and tests/api/test_review_endpoints.py, test_signoffs_endpoints.py, test_revision_endpoints.py, test_factcheck_endpoints.py (how each route's client + request body is constructed — reuse their fixtures/bodies)
  </read_first>
  <behavior>
    For EACH of the 4 routes (`POST /issues/{run_id}/revise/apply`, `POST /issues/{run_id}/claims/{i}/evidence/apply`, `POST /issues/{run_id}/sign-off` with kind="sounds-human", `POST /issues/{run_id}/publish`):
    - NEGATIVE (SC-1 proof): CLERK_JWT_ISSUER_DOMAIN set + mocked decode returns `{"sub":"user_collab","role":"Collaborator"}` → status 403 AND `r.json()["detail"]["reason"] == "forbidden_role"`.
    - POSITIVE: same setup, decode returns `{"sub":"user_x","role":"Editor-in-chief"}` → NOT 403 (route reaches its normal path — assert `!= 403`, tolerate 200/404/409 depending on seed state).
    - SENTINEL REGRESSION (D-04): CLERK_JWT_ISSUER_DOMAIN unset → NOT 403 (sentinel resolves to Editor-in-chief).
    Also a sign-offs-specific case: kind="facts-cleared" with role="Collaborator" → NOT 403 (facts-cleared is NOT among the six; only sounds-human is gated).
  </behavior>
  <action>
    Create packages/pipeline/tests/api/test_role_gate.py. Reuse `_make_jwt_mock` from test_clerk_auth.py verbatim (import it or copy its construction). Parametrize across the 4 routes where practical; keep the sign-offs facts-cleared-is-open case explicit. Follow the RESEARCH note: the monkeypatch target for `jwt` must match where `_require_editor`'s claims resolution imports it (control.py does its own local `import jwt`) — patch `eisenbalm_pipeline.api.control.jwt` and `eisenbalm_pipeline.api.auth._fetch_public_key`. Tests are RED now (routes not yet gated → the negative cases return 200/normal, not 403).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/api/test_role_gate.py -q ; test $? -ne 0</automated>
  </verify>
  <acceptance_criteria>
    - File `packages/pipeline/tests/api/test_role_gate.py` exists and imports/reconstructs `_make_jwt_mock`.
    - It asserts `detail.reason == "forbidden_role"` for a Collaborator on all 4 routes.
    - It includes the sentinel-unset regression case and the facts-cleared-open case.
    - Running it now FAILS (RED) on the negative assertions (the gate is not implemented yet).
  </acceptance_criteria>
  <done>test_role_gate.py exists, is RED, and encodes the negative/positive/sentinel/facts-cleared behaviors above.</done>
</task>

<task type="auto">
  <name>Task 2: Add _require_editor and wire the four handlers (GREEN)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/control.py, packages/pipeline/src/eisenbalm_pipeline/api/revision.py, packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py, packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py, packages/pipeline/src/eisenbalm_pipeline/api/review.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py lines 77-133 (_require_clerk_jwt_control — the base it layers on) and the imports block
    - packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py lines 55-120 (record_sign_off — the kind branches, so the gate goes on the sounds-human branch)
    - docs/API_CONTRACTS.md §49.4 (the exact rejection shape + which handler uses which mechanism)
    - .planning/phases/49-roles-permissions/49-RESEARCH.md "### Pitfall 5" (do NOT layer on agents.py::_require_operator — layer on _require_clerk_jwt_control)
  </read_first>
  <action>
    In control.py, add (near _require_clerk_jwt_control):
    ```python
    async def _require_editor(claims: dict = Depends(_require_clerk_jwt_control)) -> dict:
        """Authorization (not authentication) layered on _require_clerk_jwt_control.
        Local-dev sentinel resolves to Editor-in-chief (D-04) so header-free tests pass.
        A real deployed identity must carry role == 'Editor-in-chief'."""
        if claims.get("sub") == "local-dev-operator":
            return claims
        if claims.get("role") != "Editor-in-chief":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"reason": "forbidden_role", "message": "Editor-in-chief only."},
            )
        return claims
    ```
    Then:
    - revision.py:355 apply_passage_revision — change `claims: dict = Depends(_require_clerk_jwt_control)` → `Depends(_require_editor)`; add `_require_editor` to the existing `from ...api.control import ...` line.
    - factcheck.py:546 apply_claim_evidence — same one-line Depends swap + import.
    - review.py:67 publish_issue — same one-line Depends swap + import.
    - signoffs.py:55 record_sign_off — DO NOT swap the route Depends (it handles BOTH kinds). Keep `Depends(_require_clerk_jwt_control)`. Inside the handler, at the `kind == "sounds-human"` branch, add BEFORE its existing guards:
      ```python
      if body.kind == "sounds-human" and claims.get("sub") != "local-dev-operator" and claims.get("role") != "Editor-in-chief":
          raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"reason": "forbidden_role", "message": "Editor-in-chief only."})
      ```
      (facts-cleared stays open — it is not one of the six.) Import `status`/`HTTPException` if not already imported in signoffs.py.
    Do not touch `_emit_audit`, the sign-off-revocation, or the write-boundary logic — the gate runs BEFORE those, and only adds a rejection path.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/api/test_role_gate.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "async def _require_editor" packages/pipeline/src/eisenbalm_pipeline/api/control.py` == 1.
    - `grep -rc "Depends(_require_editor)" packages/pipeline/src/eisenbalm_pipeline/api/revision.py packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py packages/pipeline/src/eisenbalm_pipeline/api/review.py` sums to exactly 3 (one per route).
    - `grep -c "Depends(_require_editor)" packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py` == 0 (sign-offs gates in-handler, not via Depends).
    - `cd packages/pipeline && uv run pytest tests/api/test_role_gate.py -x -q` exits 0 (all negative/positive/sentinel/facts-cleared cases pass — GREEN).
  </acceptance_criteria>
  <done>_require_editor exists; three routes swapped to it; sign-offs gated in-handler for sounds-human only; test_role_gate.py is GREEN.</done>
</task>

<task type="auto">
  <name>Task 3: Confirm zero regression across the existing pipeline suite</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/control.py</files>
  <read_first>
    - .planning/phases/49-roles-permissions/49-RESEARCH.md "### Pitfall 2" (the sentinel keeps ~15 existing tests green with zero edits)
    - .planning/phases/49-roles-permissions/49-VALIDATION.md "Full suite command"
  </read_first>
  <action>
    Run the full pipeline suite to prove the additive gate broke nothing (the local-dev sentinel path means the existing route tests — test_review_endpoints, test_signoffs_endpoints, test_revision_endpoints, test_factcheck_endpoints, test_control — all still pass unchanged). If anything regressed, the sentinel special-case in `_require_editor` (or the signoffs in-handler branch) is wrong — fix it, do NOT edit the existing route tests to accommodate.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `cd packages/pipeline && uv run pytest -x -q` exits 0 (baseline was 679 passing per RESEARCH; new count = 679 + the new test_role_gate.py cases).
    - No pre-existing route test file was edited to make it pass (git diff shows only test_role_gate.py added + the 5 api/*.py files changed).
  </acceptance_criteria>
  <done>Full pipeline suite green; no existing test modified.</done>
</task>

</tasks>

<verification>
- `test_role_gate.py` proves all 4 routes reject a Collaborator (403 forbidden_role), accept an Editor, and honor the sentinel.
- facts-cleared sign-offs remain open; only sounds-human is gated.
- Full pipeline suite green with zero edits to existing route tests.
</verification>

<success_criteria>
The four FastAPI-gated actions reject a Collaborator's direct call server-side with a structured 403, an Editor passes, and local dev/tests are unaffected (ROL-01/ROL-02, FastAPI surface).
</success_criteria>

<output>
After completion, create `.planning/phases/49-roles-permissions/49-03-SUMMARY.md`.
</output>
