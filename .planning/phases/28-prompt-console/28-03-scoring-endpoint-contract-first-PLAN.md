---
phase: 28-prompt-console
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - packages/pipeline/src/eisenbalm_pipeline/api/agents.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py
  - packages/pipeline/tests/api/test_score.py
autonomous: true
requirements: [PRC-09]
must_haves:
  truths:
    - "docs/API_CONTRACTS.md documents the scoring endpoint contract BEFORE any endpoint code is written"
    - "A scoring endpoint scores a single arbitrary agent output against the live active rubric (disk fallback) and returns per-axis breakdown + overall + 1-2 line rationale"
    - "The scorer loads the SAME rubric the QA judge uses but is a standalone single-output call, not the judge's six-section batch shape, and is brand-agnostic"
    - "Scoring reuses the existing OpenRouter token/USD capture path — no second cost recorder — and never gates anything (advisory)"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "§3A.2 scoring endpoint request/response contract"
      contains: "POST /agents/{agent_key}/score"
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/agents.py"
      provides: "POST /agents/{agent_key}/score handler (ScoreRequest/ScoreResponse), Clerk-operator gated, direct acomplete call"
      contains: "/score"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py"
      provides: "Standalone single-output scorer that loads the active rubric (disk fallback) — reuses _load_rubric, not run_llm_judge's six-section shape"
      contains: "score_output"
  key_links:
    - from: "api/agents.py POST /agents/{key}/score"
      to: "judge.score_output + _load_rubric"
      via: "load active rubric (Convex getActive → disk fallback) then single acomplete call"
      pattern: "score_output"
    - from: "judge.score_output"
      to: "acomplete"
      via: "single LLM call, cost from existing usage path (no second recorder)"
      pattern: "acomplete"
---

<objective>
Add the voice-rubric scoring capability to the FastAPI pipeline (PRC-09):
contract-first amend `docs/API_CONTRACTS.md`, then implement a standalone scorer
that loads the SAME rubric the QA judge uses (active `rubric` version → disk
`rubric.md` fallback) and scores ONE arbitrary agent output, returning a per-axis
breakdown + an overall headline number + a 1-2 line rationale. Advisory only,
brand-agnostic, no second cost recorder.

Purpose: the standout authoring-loop guardrail — Andrew sees WHICH voice axis
drifted on a test-run output. This plan delivers the BACKEND + contract; Plan 04
wires the UI + compare.
Output: API_CONTRACTS §3A.2, a `score_output` scorer in judge.py, a
`POST /agents/{key}/score` endpoint, and a pytest covering rubric load + shape +
non-gating.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.planning/phases/28-prompt-console/28-CONTEXT.md

<interfaces>
<!-- Existing contracts the scorer MUST reuse. -->

judge.py (packages/.../agents/qa/judge.py):
- `_RUBRIC_PATH = Path(__file__).parent / "rubric.md"`; `_load_rubric() -> str` (disk read).
- `run_llm_judge(sections, *, run_id, narrator=None, rubric=None)` — the SIX-SECTION batch
  shape. DO NOT reuse this shape for the scorer; reuse only `_load_rubric` + the rubric text.
- JudgeFinding axes (the score-axis reference): "gravity", "sentiment", "irony-signaling",
  "precision", "cross-section-consistency", "structural-variety".

rubric.md "Evaluation Axes": gravity / sentiment / irony-signaling / precision
(+ cross-section-consistency + structural-variety). Single-output scorer scores the
per-output-applicable axes (gravity/sentiment/irony-signaling/precision at minimum).

api/agents.py:
- `_require_operator` — optional-bearer Clerk gate (dev-mode sentinel header-free). REUSE it.
- `_substitute(template, variables)` — `str.replace("{token}", value)` chain.
- `acomplete(agent_id, run_id, messages, response_format)` → `(content, usage)` where
  usage = `{tokens_in, tokens_out, usd, resolved_model}`. Cost comes from here — NO second recorder.
- `convex_client.get_client()` + `convex_client.convex_query(http, "promptVersions:getActive",
  {"workspace_id", "agentKey": "rubric"})` → active rubric row | None (mirror config_loader's
  `_hydrate_asset`: try Convex active row → disk fallback via _load_rubric).
- Works under EISENBALM_STUB_MODE (acomplete short-circuits to a fake client) so tests run offline.

config_loader._hydrate_asset pattern: try promptVersions:getActive → on missing/exception fall
back to disk. The score endpoint resolves the rubric the same way (active rubric row, disk fallback).

CLAUDE.md HARD RULE: amend docs/API_CONTRACTS.md BEFORE writing the endpoint code (contract-first).
Frozen pipelineRuns/deliberationEvents must NOT be touched. The scorer writes to NO real table.
</interfaces>

@docs/API_CONTRACTS.md
@packages/pipeline/src/eisenbalm_pipeline/api/agents.py
@packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py
@packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py
</context>

<tasks>

<task type="auto">
  <name>Task 1: Amend API_CONTRACTS.md with the scoring endpoint contract (CONTRACT-FIRST — must precede code)</name>
  <files>docs/API_CONTRACTS.md</files>
  <read_first>
    - docs/API_CONTRACTS.md (§3A.1 test-run contract — mirror its style + isolation-contract block)
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py (axis names for the contract's axis enum)
  </read_first>
  <action>
    Add a new subsection `### 3A.2 — POST /agents/{agent_key}/score` to docs/API_CONTRACTS.md,
    immediately AFTER §3A.1. Document (D-04/D-05/D-06/D-08):
      - Auth: `Depends(_require_operator)` — same Clerk-operator gate as test-run.
      - Request body (Pydantic ScoreRequest):
        ```
        { "workspace_id": str, "agent_key": str, "output": str }
        ```
        (`output` is a single arbitrary agent output — works for ANY agent, not only the six
        narrative sections. `agent_key` is advisory/labeling only; the rubric is global.)
      - Response body (Pydantic ScoreResponse):
        ```
        {
          "overall": float,                 # headline 0-10
          "axes": [ { "axis": str, "score": float, "pass": bool, "note": str } ],
          "rationale": str,                 # 1-2 line summary
          "rubric_source": "convex" | "disk",
          "cost_usd": float,
          "tokens_in": int,
          "tokens_out": int,
          "model": str,
          "duration_ms": int
        }
        ```
      - Behavior / isolation contract block (mirror §3A.1):
        * Loads the SAME rubric the QA judge uses: active `rubric` row via
          `promptVersions:getActive` → on missing/error, disk `rubric.md` via `_load_rubric`
          (records which in `rubric_source`).
        * A SINGLE `acomplete` call over ONE output — NOT run_llm_judge's six-section batch shape.
        * Brand-agnostic: scores against whatever the rubric defines; no Eisenbalm-hardcoded axes.
        * Advisory ONLY — never gates save/activate (D-06). Writes to NO real run/issue table.
        * Cost from the existing `acomplete` usage path — NO second cost recorder.
      - Note that this is additive; frozen `pipelineRuns` (§4) unchanged.
    Commit this doc change as the FIRST task so the contract precedes the code (CLAUDE.md hard rule).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && grep -q "POST /agents/{agent_key}/score" docs/API_CONTRACTS.md && grep -q "rubric_source" docs/API_CONTRACTS.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "POST /agents/{agent_key}/score" docs/API_CONTRACTS.md` succeeds.
    - The §3A.2 block documents `axes` (per-axis breakdown), `overall`, `rationale`, `rubric_source`, and the four cost fields.
    - The isolation/behavior text states: same rubric as judge (active→disk), single-output (not six-section batch), advisory-only, no second cost recorder.
    - This subsection appears AFTER §3A.1 and BEFORE §3B in the file (grep line-order check).
  </acceptance_criteria>
  <done>API_CONTRACTS §3A.2 fully specifies the scoring endpoint request/response + isolation contract, written before any endpoint code.</done>
</task>

<task type="auto">
  <name>Task 2: Standalone score_output scorer in judge.py (loads active rubric, disk fallback)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py (_load_rubric, JudgeFinding axes, the acomplete + with_structured_output normalization pattern)
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md (Evaluation Axes section)
  </read_first>
  <action>
    Add a standalone scorer to judge.py (do NOT modify run_llm_judge — additive):

      - A Pydantic model `VoiceAxisScore(BaseModel)`: `axis: str`, `score: float`, `pass_: bool`
        (alias "pass" via Field(alias="pass") since `pass` is a keyword), `note: str`.
      - A Pydantic envelope `VoiceScore(BaseModel)`: `overall: float`, `axes: list[VoiceAxisScore]`,
        `rationale: str`.
      - `async def score_output(*, output: str, rubric: str, run_id: str, agent_key: str = "") -> tuple[VoiceScore, str]:`
        * Build a TWO-message list: system = the rubric text (the SAME rubric the judge uses —
          caller passes the resolved active-or-disk rubric); user = an instruction to score the
          SINGLE supplied `output` against the rubric's voice axes and return a VoiceScore with a
          per-axis breakdown (each axis: 0-10 score + pass + 1-line note), an overall 0-10
          headline, and a 1-2 line rationale. Embed the output as the only content. This is
          single-output, NOT the six-section JSON payload run_llm_judge sends.
        * Call `acomplete(agent_id="qa", run_id=run_id, messages=messages, response_format=VoiceScore)`
          (Claude's discretion to use with_structured_output like the judge — yes, mirror it).
        * Normalize the result like run_llm_judge does (Pydantic instance vs dict vs stub empty)
          into a VoiceScore; under stub mode return a deterministic minimal VoiceScore (overall e.g.
          0.0 or a fixed value, empty/placeholder axes) so EISENBALM_STUB_MODE tests pass offline.
        * Return `(voice_score, usage["resolved_model"])`. Cost is captured inside acomplete — no
          second recorder.
      - Keep `_load_rubric` and `_RUBRIC_PATH` reused (the endpoint passes the resolved rubric in).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && grep -q "def score_output" packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py && grep -q "class VoiceScore" packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py && cd packages/pipeline && python -c "import ast,sys; ast.parse(open('src/eisenbalm_pipeline/agents/qa/judge.py').read())"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "def score_output" judge.py` and `grep -q "class VoiceScore" judge.py` succeed.
    - score_output builds a single-output two-message list (NOT a six-section sections_json payload — grep confirms no `sections_json` added to score_output).
    - run_llm_judge is unchanged (its signature + body intact — grep `def run_llm_judge`).
    - judge.py parses (ast.parse succeeds).
  </acceptance_criteria>
  <done>score_output added additively: a single-output scorer with VoiceScore (overall + per-axis + rationale) over the passed rubric, reusing acomplete (no second recorder); run_llm_judge untouched.</done>
</task>

<task type="auto">
  <name>Task 3: POST /agents/{key}/score endpoint + pytest</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/agents.py, packages/pipeline/tests/api/test_score.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/agents.py (router, _require_operator, TestRunResponse style, convex_client usage)
    - packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py (_hydrate_asset — the active-rubric-then-disk resolution pattern to copy)
    - packages/pipeline/tests/api/test_test_run.py (the FastAPI TestClient + stub-mode + _require_operator header-free test pattern to mirror)
  </read_first>
  <action>
    (A) In api/agents.py add (additive — keep test_run_agent intact):
      - `class ScoreRequest(BaseModel)`: `workspace_id: str`, `agent_key: str`, `output: str`.
        (agent_key may also come from the path — accept the path param as canonical; the body
        agent_key is optional/echo.)
      - `class ScoreResponse(BaseModel)` matching API_CONTRACTS §3A.2: `overall: float`,
        `axes: list[dict]` (or a small AxisOut model with axis/score/pass/note), `rationale: str`,
        `rubric_source: str`, `cost_usd: float`, `tokens_in: int`, `tokens_out: int`, `model: str`,
        `duration_ms: int`.
      - `@router.post("/{agent_key}/score", response_model=ScoreResponse)` with
        `_: dict = Depends(_require_operator)`:
        * Resolve the rubric like config_loader._hydrate_asset: try
          `convex_query(http, "promptVersions:getActive", {"workspace_id": body.workspace_id,
          "agentKey": "rubric"})`; if it returns a row use `row["content"]` + rubric_source="convex";
          on missing/exception fall back to `judge._load_rubric()` + rubric_source="disk".
          (Wrap the Convex read so a failure logs + falls back, never 500-leaks.)
        * Call `score_output(output=body.output, rubric=rubric, run_id=f"score-{uuid4()}",
          agent_key=agent_key)`; time it for duration_ms.
        * Read cost from the acomplete usage returned by score_output's path — score_output returns
          `(VoiceScore, model)`; the cost/tokens come from the same usage dict. (Have score_output
          also surface tokens_in/out/usd, OR return the usage dict — Claude's discretion; the
          endpoint MUST populate cost_usd/tokens_in/tokens_out/model from the existing acomplete
          usage, no second recorder.)
        * Map VoiceScore → ScoreResponse. NEVER write to any real table; NEVER gate.

    (B) Add `packages/pipeline/tests/api/test_score.py` (mirror test_test_run.py — FastAPI
        TestClient, EISENBALM_STUB_MODE, no auth header needed in dev mode):
      - POST `/agents/scout/score` with `{workspace_id, agent_key: "scout", output: "some text"}`
        returns 200 with an `overall` float, an `axes` list, a `rationale` string, and a
        `rubric_source` of "convex" or "disk".
      - Assert the response includes the four cost fields (cost_usd, tokens_in, tokens_out, model).
      - Assert the endpoint does NOT require an auth header in stub/dev mode (header-free call 200s),
        matching test_test_run.py's isolation-test note.
      - (Disk-fallback path is the default under stub mode with no Convex — assert rubric_source
        is "disk" when Convex is unavailable, OR mock the getActive read; whichever the stub harness
        supports — document the chosen approach in the test docstring.)
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=1 python -m pytest tests/api/test_score.py -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "/score" packages/pipeline/src/eisenbalm_pipeline/api/agents.py` and `grep -q "class ScoreResponse" agents.py` succeed.
    - The endpoint resolves the rubric via promptVersions:getActive with a disk `_load_rubric` fallback (grep for `getActive` + `_load_rubric` in the score handler region).
    - test_score.py passes under EISENBALM_STUB_MODE: 200, returns overall/axes/rationale/rubric_source + 4 cost fields, header-free.
    - No `pipelineRuns`/`deliberationEvents`/`agent_runs` write in the score handler (grep confirms absent).
    - test_test_run.py + test_voice.py still pass (run them): `EISENBALM_STUB_MODE=1 python -m pytest tests/api/test_test_run.py tests/test_voice.py -q`.
  </acceptance_criteria>
  <done>POST /agents/{key}/score is live, Clerk-operator gated, resolves the active rubric with disk fallback, returns the §3A.2 shape (per-axis + overall + rationale + rubric_source + cost) via a single acomplete call, writes nothing, never gates; test_score.py green and the voice/test-run suites remain green.</done>
</task>

</tasks>

<verification>
- API_CONTRACTS §3A.2 exists and precedes §3B (contract-first, CLAUDE.md hard rule).
- `EISENBALM_STUB_MODE=1 python -m pytest tests/api/test_score.py tests/api/test_test_run.py tests/test_voice.py tests/test_section_writer_voice_propagation.py -q` all green — the scorer does NOT perturb the judge/voice byte-equivalence paths.
- Scorer reuses _load_rubric + acomplete (no second cost recorder); run_llm_judge unchanged.
</verification>

<success_criteria>
- PRC-09 backend: a brand-agnostic single-output scorer loading the live active rubric (disk fallback) returns per-axis breakdown + overall headline + 1-2 line rationale, advisory-only, no second cost recorder, no real-table writes.
- Contract documented BEFORE code; isolation matches test-run; existing voice/judge tests stay green.
</success_criteria>

<output>
After completion, create `.planning/phases/28-prompt-console/28-03-SUMMARY.md`
</output>
