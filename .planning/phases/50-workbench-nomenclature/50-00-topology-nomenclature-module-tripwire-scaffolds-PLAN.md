---
phase: 50-workbench-nomenclature
plan: 00
type: execute
wave: 0
depends_on: []
files_modified:
  - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts
  - apps/dispatch-control/__tests__/pipelineTopology.test.ts
  - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VariableRegistry.ts
  - apps/dispatch-control/lib/nomenclature.ts
  - apps/dispatch-control/__tests__/nomenclature.test.ts
  - apps/dispatch-control/__tests__/rename-preservation.test.ts
autonomous: true
requirements: [WBN-02, WBN-05]

must_haves:
  truths:
    - "pipelineTopology.ts declares the real 20 pipeline nodes including signal_editor and verify_candidates"
    - "The deterministic-check diamond set (GATE_KEYS) equals {verify_candidates, verify_research, publisher}"
    - "A shared nomenclature module exports the §7 action-name map and renamed Workbench term constants"
    - "A banned-legacy-term source-scan tripwire exists (skip-guarded until the sweep lands)"
    - "A route/enum preservation tripwire proves route folders + charities.status='blocklisted' are NOT renamed"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts"
      provides: "20-node topology + reconciled GATE_KEYS diamond set"
      contains: "signal_editor"
    - path: "apps/dispatch-control/lib/nomenclature.ts"
      provides: "RUN_STEP_MAP + WORKBENCH_NAV_LABELS + renamed-term constants (D-06 source of truth)"
      contains: "RUN_STEP_MAP"
    - path: "apps/dispatch-control/__tests__/nomenclature.test.ts"
      provides: "banned-legacy-term source-scan tripwire (skip-guarded scaffold)"
      contains: "FORBIDDEN_COPY_TERMS"
    - path: "apps/dispatch-control/__tests__/rename-preservation.test.ts"
      provides: "route + stored-enum preservation guard (green immediately)"
      contains: "blocklisted"
  key_links:
    - from: "apps/dispatch-control/lib/nomenclature.ts"
      to: "apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts"
      via: "import { GATE_KEYS } — single diamond source of truth"
      pattern: "GATE_KEYS"
    - from: "apps/dispatch-control/__tests__/pipelineTopology.test.ts"
      to: "pipelineTopology.ts"
      via: "asserts 20 nodes + 3-diamond set"
      pattern: "toHaveLength\\(20\\)"
---

<objective>
Wave 0 prerequisite. Fix the stale frontend topology (18→20 nodes) so WBN-02's action steps and diamonds can render at all, build the shared nomenclature source-of-truth module (D-06), and lay the source-scan tripwire scaffolds that later waves turn green.

Purpose: `pipelineTopology.ts` is the load-bearing blocker (RESEARCH finding #1) — it undercounts the live 20-node graph and its test pins the stale 18. Until this lands, `signal_editor`/`verify_candidates` cannot appear on Run Details, and the diamond reconciliation (D-08) is impossible. This plan also creates the one shared label module the rest of the phase consumes, plus the tripwire tests that prove no legacy term survives and that no route/enum was renamed.
Output: A correct 20-node topology, the reconciled diamond set, a `lib/nomenclature.ts` module, and three test files (topology updated + nomenclature skip-guarded + preservation green).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/50-workbench-nomenclature/50-CONTEXT.md
@.planning/phases/50-workbench-nomenclature/50-RESEARCH.md
@.planning/phases/50-workbench-nomenclature/50-VALIDATION.md
@docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md
@apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts
@apps/dispatch-control/__tests__/pipelineTopology.test.ts
@apps/dispatch-control/app/(dashboard)/prompt-lab/_components/agentList.ts
@packages/pipeline/src/eisenbalm_pipeline/graph/builder.py

<interfaces>
<!-- Authoritative live graph — packages/pipeline/.../graph/builder.py, 20 nodes in build order.
     The two new nodes relative to the stale frontend topology are signal_editor + verify_candidates. -->
Build order (20 nodes):
  calibrator, signal_editor, scout, verify_candidates, advocate, editor_gate_1,
  chronicler, researcher, verify_research,
  origin_story, problem, founder_bio, case_study, game, bonus, design,   (7-way fan-out from verify_research)
  validate_sections, qa, editor_final, publisher

New edges to add (from builder.py add_edge/add_conditional_edges reads):
  calibrator → signal_editor      (agent-mode branch of route_by_entry_mode; render as a normal edge)
  signal_editor → scout
  scout → verify_candidates
  verify_candidates → advocate     (agent-mode branch of route_by_entry_mode; render as a normal edge)
  (all other edges unchanged: advocate→editor_gate_1→chronicler→researcher→verify_research→[7 writers]→validate_sections→qa→editor_final→publisher)

Existing AgentNode diamond render (do NOT change the visual system):
  data-testid = nodeData.isGate ? 'agent-node-diamond' : 'agent-node-dot'
  className   = isGate ? 'rotate-45 bg-marigold' : 'rounded-full bg-neutral-900'
  → isGate is set by PipelineGraph from GATE_KEYS.has(agentKey). Reuse as-is.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Reconcile pipelineTopology.ts to the live 20 nodes + 3-diamond set + its test</name>
  <files>apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts, apps/dispatch-control/__tests__/pipelineTopology.test.ts, apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VariableRegistry.ts</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts (the stale file being fixed)
    - apps/dispatch-control/__tests__/pipelineTopology.test.ts (the test pinning the stale 18)
    - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py (authoritative node + edge list)
    - .planning/phases/50-RESEARCH.md §"Pitfall 2" and §"Code Examples" (the 20-node list + stale-topology diff)
  </read_first>
  <action>
    Edit `pipelineTopology.ts`:
    1. Add `'signal_editor'` (after `'calibrator'`) and `'verify_candidates'` (after `'scout'`) to `PIPELINE_NODES` so it has exactly 20 entries in build order. Do NOT reorder existing keys or remove `design`/`validate_sections`.
    2. Add the four new edges to `PIPELINE_EDGES` and remove the now-obsolete direct `['calibrator','scout']` and `['scout','advocate']` edges, replacing them with:
       `['calibrator','signal_editor']`, `['signal_editor','scout']`, `['scout','verify_candidates']`, `['verify_candidates','advocate']`.
       Leave the 7-way fan-out from `verify_research` and fan-in to `validate_sections` and the post-fan-in spine unchanged.
    3. Reconcile the diamond set to §7 (DERIVED-STATE §7 marks ◆ on Verify organizations, Verify research, Prepare publication). Set:
       `export const GATE_KEYS: Set<string> = new Set<string>(['verify_candidates','verify_research','publisher'])`
       DROP `'validate_sections'` from the set (§7 does not name it as a step; it folds into "Draft sections"). This is the single diamond source of truth (Discretion D-08, resolved per RESEARCH Open Q #2/#3: follow §7 verbatim).
    4. Update the file header comment: it now mirrors builder.py's 20 nodes; note `signal_editor`/`verify_candidates` were added in this phase and that GATE_KEYS = {verify_candidates, verify_research, publisher}. Replace the stale "Only two nodes are wrapped as code gates / Do NOT add a third gate" comment with the reconciled reality.
    Then update `pipelineTopology.test.ts`:
    - Change `expect(PIPELINE_NODES).toHaveLength(18)` → `toHaveLength(20)` and its describe text.
    - Add assertions: `PIPELINE_NODES` contains `'signal_editor'` and `'verify_candidates'`; edges `['calibrator','signal_editor']`, `['signal_editor','scout']`, `['scout','verify_candidates']`, `['verify_candidates','advocate']` are present; `GATE_KEYS` deep-equals `new Set(['verify_candidates','verify_research','publisher'])` (size 3); `GATE_KEYS` does NOT contain `'validate_sections'`.
    Keep the existing fan-out/fan-in 7-edge assertions green (writers unchanged).
    Also add `'signal_editor'` to `VariableRegistry.ts` (Pitfall 6): give it the template-variable list its prompt uses (read `packages/pipeline/.../agents/signal_editor` or config_loader to confirm tokens; if uncertain use `[]` — an empty declared-variable list is valid). This makes `signal_editor` selectable in Agent Instructions so Run Details' "Improve this agent →" for step 1 resolves instead of dead-ending. Verify `/prompt-lab/signal_editor` route resolves (renders the editor or the honest "no starting version" state) rather than 404/crash; add a guard only if it crashes on a key with no Convex rows.
  </action>
  <acceptance_criteria>
    - `grep -c "signal_editor\|verify_candidates" apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts` returns ≥ 2 (both keys present; was 0 before).
    - `pnpm --filter dispatch-control test -- --run pipelineTopology` passes with the 20-node + 3-diamond assertions (GATE_KEYS size 3, contains publisher, excludes validate_sections).
    - `grep -n "signal_editor" apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VariableRegistry.ts` shows the added key.
    - The four new edges and no lingering `['calibrator','scout']`/`['scout','advocate']` pairs (grep confirms replacement).
  </acceptance_criteria>
  <verify><automated>pnpm --filter dispatch-control test -- --run pipelineTopology</automated></verify>
  <done>pipelineTopology.ts matches builder.py's 20 nodes; GATE_KEYS = {verify_candidates, verify_research, publisher}; its test asserts 20 nodes and the 3-diamond set; signal_editor is registered in VariableRegistry and its prompt route resolves.</done>
</task>

<task type="auto">
  <name>Task 2: Build the shared nomenclature module (RUN_STEP_MAP + renamed-term constants)</name>
  <files>apps/dispatch-control/lib/nomenclature.ts</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/agentList.ts (the GROUP_LABELS/AGENT_DISPLAY_NAMES/displayNameForAgentKey precedent to mirror)
    - docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md §7 (the 11 verbatim action-named steps)
    - docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md §"Workbench nomenclature" table (Old→product verbatim mapping)
    - .planning/phases/50-RESEARCH.md §"Architecture Patterns" (the recommended RunStep interface) and §"Pitfall 4/5" (writers collapse; calibrator/chronicler/validate_sections have no §7 name)
  </read_first>
  <action>
    Create `apps/dispatch-control/lib/nomenclature.ts` as the D-06 single source of truth. Export:

    (a) `WORKBENCH_NAV_LABELS` — the renamed System Workbench nav labels + page headings (verbatim from the nomenclature table / §Nav):
      `{ run_monitor: 'Run Details', prompt_lab: 'Agent Instructions', eval_center: 'Quality Tests', registry: 'Editorial Memory' }`

    (b) `RUN_STEP_MAP: Record<string, { actionLabel: string; agentLabel: string; isDeterministicCheck: boolean; named: boolean }>` — action is PRIMARY, agent SECONDARY. Use §7's EXACT strings (do not paraphrase). `named:true` = one of the 11 §7 steps; `named:false` = supporting node rendered with a plain humanized fallback, never claiming a §7 verbatim name (Pitfall 5). Entries:
      calibrator:        { actionLabel: 'Calibrator',              agentLabel: 'Calibrator',           isDeterministicCheck: false, named: false }
      signal_editor:     { actionLabel: 'Find story leads',        agentLabel: 'Signal Editor',        isDeterministicCheck: false, named: true  }
      scout:             { actionLabel: 'Find organizations',      agentLabel: 'Scout',                isDeterministicCheck: false, named: true  }
      verify_candidates: { actionLabel: 'Verify organizations',    agentLabel: 'deterministic check',  isDeterministicCheck: true,  named: true  }
      advocate:          { actionLabel: 'Make the case',           agentLabel: 'Advocate',             isDeterministicCheck: false, named: true  }
      editor_gate_1:     { actionLabel: 'Choose recommended story',agentLabel: 'Agent Editor',         isDeterministicCheck: false, named: true  }
      chronicler:        { actionLabel: 'Chronicler',              agentLabel: 'Chronicler',           isDeterministicCheck: false, named: false }
      researcher:        { actionLabel: 'Research the issue',      agentLabel: 'Researcher',           isDeterministicCheck: false, named: true  }
      verify_research:   { actionLabel: 'Verify research',         agentLabel: 'deterministic check',  isDeterministicCheck: true,  named: true  }
      origin_story / problem / founder_bio / case_study / game / bonus / design (all seven):
                         { actionLabel: 'Draft sections',          agentLabel: 'seven writing agents', isDeterministicCheck: false, named: true  }
      validate_sections: { actionLabel: 'Draft sections',          agentLabel: 'section validation',   isDeterministicCheck: false, named: false }  // folds into "Draft sections", NOT a separate step, NOT a diamond
      qa:                { actionLabel: 'Check the draft',         agentLabel: 'QA',                   isDeterministicCheck: false, named: true  }
      editor_final:      { actionLabel: 'Recommend publication',   agentLabel: 'Agent Editor Final',   isDeterministicCheck: false, named: true  }
      publisher:         { actionLabel: 'Prepare publication',     agentLabel: 'Publisher',            isDeterministicCheck: true,  named: true  }

    (c) A resolver `runStepFor(agentKey: string): { actionLabel; agentLabel; isDeterministicCheck; named }` with a deterministic humanized fallback (Title-Case the key, mirroring agentList's `humanizeAgentKey`) for any key not in the map — nothing renders blank.

    (d) `isDeterministicCheck` MUST agree with topology `GATE_KEYS`. Import `GATE_KEYS` from `../app/(dashboard)/run-monitor/graph/_components/pipelineTopology` and add a module-level type-safe check OR export a helper the test uses; do NOT define a second diamond set literal — GATE_KEYS is the single source.

    (e) Renamed-term constants for reuse by later sweep plans (so copy references one place): export `PRODUCT_TERMS = { deterministicCheck: 'deterministic check', restartStep: 'Restart from this step', makeActive: 'Make active', restoreVersion: 'Restore version', qualityTest: 'Quality test', testChanges: 'Test changes', standardTestCase: 'Standard test case', previewNextRun: 'Preview next run', doNotUse: 'Do not use', mustFix: 'Must fix', humanApprovalRequired: 'Human approval required' }`.

    Do NOT wire this module into any screen in this plan — Wave 1 plans consume it.
  </action>
  <acceptance_criteria>
    - `apps/dispatch-control/lib/nomenclature.ts` exports `RUN_STEP_MAP`, `WORKBENCH_NAV_LABELS`, `PRODUCT_TERMS`, and `runStepFor`.
    - `grep -n "Find story leads\|Verify organizations\|Draft sections\|Prepare publication" apps/dispatch-control/lib/nomenclature.ts` shows the verbatim §7 labels.
    - The module imports `GATE_KEYS` from pipelineTopology (single diamond source): `grep -n "GATE_KEYS" apps/dispatch-control/lib/nomenclature.ts` shows the import.
    - `pnpm --filter dispatch-control build` type-checks the new module (no TS errors from it).
  </acceptance_criteria>
  <verify><automated>pnpm --filter dispatch-control build</automated></verify>
  <done>lib/nomenclature.ts exists with the verbatim §7 RUN_STEP_MAP, renamed nav/term constants, a humanized fallback resolver, and a single diamond source shared with topology.</done>
</task>

<task type="auto">
  <name>Task 3: Author the nomenclature + preservation tripwire scaffolds</name>
  <files>apps/dispatch-control/__tests__/nomenclature.test.ts, apps/dispatch-control/__tests__/rename-preservation.test.ts</files>
  <read_first>
    - apps/dispatch-control/__tests__/roleGateInventory.test.ts (the recursive-fs regex-scan precedent — clone its shape)
    - apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts (the FORBIDDEN_* array + violation-collector pattern)
    - .planning/phases/50-RESEARCH.md §"Validation Architecture" (the recommended sweep design + allowlist decisions) and §"Pitfall 3" (the 260710-k8y conflict terms)
    - .planning/phases/50-VALIDATION.md §"Wave 0 Requirements"
  </read_first>
  <action>
    Create TWO test files modeled on `roleGateInventory.test.ts` (recursive-fs scan of `apps/dispatch-control/app/` + `components/`, excluding `__tests__/`, `.next/`, `node_modules/`).

    File 1 — `apps/dispatch-control/__tests__/nomenclature.test.ts` (the WBN-05 banned-term tripwire). SKIP-GUARD the whole suite for now (`describe.skip('nomenclature sweep', …)` with a `// TODO(50-06): un-skip after the sweep lands` comment — mirrors Phase 48's skip-guarded scaffolds), because operator copy is not yet swept and the suite would be RED across Waves 1-2. Author it fully so 50-06 only flips `.skip`→`describe`:
      - `FORBIDDEN_COPY_TERMS`: an array of `{ pattern: RegExp, product: string }` covering BOTH the spec's "old" column AND the already-live 260710-k8y conflict terms. At minimum:
        /\bGate\s*1\b/i → "Choose recommended story / deterministic check"
        /\bcode gate\b/i, /\bgate\b(?!\w)/i in prose → "deterministic check"
        /\bre-?run from (this )?node\b/i → "Restart from this step"
        /\bnode\b/i (JSX prose only) → "step"
        /\bshadow run\b/i → "Preview next run"
        /\bgolden[- ]?scenario\b/i → "Standard test case"
        /\bblocklist(ed)?\b/i → "Do not use"
        /\brun evals?\b/i, /\beval\b/i (prose) → "Test changes / Quality test"
        /\bcommit\b/i, /\brollback\b/i (prose) → "Make active / Restore version"
        /Rehearsal/ → "Test changes"          (260710-k8y)
        /Make live|Making live/ → "Make active" (260710-k8y)
        />LIVE</ or /\bLIVE badge\b/ → "active version" (260710-k8y)
        /Draft vs\.?\s*live/i → "Compare results" (260710-k8y)
        /\bAuto-publish ON\b/ → "Human approval required / Administration"
        /Coverage memory/i → "Recent coverage"            (nomenclature-table row: Coverage memory / registry record)
        /registry record/i → "Organization history"
        /\bnever seeded\b/i → "no starting version"        (nomenclature-table row: Seeded / never seeded)
        /\bseeded\b/i (JSX text / string-prop only) → "has a starting version / no starting version"
        /\bblocking\b/i (JSX text / string-prop only) → "Must fix"   (REQUIREMENTS WBN-05 "Must fix (not blocking)")
      - Scan ONLY rendered JSX text nodes + string literal props (`title=`, `aria-label=`, `placeholder=`, and visible children), NOT raw identifiers, per RESEARCH §Validation Architecture #1/#2.
      - `ALLOWLIST` for legitimate code identifiers so the scan never flags them: route path strings `/run-monitor` `/prompt-lab` `/eval-center` `/registry`; the Convex/API literal `'blocklisted'` and audit action `charity.blocklisted`; node-key identifiers `editor_gate_1` `verify_research` `verify_candidates` `validate_sections`; component/identifier names (`EvalDrawer`, `evalScores`, `eval_scores`, `EvalCenter*`); and — for the newly-added prose patterns — the React state identifiers `seeded`/`setSeeded`, seed-script identifiers, and any `blocking` used as a code identifier or CSS token. The scan targets rendered JSX text + string-literal props ONLY (never raw identifiers or comments), so `/\bseeded\b/i` and `/\bblocking\b/i` catch operator copy (e.g. `'never seeded'`, `aria-label="Coverage memory"`, `<h3>Blocking items</h3>`) but never the `seeded` state var or a `blocking` code comment. Collect violations into an array and assert it is empty with a readable message listing file:line + suggested product term.

    File 2 — `apps/dispatch-control/__tests__/rename-preservation.test.ts` (guards D-02/D-03; ACTIVE/green immediately — these must NEVER change):
      - Assert the four route folders still exist on disk: `app/(dashboard)/run-monitor`, `.../prompt-lab`, `.../eval-center`, `.../registry` (statSync directory exists).
      - Assert `convex/schema.ts` / `convex/charities.ts` still contain the literal `'blocklisted'` status value and that `RegistryTable.tsx`'s `setStatus` call passes `status: 'blocklisted'` (grep the source) — the label swap must NOT touch the stored value.
      - Assert the audit action string `charity.blocklisted` still appears in the charities Convex source (grep). If not present as a literal there today, assert the `setStatus` mutation still writes the unchanged status — keep this assertion tied to a real, currently-true source fact so it stays green.
  </action>
  <acceptance_criteria>
    - `apps/dispatch-control/__tests__/nomenclature.test.ts` exists, contains `FORBIDDEN_COPY_TERMS` including `Rehearsal`, `Make live`, `Draft vs. live`, `Coverage memory`, `never seeded`, and `blocking`, and is wrapped in `describe.skip` with the `TODO(50-06)` comment.
    - `apps/dispatch-control/__tests__/rename-preservation.test.ts` exists and PASSES now: `pnpm --filter dispatch-control test -- --run rename-preservation` is green.
    - `grep -n "describe.skip" apps/dispatch-control/__tests__/nomenclature.test.ts` confirms the scaffold is skip-guarded (does not fail CI this wave).
    - Full suite stays green: `pnpm --filter dispatch-control test -- --run` passes (skipped nomenclature suite reported as skipped, not failed).
  </acceptance_criteria>
  <verify><automated>pnpm --filter dispatch-control test -- --run rename-preservation</automated></verify>
  <done>The banned-term tripwire is authored + skip-guarded (ready for 50-06 to un-skip), and the route/enum preservation guard is green — proving no route/stored-value rename occurs.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- --run pipelineTopology rename-preservation` green.
- `pnpm --filter dispatch-control build` exits 0 (nomenclature module type-checks).
- Full suite: `pnpm --filter dispatch-control test -- --run` green (nomenclature suite skipped, not failed).
</verification>

<success_criteria>
- pipelineTopology.ts = the live 20 nodes; GATE_KEYS = {verify_candidates, verify_research, publisher}; its test asserts this.
- lib/nomenclature.ts is the shared source of truth (RUN_STEP_MAP verbatim §7 labels + renamed terms).
- Two tripwire scaffolds exist: banned-term (skip-guarded) + preservation (green).
- signal_editor is registered in VariableRegistry so its Agent Instructions deep-link resolves.
</success_criteria>

<output>
After completion, create `.planning/phases/50-workbench-nomenclature/50-00-SUMMARY.md`.
</output>
