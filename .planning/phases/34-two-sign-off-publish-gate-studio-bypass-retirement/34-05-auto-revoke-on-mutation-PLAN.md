---
phase: 34-two-sign-off-publish-gate-studio-bypass-retirement
plan: 05
type: execute
wave: 3
depends_on: [34-02, 34-03]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/api/control.py
  - packages/pipeline/src/eisenbalm_pipeline/api/content.py
  - packages/pipeline/src/eisenbalm_pipeline/api/findings.py
  - packages/pipeline/tests/test_content_endpoints.py
  - packages/pipeline/tests/test_findings_endpoints.py
autonomous: true
requirements: [PUB-01, PUB-04]

must_haves:
  truths:
    - "Every content-mutating pipeline endpoint auto-revokes both active sign-offs for the run after its successful mutation"
    - "Revocation is fail-open (a revoke failure never blocks the content save the operator is doing)"
    - "The shared helper calls signOffs:revokeAll and the revoke is recorded (audit trail preserved)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/control.py"
      provides: "_revoke_active_signoffs shared helper + rerun_agent hook"
      contains: "def _revoke_active_signoffs"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/content.py"
      to: "signOffs:revokeAll"
      via: "_revoke_active_signoffs after each _emit_audit"
      pattern: "_revoke_active_signoffs"
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/findings.py"
      to: "signOffs:revokeAll"
      via: "_revoke_active_signoffs after accept/dismiss/reopen"
      pattern: "_revoke_active_signoffs"
---

<objective>
Implement D-08: any content mutation loudly voids the sign-offs. Add a shared `_revoke_active_signoffs` helper (co-located with `_emit_audit` in `control.py`, fail-open) and call it after the existing `_emit_audit` in every content-mutating endpoint — all 9 `content.py` patches, all 3 `findings.py` routes, and `control.py::rerun_agent`. Because the rail subscribes live to `signOffs:activeByRunId` (34-06), any mutation flips the rail red with zero polling; Andrew must re-sign after reviewing the change. No publishing content nobody attested to.

Purpose: The facts-cleared prerequisite (open-error findings, claim checks) is only checked at sign-off time (34-03's D-04 relocation). Auto-revoke on mutation is what keeps that attestation honest — including closing the gate-integrity hole where reopening an error finding after signing would otherwise leave facts-cleared active.
Output: One shared helper + call-site insertions across three routers, with revoke-assertion coverage in the content + findings test suites.
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
<!-- Existing helpers + the exact endpoints to hook. -->
From packages/pipeline/src/eisenbalm_pipeline/api/control.py (co-locate the new helper here, next to _emit_audit at ~L134):
```python
async def _emit_audit(http, *, actor_id, action, resource_type=None, resource_id=None, before=None, after=None)  # fail-open
import eisenbalm_pipeline.lib.convex_client as _cc   # convex_mutation
```
content.py endpoints (each resolves run_id + convex_http and ends with an `await _emit_audit(...)` right before `return` — insert the revoke call right after each):
  patch_section(~L230, audit ~L265) · patch_headline(~L281, audit ~L312) · patch_theme(~L328, audit ~L361) · patch_game(~L377, audit ~L413) · patch_pdf_data_points(~L429, audit ~L467) · patch_bonus(~L483, audit ~L542) · patch_deliberation_conversation(~L558, audit ~L589) · patch_podcast_transcript(~L605, audit ~L626) · upload_content_asset(~L714, audit ~L765)
findings.py endpoints (audit call-sites): accept_finding(~L226) · dismiss_finding(~L279) · reopen_finding(~L326)
control.py: rerun_agent(~L455, audit ~L567)
Convex path this plan calls: signOffs:revokeAll (guarded — added to _PIPELINE_SECRET_GUARDED_PATHS by plan 34-03).
In every one of these endpoints `run_id` is the path param and the convex http client is already in a local var (commonly `http` or `convex_http`) resolved before the audit call — use the SAME var the adjacent `_emit_audit(...)` uses.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add _revoke_active_signoffs helper + hook rerun_agent (control.py)</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py (lines 134-172 _emit_audit — clone its fail-open shape + http-var convention; lines 455-575 rerun_agent — the _emit_audit call at ~L567 and the `http`/actor vars in scope)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (convex_mutation + confirm signOffs:revokeAll is in _PIPELINE_SECRET_GUARDED_PATHS — added by 34-03)
    - docs/API_CONTRACTS.md §34.6 (frozen helper contract + which endpoints hook it)
  </read_first>
  <action>
In `packages/pipeline/src/eisenbalm_pipeline/api/control.py`, add a shared helper directly after `_emit_audit`:
```python
async def _revoke_active_signoffs(http, *, run_id: str, reason: str) -> None:
    """Phase 34 (§34.6, D-08) — auto-revoke both sign-off kinds when the issue's
    content changes. Fail-open (mirrors _emit_audit): a revoke failure must NOT
    block the content save the operator is actively doing. The rail (subscribed
    to signOffs:activeByRunId) goes red live; Andrew re-signs after review."""
    try:
        await _cc.convex_mutation(http, "signOffs:revokeAll", {"runId": run_id, "reason": reason})
    except Exception:  # noqa: BLE001
        log.warning("signOffs:revokeAll failed for run=%s (non-blocking)", run_id)
```
Then in `rerun_agent`, add one line immediately after the existing `await _emit_audit(...)` call (~L567), using the SAME convex http var that call uses:
```python
await _revoke_active_signoffs(http, run_id=run_id, reason="section re-rolled")
```
(`_cc` and `log` are already imported in control.py; confirm before adding.)
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && grep -q "def _revoke_active_signoffs" src/eisenbalm_pipeline/api/control.py && grep -q '_revoke_active_signoffs(http, run_id=run_id, reason="section re-rolled")' src/eisenbalm_pipeline/api/control.py && uv run python -c "from eisenbalm_pipeline.api.control import _revoke_active_signoffs"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "def _revoke_active_signoffs" packages/pipeline/src/eisenbalm_pipeline/api/control.py` succeeds
    - The helper calls the guarded mutation: `grep -q '"signOffs:revokeAll"' packages/pipeline/src/eisenbalm_pipeline/api/control.py` succeeds
    - The helper is fail-open: it wraps the mutation in try/except with a `log.warning` (verify by reading)
    - rerun_agent hooks it: `grep -q "_revoke_active_signoffs(http, run_id=run_id, reason=\"section re-rolled\")" packages/pipeline/src/eisenbalm_pipeline/api/control.py` succeeds
    - `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.api.control import _revoke_active_signoffs"` exits 0
  </acceptance_criteria>
  <done>_revoke_active_signoffs exists (fail-open, calls signOffs:revokeAll) and rerun_agent revokes after its audit.</done>
</task>

<task type="auto">
  <name>Task 2: Hook all 9 content.py patches + 3 findings.py routes</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/content.py (all 9 routes + their `await _emit_audit(...)` call-sites listed in the interfaces block — the convex http var + run_id in each)
    - packages/pipeline/src/eisenbalm_pipeline/api/findings.py (accept_finding/dismiss_finding/reopen_finding + their `_emit_audit` calls at ~L226/L279/L326; note it already imports `_emit_audit` from api.control — add `_revoke_active_signoffs` to that same import)
    - packages/pipeline/tests/test_content_endpoints.py (existing harness — extend to assert the revoke call fires on a patch)
    - packages/pipeline/tests/test_findings_endpoints.py (existing harness — extend to assert revoke fires on accept/dismiss/reopen)
    - docs/API_CONTRACTS.md §34.6 (the endpoint list + "clears BOTH kinds")
  </read_first>
  <action>
In `packages/pipeline/src/eisenbalm_pipeline/api/content.py`: ensure `_revoke_active_signoffs` is imported from `api.control` (extend the existing `from eisenbalm_pipeline.api.control import _emit_audit, _require_clerk_jwt_control` line to include it). After EACH of the 9 endpoints' `await _emit_audit(...)` call (patch_section, patch_headline, patch_theme, patch_game, patch_pdf_data_points, patch_bonus, patch_deliberation_conversation, patch_podcast_transcript, upload_content_asset), add:
```python
await _revoke_active_signoffs(<same_http_var>, run_id=run_id, reason="content edited")
```
using the same convex http variable the adjacent `_emit_audit` uses. (A more specific `reason` per endpoint is fine — e.g. "section edited", "asset uploaded" — but keep it short.)

In `packages/pipeline/src/eisenbalm_pipeline/api/findings.py`: extend the `from eisenbalm_pipeline.api.control import _emit_audit, _require_clerk_jwt_control` import to include `_revoke_active_signoffs`, and add the revoke call after the `_emit_audit(...)` in all THREE routes — `accept_finding` (reason="fix accepted"), `dismiss_finding` (reason="finding dismissed"), `reopen_finding` (reason="finding reopened"). Rationale to note in a comment on reopen/dismiss: they change the facts-cleared PREREQUISITE basis (open-error findings / claim posture), so they void the sign-offs and force a re-sign — this closes the gate-integrity hole created by relocating the error-findings check to sign-off time (§34.6, §34.3).

Extend `packages/pipeline/tests/test_content_endpoints.py`: add (or amend) at least one patch test that monkeypatches `_cc.convex_mutation` and asserts `signOffs:revokeAll` is invoked with the run's id after a successful patch. Extend `packages/pipeline/tests/test_findings_endpoints.py`: assert `signOffs:revokeAll` fires on accept AND on dismiss (and reopen). Keep the existing assertions green.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest tests/test_content_endpoints.py tests/test_findings_endpoints.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `cd packages/pipeline && uv run pytest tests/test_content_endpoints.py tests/test_findings_endpoints.py -x -q` exits 0
    - `grep -c "_revoke_active_signoffs" packages/pipeline/src/eisenbalm_pipeline/api/content.py` returns ≥ 9 (all patch routes hooked)
    - `grep -c "_revoke_active_signoffs" packages/pipeline/src/eisenbalm_pipeline/api/findings.py` returns ≥ 3 (accept/dismiss/reopen hooked)
    - Both routers import the helper: `grep -q "_revoke_active_signoffs" packages/pipeline/src/eisenbalm_pipeline/api/content.py` and `...findings.py` import lines include it (verify by reading the import statements)
    - test files assert the revoke mutation: `grep -q "signOffs:revokeAll" packages/pipeline/tests/test_content_endpoints.py && grep -q "signOffs:revokeAll" packages/pipeline/tests/test_findings_endpoints.py` succeed
    - Full pipeline suite green: `cd packages/pipeline && uv run pytest -x -q` exits 0 (no regression)
  </acceptance_criteria>
  <done>All 9 content patches and all 3 findings routes revoke both sign-offs after their mutation, fail-open, and the content + findings + full suites pass.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/test_content_endpoints.py tests/test_findings_endpoints.py -x -q` green.
- `cd packages/pipeline && uv run pytest -x -q` ≥ prior baseline passing.
- `grep -c _revoke_active_signoffs packages/pipeline/src/eisenbalm_pipeline/api/content.py` ≥ 9.
</verification>

<success_criteria>
- Any content edit, accept-fix, asset upload, or section re-roll voids both sign-offs (fail-open); the rail can reflect it live and Andrew must re-attest before publishing.
</success_criteria>

<output>
After completion, create `.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-05-SUMMARY.md`
</output>
