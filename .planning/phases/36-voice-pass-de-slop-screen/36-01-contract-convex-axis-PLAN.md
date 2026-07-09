---
phase: 36-voice-pass-de-slop-screen
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - convex/schema.ts
  - convex/qaCorrections.ts
  - apps/dispatch-control/__tests__/voicePassAxis.test.ts
autonomous: true
requirements: [VOX-01, VOX-04]
must_haves:
  truths:
    - "docs/API_CONTRACTS.md §36 declares the machine-tell axis, the Layer-1 axis passthrough, the facts-cleared narrowing + sounds-human prerequisite, the voice-recheck + voice-rewrite endpoints, the findings suggestedFixOverride, and the voice/factual axis partition — before any Phase 36 code is written"
    - "A qaCorrections:insert with axis: \"machine-tell\" succeeds (does not throw an ArgumentValidationError)"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "§36 Voice Pass contract section"
      contains: "§36"
    - path: "convex/schema.ts"
      provides: "machine-tell axis literal in qaCorrections table"
      contains: "machine-tell"
    - path: "convex/qaCorrections.ts"
      provides: "machine-tell axis literal in insert mutation"
      contains: "machine-tell"
    - path: "apps/dispatch-control/__tests__/voicePassAxis.test.ts"
      provides: "Convex-mutation-level regression guard for the closed-union silent-drop failure (research Pitfall 1)"
      contains: "machine-tell"
  key_links:
    - from: "convex/qaCorrections.ts insert.axis union"
      to: "convex/schema.ts qaCorrections.axis union"
      via: "identical literal set (both must contain machine-tell)"
      pattern: "machine-tell"
    - from: "apps/dispatch-control/__tests__/voicePassAxis.test.ts"
      to: "api.qaCorrections.insert"
      via: "convex-test t.mutation with axis: 'machine-tell'"
      pattern: "axis:\\s*'machine-tell'"
---

<objective>
Contract-first gate for Phase 36. Amend `docs/API_CONTRACTS.md` with a new §36 that declares every shape the rest of the phase implements (CLAUDE.md HARD rule: the contract precedes the code). Then land structural foundation #1 — add the `machine-tell` axis literal to BOTH Convex validators so the D-05 predicate's findings survive the write path instead of silently vanishing through `convex_mutation_safe` (research Pitfall 1), guarded by a Convex-mutation-level regression test.

Purpose: Without §36 the downstream endpoint/schema plans have no authority to implement against; without the Convex literal every `machine-tell` finding is dropped on write (the exact live gap that already exists for `structural-variety`).
Output: `docs/API_CONTRACTS.md` §36; `machine-tell` (+ `structural-variety`) in `convex/schema.ts` and `convex/qaCorrections.ts`; a passing convex-test asserting the literal round-trips.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/36-voice-pass-de-slop-screen/36-CONTEXT.md
@.planning/phases/36-voice-pass-de-slop-screen/36-RESEARCH.md
@docs/API_CONTRACTS.md
@convex/schema.ts
@convex/qaCorrections.ts
@apps/dispatch-control/__tests__/qaCorrectionsResolution.test.ts

<interfaces>
<!-- The current closed axis union (both files, verbatim) that must gain `machine-tell`.
     convex/schema.ts:85-92 (qaCorrections table) AND convex/qaCorrections.ts:31-38 (insert mutation args): -->
```typescript
axis: v.optional(v.union(
  v.literal('gravity'),
  v.literal('sentiment'),
  v.literal('irony-signaling'),
  v.literal('precision'),
  v.literal('cross-section-consistency'),
  v.literal('hard-rule'),
)),
```
<!-- convex-test harness (mirror qaCorrectionsResolution.test.ts): -->
```typescript
import { convexTest, schema } from './setup'
import { api } from '../../../convex/_generated/api'
const modules = import.meta.glob('../../../convex/**/*.*s')
const t = convexTest({ schema, modules })
await t.mutation(api.qaCorrections.insert, { runId, agentId: 'qa', sectionName: 'origin_story', reason: '...', severity: 'error', accepted: false, axis: 'machine-tell', quotedSpan: 'delve', suggestedFix: '...' })
```
<!-- Existing contract precedent to model §36 on: docs/API_CONTRACTS.md §33.3 (findings endpoints, 2792-2838),
     §34.3 (sign-off record endpoint, 2970-2998), §34.4 (publish gate restructure, 3000-3021). -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Amend docs/API_CONTRACTS.md with §36 Voice Pass contract</name>
  <read_first>
    - docs/API_CONTRACTS.md (read §33.3 lines 2792-2838, §34.3 lines 2970-2998, §34.4 lines 3000-3021, §35 header 3126 — match their exact numbering + prose + 409 body style)
    - .planning/phases/36-voice-pass-de-slop-screen/36-RESEARCH.md (Code Example 1, 2, 3; Pitfalls 1/2/3)
    - .planning/phases/36-voice-pass-de-slop-screen/36-CONTEXT.md (D-05, D-06, D-08, D-09, D-12, D-14)
  </read_first>
  <action>
    Insert a new top-level section `## §36 — Voice Pass (Phase 36)` after the §35 provenance block but BEFORE the trailing non-phase-numbered `## Error handling rules` section (~lines 3301-3314, the file's true end) — phase-numbered sections must precede that global trailing section; do NOT append at literal end-of-file. Write these subsections verbatim-enough that downstream plans copy shapes without inventing:

    - **§36.1 — `qaCorrections.axis` gains `machine-tell` (additive literal).** State that `convex/schema.ts` AND `convex/qaCorrections.ts` `insert` add `v.literal('machine-tell')` (and, closing the pre-existing gap, `v.literal('structural-variety')`) to the `axis` union. Note the failure mode being closed: pipeline writes go through `convex_mutation_safe` which swallows validator errors, so a missing literal silently drops the finding (research Pitfall 1).
    - **§36.2 — Layer-1 axis passthrough.** `agents/qa/__init__.py::qa()` STOPS collapsing every Layer-1 finding's axis to `"hard-rule"`; each Layer-1 finding is written with its predicate's true axis (`gravity`/`sentiment`/`irony-signaling`/`precision`/`machine-tell`). This is a change to shipped Phase 5 behavior (research Pitfall 3, option 2).
    - **§36.3 — Voice/factual axis partition.** Declare `VOICE_AXES = {gravity, sentiment, irony-signaling, machine-tell}` and `FACTUAL_AXES = {precision, cross-section-consistency, structural-variety, hard-rule}`. Voice Pass lights VOICE_AXES; Review Desk lights FACTUAL_AXES; a finding whose axis is undefined counts as factual (Review Desk / facts-cleared).
    - **§36.4 — `POST /issues/{run_id}/voice-recheck`** (new `api/voice_pass.py`, Clerk-JWT via `_require_clerk_jwt_control`). Flow: `_resolve_sanity_id` → `get_issue_draft` → `_draft_to_qa_sections(draft)` (mirrors `agents/qa/__init__.py::_extract_sections` over the draft `{sections, game, bonus, bonusType}` shape) → auto-supersede any OPEN prior re-check findings (`agentId == "qa-recheck"`, no `resolution`) via `qaCorrections:setResolution(resolution="dismissed", resolutionReason="superseded by re-check")` (research Pitfall 4 dedup) → `run_llm_judge(sections, run_id=run_id, narrator=None, rubric=None)` (narrator=None per Pitfall 6) → write each finding via `qaCorrections:insert` with `agentId="qa-recheck"`, `accepted=False`. Returns `{ "runId": run_id, "findingCount": n }`.
    - **§36.5 — `POST /issues/{run_id}/voice-rewrite`** (same router). Body `{ findingId: string }`. Loads the finding, calls `acomplete` (through the OpenRouter client, never a raw client) with a house-voice rewrite instruction over `finding.quotedSpan` (Jesse VOICE_CONSTRAINTS — MUST NOT introduce AI self-reference or hedging), returns `{ "findingId": string, "suggestedFix": string }`. This endpoint only GENERATES text; the client passes it to accept as `suggestedFixOverride` (§36.6).
    - **§36.6 — `_AcceptBody.suggestedFixOverride`.** `api/findings.py::_AcceptBody` gains `suggestedFixOverride: Optional[str] = None`; `accept_finding` computes `suggested_fix = body.suggestedFixOverride or finding.get("suggestedFix")`. All other accept flow (span resolve, patch, setResolution, audit, sign-off revoke) is UNCHANGED. This lets a rule-only tell (no stored `suggestedFix`) be accepted with an on-demand rewrite.
    - **§36.7 — Sign-off prerequisite partition.** `api/signoffs.py`: (a) NARROW the existing `facts-cleared` open-error scan to `f.axis NOT in VOICE_AXES` (research Pitfall 2 — this modifies shipped Phase 34 code); (b) ADD an `elif kind == "sounds-human":` branch that 409s `{"reason": "open_voice_findings", "message": "{n} voice finding(s) must be accepted or dismissed before signing sounds-human.", "count": n}` when any open `severity=="error"` finding has `axis in VOICE_AXES` (D-12/D-14). Anchor-blind like facts-cleared (an orphaned voice error still blocks). This UPGRADES Phase 34 D-06's interim ungated `sounds-human`.

    Keep the "ADD/REMOVE relative to current file" instruction style of §34.4 so downstream diffs are unambiguous.
  </action>
  <acceptance_criteria>
    - `grep -c "§36" docs/API_CONTRACTS.md` returns ≥ 7 (one header + six subsections referenced)
    - `grep -n "voice-recheck" docs/API_CONTRACTS.md` matches (§36.4)
    - `grep -n "voice-rewrite" docs/API_CONTRACTS.md` matches (§36.5)
    - `grep -n "suggestedFixOverride" docs/API_CONTRACTS.md` matches (§36.6)
    - `grep -n "open_voice_findings" docs/API_CONTRACTS.md` matches (§36.7)
    - `grep -En "VOICE_AXES|FACTUAL_AXES" docs/API_CONTRACTS.md` matches (§36.3)
    - `grep -n "qa-recheck" docs/API_CONTRACTS.md` matches (§36.4 dedup)
  </acceptance_criteria>
  <verify>
    <automated>grep -Eq "§36 — Voice Pass" docs/API_CONTRACTS.md && grep -q "voice-recheck" docs/API_CONTRACTS.md && grep -q "voice-rewrite" docs/API_CONTRACTS.md && grep -q "suggestedFixOverride" docs/API_CONTRACTS.md && grep -q "open_voice_findings" docs/API_CONTRACTS.md && echo CONTRACT_OK</automated>
  </verify>
  <done>docs/API_CONTRACTS.md contains a §36 section declaring the machine-tell axis, Layer-1 passthrough, axis partition, both new endpoints, the accept override, and the sign-off prerequisite partition — all before any Phase 36 code exists.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add machine-tell axis literal to both Convex validators + regression test</name>
  <read_first>
    - convex/schema.ts (qaCorrections table, lines 70-104 — the axis union at 85-92)
    - convex/qaCorrections.ts (insert mutation args, lines 16-66 — the axis union at 31-38)
    - apps/dispatch-control/__tests__/qaCorrectionsResolution.test.ts (convex-test harness to mirror — import.meta.glob, convexTest, api.qaCorrections.insert)
    - apps/dispatch-control/__tests__/setup.ts (convexTest + schema exports)
    - docs/API_CONTRACTS.md §36.1 (just written in Task 1)
  </read_first>
  <behavior>
    - Test 1 (RED→GREEN): `t.mutation(api.qaCorrections.insert, { ...validRow, axis: 'machine-tell' })` resolves without throwing, and the inserted row read back via `api.qaCorrections.byRunId` has `axis === 'machine-tell'`.
    - Test 2: the same insert with `axis: 'structural-variety'` also succeeds (closes the pre-existing Phase 18 gap opportunistically).
    - Test 3: an insert with `axis: 'not-a-real-axis'` still REJECTS (the union stays closed — regression that we only widened it deliberately).
  </behavior>
  <action>
    1. In `convex/schema.ts` `qaCorrections.axis` union (lines 85-92) add `v.literal('machine-tell'),` and `v.literal('structural-variety'),` alongside the existing six literals. Keep the inline comment convention; add `// Phase 36 §36.1: Voice Pass machine-tell axis` and `// Phase 18 gap-close: judge structural-variety axis`.
    2. In `convex/qaCorrections.ts` `insert` mutation `axis` union (lines 31-38) make the IDENTICAL two additions so the mutation validator matches the table validator.
    3. Create `apps/dispatch-control/__tests__/voicePassAxis.test.ts` mirroring `qaCorrectionsResolution.test.ts`'s harness (`import { convexTest, schema } from './setup'`, `const modules = import.meta.glob('../../../convex/**/*.*s')`, `import { api } from '../../../convex/_generated/api'`). Write the three behavior tests above. `insert` is the public GAM-05 exception — no pipeline secret needed for the insert call.

    Do NOT touch any other axis-consuming code here — the Python-side predicate and orchestrator changes are Plan 36-05 / 36-02.
  </action>
  <acceptance_criteria>
    - `grep -c "machine-tell" convex/schema.ts` returns ≥ 1
    - `grep -c "machine-tell" convex/qaCorrections.ts` returns ≥ 1
    - `grep -c "structural-variety" convex/schema.ts` returns ≥ 1 AND `grep -c "structural-variety" convex/qaCorrections.ts` returns ≥ 1
    - `apps/dispatch-control/__tests__/voicePassAxis.test.ts` exists and contains `axis: 'machine-tell'`
    - `cd apps/dispatch-control && npx vitest run __tests__/voicePassAxis.test.ts` exits 0 (all green)
  </acceptance_criteria>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/voicePassAxis.test.ts</automated>
  </verify>
  <done>Both Convex axis validators accept `machine-tell` and `structural-variety`; the convex-test proves the literal round-trips through the real `qaCorrections:insert` mutation and that unknown axes still reject.</done>
</task>

</tasks>

<verification>
- `grep` acceptance checks on §36 subsections pass (Task 1).
- `cd apps/dispatch-control && npx vitest run __tests__/voicePassAxis.test.ts` green (Task 2).
- `cd apps/dispatch-control && npx vitest run` full suite stays green (no regression from widening the union).
- `pnpm --filter dispatch-control build` exits 0 (strict type-check — the generated Convex types now include the new literals).
</verification>

<success_criteria>
docs/API_CONTRACTS.md declares the full §36 contract; the Convex axis union accepts `machine-tell` end-to-end (proven at the mutation level, not just a Python Literal); no existing test regresses.
</success_criteria>

<output>
After completion, create `.planning/phases/36-voice-pass-de-slop-screen/36-01-SUMMARY.md`.
</output>
