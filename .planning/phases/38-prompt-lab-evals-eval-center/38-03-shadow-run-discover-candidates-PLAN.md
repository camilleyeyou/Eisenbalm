---
phase: 38-prompt-lab-evals-eval-center
plan: 03
type: execute
wave: 3
depends_on: ["38-02"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py
  - packages/pipeline/src/eisenbalm_pipeline/api/eval.py
  - packages/pipeline/tests/api/test_shadow_run.py
  - packages/pipeline/tests/agents/test_scout_discover.py
autonomous: true
requirements: [EVL-05]
must_haves:
  truths:
    - "Scout's discovery logic (registry read → search → LLM parse → dedup) is a pure function that writes nothing"
    - "The real scout() node still performs its Sanity + Convex writes by calling the pure function then writing"
    - "POST /eval/shadow-run returns a real live-search discovery preview"
    - "The shadow endpoint provably writes NOTHING to any run table (Convex) or Sanity (write_charity) — the isolation contract"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/scout.py"
      provides: "pure discover_candidates() + refactored scout() that calls it"
      contains: "async def discover_candidates"
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/eval.py"
      provides: "POST /eval/shadow-run over discover_candidates"
      contains: "shadow-run"
    - path: "packages/pipeline/tests/api/test_shadow_run.py"
      provides: "D-12 isolation proof (no Convex run-table writes, no Sanity write_charity)"
      contains: "FORBIDDEN"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/eval.py"
      to: "scout.discover_candidates"
      via: "import + await discover_candidates(run_id=..., config=None)"
      pattern: "discover_candidates"
    - from: "packages/pipeline/src/eisenbalm_pipeline/agents/scout.py::scout"
      to: "discover_candidates"
      via: "surviving, featured_keys, usage = await discover_candidates(...)"
      pattern: "await discover_candidates"
---

<objective>
Extract Scout's pure discovery logic into `discover_candidates()` (Research Pattern 3 — steps 1-4: registry-dedup read → Tavily search → LLM parse → Python dedup, NO writes), refactor `scout()` to call it then perform its existing Sanity/Convex writes unchanged, and add a read-only `POST /eval/shadow-run` endpoint over the pure function. Prove D-12 isolation with a test asserting zero run-table writes AND zero Sanity write_charity.

Purpose: EVL-05 — preview what a paid discovery run would produce, without publishing or affecting run state.
Output: pure discover_candidates(); shadow endpoint; isolation test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/38-prompt-lab-evals-eval-center/38-RESEARCH.md
@docs/API_CONTRACTS.md
@packages/pipeline/src/eisenbalm_pipeline/agents/scout.py

<interfaces>
<!-- The exact split point (Research Pattern 3) — verbatim from scout.py. -->
scout.py steps 1-4 (registry read → Tavily → acomplete parse → Python dedup, lines ~192-301) are PURE (no writes). Steps 5-6 (write_charity + pitchLog:insert + charities:upsertCandidate, lines ~303-353) are the writes that must stay ONLY in scout(), never in discover_candidates().
`_build_messages` currently takes `state: DispatchState` only to read `state.get("config")` and `state["run_id"]` — refactor it (or the extraction) so discover_candidates accepts `config` directly and does NOT require a fabricated DispatchState.

Isolation test pattern (mirror exactly): packages/pipeline/tests/test_test_run.py:37-44 `FORBIDDEN_MUTATION_PREFIXES` — for D-12 ADD `"pitchLog"`, `"charities"` to the forbidden set AND assert `eisenbalm_pipeline.lib.sanity_client.write_charity` is never invoked (Pitfall 2 — Sanity coverage the existing tests don't need).

FastAPI eval router (api/eval.py) + its `_require_operator` optional-bearer dep already exist from Plan 02.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extract pure discover_candidates() from scout.py (no writes)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/scout.py, packages/pipeline/tests/agents/test_scout_discover.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py (full — the exact split at line 303 between pure discovery and writes)
    - packages/pipeline/tests/test_test_run.py lines 1-60 (stub-mode + monkeypatch harness style)
    - packages/pipeline/tests/agents/test_scout.py if present (existing scout tests that must stay green)
  </read_first>
  <behavior>
    - Test 1: `discover_candidates(run_id="shadow-x", config=None)` in stub/monkeypatched mode returns `(surviving: list[dict], featured_keys: list[str], usage: dict)` with the dedup applied.
    - Test 2: `discover_candidates` monkeypatched over web_search + acomplete makes NO call to `write_charity`, `convex_mutation`, or `convex_mutation_safe` (assert via monkeypatch spies that those are never invoked).
    - Test 3: the existing scout() node behavior is preserved — scout() still writes (its existing scout tests, if any, stay green; add a smoke assertion that scout() calls discover_candidates then write_charity).
  </behavior>
  <action>
    Refactor scout.py per Research Pattern 3 (minimal diff):
    - Add `async def discover_candidates(*, run_id: str, config: "RunConfig | None" = None) -> tuple[list[dict], list[str], dict]:` containing the CURRENT scout() steps 1-4 verbatim (Convex client acquisition for the registry READ, `_load_registry_keys`, the Tavily search loop with `max_tool_calls`/`AgentToolCallLimitExceeded`, the `acomplete` parse + zero-candidate corrective retry, and the Python dedup filter producing `surviving`). It returns `(surviving, featured_keys, usage)`. It performs NO write_charity, NO pitchLog/charities mutation.
    - Refactor `_build_messages` to accept `config` directly (replace the `state: DispatchState` param with `config` — it only reads `state.get("config")` and results_block; pass `run_id`/`featured_keys`/`tavily_results` as needed). Keep the on-disk fallback path.
    - Rewrite `scout()` body to: `surviving, featured_keys, usage = await discover_candidates(run_id=state["run_id"], config=state.get("config"))` then run the EXISTING steps 5-6 write loop (write_charity + pitchLog:insert + charities:upsertCandidate) and the model_versions return — all unchanged in behavior.
    - Keep `@agent_node(name="scout", emit_event=None, max_tool_calls=8)` on scout().

    Write tests/agents/test_scout_discover.py covering the 3 behaviors (monkeypatch web_search + acomplete to stub returns; spy on write_charity/convex_mutation_safe).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/agents/test_scout_discover.py -x -q && uv run pytest tests/ -k scout -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "async def discover_candidates" packages/pipeline/src/eisenbalm_pipeline/agents/scout.py` matches
    - `grep -q "await discover_candidates" packages/pipeline/src/eisenbalm_pipeline/agents/scout.py` matches (scout() calls it)
    - `uv run pytest tests/ -k scout -q` exits 0 (existing scout tests stay green — no regression)
    - `uv run pytest tests/agents/test_scout_discover.py -x -q` exits 0
  </acceptance_criteria>
  <done>discover_candidates() is a pure no-write function; scout() calls it then writes; scout suite green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: POST /eval/shadow-run + D-12 isolation proof</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/eval.py, packages/pipeline/tests/api/test_shadow_run.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/eval.py (the router + _require_operator dep from Plan 02)
    - packages/pipeline/tests/test_test_run.py lines 37-44 (FORBIDDEN_MUTATION_PREFIXES isolation harness to mirror + extend)
    - docs/API_CONTRACTS.md §38.4 (shadow-run contract)
  </read_first>
  <behavior>
    - Test 1: `POST /eval/shadow-run` with `{"workspace_id":"eisenbalm"}` (stub/monkeypatched live-search) returns 200 with `{ candidates: [...], featuredKeysCount: <int> }`.
    - Test 2 (D-12 isolation): during the shadow request, NO Convex mutation with a prefix in the FORBIDDEN set (`agentRuns`, `agent_runs`, `agent_run_payloads`, `deliberationEvents`, `pipelineRuns`, `pitchLog`, `charities`) is invoked, AND `eisenbalm_pipeline.lib.sanity_client.write_charity` is never called. Assert via monkeypatch spies that raise/record if hit.
  </behavior>
  <action>
    In api/eval.py add `@router.post("/shadow-run")` with the `_require_operator` dependency and a `ShadowRunBody(BaseModel)` (`workspace_id: str`). The handler calls `discover_candidates(run_id=f"shadow-{uuid4()}", config=None)` and returns `{ "candidates": surviving, "featuredKeysCount": len(featured_keys) }`. Import `discover_candidates` from `eisenbalm_pipeline.agents.scout`. Add no writes of any kind. Optionally cap cost/time by relying on Scout's existing `max_tool_calls` budget (no extra logic needed).

    Write tests/api/test_shadow_run.py mirroring test_test_run.py's bare-FastAPI-app + EISENBALM_STUB_MODE harness. Copy `FORBIDDEN_MUTATION_PREFIXES` and ADD `"pitchLog"`, `"charities"`. Monkeypatch `convex_client.convex_mutation` / `convex_mutation_safe` to record calls and `sanity_client.write_charity` to raise if invoked. Cover both behaviors.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/api/test_shadow_run.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "shadow-run" packages/pipeline/src/eisenbalm_pipeline/api/eval.py` matches
    - `grep -q "discover_candidates" packages/pipeline/src/eisenbalm_pipeline/api/eval.py` matches
    - `grep -q "write_charity" packages/pipeline/tests/api/test_shadow_run.py` matches (Sanity isolation asserted — Pitfall 2)
    - `grep -Eq "pitchLog|charities" packages/pipeline/tests/api/test_shadow_run.py` matches (Convex run-table isolation asserted)
    - `uv run pytest tests/api/test_shadow_run.py -x -q` exits 0
  </acceptance_criteria>
  <done>POST /eval/shadow-run returns a live discovery preview and provably writes nothing to Convex run tables or Sanity.</done>
</task>

</tasks>

<verification>
- `uv run pytest tests/agents/test_scout_discover.py tests/api/test_shadow_run.py -x -q` green.
- `uv run pytest tests/ -k scout -q` green (no scout regression).
</verification>

<success_criteria>
EVL-05 — the operator can run a shadow discovery against live news that previews real output while writing nothing to run state or Sanity (D-12 isolation proven by test).
</success_criteria>

<output>
After completion, create `.planning/phases/38-prompt-lab-evals-eval-center/38-03-SUMMARY.md`.
</output>
