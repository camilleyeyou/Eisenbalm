---
phase: 44-inspect-how-this-was-made
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - apps/dispatch-control/__tests__/inspectorArtifact.test.ts
  - apps/dispatch-control/__tests__/missingInputsDiff.test.ts
  - apps/dispatch-control/__tests__/outputDivergence.test.ts
  - apps/dispatch-control/__tests__/InspectorPanel.test.tsx
  - apps/dispatch-control/__tests__/InspectorProvider.test.tsx
autonomous: true
requirements: [INS-01, INS-02, INS-03, INS-04, INS-05, INS-06]
must_haves:
  truths:
    - "docs/API_CONTRACTS.md contains a §44 section defining the InspectorArtifact shape, the resolver contract, the REDEFINED missing-inputs diff, and the openInspector contract — written BEFORE any implementation code (contract-first, D-13)."
    - "§44 documents the declared-state-inputs vocabulary redefinition (RESEARCH Pitfall 1) and marks fine-grained {token}-level gap detection as an explicit non-goal."
    - "Five Wave-0 test scaffold files exist under apps/dispatch-control/__tests__/, enumerating every VALIDATION.md test-map case as it.todo placeholders, and the full console suite stays green."
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "§44 inspector contract (shapes, resolver, diff redefinition, inputKeys field, artifact-key string encoding, footer live-vs-reserved table)"
      contains: "§44"
    - path: "apps/dispatch-control/__tests__/inspectorArtifact.test.ts"
      provides: "INS-01 resolver test scaffold (it.todo per case)"
    - path: "apps/dispatch-control/__tests__/missingInputsDiff.test.ts"
      provides: "INS-03 diff/truncation-honesty test scaffold"
    - path: "apps/dispatch-control/__tests__/outputDivergence.test.ts"
      provides: "INS-05 divergence test scaffold"
    - path: "apps/dispatch-control/__tests__/InspectorPanel.test.tsx"
      provides: "INS-02/INS-04/INS-06 panel test scaffold"
    - path: "apps/dispatch-control/__tests__/InspectorProvider.test.tsx"
      provides: "INS-01 one-instance/openInspector test scaffold"
  key_links:
    - from: "docs/API_CONTRACTS.md §44"
      to: "all downstream 44-xx plans"
      via: "canonical shape + resolver + diff contract read before implementing"
      pattern: "§44"
---

<objective>
Lay the phase's contract and test scaffolds BEFORE any implementation — the established Phase 35/38/39/42/43 contract-first pattern (CONTEXT D-13). This plan writes a new `docs/API_CONTRACTS.md` §44 capturing every shape the six later plans build against, and creates the five Wave-0 vitest scaffold files enumerating each VALIDATION.md test-map case as `it.todo` placeholders that later plans convert to live assertions.

CRITICAL reconciliation this contract must encode (from 44-RESEARCH Pitfall 1): the CONTEXT D-04 literal diff (`VARIABLE_REGISTRY[agentKey]` − `inputSnapshot` top-level keys) is broken by construction — the two vocabularies (fine-grained `{token}` names vs coarse `DispatchState` field names) never intersect, so it would report EVERY declared token as missing for EVERY agent. §44 must redefine the diff onto a computable "declared state inputs" vocabulary (a ported `_INPUT_KEYS`-style per-agent constant that speaks the same `DispatchState` vocabulary as the input-payload keys) and document fine-grained token-gap detection as an explicit non-goal.

Purpose: A different Claude instance can implement each later plan from §44 alone, with no guesswork about shapes, namespaces, the diff redefinition, or the artifact-key encoding.
Output: `docs/API_CONTRACTS.md` §44 + five test scaffold files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/44-inspect-how-this-was-made/44-CONTEXT.md
@.planning/phases/44-inspect-how-this-was-made/44-RESEARCH.md
@.planning/phases/44-inspect-how-this-was-made/44-VALIDATION.md
@docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- The InspectorArtifact contract from DERIVED-STATE-CONTRACT §8, verbatim — §44 must reproduce and pin this. -->
interface InspectorArtifact {
  title: string; meta: string          // "step: … · agent: … · instructions v4 · run #7"
  asked: string; result: string        // Summary tab — human-readable, never JSON
  confidence: string; warning: string
  upstream: string; downstream: string
  inputs: string                       // Inputs tab — values actually supplied
  missing: string                      // THE HIGH-VALUE FIELD — the redefined diff
  instructionVersion, instructions, sectionGuidance   // Instructions tab
  output: string; outputNote: string   // + note when the issue text has since diverged
  sources: { title, mark, passage, retrievedAt }[]
  model, timing, cost, latency, validation            // Diagnostics tab
  json: string                         // Technical tab — never the default anywhere
}

<!-- Existing Convex substrate the resolver/tabs project over (convex/schema.ts) -->
agent_runs: { runId, agentKey, status, costUsd?, durationMs?, tokensIn?, tokensOut?, error?, retryCount? }  // by_runId — NO model field
agent_run_payloads: { runId, agentKey, inputSnapshot?, outputSnapshot? }  // by_runId_agentKey — snapshots truncated ~2000 chars
prompt_versions: { agentKey, version, content, isActive }  // by_workspace_agentKey — via promptVersions.getActive
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write docs/API_CONTRACTS.md §44 — the full inspector contract</name>
  <read_first>
    - docs/API_CONTRACTS.md (read the tail — §42 at line ~4282, §43 at line ~4485 — to match the exact heading style `## §44 — Inspect How This Was Made (Phase 44)` and sub-section `### §44.n` convention)
    - docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md §8 (the InspectorArtifact interface + "missing = declared − supplied" text) and §7 (11 action-named steps + "Restart from this step / completed steps reused, not re-paid")
    - .planning/phases/44-inspect-how-this-was-made/44-RESEARCH.md (Pitfall 1 vocabulary mismatch; the sectionIdMap reuse; the editor_gate_1/editor_gate1 split; the claim→researcher correction; the agent_runs "no model field" finding; Pitfall 6 resume endpoint is Gate-1-only)
    - convex/schema.ts lines 302-315 (prompt_versions), 345-372 (agent_runs, agent_run_payloads)
    - packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py lines 33-82 (_INPUT_KEYS + _truncate + _snapshot_input)
    - apps/dispatch-control/lib/galley/sectionIdMap.ts (galleyIdToQaSection — the reused bridge)
  </read_first>
  <action>
    Append a new section `## §44 — Inspect How This Was Made (Phase 44)` to docs/API_CONTRACTS.md (after §43). Include these sub-sections with concrete shapes and values:

    ### §44.1 — `InspectorArtifactKey` and its string encoding
    - Define the six artifact types: `type InspectorArtifactType = 'founder' | 'claim' | 'rec' | 'org' | 'signal' | 'qa'`.
    - Define `interface InspectorArtifactKey { type: InspectorArtifactType; runId: string; locator: string }`. Document `locator` per type: `founder` = galley sectionId (e.g. `founderBio`) OR qa sectionName (e.g. `founder_bio`); `claim` = claimId; `rec` = `''`; `qa` = qa sectionName or `''`; `org` = candidateId or `''`; `signal` = leadId or `''`.
    - Define the string form carried on `DerivedTask.insp` and passed to `openInspector`: `` `${type}:${runId}:${locator}` `` (locator may be empty → trailing colon). Specify `encodeArtifactKey(k): string` and `parseArtifactKey(s): InspectorArtifactKey` round-trip. runId never contains `:` (it is a uuid-like id); locator is split as "everything after the second colon" to tolerate a `:` inside a locator.

    ### §44.2 — `InspectorArtifact` shape
    - Reproduce the DERIVED-STATE-CONTRACT §8 `InspectorArtifact` interface VERBATIM (see the interfaces block in this plan's context) and mark it the canonical console-side type. Note it is ASSEMBLED in the panel container from Convex query results + the resolver + the diff — it is NOT a stored row.

    ### §44.3 — the pure resolver contract (`lib/inspectorArtifact.ts`)
    - `resolveInspectorStep(key: InspectorArtifactKey, opts?: { bonusType?: string }): ResolvedStep` where `interface ResolvedStep { agentKey: string; promptKey: string | null; degraded: boolean; sectionContext?: string }`.
    - `agentKey` = the `agent_runs`/`agent_run_payloads` namespace key. `promptKey` = the `prompt_versions`/`VARIABLE_REGISTRY`/prompt-lab namespace key (or `null` when the agent is not externalized).
    - Mapping table (write it out): `founder` → normalize locator via `galleyIdToQaSection(locator) ?? (KNOWN_RUN_KEYS.has(locator) ? locator : null)` giving one of `origin_story|problem|founder_bio|case_study|game|bonus`; `claim` → `researcher` (NOT a `claim_checks.agent` field — that field does not exist, RESEARCH Pitfall 4), with `sectionContext = galleyIdToQaSection`-derived "appears in" label; `rec` → `editor_final`; `qa` → `qa`; `org` → `scout`; `signal` → `signal_editor` (degraded=true when no such step exists in the run, D-03).
    - `promptKey = runKeyToPromptKey(agentKey, opts?.bonusType)`. Specify `runKeyToPromptKey`: `editor_gate_1 → editor_gate1` (the one hard alias, RESEARCH Pitfall 3); `origin_story|problem|founder_bio|case_study|qa → null` (deliberately NOT externalized — no prompt_versions row, RESEARCH Pitfall 2); `bonus → bonus_{variant}` where variant derives from `bonusType` (`bigBudget→bonus_big_budget`, `jingle→bonus_jingle`, `specAd→bonus_spec_ad`) or `null` when bonusType absent; everything else → identity.

    ### §44.4 — the REDEFINED missing-inputs diff (INS-03 — the headline)
    - State plainly: CONTEXT D-04's literal recipe (diff `VARIABLE_REGISTRY[agentKey]` against `inputSnapshot` top-level keys) is REJECTED — the two vocabularies never intersect (RESEARCH Pitfall 1), so it reports every declared token missing for every agent, always. The prototype's `characterization_examples` token does not exist in the real codebase and must not be used as a fixture.
    - Define the shipped diagnostic: `declared` = a ported per-agent constant `DECLARED_STATE_INPUTS[agentKey]` (mirroring `agent_wrapper.py::_INPUT_KEYS` — same `DispatchState` field-name vocabulary as the payload keys). `supplied` = the run's ACTUAL top-level input keys. `missing = declared − supplied`, each surfaced with a human gloss.
    - `supplied` source + truncation honesty (D-05): prefer the additive-optional untruncated `agent_run_payloads.inputKeys` (see §44.5); when absent (legacy rows), fall back to `Object.keys(JSON.parse(inputSnapshot))` AND render an explicit "snapshot was truncated — this diff is approximate" note. HARD RULE: the diff must never assert a key is missing when truncation could have hidden it (if `inputKeys` is absent, a declared key not seen in the parsed snapshot is rendered "not captured (snapshot truncated)", never a definitive "missing").
    - Explicit NON-GOAL (document, do not silently attempt): fine-grained `{token}`-level substitution-gap detection. It requires capturing the resolved token→value map at prompt-build time (a bigger `agent_wrapper.py` change) and is out of Phase 44 scope.

    ### §44.5 — additive `agent_run_payloads.inputKeys` field (D-05, contract-first)
    - `inputKeys: v.optional(v.array(v.string()))` — the untruncated top-level key list of the input slice, computed BEFORE `_truncate()` in `agent_wrapper.py`. Legacy rows omit it (the §44.4 fallback covers them). This is additive-optional exactly like every Phase 35/42 field.

    ### §44.6 — `openInspector(artifactKey)` opener contract (INS-01, D-06)
    - `openInspector(key: string | InspectorArtifactKey): void` and `closeInspector(): void`, exposed via a React context (`useInspector()`). EXACTLY ONE panel instance is mounted app-wide (recommend the `(dashboard)` root layout so it covers all six entry points incl. `/my-tasks`, which is NOT under the issue-workspace frame). All six entry points call the same opener — never a second panel.

    ### §44.7 — footer actions: live deep-links vs reserved (INS-06, D-08)
    - Table of the six footer actions on EVERY artifact type: **Improve this agent →** live → `/prompt-lab/${encodeURIComponent(promptKey)}` (uses the promptKey namespace, i.e. the `editor_gate1` alias); **Compare instruction versions** live → same `/prompt-lab/${promptKey}` page (version history lives there); **Related quality tests** live → `/eval-center` (optionally `?agent=${promptKey}` if the page supports a filter — executor confirms); **Prior & downstream steps** live → resolved inline from `PIPELINE_EDGES` (Summary tab `upstream`/`downstream`) + optional deep-link to `/run-monitor/graph`; **Ask agent to revise** RESERVED (disabled + title "Arrives in Phase 45"); **Restart from this step** RESERVED for all artifact types — `POST /run/{id}/resume` is hardcoded to the Gate-1 interrupt shape (RESEARCH Pitfall 6) and cannot serve generic step-restart (disabled + title "Completed steps are reused, not re-paid — general step restart is not yet wired"). When promptKey is `null` (non-externalized agents), Improve/Compare render reserved with title "This agent's instructions are code-defined, not editable here."

    ### §44.8 — Diagnostics "model" field (RESEARCH finding)
    - `agent_runs` has NO `model` field. The Diagnostics tab renders `model` as "not recorded" (label + icon, honesty rule) for Phase 44 — no schema change. Note the follow-up option (add `agent_runs.model`) as out-of-scope-for-now.

    Keep the section self-contained and skimmable; use `ts` fenced blocks for the interfaces.
  </action>
  <verify>
    <automated>grep -q "## §44 — Inspect How This Was Made" docs/API_CONTRACTS.md && grep -q "DECLARED_STATE_INPUTS" docs/API_CONTRACTS.md && grep -q "runKeyToPromptKey" docs/API_CONTRACTS.md && grep -q "inputKeys" docs/API_CONTRACTS.md && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "§44" docs/API_CONTRACTS.md` returns ≥ 1 and the section header `## §44 — Inspect How This Was Made (Phase 44)` is present.
    - `grep -q "DECLARED_STATE_INPUTS" docs/API_CONTRACTS.md` exits 0 (the redefined-diff vocabulary is named).
    - `grep -q "non-goal" docs/API_CONTRACTS.md` (case-insensitive OK) — the token-level diff is explicitly marked out of scope.
    - `grep -q "editor_gate1" docs/API_CONTRACTS.md && grep -q "editor_gate_1" docs/API_CONTRACTS.md` — both namespaces documented (the alias).
    - `grep -q "run/{id}/resume\|Restart from this step" docs/API_CONTRACTS.md` — the reserved resume decision is recorded.
  </acceptance_criteria>
  <done>§44 exists with all eight sub-sections; the diff redefinition, the alias, the reserved footer actions, the inputKeys field, and the artifact-key encoding are all specified with concrete values.</done>
</task>

<task type="auto">
  <name>Task 2: Create the five Wave-0 vitest scaffold files (it.todo per VALIDATION case)</name>
  <read_first>
    - .planning/phases/44-inspect-how-this-was-made/44-VALIDATION.md (the Per-Task Verification Map + Wave 0 Requirements — the exact cases to enumerate)
    - apps/dispatch-control/vitest.config.ts (confirm test glob includes `__tests__/**`)
    - apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts (an existing test file — copy its import style + top-of-file header comment convention)
  </read_first>
  <action>
    Create five files under `apps/dispatch-control/__tests__/`. Each is a valid vitest file that RUNS GREEN today by using `it.todo(...)` (or `describe` + `it.todo`) placeholders — NO real imports of not-yet-existing modules (so the suite never goes red between waves). Each `it.todo` label states the exact behavior the implementing plan will assert. Enumerate:

    `inspectorArtifact.test.ts` (INS-01, filled by 44-03):
      - it.todo("founder locator 'founderBio' resolves to agentKey 'founder_bio' with promptKey null (not externalized)")
      - it.todo("founder locator 'game' resolves to agentKey 'game' with promptKey 'game'")
      - it.todo("bonus resolves to agentKey 'bonus'; with bonusType 'jingle' promptKey is 'bonus_jingle'")
      - it.todo("editor_gate_1 run key maps to promptKey 'editor_gate1' (the one hard alias)")
      - it.todo("claim resolves to agentKey 'researcher' (claim_checks has no agent field)")
      - it.todo("rec resolves to 'editor_final'; qa resolves to 'qa' (promptKey null)")
      - it.todo("signal/org degrade with degraded=true when the run has no such step")
      - it.todo("encodeArtifactKey/parseArtifactKey round-trip, including empty locator and a locator containing ':'")

    `missingInputsDiff.test.ts` (INS-03, filled by 44-04):
      - it.todo("missing = DECLARED_STATE_INPUTS[agentKey] − supplied keys")
      - it.todo("uses untruncated inputKeys when present — a supplied-but-truncated-away key is NEVER reported missing")
      - it.todo("falls back to parsing inputSnapshot when inputKeys absent AND emits an 'approximate — snapshot truncated' note")
      - it.todo("a declared key absent from a >2000-char truncated snapshot (no inputKeys) renders 'not captured (truncated)', never definitive 'missing'")
      - it.todo("degrades honestly when DECLARED_STATE_INPUTS[agentKey] is empty/unknown")

    `outputDivergence.test.ts` (INS-05, filled by 44-04):
      - it.todo("returns 'diverged' when a content change landed after the run's completedAt")
      - it.todo("returns 'unknown' (never 'unchanged'/'current') when there is no positive evidence either way")
      - it.todo("returns 'unchanged' only with positive evidence of no change after completedAt")

    `InspectorPanel.test.tsx` (INS-02/INS-04/INS-06, filled by 44-05):
      - it.todo("default active tab is Summary; Technical is never the default")
      - it.todo("every non-Technical tab leads with human-readable content; raw JSON sits behind a 'Show raw JSON' toggle")
      - it.todo("Instructions tab renders 'not externalized — code-defined' for origin_story/problem/founder_bio/case_study/qa")
      - it.todo("Diagnostics 'model' renders 'not recorded' with a label+icon, never blank")
      - it.todo("footer 'Restart from this step' is disabled with an explanatory title for all artifact types")
      - it.todo("footer 'Ask agent to revise' is disabled (reserved, Phase 45)")
      - it.todo("live footer actions deep-link using the promptKey namespace (editor_gate1, not editor_gate_1)")

    `InspectorProvider.test.tsx` (INS-01, filled by 44-06):
      - it.todo("openInspector(key) sets the active artifact key; closeInspector clears it")
      - it.todo("exactly one panel instance renders regardless of how many entry points call openInspector")

    Each file: `import { describe, it } from 'vitest'` and a top header comment `// Phase 44 Wave-0 scaffold (44-01). Cases are it.todo until <plan> fills them.`
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm test -- __tests__/inspectorArtifact.test.ts __tests__/missingInputsDiff.test.ts __tests__/outputDivergence.test.ts __tests__/InspectorPanel.test.tsx __tests__/InspectorProvider.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - All five files exist: `ls apps/dispatch-control/__tests__/inspectorArtifact.test.ts apps/dispatch-control/__tests__/missingInputsDiff.test.ts apps/dispatch-control/__tests__/outputDivergence.test.ts apps/dispatch-control/__tests__/InspectorPanel.test.tsx apps/dispatch-control/__tests__/InspectorProvider.test.tsx` exits 0.
    - `pnpm --filter dispatch-control test` exits 0 (suite green — todos do not fail).
    - `grep -c "it.todo" apps/dispatch-control/__tests__/inspectorArtifact.test.ts` returns ≥ 8.
    - No file imports a module under `lib/inspector*` or `components/inspector*` (grep returns nothing) so the suite cannot go red on missing modules.
  </acceptance_criteria>
  <done>Five scaffold files enumerate every VALIDATION.md case as it.todo; the full console suite runs green.</done>
</task>

</tasks>

<verification>
- `grep "## §44" docs/API_CONTRACTS.md` finds the new section.
- `pnpm --filter dispatch-control test` passes (all prior tripwires + the new todo scaffolds green).
- The five scaffold files exist and enumerate the VALIDATION cases.
</verification>

<success_criteria>
- Contract §44 fully specifies the InspectorArtifact shape, the pure resolver + namespace alias, the REDEFINED missing-inputs diff (with the token-level diff marked non-goal), the additive inputKeys field, the openInspector one-instance contract, the footer live-vs-reserved table, and the artifact-key string encoding — enough that each later plan implements from §44 alone.
- Five Wave-0 test scaffolds exist and the suite stays green.
</success_criteria>

<output>
After completion, create `.planning/phases/44-inspect-how-this-was-made/44-01-SUMMARY.md`.
</output>
