"""Phase 49 (ROL-01/ROL-02, docs/API_CONTRACTS.md §49.4) — server-side role
gate coverage for the four FastAPI-gated actions:

  POST /issues/{run_id}/revise/apply                       (revision.py)
  POST /issues/{run_id}/claims/{claim_index}/evidence/apply (factcheck.py)
  POST /issues/{run_id}/sign-off  kind="sounds-human"       (signoffs.py)
  POST /issues/{run_id}/publish                             (review.py)

Proves:
  - a Collaborator-role token is rejected 403 {reason:"forbidden_role"} on
    all four routes.
  - an Editor-in-chief-role token reaches each route's normal
    success/precondition path (never 403).
  - the local-dev sentinel ({"sub":"local-dev-operator"}, CLERK_JWT_ISSUER_
    DOMAIN unset) still resolves to Editor-in-chief (D-04) — every existing
    header-free pipeline test stays green with zero edits.
  - facts-cleared sign-offs are NOT role-gated (only sounds-human is,
    §49.4/RESEARCH Open Question 2) — a Collaborator's facts-cleared call
    reaches its normal business-logic path (409 claims_not_signed_off here),
    proving the gate is scoped to kind=="sounds-human" only.

RED note (Task 1): at the time this file is authored, none of the four
routes are role-gated yet — the negative (Collaborator -> 403) assertions
FAIL until Task 2 wires `_require_editor` in. This is the expected RED
state; the facts-cleared-is-open case and the sentinel-regression cases are
expected to pass even at RED (they assert the absence of a 403).

Patch-target note (49-RESEARCH "Testing the rejection (FastAPI)"): reusing
`_make_jwt_mock` from test_clerk_auth.py's construction. Empirically verified
(see deviation log in 49-03-SUMMARY.md) that `_require_clerk_jwt_control`
(api/control.py) does a LOCAL `import jwt` inside its function body, not a
module-level import — so `monkeypatch.setattr(<control module>, "jwt", ...)`
has NO effect (the local import re-fetches straight from
`sys.modules['jwt']` at call time, ignoring any attribute set on the module
object). The correct, verified patch target is `sys.modules['jwt']` itself
(via `monkeypatch.setitem`), alongside
`eisenbalm_pipeline.api.auth._fetch_public_key` (which the local
`from eisenbalm_pipeline.api.auth import _fetch_public_key` DOES pick up,
since a `from X import Y` statement performs a live attribute lookup on the
module object at call time).
"""
from __future__ import annotations

import sys
import types
from unittest.mock import MagicMock

import jwt as _real_jwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from eisenbalm_pipeline.api.factcheck import router as factcheck_router
from eisenbalm_pipeline.api.review import router as review_router
from eisenbalm_pipeline.api.revision import router as revision_router
from eisenbalm_pipeline.api.signoffs import router as signoffs_router


# ── _make_jwt_mock — construction copied verbatim from
#    tests/api/test_clerk_auth.py (see that file for the canonical version) ─


def _make_jwt_mock(
    unverified_header: dict,
    decode_raises: Exception | None = None,
    decode_returns: dict | None = None,
):
    mock_mod = types.SimpleNamespace()

    def get_unverified_header(token):  # noqa: ARG001
        return unverified_header

    def decode(token, key, algorithms, options):  # noqa: ARG001
        if decode_raises is not None:
            raise decode_raises
        return decode_returns or {}

    mock_mod.get_unverified_header = get_unverified_header
    mock_mod.decode = decode
    mock_mod.ExpiredSignatureError = _real_jwt.ExpiredSignatureError
    mock_mod.DecodeError = _real_jwt.DecodeError
    mock_mod.InvalidTokenError = _real_jwt.InvalidTokenError
    return mock_mod


AUTH_HEADER = {"Authorization": "Bearer test.token.value"}


def _set_role_claims(monkeypatch, *, role: str | None, sub: str = "user_x"):
    """Force the non-degraded Clerk verification path with a mocked decode
    returning the given role claim (or no role key at all when role=None)."""
    monkeypatch.setenv("CLERK_JWT_ISSUER_DOMAIN", "https://example.clerk.accounts.dev")
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.auth._fetch_public_key", lambda kid: "dummy-key"
    )
    claims = {"sub": sub}
    if role is not None:
        claims["role"] = role
    monkeypatch.setitem(
        sys.modules,
        "jwt",
        _make_jwt_mock(
            unverified_header={"kid": "k1", "alg": "RS256"},
            decode_returns=claims,
        ),
    )


# ── Minimal per-router test apps (mirrors test_review_endpoints.py /
#    test_revision_endpoints.py / test_factcheck_endpoints.py /
#    test_signoffs_endpoints.py harnesses) ──────────────────────────────────


def _make_client(router) -> TestClient:
    app = FastAPI()
    app.include_router(router)
    app.state.convex_http = MagicMock()
    app.state.sanity_http = MagicMock()
    app.state.graph = None
    app.state.background_tasks = set()
    return TestClient(app, raise_server_exceptions=True)


_revision_client = _make_client(revision_router)
_factcheck_client = _make_client(factcheck_router)
_review_client = _make_client(review_router)
_signoffs_client = _make_client(signoffs_router)


def _post(client: TestClient, path: str, body: dict | None, headers: dict | None = None):
    kwargs: dict = {}
    if headers:
        kwargs["headers"] = headers
    if body is not None:
        kwargs["json"] = body
    return client.post(path, **kwargs)


def _wire_run_not_found(monkeypatch, module_path: str):
    """Universal 404-shortcut wiring for the three Depends-swap routes
    (revision/factcheck/review): mocks convex_query to return None for
    every path, so `_resolve_sanity_id` / the run lookup 404s cleanly the
    instant the handler body runs. Keeps positive/sentinel assertions
    (`!= 403`) deterministic without needing full business-logic wiring —
    a 404 is an explicitly tolerated positive-path outcome per the plan."""

    async def mock_convex_query(http, path, args):  # noqa: ARG001
        return None

    monkeypatch.setattr(f"{module_path}._cc.convex_query", mock_convex_query)


# ── The three Depends()-swap routes: revision, factcheck, review ──────────

_ROUTE_CASES = [
    (
        "apply_passage_revision",
        _revision_client,
        "eisenbalm_pipeline.api.revision",
        "/issues/run-abc/revise/apply",
        {
            "ifRevisionID": "rev-1",
            "sectionName": "founderBio",
            "quotedText": "Jane Doe grew up nearby",
            "newText": "a former county clerk",
        },
    ),
    (
        "apply_claim_evidence",
        _factcheck_client,
        "eisenbalm_pipeline.api.factcheck",
        "/issues/run-abc/claims/2/evidence/apply",
        {
            "ifRevisionID": "rev-1",
            "sourceUrl": "https://postandcourier.example/story",
            "retrievedAt": 555,
            "rewrittenClaim": "demand outpaces installations roughly four to one",
        },
    ),
    (
        "publish_issue",
        _review_client,
        "eisenbalm_pipeline.api.review",
        "/issues/run-abc/publish",
        None,
    ),
]

_ROUTE_IDS = [case[0] for case in _ROUTE_CASES]


@pytest.mark.parametrize("name,client,module_path,path,body", _ROUTE_CASES, ids=_ROUTE_IDS)
def test_collaborator_rejected_403(name, client, module_path, path, body, monkeypatch):
    """A Collaborator-role token is rejected server-side, 403 forbidden_role,
    BEFORE the handler body (and therefore any business logic) ever runs."""
    _wire_run_not_found(monkeypatch, module_path)
    _set_role_claims(monkeypatch, role="Collaborator", sub="user_collab")

    response = _post(client, path, body, headers=AUTH_HEADER)

    assert response.status_code == 403, (
        f"{name}: expected 403 for Collaborator, got {response.status_code}: {response.text}"
    )
    detail = response.json()["detail"]
    assert detail["reason"] == "forbidden_role", f"{name}: {detail}"


@pytest.mark.parametrize("name,client,module_path,path,body", _ROUTE_CASES, ids=_ROUTE_IDS)
def test_editor_reaches_normal_path(name, client, module_path, path, body, monkeypatch):
    """An Editor-in-chief-role token reaches the route's normal path — never
    403. (404 here is the expected/tolerated outcome since the run lookup
    is mocked to miss; the assertion under test is specifically `!= 403`.)"""
    _wire_run_not_found(monkeypatch, module_path)
    _set_role_claims(monkeypatch, role="Editor-in-chief", sub="user_editor")

    response = _post(client, path, body, headers=AUTH_HEADER)

    assert response.status_code != 403, (
        f"{name}: Editor-in-chief must not be rejected, got 403: {response.text}"
    )


@pytest.mark.parametrize("name,client,module_path,path,body", _ROUTE_CASES, ids=_ROUTE_IDS)
def test_sentinel_regression_not_403(name, client, module_path, path, body, monkeypatch):
    """D-04: with CLERK_JWT_ISSUER_DOMAIN unset, the local-dev sentinel
    ({"sub": "local-dev-operator"}) resolves to Editor-in-chief — every
    existing header-free test for these routes stays green unmodified."""
    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)
    _wire_run_not_found(monkeypatch, module_path)

    response = _post(client, path, body, headers=None)

    assert response.status_code != 403, (
        f"{name}: local-dev sentinel must not be rejected, got 403: {response.text}"
    )


# ── The in-handler-branch route: signoffs.py record_sign_off ─────────────
#
# Gate applies ONLY to kind=="sounds-human" (an in-handler branch, NOT a
# route-level Depends swap, since the route also handles kind=="facts-
# cleared", which must remain ungated per §49.4/D-06/RESEARCH Open Q2).


def _wire_signoffs(monkeypatch, *, all_signed_off: bool = True, findings: list | None = None):
    findings = findings if findings is not None else []

    async def mock_convex_query(http, path, args):  # noqa: ARG001
        if path == "pipelineRuns:byRunId":
            return {"status": "awaiting-review", "sanityIssueId": "issue-42", "runId": "run-abc"}
        if path == "claimChecks:allSignedOff":
            return {
                "total": 3,
                "signedOff": 3 if all_signed_off else 1,
                "allSignedOff": all_signed_off,
            }
        if path == "qaCorrections:byRunId":
            return findings
        return None

    async def mock_convex_mutation(http, path, args):  # noqa: ARG001
        return None

    monkeypatch.setattr(
        "eisenbalm_pipeline.api.signoffs._cc.convex_query", mock_convex_query
    )
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.signoffs._cc.convex_mutation", mock_convex_mutation
    )


def test_signoffs_sounds_human_rejects_collaborator(monkeypatch):
    _wire_signoffs(monkeypatch)
    _set_role_claims(monkeypatch, role="Collaborator", sub="user_collab")

    response = _signoffs_client.post(
        "/issues/run-abc/sign-off", json={"kind": "sounds-human"}, headers=AUTH_HEADER
    )

    assert response.status_code == 403, response.text
    assert response.json()["detail"]["reason"] == "forbidden_role"


def test_signoffs_sounds_human_accepts_editor(monkeypatch):
    _wire_signoffs(monkeypatch)
    _set_role_claims(monkeypatch, role="Editor-in-chief", sub="user_editor")

    response = _signoffs_client.post(
        "/issues/run-abc/sign-off", json={"kind": "sounds-human"}, headers=AUTH_HEADER
    )

    assert response.status_code != 403, response.text


def test_signoffs_sounds_human_sentinel_regression(monkeypatch):
    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)
    _wire_signoffs(monkeypatch)

    response = _signoffs_client.post(
        "/issues/run-abc/sign-off", json={"kind": "sounds-human"}
    )

    assert response.status_code != 403, response.text


def test_signoffs_facts_cleared_open_for_collaborator(monkeypatch):
    """facts-cleared is NOT among the six gated actions (D-06, RESEARCH Open
    Question 2) — a Collaborator's facts-cleared sign-off must reach its
    normal business-logic path (409 claims_not_signed_off here, since
    all_signed_off=False), never a role-based 403."""
    _wire_signoffs(monkeypatch, all_signed_off=False)
    _set_role_claims(monkeypatch, role="Collaborator", sub="user_collab")

    response = _signoffs_client.post(
        "/issues/run-abc/sign-off", json={"kind": "facts-cleared"}, headers=AUTH_HEADER
    )

    assert response.status_code == 409, response.text
    assert response.json()["detail"]["reason"] == "claims_not_signed_off"
