---
phase: 48-brief-entry-point
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/pipeline/tests/test_builder_entry_mode_wiring.py
  - packages/pipeline/tests/test_start_run_brief_seed.py
  - packages/pipeline/tests/test_brief_run_endpoint.py
  - packages/pipeline/tests/test_verify_candidates_brief_mode.py
  - packages/pipeline/tests/test_pipeline_e2e.py
  - apps/dispatch-control/__tests__/CreatePanel.test.tsx
  - apps/dispatch-control/__tests__/StoryBriefScreen.test.tsx
autonomous: true
requirements: [ENT-01, ENT-02, ENT-03, ENT-04]

must_haves:
  truths:
    - "Every Phase 48 requirement has a failing (or skip-guarded) test asserting its behavior before implementation lands"
    - "test_builder_entry_mode_wiring.py is a source-scan test (mirrors test_builder_wiring.py) — no import of not-yet-written code"
    - "test_verify_candidates_brief_mode.py is a characterization test that runs GREEN against the existing node (advisory-only already true)"
  artifacts:
    - path: "packages/pipeline/tests/test_builder_entry_mode_wiring.py"
      provides: "ENT-02 graph-fork source-scan assertions"
    - path: "packages/pipeline/tests/test_start_run_brief_seed.py"
      provides: "ENT-02 _start_run seeding + reduced-queue + byte-equivalence assertions"
    - path: "packages/pipeline/tests/test_brief_run_endpoint.py"
      provides: "ENT-02 POST /pipeline/run/brief endpoint assertions"
    - path: "packages/pipeline/tests/test_verify_candidates_brief_mode.py"
      provides: "ENT-04 advisory-only verification-record assertions"
    - path: "apps/dispatch-control/__tests__/CreatePanel.test.tsx"
      provides: "ENT-01 second-card render + submit-chain assertions"
  key_links:
    - from: "packages/pipeline/tests/test_builder_entry_mode_wiring.py"
      to: "packages/pipeline/src/eisenbalm_pipeline/graph/builder.py"
      via: "reads builder.py as text and asserts both add_conditional_edges calls"
      pattern: "add_conditional_edges"
---

<objective>
Author the failing/skip-guarded test scaffolds for every Phase 48 requirement BEFORE any implementation, so each implementation plan (48-03..48-06) has a red test to turn green (the project's consistent test-scaffold-first discipline — Phases 46/47). Each scaffold maps to a `48-VALIDATION.md` automated command.

Purpose: lock the observable behaviors as executable assertions up front.
Output: 4 new pipeline test files + 1 extended pipeline e2e test + 1 new + 1 extended dispatch-control test file.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/48-brief-entry-point/48-VALIDATION.md
@.planning/phases/48-brief-entry-point/48-RESEARCH.md
@packages/pipeline/tests/test_builder_wiring.py
@packages/pipeline/tests/test_control.py
@packages/pipeline/tests/test_pipeline_e2e.py
@apps/dispatch-control/__tests__/StoryBriefScreen.test.tsx

<interfaces>
<!-- The skip-guard idiom to mirror. Scaffolds must not hard-import not-yet-written symbols. -->

test_builder_wiring.py precedent (source-scan, no import):
```python
BUILDER_PATH = Path(__file__).parent.parent / "src" / "eisenbalm_pipeline" / "graph" / "builder.py"
def _builder_src() -> str: return BUILDER_PATH.read_text(encoding="utf-8")
pytestmark = pytest.mark.skipif(not _chronicler_wired(), reason="Wave 2: builder edge rewire not yet done")
```

test_control.py precedent (FastAPI TestClient / httpx AsyncClient, monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN"), POST /pipeline/run json={}).

test_pipeline_e2e.py precedent: module skip-guarded on `SUPABASE_POSTGRES_URL`; `test_pipeline_e2e_runId_threaded_to_all_datastores` posts a run, `_poll_until_terminal`, asserts `awaiting-review`, then asserts Convex rows carry runId.

verify_candidates (existing, agents/verify_candidates.py): `async def verify_candidates(state)` returns `{"candidates": survivors, "verification_records": records}`; persists a VerificationRecord per candidate via `convex_mutation_safe("verificationRecords:insert", {...})` BEFORE the kill decision; never touches winning_charity.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Pipeline graph-fork + _start_run seeding scaffolds (source-scan + unit)</name>
  <files>packages/pipeline/tests/test_builder_entry_mode_wiring.py, packages/pipeline/tests/test_start_run_brief_seed.py</files>
  <read_first>
    - packages/pipeline/tests/test_builder_wiring.py (the source-scan + skip-guard pattern to mirror exactly)
    - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py (L143-150 — the edges to be rewired)
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py (_start_run, L237-378 — the launcher to be extended)
    - .planning/phases/48-brief-entry-point/48-VALIDATION.md §Per-Task Verification Map (ENT-02 rows)
  </read_first>
  <action>
    Create `packages/pipeline/tests/test_builder_entry_mode_wiring.py` — a PURE source-scan (read `graph/builder.py` as text, no import), skip-guarded until the fork lands (mirror `test_builder_wiring.py`'s `pytestmark = pytest.mark.skipif(...)` on a `_fork_wired()` predicate that checks for `add_conditional_edges("calibrator"` in the source). Assertions when wired:
      - `builder.add_edge(START, "calibrator")` is still present and unconditional (unchanged).
      - `builder.add_conditional_edges("calibrator"` appears with a path_map mapping `"discovery"` → `"signal_editor"` and `"brief"` → `"verify_candidates"`.
      - `builder.add_conditional_edges("verify_candidates"` appears with a path_map mapping `"discovery"` → `"advocate"` and `"brief"` → `"researcher"`.
      - The OLD static edges `builder.add_edge("calibrator", "signal_editor")` and `builder.add_edge("verify_candidates", "advocate")` are REMOVED (assert NOT in source).
      - A router function name (`route_by_entry_mode`) is defined in the source.
    Create `packages/pipeline/tests/test_start_run_brief_seed.py` — unit tests for `_start_run`'s new params, skip-guarded until `_start_run`'s signature carries `entry_mode` (guard by `inspect.signature(_start_run)` containing `entry_mode`). Mock `_cc.convex_mutation`/`convex_query`/`load_run_config`/`snapshot_config` (mirror how test_runs.py / test_control.py stub these — read those for the exact monkeypatch targets). Assertions:
      - Existing-caller regression: calling `_start_run(app, issue_number=..., trigger_source="manual")` with NO new params produces a `runs:create` payload WITHOUT an `entryMode` key AND an `agentRuns:queueForRun` payload with the FULL 20-key list (byte-equivalent to today).
      - Brief seeding: `_start_run(..., entry_mode="brief", winning_charity={...}, brief={...}, source_material="x", agent_keys_override=[...])` seeds `initial_state["entry_mode"]=="brief"`, `initial_state["winning_charity"]`, `initial_state["candidates"]==[winning_charity]`, `initial_state["brief"]`, `initial_state["source_material"]=="x"`; the `runs:create` payload carries `entryMode=="brief"`; the `agentRuns:queueForRun` payload equals the reduced list (no signal_editor/scout/advocate/editor_gate_1/chronicler).
      - `briefs:insert` is called exactly once when `brief` is not None, and NOT called when `brief` is None.
    Both files must import cleanly (skip-guarded so they neither error nor falsely pass before implementation).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_builder_entry_mode_wiring.py tests/test_start_run_brief_seed.py -x</automated>
  </verify>
  <acceptance_criteria>
    - Both files exist under `packages/pipeline/tests/`.
    - `cd packages/pipeline && uv run pytest tests/test_builder_entry_mode_wiring.py tests/test_start_run_brief_seed.py` exits 0 with all tests SKIPPED (collection succeeds; no ImportError, no failure) — skip reason references "Wave 2 not yet wired".
    - `grep "add_conditional_edges" packages/pipeline/tests/test_builder_entry_mode_wiring.py` matches both calibrator and verify_candidates assertions.
    - `grep "agent_keys_override\|entryMode" packages/pipeline/tests/test_start_run_brief_seed.py` matches.
  </acceptance_criteria>
  <done>Both graph-fork + _start_run scaffolds exist, collect cleanly, and are skip-guarded red until 48-03 lands. (ENT-02 scaffolds ready.)</done>
</task>

<task type="auto">
  <name>Task 2: Endpoint, verify_candidates advisory, and e2e brief-mode scaffolds (pytest)</name>
  <files>packages/pipeline/tests/test_brief_run_endpoint.py, packages/pipeline/tests/test_verify_candidates_brief_mode.py, packages/pipeline/tests/test_pipeline_e2e.py</files>
  <read_first>
    - packages/pipeline/tests/test_control.py (the FastAPI TestClient / Clerk-dev-degradation idiom to mirror)
    - packages/pipeline/tests/test_pipeline_e2e.py (L82-127 — the runId-threaded precedent to clone; module skip-guard on SUPABASE_POSTGRES_URL)
    - packages/pipeline/src/eisenbalm_pipeline/agents/verify_candidates.py (the node under characterization test)
    - .planning/phases/48-brief-entry-point/48-VALIDATION.md §Per-Task Verification Map (ENT-02 endpoint, ENT-03 e2e, ENT-04 rows)
  </read_first>
  <action>
    Create `packages/pipeline/tests/test_brief_run_endpoint.py` — FastAPI TestClient tests for `POST /pipeline/run/brief`, mirroring `test_control.py` (delenv CLERK_JWT_ISSUER_DOMAIN → dev sentinel; stub `_cc.convex_query`/`convex_mutation`/`_start_run`). Skip-guard until the route exists (guard by checking the app's routes contain `/pipeline/run/brief`, or `pytest.importorskip` on a `pipeline_run_brief` symbol from `api.control`). Assertions:
      - 422 when `organization.name` is empty/whitespace.
      - 409 when `runs:latest` returns a `status=="running"` row (one-at-a-time gate reused).
      - 200 `{runId}` on the happy path, with `_start_run` called with `entry_mode="brief"` and an `agent_keys_override` that excludes `signal_editor`/`scout`/`advocate`/`editor_gate_1`/`chronicler`.
      - An `auditLog:record` mutation with `action=="run.triggered"` and an `entryMode` marker of `"brief"` is emitted.
    Create `packages/pipeline/tests/test_verify_candidates_brief_mode.py` — a CHARACTERIZATION test that runs GREEN against the existing node (research proved zero code change needed). Import `verify_candidates`, stub `convex_mutation_safe` + `web_search` + httpx (or monkeypatch the three `_check_*` helpers) so a single seeded candidate is definitively killed. Assert:
      - Exactly ONE `verificationRecords:insert` mutation is emitted for the single human org (record never absent — ENT-04).
      - The returned dict never contains `winning_charity` (the node only returns `{candidates, verification_records}`), so a killed single candidate cannot remove `state['winning_charity']`.
      - When the candidate is killed, `candidates` comes back `[]` and `verification_records` still has the one record with `killed=True` (advisory: record persisted regardless).
    Extend `packages/pipeline/tests/test_pipeline_e2e.py` — clone `test_pipeline_e2e_runId_threaded_to_all_datastores` into `test_pipeline_e2e_brief_mode` (inherits the existing module-level `SUPABASE_POSTGRES_URL` skip). It POSTs to `/pipeline/run/brief` with a brief body (premise/peg/organization/sourceMaterial), polls to terminal, and asserts: status `awaiting-review`; the 7 section fields exist in the Sanity draft; `qaCorrections:byRunId` returns rows; `verificationRecords:byRunId` returns ≥1 row (ENT-04); and `deliberationEvents:byRunId` for a brief run contains NO scout-finding/advocate-argument/editor-decision events (the D-12 honest divergence). Add a local skip-guard so it also skips if `/pipeline/run/brief` isn't registered yet.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_brief_run_endpoint.py tests/test_verify_candidates_brief_mode.py tests/test_pipeline_e2e.py -k "brief or verify_candidates" -x</automated>
  </verify>
  <acceptance_criteria>
    - All three files exist / are extended.
    - `test_verify_candidates_brief_mode.py` PASSES (green now — characterization of existing behavior).
    - `test_brief_run_endpoint.py` is SKIPPED (route not yet built) with a descriptive skip reason.
    - `test_pipeline_e2e.py::test_pipeline_e2e_brief_mode` is collected and SKIPPED (no SUPABASE_POSTGRES_URL and/or no route).
    - The combined pytest command exits 0.
  </acceptance_criteria>
  <done>Endpoint + advisory + e2e scaffolds exist; the ENT-04 advisory test is green, the endpoint/e2e tests are skip-guarded red until 48-03/48-04. (ENT-02/ENT-03/ENT-04 scaffolds ready.)</done>
</task>

<task type="auto">
  <name>Task 3: Dispatch-control CreatePanel + StoryBriefScreen brief-mode scaffolds (vitest)</name>
  <files>apps/dispatch-control/__tests__/CreatePanel.test.tsx, apps/dispatch-control/__tests__/StoryBriefScreen.test.tsx</files>
  <read_first>
    - apps/dispatch-control/__tests__/StoryBriefScreen.test.tsx (the existing file to extend + its mocking idiom)
    - apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx (the component the new test targets)
    - apps/dispatch-control/app/(dashboard)/story-brief/_components/StoryBriefScreen.tsx (the entryMode branch under test)
    - .planning/phases/48-brief-entry-point/48-VALIDATION.md §Per-Task Verification Map (ENT-01, ENT-03 rows)
  </read_first>
  <action>
    Create `apps/dispatch-control/__tests__/CreatePanel.test.tsx` (none exists today). Mock `next/navigation` (`useRouter`), `@clerk/nextjs` (`useAuth`), `convex/react` (`useMutation` → the `ensureByNumber` spy), and `@/lib/pipelineControlClient` (`triggerRun` + `triggerBriefRun` spies). Assertions (skip-guarded / `.todo` until the second card ships, OR authored to fail now with a clear message):
      - Two peer Create cards render — "Find a story with agents" AND "Start from my brief" (query both button/label texts).
      - Clicking "Start from my brief" reveals the intake form fields: premise, peg, organization name (org website + source material optional).
      - Submitting the form calls `ensureByNumber({workspace_id, issueNumber})` THEN `triggerBriefRun(bodyWithPremisePegOrg, token)` THEN `router.push(issueHref(nextIssueNumber))` — in that order.
      - The existing "Find a story with agents" path still calls `triggerRun` (unchanged).
    Extend `apps/dispatch-control/__tests__/StoryBriefScreen.test.tsx` with an `entryMode === 'brief'` render-path case. Mock `useWorkspaceState()` to return `{ entryMode: 'brief', storyLeads: [], verificationRecords: [<one human-org record>], brief: <6-field brief>, runId: 'r1', pitchRows: [] }`. Assert (skip-guarded until 48-06 ships the branch): the screen does NOT render "No leads yet." and does NOT render OrgOptionSlate's "No organization options yet"; instead it renders the human org's name (from the single verification record's `candidateName`) and its verification-with-dates line. (Author these as failing/skipped so 48-05/48-06 turn them green.)
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- CreatePanel StoryBriefScreen</automated>
  </verify>
  <acceptance_criteria>
    - `apps/dispatch-control/__tests__/CreatePanel.test.tsx` exists.
    - `apps/dispatch-control/__tests__/StoryBriefScreen.test.tsx` contains a new `entryMode`/`brief`-mode describe/it block.
    - `pnpm --filter dispatch-control test:unit -- CreatePanel StoryBriefScreen` exits 0 (new assertions are skipped/todo, existing ones still pass — no unhandled failure).
    - `grep -i "triggerBriefRun\|Start from my brief" apps/dispatch-control/__tests__/CreatePanel.test.tsx` matches.
  </acceptance_criteria>
  <done>CreatePanel + StoryBriefScreen brief-mode scaffolds exist and collect cleanly, skip-guarded until 48-05/48-06. (ENT-01/ENT-03 frontend scaffolds ready.)</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/test_builder_entry_mode_wiring.py tests/test_start_run_brief_seed.py tests/test_brief_run_endpoint.py tests/test_verify_candidates_brief_mode.py` exits 0 (advisory test green, others skipped, no collection errors).
- `pnpm --filter dispatch-control test:unit -- CreatePanel StoryBriefScreen` exits 0.
- No scaffold hard-imports a symbol that does not yet exist (skip-guards / mocks only).
</verification>

<success_criteria>
Every ENT-01..04 behavior has an executable assertion authored before implementation: the ENT-04 advisory-only test is already green (characterizing existing verify_candidates), and the graph-fork / _start_run / endpoint / Create-panel / Stage-1 scaffolds are skip-guarded red, ready for 48-03..48-06 to turn green.
</success_criteria>

<output>
After completion, create `.planning/phases/48-brief-entry-point/48-02-SUMMARY.md`
</output>
