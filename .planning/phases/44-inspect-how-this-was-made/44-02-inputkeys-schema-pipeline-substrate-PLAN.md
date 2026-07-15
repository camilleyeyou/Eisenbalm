---
phase: 44-inspect-how-this-was-made
plan: 02
type: execute
wave: 2
depends_on: ["44-01"]
files_modified:
  - convex/schema.ts
  - convex/agentRuns.ts
  - packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py
  - packages/pipeline/tests/test_agent_wrapper.py
autonomous: true
requirements: [INS-03]
must_haves:
  truths:
    - "agent_run_payloads carries an additive-optional inputKeys: string[] holding the UNTRUNCATED top-level input key list, so the missing-inputs diff can be exact rather than approximate."
    - "The pipeline computes inputKeys from the input slice BEFORE truncation and emits it in the same savePayload mutation, so no key is lost to the ~2000-char cap."
    - "Legacy payload rows (no inputKeys) still work — the diff's truncation-note fallback (44-04) covers them."
  artifacts:
    - path: "convex/schema.ts"
      provides: "agent_run_payloads.inputKeys additive-optional field"
      contains: "inputKeys"
    - path: "convex/agentRuns.ts"
      provides: "savePayload mutation accepts + persists inputKeys"
      contains: "inputKeys"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py"
      provides: "untruncated inputKeys emission before _truncate"
      contains: "inputKeys"
  key_links:
    - from: "packages/pipeline/.../agent_wrapper.py::wrapped"
      to: "convex agentRuns:savePayload"
      via: "inputKeys=list(slice_.keys()) computed before _truncate"
      pattern: "inputKeys"
    - from: "convex/agentRuns.ts::savePayload"
      to: "agent_run_payloads.inputKeys"
      via: "patch/insert with the new optional arg"
      pattern: "inputKeys"
---

<objective>
Ship the additive-optional `agent_run_payloads.inputKeys` substrate the redefined missing-inputs diff (44-04, INS-03) needs to be EXACT rather than approximate. The input snapshot is truncated to ~2000 chars server-side (RESEARCH / CONTEXT D-05), so parsing its keys can silently drop a supplied key and produce a false "missing" on the phase's highest-leverage diagnostic. Persisting the untruncated top-level key list (keys only — cheap and small) computed BEFORE truncation makes the diff never lie under truncation.

This is a contract-first schema change: §44.5 (written in 44-01) already defines the field; this plan implements it.

Purpose: The Inputs tab's "missing expected inputs" call-out can be trusted on every current-and-future run.
Output: additive Convex field + mutation arg + pipeline emitter + pytest coverage.
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
<!-- convex/schema.ts (current) — extend agent_run_payloads with inputKeys -->
agent_run_payloads: defineTable({
  workspace_id: v.string(), runId: v.string(), agentKey: v.string(),
  inputSnapshot: v.optional(v.string()),   // JSON, truncated ~2000 chars
  outputSnapshot: v.optional(v.string()),  // JSON, truncated ~2000 chars
  // ADD: inputKeys: v.optional(v.array(v.string())),  // untruncated top-level key list (Phase 44, §44.5)
}).index('by_runId_agentKey', ['runId', 'agentKey'])

<!-- packages/pipeline/.../agent_wrapper.py current emit site (lines 176-185) -->
await convex_mutation_safe("agentRuns:savePayload", {
  "workspace_id": ws, "runId": run_id, "agentKey": agent_key,
  "inputSnapshot": _snapshot_input(agent_key, state),
  "outputSnapshot": _snapshot_output(result),
})
<!-- _snapshot_input builds slice_ = {k: state.get(k) for k in _INPUT_KEYS[agent_key] if k in state} then _truncate(json.dumps(slice_)). -->
<!-- inputKeys must be list(slice_.keys()) — the SAME keys, before truncation. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add agent_run_payloads.inputKeys to schema + savePayload mutation</name>
  <read_first>
    - convex/schema.ts lines 363-372 (agent_run_payloads definition)
    - convex/agentRuns.ts (find the `savePayload` mutation — its `args` validator and its `db.insert`/`db.patch` body; mirror how it currently handles inputSnapshot/outputSnapshot as optional)
    - docs/API_CONTRACTS.md §44.5 (the field spec — inputKeys: v.optional(v.array(v.string())))
  </read_first>
  <action>
    1. In `convex/schema.ts`, add `inputKeys: v.optional(v.array(v.string())),` to the `agent_run_payloads` table definition (directly after `outputSnapshot`), with a trailing comment `// Phase 44 §44.5 — untruncated top-level input key list for the missing-inputs diff; legacy rows omit it`.
    2. In `convex/agentRuns.ts::savePayload`, add `inputKeys: v.optional(v.array(v.string()))` to the mutation `args`, and thread it into the existing insert/patch object exactly the way `inputSnapshot`/`outputSnapshot` are threaded (upsert-by-`(runId, agentKey)` if that is the current shape). Do NOT change the existing snapshot behavior. Keep it optional so existing callers are unaffected.
    3. Do NOT run a data migration — legacy rows keep `inputKeys` absent; the 44-04 diff falls back with a truncation note.
  </action>
  <verify>
    <automated>grep -q "inputKeys" convex/schema.ts && grep -q "inputKeys" convex/agentRuns.ts && cd apps/dispatch-control && pnpm build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "inputKeys" convex/schema.ts` shows the field inside `agent_run_payloads`.
    - `grep -n "inputKeys" convex/agentRuns.ts` shows it in both the `args` validator and the write body of `savePayload`.
    - `pnpm --filter dispatch-control build` exits 0 (Convex codegen + Next strict build both pass — MEMORY note: vitest does not type-check).
  </acceptance_criteria>
  <done>The schema and mutation accept an optional inputKeys array; the build (incl. Convex generated types) passes.</done>
</task>

<task type="auto">
  <name>Task 2: Emit untruncated inputKeys from the pipeline + extend pytest</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py lines 33-93 (_INPUT_KEYS, _truncate, _snapshot_input) and lines 116-187 (wrapped(), the savePayload emit at 176-185)
    - packages/pipeline/tests/test_agent_wrapper.py (find the existing test that asserts the savePayload mutation payload — mirror its monkeypatch/capture style; DO NOT create a new test file, extend this one)
  </read_first>
  <action>
    1. In `agent_wrapper.py`, add a pure helper `_snapshot_input_keys(agent_key: str, state: dict) -> list[str]` that returns `[k for k in _INPUT_KEYS.get(agent_key, ["run_id"]) if k in state]` — the SAME keys `_snapshot_input` slices, computed with NO truncation. (Deriving from the same `_INPUT_KEYS` source guarantees the key list matches the snapshot's intended keys exactly.)
    2. In `wrapped()`, at the savePayload emit (lines 176-185), add `"inputKeys": _snapshot_input_keys(agent_key, state),` to the mutation dict alongside `inputSnapshot`/`outputSnapshot`. It must be computed independently of `_snapshot_input` (not by parsing the truncated string), so truncation can never drop a key from it.
    3. Extend `packages/pipeline/tests/test_agent_wrapper.py`: add a test asserting the captured `agentRuns:savePayload` mutation includes `inputKeys` equal to the expected key list for a chosen agent (e.g. `founder_bio` → `["research", "winning_charity", "style_brief"]`), AND a test that a large (>2000 char) state value truncates `inputSnapshot` but leaves `inputKeys` complete (feed a state where one slice value is a 5000-char string; assert `"...[truncated]"` appears in `inputSnapshot` yet all expected keys are present in `inputKeys`). This is the load-bearing INS-03 truncation-honesty guarantee at the source.
  </action>
  <verify>
    <automated>cd packages/pipeline && pytest tests/test_agent_wrapper.py -x</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "inputKeys\|_snapshot_input_keys" packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py` shows the helper and the emit.
    - `cd packages/pipeline && pytest tests/test_agent_wrapper.py -x` exits 0.
    - The new truncation test proves `inputSnapshot` contains `"...[truncated]"` while `inputKeys` still lists every expected key (no key lost to the cap).
  </acceptance_criteria>
  <done>The pipeline emits an untruncated inputKeys list in savePayload; pytest proves it survives truncation intact.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control build` passes (schema codegen + strict types).
- `cd packages/pipeline && pytest tests/test_agent_wrapper.py -x` passes.
- `grep inputKeys convex/schema.ts convex/agentRuns.ts packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py` — all three present.
</verification>

<success_criteria>
- The additive `inputKeys` field exists end-to-end (schema → mutation → pipeline emit) and is proven truncation-safe by pytest, giving 44-04's diff an exact "supplied" set.
</success_criteria>

<output>
After completion, create `.planning/phases/44-inspect-how-this-was-made/44-02-SUMMARY.md`. NOTE for the executor: per MEMORY, committing `convex/*.ts` is not deploying — the integration gate (44-09) runs the Convex sync; this plan only needs the build to pass.
</output>
