---
phase: 44-inspect-how-this-was-made
plan: 05
type: execute
wave: 3
depends_on: ["44-01", "44-03", "44-04"]
files_modified:
  - apps/dispatch-control/lib/inspector/summarize.ts
  - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx
  - apps/dispatch-control/components/inspector/InspectorPanel.tsx
  - apps/dispatch-control/components/inspector/InspectorFooter.tsx
  - apps/dispatch-control/__tests__/InspectorPanel.test.tsx
autonomous: true
requirements: [INS-02, INS-04, INS-05, INS-06]
must_haves:
  truths:
    - "The panel renders seven tabs (Summary, Inputs, Instructions, Output, Sources, Diagnostics, Technical) with Summary as the default; Technical (raw JSON) is never any tab's default view."
    - "Every non-Technical tab leads with human-readable content; raw JSON sits behind a 'Show raw JSON' toggle (the AgentIOPanel pattern, now shared)."
    - "The Instructions tab renders an explicit 'not externalized — code-defined' state (not blank) for origin_story/problem/founder_bio/case_study/qa AND the shared rules referenced (VOICE_CONSTRAINTS + STRUCTURE_CONTRACT for the 4 writers; the fetched rubric for qa); when instructionsExternalized is true it renders the REAL active-version content + version number; Diagnostics renders 'model: not recorded' with a label+icon."
    - "The footer offers all six actions on every artifact type: live deep-links (Improve this agent / Compare versions / Related tests / Prior & downstream) using the promptKey namespace, and reserved-disabled controls (Ask agent to revise / Restart from this step) with explanatory titles."
    - "Every state uses label + icon, never color alone (D-14)."
  artifacts:
    - path: "apps/dispatch-control/lib/inspector/summarize.ts"
      provides: "shared summarize()/prettyJson() extracted from AgentIOPanel"
      exports: ["summarize", "prettyJson"]
    - path: "apps/dispatch-control/components/inspector/InspectorPanel.tsx"
      provides: "presentational 7-tab slide-over (takes a fully-assembled InspectorArtifact via props)"
      min_lines: 120
    - path: "apps/dispatch-control/components/inspector/InspectorFooter.tsx"
      provides: "the six footer actions (live deep-links vs reserved-disabled)"
  key_links:
    - from: "components/inspector/InspectorFooter.tsx"
      to: "/prompt-lab/${promptKey}"
      via: "Improve this agent / Compare versions deep-links using the aliased promptKey"
      pattern: "prompt-lab/"
    - from: "app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx"
      to: "lib/inspector/summarize.ts"
      via: "import (de-duplicated — no second summarizer)"
      pattern: "inspector/summarize"
    - from: "components/inspector/InspectorPanel.tsx"
      to: "artifact.sharedRules[]"
      via: "Instructions tab renders the shared rules referenced (§44.9) for non-externalized agents"
      pattern: "sharedRules"
---

<objective>
Build the presentational 7-tab inspector panel (INS-02) + its footer (INS-06), and extract the `summarize()`/`prettyJson()` helpers from `AgentIOPanel` into a shared module so the two never drift (RESEARCH "Don't Hand-Roll"). The panel is PURE PRESENTATION: it takes a fully-assembled `InspectorArtifact` (plus the resolved agentKey/promptKey and degradation flags) as props and renders tabs + footer — no Convex hooks. The data-fetching container that assembles the artifact and mounts one instance is 44-06; separating them keeps this component unit-testable in jsdom with mock artifacts (the InspectorPanel.test.tsx contract).

It mirrors `AgentIOPanel`'s established human-readable-first + raw-JSON-toggle + graceful-degradation patterns (CONTEXT D-06/D-07), generalized from one collapsed view to seven tabs, and honors the milestone honesty rules: raw JSON is a destination (the Technical tab), never a fallback; absence is stated in plain language; every state is label + icon, never color alone.

The Instructions tab is the phase's honesty crux (INS-04, RESEARCH Pitfall 2): for the 5 non-externalized agents (origin_story/problem/founder_bio/case_study/qa) it must render the SHARED RULES referenced alongside the "code-defined" state — never a bare one-liner; for the 11 externalized agents it must render the REAL active-version content + version — never a blank tab (the D-07/D-14 dishonest-blank state). Both come from the assembled `InspectorArtifact` (`sharedRules`, `instructionVersion`, `instructions`) per §44.9.

Purpose: The operator sees "how was this made, and if it's wrong, how do I fix it at the source?" — human-readable everywhere, the missing-inputs call-out on Inputs, the active version + shared rules on Instructions, the fix-at-source deep-links in the footer.
Output: `lib/inspector/summarize.ts`, `components/inspector/InspectorPanel.tsx`, `components/inspector/InspectorFooter.tsx`, and the filled InspectorPanel.test.tsx.
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
<!-- The props the container (44-06) will pass. The panel is pure-presentation. -->
interface InspectorArtifact { /* §44.2 — title, meta, asked, result, confidence, warning, upstream, downstream,
  inputs, missing, instructionVersion, instructions, sectionGuidance, sharedRules[] (§44.9), output, outputNote,
  sources[], model, timing, cost, latency, validation, json */ }
// sharedRules: { label: string; content?: string }[]  — the shared rules referenced (§44.9);
//   4 narrative writers → [{label:'VOICE_CONSTRAINTS'},{label:'STRUCTURE_CONTRACT'}]; qa → [{label:'rubric', content?}]
interface InspectorPanelProps {
  artifact: InspectorArtifact | undefined      // undefined = loading
  agentKey: string
  promptKey: string | null                     // null => reserved Improve/Compare
  runId: string
  missing: MissingInputsResult                  // from computeMissingInputs (44-04)
  instructionsExternalized: boolean             // false for origin_story/problem/founder_bio/case_study/qa
  divergence: 'diverged' | 'unchanged' | 'unknown'
  onClose: () => void
}

<!-- Extract from AgentIOPanel.tsx lines 50-80 verbatim (summarize/prettyJson). -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extract summarize()/prettyJson() to a shared module + repoint AgentIOPanel</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx lines 48-80 (the two helpers to extract verbatim)
    - .planning/phases/44-inspect-how-this-was-made/44-RESEARCH.md "Don't Hand-Roll" (extract, do not duplicate)
  </read_first>
  <action>
    1. Create `apps/dispatch-control/lib/inspector/summarize.ts` exporting `summarize(raw: string | undefined): string` and `prettyJson(raw: string | undefined): string`, copied VERBATIM from AgentIOPanel.tsx lines 50-80 (byte-identical behavior — Run Details relies on it).
    2. In `AgentIOPanel.tsx`, delete the two local function definitions and `import { summarize, prettyJson } from '@/lib/inspector/summarize'` instead. Do not change any call site or behavior.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm test -- __tests__ && pnpm build</automated>
  </verify>
  <acceptance_criteria>
    - `lib/inspector/summarize.ts` exports `summarize` and `prettyJson` (`grep -n "export function" apps/dispatch-control/lib/inspector/summarize.ts` shows both).
    - `AgentIOPanel.tsx` imports from `@/lib/inspector/summarize` and no longer defines `function summarize` locally (`grep -c "function summarize" apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx` returns 0).
    - `pnpm --filter dispatch-control build` exits 0 (AgentIOPanel still type-checks).
  </acceptance_criteria>
  <done>One shared summarizer; AgentIOPanel repointed; no behavior change.</done>
</task>

<task type="auto">
  <name>Task 2: Build the presentational 7-tab InspectorPanel (tabs)</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx (the slide-over structure, the metrics `dl`, the "Show raw JSON" toggle, the truncation notice, the graceful "no snapshot stored" degradation — mirror all of these)
    - docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md §8 (the tab-to-field mapping: Summary=asked/result/confidence/warning/upstream/downstream; Inputs=inputs+missing; Instructions=instructionVersion/instructions/sectionGuidance/sharedRules; Output=output/outputNote; Sources=sources[]; Diagnostics=model/timing/cost/latency/validation; Technical=json)
    - docs/API_CONTRACTS.md §44.9 (the `sharedRules` field + the `NON_EXTERNALIZED_SHARED_RULES` map — the shared rules the Instructions tab must render for the 5 non-externalized agents; the externalized `instructionVersion`/`instructions` fields the tab reads when instructionsExternalized === true)
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx (the 1c design-system tokens in use: `var(--color-ink)`, `var(--color-ink-soft)`, `var(--color-faint)`, `font-[family-name:var(--font-ui)]`, label+icon pattern with lucide-react icons — REUSE, do not invent styles)
    - docs/API_CONTRACTS.md §44.4 (Inputs tab must render the missing-inputs result incl. the truncation "approximate" note) and §44.8 (Diagnostics model = "not recorded")
  </read_first>
  <action>
    Create `apps/dispatch-control/components/inspector/InspectorPanel.tsx` — a `'use client'` presentational component with `InspectorPanelProps` (interfaces block). Structure it as a right-side slide-over mirroring AgentIOPanel's container/header/close-button, using the 1c design tokens from the issue-workspace layout. Implement a `const TABS = ['Summary','Inputs','Instructions','Output','Sources','Diagnostics','Technical'] as const` with `const [active, setActive] = useState<Tab>('Summary')` — Summary is the default; Technical is NEVER the initial value.

    Tab bar: seven buttons, `aria-current` on the active one, label + a lucide icon each (never color alone). Tab bodies:
    - **Summary**: `artifact.asked` / `artifact.result` as prose; `confidence`, `warning` (warning gets an AlertTriangle icon + label); `upstream` / `downstream` step names (plain text).
    - **Inputs**: render `props.missing` — the supplied keys list, then a clearly-headed "Missing expected inputs" block listing each `missing[].key` with its `gloss`; when `missing.approximate` is true, render `missing.note` with an icon+label "Approximate — snapshot was truncated" (never a silent definitive missing). Empty missing → "All expected state inputs were supplied" (label+icon, not blank).
    - **Instructions** (INS-04, §44.9 — the honesty crux, TWO branches):
      - if `props.instructionsExternalized === false` → render an explicit "This agent's instructions are code-defined, not editable here" state (icon + label, distinct from "no active version yet"), FOLLOWED BY a "Shared rules referenced" block that maps `artifact.sharedRules[]` — one row per entry, label + icon (D-14): for the 4 narrative writers the labels `VOICE_CONSTRAINTS` + `STRUCTURE_CONTRACT`; for `qa` the `rubric` row with `entry.content` rendered human-readable when present, label-only when absent. NEVER render the non-externalized Instructions tab as a bare one-liner — the shared rules are the substance here.
      - else (`instructionsExternalized === true`) → render `artifact.instructionVersion` + `artifact.instructions` (human-readable — the REAL active `prompt_versions` content the container mapped from `promptVersion.version`/`promptVersion.content`; never leave this blank when a version exists) + `sectionGuidance` + the "Shared rules referenced" block from `artifact.sharedRules` when non-empty + a note when the active version may differ from the producing version (D-10 — never imply the shown version produced the output when unverifiable).
    - **Output**: `artifact.output` (full human-readable, truncation noted as AgentIOPanel does) + a divergence line driven by `props.divergence`: `'diverged'` → "The issue text has changed since this output" (AlertTriangle); `'unchanged'` → "Unchanged since this run" (Check); `'unknown'` → "Unknown whether this still matches the issue" (HelpCircle) — never a false "current".
    - **Sources**: map `artifact.sources[]` (title/mark/passage/retrievedAt); empty → "No sources recorded for this step" (label+icon).
    - **Diagnostics**: a metrics `dl` like AgentIOPanel (cost/timing/latency/validation) + `model` rendered as "not recorded" (icon+label) since agent_runs has no model field.
    - **Technical**: `prettyJson(artifact.json)` in a `<pre>` — the ONLY place raw JSON leads, and only because the operator chose this tab. Include a copy button.
    - `artifact === undefined` → a loading state in the body; degraded artifact types (signal/org with no step) → each tab shows "not recorded in this run" per field, never a crash.

    Render `<InspectorFooter promptKey={promptKey} agentKey={agentKey} runId={runId} />` (built in Task 3) below the tab body.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm build</automated>
  </verify>
  <acceptance_criteria>
    - `components/inspector/InspectorPanel.tsx` exists, is `'use client'`, and defines `TABS` with all seven names in order (`grep -q "Summary" && grep -q "Technical"`).
    - The default tab state initializes to `'Summary'` (`grep -q "useState<.*>('Summary')\|useState('Summary')" apps/dispatch-control/components/inspector/InspectorPanel.tsx`).
    - The Instructions tab branch renders the "code-defined, not editable here" string when `instructionsExternalized === false` (`grep -q "code-defined" apps/dispatch-control/components/inspector/InspectorPanel.tsx`).
    - The Instructions non-externalized branch renders the shared rules, not just the one-liner: `grep -q "sharedRules" apps/dispatch-control/components/inspector/InspectorPanel.tsx` AND a "Shared rules" heading (`grep -q "Shared rules" apps/dispatch-control/components/inspector/InspectorPanel.tsx`).
    - The externalized branch renders the real active version content: `grep -q "instructionVersion" apps/dispatch-control/components/inspector/InspectorPanel.tsx && grep -q "instructions" apps/dispatch-control/components/inspector/InspectorPanel.tsx`.
    - Diagnostics renders "not recorded" for model (`grep -q "not recorded" apps/dispatch-control/components/inspector/InspectorPanel.tsx`).
    - `pnpm --filter dispatch-control build` exits 0.
  </acceptance_criteria>
  <done>The 7-tab presentational panel renders human-readable-first, Summary default, Technical never default, with the Instructions tab showing shared rules (non-externalized) or real active-version content (externalized), plus explicit degradation + label+icon states.</done>
</task>

<task type="auto">
  <name>Task 3: Build InspectorFooter (six actions, live vs reserved) + fill InspectorPanel.test.tsx</name>
  <read_first>
    - docs/API_CONTRACTS.md §44.7 (the exact six footer actions + their live targets + reserved titles + the promptKey-null case)
    - docs/API_CONTRACTS.md §44.9 (the `sharedRules` shape + `instructionVersion`/`instructions` fields — for building the mock artifacts the two new Instructions-tab tests render)
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptsListClient.tsx line ~193 (the deep-link shape `/prompt-lab/${encodeURIComponent(key)}` to reuse)
    - apps/dispatch-control/lib/inspectorArtifact.ts (runKeyToPromptKey — the footer receives promptKey already-aliased from the container/resolver)
    - apps/dispatch-control/__tests__/InspectorPanel.test.tsx (the it.todo scaffold to fill; use @testing-library/react — confirm it is the pattern other component tests use)
  </read_first>
  <action>
    1. Create `apps/dispatch-control/components/inspector/InspectorFooter.tsx` (`'use client'`) taking `{ promptKey: string | null; agentKey: string; runId: string }`. Render six controls, matching §44.7:
       - **Improve this agent →**: if `promptKey` → `<Link href={`/prompt-lab/${encodeURIComponent(promptKey)}`}>`; if null → disabled with title "This agent's instructions are code-defined, not editable here."
       - **Compare instruction versions**: same target/gating as Improve (version history lives on that page).
       - **Related quality tests**: `<Link href={`/eval-center${promptKey ? `?agent=${encodeURIComponent(promptKey)}` : ''}`}>` (executor: if eval-center ignores the query today, keep the bare `/eval-center` link and leave a code comment — still a live link).
       - **Prior & downstream steps**: `<Link href="/run-monitor/graph">` (the PIPELINE_EDGES surface; the inline upstream/downstream names already render on the Summary tab).
       - **Ask agent to revise**: `<button disabled title="Arrives in Phase 45 — the revision verb is offered here, not yet wired.">` (RESERVED, D-08).
       - **Restart from this step**: `<button disabled title="Completed steps are reused, not re-paid — general step restart is not yet wired (Gate-1 resume only).">` (RESERVED for ALL artifact types — the resume endpoint is Gate-1-specific, RESEARCH Pitfall 6).
       Each control is label + icon; disabled controls use the disabled-opacity pattern from MyTasksScreen's reserved button.
    2. Fill `InspectorPanel.test.tsx`: convert every it.todo to a live `@testing-library/react` assertion rendering `<InspectorPanel {...mockProps} />` with a hand-built mock `InspectorArtifact`. Assert:
       - default active tab is Summary (Technical tab present but not active);
       - Instructions shows "code-defined" when `instructionsExternalized=false`;
       - **(new, non-externalized shared-rules case)** for a non-externalized artifact (`instructionsExternalized=false`, `agentKey='founder_bio'`, `artifact.sharedRules=[{label:'VOICE_CONSTRAINTS'},{label:'STRUCTURE_CONTRACT'}]`), the Instructions tab renders BOTH the "code-defined" state AND the two shared-rule labels; and for `agentKey='qa'` with `artifact.sharedRules=[{label:'rubric', content:'…rubric text…'}]`, the `rubric` label AND its content render;
       - **(new, externalized real-content case)** for an externalized artifact (`instructionsExternalized=true`, `artifact.instructionVersion=4`, `artifact.instructions='REAL ACTIVE CONTENT'`), the Instructions tab renders the real content and version 4 — never a blank Instructions tab (the D-07/D-14 dishonest-blank state);
       - Diagnostics shows "not recorded";
       - "Restart from this step" and "Ask agent to revise" are disabled with their titles;
       - the live "Improve this agent" link for a Gate-1 artifact uses `/prompt-lab/editor_gate1` (promptKey namespace, NOT editor_gate_1).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm test -- __tests__/InspectorPanel.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `components/inspector/InspectorFooter.tsx` renders all six actions; `grep -q "Restart from this step" && grep -q "Ask agent to revise" && grep -q "Improve this agent"`.
    - The two reserved controls are `disabled` with a `title` attribute (`grep -q "disabled" && grep -q "not yet wired"`).
    - `grep -c "it.todo" apps/dispatch-control/__tests__/InspectorPanel.test.tsx` returns 0.
    - The test asserts the shared rules render for a non-externalized agent (`grep -q "VOICE_CONSTRAINTS" apps/dispatch-control/__tests__/InspectorPanel.test.tsx && grep -q "STRUCTURE_CONTRACT" apps/dispatch-control/__tests__/InspectorPanel.test.tsx`).
    - The test asserts real instruction content + version render when `instructionsExternalized === true` (`grep -q "REAL ACTIVE CONTENT" apps/dispatch-control/__tests__/InspectorPanel.test.tsx`).
    - The test asserts a Gate-1 artifact's Improve link resolves to `/prompt-lab/editor_gate1` (the alias), not `editor_gate_1`.
    - `pnpm --filter dispatch-control test -- __tests__/InspectorPanel.test.tsx` exits 0.
  </acceptance_criteria>
  <done>The footer offers all six actions with correct live-vs-reserved treatment; INS-02/INS-04/INS-06 panel tests pass, including the non-externalized shared-rules render and the externalized real-active-version render.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- __tests__/InspectorPanel.test.tsx` passes.
- `pnpm --filter dispatch-control test` (full suite) stays green (AgentIOPanel repoint did not regress run-monitor tests).
- `pnpm --filter dispatch-control build` passes.
</verification>

<success_criteria>
- A pure, tested 7-tab panel + footer that reads human-first everywhere, keeps Technical/raw-JSON off every default, renders the Instructions tab honestly (shared rules for the 5 non-externalized agents; real active-version content + version for the 11 externalized agents — never a bare one-liner or a blank tab), degrades explicitly (model-not-recorded, divergence-unknown), and offers all six footer actions with honest live-vs-reserved treatment — ready for the container to feed real data.
</success_criteria>

<output>
After completion, create `.planning/phases/44-inspect-how-this-was-made/44-05-SUMMARY.md`.
</output>
</content>
