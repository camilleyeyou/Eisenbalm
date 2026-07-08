---
phase: 34-two-sign-off-publish-gate-studio-bypass-retirement
plan: 04
type: execute
wave: 3
depends_on: [34-02, 34-03]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py
  - packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py
  - packages/pipeline/tests/api/test_webhook_sanity.py
autonomous: true
requirements: [PUB-02, PUB-04]

must_haves:
  truths:
    - "The Sanity publish webhook reverts status to in-review and does NOT launch the publisher when a run's sign-offs are missing (or run_id is None)"
    - "The webhook proceeds to _run_publisher only when both sign-offs are active (the legit dashboard-publish path)"
    - "A blocked bypass writes an audit row and emits a Convex alert event via the frozen cost-warning literal"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py"
      provides: "_revert_sanity_status (inverse of _flip_sanity_published)"
      contains: "def _revert_sanity_status"
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py"
      provides: "D-07 sign-off re-validation guard before _run_publisher"
      contains: "publish_bypass_blocked"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py"
      to: "signOffs:activeByRunId"
      via: "webhook re-check"
      pattern: "signOffs:activeByRunId"
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py"
      to: "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py::_revert_sanity_status"
      via: "bypass revert"
      pattern: "_revert_sanity_status"
---

<objective>
Close the Studio status-flip bypass (D-07, PUB-02). Add `_revert_sanity_status` (mirror of `_flip_sanity_published`) and insert one re-validation guard in `webhooks.py::sanity_publish` — after the existing HMAC/age/status/idempotency guards, before launching `_run_publisher`. If a run's two sign-offs are not both active (or the payload has no runId at all), the handler reverts Sanity `status` to `in-review`, writes an audit row, emits a loud alert event, and returns WITHOUT publishing. A legitimate dashboard publish (whose §34.4 gate already passed before flipping Sanity) sails through the re-check unchanged.

Purpose: The dashboard was gated in Phase 26/33; Studio was not. This makes a direct Studio flip *incapable* of publishing — the server controls the truth regardless of what Studio's UI allows.
Output: One new lib helper + one webhook guard + extended webhook tests.
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
<!-- Existing webhook + helper primitives. -->
From packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py (the flip helper to mirror):
```python
async def _flip_sanity_published(http: AsyncClient, sanity_issue_id: str) -> None:
    # POST /{_API_VERSION}/data/mutate/{dataset}  json={"mutations":[{"patch":{"id":..., "set":{"status":"published"}}}]}
    # _API_VERSION = "v2024-01-01"; _dataset(); _auth_headers() are module helpers
```
From packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py (insertion point — after idempotency dedup ~L110, before asyncio.create_task ~L123):
```python
run_id = payload.get("runId")  # may be None for manually-authored drafts
issue_id = payload["_id"]; issue_number = payload["issueNumber"]
task = asyncio.create_task(_run_publisher(request.app, issue_id=issue_id, issue_number=issue_number, run_id=run_id))
```
Available on request.app.state (same as review.py): convex_http, sanity_http, pool, background_tasks.
From packages/pipeline/src/eisenbalm_pipeline/api/control.py:
```python
async def _emit_audit(http, *, actor_id, action, resource_type=None, resource_id=None, before=None, after=None)
```
From packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py:
```python
import eisenbalm_pipeline.lib.convex_client as _cc
async def convex_query(http, path, args) -> Any
async def convex_mutation(http, path, args) -> Any
```
Frozen-union alert precedent (Phase 27 D-04 / auto-publish-enabled): deliberationEvents.eventType is FROZEN — reuse outer literal "cost-warning" with inner payload JSON discriminator.
weeklyIssue.status valid values: 'draft' | 'in-review' | 'published' (revert target = "in-review").
Convex paths this plan calls: signOffs:activeByRunId (public query), deliberationEvents:insert (guarded), auditLog:record (guarded, via _emit_audit).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add _revert_sanity_status to lib/sanity_publish.py</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py (the full file — _flip_sanity_published at lines 39-75 is the exact mirror target; reuse _dataset(), _auth_headers(), _API_VERSION)
    - docs/API_CONTRACTS.md §34.7 (frozen helper contract)
  </read_first>
  <action>
In `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py`, add a new async helper `_revert_sanity_status` directly after `_flip_sanity_published`, as its inverse — identical PATCH-mutate shape, parameterized `status` defaulting to `"in-review"`:
```python
async def _revert_sanity_status(http: AsyncClient, sanity_issue_id: str, *, status: str = "in-review") -> None:
    """Inverse of _flip_sanity_published (§34.7, D-07) — reverts a Studio-flip
    bypass attempt. 'in-review' is the valid non-published weeklyIssue.status
    value (apps/studio/schemas/weeklyIssue.ts). On error the exception
    propagates to the caller (the webhook logs + still returns 200)."""
    dataset = _dataset()
    r = await http.post(
        f"/{_API_VERSION}/data/mutate/{dataset}",
        json={"mutations": [{"patch": {"id": sanity_issue_id, "set": {"status": status}}}]},
        headers=_auth_headers(),
    )
    r.raise_for_status()
    log.info("_revert_sanity_status: %s status=%s (publish bypass blocked)", sanity_issue_id, status)
```
  </action>
  <verify>
    <automated>grep -q "def _revert_sanity_status" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py && grep -q '"set": {"status": status}' packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "def _revert_sanity_status" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py` succeeds
    - `grep -q 'status: str = "in-review"' packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py` succeeds (default revert target)
    - Reuses existing helpers: `grep -q "_dataset()" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py` and the new function calls `_auth_headers()` (verify by reading)
    - `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.lib.sanity_publish import _revert_sanity_status"` exits 0
  </acceptance_criteria>
  <done>_revert_sanity_status mirrors _flip_sanity_published, sets status to a parameterized value defaulting to in-review, and imports cleanly.</done>
</task>

<task type="auto">
  <name>Task 2: Insert the D-07 sign-off re-validation guard in webhooks.py + tests</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py (the full handler — insertion point is after the idempotency block ~L110 and before the asyncio.create_task at ~L123; note it currently only reads request.app.state.pool + background_tasks and must ALSO read convex_http + sanity_http)
    - packages/pipeline/tests/api/test_webhook_sanity.py (the client / sanity_signature_encoder fixtures + the existing signature-accept/reject test pattern to clone)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py (_revert_sanity_status from Task 1)
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py (_emit_audit signature)
    - docs/API_CONTRACTS.md §34.5 + §34.6b (frozen guard logic incl. run_id=None case + the cost-warning alert)
  </read_first>
  <behavior>
    - Valid webhook, status=published, run has BOTH sign-offs active → proceeds to _run_publisher (unchanged behavior); NO revert, NO block.
    - Valid webhook, run missing one/both sign-offs → does NOT launch _run_publisher; calls _revert_sanity_status(...,"in-review"); writes audit action="run.publish_bypass_blocked"; emits deliberationEvents:insert eventType="cost-warning" inner payload eventType="publish-bypass-blocked"; returns {"ok":True,"blocked":"missing_signoffs","missing":[...]}.
    - Valid webhook with payload.runId absent (None) → BLOCKS identically (run-less draft can carry no sign-offs, D-07 spirit / Research Open Q#2).
    - The signature/age/status/idempotency guards keep their existing behavior (the new guard runs only after they pass and status=="published").
  </behavior>
  <action>
In `packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py`, add imports: `import eisenbalm_pipeline.lib.convex_client as _cc`, `import json` (already present), `from eisenbalm_pipeline.api.control import _emit_audit`, and `from eisenbalm_pipeline.lib.sanity_publish import _revert_sanity_status`. Insert the D-07 guard AFTER the idempotency-dedup block and AFTER `run_id = payload.get("runId")` + `issue_id`/`issue_number` extraction, but BEFORE the `asyncio.create_task(_run_publisher(...))` call:
```python
# Phase 34 (§34.5, D-07, PUB-02) — re-validate sign-off state before the
# publisher runs. Closes the Studio status-flip bypass: a direct flip skips the
# dashboard's §34.4 gate, so its sign-offs are absent and this reverts + blocks.
# A LEGIT dashboard publish flips Sanity only AFTER its gate passed, so both
# sign-offs are already active here and this check passes — no race.
convex_http = getattr(request.app.state, "convex_http", None)
sanity_http = getattr(request.app.state, "sanity_http", None)
active = (
    await _cc.convex_query(convex_http, "signOffs:activeByRunId", {"runId": run_id})
    if run_id else {}
) or {}
missing = [k for k in ("facts-cleared", "sounds-human") if k not in active]
if run_id is None or missing:
    log.warning("Webhook publish BLOCKED — run=%s missing=%s", run_id, missing)
    try:
        await _revert_sanity_status(sanity_http, issue_id, status="in-review")
    except Exception:  # noqa: BLE001 — still return 200; the block already happened by not launching the publisher
        log.exception("revert failed for issue=%s (publisher still NOT launched)", issue_id)
    await _emit_audit(
        convex_http, actor_id="webhook", action="run.publish_bypass_blocked",
        resource_type="run", resource_id=run_id or issue_id,
        after=json.dumps({"missing": missing, "reason": "missing_signoffs" if run_id else "no_run_id"}),
    )
    # §34.6b — reuse the FROZEN deliberationEvents.eventType union (Phase 27 D-04:
    # do NOT add a new literal). Outer "cost-warning" routes to notification
    # dispatch; the real semantic name rides in the inner payload. Known tradeoff:
    # the alert email subject renders "budget" (same as auto-publish-enabled).
    try:
        await _cc.convex_mutation(convex_http, "deliberationEvents:insert", {
            "runId": run_id or issue_id,
            "agentId": "webhook",
            "eventType": "cost-warning",
            "payload": json.dumps({"eventType": "publish-bypass-blocked", "runId": run_id, "missing": missing}),
        })
    except Exception:  # noqa: BLE001
        log.warning("bypass alert emit failed for run=%s (non-blocking)", run_id)
    return {"ok": True, "blocked": "missing_signoffs", "missing": missing}
```
(Confirm the exact `deliberationEvents:insert` arg names by reading `convex/deliberationEvents.ts` — match its `insert` validator; if it requires `workspace_id`, add `"workspace_id": "eisenbalm"`.) Leave everything else in the handler unchanged; the `asyncio.create_task(_run_publisher(...))` path runs only when this guard did not return.

Extend `packages/pipeline/tests/api/test_webhook_sanity.py` with three cases (clone the existing signed-request fixture; set app.state.convex_http/sanity_http to MagicMocks and monkeypatch `_cc.convex_query`/`_cc.convex_mutation` + `_revert_sanity_status`):
1. both sign-offs active → asserts `_run_publisher`/`asyncio.create_task` IS scheduled and NO revert.
2. one missing → asserts response `blocked=="missing_signoffs"`, `_revert_sanity_status` called with status="in-review", NO publisher task, an audit + alert emitted.
3. `payload["runId"]` absent → asserts blocked + revert (run-less case).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest tests/api/test_webhook_sanity.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `cd packages/pipeline && uv run pytest tests/api/test_webhook_sanity.py -x -q` exits 0
    - `grep -q "signOffs:activeByRunId" packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` succeeds
    - `grep -q "_revert_sanity_status" packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` succeeds
    - `grep -q 'action="run.publish_bypass_blocked"' packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` succeeds (PUB-04 audit)
    - `grep -q "publish-bypass-blocked" packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py && grep -q '"cost-warning"' packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` succeed (frozen-union alert reuse)
    - `grep -q "run_id is None or missing" packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` succeeds (run-less block, Research Open Q#2)
    - test file asserts BOTH a proceed case (both active) and a block+revert case: `grep -q "missing_signoffs" packages/pipeline/tests/api/test_webhook_sanity.py` succeeds
    - Full pipeline suite green: `cd packages/pipeline && uv run pytest -x -q` exits 0
  </acceptance_criteria>
  <done>The webhook re-validates sign-offs, reverts to in-review + audits + alerts on a bypass (including run-less), proceeds to the publisher only when both are active, and the webhook + full suites pass.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/api/test_webhook_sanity.py -x -q` green.
- `cd packages/pipeline && uv run pytest -x -q` ≥ prior baseline passing.
- `grep _revert_sanity_status packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` present.
</verification>

<success_criteria>
- A direct Studio publish flip for a run without both sign-offs is reverted and never reaches the publisher; legit dashboard publishes are unaffected.
</success_criteria>

<output>
After completion, create `.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-04-SUMMARY.md`
</output>
