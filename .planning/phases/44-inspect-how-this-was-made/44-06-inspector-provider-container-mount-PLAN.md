---
phase: 44-inspect-how-this-was-made
plan: 06
type: execute
wave: 4
depends_on: ["44-02", "44-03", "44-04", "44-05"]
files_modified:
  - apps/dispatch-control/components/inspector/InspectorProvider.tsx
  - apps/dispatch-control/components/inspector/InspectorContainer.tsx
  - apps/dispatch-control/app/(dashboard)/layout.tsx
  - apps/dispatch-control/__tests__/InspectorProvider.test.tsx
autonomous: true
requirements: [INS-01, INS-02, INS-03, INS-04, INS-05, INS-06]
must_haves:
  truths:
    - "A single inspector context exposes openInspector(key)/closeInspector via useInspector(); exactly ONE panel instance is mounted app-wide (at the (dashboard) root layout so it covers all six entry points including /my-tasks)."
    - "The container resolves the artifact key via the pure resolver, fetches agent_runs + agent_run_payloads + prompt_versions on-demand (non-subscribed, like AgentIOPanel), computes the missing-inputs diff (using inputKeys) and the divergence, assembles the InspectorArtifact, and feeds InspectorPanel."
    - "The bonus variant promptKey is finalized in the container by reading outputSnapshot.bonusType before deep-linking Instructions/footer; the editor_gate_1/editor_gate1 alias is applied via the resolver."
    - "Degraded artifact types (signal/org with no step) render structurally with 'not recorded in this run' states, never a crash."
  artifacts:
    - path: "apps/dispatch-control/components/inspector/InspectorProvider.tsx"
      provides: "InspectorProvider + useInspector() context (openInspector/closeInspector, one active key)"
      exports: ["InspectorProvider", "useInspector"]
    - path: "apps/dispatch-control/components/inspector/InspectorContainer.tsx"
      provides: "data-fetching container: resolver + Convex reads + diff + divergence -> InspectorArtifact -> InspectorPanel"
    - path: "apps/dispatch-control/app/(dashboard)/layout.tsx"
      provides: "the ONE mounted InspectorProvider + panel instance"
      contains: "InspectorProvider"
  key_links:
    - from: "components/inspector/InspectorContainer.tsx"
      to: "convex agentRuns.byRunId / agentRuns.payloadByRunIdAgentKey / promptVersions.getActive"
      via: "useQuery on-demand when a key is open"
      pattern: "payloadByRunIdAgentKey"
    - from: "app/(dashboard)/layout.tsx"
      to: "every entry point under (dashboard)"
      via: "InspectorProvider wraps the whole dashboard subtree; one panel instance"
      pattern: "InspectorProvider"
---

<objective>
Wire the panel to real data and mount exactly ONE instance app-wide (INS-01, D-06). Build the inspector context (`openInspector`/`closeInspector`, one active artifact key), the data-fetching container that turns an `InspectorArtifactKey` into a fully-assembled `InspectorArtifact` (resolver → Convex reads → missing-inputs diff → divergence), and mount the provider + panel at the `(dashboard)` root layout so all six entry points — including `/my-tasks`, which is NOT under the issue-workspace frame — call the same opener and see the same single panel.

This follows AgentIOPanel's on-demand (non-subscribed) read pattern (Phase 23 Pattern 4): payloads are queried when a key is open, not via a live subscription. It applies the resolver's namespace alias and finalizes the bonus variant from `outputSnapshot.bonusType`.

Purpose: One panel, one opener, real data — the phase's defining constraint ("the same inspector opens from everywhere").
Output: provider + container + mount + the filled InspectorProvider.test.tsx.
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
<!-- Convex reads the container projects over (existing) -->
api.agentRuns.byRunId({ runId })                       // agent_runs rows for the run
api.agentRuns.payloadByRunIdAgentKey({ runId, agentKey })  // { inputSnapshot?, outputSnapshot?, inputKeys? } — inputKeys added by 44-02
api.promptVersions.getActive({ agentKey, workspace_id }) // active prompt_versions row or null

<!-- Modules to compose (built in 44-03/44-04/44-05) -->
import { resolveInspectorStep, runKeyToPromptKey, parseArtifactKey } from '@/lib/inspectorArtifact'
import { computeMissingInputs } from '@/lib/inspector/missingInputsDiff'
import { computeOutputDivergence } from '@/lib/inspector/outputDivergence'
import { summarize } from '@/lib/inspector/summarize'
import { InspectorPanel } from '@/components/inspector/InspectorPanel'

<!-- Mount point: app/(dashboard)/layout.tsx wraps <main>{children}</main>; /issues/* AND /my-tasks both live under it. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build InspectorProvider (context) + fill InspectorProvider.test.tsx</name>
  <read_first>
    - docs/API_CONTRACTS.md §44.6 (openInspector(key: string | InspectorArtifactKey)/closeInspector, one instance)
    - apps/dispatch-control/lib/inspectorArtifact.ts (parseArtifactKey — for the string form carried on DerivedTask.insp)
    - apps/dispatch-control/__tests__/InspectorProvider.test.tsx (the it.todo scaffold)
    - An existing React context provider in the app for the house pattern (e.g. apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/_components/WorkspaceStateProvider.tsx)
  </read_first>
  <action>
    Create `apps/dispatch-control/components/inspector/InspectorProvider.tsx` (`'use client'`):
    - A React context holding `{ activeKey: InspectorArtifactKey | null; openInspector: (key: string | InspectorArtifactKey) => void; closeInspector: () => void }`.
    - `openInspector` accepts either a serialized string (via `parseArtifactKey`) or an `InspectorArtifactKey` object, and sets `activeKey`; `closeInspector` sets it null.
    - `export function useInspector()` throws a clear error if used outside the provider.
    - `InspectorProvider` renders `{children}` and, when `activeKey !== null`, renders exactly one `<InspectorContainer artifactKey={activeKey} onClose={closeInspector} />` (built in Task 2). It must render at most ONE container regardless of how many components call `openInspector`.
    Then fill `InspectorProvider.test.tsx`: convert the it.todos to live assertions — render a `<InspectorProvider>` with two child buttons that each call `openInspector` with different keys, assert only one panel/container node exists at a time, and that `closeInspector` removes it. (Stub `InspectorContainer` with a test double or mock the Convex hooks so the provider test stays a jsdom unit test.)
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm test -- __tests__/InspectorProvider.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `components/inspector/InspectorProvider.tsx` exports `InspectorProvider` and `useInspector`.
    - `useInspector()` outside the provider throws (asserted by a test).
    - The test proves exactly one container/panel node renders even when two entry points call `openInspector`.
    - `grep -c "it.todo" apps/dispatch-control/__tests__/InspectorProvider.test.tsx` returns 0; the test file passes.
  </acceptance_criteria>
  <done>The one-instance context with openInspector/closeInspector exists and is proven single-instance.</done>
</task>

<task type="auto">
  <name>Task 2: Build InspectorContainer (resolver + Convex reads -> InspectorArtifact -> panel)</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx (the on-demand useQuery(payloadByRunIdAgentKey) pattern to mirror; the metrics fields)
    - convex/agentRuns.ts (byRunId + payloadByRunIdAgentKey return shapes; payload now includes inputKeys after 44-02) and convex/promptVersions.ts (getActive)
    - apps/dispatch-control/lib/inspectorArtifact.ts, lib/inspector/missingInputsDiff.ts, lib/inspector/outputDivergence.ts, lib/inspector/summarize.ts, components/inspector/InspectorPanel.tsx (the pieces to compose)
    - docs/API_CONTRACTS.md §44.2/§44.3/§44.4 (artifact assembly + resolver + diff)
    - apps/dispatch-control/lib/workspace.ts (DEFAULT_WORKSPACE_ID for the promptVersions.getActive arg)
  </read_first>
  <action>
    Create `apps/dispatch-control/components/inspector/InspectorContainer.tsx` (`'use client'`) taking `{ artifactKey: InspectorArtifactKey; onClose: () => void }`:
    1. `const step = resolveInspectorStep(artifactKey)`.
    2. On-demand reads (non-subscribed pattern): `useQuery(api.agentRuns.byRunId, { runId })` (pick the row where `agentKey === step.agentKey`), `useQuery(api.agentRuns.payloadByRunIdAgentKey, { runId, agentKey: step.agentKey })`, and — only when `step.promptKey` is non-null — `useQuery(api.promptVersions.getActive, { agentKey: step.promptKey, workspace_id: DEFAULT_WORKSPACE_ID })`.
    3. Finalize the bonus variant: if `step.agentKey === 'bonus'`, parse `payload.outputSnapshot` for `bonusType` and recompute `promptKey = runKeyToPromptKey('bonus', bonusType)`; re-run getActive with that promptKey (or gate a second query). For all other agents use `step.promptKey`.
    4. `const missing = computeMissingInputs(step.agentKey, payload?.inputKeys, payload?.inputSnapshot)`.
    5. `const divergence = computeOutputDivergence({ completedAt: agentRun?.completedAt, /* changedSinceCheck / lastChangeAt from the section/claim signal when available, else omit -> 'unknown' */ })`. For founder/claim artifacts, source the changed-since signal from the same machinery Phases 42/43 use (read the relevant claim/section signal if trivially in scope; otherwise pass nothing → honest 'unknown', per D-11).
    6. `instructionsExternalized = step.promptKey !== null && promptVersion != null` — but distinguish "code-defined" (promptKey null → NOT externalized) from "not seeded yet" (promptKey non-null but getActive returned null). Pass `instructionsExternalized = step.promptKey !== null` to the panel; pass the active version row through so the panel can render "no active version yet" for the seeded-but-empty case.
    7. Assemble the `InspectorArtifact` (§44.2) from the rows using `summarize()` for human-readable fields: `title`/`meta` from agentKey + version + runId; `asked`/`result` from input/output summaries; `upstream`/`downstream` from PIPELINE_EDGES (reuse the AgentIOPanel filter logic); `inputs` = the supplied-keys summary; `output` = the human-readable outputSnapshot (truncation noted); `sources` from the payload/provenance where present; Diagnostics fields from the agentRun row with `model` left as "not recorded"; `json` = prettyJson of the payload.
    8. Render `<InspectorPanel artifact={artifact} agentKey={step.agentKey} promptKey={finalPromptKey} runId={runId} missing={missing} instructionsExternalized={step.promptKey !== null} divergence={divergence} onClose={onClose} />`.
    9. Degrade gracefully: if `step.degraded` or the agentRun/payload rows are absent, still render the panel with "not recorded in this run" fields (the panel already handles undefined artifact fields) — never throw.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm build</automated>
  </verify>
  <acceptance_criteria>
    - `components/inspector/InspectorContainer.tsx` imports `resolveInspectorStep`, `computeMissingInputs`, `computeOutputDivergence`, and `InspectorPanel` (`grep` shows all four imports).
    - It calls `api.agentRuns.payloadByRunIdAgentKey` and `api.promptVersions.getActive` via `useQuery` (`grep -q "payloadByRunIdAgentKey" && grep -q "getActive"`).
    - It passes `missing={` computed via `computeMissingInputs` and finalizes the bonus promptKey from `outputSnapshot.bonusType` (`grep -q "bonusType"`).
    - `pnpm --filter dispatch-control build` exits 0.
  </acceptance_criteria>
  <done>The container assembles a real InspectorArtifact from Convex + the pure modules and feeds InspectorPanel, degrading gracefully.</done>
</task>

<task type="auto">
  <name>Task 3: Mount the single InspectorProvider at the (dashboard) root layout</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/layout.tsx (the DashboardLayout that wraps Masthead + AppSidebar + <main>{children})
    - docs/API_CONTRACTS.md §44.6 (one instance, covering all six entry points incl. /my-tasks)
  </read_first>
  <action>
    In `apps/dispatch-control/app/(dashboard)/layout.tsx`, wrap the existing dashboard subtree in `<InspectorProvider>…</InspectorProvider>` so every route under `(dashboard)` (all five issue stages AND `/my-tasks`) shares one provider and one panel instance. Place the provider around the `<main>` content (or the whole `<div>` shell) — anywhere that keeps a single instance mounted across route changes. Do NOT add a second provider anywhere else. If the root layout is a Server Component and the provider is `'use client'`, wrapping children with the client provider is fine (children stay server-rendered); confirm the file already has no `'use client'` conflict.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm build && pnpm test</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "InspectorProvider" apps/dispatch-control/app/(dashboard)/layout.tsx` exits 0 and it is the only mount (`grep -rc "InspectorProvider" apps/dispatch-control/app | grep -v ':0'` shows exactly the layout + the provider definition file).
    - `pnpm --filter dispatch-control build` exits 0 and `pnpm --filter dispatch-control test` stays green.
  </acceptance_criteria>
  <done>Exactly one InspectorProvider/panel is mounted at the dashboard root, covering all six entry points.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test` (full suite) passes, incl. InspectorProvider.test.tsx.
- `pnpm --filter dispatch-control build` passes.
- Only one `InspectorProvider` mount exists in `app/`.
</verification>

<success_criteria>
- One context, one opener, one mounted panel at the dashboard root; the container assembles a real InspectorArtifact from existing Convex reads + the pure resolver/diff/divergence modules, applies the namespace alias and bonus-variant selection, and degrades gracefully — ready for the six entry points to call openInspector.
</success_criteria>

<output>
After completion, create `.planning/phases/44-inspect-how-this-was-made/44-06-SUMMARY.md`.
</output>
