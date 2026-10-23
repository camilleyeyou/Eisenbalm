---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 11
type: execute
wave: 3
depends_on: [56-01, 56-02, 56-03]
files_modified:
  - apps/dispatch-control/app/admin/agents/page.tsx
  - apps/dispatch-control/app/admin/agents/[agentKey]/page.tsx
  - apps/dispatch-control/app/admin/agents/_components/AgentPromptEditorView.tsx
  - apps/dispatch-control/app/admin/agents/_components/PromptsListClient.tsx
  - apps/dispatch-control/app/admin/agents/_components/PromptEditor.tsx
  - apps/dispatch-control/app/admin/agents/_components/PromptSaveDialog.tsx
  - apps/dispatch-control/app/admin/agents/_components/TestRunPanel.tsx
  - apps/dispatch-control/app/admin/agents/_components/VersionHistoryPanel.tsx
  - apps/dispatch-control/app/admin/agents/_components/EvalDrawer.tsx
  - apps/dispatch-control/app/admin/agents/_components/DiffViewer.tsx
  - apps/dispatch-control/app/admin/agents/_components/AssembledPreview.tsx
  - apps/dispatch-control/app/admin/agents/_components/PromptMarkerExport.tsx
  - apps/dispatch-control/app/admin/agents/_components/VariableChips.tsx
  - apps/dispatch-control/__tests__/PromptEditor.test.tsx
  - apps/dispatch-control/__tests__/PromptSaveDialog.test.tsx
  - apps/dispatch-control/__tests__/EvalDrawer.test.tsx
  - apps/dispatch-control/__tests__/DiffViewer.test.tsx
  - apps/dispatch-control/__tests__/adminAgentsJargon.test.ts
autonomous: true
requirements: [P56-A2, P56-A3]

must_haves:
  truths:
    - "Both 'What the writers are told' pages open with the slab 'Nothing here is needed to publish this week's issue.' and ghost 'Back to behind the scenes'"
    - "Writers are shown by plain names (plainNameForKey), never agent keys, Calibrator or Chronicler; no Tokens in/out, Drift or Run text"
    - "'Improve this agent' is removed or wired (bug 9)"
  artifacts:
    - path: "apps/dispatch-control/__tests__/adminAgentsJargon.test.ts"
      provides: "Source-scan tripwire over the dial sub-pages"
      contains: "jargonInSource"
  key_links:
    - from: "each dial page.tsx"
      to: "components/editor/NextStepSlab.tsx"
      via: "slab at top"
      pattern: "<NextStepSlab"
---

<objective>
Jargon sweep over the "What the writers are told" dial (app/admin/agents/**). The other dial pages are plan 56-11b. Headings, labels, chips and dead buttons only — layouts are not redrawn.

Purpose: Success criterion 3 for every page reachable from the dials; client bug 9 and jargon list.
Output: relabelled pages, updated tests, tripwire scan.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UI-SPEC.md
@apps/dispatch-control/lib/nav.ts
@apps/dispatch-control/lib/editorState.ts
@apps/dispatch-control/__tests__/helpers/jargonScan.ts
@apps/dispatch-control/__tests__/screen-token-swap.test.ts

<interfaces>
```typescript
ADMIN_ITEMS labels (56-02): Money /admin/finance · Charities /admin/charities · What the writers are told /admin/agents · Quality tests /admin/tests · Schedule and limits /admin/automation · Settings /admin/settings
plainNameForKey(agentKey) ; COPY.subPageSlab ; COPY.backToBehind  (lib/editorState)
jargonInSource(path, allow?)  (__tests__/helpers/jargonScan.ts)
NextStepSlab (components/editor)
```
Constraint: charities/_components/RegistryTable.tsx must keep its typed-name Do-not-use confirm (publishNoTypedConfirm.test.ts asserts /typedName/) — it is NOT in this plan's files; do not touch it. lib/nomenclature.ts is NOT owned here (56-01 owns it; RUN_STEP_MAP must not change) — map agent keys to plain names at render time with plainNameForKey.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: "What the writers are told" (agents) relabel + dead buttons</name>
  <files>apps/dispatch-control/app/admin/agents/page.tsx, apps/dispatch-control/app/admin/agents/[agentKey]/page.tsx, apps/dispatch-control/app/admin/agents/_components/AgentPromptEditorView.tsx, apps/dispatch-control/app/admin/agents/_components/PromptsListClient.tsx, apps/dispatch-control/app/admin/agents/_components/PromptEditor.tsx, apps/dispatch-control/app/admin/agents/_components/PromptSaveDialog.tsx, apps/dispatch-control/app/admin/agents/_components/TestRunPanel.tsx, apps/dispatch-control/app/admin/agents/_components/VersionHistoryPanel.tsx, apps/dispatch-control/app/admin/agents/_components/EvalDrawer.tsx, apps/dispatch-control/app/admin/agents/_components/DiffViewer.tsx, apps/dispatch-control/app/admin/agents/_components/AssembledPreview.tsx, apps/dispatch-control/app/admin/agents/_components/PromptMarkerExport.tsx, apps/dispatch-control/app/admin/agents/_components/VariableChips.tsx, apps/dispatch-control/__tests__/PromptEditor.test.tsx, apps/dispatch-control/__tests__/PromptSaveDialog.test.tsx, apps/dispatch-control/__tests__/EvalDrawer.test.tsx, apps/dispatch-control/__tests__/DiffViewer.test.tsx</files>
  <read_first>
    - every listed agents file (grep first: `grep -nE "\b(Run|Agent|agent|Drift|Tokens|Calibrator|Chronicler|Re-roll|Improve this agent|Restart from this step)\b" apps/dispatch-control/app/admin/agents -r`)
    - the four listed tests
  </read_first>
  <action>
- Both pages render `<NextStepSlab sentence={COPY.subPageSlab} ghost={{ label: COPY.backToBehind, href: '/admin' }} />` first. List page h1 'What the writers are told', intro 'The instructions each writer follows. Earlier versions are kept, so any change can be undone.'. Detail page h1 = `plainNameForKey(agentKey)`.
- Everywhere an agent key or 'Agent' label is shown, render `plainNameForKey(key)`; 'Agent instructions' → 'Instructions'; 'Prompt' in headings → 'Instructions'; 'Test run' → 'Try it'; 'Tokens in/out' → 'Words read / Words written'; 'Drift' → 'Change in quality'; 'Run' → 'Try' or 'Issue' as context dictates.
- 'Improve this agent' (AgentPromptEditorView, PromptSaveDialog): if it has no working handler, delete the control; if wired, relabel 'Suggest better instructions'. Record which in SUMMARY.
- Remove `font-mono`/`uppercase`/`tracking-` from labels and chips (the instruction text editor itself may stay monospace — CodeMirror body is content, not UI label).
- Update the four tests' text expectations.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/PromptEditor.test.tsx __tests__/PromptSaveDialog.test.tsx __tests__/EvalDrawer.test.tsx __tests__/DiffViewer.test.tsx __tests__/promptDescriptions.test.ts __tests__/variableMaps.test.ts __tests__/VariableRegistry.test.ts __tests__/assembledPreview.test.ts __tests__/markerExport.test.ts __tests__/promptVersionOrigin.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rn "Improve this agent\|Agent instructions\|Calibrator\|Chronicler\|Tokens in\|Tokens out" apps/dispatch-control/app/admin/agents` returns nothing
    - `grep -c "<NextStepSlab" apps/dispatch-control/app/admin/agents/page.tsx "apps/dispatch-control/app/admin/agents/[agentKey]/page.tsx"` totals 2
    - listed tests pass
  </acceptance_criteria>
  <done>The writers' instructions pages speak plainly; no dead buttons.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Writers' instructions jargon tripwire</name>
  <files>apps/dispatch-control/__tests__/adminAgentsJargon.test.ts</files>
  <read_first>
    - apps/dispatch-control/__tests__/helpers/jargonScan.ts (56-01)
  </read_first>
  <behavior>
    - for every non-test file this plan owns, `jargonInSource(file)` returns []
  </behavior>
  <action>
Create `__tests__/adminAgentsJargon.test.ts` listing these files literally and asserting `expect(jargonInSource(f)).toEqual([])` for each:
      - apps/dispatch-control/app/admin/agents/page.tsx
      - apps/dispatch-control/app/admin/agents/[agentKey]/page.tsx
      - apps/dispatch-control/app/admin/agents/_components/AgentPromptEditorView.tsx
      - apps/dispatch-control/app/admin/agents/_components/PromptsListClient.tsx
      - apps/dispatch-control/app/admin/agents/_components/PromptEditor.tsx
      - apps/dispatch-control/app/admin/agents/_components/PromptSaveDialog.tsx
      - apps/dispatch-control/app/admin/agents/_components/TestRunPanel.tsx
      - apps/dispatch-control/app/admin/agents/_components/VersionHistoryPanel.tsx
      - apps/dispatch-control/app/admin/agents/_components/EvalDrawer.tsx
      - apps/dispatch-control/app/admin/agents/_components/DiffViewer.tsx
      - apps/dispatch-control/app/admin/agents/_components/AssembledPreview.tsx
      - apps/dispatch-control/app/admin/agents/_components/PromptMarkerExport.tsx
      - apps/dispatch-control/app/admin/agents/_components/VariableChips.tsx
Any `allow` entry must carry a comment saying why it is code text, not UI. Fix flagged UI strings in the owned files instead of allow-listing them.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/adminAgentsJargon.test.ts && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "jargonInSource" apps/dispatch-control/__tests__/adminAgentsJargon.test.ts` matches and the test passes
    - strict build exits 0 (a build or suite failure caused only by a file owned by a sibling wave-3 plan is NOT this plan's failure — record it in the SUMMARY; the authoritative strict build + full suite is 56-12)
  </acceptance_criteria>
  <done>A tripwire keeps jargon off these pages.</done>
</task>

</tasks>

<verification>
Listed tests + tripwire + strict build green.
</verification>

<success_criteria>
Every page reachable from the dials passes the grandma test at the label level; bug 9 closed for agents pages.
</success_criteria>

<output>
After completion, create `.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-11-SUMMARY.md` listing every relabel and every removed/wired button.
</output>
