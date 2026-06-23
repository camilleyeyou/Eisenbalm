---
phase: 26-review-gate-charity-registry
plan: 03
type: execute
wave: 2
depends_on: [26-01]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/api/review.py
  - packages/pipeline/src/eisenbalm_pipeline/api/main.py
  - packages/pipeline/src/eisenbalm_pipeline/api/control.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py
  - packages/pipeline/tests/test_review_endpoints.py
  - packages/pipeline/tests/test_scheduler.py
autonomous: true
requirements: [RVW-01, RVW-03]
user_setup: []

must_haves:
  truths:
    - "POST /issues/{run_id}/publish flips Sanity status=published only when all claims are signed off and run is awaiting-review"
    - "POST /issues/{run_id}/schedule writes runs.scheduledPublishAt and records a review action"
    - "POST /issues/{run_id}/reject records a rejected review action without changing run status"
    - "The hourly tick sweep publishes any awaiting-review run whose scheduledPublishAt is now due, via the same Sanity-flip path"
    - "publisher writes pipelineRuns.sanityIssueId so the publish endpoint can resolve the Sanity issue from a runId"
    - "Every review decision writes both a review_actions row and an audit_log row"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/review.py"
      provides: "publish/schedule/reject endpoints"
      exports: ["router"]
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py"
      provides: "Shared _flip_sanity_published(run_id) helper reused by endpoint + tick"
  key_links:
    - from: "api/review.py publish"
      to: "claimChecks:allSignedOff guard"
      via: "409 when claims pending"
      pattern: "claims_not_signed_off|allSignedOff"
    - from: "api/control.py pipeline_tick"
      to: "runs:dueForPublish"
      via: "scheduled-publish sweep after cadence gate"
      pattern: "dueForPublish"
    - from: "publish path"
      to: "Sanity weeklyIssue.status=published"
      via: "_flip_sanity_published triggers existing webhook -> _run_publisher"
      pattern: "_flip_sanity_published"
---

<objective>
Build the FastAPI decision endpoints for the review gate (RVW-03) and extend the Phase 25 tick to fire scheduled publishes (D-02). Approve-and-publish reuses the proven Sanity-flip → webhook → `_run_publisher` chain (D-01) — no new publish/deploy logic. All three endpoints are Clerk-JWT-guarded, write a `review_actions` row, and write an `audit_log` row.

Purpose: The dashboard review screen (Plan 05) calls these endpoints. The publish endpoint must enforce the claims-signoff gate server-side (not just via a disabled button), and the schedule path must ride the existing cron so no new scheduler is introduced.
Output: api/review.py router, a shared sanity-flip helper, the tick sweep extension, publisher sanityIssueId write, green endpoint + scheduler tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/26-review-gate-charity-registry/26-CONTEXT.md
@.planning/phases/26-review-gate-charity-registry/26-RESEARCH.md
@CLAUDE.md

<interfaces>
<!-- Existing pipeline patterns to reuse. -->
api/control.py:_require_clerk_jwt_control (Depends) — Clerk JWT guard with dev-mode sentinel {"sub":"local-dev-operator"}
api/control.py:_emit_audit(...) — writes auditLog:record (reuse for review actions)
api/control.py:pipeline_tick(request) — 5-step gate; add scheduled-publish sweep after the cadence gate (STEP 2), before/around STEP 3
api/webhooks.py — Sanity status=published webhook -> asyncio.create_task(_run_publisher); UNCHANGED
agents/publisher/__init__.py:_run_publisher — PDF + Vercel deploy; UNCHANGED. Also the run-end node writes pipelineRuns:updateStatus status="awaiting-review" with sanityIssueId in state.get("sanity_issue_id").
lib/convex_client.py:convex_query / convex_mutation
WORKSPACE_ID = "eisenbalm"

<!-- Convex functions from Plan 26-01. -->
runs:dueForPublish({workspace_id, nowMs}) -> [run rows]   // status awaiting-review & scheduledPublishAt<=nowMs
runs:setScheduledPublish({runId, scheduledPublishAt})
pipelineRuns:byRunId({runId}) -> {runId, status, sanityIssueId?, ...}
pipelineRuns:updateStatus({runId, status, sanityIssueId?})  // extended in 26-01
claimChecks:allSignedOff({runId}) -> {total, signedOff, allSignedOff}
reviewActions:record({workspace_id, runId, actorId, action, note?})

<!-- Endpoint shapes (API_CONTRACTS Phase 26 / RESEARCH Pattern 9):
POST /issues/{run_id}/publish  -> guards: run awaiting-review + claims signed off; flips Sanity; 200 {issueId, published:true}; 409 {reason:"claims_not_signed_off"} ; 409 {reason} on wrong status
POST /issues/{run_id}/schedule body {scheduledAt:int} -> guards: awaiting-review + claims signed off + scheduledAt>now; writes scheduledPublishAt; 200 {issueId, scheduledAt}
POST /issues/{run_id}/reject body {note?:str} -> records rejected; 200 {issueId, rejected:true} -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Publisher writes sanityIssueId on pipelineRuns + create shared _flip_sanity_published helper</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py (the run-end node ~lines 44-74 that calls pipelineRuns:updateStatus with status="awaiting-review"; and _run_publisher ~145+ for how Sanity patch is done)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (the HTTP GROQ/patch client — how to PATCH a weeklyIssue doc; reuse for the status flip)
    - docs/API_CONTRACTS.md (Phase 26 — pipelineRuns.sanityIssueId additive field; Sanity status flip = D-01)
    - apps/studio/schemas/weeklyIssue.ts (the `status` field values: in-review / published — confirm exact strings)
  </read_first>
  <action>
1. In publisher/__init__.py run-end node: when calling `pipelineRuns:updateStatus` with `status="awaiting-review"`, also pass `sanityIssueId=state.get("sanity_issue_id")` (the extended mutation from Plan 26-01 accepts it). This persists the Sanity doc id so the publish endpoint can resolve it from a runId.

2. Create `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py` with:
   `async def _flip_sanity_published(http, sanity_issue_id: str) -> None:` — PATCH the Sanity `weeklyIssue` document `sanity_issue_id` setting `status` to `"published"` using the Sanity mutate/patch HTTP endpoint and `SANITY_API_TOKEN` (reuse the request style from sanity_client.py / _run_publisher's Sanity calls). This is the single shared flip used by both the publish endpoint and the tick sweep so they converge on ONE code path (D-01). On failure, raise (callers handle/log).
   Add a docstring noting: flipping status fires the existing Sanity webhook → `_run_publisher` (PDF + Vercel deploy); this helper does NOT call `_run_publisher` directly.
  </action>
  <verify>
    <automated>cd packages/pipeline && grep -q "sanityIssueId" src/eisenbalm_pipeline/agents/publisher/__init__.py && test -f src/eisenbalm_pipeline/lib/sanity_publish.py && grep -q "_flip_sanity_published" src/eisenbalm_pipeline/lib/sanity_publish.py && grep -q '"published"' src/eisenbalm_pipeline/lib/sanity_publish.py && uv run pytest -x -q -k "publisher" 2>&1 | tail -4</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "sanityIssueId" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` succeeds AND it is passed into the awaiting-review updateStatus call (verify by reading the call)
    - File packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py exists with `_flip_sanity_published`
    - `grep -q '"published"' packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py` succeeds
    - Helper docstring states it does NOT call _run_publisher directly (grep "_run_publisher")
    - `cd packages/pipeline && uv run pytest -x -q -k "publisher"` exits 0
  </acceptance_criteria>
  <done>sanityIssueId is persisted at awaiting-review; a single shared Sanity-flip helper exists for endpoint + tick.</done>
</task>

<task type="auto">
  <name>Task 2: Create api/review.py — publish/schedule/reject endpoints + mount on app</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py (router pattern: APIRouter, _require_clerk_jwt_control Depends, _emit_audit, convex calls via request.app.state.convex_http)
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py (how routers are include_router'd — mount the new review router the same way)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py (the _flip_sanity_published helper from Task 1)
    - packages/pipeline/tests/test_review_endpoints.py (Wave 0 RED tests — implement to satisfy: publish-requires-signoff, publish-success, schedule-writes-scheduled-at)
    - docs/API_CONTRACTS.md (Phase 26 endpoint shapes + canonical action enum)
  </read_first>
  <action>
Create `packages/pipeline/src/eisenbalm_pipeline/api/review.py` with `router = APIRouter()` and three POST routes. All use `Depends(_require_clerk_jwt_control)` (import from control.py) and `WORKSPACE_ID="eisenbalm"`. Get the Convex http via `request.app.state.convex_http`. Resolve actorId from the JWT claim `sub`.

For each: define a Pydantic body model where needed.

**POST /issues/{run_id}/publish**:
1. `run = await convex_query(http, "pipelineRuns:byRunId", {"runId": run_id})`; if None → 404.
2. If `run["status"] != "awaiting-review"` → `HTTPException(409, {"reason": "wrong_status"})` (message "This run cannot be published in its current state.").
3. `signoff = await convex_query(http, "claimChecks:allSignedOff", {"runId": run_id})`; if not `signoff["allSignedOff"]` → `HTTPException(409, {"reason": "claims_not_signed_off"})` (Pitfall 6 — server-side guard).
4. `sanity_id = run.get("sanityIssueId")`; if missing → 409 reason "no_sanity_issue".
5. Idempotency: if status were already complete we'd 200 with alreadyPublished — but status==awaiting-review is guaranteed here.
6. `await _flip_sanity_published(http, sanity_id)`.
7. `await convex_mutation(http, "reviewActions:record", {"workspace_id": WORKSPACE_ID, "runId": run_id, "actorId": actor, "action": "approved_and_published"})`.
8. `await _emit_audit(...)` action "approved_and_published".
9. Return `{"issueId": sanity_id, "published": True}`.

**POST /issues/{run_id}/schedule** (body `{scheduledAt: int}` Unix ms):
1-4. Same run/status/claims/sanity guards as publish.
5. If `scheduledAt <= now_ms` → `HTTPException(400, {"reason": "schedule_in_past"})` (message "Choose a time in the future.").
6. `await convex_mutation(http, "runs:setScheduledPublish", {"runId": run_id, "scheduledPublishAt": scheduledAt})`.
7. reviewActions:record action "approved_and_scheduled" (note may carry the time).
8. _emit_audit "approved_and_scheduled".
9. Return `{"issueId": sanity_id, "scheduledAt": scheduledAt}`.

**POST /issues/{run_id}/reject** (body `{note: Optional[str]}`):
1. run lookup → 404 if missing.
2. reviewActions:record action "rejected" with note.
3. _emit_audit "rejected".
4. Do NOT change run status (CONTEXT: reject leaves run in history; no status mutation this phase).
5. Return `{"issueId": run.get("sanityIssueId"), "rejected": True}`.

Mount in api/main.py: `app.include_router(review.router)` alongside the existing routers.
  </action>
  <verify>
    <automated>cd packages/pipeline && test -f src/eisenbalm_pipeline/api/review.py && grep -q "claims_not_signed_off" src/eisenbalm_pipeline/api/review.py && grep -q "approved_and_published" src/eisenbalm_pipeline/api/review.py && grep -q "review.router" src/eisenbalm_pipeline/api/main.py && uv run pytest tests/test_review_endpoints.py -x -q 2>&1 | tail -6</automated>
  </verify>
  <acceptance_criteria>
    - `cd packages/pipeline && uv run pytest tests/test_review_endpoints.py -x -q` exits 0 with the three tests PASSING (not skipped)
    - `grep -q "claims_not_signed_off" packages/pipeline/src/eisenbalm_pipeline/api/review.py` succeeds
    - All three canonical actions present: `grep -E "approved_and_published|approved_and_scheduled|rejected" packages/pipeline/src/eisenbalm_pipeline/api/review.py` matches all three
    - `grep -q "review.router" packages/pipeline/src/eisenbalm_pipeline/api/main.py` (router mounted)
    - publish + schedule both call `_flip_sanity_published` / `runs:setScheduledPublish` respectively (grep both)
    - Each route uses `Depends(_require_clerk_jwt_control)` (grep count >= 3)
  </acceptance_criteria>
  <done>Three Clerk-guarded decision endpoints exist; publish enforces the claims gate server-side; schedule writes scheduledPublishAt; all write review_actions + audit_log.</done>
</task>

<task type="auto">
  <name>Task 3: Extend pipeline_tick with the scheduled-publish sweep (D-02)</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py (pipeline_tick — the 5-step gate at ~238-320; insert the sweep right after STEP 2 cadence gate so due scheduled publishes fire even when no new run is due)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py (_flip_sanity_published — reuse)
    - packages/pipeline/tests/test_scheduler.py (add test_tick_fires_due_scheduled_runs — create file if absent)
    - docs/API_CONTRACTS.md (runs:dueForPublish)
  </read_first>
  <action>
In `pipeline_tick` (control.py), AFTER the kill-switch (STEP 1) and BEFORE returning on the cadence gate, add a scheduled-publish sweep that runs regardless of whether a new run is due:

```python
# ── Scheduled-publish sweep (Phase 26 D-02) — runs every tick ──
now_ms = int(time.time() * 1000)
due = await _cc.convex_query(http, "runs:dueForPublish", {"workspace_id": WORKSPACE_ID, "nowMs": now_ms}) or []
published_run_ids = []
for r in due:
    try:
        pr = await _cc.convex_query(http, "pipelineRuns:byRunId", {"runId": r["runId"]})
        sanity_id = (pr or {}).get("sanityIssueId")
        if sanity_id:
            await _flip_sanity_published(http, sanity_id)
            await _cc.convex_mutation(http, "runs:setScheduledPublish", {"runId": r["runId"], "scheduledPublishAt": None})
            published_run_ids.append(r["runId"])
    except Exception as exc:  # noqa: BLE001
        log.warning("tick scheduled-publish failed for %s: %r", r.get("runId"), exc)
```

Place this BEFORE the STEP 2 cadence-gate early-return so scheduled publishes are not skipped when the cadence cursor is in the future. Reuse the existing `now_ms` if already computed later — move it up rather than duplicating. Include `published_run_ids` in the returned dict (e.g. add `"scheduledPublished": published_run_ids` to whatever the tick returns) without breaking the existing `{"status": ..., "reason": ...}` shape — add the key on the skip/triggered returns where reasonable, or return it on a dedicated path. Do NOT change the existing kill-switch / cadence / one-at-a-time / budget gate ordering for new-run triggering.
  </action>
  <verify>
    <automated>cd packages/pipeline && grep -q "runs:dueForPublish" src/eisenbalm_pipeline/api/control.py && grep -q "_flip_sanity_published" src/eisenbalm_pipeline/api/control.py && uv run pytest tests/test_scheduler.py -x -q 2>&1 | tail -6</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "runs:dueForPublish" packages/pipeline/src/eisenbalm_pipeline/api/control.py` succeeds
    - `grep -q "_flip_sanity_published" packages/pipeline/src/eisenbalm_pipeline/api/control.py` succeeds
    - The sweep is placed before the cadence-gate return (verify by reading: it is not inside the `if not _is_due` branch)
    - `cd packages/pipeline && uv run pytest tests/test_scheduler.py -x -q` exits 0 with test_tick_fires_due_scheduled_runs passing
    - Existing tick tests still green: `cd packages/pipeline && uv run pytest -x -q -k "tick or scheduler"` exits 0
  </acceptance_criteria>
  <done>The hourly tick publishes due scheduled runs via the shared Sanity-flip path; existing tick gating unchanged.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest -x -q` full suite green (review endpoint + scheduler tests passing).
- Publish endpoint returns 409 when claims pending; 200 + Sanity flip when signed off.
- Schedule writes scheduledPublishAt; tick fires due scheduled publishes.
- Every decision writes review_actions + audit_log.
</verification>

<success_criteria>
- Approve-and-publish reuses the proven Sanity-flip → webhook → _run_publisher chain (no new deploy logic).
- The claims-signoff gate is enforced server-side, not just by a disabled button.
- Scheduled publishes ride the existing Phase 25 cron tick (no new scheduler).
</success_criteria>

<output>
After completion, create `.planning/phases/26-review-gate-charity-registry/26-03-SUMMARY.md`.
</output>
