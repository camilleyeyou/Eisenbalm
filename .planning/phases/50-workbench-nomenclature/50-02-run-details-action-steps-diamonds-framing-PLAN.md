---
phase: 50-workbench-nomenclature
plan: 02
type: execute
wave: 1
depends_on: ["50-00"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx
  - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentNode.tsx
  - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx
  - apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx
  - apps/dispatch-control/__tests__/runDetailActionNames.test.ts
autonomous: true
requirements: [WBN-02]

must_haves:
  truths:
    - "Every pipeline step is named by its action (§7), with the agent shown as secondary metadata"
    - "verify_candidates, verify_research, and publisher render as marigold diamonds; other nodes as dots"
    - "The Run Details header states plainly whether it is a historical record or a live run — never 'Monitor' when idle"
    - "The seven writers present as one 'Draft sections' step, not seven separate top-level steps"
    - "Copy calls the diamonds 'deterministic check', never 'gate' or 'node'"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx"
      provides: "action-name label via RUN_STEP_MAP (replaces toDisplayName) + isGate from reconciled GATE_KEYS"
      contains: "RUN_STEP_MAP|runStepFor"
    - path: "apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx"
      provides: "action-primary/agent-secondary step rows + historical-vs-live header"
      contains: "runStepFor|actionLabel"
  key_links:
    - from: "apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx"
      to: "apps/dispatch-control/lib/nomenclature.ts"
      via: "runStepFor(agentKey).actionLabel replaces toDisplayName()"
      pattern: "runStepFor|RUN_STEP_MAP"
    - from: "apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentNode.tsx"
      to: "pipelineTopology GATE_KEYS"
      via: "isGate → diamond render (unchanged visual, reconciled set)"
      pattern: "isGate"
---

<objective>
WBN-02. Make Run Details editorially legible: name every step by its action (§7), show the agent as secondary metadata, render the reconciled deterministic-check set as diamonds, collapse the seven writers into one "Draft sections" step, and state plainly whether the view is a historical record or a live run (never "Monitor" when idle).

Purpose: Today the Graph spine title-cases node ids (`toDisplayName`) and RunDetail shows raw `agentKey` — technically legible, editorially opaque (D-07). This plan wires the shared `RUN_STEP_MAP` (built in 50-00) into both surfaces and reconciles the diamond copy/legend to the live 20-node graph (D-08/D-09).
Output: Action-named steps + reconciled diamonds + historical/live framing on the Graph spine and the runs detail table.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/50-workbench-nomenclature/50-CONTEXT.md
@.planning/phases/50-workbench-nomenclature/50-RESEARCH.md
@docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md
@docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md
@apps/dispatch-control/lib/nomenclature.ts
@apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts
@apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx
@apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentNode.tsx
@apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx

<interfaces>
<!-- §7 step vocabulary (DERIVED-STATE §7) — step STATES: -->
  Waiting · Running · Complete · Paused — done · Failed · Skipped

<!-- lib/nomenclature.ts (50-00): runStepFor(agentKey) → { actionLabel, agentLabel, isDeterministicCheck, named } -->
<!-- The 11 named §7 steps (action primary — agent secondary):
  1 signal_editor→'Find story leads' (Signal Editor)   2 scout→'Find organizations' (Scout)
  3 verify_candidates→'Verify organizations' (deterministic check) ◆
  4 advocate→'Make the case' (Advocate)   5 editor_gate_1→'Choose recommended story' (Agent Editor)
  6 researcher→'Research the issue' (Researcher)   7 verify_research→'Verify research' (deterministic check) ◆
  8 origin_story/problem/founder_bio/case_study/game/bonus/design→'Draft sections' (seven writing agents)
  9 qa→'Check the draft' (QA)   10 editor_final→'Recommend publication' (Agent Editor Final)
  11 publisher→'Prepare publication' (Publisher) ◆
  Supporting (named:false, plain fallback label, NOT one of the 11): calibrator, chronicler, validate_sections -->

<!-- AgentNode diamond render (reuse as-is, NO new visual system): -->
  data-testid = isGate ? 'agent-node-diamond' : 'agent-node-dot'
  isGate is set by PipelineGraph from GATE_KEYS.has(key). GATE_KEYS (50-00) = {verify_candidates, verify_research, publisher}.

<!-- PipelineGraph.tsx:48 has `function toDisplayName(key)` used at :100 `displayName: toDisplayName(agentKey)` — replace with runStepFor(key).actionLabel. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wire RUN_STEP_MAP into the Graph spine (action names + reconciled diamonds)</name>
  <files>apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx, apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentNode.tsx, apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx (toDisplayName + node data assembly + isGate)
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentNode.tsx (diamond/dot render + displayName)
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx ("node" copy hot spot)
    - apps/dispatch-control/lib/nomenclature.ts (runStepFor + RUN_STEP_MAP)
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts (reconciled GATE_KEYS)
  </read_first>
  <action>
    In `PipelineGraph.tsx`: replace `toDisplayName(agentKey)` (the title-caser at ~:48/:100) with `runStepFor(agentKey).actionLabel` from `lib/nomenclature.ts` so the node's primary label is the ACTION. Surface the agent as secondary metadata on the node (pass `agentLabel` through node data). `isGate` continues to come from `GATE_KEYS.has(agentKey)` — since 50-00 reconciled GATE_KEYS to {verify_candidates, verify_research, publisher}, the diamonds now render for those three automatically; make no visual change. Delete the now-unused `toDisplayName` if nothing else references it.
    In `AgentNode.tsx`: render the action label as the primary node title and the `agentLabel` as a small secondary line/caption (e.g. "— Signal Editor"). Update the stale inline comment that says "the two real code gates (verify_research, validate_sections)" to the reconciled set {verify_candidates, verify_research, publisher}. Keep `data-testid` logic (diamond/dot) unchanged.
    In `AgentIOPanel.tsx`: replace operator-facing "node" prose with "step" (per the nomenclature table: Node → step). Do NOT rename any `agentKey`/identifier — copy only.
  </action>
  <acceptance_criteria>
    - `grep -n "toDisplayName" apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx` returns nothing (removed) OR it is no longer used for node labels.
    - `grep -n "runStepFor\|RUN_STEP_MAP" apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx` hits.
    - AgentNode comment names {verify_candidates, verify_research, publisher} and no longer says "validate_sections" as a gate.
    - `grep -rniE "\bnode\b" apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx` returns no operator-facing prose "node" (identifiers/aria excluded).
    - `pnpm --filter dispatch-control build` exits 0.
  </acceptance_criteria>
  <verify><automated>pnpm --filter dispatch-control build</automated></verify>
  <done>The Graph spine labels every node by its §7 action with the agent secondary; verify_candidates/verify_research/publisher render as diamonds; "node" is gone from the IO panel copy.</done>
</task>

<task type="auto">
  <name>Task 2: RunDetail action-primary rows, Draft-sections collapse, historical-vs-live header + test</name>
  <files>apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx, apps/dispatch-control/__tests__/runDetailActionNames.test.ts</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx (raw agentKey rows + the "Run Details" header + status field)
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/WriterExpansion.tsx (Phase 37 7-writers grouping precedent to reuse, if present)
    - apps/dispatch-control/lib/nomenclature.ts (runStepFor + named flag)
    - docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md §7 (step states + historical-vs-live rule)
    - .planning/phases/50-RESEARCH.md §"Pitfall 4" (writers collapse) + §"Pitfall 5" (calibrator/chronicler/validate_sections have no §7 name)
  </read_first>
  <action>
    In `RunDetail.tsx`:
    1. Replace each raw `agentKey` cell with `runStepFor(agentKey).actionLabel` PRIMARY and `agentLabel` SECONDARY (e.g. "Draft sections — seven writing agents" / "Find story leads — Signal Editor"). Never present the bare technical key as the step name.
    2. Collapse the seven writers (origin_story/problem/founder_bio/case_study/game/bonus/design) into ONE "Draft sections" step rather than seven separate top-level rows — reuse/adapt `WriterExpansion.tsx`'s grouping if it exists; otherwise render a single "Draft sections" row that expands to the per-writer detail. Fold `validate_sections` into that same "Draft sections" unit (join point, not a separate visible step, not a diamond). This keeps the visible named-step count at 11 exactly matching §7.
    3. Render `calibrator` and `chronicler` as supporting/secondary sub-steps (dimmed or grouped), using their plain fallback labels from `runStepFor` (named:false) — NOT as invented §7-verbatim steps, and never blank.
    4. Header framing (D-09): the header must state plainly whether this is a **historical record** or a **live run** based on run status (a finished/failed run → "historical record"; an in-flight run → live). Never use the word "Monitor" in the idle/finished copy path. Use the §7 step-state vocabulary for per-step status: Waiting · Running · Complete · Paused — done · Failed · Skipped.
    Create `apps/dispatch-control/__tests__/runDetailActionNames.test.ts`:
      - Assert `runStepFor('signal_editor').actionLabel === 'Find story leads'`, `runStepFor('verify_candidates').actionLabel === 'Verify organizations'` and `.isDeterministicCheck === true`, `runStepFor('publisher').isDeterministicCheck === true`, `runStepFor('origin_story').actionLabel === 'Draft sections'`.
      - Assert the diamond set is exactly {verify_candidates, verify_research, publisher} by cross-checking `RUN_STEP_MAP` isDeterministicCheck flags against topology `GATE_KEYS` (they must agree; catches drift).
      - Assert `runStepFor` returns a non-empty `actionLabel` for `calibrator`/`chronicler`/`validate_sections` with `named === false` (nothing blank; not counted among the 11).
      - Source-scan `RunDetail.tsx` asserting the word "Monitor" does NOT appear in its rendered idle/finished header path (per WBN-02 framing).
  </action>
  <acceptance_criteria>
    - `grep -n "runStepFor\|actionLabel" apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx` hits (action-name map applied).
    - `pnpm --filter dispatch-control test -- --run runDetailActionNames` passes all assertions (action labels, diamond-set agreement, named:false fallbacks, no "Monitor" in idle header).
    - The 7 writers render as ONE "Draft sections" step (test or DOM assertion shows a single top-level Draft-sections row, not seven).
    - `pnpm --filter dispatch-control build` exits 0.
  </acceptance_criteria>
  <verify><automated>pnpm --filter dispatch-control test -- --run runDetailActionNames && pnpm --filter dispatch-control build</automated></verify>
  <done>RunDetail names steps by action with agent secondary, collapses the 7 writers + validate_sections into one "Draft sections" step, frames the view as historical-vs-live (never "Monitor" idle), and a test pins the map + diamond-set agreement.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- --run runDetailActionNames pipelineTopology` green.
- `pnpm --filter dispatch-control build` exits 0.
- RUN_STEP_MAP isDeterministicCheck flags agree with topology GATE_KEYS (asserted).
</verification>

<success_criteria>
- Steps named by action (§7 verbatim), agent secondary, on both the Graph spine and the runs table.
- verify_candidates / verify_research / publisher render as diamonds; copy calls them "deterministic check", never "gate"/"node".
- The seven writers collapse into one "Draft sections" step; validate_sections folds in.
- The header states historical-vs-live; "Monitor" never appears when idle.
</success_criteria>

<output>
After completion, create `.planning/phases/50-workbench-nomenclature/50-02-SUMMARY.md`.
</output>
