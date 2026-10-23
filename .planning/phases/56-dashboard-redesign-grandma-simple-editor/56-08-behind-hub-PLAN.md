---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 08
type: execute
wave: 3
depends_on: [56-01, 56-02, 56-03]
files_modified:
  - apps/dispatch-control/app/admin/page.tsx
  - apps/dispatch-control/app/admin/_components/BehindHub.tsx
  - apps/dispatch-control/app/admin/_components/BehindHubView.tsx
  - apps/dispatch-control/__tests__/AdminHub.test.tsx
autonomous: true
requirements: [P56-A1, P56-A2, P56-A3, P56-B3]

must_haves:
  truths:
    - "/admin is 'Behind the scenes': slab with ghost 'Back to the issue', h1, this week's issue step by step (10 plain steps), and the seven dials"
    - "The cost line shows the real summed cost from per-step costs, never $0.00 while steps cost money (client bug 6)"
    - "'Check weekly' is a plain 15px tag, not a chip; no 'Admin' heading anywhere"
  artifacts:
    - path: "apps/dispatch-control/app/admin/_components/BehindHubView.tsx"
      provides: "Pure Behind view"
    - path: "apps/dispatch-control/app/admin/_components/BehindHub.tsx"
      provides: "Data wrapper (useCurrentRun + agentRuns.byRunId)"
      contains: "deriveRunCostUsd"
  key_links:
    - from: "BehindHub.tsx"
      to: "lib/editorState.ts"
      via: "deriveBehindSteps + formatCostLine"
      pattern: "deriveBehindSteps\\("
    - from: "BehindHubView.tsx"
      to: "lib/nav.ts"
      via: "ADMIN_ITEMS dials"
      pattern: "ADMIN_ITEMS"
---

<objective>
Rebuild `/admin` to the Behind artboard: slab, heading, step list for this week's issue, seven plain dials, real cost/time footer.

Purpose: Locked decision 4 (Behind the scenes replaces Admin); client bug 6 ($0.00).
Output: BehindHub (data) + BehindHubView (pure) + rewritten AdminHub.test.tsx.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UI-SPEC.md
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/canvas/Behind.dc.html
@apps/dispatch-control/app/admin/page.tsx
@apps/dispatch-control/lib/editorState.ts
@apps/dispatch-control/lib/nav.ts

<interfaces>
```typescript
useCurrentRun() // follows runs.latest: runId, issueNumber, derivationInputs.runStatus, runRow {startedAt, completedAt?}
api.agentRuns.byRunId({ runId }) -> agent_runs rows { agentKey, status, completedAt?, costUsd?, error? }
deriveRunCostUsd(rows) (lib/derivedState) ; deriveBehindSteps({ agentRuns, runStatus, fixCount }) ; formatCostLine({ costUsd, startedAt, completedAt, mode: 'finished' })
runStatusWord({ status }) ; COPY.behindSlab, COPY.backToIssue
ADMIN_ITEMS (56-02): Money, Charities (weekly), Past issues, step by step, What the writers are told, Quality tests, Schedule and limits, Settings
StepList({ steps, footer, label }), NextStepSlab (56-03)
```
fixCount for step 8: sum of `agentChanges` from deriveHomeSections is not available without the draft; use the count of `qaCorrections` rows for the run if the existing code base exposes `api.qaCorrections.byRunId` (it does: convex/qaCorrections.ts byRunId) — fixCount = rows.length; undefined while loading.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: BehindHubView (pure) + test</name>
  <files>apps/dispatch-control/app/admin/_components/BehindHubView.tsx, apps/dispatch-control/__tests__/AdminHub.test.tsx</files>
  <read_first>
    - 56-UI-SPEC.md § "8. Behind the scenes (/admin)" and § Responsive contract Behind bullet; Copywriting Behind row
    - canvas/Behind.dc.html (two-column layout, dial rows)
  </read_first>
  <behavior>
    - h1 'Behind the scenes' and the line 'How the machine made this week's issue, and the dials that control it. Nothing on this page is needed to publish.'
    - slab variants: default 'Nothing here needs you this week. The issue is waiting for you on the front page.'; latest Problem → 'This issue hit a problem and stopped. Nothing reached readers.'; latest Working → 'Nothing here needs you. The writers are working on this week's issue.' (ASSUMPTION A9); always ghost 'Back to the issue' → '/'; zero [data-primary]
    - left column: h2 "This week's issue, step by step" with 10 steps in order, footer 'This issue cost $0.58 to write and took 39 minutes.'
    - right column 'The dials': 7 links in ADMIN_ITEMS order, Money and Charities followed by plain text 'Check weekly'
    - no element with text 'Admin'; no chip classes (border + uppercase); no $0.00 when cost 0.58 given
    - layout classes `grid-cols-1 lg:grid-cols-[3fr_2fr]`
    - textContent never matches EDITOR_BANNED_PATTERN / RUN_ID_PATTERN
  </behavior>
  <action>
`BehindHubView.tsx` props: `{ slabSentence: string; issueLine: string | null; steps: StepVM[] | undefined; costLine: string | null; items: ReadonlyArray<AdminItem> }`. Markup: `NextStepSlab sentence={slabSentence} ghost={{ label: COPY.backToIssue, href: '/' }}`; header (`h1` Newsreader `text-[32px] sm:text-[42px] font-semibold`, Lora 17px intro); `div.grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-12`: left `<StepList label="This week's issue, step by step" steps={steps} footer={costLine} />` (issueLine 15px ink-soft above it when set; skeleton while steps undefined); right `h2` Newsreader 26/600 "The dials" + `ul` white, 1px line-strong, rows `Link` `min-h-[64px] px-6 py-4 hover:bg-[color:var(--color-wash)] editor-focus` with title 17px/600 and description 15px ink-soft; weekly items append `<span className="font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)]">Check weekly</span>` after the title. Rewrite `__tests__/AdminHub.test.tsx` to render BehindHubView with fixtures and cover the behavior list (keep a case asserting all 7 hrefs start with /admin/).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/AdminHub.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "font-mono|uppercase|tracking-|text-\[(9|10|11|12|13|14|16)px\]|>\s*Admin\s*<" apps/dispatch-control/app/admin/_components/BehindHubView.tsx` returns nothing
    - `grep -n "Check weekly" apps/dispatch-control/app/admin/_components/BehindHubView.tsx` matches
    - AdminHub.test.tsx passes
  </acceptance_criteria>
  <done>Behind view matches the artboard.</done>
</task>

<task type="auto">
  <name>Task 2: BehindHub data wrapper + page</name>
  <files>apps/dispatch-control/app/admin/_components/BehindHub.tsx, apps/dispatch-control/app/admin/page.tsx</files>
  <read_first>
    - apps/dispatch-control/lib/useCurrentRun.ts (fields used)
    - apps/dispatch-control/lib/derivedState.ts deriveRunCostUsd
    - apps/dispatch-control/app/admin/page.tsx (current; replaced)
  </read_first>
  <action>
`BehindHub.tsx` ('use client'): `cr = useCurrentRun()`; `agentRuns = useQuery(api.agentRuns.byRunId, cr.runId ? { runId: cr.runId } : 'skip')`; `corrections = useQuery(api.qaCorrections.byRunId, cr.runId ? { runId: cr.runId } : 'skip')`; `runStatus = cr.derivationInputs.runStatus`; `steps = deriveBehindSteps({ agentRuns, runStatus, fixCount: corrections?.length })`; `cost = deriveRunCostUsd(agentRuns)`; `costLine = formatCostLine({ costUsd: cost, startedAt: cr.runRow?.startedAt, completedAt: cr.runRow?.completedAt, mode: runStatus === 'cancelled' || runStatus === 'failed' ? 'stopped' : 'finished' })`; slab sentence: `runStatusWord({ status: runStatus ?? '' })` Problem → 'This issue hit a problem and stopped. Nothing reached readers.'; Working → 'Nothing here needs you. The writers are working on this week's issue.'; else COPY.behindSlab. issueLine = `formatIssueLine(...)` (title via cr.title). When `cr.state.kind === 'none'`, steps = [] and costLine null. Render `<BehindHubView ... items={ADMIN_ITEMS} />`.
`app/admin/page.tsx`: `export const dynamic = 'force-dynamic'`; `export const metadata = { title: 'Behind the scenes' }`; default export renders `<BehindHub />`. Read the qaCorrections.byRunId arg name from convex/qaCorrections.ts (it is `{ runId }` — confirm). No Convex edits.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/AdminHub.test.tsx __tests__/nav.test.ts && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "deriveRunCostUsd(\|deriveBehindSteps(\|formatCostLine(" apps/dispatch-control/app/admin/_components/BehindHub.tsx | wc -l` >= 3
    - `grep -n "runs.cost\|JSON.parse" apps/dispatch-control/app/admin/_components/BehindHub.tsx` returns nothing (cost never read from runs.cost)
    - `git diff --name-only -- convex/` is empty
    - strict build exits 0 (a build or suite failure caused only by a file owned by a sibling wave-3 plan is NOT this plan's failure — record it in the SUMMARY; the authoritative strict build + full suite is 56-12)
  </acceptance_criteria>
  <done>/admin is Behind the scenes, live, with real cost.</done>
</task>

</tasks>

<verification>
AdminHub + nav green; strict build green.
</verification>

<success_criteria>
Behind artboard live; bug 6 closed on the hub.
</success_criteria>

<output>
After completion, create `.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-08-SUMMARY.md` recording ASSUMPTION A9 (Working slab sentence).
</output>
