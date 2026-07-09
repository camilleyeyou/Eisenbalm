---
phase: 37-run-monitor-v2-signal-desk
plan: 02
type: execute
wave: 2
depends_on: ["37-01"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
  - packages/pipeline/src/eisenbalm_pipeline/api/control.py
  - packages/pipeline/tests/test_adjudication_bridge.py
autonomous: true
requirements: [SIG-03]
must_haves:
  truths:
    - "The operator can resolve a Gate-1 interrupt from the Clerk-guarded dashboard without ever handling the server-to-server trigger secret"
    - "The pick + reason is audit-logged before the run resumes (nothing silent)"
    - "There is exactly one resume implementation — the bridge and the trigger-secret endpoint both call it"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/control.py"
      provides: "POST /issues/{run_id}/adjudicate — Clerk-guarded bridge → audit → resume"
      contains: "adjudicate"
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/runs.py"
      provides: "shared _resume_paused_run helper reused by both entry points"
      contains: "_resume_paused_run"
    - path: "packages/pipeline/tests/test_adjudication_bridge.py"
      provides: "coverage: paused-guard 409, audit-before-resume, no trigger secret"
      contains: "adjudicate"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/control.py adjudicate"
      to: "packages/pipeline/src/eisenbalm_pipeline/api/runs.py _resume_paused_run"
      via: "shared resume helper call"
      pattern: "_resume_paused_run"
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/control.py adjudicate"
      to: "audit_log"
      via: "_emit_audit pick + reason"
      pattern: "_emit_audit"
---

<objective>
Build the Clerk-guarded adjudication bridge (SIG-03 backend) so the dashboard can resolve a Gate-1 interrupt. The existing `POST /run/{run_id}/resume` is `_require_trigger_secret`-guarded (server-to-server) and has no `reason` field — the browser must never see the trigger secret. Add `POST /issues/{run_id}/adjudicate` (Clerk-JWT-guarded) that audit-logs the operator's pick + reason then invokes the SAME resume machinery server-side.

Purpose: the one write action of the whole phase — must be server-guarded and audit-logged like every other v3.0 mutation.
Output: a shared resume helper + the bridge endpoint + tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/37-run-monitor-v2-signal-desk/37-CONTEXT.md
@.planning/phases/37-run-monitor-v2-signal-desk/37-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- Executor: exact existing shapes to build around. Do NOT replace them. -->

runs.py `resume_run` (~L425-467):
```python
_require_trigger_secret(request)
graph = _require_graph(request)
config = {"configurable": {"thread_id": run_id}}
state = await graph.aget_state(config)
if not state or not state.next:
    raise HTTPException(409, f"Run {run_id} is not paused (state.next is empty)")
resume_payload = {"editorSelection": body.selection.charityName}
# asyncio.create_task(graph.ainvoke(Command(resume=resume_payload), config=config)) + app.state.background_tasks bookkeeping
```
`ResumeBody = {selection: ResumeSelection{charityName: str}}` (~L123-127).

control.py existing helpers:
- `_require_clerk_jwt_control(credentials=Depends(_optional_bearer)) -> dict` (~L80) — returns claims dict with `.get("sub")`.
- `_emit_audit(http, *, actor_id, action, resource_type=None, resource_id=None, before=None, after=None)` (~L134) — fire-and-forget audit_log write via `auditLog:record`; non-blocking.
- `rerun_agent` (~L468) shows the canonical control-endpoint pattern: `http = getattr(request.app.state, "convex_http", None)`, `actor_id = claims.get("sub") or "unknown"`, `run_row = await _cc.convex_query(http, "runs:byRunId", {"runId": run_id})`.
- router import: `from eisenbalm_pipeline.api import runs` is available in the same FastAPI process.

Gate-1-paused reactive/authoritative signal (Research Pitfall 4): a run paused at Gate 1 has `state.next` non-empty (LangGraph) AND its `pipelineRuns` row has `status == 'awaiting-review' && completedAt == null`. The endpoint's own paused-guard uses `state.next` (authoritative), same as resume_run.
</interfaces>
</context>

<sequencing_note>
Waves run SEQUENTIALLY in the main checkout — NO worktrees. This is Wave 2; it depends on 37-01 (contract §37.3 defines this endpoint's shape). Land it on master before Wave 3 (Signal Desk 37-05 calls it).
</sequencing_note>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extract a shared _resume_paused_run helper in runs.py (interface-first)</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py (`resume_run` ~L425-467, `_require_graph`, `ResumeBody`)
    - packages/pipeline/tests/test_editor_gate_1_resume.py (must stay green)
  </read_first>
  <behavior>
    - Test: calling `_resume_paused_run(app, run_id, "SomeCharity")` on a graph whose `aget_state` returns empty `state.next` raises `HTTPException(409)`.
    - Test: on a paused graph it schedules a background `graph.ainvoke(Command(resume={"editorSelection": "SomeCharity"}), ...)` and returns `{"runId": run_id, "resumed": True}`.
  </behavior>
  <action>
    Refactor `resume_run` so its core (paused-check via `state.next`, build `{"editorSelection": charity_name}`, schedule the background `graph.ainvoke(Command(resume=...))`, register/discard on `app.state.background_tasks`, return `{"runId", "resumed": True}`) lives in a new async helper `async def _resume_paused_run(app, run_id: str, charity_name: str) -> dict` in runs.py. `resume_run` keeps its `_require_trigger_secret(request)` guard, then delegates: `return await _resume_paused_run(request.app, run_id, body.selection.charityName)`. Do NOT change the endpoint path, guard, or response shape — this is a pure extraction so a second caller can reuse it. Add the two behavior tests to a new/extended test (may live in test_adjudication_bridge.py or extend the resume test file).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_editor_gate_1_resume.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "_resume_paused_run" packages/pipeline/src/eisenbalm_pipeline/api/runs.py`
    - `resume_run` still calls `_require_trigger_secret`: `grep -q "_require_trigger_secret" packages/pipeline/src/eisenbalm_pipeline/api/runs.py`
    - `cd packages/pipeline && uv run pytest tests/test_editor_gate_1_resume.py -x -q` exits 0 (no regression)
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add POST /issues/{run_id}/adjudicate Clerk-guarded bridge</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py (`_require_clerk_jwt_control` ~L80, `_emit_audit` ~L134, `rerun_agent` ~L468 as the endpoint pattern)
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py (`_resume_paused_run` from Task 1)
    - packages/pipeline/tests/test_editor_gate_1_resume.py (fixture/graph-stub pattern to copy)
  </read_first>
  <behavior>
    - Test: `POST /issues/{run_id}/adjudicate` with body `{"selection": {"charityName": "X"}, "reason": "clearer hook"}` on a paused run → calls `_emit_audit` (action names the adjudication, resource_id=run_id, `after` carries pick + reason) BEFORE resume is scheduled, then returns the resume result.
    - Test: on a NON-paused run → 409, and NO audit/resume side effects fire.
    - Test: the endpoint never calls `_require_trigger_secret` (grep-level) — auth is `_require_clerk_jwt_control` only.
  </behavior>
  <action>
    In control.py add a Pydantic `AdjudicateBody` = `{selection: {charityName: str}, reason: str}` (reason required) and:
    ```python
    @router.post("/issues/{run_id}/adjudicate")
    async def adjudicate(request: Request, run_id: str, body: AdjudicateBody,
                         claims: dict = Depends(_require_clerk_jwt_control)) -> dict:
    ```
    Body:
    1. `http = getattr(request.app.state, "convex_http", None)`; `actor_id = claims.get("sub") or "unknown"`.
    2. `_emit_audit(http, actor_id=actor_id, action="gate1.adjudicate", resource_type="run", resource_id=run_id, after=json.dumps({"charityName": body.selection.charityName, "reason": body.reason}))` — pick + reason logged FIRST ("nothing silent"). Log `reason` via audit_log ONLY (the deliberationEvents.eventType union is FROZEN — do NOT add a literal, do NOT thread `reason` into Command(resume=...)).
    3. `from eisenbalm_pipeline.api.runs import _resume_paused_run` (same process) and `return await _resume_paused_run(request.app, run_id, body.selection.charityName)` — this re-raises the 409 paused-guard from the shared helper, so a non-paused run 409s AFTER... to satisfy the "no side effects on 409" test, first check paused-state before emitting the audit: call the shared helper and let its 409 propagate before `_emit_audit`, OR pre-check `state.next` up front. Implement the pre-check-then-audit-then-resume order so audit only fires for a genuinely paused run.
    Add the three behavior tests to packages/pipeline/tests/test_adjudication_bridge.py (structure mirrors test_editor_gate_1_resume.py: stub graph with aget_state, monkeypatch `_emit_audit`/convex, assert call order).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_adjudication_bridge.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "issues/{run_id}/adjudicate" packages/pipeline/src/eisenbalm_pipeline/api/control.py`
    - `grep -q "_require_clerk_jwt_control" packages/pipeline/src/eisenbalm_pipeline/api/control.py` in the adjudicate handler AND the adjudicate handler does NOT reference `_require_trigger_secret`
    - `grep -q "_emit_audit" packages/pipeline/src/eisenbalm_pipeline/api/control.py` (adjudicate audits pick+reason)
    - `grep -q "_resume_paused_run" packages/pipeline/src/eisenbalm_pipeline/api/control.py`
    - `cd packages/pipeline && uv run pytest tests/test_adjudication_bridge.py -x -q` exits 0
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest -x -q` green (bridge + resume refactor, no regression)
- The bridge is Clerk-guarded, audit-logs pick+reason, and reuses the single resume implementation
</verification>

<success_criteria>
- `POST /issues/{run_id}/adjudicate` exists, Clerk-guarded, 409s on non-paused runs, audit-logs pick+reason, resumes server-side
- Operator never handles the trigger secret; reason logged via audit_log only
- One resume implementation shared by both entry points; existing resume tests stay green
</success_criteria>

<output>
After completion, create `.planning/phases/37-run-monitor-v2-signal-desk/37-02-SUMMARY.md`
</output>
