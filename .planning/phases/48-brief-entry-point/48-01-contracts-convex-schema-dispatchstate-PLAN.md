---
phase: 48-brief-entry-point
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - packages/pipeline/src/eisenbalm_pipeline/graph/state.py
  - convex/schema.ts
  - convex/runs.ts
autonomous: true
requirements: [ENT-01, ENT-02, ENT-03, ENT-04]

must_haves:
  truths:
    - "docs/API_CONTRACTS.md §7 documents entry_mode + source_material DispatchState fields"
    - "docs/API_CONTRACTS.md has a new §48 documenting POST /pipeline/run/brief, runs.entryMode, and the brief-run seed shape"
    - "convex/schema.ts runs table carries an additive optional entryMode field ('discovery' | 'brief')"
    - "convex/runs.ts::create accepts an optional entryMode arg and persists it"
    - "The Convex schema change is live-synced to dev:modest-magpie-797"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "§7 entry_mode/source_material amendment + new §48 brief-entry contract"
      contains: "## §48"
    - path: "packages/pipeline/src/eisenbalm_pipeline/graph/state.py"
      provides: "entry_mode + source_material fields on DispatchState"
      contains: "entry_mode"
    - path: "convex/schema.ts"
      provides: "runs.entryMode additive optional field"
      contains: "entryMode"
    - path: "convex/runs.ts"
      provides: "create mutation accepts + persists entryMode"
      contains: "entryMode"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/runs.py"
      to: "convex/runs.ts::create"
      via: "runs:create mutation carries entryMode for brief runs"
      pattern: "entryMode"
    - from: "apps/dispatch-control/.../WorkspaceStateProvider.tsx"
      to: "convex/schema.ts runs.entryMode"
      via: "runRow.entryMode read for Stage-1 mode branch"
      pattern: "entryMode"
---

<objective>
Land the contract-first amendments and the Convex schema field the entire Phase 48 brief-entry seam depends on, BEFORE any producer/consumer code. This is the hard Wave-0 gate (CLAUDE.md contract-first rule): every cross-boundary shape this phase introduces (`entry_mode` + `source_material` on `DispatchState`, the `POST /pipeline/run/brief` endpoint, the brief-run seed shape, and `runs.entryMode`) is documented and the Convex schema/mutation are live-synced.

Purpose: nothing downstream (graph fork, `_start_run` seeding, the trigger endpoint, the Stage-1 render) may invent a field name or endpoint shape later — they consume the shapes this plan freezes.
Output: amended `docs/API_CONTRACTS.md` (§7 + new §48), `graph/state.py` DispatchState fields, `convex/schema.ts` `runs.entryMode`, `convex/runs.ts::create` arg, and a live Convex deployment carrying the new field.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/48-brief-entry-point/48-CONTEXT.md
@.planning/phases/48-brief-entry-point/48-RESEARCH.md
@docs/API_CONTRACTS.md
@convex/schema.ts
@convex/runs.ts
@packages/pipeline/src/eisenbalm_pipeline/graph/state.py

<interfaces>
<!-- The exact current shapes this plan amends. Executor uses these directly. -->

docs/API_CONTRACTS.md §7 DispatchState currently ends (~L1958-2007) with the Phase 1 selection block
(style_brief/candidates/winning_charity/…), the Phase 47 `brief` field, and error handling. The new
`entry_mode` + `source_material` fields are ADDED here — no existing field renamed.

Existing Brief TypedDict (§7, ~L1792) — the shape a brief-run's seed maps onto:
```python
class Brief(TypedDict):
    premise: str
    currentPeg: str
    centralClaim: str
    readerEffect: str
    knownRisks: str
    voiceIntention: str
```

Existing CharityCandidate TypedDict (§7, ~L1800) — the shape the human org seed maps onto (name,
location, website, charityNavigatorUrl?, guidestarUrl?, foundingYear?, assetRange, focusArea,
missionStatement, scoutSummary, whyOverlooked, advocateArgument?, advocateScore?).

convex/schema.ts runs table (L248-263) currently:
```typescript
runs: defineTable({
  workspace_id: v.string(),
  runId: v.string(),
  triggerSource: v.string(),
  triggeredBy: v.optional(v.string()),
  configSnapshot: v.optional(v.string()),
  status: v.string(),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  cost: v.optional(v.string()),
  durationMs: v.optional(v.number()),
  cancelRequested: v.optional(v.boolean()),
  scheduledPublishAt: v.optional(v.number()),
})
  .index('by_workspace', ['workspace_id'])
  .index('by_runId', ['runId']),
```

convex/runs.ts::create (L22-52) destructures `{ workspace_id, runId, triggerSource, triggeredBy,
pipelineSecret }` and inserts `{ workspace_id, runId, triggerSource, triggeredBy, status:'running',
startedAt: Date.now() }`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Amend API_CONTRACTS §7 (entry_mode + source_material) + add new §48 (brief entry point) + add DispatchState fields to state.py</name>
  <files>docs/API_CONTRACTS.md, packages/pipeline/src/eisenbalm_pipeline/graph/state.py</files>
  <read_first>
    - docs/API_CONTRACTS.md §7 (~L1763-2008, the DispatchState contract) and §47 (~L5552-5745, the Brief the seed mirrors)
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py (the DispatchState TypedDict being extended)
    - .planning/phases/48-brief-entry-point/48-RESEARCH.md §"DispatchState additions (§7 amendment)" (~L338-356) and §"Brief-trigger endpoint" (~L190-275)
  </read_first>
  <action>
    (a) In docs/API_CONTRACTS.md §7, inside `class DispatchState(TypedDict):`, add two NotRequired/Optional fields near the Phase 1 selection block (after `winning_charity` or alongside `brief`):
      - `entry_mode: NotRequired[Optional[Literal['discovery', 'brief']]]` — documented: routes the two conditional edges (calibrator→{signal_editor|verify_candidates}, verify_candidates→{advocate|researcher}); absent/None → 'discovery' via the router's `state.get("entry_mode") or "discovery"` default (back-compat with every pre-Phase-48 fixture — mirrors the existing `config` NotRequired precedent).
      - `source_material: NotRequired[Optional[str]]` — D-10: optional free-text (URLs + pasted notes) threaded into the Researcher's user prompt as prioritized seed context; only ever set on brief runs; None/absent on discovery runs → the `{source_material}` template token renders as "" (byte-equivalent prompt, mirrors the `{corrections}` empty-string precedent).
    (b) Add a NEW top-level section `## §48 — Brief Entry Point (Phase 48)` AFTER §47 (append near end of file). It MUST document, verbatim-precise (these are the frozen shapes downstream plans consume):
      - The endpoint `POST /pipeline/run/brief` (Clerk-guarded via `_require_clerk_jwt_control`, lives in `api/control.py`), its request body `BriefRunBody { issueNumber?: int, premise: str, peg: str, organization: OrganizationInput, sourceMaterial?: str }` and `OrganizationInput { name: str, website?: str, charityNavigatorUrl?: str, guidestarUrl?: str }`, its 422-on-empty-org-name rule, its reuse of the one-at-a-time (409) + budget (409) start gates, its `{runId}` 200 response, and its `run.triggered` audit row carrying `{entryMode:'brief', organization}`.
      - The brief-run seed: `_start_run` (extended, `api/runs.py`) seeds `entry_mode='brief'`, `winning_charity` (a CharityCandidate built from the human org with every unscouted field defaulted `""`/`None` — mirroring editor.py's D-14 synthetic-winner precedent), `candidates=[winning_charity]`, `brief` (the 6-field Brief mapped `premise→premise`, `peg→currentPeg`, remaining four blank), and `source_material`.
      - `briefs:insert` is written INSIDE `_start_run` right after `runs:create` (never console-side, never a separate endpoint call) — it needs the internally-minted run_id and avoids a partial-failure window.
      - The reduced brief-run `agentRuns:queueForRun` set: `calibrator, verify_candidates, researcher, verify_research, *SECTION_WRITERS, validate_sections, qa, editor_final, publisher` (NO signal_editor/scout/advocate/editor_gate_1/chronicler).
      - The `runs.entryMode` Convex field (`v.optional(v.union(v.literal('discovery'), v.literal('brief')))`, absent = 'discovery'), set only for brief runs by `runs:create`, read by the Stage-1 rendering variant.
      - State clearly that all §48 changes are ADDITIVE (no existing field/table/endpoint renamed or removed) and that the graph fork is TWO `add_conditional_edges` (after `calibrator`, after `verify_candidates`) — NOT a literal edge at START (per RESEARCH Pattern 1).
    (c) In packages/pipeline/src/eisenbalm_pipeline/graph/state.py, add the SAME two fields to `DispatchState`: `entry_mode: NotRequired[Optional[Literal['discovery', 'brief']]]` and `source_material: NotRequired[Optional[str]]` (import `Literal`/`NotRequired` if not already imported — check the existing imports first). Add a comment referencing §7/§48.
  </action>
  <verify>
    <automated>grep -q "## §48" docs/API_CONTRACTS.md && grep -q "source_material" docs/API_CONTRACTS.md && grep -q "entry_mode" packages/pipeline/src/eisenbalm_pipeline/graph/state.py && grep -q "source_material" packages/pipeline/src/eisenbalm_pipeline/graph/state.py && cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.graph.state import DispatchState; print('ok')"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "## §48" docs/API_CONTRACTS.md` returns ≥ 1
    - `grep "POST /pipeline/run/brief" docs/API_CONTRACTS.md` matches
    - `grep "BriefRunBody" docs/API_CONTRACTS.md` matches
    - `grep "entry_mode" docs/API_CONTRACTS.md` matches inside §7
    - `grep -E "entry_mode|source_material" packages/pipeline/src/eisenbalm_pipeline/graph/state.py` returns both fields
    - `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.graph.state import DispatchState"` exits 0 (no syntax/import error)
  </acceptance_criteria>
  <done>API_CONTRACTS documents §7 fields + a complete §48; state.py DispatchState carries entry_mode + source_material; the module imports cleanly. (ENT-02/ENT-03/ENT-04 contract shapes frozen.)</done>
</task>

<task type="auto">
  <name>Task 2: Add runs.entryMode to convex/schema.ts + convex/runs.ts::create arg, then live-sync Convex</name>
  <files>convex/schema.ts, convex/runs.ts</files>
  <read_first>
    - convex/schema.ts runs table (L248-263)
    - convex/runs.ts::create (L22-52)
    - .planning/phases/48-brief-entry-point/48-RESEARCH.md §"Pitfall 3" (~L318-322) and §"Pitfall 4" (~L324-328, live-sync)
  </read_first>
  <action>
    (a) In convex/schema.ts, add ONE additive optional field to the `runs` table (place after `scheduledPublishAt`): `entryMode: v.optional(v.union(v.literal('discovery'), v.literal('brief'))),` with an inline comment: `// Phase 48 ENT-01/03 — absent = 'discovery'; set to 'brief' only by runs:create for a brief-started run. Read by the Stage-1 render variant.` Do NOT touch the frozen pipelineRuns table.
    (b) In convex/runs.ts::create, add `entryMode: v.optional(v.union(v.literal('discovery'), v.literal('brief'))),` to `args`, destructure it in the handler signature, and include it in the `ctx.db.insert('runs', {...})` object (Convex accepts `undefined` for an optional field, so pass `entryMode` through directly). Keep the existing idempotent by_runId guard and every other arg byte-unchanged.
    (c) Live-sync Convex so the field + arg actually reach the deployment (committing ≠ deploying — memory [[convex-functions-need-live-sync]]): run `pnpm --filter @eisenbalm/convex dev:once`. Confirm it exits 0 with no schema-validation error.
  </action>
  <verify>
    <automated>grep -q "entryMode" convex/schema.ts && grep -q "entryMode" convex/runs.ts && pnpm --filter @eisenbalm/convex dev:once</automated>
  </verify>
  <acceptance_criteria>
    - `grep -A16 "runs: defineTable" convex/schema.ts | grep "entryMode"` matches with `v.optional(v.union(v.literal('discovery'), v.literal('brief')))`
    - `grep "entryMode" convex/runs.ts` matches in both `args` and the `insert` object
    - `pnpm --filter @eisenbalm/convex dev:once` exits 0 (schema pushed to dev:modest-magpie-797, no "Unexpected field" / validation error)
    - The frozen `pipelineRuns` table in convex/schema.ts is unchanged (no diff outside the `runs` table)
  </acceptance_criteria>
  <done>runs.entryMode exists in schema + create mutation and is deployed to the dev Convex deployment; Stage-1 render (48-06) can read `runRow.entryMode` and `_start_run` (48-03) can write it. (ENT-01/ENT-03 persistence layer ready.)</done>
</task>

</tasks>

<verification>
- `grep "## §48" docs/API_CONTRACTS.md` and `grep -E "entry_mode|source_material" packages/pipeline/src/eisenbalm_pipeline/graph/state.py` both match.
- `pnpm --filter @eisenbalm/convex dev:once` exits 0 — the schema is live.
- No existing DispatchState field, no frozen pipelineRuns field, and no existing runs:create arg is renamed or removed (purely additive).
</verification>

<success_criteria>
The four cross-boundary shapes Phase 48 introduces are documented in `docs/API_CONTRACTS.md` (§7 + §48), the DispatchState TypedDict carries `entry_mode` + `source_material`, `convex/schema.ts` + `convex/runs.ts` carry `entryMode`, and the Convex change is live-synced — so every implementation plan (48-03..48-06) consumes frozen shapes rather than inventing them.
</success_criteria>

<output>
After completion, create `.planning/phases/48-brief-entry-point/48-01-SUMMARY.md`
</output>
