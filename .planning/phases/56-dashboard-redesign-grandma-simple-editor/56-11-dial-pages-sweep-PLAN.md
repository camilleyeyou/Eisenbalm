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
  - apps/dispatch-control/app/admin/tests/page.tsx
  - apps/dispatch-control/app/admin/tests/_components/DriftScoreboard.tsx
  - apps/dispatch-control/app/admin/tests/_components/ScenarioCard.tsx
  - apps/dispatch-control/app/admin/tests/_components/ShadowRunPanel.tsx
  - apps/dispatch-control/app/admin/automation/page.tsx
  - apps/dispatch-control/app/admin/automation/_components/AutomationPanel.tsx
  - apps/dispatch-control/app/admin/automation/_components/AutoPublishBanner.tsx
  - apps/dispatch-control/app/admin/automation/_components/AutoPublishToggle.tsx
  - apps/dispatch-control/app/admin/automation/_components/BudgetCapsPanel.tsx
  - apps/dispatch-control/app/admin/automation/_components/NextRunDisplay.tsx
  - apps/dispatch-control/app/admin/finance/page.tsx
  - apps/dispatch-control/app/admin/settings/page.tsx
  - apps/dispatch-control/app/admin/settings/_components/AuditLogViewer.tsx
  - apps/dispatch-control/app/admin/settings/_components/NotificationSettings.tsx
  - apps/dispatch-control/app/admin/charities/page.tsx
  - apps/dispatch-control/components/help/helpCopy.ts
  - apps/dispatch-control/__tests__/PromptEditor.test.tsx
  - apps/dispatch-control/__tests__/PromptSaveDialog.test.tsx
  - apps/dispatch-control/__tests__/EvalDrawer.test.tsx
  - apps/dispatch-control/__tests__/DiffViewer.test.tsx
  - apps/dispatch-control/__tests__/EvalCenter.test.tsx
  - apps/dispatch-control/__tests__/nextRunDisplay.test.tsx
  - apps/dispatch-control/__tests__/auditViewer.test.ts
  - apps/dispatch-control/__tests__/adminPagesJargon.test.ts
autonomous: true
requirements: [P56-A2, P56-A3]

must_haves:
  truths:
    - "Every dial sub-page (What the writers are told, Quality tests, Schedule and limits, Money, Settings, Charities) opens with the slab 'Nothing here is needed to publish this week's issue.' and ghost 'Back to behind the scenes'"
    - "Their h1 matches the dial label in lib/nav.ts"
    - "No visible Run, Trigger, Pipeline, Drift, Re-roll, Calibrator, Chronicler, Tokens, Agent text on those pages"
    - "Buttons that did nothing ('Improve this agent', 'Restart from this step') are removed or wired (bug 9)"
    - "screen-token-swap.test.ts stays green (no bg-white / text-white / neutral- in its 13 files)"
  artifacts:
    - path: "apps/dispatch-control/__tests__/adminPagesJargon.test.ts"
      provides: "Source-scan tripwire over the dial sub-pages"
      contains: "jargonInSource"
  key_links:
    - from: "each dial page.tsx"
      to: "components/editor/NextStepSlab.tsx"
      via: "slab at top"
      pattern: "<NextStepSlab"
---

<objective>
Jargon sweep over the remaining dial sub-pages: agents ("What the writers are told"), tests ("Quality tests"), automation ("Schedule and limits"), finance ("Money"), settings, charities, plus help copy. Headings, labels, chips and dead buttons only — layouts are not redrawn.

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

<task type="auto">
  <name>Task 2: Quality tests, Schedule and limits, Money, Settings, Charities, help copy</name>
  <files>apps/dispatch-control/app/admin/tests/page.tsx, apps/dispatch-control/app/admin/tests/_components/DriftScoreboard.tsx, apps/dispatch-control/app/admin/tests/_components/ScenarioCard.tsx, apps/dispatch-control/app/admin/tests/_components/ShadowRunPanel.tsx, apps/dispatch-control/app/admin/automation/page.tsx, apps/dispatch-control/app/admin/automation/_components/AutomationPanel.tsx, apps/dispatch-control/app/admin/automation/_components/AutoPublishBanner.tsx, apps/dispatch-control/app/admin/automation/_components/AutoPublishToggle.tsx, apps/dispatch-control/app/admin/automation/_components/BudgetCapsPanel.tsx, apps/dispatch-control/app/admin/automation/_components/NextRunDisplay.tsx, apps/dispatch-control/app/admin/finance/page.tsx, apps/dispatch-control/app/admin/settings/page.tsx, apps/dispatch-control/app/admin/settings/_components/AuditLogViewer.tsx, apps/dispatch-control/app/admin/settings/_components/NotificationSettings.tsx, apps/dispatch-control/app/admin/charities/page.tsx, apps/dispatch-control/components/help/helpCopy.ts, apps/dispatch-control/__tests__/EvalCenter.test.tsx, apps/dispatch-control/__tests__/nextRunDisplay.test.tsx, apps/dispatch-control/__tests__/auditViewer.test.ts</files>
  <read_first>
    - every listed file; __tests__/screen-token-swap.test.ts (13 files must keep a `[color:var(--color-` class and no bg-white/text-white/text-black/neutral-)
    - `grep -rnE "\b(Run|Runs|Trigger|Drift|Shadow run|Tokens|Agent|agent|Pipeline)\b" apps/dispatch-control/app/admin/tests apps/dispatch-control/app/admin/automation apps/dispatch-control/app/admin/settings apps/dispatch-control/components/help`
  </read_first>
  <action>
- Each of the five page.tsx files renders `<NextStepSlab sentence={COPY.subPageSlab} ghost={{ label: COPY.backToBehind, href: '/admin' }} />` first and its h1 becomes the dial label: 'Quality tests', 'Schedule and limits', 'Money', 'Settings', 'Charities'.
- tests: 'Drift' → 'Change in quality'; 'Shadow run' → 'Practice issue'; 'Run tests' → 'Check the writing now'.
- automation: 'Next run' → 'Next issue starts'; 'Per-run cap' → 'Most one issue may cost'; 'Auto-publish' → 'Publish by itself'.
- settings: AuditLogViewer column 'Agent'/'Run' → 'Who' / 'Issue'; show issue labels, not run ids.
- finance/charities pages: heading + slab only (their components are already plain; finance components not in this plan).
- helpCopy.ts: replace jargon words in help strings with the same swaps.
- Do not add `bg-white`, `text-white`, `text-black` or `neutral-` anywhere; use `bg-[color:var(--color-card)]`.
- Update the three tests' expectations.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/EvalCenter.test.tsx __tests__/nextRunDisplay.test.tsx __tests__/auditViewer.test.ts __tests__/screen-token-swap.test.ts __tests__/HelpTip.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "<NextStepSlab" apps/dispatch-control/app/admin/tests/page.tsx apps/dispatch-control/app/admin/automation/page.tsx apps/dispatch-control/app/admin/finance/page.tsx apps/dispatch-control/app/admin/settings/page.tsx apps/dispatch-control/app/admin/charities/page.tsx` totals 5
    - screen-token-swap.test.ts passes
    - listed tests pass
  </acceptance_criteria>
  <done>All remaining dial pages are plain-worded and carry the slab.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: adminPagesJargon tripwire</name>
  <files>apps/dispatch-control/__tests__/adminPagesJargon.test.ts</files>
  <read_first>
    - __tests__/helpers/jargonScan.ts
  </read_first>
  <behavior>
    - for every .tsx/.ts file in this plan's files_modified except tests, `jargonInSource(file)` returns []
  </behavior>
  <action>
Create the test listing the 29 non-test files literally (copy from frontmatter). Any `allow` entry must carry a comment explaining it is code text, not UI. Fix any remaining flagged UI string in the owned files rather than allow-listing it. Then run the strict build.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/adminPagesJargon.test.ts && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - adminPagesJargon.test.ts exists, contains `jargonInSource`, and passes
    - strict build exits 0
  </acceptance_criteria>
  <done>A tripwire keeps jargon off every dial sub-page.</done>
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
