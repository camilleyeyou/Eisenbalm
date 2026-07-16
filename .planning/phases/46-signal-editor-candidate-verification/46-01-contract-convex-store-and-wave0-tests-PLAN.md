---
phase: 46-signal-editor-candidate-verification
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - convex/schema.ts
  - convex/storyLeads.ts
  - convex/verificationRecords.ts
  - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
  - packages/pipeline/tests/agents/test_signal_editor.py
  - packages/pipeline/tests/agents/test_verify_candidates.py
  - packages/pipeline/tests/test_checkpoint_resume_phase46.py
autonomous: true
requirements: [SGE-01, SGE-03, SGE-04]

must_haves:
  truths:
    - "A dedicated Convex store exists for story leads and verification records (queryable + patchable, not deliberationEvents)"
    - "The StoryLead + VerificationRecord contract is written in API_CONTRACTS §46 BEFORE any state.py / agent code depends on it"
    - "Three Wave-0 pytest files exist and collect cleanly (skip-guarded), giving downstream tasks a sampling point"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "§46 — StoryLead, story_leads, VerificationRecord, verification_records, 2 Convex tables"
      contains: "## §46"
    - path: "convex/schema.ts"
      provides: "story_leads + verification_records tables"
      contains: "verification_records: defineTable"
    - path: "convex/storyLeads.ts"
      provides: "insert + byRunId for leads"
      exports: ["insert", "byRunId"]
    - path: "convex/verificationRecords.ts"
      provides: "insert + byRunId for verification records"
      exports: ["insert", "byRunId"]
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py"
      to: "storyLeads:insert / verificationRecords:insert"
      via: "_PIPELINE_SECRET_GUARDED_PATHS"
      pattern: "storyLeads:insert"
---

<objective>
Land the contract-first foundation for Phase 46: the API_CONTRACTS §46 amendment (StoryLead + VerificationRecord shapes, the two new DispatchState fields, and the two new Convex tables), the actual Convex tables + insert/byRunId functions, the pipeline-secret guard registration for the two new mutations, and the three Wave-0 pytest scaffolds.

Purpose: CLAUDE.md HARD RULE — contract changes in docs/API_CONTRACTS.md happen BEFORE code. state.py (46-02) and both agents (46-04/46-05) depend on this contract + these tables existing. Nothing downstream can persist a lead or a verification record until this store is live.
Output: §46 in API_CONTRACTS.md, 2 Convex tables + 2 function files (synced to dev), guarded-path registration, 3 skip-guarded test files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/46-signal-editor-candidate-verification/46-CONTEXT.md
@.planning/phases/46-signal-editor-candidate-verification/46-RESEARCH.md
@.planning/phases/46-signal-editor-candidate-verification/46-VALIDATION.md
@docs/API_CONTRACTS.md
@convex/schema.ts
@convex/pitchLog.ts
@packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py

<interfaces>
<!-- Deterministic join key for VerificationRecord (from agents/advocate.py:85-95) -->
def _charity_id_for(name: str) -> str:
    return f"charity-{slugify(name)}"   # SAME key across Sanity _id, pitchLog, agentVotes

<!-- Convex function-file naming: file storyLeads.ts → path "storyLeads:insert" (camelCase file/path);
     table names are snake_case story_leads / verification_records (charity_corrections precedent). -->

<!-- StoryLead fields (SGE-01 + SGE-02 gate + SGE-05 warning) — D-04: -->
premise, datedPeg, pegSourceUrl, readerEnergy, charitableAngle, category, confidence,
brandRiskFlag: bool, brandRiskReason: str|None, repetitionWarning: str|None, recommended: bool

<!-- VerificationRecord fields (SGE-03) — D-13: -->
candidateId (charity-{slug}), candidateName, domainLive: bool, registrationId: str|None,
registrationVerified: bool, obscurity: {pressHits: int, verdict: str}, status: 'pass'|'fail'|'unverified',
killed: bool, killReason: str|None, checkedAt: int
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Amend API_CONTRACTS.md with §46 (contract-first)</name>
  <files>docs/API_CONTRACTS.md</files>
  <read_first>
    - docs/API_CONTRACTS.md §7 DispatchState block (~L1920) — see how fields are documented
    - docs/API_CONTRACTS.md §39 (~L3816) and §42 (~L4282) — the self-contained numbered-section precedent to mirror (RESEARCH Pitfall 6: DO NOT rewrite the §7 code block; ADD a §46 section)
    - docs/API_CONTRACTS.md ~L4883 — the `signal` inspector-artifact row ("no Signal Editor exists until Phase 46")
    - .planning/phases/46-signal-editor-candidate-verification/46-CONTEXT.md D-04, D-06, D-13
  </read_first>
  <action>
    Append a new `## §46 — Signal Editor & Candidate Verification (Phase 46)` section at the end of docs/API_CONTRACTS.md (after §45), structured like §39/§42. It MUST document, as prose + code snippets (NOT by editing the §7 DispatchState block):

    1. `StoryLead` TypedDict with EXACTLY these 11 fields: `premise: str`, `datedPeg: str`, `pegSourceUrl: str`, `readerEnergy: str`, `charitableAngle: str`, `category: str`, `confidence: str` (constrained to 'low'|'medium'|'high' at the Pydantic boundary), `brandRiskFlag: bool`, `brandRiskReason: Optional[str]` (populated only when brandRiskFlag is true), `repetitionWarning: Optional[str]` (SGE-05, advisory), `recommended: bool` (SGE-02 gate — MUST be false whenever brandRiskFlag is true).
    2. New DispatchState field `story_leads: Optional[list[StoryLead]]` — JSON-serializable `list[dict]` (mirrors the `featured_charity_keys` "list NOT set" + `claims: list[dict]` precedents so it survives the Postgres checkpoint, SGE-04).
    3. `VerificationRecord` TypedDict: `candidateId: str` (the `charity-{slugify(name)}` join key), `candidateName: str`, `domainLive: bool`, `registrationId: Optional[str]`, `registrationVerified: bool`, `obscurity: dict` (`{pressHits: int, verdict: str}`), `status: Literal['pass','fail','unverified']`, `killed: bool`, `killReason: Optional[str]`, `checkedAt: int`.
    4. New DispatchState field `verification_records: Optional[list[VerificationRecord]]` — JSON-serializable `list[dict]` (SGE-04).
    5. Two new Convex tables: `story_leads` (columns: runId, plus the 11 StoryLead fields, timestamp; index by_runId) and `verification_records` (columns: runId, candidateId, candidateName, domainLive, registrationId, registrationVerified, obscurity fields, status, killed, killReason, checkedAt, timestamp; indexes by_runId and by_runId_and_candidate). State explicitly that a dedicated table is used (NOT a new `deliberationEvents.eventType` literal, which §37.3 declares FROZEN) because Phase 47 (BRF-02) must PATCH lead state, which an append-only event stream cannot support.
    6. Update the `signal` inspector-artifact row at ~L4883: change the note so it no longer says "no Signal Editor exists until Phase 46" — instead cross-reference §46 (`signal` = story leads emitted by the `signal_editor` step; `degraded: true` only when a legacy run predates Phase 46).

    Do NOT touch schemas/ or convex/schema.ts field names beyond what §46 declares; those land in Task 2 to match this contract exactly.
  </action>
  <acceptance_criteria>
    - `grep -c "## §46" docs/API_CONTRACTS.md` returns 1
    - `grep -n "class StoryLead" docs/API_CONTRACTS.md` matches inside §46
    - `grep -n "class VerificationRecord" docs/API_CONTRACTS.md` matches
    - `grep -n "story_leads" docs/API_CONTRACTS.md` and `grep -n "verification_records" docs/API_CONTRACTS.md` both match
    - `grep -n "brandRiskFlag" docs/API_CONTRACTS.md` matches AND the section states recommended must be false when brandRiskFlag is true
    - The ~L4883 `signal` row no longer contains the literal "no Signal Editor exists until Phase 46"
  </acceptance_criteria>
  <verify>
    <automated>grep -q "## §46" docs/API_CONTRACTS.md && grep -q "class StoryLead" docs/API_CONTRACTS.md && grep -q "class VerificationRecord" docs/API_CONTRACTS.md && ! grep -q "no Signal Editor exists until Phase 46" docs/API_CONTRACTS.md && echo CONTRACT_OK</automated>
  </verify>
  <done>§46 documents StoryLead, story_leads, VerificationRecord, verification_records, and the two Convex tables; the stale `signal`-artifact note is corrected.</done>
</task>

<task type="auto">
  <name>Task 2: Add story_leads + verification_records Convex tables, functions, and guard registration</name>
  <files>convex/schema.ts, convex/storyLeads.ts, convex/verificationRecords.ts, packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py</files>
  <read_first>
    - convex/_generated/ai/guidelines.md (convex/CLAUDE.md HARD RULE — read before writing any convex/*.ts)
    - convex/schema.ts — pitchLog (~L110) + charity_corrections table conventions + index style
    - convex/pitchLog.ts — the insert + byRunId + requirePipelineSecret template to mirror verbatim
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py — `_PIPELINE_SECRET_GUARDED_PATHS` (~L54) central secret injection
    - docs/API_CONTRACTS.md §46 (from Task 1) — the exact field set these tables must match
  </read_first>
  <action>
    Implement the store the §46 contract declares:

    1. `convex/schema.ts`: add two tables inside `defineSchema({...})`.
       - `story_leads: defineTable({ runId: v.string(), premise: v.string(), datedPeg: v.string(), pegSourceUrl: v.string(), readerEnergy: v.string(), charitableAngle: v.string(), category: v.string(), confidence: v.string(), brandRiskFlag: v.boolean(), brandRiskReason: v.optional(v.string()), repetitionWarning: v.optional(v.string()), recommended: v.boolean(), pipelineSecret: v.optional(v.string()) is NOT a stored column — do not add it to the table; timestamp: v.number() }).index('by_runId', ['runId'])`.
       - `verification_records: defineTable({ runId: v.string(), candidateId: v.string(), candidateName: v.string(), domainLive: v.boolean(), registrationId: v.optional(v.string()), registrationVerified: v.boolean(), pressHits: v.number(), obscurityVerdict: v.string(), status: v.union(v.literal('pass'), v.literal('fail'), v.literal('unverified')), killed: v.boolean(), killReason: v.optional(v.string()), checkedAt: v.number(), timestamp: v.number() }).index('by_runId', ['runId']).index('by_runId_and_candidate', ['runId', 'candidateId'])`. (Flatten obscurity into pressHits + obscurityVerdict — Convex has no nested-object column need here; the pipeline VerificationRecord dict re-nests them.)
    2. `convex/storyLeads.ts`: mirror pitchLog.ts EXACTLY. Export `insert = mutation({ args: { runId, ...the 11 StoryLead fields..., pipelineSecret: v.optional(v.string()) }, handler: (ctx, { pipelineSecret, ...args }) => { requirePipelineSecret(pipelineSecret); return ctx.db.insert('story_leads', { ...args, timestamp: Date.now() }) } })` and `byRunId = query({ args: { runId: v.string() }, handler: ... withIndex('by_runId') ... .order('asc').collect() })`. Import `requirePipelineSecret` from `./lib/auth`.
    3. `convex/verificationRecords.ts`: same pattern — `insert` (args = runId + all verification_records columns + pipelineSecret, requirePipelineSecret, insert with timestamp) and `byRunId`.
    4. `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py`: add `"storyLeads:insert"` and `"verificationRecords:insert"` to the `_PIPELINE_SECRET_GUARDED_PATHS` frozenset (so convex_mutation central-injects the pipeline secret — 42-03 lesson: unregistered guarded path = every real call 500s despite mocked unit tests passing).
    5. Live-sync (project memory `convex-functions-need-live-sync`): run `pnpm --filter @eisenbalm/convex dev:once` so the new tables + functions deploy to dev:modest-magpie-797 (committing ≠ deployed). If the workspace filter differs, use the repo's documented convex dev-sync command.
  </action>
  <acceptance_criteria>
    - `grep -n "story_leads: defineTable" convex/schema.ts` and `grep -n "verification_records: defineTable" convex/schema.ts` both match
    - `grep -n "export const insert" convex/storyLeads.ts` and `grep -n "export const byRunId" convex/storyLeads.ts` both match
    - `grep -n "export const insert" convex/verificationRecords.ts` matches; handler calls `requirePipelineSecret`
    - `grep -n "storyLeads:insert" packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` and `grep -n "verificationRecords:insert" packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` both match inside `_PIPELINE_SECRET_GUARDED_PATHS`
    - `pnpm --filter @eisenbalm/convex build` (or the repo TS check) passes; dev:once completes without a schema/validator error
  </acceptance_criteria>
  <verify>
    <automated>grep -q "story_leads: defineTable" convex/schema.ts && grep -q "verification_records: defineTable" convex/schema.ts && grep -q "storyLeads:insert" packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py && grep -q "verificationRecords:insert" packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py && echo CONVEX_OK</automated>
  </verify>
  <done>Both tables + both function files exist and are deployed to dev:modest-magpie-797; both insert paths are pipeline-secret-guarded.</done>
</task>

<task type="auto">
  <name>Task 3: Scaffold the three Wave-0 pytest files (skip-guarded)</name>
  <files>packages/pipeline/tests/agents/test_signal_editor.py, packages/pipeline/tests/agents/test_verify_candidates.py, packages/pipeline/tests/test_checkpoint_resume_phase46.py</files>
  <read_first>
    - packages/pipeline/tests/test_builder_wiring.py — the module-level `pytestmark = pytest.mark.skipif(...)` source-scan skip-guard precedent
    - packages/pipeline/tests/test_editor_gate_1_resume.py — the `SUPABASE_POSTGRES_URL`-gated skip precedent for the checkpoint resume test
    - .planning/phases/46-signal-editor-candidate-verification/46-VALIDATION.md — the per-requirement test map (exact `-k` names to scaffold)
  </read_first>
  <action>
    Create three test files that COLLECT cleanly today (agent modules do not exist yet) and become real assertions when 46-04/46-05/46-07 land:

    1. `tests/agents/test_signal_editor.py`: top of file `pytest.importorskip("eisenbalm_pipeline.agents.signal_editor")` so the module skips cleanly until 46-04. Add stub test functions (bodies = `pytest.skip("filled by 46-04")`) named EXACTLY: `test_emits_leads_with_required_fields` (SGE-01), `test_brand_risk_never_recommended` (SGE-02), `test_repetition_warning_attached` (SGE-05), `test_editorial_memory_read_empty_fallback` (SGE-05), `test_repetition_read_logged` (SGE-05). 46-04 replaces the skips with real assertions.
    2. `tests/agents/test_verify_candidates.py`: `pytest.importorskip("eisenbalm_pipeline.agents.verify_candidates")`. Stub functions named EXACTLY: `test_kills_definitive_failure`, `test_keeps_on_transient_error`, `test_killed_record_has_reason` (all SGE-03). 46-05 fills them.
    3. `tests/test_checkpoint_resume_phase46.py`: module-level `pytestmark = pytest.mark.skipif(not os.environ.get("SUPABASE_POSTGRES_URL"), reason="AsyncPostgresSaver checkpointer required — provisioned live")` mirroring test_editor_gate_1_resume.py. One stub `test_story_leads_and_verification_records_survive_resume` = `pytest.skip("filled by 46-07")`. 46-07 fills it.

    All three files must import cleanly and produce SKIPPED (not ERROR) results under the current tree.
  </action>
  <acceptance_criteria>
    - `uv run pytest tests/agents/test_signal_editor.py tests/agents/test_verify_candidates.py tests/test_checkpoint_resume_phase46.py -q` exits 0 with all tests SKIPPED (0 failed, 0 errored)
    - `grep -q "def test_brand_risk_never_recommended" tests/agents/test_signal_editor.py` matches
    - `grep -q "def test_kills_definitive_failure" tests/agents/test_verify_candidates.py` matches
    - `grep -q "SUPABASE_POSTGRES_URL" tests/test_checkpoint_resume_phase46.py` matches
  </acceptance_criteria>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/agents/test_signal_editor.py tests/agents/test_verify_candidates.py tests/test_checkpoint_resume_phase46.py -q</automated>
  </verify>
  <done>Three Wave-0 files collect and skip cleanly, giving 46-04/46-05/46-07 their sampling points.</done>
</task>

</tasks>

<verification>
- `grep -q "## §46" docs/API_CONTRACTS.md` — contract landed first
- Both Convex tables + both function files exist, TS build passes, dev:once synced
- `cd packages/pipeline && uv run pytest tests/agents/test_signal_editor.py tests/agents/test_verify_candidates.py tests/test_checkpoint_resume_phase46.py -q` → all skipped, 0 errors
</verification>

<success_criteria>
- API_CONTRACTS §46 documents StoryLead + VerificationRecord + both DispatchState fields + both Convex tables (contract-first, before state.py)
- story_leads + verification_records tables live on dev:modest-magpie-797 with insert + byRunId functions
- storyLeads:insert + verificationRecords:insert registered in the pipeline-secret guard
- Three Wave-0 pytest files collect and skip cleanly
</success_criteria>

<output>
After completion, create `.planning/phases/46-signal-editor-candidate-verification/46-01-SUMMARY.md`
</output>
