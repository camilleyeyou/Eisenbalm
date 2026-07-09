---
phase: 38-prompt-lab-evals-eval-center
plan: 02
type: execute
wave: 2
depends_on: ["38-01"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/evals/__init__.py
  - packages/pipeline/src/eisenbalm_pipeline/evals/scenarios.json
  - packages/pipeline/src/eisenbalm_pipeline/evals/loader.py
  - packages/pipeline/src/eisenbalm_pipeline/api/eval.py
  - packages/pipeline/src/eisenbalm_pipeline/api/main.py
  - packages/pipeline/tests/evals/__init__.py
  - packages/pipeline/tests/evals/test_scenario_loader.py
  - packages/pipeline/tests/api/test_eval_scenarios.py
  - apps/dispatch-control/lib/evalScenarioClient.ts
autonomous: true
requirements: [EVL-01]
must_haves:
  truths:
    - "Golden scenarios exist as repo fixtures, each runnable against a single agent through the existing test-run/score endpoints"
    - "The loader parses + Pydantic-validates the fixtures and can filter by agentKey"
    - "GET /eval/scenarios returns the parsed fixtures as JSON so the Next.js Eval Center + drawer can read repo-sourced scenarios without duplication"
    - "Every scenario targets a test-run-REPLICABLE agentKey (flat-substitution), never a build_section_writer_prompt agent"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/evals/scenarios.json"
      provides: "8 golden scenario fixtures (D-01/D-03)"
      contains: "scoringTarget"
    - path: "packages/pipeline/src/eisenbalm_pipeline/evals/loader.py"
      provides: "Scenario Pydantic model + list_scenarios(agent_key?) + get_scenario(id)"
      exports: ["Scenario", "list_scenarios", "get_scenario"]
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/eval.py"
      provides: "GET /eval/scenarios read endpoint"
      contains: "/scenarios"
    - path: "apps/dispatch-control/lib/evalScenarioClient.ts"
      provides: "fetchScenarios(agentKey?) client mirroring testRunClient pipelineBaseUrl()"
      exports: ["fetchScenarios", "EvalScenario"]
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/eval.py"
      to: "evals/loader.py list_scenarios"
      via: "import + call in the GET handler"
      pattern: "list_scenarios"
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/main.py"
      to: "api/eval.py router"
      via: "app.include_router(eval.router)"
      pattern: "include_router\\(eval"
    - from: "apps/dispatch-control/lib/evalScenarioClient.ts"
      to: "GET /eval/scenarios"
      via: "fetch(`${pipelineBaseUrl()}/eval/scenarios`)"
      pattern: "/eval/scenarios"
---

<objective>
Create the golden-scenario fixtures (D-01) as a single repo manifest, a Pydantic loader, a `GET /eval/scenarios` pipeline read endpoint (Pitfall 6 — the cross-process read path the dashboard needs), and the TS client the Eval Center + drawer call. All scenarios target test-run-replicable agentKeys only (Pitfall 5).

Purpose: EVL-01 — the scenario primitive the drawer (Plan 05) and Eval Center (Plan 06) consume.
Output: evals/scenarios.json + loader.py + api/eval.py (GET) + evalScenarioClient.ts.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/38-prompt-lab-evals-eval-center/38-RESEARCH.md
@docs/API_CONTRACTS.md
@apps/dispatch-control/lib/testRunClient.ts

<interfaces>
<!-- The exact variable keys each agentKey accepts. Scenario.input MUST use ONLY these keys (Pitfall 5). -->
SAMPLE_FIXTURES (packages/pipeline/.../api/agents.py) is the authoritative source of valid variable keys per agentKey. Test-run-REPLICABLE (flat `.replace("{token}")`) agentKeys ONLY: scout, advocate, calibrator, editor_gate1, editor_final, researcher, game, design, bonus_* (confirm the exact bonus key, e.g. `bonus_spec_ad`, against agents.py SAMPLE_FIXTURES + apps/dispatch-control/.../prompt-lab/_components/agentList.ts).
FORBIDDEN agentKeys for scenarios: origin_story, problem, founder_bio_verified/anonymous, case_study_verified/anonymous (real prompt = build_section_writer_prompt, NOT replicated by test-run — Pitfall 5).

TestRunRequest.variables is a `dict[str,str]`. Scenario.input maps 1:1 onto it.

FastAPI router registration (api/main.py lines 197-206) — append `app.include_router(eval.router)` after `app.include_router(voice_pass.router)`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Scenario manifest + Pydantic loader (EVL-01)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/evals/__init__.py, packages/pipeline/src/eisenbalm_pipeline/evals/scenarios.json, packages/pipeline/src/eisenbalm_pipeline/evals/loader.py, packages/pipeline/tests/evals/__init__.py, packages/pipeline/tests/evals/test_scenario_loader.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/agents.py lines 88-180 (SAMPLE_FIXTURES — the authoritative variable-key source per agentKey)
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/agentList.ts (canonical agentKeys)
    - packages/pipeline/tests/test_test_run.py (pytest style + stub-mode conventions)
  </read_first>
  <behavior>
    - Test 1: `list_scenarios()` returns all 8 scenarios; every scenario validates against the Scenario model (id, agentKey, description, whatItCatches, input: dict[str,str], scoringTarget.min_overall: float).
    - Test 2: `list_scenarios(agent_key="scout")` returns only scout-keyed scenarios; `get_scenario(id)` returns the matching one and raises/returns None on unknown id.
    - Test 3: EVERY scenario's agentKey is in the test-run-replicable allowlist and NONE is a section-writer key (asserts the Pitfall-5 guardrail).
    - Test 4: every scenario id is unique.
  </behavior>
  <action>
    Create evals/scenarios.json as a JSON array of 8 objects mapping the design brief's named scenarios to test-run-replicable agentKeys:
      1. `scout_normal_week` (scout) — input `{"featured_keys": "[]"}`, whatItCatches "healthy discovery on a normal week".
      2. `scout_dry_well` (scout) — sparse-signal week; catches empty/thin discovery handling.
      3. `advocate_famous_bait` (advocate) — a well-known charity in candidates_json; catches obscurity-scoring failure (should score LOW). Use the `candidates_json` key shape from SAMPLE_FIXTURES["advocate"].
      4. `researcher_ghost_charity` (researcher) — an unverifiable founder/subject; catches fabricated-verification. Use SAMPLE_FIXTURES["researcher"] keys.
      5. `scout_radioactive_week` (scout) — brand-risk-adjacent candidates; catches brand-risk blindness.
      6. `scout_repeat_pressure` (scout) — featured_keys populated with a prior winner; catches dedup pressure.
      7. `bonus_spec_ad_voice_gauntlet` (the confirmed bonus_* key) — voice-critical writer via flat substitution; catches voice drift / machine-tells. Use SAMPLE_FIXTURES[bonus key] variable keys.
      8. `researcher_hallucination_trap` (researcher) — a plausible-but-false claim; catches hallucination.
    Each object: `{ "id", "agentKey", "description", "whatItCatches", "input": {<only SAMPLE_FIXTURES keys for that agentKey>}, "scoringTarget": { "min_overall": <float, e.g. 6.5-7.5> } }`. Do NOT invent new tokens for `input` — use ONLY keys present in SAMPLE_FIXTURES[agentKey] (Pitfall 5).

    Create evals/loader.py: a `Scenario(BaseModel)` (id/agentKey/description/whatItCatches/input dict[str,str]/scoringTarget with nested `{min_overall: float}`); `_load_all()` reads scenarios.json relative to the module file (`Path(__file__).parent / "scenarios.json"`); `list_scenarios(agent_key: str | None = None) -> list[Scenario]`; `get_scenario(scenario_id: str) -> Scenario | None`. Add evals/__init__.py (exports Scenario, list_scenarios, get_scenario) and tests/evals/__init__.py.

    Write tests/evals/test_scenario_loader.py covering the 4 behaviors.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/evals/test_scenario_loader.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `python -c "import json;d=json.load(open('packages/pipeline/src/eisenbalm_pipeline/evals/scenarios.json'));assert len(d)==8;print('OK')"` prints OK
    - No scenario has an agentKey in {origin_story, problem, founder_bio_verified, founder_bio_anonymous, case_study_verified, case_study_anonymous} (test 3 enforces)
    - `uv run pytest tests/evals/test_scenario_loader.py -x -q` exits 0
  </acceptance_criteria>
  <done>8 validated scenario fixtures load via loader.py; all target replicable agentKeys; test file green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GET /eval/scenarios endpoint + router registration + TS client</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/eval.py, packages/pipeline/src/eisenbalm_pipeline/api/main.py, packages/pipeline/tests/api/test_eval_scenarios.py, apps/dispatch-control/lib/evalScenarioClient.ts</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/agents.py lines 46-95 (router prefix + `_require_operator` optional-bearer auth pattern to reuse verbatim)
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py lines 195-207 (include_router block)
    - apps/dispatch-control/lib/testRunClient.ts (pipelineBaseUrl() + fetch + error shape to mirror)
    - packages/pipeline/tests/api/test_score.py (bare-FastAPI-app test harness + stub-mode)
  </read_first>
  <behavior>
    - Test 1: `GET /eval/scenarios` returns 200 with `{"scenarios": [...]}` containing all 8, each with id/agentKey/description/whatItCatches/input/scoringTarget.
    - Test 2: `GET /eval/scenarios?agentKey=scout` returns only scout scenarios.
    - Test 3: the eval router is included in the app (a request routes, not 404).
  </behavior>
  <action>
    Create api/eval.py with `router = APIRouter(prefix="/eval")`. Copy the optional-bearer `_require_operator` auth dependency from agents.py (import or re-declare the same pattern so dev-mode is reachable header-free and prod 401s). Add `@router.get("/scenarios")` handler taking `agentKey: str | None = None` query param + the auth dependency; call `list_scenarios(agent_key=agentKey)` and return `{"scenarios": [s.model_dump() for s in ...]}`. (This file also gains the shadow endpoint in Plan 03 — leave a clear section comment.)

    In api/main.py add `from eisenbalm_pipeline.api import eval as eval_api` to the imports and `app.include_router(eval_api.router)` right after `app.include_router(voice_pass.router)`.

    Create apps/dispatch-control/lib/evalScenarioClient.ts: `interface EvalScenario { id; agentKey; description; whatItCatches; input: Record<string,string>; scoringTarget: { min_overall: number } }` and `async function fetchScenarios(agentKey: string | undefined, token: string | null): Promise<EvalScenario[]>` that GETs `${pipelineBaseUrl()}/eval/scenarios${agentKey ? '?agentKey='+encodeURIComponent(agentKey) : ''}` with the Clerk bearer, mirrors testRunClient's error handling, and returns `json.scenarios`. Import `pipelineBaseUrl` from `@/lib/testRunClient`.

    Write tests/api/test_eval_scenarios.py mirroring test_score.py's bare-app harness (EISENBALM_STUB_MODE, no auth header needed) covering the 3 behaviors.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/api/test_eval_scenarios.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "include_router(eval" packages/pipeline/src/eisenbalm_pipeline/api/main.py` matches
    - `grep -q '"/scenarios"' packages/pipeline/src/eisenbalm_pipeline/api/eval.py` matches
    - `grep -q "/eval/scenarios" apps/dispatch-control/lib/evalScenarioClient.ts` matches
    - `uv run pytest tests/api/test_eval_scenarios.py -x -q` exits 0
  </acceptance_criteria>
  <done>GET /eval/scenarios is live and registered; the TS client fetches scenarios; endpoint tests green.</done>
</task>

</tasks>

<verification>
- `uv run pytest tests/evals/test_scenario_loader.py tests/api/test_eval_scenarios.py -x -q` green.
- eval router included in main.py; evalScenarioClient.ts references /eval/scenarios.
</verification>

<success_criteria>
EVL-01 — golden scenarios exist as repo fixtures, are Pydantic-validated, target only replicable agentKeys, and are readable over HTTP by the dashboard.
</success_criteria>

<output>
After completion, create `.planning/phases/38-prompt-lab-evals-eval-center/38-02-SUMMARY.md`.
</output>
