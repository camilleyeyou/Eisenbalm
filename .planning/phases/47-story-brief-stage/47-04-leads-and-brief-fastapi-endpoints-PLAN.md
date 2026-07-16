---
phase: 47-story-brief-stage
plan: 04
type: execute
wave: 2
depends_on: ["47-01"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/api/leads.py
  - packages/pipeline/src/eisenbalm_pipeline/api/brief.py
  - packages/pipeline/src/eisenbalm_pipeline/api/revision.py
  - packages/pipeline/src/eisenbalm_pipeline/api/main.py
  - packages/pipeline/tests/test_leads_endpoints.py
  - packages/pipeline/tests/test_brief_endpoints.py
autonomous: true
requirements: [BRF-02, BRF-05, BRF-06]
must_haves:
  truths:
    - "POST /issues/{run_id}/leads/{lead_id}/require flips a lead to 'required' (no reason); POST .../remove requires a non-empty reason (422 if empty), writes audit_log + a Decision-log entry, and flips it to 'removed' — via the Clerk-guarded FastAPI boundary, never a bare Convex mutation"
    - "PATCH /issues/{run_id}/brief writes one Brief field through the guarded content boundary (Clerk → briefs:patch → audit_log)"
    - "POST /issues/{run_id}/brief/{field}/strengthen/preview returns a proposed value read-only (NO mutation, NO audit); .../apply writes the field + audit_log + Decision-log entry, reusing the revision engine generalized to field scope"
    - "revision.py::_fetch_brief_context reads the real briefs:byRunId row (falling back to the legacy Sanity proxy, never crashing)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/leads.py"
      provides: "require/remove lead endpoints mirroring factcheck.py keep_claim/delete_claim"
      exports: ["router"]
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/brief.py"
      provides: "PATCH brief + field-strengthen preview/apply (field-scoped revision)"
      exports: ["router"]
  key_links:
    - from: "api/leads.py remove endpoint"
      to: "storyLeads:setStatus + _emit_audit(reason, run_id)"
      via: "audit-before-write, 422 on empty reason"
      pattern: "storyLeads:setStatus"
    - from: "api/revision.py::_fetch_brief_context"
      to: "briefs:byRunId"
      via: "real Convex read replacing the degraded Sanity-proxy stub"
      pattern: "briefs:byRunId"
---

<objective>
Build the FastAPI write boundaries for Stage 1: the leads Require/Remove pair (BRF-02) and the Brief edit + field-strengthen pair (BRF-05 edit / BRF-06). Every reason-required or content-mutating action routes through the Clerk-guarded pipeline boundary (`_require_clerk_jwt_control` → write → `_emit_audit`) exactly like the Phase-42 `factcheck.py` and Phase-45 `revision.py` precedents — "nothing silent." Also wire `revision.py::_fetch_brief_context` to read the real `briefs:byRunId` row so the "Match the brief" chip on later revisions uses the operator-edited Brief.

Purpose: The BRF-02 write-boundary split is load-bearing (RESEARCH Pattern 3): Require (no reason) MAY be a bare mutation but is routed here for consistency; Remove (reason mandatory + Decision log) MUST be FastAPI-routed. BRF-06 reuses ONE revision core (no third fork).
Output: `api/leads.py`, `api/brief.py`, `_fetch_brief_context` wired, routers registered, endpoint tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/47-story-brief-stage/47-CONTEXT.md
@.planning/phases/47-story-brief-stage/47-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
Endpoints (declared in API_CONTRACTS §47, landed here):
```
POST  /issues/{run_id}/leads/{lead_id}/require   body {}                 -> 200 {leadId, status:'required'}
POST  /issues/{run_id}/leads/{lead_id}/remove    body {reason}           -> 200 {leadId, status:'removed'}  (422 if reason empty)
PATCH /issues/{run_id}/brief                      body {field, value}     -> 200 {resolution:'brief_field_edited'}
POST  /issues/{run_id}/brief/{field}/strengthen/preview  body {currentValue}  -> 200 {proposedText, whatChanged}
POST  /issues/{run_id}/brief/{field}/strengthen/apply    body {newText}       -> 200 {resolution:'brief_field_strengthened'}
```
`field` ∈ premise|currentPeg|centralClaim|readerEffect|knownRisks|voiceIntention (reject others 422).

Precedents to mirror:
- `api/factcheck.py::keep_claim`/`delete_claim` — reason-required, 422 on empty, `_emit_audit(..., reason=, run_id=)`, `requirePipelineSecret`-guarded Convex write (storyLeads:setStatus is the guarded path registered in 47-01).
- `api/revision.py::preview_passage_revision`/`apply_passage_revision` — preview is read-only (no audit); apply writes + audits; both use `_build_directive`, `acomplete`, `lib/budget.would_exceed_run_cap`.
- Shared helpers: `api/control.py::_require_clerk_jwt_control`, `_emit_audit`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: api/leads.py — Require/Remove lead endpoints (BRF-02)</name>
  <read_first>
    packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py (the module RATIONALE docstring L1-24 + `keep_claim` L184-235 + `delete_claim` — the reason-required, 422-on-empty, audit-before-write, `_emit_audit(reason=, run_id=)` shape to copy exactly). packages/pipeline/src/eisenbalm_pipeline/api/main.py L201-210 (`include_router` registration order). convex/storyLeads.ts (the `setStatus` mutation landed in 47-01). 47-RESEARCH.md §"Pattern 3".
  </read_first>
  <action>
    Create `api/leads.py` with an `APIRouter` and two POST endpoints per the interfaces block. Both: `_require_clerk_jwt_control` guard; call the `storyLeads:setStatus` Convex mutation (via the guarded pipeline client) with the lead id + target status; `_emit_audit`. For `/remove`: `reason = (body.reason or "").strip()`; if empty return `422` with the same error body shape as `keep_claim` ("A reason is required to remove this lead."); pass `reason=` + `run_id=` to `_emit_audit` so it projects into the Decision log. For `/require`: no reason (call `_emit_audit` without the `reason` kwarg so it stays out of the Decision log per `isDecisionRow`, matching the Require-is-not-a-decision framing — or pass reason if the team wants both shown; keep consistent with factcheck's Confirm-vs-Keep split). Register `leads.router` in `main.py`.
    Create `tests/test_leads_endpoints.py`: Require flips status (mocked convex asserted called with 'required', no reason audit); Remove with empty reason → 422; Remove with reason → 200 + `storyLeads:setStatus` called with 'removed' + `_emit_audit` called with the reason (mirror `test_factcheck_endpoints.py`).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_leads_endpoints.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `api/leads.py` exports `router` with `/leads/{lead_id}/require` and `/leads/{lead_id}/remove`
    - Remove returns 422 when reason is empty; calls `storyLeads:setStatus` with `'removed'` and `_emit_audit(reason=..., run_id=...)` when present
    - `leads.router` appears in an `app.include_router(...)` line in `main.py`
    - `pytest tests/test_leads_endpoints.py` green
  </acceptance_criteria>
  <done>Require/Remove route through the audited FastAPI boundary; Remove is reason-gated and Decision-logged.</done>
</task>

<task type="auto">
  <name>Task 2: api/brief.py — PATCH brief + field-strengthen preview/apply; wire _fetch_brief_context</name>
  <read_first>
    packages/pipeline/src/eisenbalm_pipeline/api/revision.py (`_fetch_brief_context` L149-188 — the degraded Sanity-proxy stub that explicitly anticipates this phase; `preview_passage_revision` L194+ / `apply_passage_revision` L319+ — the read-only-preview / audited-apply shapes + `_build_directive`, `acomplete`, budget guard). convex/briefs.ts (`patch` + `byRunId` landed in 47-01). packages/pipeline/src/eisenbalm_pipeline/lib/budget.py (`would_exceed_run_cap`). 47-RESEARCH.md §"Pattern 6" (field-scoped generalization; concurrency note — no optimistic token needed, log before/after in audit).
  </read_first>
  <action>
    Create `api/brief.py` with an `APIRouter`:
    - `PATCH /issues/{run_id}/brief` body `{field, value}`: `_require_clerk_jwt_control`; validate `field` is one of the six (else 422); `briefs:patch` the single field; `_emit_audit(reason omitted or field-name, run_id=, before=<prev>, after=<value>)` (guarded content-boundary edit per D-12).
    - `POST /issues/{run_id}/brief/{field}/strengthen/preview` body `{currentValue}`: read-only — budget-guard (409 if would exceed run cap), build a "strengthen this field" directive (reuse a small subset of `_build_directive`; a single "strengthen" action, not the full 7-chip picker), call `acomplete`, return `{proposedText, whatChanged}`. NO Convex write, NO `_emit_audit`.
    - `POST /issues/{run_id}/brief/{field}/strengthen/apply` body `{newText}`: `briefs:patch` the field + `_emit_audit(run_id=, reason=..., before/after)` → Decision log; return `{resolution:'brief_field_strengthened'}`.
    In `api/revision.py`: replace `_fetch_brief_context`'s body to prefer a `briefs:byRunId` read (resolve the run's `runId` from the sanity id/run context as the existing call site provides), formatting the six fields; keep the Sanity-proxy fallback for legacy runs and any error ("never crashes" stays true).
    Register `brief.router` in `main.py`.
    Create `tests/test_brief_endpoints.py`: preview emits NO audit row (assert `_emit_audit` not called); apply writes `briefs:patch` + `_emit_audit`; PATCH validates field + writes; unknown field → 422; budget-exceeded preview → 409. Extend/keep `tests/test_revision.py` (or the existing REV test file) green after the `_fetch_brief_context` change.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_brief_endpoints.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `api/brief.py` exports `router` with PATCH `/brief`, `/brief/{field}/strengthen/preview`, `/brief/{field}/strengthen/apply`
    - preview emits NO audit and NO Convex write (test asserts `_emit_audit` uncalled); apply emits both
    - unknown `field` → 422 on PATCH and strengthen paths
    - `revision.py::_fetch_brief_context` contains `briefs:byRunId` and still degrades without crashing (existing revision test file green)
    - `brief.router` registered in `main.py`; `pytest tests/test_brief_endpoints.py` green
  </acceptance_criteria>
  <done>Brief edits and field-strengthen route through one guarded, audited boundary reusing the revision engine; the "Match the brief" chip now reads the live Brief.</done>
</task>

</tasks>

<verification>
- `pytest tests/test_leads_endpoints.py tests/test_brief_endpoints.py` green; existing revision test green.
- All new endpoints registered in main.py; preview stays audit-free; remove/apply audit + Decision-log.
</verification>

<success_criteria>
The four Stage-1 write boundaries exist, are Clerk-guarded, reason-gated where required, and reuse the established audit + revision infrastructure — no second resume path, no third revision fork.
</success_criteria>

<output>
After completion, create `.planning/phases/47-story-brief-stage/47-04-SUMMARY.md`.
</output>
