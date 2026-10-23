---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 10
type: execute
wave: 3
depends_on: [56-01, 56-02, 56-03]
files_modified:
  - apps/dispatch-control/app/admin/runs/page.tsx
  - apps/dispatch-control/app/admin/runs/layout.tsx
  - apps/dispatch-control/app/admin/runs/loading.tsx
  - apps/dispatch-control/app/admin/runs/_components/RunsTable.tsx
  - apps/dispatch-control/app/admin/runs/_components/RunControlBar.tsx
  - apps/dispatch-control/app/admin/runs/_components/ReviewQueue.tsx
  - apps/dispatch-control/app/admin/runs/_components/CostRollup.tsx
  - apps/dispatch-control/app/admin/runs/_components/BudgetAlertBanner.tsx
  - apps/dispatch-control/app/admin/runs/_components/CancelRunButton.tsx
  - apps/dispatch-control/app/admin/runs/graph/page.tsx
  - apps/dispatch-control/app/admin/runs/graph/_components/AgentIOPanel.tsx
  - apps/dispatch-control/app/admin/runs/graph/_components/AgentNode.tsx
  - apps/dispatch-control/app/admin/runs/graph/_components/DriftStrip.tsx
  - apps/dispatch-control/app/admin/runs/graph/_components/PipelineGraph.tsx
  - apps/dispatch-control/app/admin/runs/graph/_components/WriterExpansion.tsx
  - apps/dispatch-control/__tests__/runControl.test.tsx
  - apps/dispatch-control/__tests__/AgentIOPanel.test.tsx
  - apps/dispatch-control/__tests__/AgentNode.test.tsx
  - apps/dispatch-control/__tests__/DriftStrip.test.tsx
  - apps/dispatch-control/__tests__/WriterExpansion.test.tsx
  - apps/dispatch-control/__tests__/adminRunsJargon.test.ts
autonomous: true
requirements: [P56-A2, P56-A3]

must_haves:
  truths:
    - "'Past issues, step by step' (/admin/runs) lists issues by name and date with the six status words, never run ids or 20 identical 'Awaiting review' cards (client bug 4)"
    - "Old unfinished issues are folded under a closed 'Older unfinished issues (N)' section"
    - "The start control reads 'Start a new issue' (not Trigger Run); the map page is named in plain words (no Pipeline Graph / DAG / Drift / tokens)"
    - "Each page starts with the slab 'Nothing here is needed to publish this week's issue.' and a ghost 'Back to behind the scenes'"
    - "Every element styled as a button does something (bug 9)"
  artifacts:
    - path: "apps/dispatch-control/__tests__/adminRunsJargon.test.ts"
      provides: "Source-scan tripwire over every file this plan owns"
      contains: "jargonInSource"
  key_links:
    - from: "RunsTable.tsx"
      to: "lib/runLabels.ts + lib/editorState.ts"
      via: "formatRunLabel + runStatusWord + splitStaleRuns"
      pattern: "formatRunLabel\\("
---

<objective>
Jargon and chrome sweep over the runs list and the map ("graph") sub-pages reachable from the "Past issues, step by step" dial. Layouts are not redrawn (UI-SPEC § 8 last bullet); headings, labels, status chips and run ids are.

Purpose: Success criterion 3 on every page reachable from the dials; client bugs 4 and 9; jargon list (Run, Trigger Run, Pipeline Graph, DAG, Drift, Re-roll, Calibrator, Chronicler, Tokens in/out).
Output: relabelled runs pages and components, updated tests, a source-scan tripwire.
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

<task type="auto">
  <name>Task 1: Runs list — names, six words, older fold, plain controls, slab</name>
  <files>apps/dispatch-control/app/admin/runs/page.tsx, apps/dispatch-control/app/admin/runs/layout.tsx, apps/dispatch-control/app/admin/runs/loading.tsx, apps/dispatch-control/app/admin/runs/_components/RunsTable.tsx, apps/dispatch-control/app/admin/runs/_components/RunControlBar.tsx, apps/dispatch-control/app/admin/runs/_components/ReviewQueue.tsx, apps/dispatch-control/app/admin/runs/_components/CostRollup.tsx, apps/dispatch-control/app/admin/runs/_components/BudgetAlertBanner.tsx, apps/dispatch-control/app/admin/runs/_components/CancelRunButton.tsx, apps/dispatch-control/__tests__/runControl.test.tsx</files>
  <read_first>
    - every file listed (current labels and chips)
    - __tests__/runControl.test.tsx
    - 56-UI-SPEC.md § "Status words", § Interaction rules, § "8. Behind the scenes" last bullet
  </read_first>
  <action>
- `runs/layout.tsx`: delete the mono-caps "Runs / Graph" tab strip; replace with a plain row of two 15px links: "Every issue" → /admin/runs and "How the steps connect" → /admin/runs/graph (ink-soft, current page ink + 600 + underline, `min-h-[48px]`). Above it render `<NextStepSlab sentence={COPY.subPageSlab} ghost={{ label: COPY.backToBehind, href: '/admin' }} />` (the layout is the one place both runs sub-pages share; [runId] is excluded: if the layout wraps `[runId]` too, check `useSelectedLayoutSegment()` and render nothing extra when the segment is a run id, so Behind-Run keeps its own slab — make this layout a small client component if needed).
- `runs/page.tsx`: h1 'Past issues, step by step' (Newsreader 32/42), intro Lora 17px 'How each issue was made. Open one to see every step.'.
- `RunsTable.tsx`: each row label = `formatRunLabel({ issueNumber, charityName, startedAt })` linking to `adminRunHref(runId)`; status = `<StatusWord word={runStatusWord({ status })} />` (replace STATUS_CLASSES chip rendering; keep the exported `STATUS_CLASSES` name only if runControl.test still imports it — rewrite it as a map from status to the six words, e.g. `STATUS_WORDS_FOR_RUN`, and update the test); split with `splitStaleRuns(rows, now)`: recent rows in the table, `older` inside a closed `details` 'Older unfinished issues ({n})'. Remove any run-id slice (`runId.slice(0, 8)` etc.) and 'Awaiting review'.
- `ReviewQueue.tsx`: header 'Ready for you to read'; each item shows formatRunLabel; the link reads 'Open the issue' → `issueOpenHref(runId, currentRunId)`(client bug 2); no ids.
- `RunControlBar.tsx`: 'Trigger Run' → 'Start a new issue'; any other jargon label → plain (e.g. 'Brief run' → 'Start an issue about a chosen charity').
- `CostRollup.tsx`: headings 'What the writing cost' / per-issue labels via formatRunLabel; never `$0.00` from `runs.cost` — use per-step costs (`api.agentRuns.costTotalsForRuns` exists, see convex/agentRuns.ts) if this component reads runs.cost today.
- `BudgetAlertBanner.tsx`, `CancelRunButton.tsx`: plain copy ('Stop this issue', confirm via COPY.stopConfirmTitle/stopConfirmBody); no 'run'.
- Strip `font-mono`, `uppercase`, `tracking-[…]` and text sizes below 15px from these files; keep their layout.
- Update `__tests__/runControl.test.tsx` expectations for the relabelled controls (leave the RerollButton describe block as is).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/runControl.test.tsx __tests__/runLabels.test.ts __tests__/costRollup.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rn "Trigger Run\|Awaiting review\|Run Detail\|slice(0, 8)\|slice(0,8)" apps/dispatch-control/app/admin/runs/page.tsx apps/dispatch-control/app/admin/runs/layout.tsx apps/dispatch-control/app/admin/runs/_components/RunsTable.tsx apps/dispatch-control/app/admin/runs/_components/RunControlBar.tsx apps/dispatch-control/app/admin/runs/_components/ReviewQueue.tsx` returns nothing
    - `grep -n "formatRunLabel(" apps/dispatch-control/app/admin/runs/_components/RunsTable.tsx` matches
    - `grep -nE "font-mono|uppercase|tracking-\[" apps/dispatch-control/app/admin/runs/layout.tsx apps/dispatch-control/app/admin/runs/_components/RunsTable.tsx` returns nothing
    - listed tests pass
  </acceptance_criteria>
  <done>Runs list reads in names, dates and the six words.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Map page ('How the steps connect') relabel + tripwire scan</name>
  <files>apps/dispatch-control/app/admin/runs/graph/page.tsx, apps/dispatch-control/app/admin/runs/graph/_components/AgentIOPanel.tsx, apps/dispatch-control/app/admin/runs/graph/_components/AgentNode.tsx, apps/dispatch-control/app/admin/runs/graph/_components/DriftStrip.tsx, apps/dispatch-control/app/admin/runs/graph/_components/PipelineGraph.tsx, apps/dispatch-control/app/admin/runs/graph/_components/WriterExpansion.tsx, apps/dispatch-control/__tests__/AgentIOPanel.test.tsx, apps/dispatch-control/__tests__/AgentNode.test.tsx, apps/dispatch-control/__tests__/DriftStrip.test.tsx, apps/dispatch-control/__tests__/WriterExpansion.test.tsx, apps/dispatch-control/__tests__/adminRunsJargon.test.ts</files>
  <read_first>
    - each graph file and its test
    - __tests__/helpers/jargonScan.ts (56-01)
  </read_first>
  <behavior>
    - adminRunsJargon.test.ts: for every file in this plan's files_modified under app/admin/runs (excluding [runId] and the files plan 56-12 deletes: RunDetail.tsx, RecoveryRail.tsx, RerollButton.tsx), `jargonInSource(file)` returns []
  </behavior>
  <action>
Relabel user-visible text only (component/file names stay): 'Pipeline Graph' / 'DAG' → h1 'How the steps connect'; node titles via `plainNameForKey(agentKey)` instead of raw keys or Calibrator/Chronicler; 'Drift' → 'Change in quality' (e.g. DriftStrip heading 'How the writing quality changed'); 'Tokens in' / 'Tokens out' → 'Words read' / 'Words written' (values unchanged); 'Re-roll' anywhere → 'Rewrite'; status chips → `<StatusWord word={runStatusWord({ status })} />`; 'Run' in headings → 'Issue'. Remove `font-mono`, `uppercase`, `tracking-` from visible labels (raw JSON payload viewers in AgentIOPanel may keep monospace inside a `pre` only). Update the four component tests' text expectations. Create `__tests__/adminRunsJargon.test.ts` using `jargonInSource` over the owned files (list them literally); any `allow` entry needs a comment naming why it is code, not UI text.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/adminRunsJargon.test.ts __tests__/AgentIOPanel.test.tsx __tests__/AgentNode.test.tsx __tests__/DriftStrip.test.tsx __tests__/WriterExpansion.test.tsx __tests__/pipelineTopology.test.ts && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rn ">\s*Pipeline Graph\|>\s*DAG\|Tokens in\|Tokens out\|Calibrator\|Chronicler" apps/dispatch-control/app/admin/runs/graph` returns nothing
    - adminRunsJargon.test.ts exists and passes
    - strict build exits 0
  </acceptance_criteria>
  <done>No jargon is visible on the runs and map sub-pages; a tripwire keeps it that way.</done>
</task>

</tasks>

<verification>
Runs-area tests + tripwire + strict build green.
</verification>

<success_criteria>
Client bug 4 closed; jargon list removed from /admin/runs and /admin/runs/graph.
</success_criteria>

<output>
After completion, create `.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-10-SUMMARY.md` listing every relabel (old → new).
</output>
