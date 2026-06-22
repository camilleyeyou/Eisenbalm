---
phase: 24-prompt-editor-versioning
plan: 06
type: execute
wave: 6
depends_on: [24-03, 24-05b]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/prompts/voice_constraints.md
  - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py
  - packages/pipeline/src/eisenbalm_pipeline/api/agents.py
  - packages/pipeline/src/eisenbalm_pipeline/api/main.py
  - packages/pipeline/scripts/seed_phase24_assets.py
  - packages/pipeline/tests/test_prompt_version_seeds.py
  - packages/pipeline/tests/test_voice_db_override.py
  - packages/pipeline/tests/test_test_run.py
autonomous: true
requirements: [PRM-05, PRM-06]
must_haves:
  truths:
    - "VOICE_CONSTRAINTS is a versioned voice_constraints prompt_versions row, fed to assemble_voice at run start via a db override, without breaking the Phase-16 import-time sentinel or test_voice.py invariants"
    - "Operator can test-run a single agent against supplied/prior-real/manual/fixture input and get output + cost"
    - "The test-run endpoint calls acomplete directly and writes NOTHING to agent_runs / agent_run_payloads / deliberationEvents / real run tables"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/agents.py"
      provides: "POST /agents/{key}/test-run FastAPI router"
      contains: "test-run"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/voice.py"
      provides: "assemble_voice db_voice_override param"
      contains: "db_voice_override"
  key_links:
    - from: "calibrator assemble_voice call"
      to: "RunConfig.voice_constraints"
      via: "db_voice_override=state['config'].voice_constraints"
      pattern: "db_voice_override"
    - from: "test-run endpoint"
      to: "acomplete"
      via: "direct call, no @agent_node decorator"
      pattern: "acomplete"
---

<objective>
Two pipeline-backend deliverables:

1. **VOICE_CONSTRAINTS versioning (PRM-06):** seed `voice_constraints` as a byte-verified v1 row;
   add a `db_voice_override` param to `assemble_voice` so the active DB row feeds the run-start voice
   WITHOUT touching the Phase-16 import-time sentinel or the `test_voice.py` invariant
   (`assemble_voice(None) == VOICE_CONSTRAINTS`); thread it through the Calibrator from
   `RunConfig.voice_constraints`.
2. **Single-agent test-run backend (PRM-05):** a new `api/agents.py` router exposing
   `POST /agents/{key}/test-run` that calls `acomplete` directly (no graph, no `@agent_node`
   decorator), supports the four input modes (prior-real from `agent_run_payloads`, unsaved draft,
   manual variables, canned fixture), returns output + cost, and writes to NO real run table.

Purpose: PRM-05 (prioritized) + PRM-06.
Output: voice_constraints.md, voice.py override, calibrator thread, api/agents.py + main.py mount,
seed extension, and Plan-01 tests (test_voice_db_override, test_test_run, voice seed) made GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/24-prompt-editor-versioning/24-CONTEXT.md
@.planning/phases/24-prompt-editor-versioning/24-RESEARCH.md
@docs/API_CONTRACTS.md
@packages/pipeline/src/eisenbalm_pipeline/lib/voice.py
@packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py
@packages/pipeline/src/eisenbalm_pipeline/api/runs.py
@packages/pipeline/src/eisenbalm_pipeline/api/auth.py

<interfaces>
assemble_voice(narrator: Optional[dict]) -> str (voice.py:155). Invariant test:
  assemble_voice(None) == VOICE_CONSTRAINTS; sentinel asserts VOICE_CONSTRAINTS == baseline at import.
acomplete(agent_id, run_id, messages, response_format=None) -> (content, usage);
  usage = {tokens_in, tokens_out, usd, resolved_model}. Honors EISENBALM_STUB_MODE.
require_clerk_jwt FastAPI dep returns {"sub": <clerkUserId>}.
agent_run_payloads read: convex_query "agentRuns:payloadByRunIdAgentKey" {runId, agentKey} -> {inputSnapshot, outputSnapshot}.
main.py mounts routers via app.include_router(...). RunConfig.voice_constraints added by Plan 03.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Seed voice_constraints + add db_voice_override to assemble_voice; thread via Calibrator</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/prompts/voice_constraints.md, packages/pipeline/src/eisenbalm_pipeline/lib/voice.py, packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py, packages/pipeline/tests/test_prompt_version_seeds.py, packages/pipeline/tests/test_voice_db_override.py, packages/pipeline/scripts/seed_phase24_assets.py</files>
  <behavior>
    - load_prompt("voice_constraints") == VOICE_CONSTRAINTS (byte-equal)
    - assemble_voice(None) == VOICE_CONSTRAINTS (unchanged invariant — sentinel preserved)
    - assemble_voice(None, db_voice_override=VOICE_CONSTRAINTS) == VOICE_CONSTRAINTS
    - assemble_voice(None, db_voice_override="CUSTOM") == "CUSTOM"
    - existing test_voice.py + Phase-16 import sentinel stay green
  </behavior>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py (full — assemble_voice + sentinels)
    - .planning/phases/24-prompt-editor-versioning/24-RESEARCH.md (Pattern 6 — exact override semantics + Pitfall 4)
    - packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py (where assemble_voice / VOICE_CONSTRAINTS is used)
    - packages/pipeline/tests/test_voice.py (invariants that must stay green)
  </read_first>
  <action>
    voice_constraints.md: write VOICE_CONSTRAINTS verbatim between PROMPT START/END so
    load_prompt("voice_constraints") == VOICE_CONSTRAINTS byte-for-byte.

    voice.py: change `assemble_voice(narrator)` to `assemble_voice(narrator, db_voice_override: Optional[str] = None)`.
    When `db_voice_override` is not None, RETURN it directly (the DB content is already the full assembled
    voice string). When None, keep the EXISTING composition (persona_block + _SEPARATOR + UNIVERSAL_CORE).
    Leave the import-time sentinels and VOICE_CONSTRAINTS constant 100% unchanged.

    calibrator.py: where it computes the voice (currently `assemble_voice(resolved_narrator)` or uses
    VOICE_CONSTRAINTS), read `db_voice = state["config"].voice_constraints if state.get("config") else None`
    and pass `assemble_voice(resolved_narrator, db_voice_override=db_voice)`. The `.replace("{VOICE_CONSTRAINTS}", ...)`
    on the calibrator SYSTEM prompt stays — but its substituted value should now be the resolved voice
    (db override when present, else VOICE_CONSTRAINTS) to keep voice editing effective end-to-end.

    Tests: complete test_voice_db_override.py (the three Plan-01 cases) and add
    test_voice_constraints_seed_byte_equivalence to test_prompt_version_seeds.py. Extend
    seed_phase24_assets.py to also seed 'voice_constraints' with a byte-verification assert.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_voice.py tests/test_voice_db_override.py tests/test_prompt_version_seeds.py::test_voice_constraints_seed_byte_equivalence -x -q 2>&1 | tail -6</automated>
  </verify>
  <acceptance_criteria>
    - All listed tests PASS (test_voice.py invariants + db_override cases + voice seed byte-equivalence)
    - `grep -q "db_voice_override" packages/pipeline/src/eisenbalm_pipeline/lib/voice.py`
    - The Phase-16 sentinel block (`_PHASE_14_VOICE_CONSTRAINTS_BASELINE` assert) is byte-unchanged: `git diff packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` shows NO change inside the sentinel asserts (lines 116-152)
    - `grep -q "db_voice_override=db_voice\|db_voice_override=" packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py`
    - `load_prompt("voice_constraints")` byte-equals VOICE_CONSTRAINTS (asserted by the seed test)
  </acceptance_criteria>
  <done>Voice is a versioned editable asset fed at run start; all voice invariants green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Build POST /agents/{key}/test-run router (four input modes, cost, full isolation)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/agents.py, packages/pipeline/src/eisenbalm_pipeline/api/main.py, packages/pipeline/tests/test_test_run.py</files>
  <behavior>
    - POST /agents/scout/test-run returns 200 with {output, cost_usd, tokens_in, tokens_out, model, duration_ms}
    - During a test-run, NO convex mutation targeting agent_runs / agent_run_payloads / deliberationEvents / pipelineRuns / runs is invoked
    - prior_run_id mode loads input from agentRuns:payloadByRunIdAgentKey
    - canned-fixture mode uses a built-in SAMPLE_FIXTURES[agent_key] when no variables/prior_run_id given
  </behavior>
  <read_first>
    - .planning/phases/24-prompt-editor-versioning/24-RESEARCH.md (Pattern 5 — endpoint shape, isolation seam, four input modes; Pitfall 8)
    - packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py (CONFIRM the decorator wraps via functools.wraps — bypass it by NOT invoking the decorated node; call acomplete directly)
    - packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py (acomplete signature + usage shape)
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py (router/auth/registration pattern)
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py (include_router pattern)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (convex_query for prior-real input)
    - docs/API_CONTRACTS.md §3A (the contract authored in Plan 01)
  </read_first>
  <action>
    Create api/agents.py:
    - `router = APIRouter(prefix="/agents")`.
    - Pydantic `TestRunRequest { workspace_id: str, draft_prompt: str, draft_user_template: Optional[str] = None,
      variables: dict[str,str] = {}, prior_run_id: Optional[str] = None }` and
      `TestRunResponse { output, cost_usd, tokens_in, tokens_out, model, duration_ms }`.
    - `SAMPLE_FIXTURES: dict[str, dict]` — one representative variable set per agentKey (canned mode, D-04).
    - `@router.post("/{agent_key}/test-run")` with `_: dict = Depends(require_clerk_jwt)`.
    - Resolve variable values by mode precedence: prior_run_id (load from
      `agentRuns:payloadByRunIdAgentKey`, deserialize inputSnapshot) > explicit `variables` > SAMPLE_FIXTURES.
    - Build messages: system = `draft_prompt` with `{token}` placeholders substituted from variables;
      user = `draft_user_template` (if given) substituted, else a minimal default. Use the SAME
      `.replace("{token}", v)` substitution convention.
    - Call `content, usage = await acomplete(agent_id=agent_key, run_id=f"test-{uuid4()}", messages=messages, response_format=None)`.
      Set EISENBALM_STUB_MODE-respecting behavior (works in stub mode for tests).
    - Return TestRunResponse with output=str(content), cost_usd=usage["usd"], tokens_in/out, model=usage["resolved_model"],
      duration_ms measured locally. Do NOT call any agent_runs/agent_run_payloads/deliberationEvents mutation.
    main.py: `app.include_router(agents_router)`.
    Complete test_test_run.py (the two Plan-01 cases) and add the prior_run_id + fixture mode cases.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_test_run.py -x -q 2>&1 | tail -6</automated>
  </verify>
  <acceptance_criteria>
    - `cd packages/pipeline && uv run pytest tests/test_test_run.py -x -q` PASSES (output+cost returned; no real-table writes)
    - `grep -q "@router.post" packages/pipeline/src/eisenbalm_pipeline/api/agents.py` and `grep -q "acomplete" packages/pipeline/src/eisenbalm_pipeline/api/agents.py`
    - `grep -q "agents" packages/pipeline/src/eisenbalm_pipeline/api/main.py` (router mounted)
    - api/agents.py does NOT reference agent_runs/agent_run_payloads WRITE mutations: `grep -c "savePayload\|agentRuns:started\|agentRuns:completed\|deliberationEvents:insert" packages/pipeline/src/eisenbalm_pipeline/api/agents.py` returns 0
    - `grep -q "SAMPLE_FIXTURES" packages/pipeline/src/eisenbalm_pipeline/api/agents.py` (canned mode) and `grep -q "payloadByRunIdAgentKey" packages/pipeline/src/eisenbalm_pipeline/api/agents.py` (prior-real mode)
  </acceptance_criteria>
  <done>Test-run endpoint live with four input modes, cost from acomplete, full real-table isolation.</done>
</task>

<task type="auto">
  <name>Task 3: Full pipeline regression + populate VALIDATION.md verification map</name>
  <files>.planning/phases/24-prompt-editor-versioning/24-VALIDATION.md</files>
  <read_first>
    - .planning/phases/24-prompt-editor-versioning/24-VALIDATION.md (Per-Task Verification Map + Wave 0 Requirements stubs)
    - .planning/phases/24-prompt-editor-versioning/24-RESEARCH.md (Validation Architecture → Phase Requirements → Test Map)
  </read_first>
  <action>
    Run the full pipeline suite and confirm green. Then finalize 24-VALIDATION.md:
    - The Per-Task Verification Map table was PRE-POPULATED by the planner (one row per Phase 24 task,
      Plans 01-08, each mapping to its PRM requirement + test type + automated command). Verify each row's
      automated command still matches the task as executed; update any command that drifted during
      execution. Flip each row's Status to ✅ now that the backend is green.
    - Check off the Wave 0 Requirements (byte-equivalence oracles, voice invariants preserved, Convex
      mutation tests, dispatch-control harness) now that they exist.
    - Set `nyquist_compliant: true` and `wave_0_complete: true` in the frontmatter.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest -x -q 2>&1 | tail -3 && grep -q "nyquist_compliant: true" /Users/user/Desktop/Eisenbalm/.planning/phases/24-prompt-editor-versioning/24-VALIDATION.md && echo VALIDATION_DONE</automated>
  </verify>
  <acceptance_criteria>
    - `cd packages/pipeline && uv run pytest -x -q` exits 0 (full suite green)
    - 24-VALIDATION.md frontmatter has `nyquist_compliant: true` and `wave_0_complete: true`
    - The Per-Task Verification Map has ≥9 rows (one per plan task group) — `grep -c "PRM-0" .planning/phases/24-prompt-editor-versioning/24-VALIDATION.md` returns ≥9
  </acceptance_criteria>
  <done>Pipeline backend fully green; validation map populated; nyquist compliant.</done>
</task>

</tasks>

<verification>
- Voice versioned + run-start-fed without sentinel breakage; test-run endpoint isolated + cost-returning.
- Full pipeline suite green; VALIDATION.md complete.
</verification>

<success_criteria>
PRM-06 (versioned editable voice) and PRM-05 (single-agent test-run) backends are done and tested;
the dashboard UI plan can call the endpoint and edit the voice asset like any other prompt.
</success_criteria>

<output>
After completion, create `.planning/phases/24-prompt-editor-versioning/24-06-SUMMARY.md`
</output>
