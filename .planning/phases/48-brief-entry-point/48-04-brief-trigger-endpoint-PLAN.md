---
phase: 48-brief-entry-point
plan: 04
type: execute
wave: 3
depends_on: ["48-03", "48-02"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/api/control.py
autonomous: true
requirements: [ENT-02, ENT-04]

must_haves:
  truths:
    - "POST /pipeline/run/brief accepts premise, peg, organization, optional source material and starts a brief run"
    - "It reuses the one-at-a-time (409) and budget (409) start gates via a shared helper"
    - "It 422s on an empty organization name"
    - "It builds the human org as a synthetic CharityCandidate and the 6-field Brief, then calls _start_run(entry_mode='brief', agent_keys_override=<reduced set>)"
    - "It emits a run.triggered audit row marked entryMode=brief"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/control.py"
      provides: "OrganizationInput + BriefRunBody models, _enforce_start_gates helper, POST /pipeline/run/brief"
      contains: "/pipeline/run/brief"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/control.py::pipeline_run_brief"
      to: "packages/pipeline/src/eisenbalm_pipeline/api/runs.py::_start_run"
      via: "calls _start_run(entry_mode='brief', winning_charity, brief, source_material, agent_keys_override)"
      pattern: "entry_mode=\"brief\""
---

<objective>
Add the Clerk-guarded brief-trigger endpoint `POST /pipeline/run/brief` in `api/control.py` (alongside `pipeline_run`/`pipeline_tick`, NOT in `api/brief.py` which is the run-scoped content-edit family). It validates the human brief, reuses the exact one-at-a-time + budget start gates `pipeline_run` enforces (factored into a shared helper to prevent drift), builds the human org + 6-field Brief, and calls the extended `_start_run` with `entry_mode='brief'` + the reduced agent-runs queue (ENT-02). The org it seeds flows through `verify_candidates` (ENT-04).

Purpose: turn `test_brief_run_endpoint.py` (48-02, currently skipped) green, and give the console (48-05) a real endpoint to call.
Output: `POST /pipeline/run/brief` + `BriefRunBody`/`OrganizationInput` + a shared `_enforce_start_gates` helper.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/48-brief-entry-point/48-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/api/control.py
@packages/pipeline/src/eisenbalm_pipeline/api/runs.py
@docs/API_CONTRACTS.md

<interfaces>
<!-- Exact current shapes in control.py the endpoint mirrors + reuses. -->

pipeline_run (control.py L212-284) already imports/uses: `_require_clerk_jwt_control` (Depends),
`_start_run` (from api.runs), `_emit_audit`, `_cc.convex_query`/`convex_mutation`,
`would_exceed_monthly_cap`. Its gate block (L233-263) is:
  1. one-at-a-time: `latest = await _cc.convex_query(http, "runs:latest", {"workspace_id": WORKSPACE_ID})`;
     if `latest and latest.get("status") == "running"` → 409.
  2. budget: read pipeline_config via `pipelineConfig:getAll`, parse rows, then
     `over, info = await would_exceed_monthly_cap(http, monthly_cap_usd=float(_pc.get("monthly_cap_usd", 0.0)))`;
     if `over` → 409.

`SECTION_WRITERS` is already imported at module top (control.py L46, from graph.builder).

_start_run (extended by 48-03) now accepts: entry_mode, winning_charity, brief, source_material,
agent_keys_override.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extract the start-gate block into a shared _enforce_start_gates(http) helper (byte-equivalent for pipeline_run)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/control.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py (pipeline_run gate block, L233-263)
    - packages/pipeline/tests/test_control.py (existing pipeline_run tests that must stay green)
    - .planning/phases/48-brief-entry-point/48-RESEARCH.md §"Don't Hand-Roll" (~L295-302) and §"Open Questions" #1 (~L422-425)
  </read_first>
  <action>
    Add `async def _enforce_start_gates(http: Any) -> None:` to control.py that contains the EXACT one-at-a-time + budget logic currently inlined in `pipeline_run` (L233-263), raising the same two 409 `HTTPException`s with the same detail strings. Then refactor `pipeline_run` to call `await _enforce_start_gates(http)` in place of the inlined block — leaving its behavior byte-equivalent (same checks, same 409 details, same order). Do NOT change `pipeline_tick`'s inline gates (it has an extra scheduled-publish sweep + skip-not-raise semantics — leave it as-is; the helper is only for the two endpoints that raise 409).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_control.py -x</automated>
  </verify>
  <acceptance_criteria>
    - `grep "_enforce_start_gates" packages/pipeline/src/eisenbalm_pipeline/api/control.py` matches the definition AND a call inside `pipeline_run`.
    - `grep -c "would_exceed_monthly_cap" packages/pipeline/src/eisenbalm_pipeline/api/control.py` shows the budget check is now centralized (not duplicated inline in pipeline_run).
    - `cd packages/pipeline && uv run pytest tests/test_control.py` exits 0 (existing one-at-a-time + budget 409 tests still green — byte-equivalent behavior).
  </acceptance_criteria>
  <done>The start-gate logic lives in one helper both trigger endpoints share — no drift between two copies (D-15). pipeline_run behavior unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Add BriefRunBody/OrganizationInput + POST /pipeline/run/brief</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/control.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py (the pipeline_run endpoint + _emit_audit + AdjudicateBody Pydantic precedent)
    - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py (the D-14 synthetic-winner CharityCandidate shape to copy)
    - packages/pipeline/tests/test_brief_run_endpoint.py (the assertions this task must satisfy)
    - docs/API_CONTRACTS.md §48 (the endpoint contract this implements)
    - .planning/phases/48-brief-entry-point/48-RESEARCH.md §"Pattern 3" (~L190-275) incl. the voiceIntention-blank + endpoint-body code
  </read_first>
  <action>
    Add two Pydantic models (near the existing `AdjudicateBody`): `class OrganizationInput(BaseModel): name: str; website: Optional[str] = None; charityNavigatorUrl: Optional[str] = None; guidestarUrl: Optional[str] = None` and `class BriefRunBody(BaseModel): issueNumber: Optional[int] = None; premise: str; peg: str; organization: OrganizationInput; sourceMaterial: Optional[str] = None`.
    Add the endpoint:
    `@router.post("/pipeline/run/brief")` → `async def pipeline_run_brief(request: Request, body: BriefRunBody, claims: dict = Depends(_require_clerk_jwt_control)) -> dict:`
      - 422 if `not body.organization.name.strip()` (`raise HTTPException(422, "organization.name is required")`).
      - `operator_id = claims.get("sub")`; `http = getattr(request.app.state, "convex_http", None)`.
      - `await _enforce_start_gates(http)` (reuses the one-at-a-time + budget 409s).
      - Build `winning_charity: dict` as a CharityCandidate copying editor.py's D-14 synthetic-winner shape: `name=body.organization.name`, `website=body.organization.website or ""`, `charityNavigatorUrl=body.organization.charityNavigatorUrl`, `guidestarUrl=body.organization.guidestarUrl`, and every remaining field defaulted (`location="", foundingYear=None, assetRange="", focusArea="", missionStatement="", scoutSummary="", whyOverlooked="", advocateArgument=None, advocateScore=None`).
      - Build `brief: dict = {"premise": body.premise, "currentPeg": body.peg, "centralClaim": "", "readerEffect": "", "knownRisks": "", "voiceIntention": ""}` — the four unmapped fields start BLANK (voiceIntention blank, NOT defaulted from style_brief, because calibrator hasn't run yet and the endpoint must return {runId} immediately; the operator fills them via the shipped BRF-06 strengthen — RESEARCH Pattern 3).
      - Define `BRIEF_AGENT_KEYS = ["calibrator", "verify_candidates", "researcher", "verify_research", *SECTION_WRITERS, "validate_sections", "qa", "editor_final", "publisher"]`.
      - `run_id = await _start_run(request.app, issue_number=body.issueNumber, trigger_source="manual", triggered_by=operator_id, entry_mode="brief", winning_charity=winning_charity, brief=brief, source_material=body.sourceMaterial, agent_keys_override=BRIEF_AGENT_KEYS)`.
      - `await _emit_audit(http, actor_id=operator_id or "unknown", action="run.triggered", resource_type="run", resource_id=run_id, after=json.dumps({"entryMode": "brief", "organization": body.organization.name}))`.
      - `return {"runId": run_id}`.
    Do NOT overload `RunWeeklyBody`/`/pipeline/run`. Do NOT call `_require_graph` differently than pipeline_run does (pipeline_run does not require the graph in the handler — mirror it).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_brief_run_endpoint.py tests/test_control.py -x</automated>
  </verify>
  <acceptance_criteria>
    - `grep '/pipeline/run/brief' packages/pipeline/src/eisenbalm_pipeline/api/control.py` matches the route decorator.
    - `grep 'class BriefRunBody' packages/pipeline/src/eisenbalm_pipeline/api/control.py` and `grep 'class OrganizationInput' ...` both match.
    - `grep 'entry_mode="brief"' packages/pipeline/src/eisenbalm_pipeline/api/control.py` matches inside the _start_run call, with an `agent_keys_override=BRIEF_AGENT_KEYS` argument.
    - `grep 'BRIEF_AGENT_KEYS' packages/pipeline/src/eisenbalm_pipeline/api/control.py` shows the reduced list EXCLUDES signal_editor/scout/advocate/editor_gate_1/chronicler.
    - `cd packages/pipeline && uv run pytest tests/test_brief_run_endpoint.py` exits 0 (422-empty-org, 409-gate-reuse, 200-{runId}, audit-emitted assertions green).
  </acceptance_criteria>
  <done>POST /pipeline/run/brief starts a real brief run (entry_mode='brief', reduced queue), 422s on empty org, reuses the shared gates, and audits the trigger. (ENT-02; the seeded org reaches verify_candidates → ENT-04.)</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/test_brief_run_endpoint.py tests/test_control.py` green.
- The endpoint lives in `api/control.py` (not `api/brief.py`) and never mints its own run_id (it delegates to `_start_run`).
</verification>

<success_criteria>
A Clerk-guarded `POST /pipeline/run/brief` exists, validates and seeds the human brief, reuses the shared one-at-a-time + budget gates, queues the reduced brief node set, and returns `{runId}` immediately — the operator's brief becomes a real run entering at the Researcher.
</success_criteria>

<output>
After completion, create `.planning/phases/48-brief-entry-point/48-04-SUMMARY.md`
</output>
