---
phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - convex/schema.ts
  - convex/claimChecks.ts
autonomous: true
requirements: [PRV-01, PRV-02, PRV-03, PRV-04]
must_haves:
  truths:
    - "docs/API_CONTRACTS.md documents the claims model, writer claimSpans field, and the claim_checks additive fields BEFORE any schema/agent code is written (CLAUDE.md contract-first rule)"
    - "convex claim_checks table accepts claimId/sourceUrl/retrievedAt/sectionName/blockIndexHint on new rows; legacy rows (fields absent) still load"
    - "claimChecks:insertBatch accepts the five additive optional fields per claim and persists them"
    - "convex codegen regenerates without error and dispatch-control build stays green (fields are additive/optional — no consumer break)"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "§35 Provenance contract block + amended §26.2 claim_checks"
      contains: "claimSpans"
    - path: "convex/schema.ts"
      provides: "claim_checks additive optional provenance fields"
      contains: "sourceUrl"
    - path: "convex/claimChecks.ts"
      provides: "insertBatch claims object extended with provenance fields"
      contains: "sourceUrl"
  key_links:
    - from: "convex/claimChecks.ts insertBatch"
      to: "claim_checks rows"
      via: "ctx.db.insert passes provenance fields through"
      pattern: "sourceUrl"
---

<objective>
Establish the Phase 35 contract and data-model foundation. Every downstream plan (Researcher claims, writer claimSpans, publisher seeding, galley wash, rail source index) reads the same claim model and the same `claim_checks` shape defined here. Contract-first is a CLAUDE.md hard rule: `docs/API_CONTRACTS.md` is amended BEFORE the Convex schema field code, which is written before any agent/endpoint code in later plans.

Purpose: One canonical claim store (D-03), documented and typed, so the five layers cooperate without inventing parallel shapes.
Output: Amended API_CONTRACTS §35 + §26.2; additive optional fields on `claim_checks`; extended `insertBatch` validator; regenerated Convex types.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-CONTEXT.md
@.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-RESEARCH.md

<interfaces>
<!-- Current claim_checks (convex/schema.ts L401-412) — provenance fields are ADDITIVE. -->
claim_checks: defineTable({
  workspace_id: v.string(),
  runId: v.string(),
  claimIndex: v.number(),
  text: v.string(),
  claimType: v.string(),
  context: v.string(),
  status: v.string(),
  checkedAt: v.optional(v.number()),   // Phase 33
}).index('by_runId', ['runId']).index('by_workspace', ['workspace_id'])

<!-- Current insertBatch claims object (convex/claimChecks.ts L33-44) -->
claims: v.array(v.object({
  claimIndex: v.number(), text: v.string(), claimType: v.string(), context: v.string(),
}))

<!-- Pattern to mirror: qaCorrections already carries sectionName + optional blockIndexHint (convex/schema.ts ~L70). -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Amend docs/API_CONTRACTS.md — add §35 Provenance contract + update §26.2</name>
  <files>docs/API_CONTRACTS.md</files>
  <read_first>
    - docs/API_CONTRACTS.md (§26.2 at line ~2011; §7 research schema; §33.2 claim_checks.checkedAt at ~2783 — mirror its additive-field prose style)
    - .planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-CONTEXT.md (D-01..D-14)
    - .planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-RESEARCH.md (Pitfall 3 — the ResearchOutput TypedDict drift; Architecture Patterns block for exact field list)
    - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py (real ResearchOutputModel shape)
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py L73-89 (stale ResearchOutput TypedDict)
  </read_first>
  <action>
    Add a new `## §35 — Provenance (Phase 35)` section to docs/API_CONTRACTS.md (place it after the §34 block). Document these shapes verbatim so later plans copy them:

    1. **Researcher LLM output claim (D-01):** `ClaimOutput { text: str; sourceIndex: int | None }`. The LLM emits a source INDEX (S1, S2…), never a URL. Code maps index → real Tavily URL + retrievedAt.

    2. **Code-side research claim (assembled in researcher(), D-01):** `{ claimId: str, text: str, sourceUrl: str | None, retrievedAt: int | None }` written to `state["research"]["claims"]`. `claimId` is code-assigned, stable, collision-free (e.g. `f"{run_id[:8]}-{ordinal}"`). Out-of-range/absent index → `sourceUrl=None, retrievedAt=None` (honestly unsourced).

    3. **Writer claimSpans sidecar (D-05, D-06):** `ClaimSpanRef { claimId: str; asWritten: str = "" }`. Prose writers (origin_story, problem, founder_bio, case_study, bonus SpecAd branch only) emit `claimSpans: list[ClaimSpanRef]` as a flat sibling field next to `body`. HARD CONSTRAINT: no `oneOf`/discriminated unions (Anthropic structured-output rejects `oneOf` — see graph/blocks.py incident docstring). `asWritten` is the verbatim phrase as the writer wrote it in the body (handles rewording).

    4. **claim_checks additive fields (D-03) — update §26.2 in place:** add to the documented table `claimId: v.optional(v.string())` (present only for writer-bound/sourced rows), `sourceUrl: v.optional(v.string())`, `retrievedAt: v.optional(v.number())` (Unix ms, code-stamped at Tavily query time), `sectionName: v.optional(v.string())` (present for ALL new rows sourced+unsourced), `blockIndexHint: v.optional(v.number())` (hint-only, mirrors qaCorrections). State the invariant: a row with `claimId` present = sourced (marigold); `claimId` absent = unsourced (rust). Legacy rows (all five absent) degrade honestly to unsourced — zero migration.

    5. **insertBatch signature change (§26.6/§35):** each object in the `claims` array gains the five optional fields above; the mutation persists them into the row. Row model moves to ONE-ROW-PER-OCCURRENCE (D-13/Research Open Q1): the same fact stated in two sections is two rows with distinct `claimIndex`, so every row owns a jump-link target. Document this as a deliberate, visible checklist-size change from Phase 26.

    6. **ResearchOutput TypedDict drift note (Research Pitfall 3):** add an explicit note under §7/§35 that `graph/state.py::ResearchOutput` and its §7 copy list fields (`foundingMoment`, `caseStudySubject`, `verifiedFacts`, …) that DO NOT exist on the real `ResearchOutputModel`, and that `build_section_writer_prompt`'s `research_lines` block has therefore been silently empty since Phase 5. Decision recorded for Phase 35: the drift is documented as KNOWN and the existing broken `research_lines` fields are LEFT UNCHANGED (out of scope for a provenance phase); Phase 35 only ADDS the `claims` field to `ResearchOutputModel` and the claims-whitelist injection to the writer user prompt. Do not silently paper over it.

    Do NOT write any schema or agent code in this task — documentation only.
  </action>
  <verify>
    <automated>grep -n "claimSpans" docs/API_CONTRACTS.md && grep -n "sourceIndex" docs/API_CONTRACTS.md && grep -n "one-row-per-occurrence\|ONE-ROW-PER-OCCURRENCE\|one row per occurrence" docs/API_CONTRACTS.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "claimSpans" docs/API_CONTRACTS.md` returns ≥1
    - `grep -c "sourceIndex" docs/API_CONTRACTS.md` returns ≥1
    - `grep -n "ClaimSpanRef" docs/API_CONTRACTS.md` matches (writer sidecar documented)
    - `grep -n "sectionName" docs/API_CONTRACTS.md | grep -i "claim_checks\|§26.2\|§35"` shows the additive field is documented in the claim_checks context
    - The ResearchOutput drift note contains the string "silently empty" or "known" documenting the Pitfall 3 decision
  </acceptance_criteria>
  <done>API_CONTRACTS §35 + §26.2 document the claim model, writer claimSpans, claim_checks additive fields, one-row-per-occurrence, and the ResearchOutput drift decision — with no code changes yet.</done>
</task>

<task type="auto">
  <name>Task 2: Add claim_checks additive optional fields + extend insertBatch + regenerate Convex types</name>
  <files>convex/schema.ts, convex/claimChecks.ts</files>
  <read_first>
    - convex/schema.ts L397-412 (claim_checks table)
    - convex/claimChecks.ts L29-70 (insertBatch mutation + handler)
    - convex/schema.ts ~L70 qaCorrections (blockIndexHint/sectionName precedent)
    - docs/API_CONTRACTS.md §35 (just written in Task 1 — the authoritative field list)
  </read_first>
  <action>
    1. In `convex/schema.ts`, inside `claim_checks: defineTable({ ... })` (after the existing `checkedAt: v.optional(v.number())` line, before the closing `})`), add these five additive optional fields verbatim:
    ```typescript
    // ── Phase 35 provenance (PRV-01/03/04) — additive optional; legacy rows omit all five ──
    claimId: v.optional(v.string()),        // present only for writer-bound (sourced) rows
    sourceUrl: v.optional(v.string()),      // index-bound Tavily URL; absent => unsourced
    retrievedAt: v.optional(v.number()),    // Unix ms, code-stamped at Tavily query time
    sectionName: v.optional(v.string()),    // galley section this claim occurs in (all new rows)
    blockIndexHint: v.optional(v.number()), // hint-only anchor, mirrors qaCorrections
    ```
    Leave the two existing `.index(...)` calls unchanged.

    2. In `convex/claimChecks.ts` `insertBatch`, extend the `claims: v.array(v.object({ ... }))` validator so each claim object ALSO accepts the same five optional fields:
    ```typescript
    claimId: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    retrievedAt: v.optional(v.number()),
    sectionName: v.optional(v.string()),
    blockIndexHint: v.optional(v.number()),
    ```
    Then in the handler's `claims.map(claim => ctx.db.insert('claim_checks', { ... }))`, add the five fields to the inserted object, passing them through from `claim` (e.g. `claimId: claim.claimId, sourceUrl: claim.sourceUrl, retrievedAt: claim.retrievedAt, sectionName: claim.sectionName, blockIndexHint: claim.blockIndexHint`). Convex omits `undefined` optionals automatically, so legacy callers (no provenance fields) keep producing legacy-shaped rows. Do NOT change `setStatus`, `listByRunId`, or `allSignedOff`.

    3. Regenerate the Convex generated types so later frontend plans see the new insertBatch args:
    `pnpm --filter @eisenbalm/convex exec convex codegen`
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && grep -n "sourceUrl" convex/schema.ts && grep -n "sourceUrl" convex/claimChecks.ts && pnpm --filter @eisenbalm/convex exec convex codegen && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "sourceUrl" convex/schema.ts` returns ≥1 and the four siblings (claimId, retrievedAt, sectionName, blockIndexHint) are present in the claim_checks table block
    - `grep -c "sourceUrl" convex/claimChecks.ts` returns ≥2 (validator + handler insert)
    - `pnpm --filter @eisenbalm/convex exec convex codegen` exits 0
    - `pnpm --filter dispatch-control build` exits 0 (additive optional fields do not break existing consumers)
  </acceptance_criteria>
  <done>claim_checks carries five additive optional provenance fields; insertBatch accepts and persists them; codegen + dispatch-control build are green.</done>
</task>

</tasks>

<verification>
- API_CONTRACTS §35 exists and documents claims model + claimSpans + claim_checks additive fields (grep).
- convex/schema.ts + convex/claimChecks.ts carry the five provenance fields; `convex codegen` + `pnpm --filter dispatch-control build` both exit 0.
</verification>

<success_criteria>
Contract-first satisfied (docs amended before schema code); claim_checks upgraded in place with additive optional fields; Convex types regenerated; no consumer regression.
</success_criteria>

<output>
After completion, create `.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-01-SUMMARY.md`
</output>
