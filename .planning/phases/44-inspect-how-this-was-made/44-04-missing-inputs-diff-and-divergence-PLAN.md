---
phase: 44-inspect-how-this-was-made
plan: 04
type: execute
wave: 2
depends_on: ["44-01"]
files_modified:
  - apps/dispatch-control/lib/inspector/declaredStateInputs.ts
  - apps/dispatch-control/lib/inspector/missingInputsDiff.ts
  - apps/dispatch-control/lib/inspector/outputDivergence.ts
  - apps/dispatch-control/__tests__/missingInputsDiff.test.ts
  - apps/dispatch-control/__tests__/outputDivergence.test.ts
autonomous: true
requirements: [INS-03, INS-05]
must_haves:
  truths:
    - "The missing-inputs diff is computed against a ported declared-STATE-inputs vocabulary (mirrors agent_wrapper.py::_INPUT_KEYS), NOT VARIABLE_REGISTRY tokens — so it produces a meaningful diff instead of reporting every declared token missing for every agent (RESEARCH Pitfall 1)."
    - "The diff prefers the untruncated inputKeys; when absent it falls back to parsing the truncated snapshot AND flags the result approximate — it NEVER definitively asserts a key missing when truncation could have hidden it (D-05, the phase's worst failure mode)."
    - "The output-divergence predicate returns 'diverged'/'unchanged'/'unknown' and NEVER returns 'unchanged'/'current' without positive evidence (D-11)."
  artifacts:
    - path: "apps/dispatch-control/lib/inspector/declaredStateInputs.ts"
      provides: "DECLARED_STATE_INPUTS — per-agent DispatchState field-name whitelist ported from _INPUT_KEYS"
      exports: ["DECLARED_STATE_INPUTS"]
    - path: "apps/dispatch-control/lib/inspector/missingInputsDiff.ts"
      provides: "computeMissingInputs — the redefined, truncation-honest headline diff"
      exports: ["computeMissingInputs"]
    - path: "apps/dispatch-control/lib/inspector/outputDivergence.ts"
      provides: "computeOutputDivergence — 'diverged'|'unchanged'|'unknown', never a false 'unchanged'"
      exports: ["computeOutputDivergence"]
  key_links:
    - from: "lib/inspector/missingInputsDiff.ts"
      to: "lib/inspector/declaredStateInputs.ts"
      via: "declared = DECLARED_STATE_INPUTS[agentKey]"
      pattern: "DECLARED_STATE_INPUTS"
---

<objective>
Build the phase's headline diagnostic — the missing-inputs diff (INS-03) — REDEFINED per RESEARCH Pitfall 1, plus the output-divergence predicate (INS-05). This is the reconciliation the planning context flagged: CONTEXT D-04's literal recipe is broken by construction because `VARIABLE_REGISTRY` fine-grained `{token}` names and `inputSnapshot` coarse `DispatchState` field names never intersect, so a naive `declared − supplied` reports EVERY declared token missing for EVERY agent, always. This plan builds the coarser-but-correct diagnostic RESEARCH recommends: diff a ported "declared state inputs" vocabulary (the SAME `DispatchState` vocabulary the payload keys speak) against the run's actual input keys, honoring truncation.

Purpose: The Inputs tab turns a bad sentence into a concrete "this expected state input was absent from the run" — trustworthy, never a false positive. The Output tab notes divergence without ever falsely claiming "unchanged."
Output: three pure `lib/inspector/*` modules + their filled tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/44-inspect-how-this-was-made/44-CONTEXT.md
@.planning/phases/44-inspect-how-this-was-made/44-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- packages/pipeline/.../agent_wrapper.py::_INPUT_KEYS — port this table to TS (source of "declared state inputs") -->
// calibrator:["run_id"], scout:["style_brief"], advocate:["candidates"], editor_gate_1:["candidates"],
// chronicler:["candidates","winning_charity","editor_decision"], researcher:["winning_charity"],
// verify_research:["research"], origin_story/problem/founder_bio/case_study/game/bonus/design:["research","winning_charity","style_brief"],
// validate_sections:["run_id"], qa:["origin_story","problem_statement","founder_bio","case_study","game","bonus"],
// editor_final:["qa_corrections","winning_charity"], publisher:["sanity_issue_id","winning_charity"]

<!-- §44.4 contract this plan implements -->
interface MissingInputsResult {
  supplied: string[]
  missing: { key: string; gloss: string }[]   // gloss from VARIABLE_DESCRIPTIONS when available, else ''
  approximate: boolean                          // true when computed from a truncated snapshot (no inputKeys)
  note?: string                                 // "snapshot was truncated — this diff is approximate" when approximate
}
function computeMissingInputs(agentKey: string, inputKeys: string[] | undefined, inputSnapshot: string | undefined): MissingInputsResult
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Port DECLARED_STATE_INPUTS + build the truncation-honest missing diff</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py lines 33-53 (_INPUT_KEYS — the exact per-agent whitelist to port verbatim)
    - docs/API_CONTRACTS.md §44.4 and §44.5 (the redefined diff + inputKeys field + the "never assert missing under truncation" hard rule)
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VariableRegistry.ts (VARIABLE_DESCRIPTIONS — the gloss source; note most DispatchState field names like `research`/`winning_charity` are NOT in it, so gloss falls back to '')
    - .planning/phases/44-inspect-how-this-was-made/44-RESEARCH.md Pitfall 1 (why NOT to diff VARIABLE_REGISTRY; the characterization_examples token does not exist — do not use it as a fixture)
  </read_first>
  <behavior>
    - Test 1: `computeMissingInputs('founder_bio', ['research','winning_charity','style_brief'], '{...}')` → `missing: []`, `approximate: false`.
    - Test 2: `computeMissingInputs('founder_bio', ['research','style_brief'], ...)` → missing includes `winning_charity`, `approximate: false`.
    - Test 3 (the load-bearing truncation case): `inputKeys` undefined, `inputSnapshot` is a >2000-char string ending in `"...[truncated]"` whose parseable prefix does NOT contain `winning_charity` → `winning_charity` is rendered as "not captured (snapshot truncated)" via a distinct flag, `approximate: true`, and it is NOT reported as a definitive `missing` entry. (Assert `approximate === true` and that no entry claims a definitive missing when the snapshot was truncated.)
    - Test 4: `inputKeys` present always wins over `inputSnapshot`; `approximate` is false even if the snapshot is truncated.
    - Test 5: `computeMissingInputs('unknown_agent', undefined, undefined)` → empty declared set → `missing: []` with an honest "declared inputs unknown for this agent" degradation (no throw).
  </behavior>
  <action>
    1. Create `apps/dispatch-control/lib/inspector/declaredStateInputs.ts` exporting `DECLARED_STATE_INPUTS: Record<string, string[]>`, ported VERBATIM from `agent_wrapper.py::_INPUT_KEYS` (all entries above). Add a header comment citing the Python source path + line range as the authority (mirroring how VariableRegistry.ts documents its hand-derivation), so the two never silently drift.
    2. Create `apps/dispatch-control/lib/inspector/missingInputsDiff.ts` exporting `computeMissingInputs(agentKey, inputKeys, inputSnapshot): MissingInputsResult` (shape in the interfaces block). Logic:
       - `declared = DECLARED_STATE_INPUTS[agentKey] ?? []`.
       - If `inputKeys` is defined: `supplied = inputKeys`, `approximate = false`. `missing = declared.filter(k => !supplied.includes(k))` each mapped to `{ key, gloss: VARIABLE_DESCRIPTIONS[key] ?? '' }`.
       - Else if `inputSnapshot` is defined: parse it defensively (`try { Object.keys(JSON.parse(...)) } catch { [] }`) → `suppliedParsed`. `approximate = inputSnapshot.includes('...[truncated]')`. If `approximate`, a declared key NOT in `suppliedParsed` is NOT a definitive missing — return it in a separate `uncertain` structure OR fold into `missing` with a per-entry `truncated: true` flag and set `note`. THE HARD RULE: when `approximate`, the function must never present a plain, unqualified "missing" for a key that truncation could have hidden. Set `note = 'snapshot was truncated — this diff is approximate'`.
       - Else (`inputKeys` and `inputSnapshot` both undefined): `supplied = []`, `approximate = true`, `note = 'no input snapshot recorded for this step'`, and every declared key is uncertain (not definitive missing).
       - When `declared` is empty: `missing = []` and set a degradation note "declared inputs not catalogued for this agent" (honest, never a crash).
       - Return the `MissingInputsResult`.
    3. Do NOT import `VARIABLE_REGISTRY` for the diff itself — only `VARIABLE_DESCRIPTIONS` for the human gloss. The diff vocabulary is DECLARED_STATE_INPUTS only.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm test -- __tests__/missingInputsDiff.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `lib/inspector/declaredStateInputs.ts` exports `DECLARED_STATE_INPUTS` and its `founder_bio` value deep-equals `['research','winning_charity','style_brief']` (`grep` shows the entry; the test asserts it).
    - `lib/inspector/missingInputsDiff.ts` exports `computeMissingInputs`; `grep -q "VARIABLE_REGISTRY" apps/dispatch-control/lib/inspector/missingInputsDiff.ts` exits 1 (the diff does NOT use the token registry).
    - The test proves the truncation case (inputKeys undefined + `"...[truncated]"` snapshot) yields `approximate === true` and NO definitive "missing" for a key the truncation could hide.
    - `pnpm --filter dispatch-control test -- __tests__/missingInputsDiff.test.ts` exits 0.
  </acceptance_criteria>
  <done>The redefined, truncation-honest headline diff exists and its tests (incl. the >2000-char truncation guarantee) pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Build the output-divergence predicate + fill its test</name>
  <read_first>
    - docs/API_CONTRACTS.md §44.2 (the InspectorArtifact `outputNote`) and CONTEXT D-11 (never assert "unchanged"/"current" when unverifiable)
    - .planning/phases/44-inspect-how-this-was-made/44-RESEARCH.md § "Output divergence (INS-05)" (reuse the Phase 42/43 changedSinceCheck / content-patch-after-completedAt signal)
    - apps/dispatch-control/__tests__/outputDivergence.test.ts (the it.todo scaffold to fill)
    - convex/schema.ts (grep `changedSinceCheck` and `claim_checks` to confirm the signal's shape — the predicate takes pre-extracted booleans/timestamps as params, it does NOT query Convex)
  </read_first>
  <behavior>
    - Test 1: a content change with timestamp AFTER the run's `completedAt` → `'diverged'`.
    - Test 2: no evidence either way (no `completedAt`, or no change-audit info) → `'unknown'` (NEVER `'unchanged'`).
    - Test 3: positive evidence of no change after `completedAt` (an explicit `hasChangeAfter === false` from a real audit signal) → `'unchanged'`.
  </behavior>
  <action>
    Create `apps/dispatch-control/lib/inspector/outputDivergence.ts` exporting a pure `computeOutputDivergence(input: { completedAt?: number; changedSinceCheck?: boolean; lastChangeAt?: number; hasChangeAudit?: boolean }): 'diverged' | 'unchanged' | 'unknown'`. Logic per D-11:
      - If `changedSinceCheck === true` → `'diverged'`.
      - Else if `lastChangeAt != null && completedAt != null && lastChangeAt > completedAt` → `'diverged'`.
      - Else if `hasChangeAudit === true && completedAt != null && (lastChangeAt == null || lastChangeAt <= completedAt)` → `'unchanged'` (positive evidence: we have the change audit and it shows nothing after completion).
      - Else → `'unknown'` (default — silence is never asserted as "unchanged").
    Add a header comment: the container (44-06) supplies these fields from the same `changedSinceCheck`/content-patch machinery Phases 42/43 track; for artifact types with no such signal (rec/org/signal) the container passes nothing → `'unknown'`, correctly.
    Then fill `outputDivergence.test.ts` by converting its it.todo cases to live assertions of the three Behavior cases plus a rec-artifact "no signal → unknown" case.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm test -- __tests__/outputDivergence.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `lib/inspector/outputDivergence.ts` exports `computeOutputDivergence`.
    - `grep -c "it.todo" apps/dispatch-control/__tests__/outputDivergence.test.ts` returns 0.
    - The test proves `'unknown'` (not `'unchanged'`) is returned when there is no positive evidence, and `'unchanged'` only with `hasChangeAudit === true`.
    - `pnpm --filter dispatch-control test -- __tests__/outputDivergence.test.ts` exits 0.
  </acceptance_criteria>
  <done>The divergence predicate never falsely asserts "unchanged"; its test passes.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- __tests__/missingInputsDiff.test.ts __tests__/outputDivergence.test.ts` passes.
- `pnpm --filter dispatch-control build` still passes.
</verification>

<success_criteria>
- The headline missing-inputs diff is computed against the correct (state-input) vocabulary and is provably truncation-honest; the output-divergence predicate provably never lies about "unchanged." Both are pure, tested, and ready for the panel to consume.
</success_criteria>

<output>
After completion, create `.planning/phases/44-inspect-how-this-was-made/44-04-SUMMARY.md`.
</output>
