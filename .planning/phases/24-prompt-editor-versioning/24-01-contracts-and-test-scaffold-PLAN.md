---
phase: 24-prompt-editor-versioning
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - packages/pipeline/tests/test_prompt_version_seeds.py
  - packages/pipeline/tests/test_voice_db_override.py
  - packages/pipeline/tests/test_test_run.py
  - apps/dispatch-control/__tests__/VariableRegistry.test.ts
  - apps/dispatch-control/__tests__/DiffViewer.test.tsx
  - apps/dispatch-control/__tests__/PromptEditor.test.tsx
  - apps/dispatch-control/__tests__/saveVersion.test.ts
  - apps/dispatch-control/__tests__/activate.test.ts
autonomous: true
requirements: [PRM-01, PRM-02, PRM-03, PRM-04, PRM-05, PRM-06]
must_haves:
  truths:
    - "API_CONTRACTS.md documents all new prompt_versions mutations, the test-run endpoint, and the RunConfig.voice_constraints addition BEFORE any implementing code"
    - "Every new behavior has a RED test that fails until the implementing wave lands"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "Contract section 4A.2 amendment + new §3A test-run endpoint contract"
      contains: "POST /agents/{key}/test-run"
    - path: "packages/pipeline/tests/test_prompt_version_seeds.py"
      provides: "Byte-equivalence oracle tests for all newly-migrated assets"
      contains: "byte"
    - path: "apps/dispatch-control/__tests__/saveVersion.test.ts"
      provides: "Convex saveVersion / activate guard test scaffold"
  key_links:
    - from: "24-01 test files"
      to: "implementing waves (02-07)"
      via: "RED-until-green contract"
      pattern: "test_prompt_version_seeds|saveVersion"
---

<objective>
Wave 0 for Phase 24. Two jobs, both blocking the rest of the phase:

1. **Amend `docs/API_CONTRACTS.md` BEFORE any code** (CLAUDE.md hard rule) for every
   new interface boundary this phase introduces: the new `prompt_versions` mutations
   (`saveVersion`, `activate`, `listForAgent`, `getByVersion`), the new
   `by_workspace_agentKey_version` index, the new agentKey rows (user-templates,
   section-guidance variants, rubric, voice_constraints), the new
   `POST /agents/{key}/test-run` FastAPI endpoint, and the `RunConfig.voice_constraints`
   field addition.
2. **Author the RED test scaffold** for the whole phase so every downstream task has a
   failing automated check to turn green (Nyquist sampling continuity).

Purpose: lock the contracts and validation surface so executors in Waves 1-2 build against
a written spec, not assumptions.
Output: amended API_CONTRACTS.md + 8 new test files (RED).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/24-prompt-editor-versioning/24-CONTEXT.md
@.planning/phases/24-prompt-editor-versioning/24-RESEARCH.md
@.planning/phases/24-prompt-editor-versioning/24-VALIDATION.md

<interfaces>
<!-- Existing contracts the executor must mirror. Do NOT invent new shapes. -->

Existing prompt_versions table (convex/schema.ts lines 266-277):
```typescript
prompt_versions: defineTable({
  workspace_id: v.string(), agentKey: v.string(), version: v.number(),
  content: v.string(), isActive: v.boolean(), createdAt: v.number(),
  createdBy: v.optional(v.string()), note: v.optional(v.string()),
}).index('by_workspace', ['workspace_id'])
  .index('by_workspace_agentKey', ['workspace_id', 'agentKey']),
```

Existing convex/promptVersions.ts exports: `upsertActive` (mutation), `getActive` (query).
Existing convex/auditLog.ts: `write` is `internalMutation` — call via `ctx.runMutation(internal.auditLog.write, {...})`.
Existing api/runs.py auth: `from eisenbalm_pipeline.api.auth import require_clerk_jwt` → `Depends(require_clerk_jwt)` returns `{"sub": <clerkUserId>}`.
acomplete return: `(content, usage)` where `usage = {tokens_in, tokens_out, usd, resolved_model}` (lib/openrouter_client.py).
agent_run_payloads read query: `agentRuns:payloadByRunIdAgentKey` (runId, agentKey) → {inputSnapshot, outputSnapshot} (convex/agentRuns.ts line 233).
RunConfig dataclass (lib/config_loader.py): fields workspace_id, agents, require_review, auto_publish, schedule_enabled.

Convex test harness: dispatch-control uses `convex-test` + vitest. Existing examples to copy:
apps/dispatch-control/__tests__/auditLog.test.ts, agentRuns.test.ts, workspace-upsert.test.ts.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Amend docs/API_CONTRACTS.md for all new Phase 24 boundaries</name>
  <files>docs/API_CONTRACTS.md</files>
  <read_first>
    - docs/API_CONTRACTS.md (read §4A.1-4A.4 lines 1070-1173 and §3.x and the §7 RunConfig block lines 1519-1604 to match existing formatting)
    - .planning/phases/24-prompt-editor-versioning/24-RESEARCH.md (Pattern 3 mutation signatures, Pattern 5 test-run endpoint shape, Pattern 6 RunConfig extension)
    - convex/promptVersions.ts (existing upsertActive/getActive shapes)
    - convex/schema.ts lines 266-277 (prompt_versions table)
  </read_first>
  <action>
    Edit docs/API_CONTRACTS.md (do NOT touch frozen §4.1-4.5 deliberation tables or §4A.4 wording).
    Make these additive edits:

    1. In §4A.2 `prompt_versions`, add the new compound index to the documented schema block:
       `.index('by_workspace_agentKey_version', ['workspace_id', 'agentKey', 'version'])`
       and add a subsection "§4A.2a — Phase 24 versioning mutations" documenting exactly these four
       Convex functions with their arg shapes (copy verbatim from RESEARCH Pattern 3):
       - `saveVersion(workspace_id, agentKey, content, createdBy?, note?)` → inserts a row with
         `version = max(existing.version)+1`, `isActive: false`; NEVER overwrites; emits
         `internal.auditLog.write` with action `'prompt_version.saved'`.
       - `activate(workspace_id, agentKey, version, actorId)` → returns
         `{ blocked: true, reason: string }` when a `runs` row has `status === 'running'`
         (in-progress guard, D-02); otherwise deactivates all rows for the agentKey, patches the
         target version `isActive: true`, emits audit action `'prompt_version.activated'`, returns
         `{ blocked: false }`. Rollback == activate(olderVersion) (no separate mutation).
       - `listForAgent(workspace_id, agentKey)` → all versions newest-first.
       - `getByVersion(workspace_id, agentKey, version)` → one row or null (uses new compound index).
    2. Add a NEW table to §4A.2 documenting the newly-externalized agentKeys this phase creates
       (these are additional `prompt_versions` rows, not a new table). List the canonical agentKeys:
       user-template keys `scout_user, advocate_user, calibrator_user, editor_gate1_user,
       editor_final_user, researcher_user, game_user, design_user, bonus_big_budget_user,
       bonus_jingle_user, bonus_spec_ad_user`; section-guidance keys `section_guidance_origin,
       section_guidance_problem, founder_bio_verified, founder_bio_anonymous,
       case_study_verified, case_study_anonymous`; plus `rubric` and `voice_constraints`.
       State each is seeded as a v1 active row byte-identical to its in-code/on-disk source.
    3. Add a NEW top-level section "## 3A. Dashboard → Pipeline (single-agent test-run)" documenting
       `POST /agents/{agent_key}/test-run` with request body
       `{workspace_id: str, draft_prompt: str, draft_user_template?: str, variables: dict[str,str],
       prior_run_id?: str}` and response
       `{output: str, cost_usd: float, tokens_in: int, tokens_out: int, model: str, duration_ms: int}`.
       Document: auth via `require_clerk_jwt`; it MUST call `acomplete` directly (NOT graph.ainvoke,
       NOT the @agent_node decorator) and MUST NOT write to `agent_runs`, `agent_run_payloads`,
       `deliberationEvents`, or any real run/issue table; cost is read from the existing acomplete
       usage path (no second recorder).
    4. In the §7 RunConfig block (line ~1519), add the field
       `voice_constraints: Optional[str] = None  # None → use code-constant VOICE_CONSTRAINTS`
       and note it is hydrated from the active `voice_constraints` prompt_versions row at run start.
  </action>
  <verify>
    <automated>grep -q "POST /agents/{agent_key}/test-run" docs/API_CONTRACTS.md && grep -q "by_workspace_agentKey_version" docs/API_CONTRACTS.md && grep -q "voice_constraints: Optional\[str\]" docs/API_CONTRACTS.md && grep -q "prompt_version.activated" docs/API_CONTRACTS.md && echo CONTRACTS_OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "POST /agents/{agent_key}/test-run" docs/API_CONTRACTS.md` returns ≥1
    - `grep -c "by_workspace_agentKey_version" docs/API_CONTRACTS.md` returns ≥1
    - `grep -c "saveVersion" docs/API_CONTRACTS.md` returns ≥1 and `grep -c "getByVersion" docs/API_CONTRACTS.md` returns ≥1
    - `grep -c "blocked: true" docs/API_CONTRACTS.md` returns ≥1 (in-progress guard documented)
    - `grep -c "voice_constraints" docs/API_CONTRACTS.md` returns ≥3
    - The frozen deliberation tables §4.1-4.5 are byte-unchanged: `git diff docs/API_CONTRACTS.md` shows additions only within §3A, §4A.2, and §7 RunConfig regions (no deletions in §4.1-4.5)
  </acceptance_criteria>
  <done>API_CONTRACTS.md documents every new boundary; no frozen-section edits.</done>
</task>

<task type="auto">
  <name>Task 2: Author pipeline RED tests (byte-equivalence, voice db-override, test-run isolation)</name>
  <files>packages/pipeline/tests/test_prompt_version_seeds.py, packages/pipeline/tests/test_voice_db_override.py, packages/pipeline/tests/test_test_run.py</files>
  <read_first>
    - .planning/phases/24-prompt-editor-versioning/24-RESEARCH.md (Validation Architecture → Byte-Equivalence Oracles example; Pattern 6 voice db_override)
    - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py (VOICE_CONSTRAINTS, assemble_voice signature)
    - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py, problem.py, founder_bio.py, case_study.py (SECTION_GUIDANCE / GUIDANCE_VERIFIED / GUIDANCE_ANONYMOUS constants — note GUIDANCE_ANONYMOUS contains unformatted `{role}`)
    - packages/pipeline/src/eisenbalm_pipeline/lib/prompts.py (load_prompt oracle)
    - packages/pipeline/tests/test_voice.py (existing invariant style to mirror)
  </read_first>
  <action>
    Write three pytest files. They WILL fail now (imports/files don't exist yet) — that is the RED state.

    test_prompt_version_seeds.py:
    - `test_section_guidance_seed_byte_equivalence`: assert `load_prompt("section_guidance_origin") == ORIGIN_GUIDANCE`,
      `load_prompt("section_guidance_problem") == PROBLEM_GUIDANCE`,
      `load_prompt("section_guidance_founder_bio_verified") == FOUNDER_GUIDANCE_VERIFIED`,
      `load_prompt("section_guidance_founder_bio_anonymous") == FOUNDER_GUIDANCE_ANONYMOUS`,
      `load_prompt("section_guidance_case_study_verified") == CS_GUIDANCE_VERIFIED`,
      `load_prompt("section_guidance_case_study_anonymous") == CS_GUIDANCE_ANONYMOUS`
      (import the constants from their agent modules; for the anonymous variants use the UNformatted
      constant — the one still containing the literal `{role}` token, before `.format()`).
    - `test_voice_constraints_seed_byte_equivalence`: `load_prompt("voice_constraints") == VOICE_CONSTRAINTS`.
    - `test_rubric_seed_byte_equivalence`: `load_prompt("rubric") == <qa rubric.md content>` (read the rubric file
      via importlib.resources files("eisenbalm_pipeline").joinpath("agents","qa","rubric.md") and compare to the
      loader output of the new prompts/rubric.md copy — assert byte-equal).
    - `test_user_template_seed_byte_equivalence`: for each externalized user-template agentKey
      (`scout_user`, `calibrator_user`, etc.), assert `load_prompt("<key>")` equals the in-code user string
      captured in Plan 05. Mark each currently-unknown expected value with a TODO and use a `pytest.mark.xfail`
      OR a placeholder constant the Plan 05 task replaces — but the file MUST import-execute.

    test_voice_db_override.py:
    - `test_db_override_passthrough`: `assemble_voice(None, db_voice_override=VOICE_CONSTRAINTS) == VOICE_CONSTRAINTS`.
    - `test_db_override_used_when_provided`: `assemble_voice(None, db_voice_override="CUSTOM") == "CUSTOM"`.
    - `test_none_override_equals_code_constant`: `assemble_voice(None) == VOICE_CONSTRAINTS` (sentinel preserved).
    (These fail until Plan 07 adds the `db_voice_override` kwarg.)

    test_test_run.py:
    - `test_test_run_returns_output_and_cost`: POST to `/agents/scout/test-run` via the ASGI test client
      (reuse conftest.py app fixture pattern) with stub mode on; assert 200 and response keys
      `output, cost_usd, tokens_in, tokens_out, model, duration_ms`.
    - `test_test_run_does_not_write_agent_runs`: assert no `agent_runs:*` / `agent_run_payloads:*` /
      `deliberationEvents:*` convex_mutation was called during a test-run (mock/patch convex_mutation_safe
      and assert no call path contains those table prefixes).
    (Fail until Plan 05 adds api/agents.py.)
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_prompt_version_seeds.py tests/test_voice_db_override.py tests/test_test_run.py --collect-only -q 2>&1 | grep -q "test_" && echo TESTS_COLLECTED</automated>
  </verify>
  <acceptance_criteria>
    - `cd packages/pipeline && uv run pytest tests/test_prompt_version_seeds.py tests/test_voice_db_override.py tests/test_test_run.py --collect-only -q` exits 0 and lists ≥9 test functions (files import-execute cleanly)
    - `grep -c "def test_" packages/pipeline/tests/test_prompt_version_seeds.py` returns ≥3
    - `grep -c "db_voice_override" packages/pipeline/tests/test_voice_db_override.py` returns ≥2
    - `grep -c "agent_run\|deliberationEvents" packages/pipeline/tests/test_test_run.py` returns ≥1 (isolation asserted)
    - Running the three files (not collect-only) currently FAILS (RED) — documented in SUMMARY
  </acceptance_criteria>
  <done>Three pipeline RED tests authored and collectable.</done>
</task>

<task type="auto">
  <name>Task 3: Author dispatch-control RED tests (Convex mutations + UI components)</name>
  <files>apps/dispatch-control/__tests__/saveVersion.test.ts, apps/dispatch-control/__tests__/activate.test.ts, apps/dispatch-control/__tests__/VariableRegistry.test.ts, apps/dispatch-control/__tests__/DiffViewer.test.tsx, apps/dispatch-control/__tests__/PromptEditor.test.tsx</files>
  <read_first>
    - apps/dispatch-control/__tests__/auditLog.test.ts, agentRuns.test.ts, workspace-upsert.test.ts (convex-test harness usage pattern: `convexTest(schema)`, `t.mutation(api.x.y, args)`, `t.query(...)`)
    - apps/dispatch-control/__tests__/AgentNode.test.tsx (React component test pattern with @testing-library/react + jsdom)
    - apps/dispatch-control/vitest.config.ts, apps/dispatch-control/__tests__/setup.ts
    - .planning/phases/24-prompt-editor-versioning/24-RESEARCH.md (Pattern 2 variable highlight; Pattern 4 diff column logic; Pattern 8 variable registry map)
  </read_first>
  <action>
    Write five vitest files using the existing convex-test + testing-library patterns. RED until Waves 1-2.

    saveVersion.test.ts (convex-test):
    - `saveVersion creates v2 when v1 exists and never overwrites v1`: seed v1 via upsertActive,
      call `api.promptVersions.saveVersion`, assert a new row with version 2 exists, v1 row still present
      and unchanged, new row `isActive === false`.
    - `saveVersion starts at v1 when no prior version`: assert version === 1.
    - `saveVersion writes an audit_log row`: assert `audit_log` has a row with action `'prompt_version.saved'`.

    activate.test.ts (convex-test):
    - `activate returns blocked when a run is running`: insert a `runs` row status='running', call
      `api.promptVersions.activate`, assert return `{ blocked: true }` and no isActive flip occurred.
    - `activate flips isActive when no run is running`: seed two versions, activate v1 then v2,
      assert exactly one row isActive and it is v2; assert `audit_log` action `'prompt_version.activated'`.
    - `listForAgent returns newest-first` and `getByVersion returns the exact row`.

    VariableRegistry.test.ts:
    - import `VARIABLE_REGISTRY` and a `findUnknownVariables(text, allowed)` helper from
      `app/(dashboard)/prompts/_components/VariableRegistry`; assert the registry has entries for
      `calibrator` containing `VOICE_CONSTRAINTS, issue_number, previous_bonus_types, chosen_bonus_type`,
      `game` containing `charity_name, VOICE_CONSTRAINTS, FORBIDDEN_CONSTRUCTS`, etc. (per RESEARCH map);
      assert `findUnknownVariables("{charity_name} {bogus}", ["charity_name"]) === ["bogus"]`.

    DiffViewer.test.tsx:
    - render `<DiffViewer left={...} right={...} />`; assert removed-only lines show on left with empty right,
      added-only on right with empty left, context lines on both columns (assert two `[data-side]` columns exist).

    PromptEditor.test.tsx:
    - smoke render the PromptEditor wrapper; assert it mounts without throwing and renders the dynamic
      CodeMirror placeholder (the `ssr:false` loading div) — accept either the loading skeleton or editor.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/saveVersion.test.ts __tests__/activate.test.ts __tests__/VariableRegistry.test.ts __tests__/DiffViewer.test.tsx __tests__/PromptEditor.test.tsx 2>&1 | grep -Eq "Test Files|FAIL|No test files" && echo VITEST_RAN</automated>
  </verify>
  <acceptance_criteria>
    - All five files exist and vitest discovers them (the run command above produces a "Test Files" summary line, not a parse/import crash)
    - `grep -c "saveVersion" apps/dispatch-control/__tests__/saveVersion.test.ts` returns ≥2
    - `grep -c "blocked" apps/dispatch-control/__tests__/activate.test.ts` returns ≥1
    - `grep -c "findUnknownVariables\|VARIABLE_REGISTRY" apps/dispatch-control/__tests__/VariableRegistry.test.ts` returns ≥2
    - Tests are RED now (assertions reference not-yet-built modules) — documented in SUMMARY
  </acceptance_criteria>
  <done>Five dispatch-control RED tests authored and discoverable by vitest.</done>
</task>

</tasks>

<verification>
- API_CONTRACTS.md amended for all new boundaries; frozen §4.1-4.5 untouched.
- 8 RED test files authored across pipeline + dispatch-control covering PRM-01..06.
- No implementation code written in this plan (scaffold only).
</verification>

<success_criteria>
Every downstream task in Waves 1-2 has a named failing automated check to turn green;
the contract for every new mutation/endpoint/field is written down before code.
</success_criteria>

<output>
After completion, create `.planning/phases/24-prompt-editor-versioning/24-01-SUMMARY.md`
</output>
