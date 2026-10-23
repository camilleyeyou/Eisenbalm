---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 10b
type: execute
wave: 3
depends_on: [56-01, 56-02, 56-03]
files_modified:
  - apps/dispatch-control/app/admin/runs/graph/page.tsx
  - apps/dispatch-control/app/admin/runs/graph/_components/AgentIOPanel.tsx
  - apps/dispatch-control/app/admin/runs/graph/_components/AgentNode.tsx
  - apps/dispatch-control/app/admin/runs/graph/_components/DriftStrip.tsx
  - apps/dispatch-control/app/admin/runs/graph/_components/PipelineGraph.tsx
  - apps/dispatch-control/app/admin/runs/graph/_components/WriterExpansion.tsx
  - apps/dispatch-control/__tests__/AgentIOPanel.test.tsx
  - apps/dispatch-control/__tests__/AgentNode.test.tsx
  - apps/dispatch-control/__tests__/DriftStrip.test.tsx
  - apps/dispatch-control/__tests__/WriterExpansion.test.tsx
  - apps/dispatch-control/__tests__/adminGraphJargon.test.ts
autonomous: true
requirements: [P56-A2, P56-A3]

must_haves:
  truths:
    - "The map page is called 'How the steps connect' and shows plain writer/step names, never Pipeline Graph, DAG, Drift, Calibrator, Chronicler or Tokens in/out"
    - "Status chips on the map use the six status words"
  artifacts:
    - path: "apps/dispatch-control/__tests__/adminGraphJargon.test.ts"
      provides: "Source-scan tripwire over the map page files"
      contains: "jargonInSource"
  key_links:
    - from: "AgentNode.tsx"
      to: "lib/editorState.ts"
      via: "plainNameForKey for node titles"
      pattern: "plainNameForKey\("
---

<objective>
Jargon sweep over the map ("graph") page reachable from "Past issues, step by step". Split from 56-10 for scope; files are disjoint. Layouts are not redrawn (UI-SPEC § 8 last bullet); headings, labels, status chips and run ids are.

Purpose: Success criterion 3 on the map page; jargon list (Pipeline Graph, DAG, Drift, Re-roll, Calibrator, Chronicler, Tokens in/out).
Output: relabelled graph page + components, updated tests, a source-scan tripwire.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UI-SPEC.md
@.planning/ui-reviews/client-ux-feedback-261022.md
@apps/dispatch-control/lib/runLabels.ts
@apps/dispatch-control/lib/editorState.ts
@apps/dispatch-control/__tests__/helpers/jargonScan.ts

<interfaces>
```typescript
formatRunLabel({ issueNumber, charityName, startedAt }): string   // 'Issue 47 — Kumasi … · Oct 22'
splitStaleRuns(runs, now, days = 14): { recent; older }
runStatusWord({ status, interrupt? }): StatusWord ; plainNameForKey(agentKey): string ; COPY.subPageSlab, COPY.backToBehind
jargonInSource(path, allow?): string[]   // __tests__/helpers/jargonScan.ts
StatusWord component, NextStepSlab (components/editor)
adminRunHref(runId) → /admin/runs/<id> (Behind-Run, plan 56-09)
```
runControl.test.tsx currently covers STATUS_CLASSES (RunsTable), RunControlBar, BudgetAlertBanner, CancelRunButton and RerollButton. RerollButton is deleted by plan 56-12, which also removes its describe block — leave the RerollButton block untouched here.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Map page ('How the steps connect') relabel + tripwire scan</name>
  <files>apps/dispatch-control/app/admin/runs/graph/page.tsx, apps/dispatch-control/app/admin/runs/graph/_components/AgentIOPanel.tsx, apps/dispatch-control/app/admin/runs/graph/_components/AgentNode.tsx, apps/dispatch-control/app/admin/runs/graph/_components/DriftStrip.tsx, apps/dispatch-control/app/admin/runs/graph/_components/PipelineGraph.tsx, apps/dispatch-control/app/admin/runs/graph/_components/WriterExpansion.tsx, apps/dispatch-control/__tests__/AgentIOPanel.test.tsx, apps/dispatch-control/__tests__/AgentNode.test.tsx, apps/dispatch-control/__tests__/DriftStrip.test.tsx, apps/dispatch-control/__tests__/WriterExpansion.test.tsx, apps/dispatch-control/__tests__/adminGraphJargon.test.ts</files>
  <read_first>
    - each graph file and its test
    - __tests__/helpers/jargonScan.ts (56-01)
  </read_first>
  <behavior>
    - adminGraphJargon.test.ts: for every non-test file in this plan's files_modified (app/admin/runs/graph/**), `jargonInSource(file)` returns []
  </behavior>
  <action>
Relabel user-visible text only (component/file names stay): 'Pipeline Graph' / 'DAG' → h1 'How the steps connect'; node titles via `plainNameForKey(agentKey)` instead of raw keys or Calibrator/Chronicler; 'Drift' → 'Change in quality' (e.g. DriftStrip heading 'How the writing quality changed'); 'Tokens in' / 'Tokens out' → 'Words read' / 'Words written' (values unchanged); 'Re-roll' anywhere → 'Rewrite'; status chips → `<StatusWord word={runStatusWord({ status })} />`; 'Run' in headings → 'Issue'. Remove `font-mono`, `uppercase`, `tracking-` from visible labels (raw JSON payload viewers in AgentIOPanel may keep monospace inside a `pre` only). Update the four component tests' text expectations. Create `__tests__/adminGraphJargon.test.ts` using `jargonInSource` over the owned files (list them literally); any `allow` entry needs a comment naming why it is code, not UI text.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/adminGraphJargon.test.ts __tests__/AgentIOPanel.test.tsx __tests__/AgentNode.test.tsx __tests__/DriftStrip.test.tsx __tests__/WriterExpansion.test.tsx __tests__/pipelineTopology.test.ts && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rn ">\s*Pipeline Graph\|>\s*DAG\|Tokens in\|Tokens out\|Calibrator\|Chronicler" apps/dispatch-control/app/admin/runs/graph` returns nothing
    - adminGraphJargon.test.ts exists and passes
    - strict build exits 0 (a build or suite failure caused only by a file owned by a sibling wave-3 plan is NOT this plan's failure — record it in the SUMMARY; the authoritative strict build + full suite is 56-12)
  </acceptance_criteria>
  <done>No jargon is visible on the runs and map sub-pages; a tripwire keeps it that way.</done>
</task>

</tasks>

<verification>
Map-page tests + tripwire + strict build green.
</verification>

<success_criteria>
Jargon list removed from /admin/runs/graph.
</success_criteria>

<output>
After completion, create `.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-10b-SUMMARY.md` listing every relabel (old → new).
</output>
