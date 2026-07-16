---
phase: 47-story-brief-stage
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - convex/schema.ts
  - convex/briefs.ts
  - convex/storyLeads.ts
  - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
  - packages/pipeline/tests/test_brief_convex_guard.py
  - apps/dispatch-control/__tests__/LeadCard.test.tsx
  - apps/dispatch-control/__tests__/LeadActions.test.tsx
  - apps/dispatch-control/__tests__/OrgOptions.test.tsx
  - apps/dispatch-control/__tests__/NeedsYourDecision.test.tsx
  - apps/dispatch-control/__tests__/BriefFieldTable.test.tsx
  - apps/dispatch-control/__tests__/BriefFieldStrengthen.test.tsx
autonomous: true
requirements: [BRF-01, BRF-02, BRF-03, BRF-04, BRF-05, BRF-06]
must_haves:
  truths:
    - "docs/API_CONTRACTS.md §7 defines the Brief TypedDict; a new §47 defines the briefs table, story_leads.status field, leads Require/Remove endpoints, and the Brief field-strengthen endpoints — all BEFORE any consuming code exists"
    - "The briefs Convex table + story_leads.status field are live on dev:modest-magpie-797 and pass convex parity"
    - "The six Stage-1 Wave-0 vitest files exist and collect without error (it.todo placeholders reference the exact assertions the implementing plans must make)"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "§7 Brief TypedDict + §47 briefs table/story_leads.status/leads+brief endpoint contracts"
      contains: "## §47"
    - path: "convex/briefs.ts"
      provides: "insert (upsert-safe) / patch / byRunId, single-row-per-run, pipelineSecret-guarded"
      exports: ["insert", "patch", "byRunId"]
    - path: "convex/storyLeads.ts"
      provides: "setStatus mutation (active/required/removed), pipelineSecret-guarded"
      exports: ["setStatus"]
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py"
      to: "_PIPELINE_SECRET_GUARDED_PATHS"
      via: "frozenset membership for briefs:insert / briefs:patch / storyLeads:setStatus"
      pattern: "briefs:insert"
---

<objective>
Contract-first foundation for the Story & Brief stage. Amend `docs/API_CONTRACTS.md` (§7 gains the Brief; a new §47 declares the `briefs` table, `story_leads.status`, the leads Require/Remove endpoints, and the Brief field-strengthen/patch endpoints) BEFORE any consuming code. Land the new Convex `briefs` table + functions and the `story_leads.status` field, register their pipeline-secret guarded paths, live-sync to `dev:modest-magpie-797`, and scaffold the six Stage-1 Wave-0 vitest files so every downstream requirement has a sampling point that exists first.

Purpose: The Brief is a cross-boundary artifact (Convex is the editable source of truth; the pipeline reads it). Getting the contract and the durable store exactly right up front is the hard rule (CLAUDE.md) that unblocks every other plan in this phase.
Output: Amended API_CONTRACTS.md; `convex/briefs.ts`; `story_leads.status` + `setStatus`; guarded-path registration + regression test; six collectible Wave-0 test scaffolds.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/47-story-brief-stage/47-CONTEXT.md
@.planning/phases/47-story-brief-stage/47-RESEARCH.md
@.planning/phases/47-story-brief-stage/47-VALIDATION.md

<interfaces>
<!-- Land these EXACT shapes (camelCase, matching codebase convention). Executor uses these directly. -->

Brief TypedDict (API_CONTRACTS §7, mirrored into state.py by plan 47-02):
```python
class Brief(TypedDict):
    premise: str
    currentPeg: str
    centralClaim: str
    readerEffect: str
    knownRisks: str
    voiceIntention: str
```

briefs Convex table (§47) — single-row-per-run, runId-scoped, patch-based edits:
```typescript
briefs: defineTable({
  runId: v.string(),
  premise: v.string(),
  currentPeg: v.string(),
  centralClaim: v.string(),
  readerEffect: v.string(),
  knownRisks: v.string(),
  voiceIntention: v.string(),
  updatedAt: v.number(),
}).index('by_runId', ['runId'])
```

story_leads gains ONE additive field (Phase 46 insert shape UNCHANGED):
```typescript
status: v.optional(v.union(v.literal('active'), v.literal('required'), v.literal('removed')))
// absent/'active' = default un-adjudicated
```

Endpoints declared in §47 (implemented in 47-02/47-04; NOT built here):
```
POST  /issues/{run_id}/leads/{lead_id}/require   body {}                    -> 200 {leadId, status:'required'}
POST  /issues/{run_id}/leads/{lead_id}/remove    body {reason}              -> 200 {leadId, status:'removed'}  (422 if reason empty)
PATCH /issues/{run_id}/brief                      body {field, value}        -> 200 (guarded edit + audit_log + Decision log)
POST  /issues/{run_id}/brief/{field}/strengthen/preview  body {currentValue}  -> 200 {proposedText, whatChanged}  (read-only, NO audit)
POST  /issues/{run_id}/brief/{field}/strengthen/apply    body {newText}       -> 200 {resolution:'brief_field_strengthened'}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Amend API_CONTRACTS.md — §7 Brief + new §47</name>
  <read_first>
    docs/API_CONTRACTS.md §7 (~L1763, the DispatchState TypedDict block) and §46 (~L5307, StoryLead/VerificationRecord/story_leads table — the additive-only precedent to mirror) and §37.3/§37.4 (~L3598, the adjudicate→resume bridge BRF-04 reuses UNCHANGED). 47-RESEARCH.md §"Architecture Patterns" (briefs shape Open Question 2; leads Require/Remove Pattern 3; field-scoped revision Pattern 6). 47-CONTEXT.md D-09/D-10/D-13.
  </read_first>
  <action>
    In §7, after the `StyleBrief` TypedDict, add the `Brief` TypedDict with the six fields in the interfaces block above (premise, currentPeg, centralClaim, readerEffect, knownRisks, voiceIntention — all `str`), plus a `brief: Optional[Brief]` line documented as a new `DispatchState` field (JSON-serializable, checkpoint-safe, mirrors the `story_leads: Optional[list[StoryLead]]` precedent). State plainly: the Brief is deterministically assembled inside `editor_gate_1` after `winning_charity` resolves (no new graph node, no new LLM call) and threaded to the 7 section writers; Convex is the editable source of truth, the pipeline reads it back.
    Add a new `## §47 — Story & Brief Stage (Phase 47)` section documenting, additively (mirror §46's "all changes are additive" close): (a) the `briefs` table shape + `by_runId` index (single-row-per-run, patch-based edits — NOT append-per-edit); (b) the additive `story_leads.status` optional union field (absent/'active' default; Phase 46 `storyLeads:insert` shape UNCHANGED); (c) `convex/briefs.ts` insert(upsert-safe)/patch/byRunId + `convex/storyLeads.ts::setStatus` function signatures; (d) the five FastAPI endpoints from the interfaces block, noting Require/Remove mirror `factcheck.py::keep_claim`/`delete_claim` (reason mandatory on Remove → 422 if empty → `_emit_audit` with `reason`+`run_id` → Decision log) and the Brief field-strengthen mirrors `revision.py::preview_passage_revision`/`apply_passage_revision` generalized to field scope; (e) the three new pipeline-secret guarded paths (`briefs:insert`, `briefs:patch`, `storyLeads:setStatus`). Document the honest tradeoff (RESEARCH Open Question 1): writers draft from the AUTO-GENERATED Brief on the first pass; human edits refine it for later revision passes ("Match the brief") and for Phase 48's hand-authored entry point.
    Contract text ONLY — no schema/endpoint code in this task.
  </action>
  <verify>
    <automated>grep -q "## §47" docs/API_CONTRACTS.md && grep -q "class Brief(TypedDict)" docs/API_CONTRACTS.md && grep -q "voiceIntention" docs/API_CONTRACTS.md && grep -q "briefs:insert" docs/API_CONTRACTS.md && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "## §47" docs/API_CONTRACTS.md` returns 1
    - `docs/API_CONTRACTS.md` §7 contains `class Brief(TypedDict)` with all six fields (premise, currentPeg, centralClaim, readerEffect, knownRisks, voiceIntention) and a `brief: Optional[Brief]` DispatchState line
    - §47 contains the strings `briefs: defineTable`, `story_leads` `status`, `/leads/{lead_id}/remove`, `/brief/{field}/strengthen/preview`, and all three guarded paths `briefs:insert` / `briefs:patch` / `storyLeads:setStatus`
    - No production `.ts`/`.py` schema/endpoint code changed in this task (contract prose only)
  </acceptance_criteria>
  <done>API_CONTRACTS.md §7 + §47 fully specify the Brief, the briefs table, the story_leads.status field, and the five endpoints before any consuming code.</done>
</task>

<task type="auto">
  <name>Task 2: Convex briefs table + story_leads.status + setStatus + guarded paths + live-sync</name>
  <read_first>
    convex/schema.ts (the `story_leads` table added in Phase 46-01, and the pitchLog/qaCorrections dedicated-table pattern). convex/storyLeads.ts (existing `byRunId` query + `insert` mutation + `requirePipelineSecret` import). convex/pitchLog.ts (the exact insert/mutation idiom to mirror). packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py L54-75 (`_PIPELINE_SECRET_GUARDED_PATHS` frozenset). packages/pipeline/tests/test_factcheck_endpoints.py:641-645 (the guarded-paths membership assertion pattern to copy). Memory: convex-functions-need-live-sync.
  </read_first>
  <action>
    In `convex/schema.ts`: add the `briefs` table exactly per the interfaces block (`by_runId` index); add the additive optional `status` union field to the existing `story_leads` table (do NOT touch any other story_leads field).
    Create `convex/briefs.ts` mirroring `convex/pitchLog.ts`/`storyLeads.ts` idioms: `insert` (upsert-safe — query `by_runId`; if a row exists `ctx.db.patch` it, else `ctx.db.insert` with `updatedAt: Date.now()`; strip `pipelineSecret` before write; `requirePipelineSecret(pipelineSecret)`), `patch` (byRunId lookup → `ctx.db.patch` a single provided field + `updatedAt`; `requirePipelineSecret`), `byRunId` (query returning the single current row or null). The six content fields + `pipelineSecret: v.optional(v.string())` (never persisted).
    In `convex/storyLeads.ts`: add a `setStatus` mutation (args `{ leadId: v.id('story_leads'), status: v.union(...'active'|'required'|'removed'), pipelineSecret }`, `requirePipelineSecret`, `ctx.db.patch(leadId, { status })`). Do NOT alter the existing `insert`/`byRunId`.
    In `convex_client.py`: add `"briefs:insert"`, `"briefs:patch"`, `"storyLeads:setStatus"` to `_PIPELINE_SECRET_GUARDED_PATHS`.
    Create `packages/pipeline/tests/test_brief_convex_guard.py` asserting all three new paths are members of `_PIPELINE_SECRET_GUARDED_PATHS` (copy the assertion shape from test_factcheck_endpoints.py:641-645).
    Live-sync: run `pnpm --filter @eisenbalm/convex dev:once` and confirm the new table/functions deploy; then `pnpm check:convex-parity`.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_brief_convex_guard.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "briefs: defineTable" convex/schema.ts` and the `story_leads` table block contains `status:` with the three literals
    - `convex/briefs.ts` exports `insert`, `patch`, `byRunId`; `insert` is upsert-safe (contains a `by_runId` lookup + both `ctx.db.patch` and `ctx.db.insert` branches)
    - `convex/storyLeads.ts` exports `setStatus` and still exports the original `insert` + `byRunId`
    - `pytest tests/test_brief_convex_guard.py` passes (all three guarded paths present)
    - `pnpm check:convex-parity` reports the new functions present on dev:modest-magpie-797 (no missing functions)
  </acceptance_criteria>
  <done>The briefs table, story_leads.status, setStatus, and guarded-path registration are live on dev:modest-magpie-797 and parity-green.</done>
</task>

<task type="auto">
  <name>Task 3: Wave-0 vitest scaffolds for the six Stage-1 components</name>
  <read_first>
    apps/dispatch-control/__tests__/CandidateSlate.test.tsx (the never-truncated tripwire: `expect(el.textContent).toBe(longText)` + `expect(el.className).not.toMatch(/line-clamp|truncate/)`) — the exact pattern BRF-01/BRF-03 reuse. apps/dispatch-control/vitest.config.ts. 47-VALIDATION.md §"Wave 0 Requirements" (the six file names). 47-RESEARCH.md §"Validation Architecture".
  </read_first>
  <action>
    Create the six vitest files listed in files_modified as COLLECTIBLE scaffolds — each contains a top-of-file comment naming its requirement + a `describe(...)` with `it.todo(...)` entries spelling out the exact assertions the implementing plan must fill, so the suite collects without importing not-yet-built components:
    - `LeadCard.test.tsx` (BRF-01): todo — renders premise, dated peg + pegSourceUrl link, readerEnergy, charitableAngle, category, confidence, and brandRiskReason IN FULL; brand-risk warning `className` `not.toMatch(/line-clamp|truncate/)`.
    - `LeadActions.test.tsx` (BRF-02): todo — Require calls requireLead; Remove is disabled while reason is empty; Remove with reason calls removeLead + surfaces in the Decision log.
    - `OrgOptions.test.tsx` (BRF-03): todo — org option shows mechanism, verification record WITH DATES, agent case, confidence, prior-coverage warning; main concern `not.toMatch(/line-clamp|truncate/)`.
    - `NeedsYourDecision.test.tsx` (BRF-04): todo — renders two options side by side; the label text is "Needs your decision" (NOT "requiresHumanInput"); Choose is disabled without a rationale; Choose calls `adjudicateGate1(runId, { selection: { charityName }, reason })`.
    - `BriefFieldTable.test.tsx` (BRF-05): todo — renders the six editable fields; an edit calls `patchBrief`.
    - `BriefFieldStrengthen.test.tsx` (BRF-06): todo — strengthen shows a preview (no mutation) then Apply calls the field-scoped apply client.
    Include the reusable `assertNeverTruncated(el, longText)` helper (or inline it) in the two never-truncated files, copied from CandidateSlate.test.tsx.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- LeadCard LeadActions OrgOptions NeedsYourDecision BriefFieldTable BriefFieldStrengthen 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - All six files exist under `apps/dispatch-control/__tests__/`
    - `pnpm --filter dispatch-control test:unit -- LeadCard LeadActions OrgOptions NeedsYourDecision BriefFieldTable BriefFieldStrengthen` collects and runs with zero collection/import errors (todo-marked tests are acceptable)
    - `NeedsYourDecision.test.tsx` contains the literal string `Needs your decision` and `adjudicateGate1`; the never-truncated files contain `not.toMatch(/line-clamp|truncate/)`
  </acceptance_criteria>
  <done>Six collectible Wave-0 scaffolds exist; every BRF requirement has a test file present before its implementation begins.</done>
</task>

</tasks>

<verification>
- API_CONTRACTS §7 + §47 committed; no consuming code references the Brief yet.
- `pnpm check:convex-parity` green; `pytest tests/test_brief_convex_guard.py` green.
- All six Wave-0 vitest files collect (todo state acceptable).
</verification>

<success_criteria>
Contract, durable Convex store, guarded-path registration, live-sync, and Wave-0 scaffolds all in place — every later plan can build against a fixed contract and a live table.
</success_criteria>

<output>
After completion, create `.planning/phases/47-story-brief-stage/47-01-SUMMARY.md`.
</output>
