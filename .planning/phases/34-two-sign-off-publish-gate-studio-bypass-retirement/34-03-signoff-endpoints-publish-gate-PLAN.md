---
phase: 34-two-sign-off-publish-gate-studio-bypass-retirement
plan: 03
type: execute
wave: 2
depends_on: [34-01]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py
  - packages/pipeline/src/eisenbalm_pipeline/api/review.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
  - packages/pipeline/src/eisenbalm_pipeline/api/main.py
  - packages/pipeline/tests/test_signoffs_endpoints.py
  - packages/pipeline/tests/test_review_endpoints.py
autonomous: true
requirements: [PUB-01, PUB-04]

must_haves:
  truths:
    - "POST /issues/{run_id}/sign-off records a facts-cleared or sounds-human sign-off; facts-cleared 409s on unsigned claims or open error findings; sounds-human is ungated"
    - "publish_issue and schedule_issue 409 missing_signoffs unless BOTH sign-offs are active, and no longer gate directly on claims/error findings"
    - "signOffs:record and signOffs:revokeAll are in _PIPELINE_SECRET_GUARDED_PATHS"
    - "Every sign-off record writes one auditLog row"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py"
      provides: "POST /issues/{run_id}/sign-off with relocated facts prerequisites"
      exports: ["router"]
    - path: "packages/pipeline/tests/test_signoffs_endpoints.py"
      provides: "sign-off endpoint matrix incl. facts prerequisite 409s and 422 invalid kind"
      contains: "missing_signoffs OR claims_not_signed_off"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py"
      to: "signOffs:record"
      via: "_cc.convex_mutation"
      pattern: "signOffs:record"
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/review.py::publish_issue"
      to: "signOffs:activeByRunId"
      via: "missing_signoffs gate"
      pattern: "missing_signoffs"
---

<objective>
Build the server gate: a new `api/signoffs.py` router with `POST /issues/{run_id}/sign-off` (D-01/D-05/D-06 — facts-cleared carries the relocated claims + open-error prerequisites; sounds-human is ungated), the publish/schedule gate restructure in `review.py` (D-04/D-09 — the two relocated checks come OUT, one `missing_signoffs` guard goes IN), the two new secret-guarded paths, and router registration. Fully covered by pytest.

Purpose: This is where "server refuses; UI merely explains" for the two-sign-off gate lives. Publishing/scheduling now depends on both attestations being active, and the machine-checkable facts prerequisites gate the RECORDING of facts-cleared, not publishing directly — one clean 409 story at publish time.
Output: One new router + gate edits + guarded-path additions + registration, with a new sign-off test module and extended review tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-CONTEXT.md
@.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- Verified pipeline primitives the sign-off endpoint + gate compose. -->
From packages/pipeline/src/eisenbalm_pipeline/api/control.py:
```python
def _require_clerk_jwt_control(...)   # Depends() auth guard; dev-mode sentinel -> claims["sub"]="local-dev-operator"
async def _emit_audit(http, *, actor_id, action, resource_type=None, resource_id=None, before=None, after=None)  # non-blocking
```
From packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py:
```python
import eisenbalm_pipeline.lib.convex_client as _cc
async def convex_query(http, path, args) -> Any
async def convex_mutation(http, path, args) -> Any   # injects pipelineSecret ONLY for _PIPELINE_SECRET_GUARDED_PATHS
_PIPELINE_SECRET_GUARDED_PATHS = frozenset({ "reviewActions:record", "auditLog:record", "qaCorrections:setResolution", ... })
```
Existing review.py Convex reads (relocate these OUT of publish/schedule, INTO the facts-cleared sign-off):
```python
signoff = await _cc.convex_query(http, "claimChecks:allSignedOff", {"runId": run_id}) or {}
# -> 409 {"reason":"claims_not_signed_off", ...} when not signoff.get("allSignedOff")
findings = await _cc.convex_query(http, "qaCorrections:byRunId", {"runId": run_id}) or []
open_errors = [f for f in findings if f.get("severity") == "error" and not f.get("resolution")]
# -> 409 {"reason":"open_error_findings", "count": n, ...}
```
New gate read (goes INTO publish_issue + schedule_issue, from §34.4):
```python
active = await _cc.convex_query(http, "signOffs:activeByRunId", {"runId": run_id}) or {}
missing = [k for k in ("facts-cleared", "sounds-human") if k not in active]
```
main.py router registration pattern (mirror for signoffs):
```python
from eisenbalm_pipeline.api import (agents, content, control, findings, health, review, runs, webhooks)
app.include_router(findings.router)   # add signoffs.router the same way
```
Convex function paths this plan calls (frozen §34.2): signOffs:record, signOffs:activeByRunId.
WORKSPACE_ID = "eisenbalm" (module const in review.py).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: api/signoffs.py — POST /issues/{run_id}/sign-off with relocated facts prerequisites</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/review.py (lines 62-152 — publish_issue's run-lookup 404, the claims_not_signed_off gate at 106-117, and the open_error_findings gate at 119-141; these two gate BLOCKS are the code you relocate verbatim into the facts-cleared branch)
    - packages/pipeline/src/eisenbalm_pipeline/api/findings.py (lines 1-107 — the router + Clerk-JWT-guard + _emit_audit import pattern to clone; the module shape signoffs.py mirrors)
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py (_require_clerk_jwt_control + _emit_audit signatures)
    - packages/pipeline/tests/test_review_endpoints.py (the TestClient + monkeypatch(_cc.convex_query / _cc.convex_mutation) harness to clone for the new test module)
    - docs/API_CONTRACTS.md §34.3 (frozen endpoint flow, body, 409 reasons, return shape)
  </read_first>
  <behavior>
    - POST sign-off {kind:"facts-cleared"} with all claims signed + no open error findings → 200 {runId, kind:"facts-cleared", signedAt}; calls signOffs:record; writes one audit row action="signoff.recorded".
    - POST sign-off {kind:"facts-cleared"} when claimChecks:allSignedOff is false → 409 {reason:"claims_not_signed_off"}; does NOT call signOffs:record.
    - POST sign-off {kind:"facts-cleared"} with an unresolved error-severity finding (incl. an orphaned one, resolution absent) → 409 {reason:"open_error_findings", count:n}; does NOT record.
    - POST sign-off {kind:"sounds-human"} → 200 with NO prerequisite checks (ungated, D-06); records + audits.
    - POST sign-off {kind:"bogus"} → 422 (Pydantic Literal rejects).
    - POST sign-off for a nonexistent run → 404.
  </behavior>
  <action>
Create `packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py` with `router = APIRouter()`, `WORKSPACE_ID = "eisenbalm"`, `log = logging.getLogger(__name__)`, imports `import eisenbalm_pipeline.lib.convex_client as _cc`, `from eisenbalm_pipeline.api.control import _emit_audit, _require_clerk_jwt_control`, and a Pydantic body model:
```python
class _SignOffBody(BaseModel):
    kind: Literal["facts-cleared", "sounds-human"]
```
Implement `POST /issues/{run_id}/sign-off` (Clerk-JWT-guarded) exactly per §34.3:
1. `http = getattr(request.app.state, "convex_http", None)`; `actor = claims.get("sub") or "unknown"`.
2. Run lookup: `run = await _cc.convex_query(http, "pipelineRuns:byRunId", {"runId": run_id})`; `None` → 404.
3. If `body.kind == "facts-cleared"`: relocate the two BLOCKS from review.py verbatim —
   - `signoff = await _cc.convex_query(http, "claimChecks:allSignedOff", {"runId": run_id}) or {}`; if not `signoff.get("allSignedOff")` → 409 `{"reason":"claims_not_signed_off","message":"All claim checks must be signed off before clearing facts."}`.
   - `findings = await _cc.convex_query(http, "qaCorrections:byRunId", {"runId": run_id}) or []`; `open_errors = [f for f in findings if f.get("severity") == "error" and not f.get("resolution")]`; if `open_errors` → 409 `{"reason":"open_error_findings","message":f"{len(open_errors)} error finding(s) must be accepted or dismissed before clearing facts.","count":len(open_errors)}`. (Anchor-blind D-11b — orphaned error findings still block.)
   (For `kind == "sounds-human"`: NO prerequisite checks — D-06.)
4. Record: `await _cc.convex_mutation(http, "signOffs:record", {"workspace_id": WORKSPACE_ID, "runId": run_id, "kind": body.kind, "actorId": actor})`.
5. Audit: `await _emit_audit(http, actor_id=actor, action="signoff.recorded", resource_type="run", resource_id=f"{run_id}:{body.kind}")`.
6. Return `{"runId": run_id, "kind": body.kind, "signedAt": int(time.time() * 1000)}`.
Do NOT add a manual revoke endpoint (revocation is D-08 auto-only). Do NOT add any override path (D-03).

Create `packages/pipeline/tests/test_signoffs_endpoints.py` cloning the test_review_endpoints.py harness (build a FastAPI app including signoffs.router; set app.state.convex_http = MagicMock; monkeypatch `eisenbalm_pipeline.lib.convex_client.convex_query` / `convex_mutation` via `_cc` module attribute so `pipelineRuns:byRunId`, `claimChecks:allSignedOff`, `qaCorrections:byRunId` return the fixtures each case needs, and assert `signOffs:record` is / isn't called). Cover all six behaviors above.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest tests/test_signoffs_endpoints.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `cd packages/pipeline && uv run pytest tests/test_signoffs_endpoints.py -x -q` exits 0
    - `grep -q '@router.post("/issues/{run_id}/sign-off")' packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py` succeeds
    - `grep -q 'Literal\["facts-cleared", "sounds-human"\]' packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py` succeeds (invalid kind → 422 via Pydantic)
    - `grep -q "signOffs:record" packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py` succeeds
    - `grep -q "claims_not_signed_off" packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py && grep -q "open_error_findings" packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py` succeed (prerequisites relocated into facts-cleared)
    - `grep -q 'action="signoff.recorded"' packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py` succeeds (PUB-04 audit)
    - The sounds-human path skips prerequisites: test file asserts a sounds-human 200 with `claimChecks:allSignedOff` returning false — `grep -q "sounds-human" packages/pipeline/tests/test_signoffs_endpoints.py` succeeds
  </acceptance_criteria>
  <done>api/signoffs.py records both sign-off kinds, gates facts-cleared on the relocated claims + open-error prerequisites, leaves sounds-human ungated, audits every record, and the endpoint matrix passes.</done>
</task>

<task type="auto">
  <name>Task 2: Register signoffs router + add signOffs paths to the secret-guarded set</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py (lines 31-40 the `from eisenbalm_pipeline.api import (...)` tuple, and lines 195-202 the `app.include_router(...)` block — add signoffs to both)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (lines 54-78 _PIPELINE_SECRET_GUARDED_PATHS + the docstring mandating sync with convex/*.ts)
    - docs/API_CONTRACTS.md §34.8 (which paths are guarded vs public)
  </read_first>
  <action>
1. In `packages/pipeline/src/eisenbalm_pipeline/api/main.py`: add `signoffs` to the `from eisenbalm_pipeline.api import (...)` import tuple (alphabetical among the existing names), and add `app.include_router(signoffs.router)` in the include_router block alongside `app.include_router(findings.router)`.
2. In `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py`: add `"signOffs:record"` and `"signOffs:revokeAll"` to the `_PIPELINE_SECRET_GUARDED_PATHS` frozenset (both are pipeline-lane mutations that call `requirePipelineSecret` — Research Pitfall 1: without this they 401 at runtime the first time the pipeline records/revokes a sign-off). Do NOT add `signOffs:activeByRunId` or `signOffs:listByRunId` — reads are public queries (Pitfall 2). Add a brief comment `# Phase 34 (§34.8) — two-sign-off gate mutations` above the two new entries.
  </action>
  <verify>
    <automated>grep -q "signoffs" packages/pipeline/src/eisenbalm_pipeline/api/main.py && grep -q "signOffs:record" packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py && grep -q "signOffs:revokeAll" packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "signoffs" packages/pipeline/src/eisenbalm_pipeline/api/main.py` returns ≥ 2 (import + include_router)
    - `grep -q "app.include_router(signoffs.router)" packages/pipeline/src/eisenbalm_pipeline/api/main.py` succeeds
    - `grep -q "signOffs:record" packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py && grep -q "signOffs:revokeAll" packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` succeed
    - `grep -q "signOffs:activeByRunId" packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` returns NOTHING (public read must NOT be guarded)
    - App imports cleanly: `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.api.main import app"` exits 0
  </acceptance_criteria>
  <done>signoffs.router is registered in main.py and both signOffs mutations (only) are in the secret-guarded set; the app imports without error.</done>
</task>

<task type="auto">
  <name>Task 3: Restructure publish_issue + schedule_issue gates (relocate two, add missing_signoffs)</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/review.py (publish_issue lines 62-184 and schedule_issue lines 190-330 — the full guard chains; you REMOVE the claims + open-error blocks from BOTH and ADD the missing_signoffs guard in their place)
    - packages/pipeline/tests/test_review_endpoints.py (existing tests — the claims_not_signed_off / open_error_findings assertions on publish/schedule MUST be updated to assert missing_signoffs, since those checks moved to the sign-off endpoint)
    - docs/API_CONTRACTS.md §34.4 (frozen missing_signoffs 409 shape + gate parity for schedule)
  </read_first>
  <behavior>
    - publish_issue: BOTH sign-offs active → passes the gate (proceeds to sanityIssueId guard + flip); either kind absent/revoked → 409 {reason:"missing_signoffs", missing:[...]}.
    - publish_issue NO LONGER 409s claims_not_signed_off or open_error_findings (those moved to the facts-cleared sign-off endpoint).
    - schedule_issue: identical missing_signoffs gate (D-09); both active + future scheduledAt → proceeds; either missing → 409 missing_signoffs.
  </behavior>
  <action>
In `packages/pipeline/src/eisenbalm_pipeline/api/review.py`, for BOTH `publish_issue` and `schedule_issue`:
1. DELETE the claims-signoff gate block (`claimChecks:allSignedOff` → 409 `claims_not_signed_off`) and the open-error-findings gate block (`qaCorrections:byRunId` → 409 `open_error_findings`). These two checks are now enforced at facts-cleared sign-off time (§34.3 / Task 1) — D-04 relocation.
2. INSERT, in their place (after the `wrong_status` status guard, before the `no_sanity_issue` sanityIssueId guard), the single new gate:
```python
# Phase 34 (§34.4, PUB-01) — two-sign-off gate. Server refuses unless BOTH
# attestations are active. The machine-checkable facts prerequisites (claims,
# open-error findings) now gate RECORDING "facts-cleared" (§34.3), not publish.
active = await _cc.convex_query(http, "signOffs:activeByRunId", {"runId": run_id}) or {}
missing = [k for k in ("facts-cleared", "sounds-human") if k not in active]
if missing:
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={
        "reason": "missing_signoffs",
        "message": "Both sign-offs (Facts cleared + Sounds human) are required before publishing.",
        "missing": missing})
```
For `schedule_issue` use the same block (message may end "…before scheduling."). Leave the `wrong_status`, `no_sanity_issue`, `schedule_in_past` guards and the `_flip_sanity_published` / `runs:setScheduledPublish` / reviewActions:record / _emit_audit actions UNCHANGED.

Update `packages/pipeline/tests/test_review_endpoints.py`: any existing test asserting `claims_not_signed_off` or `open_error_findings` on publish/schedule must now (a) monkeypatch `signOffs:activeByRunId` to control the gate, and (b) assert `missing_signoffs` when a kind is absent and a 200/flip when both `facts-cleared` and `sounds-human` are present. Add cases for BOTH publish and schedule: both-active-passes, one-missing-409, none-active-409. Ensure `pipelineRuns:byRunId` still returns `status="awaiting-review"` + a `sanityIssueId` in the passing cases.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest tests/test_review_endpoints.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `cd packages/pipeline && uv run pytest tests/test_review_endpoints.py -x -q` exits 0
    - `grep -c "missing_signoffs" packages/pipeline/src/eisenbalm_pipeline/api/review.py` returns ≥ 2 (gate in BOTH publish_issue and schedule_issue)
    - `grep -c "claims_not_signed_off" packages/pipeline/src/eisenbalm_pipeline/api/review.py` returns 0 (relocated out of review.py)
    - `grep -c "open_error_findings" packages/pipeline/src/eisenbalm_pipeline/api/review.py` returns 0 (relocated out of review.py)
    - `grep -q "signOffs:activeByRunId" packages/pipeline/src/eisenbalm_pipeline/api/review.py` succeeds
    - test_review_endpoints.py asserts both a publish AND a schedule missing_signoffs case: `grep -c "missing_signoffs" packages/pipeline/tests/test_review_endpoints.py` returns ≥ 2
    - Full pipeline suite green: `cd packages/pipeline && uv run pytest -x -q` exits 0 (no regression)
  </acceptance_criteria>
  <done>publish_issue and schedule_issue gate on both sign-offs being active (409 missing_signoffs otherwise), the claims/error checks are fully relocated out of review.py, and the review + full pipeline suites pass.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/test_signoffs_endpoints.py tests/test_review_endpoints.py -x -q` all green.
- `cd packages/pipeline && uv run pytest -x -q` ≥ prior baseline passing.
- `grep signOffs:record packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` present; `claims_not_signed_off` absent from review.py.
</verification>

<success_criteria>
- Recording a facts-cleared sign-off enforces the machine prerequisites; publish/schedule refuse (409 missing_signoffs) unless both attestations are active.
</success_criteria>

<output>
After completion, create `.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-03-SUMMARY.md`
</output>
