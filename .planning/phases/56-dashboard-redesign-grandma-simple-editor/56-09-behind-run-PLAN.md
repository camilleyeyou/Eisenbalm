---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 09
type: execute
wave: 3
depends_on: [56-01, 56-02, 56-03]
files_modified:
  - apps/dispatch-control/app/admin/runs/[runId]/page.tsx
  - apps/dispatch-control/app/admin/runs/_components/BehindRun.tsx
  - apps/dispatch-control/app/admin/runs/_components/BehindRunView.tsx
  - apps/dispatch-control/lib/behindExplanations.ts
  - apps/dispatch-control/__tests__/BehindRun.test.tsx
autonomous: true
requirements: [P56-A1, P56-A2, P56-A3, P56-B1]

must_haves:
  truths:
    - "/admin/runs/[id] for a problem issue shows: slab 'This issue hit a problem and stopped. Nothing reached readers.' with ONE cobalt 'Start a new issue', breadcrumb 'Behind the scenes · Issue 42 · Thursday 17 September 2026', h1 'What happened to Issue 42', step list, 'In plain words' two paragraphs, and a closed 'Technical details' with the raw error"
    - "A paused (gate-interrupt) issue is never called Problem or Failed, and the Interrupt(...) text is never shown outside the collapsed technical details (client bug 8)"
    - "A stuck legacy issue offers 'Stop this issue' with a confirm (client bug 3)"
    - "Cost reads 'This attempt cost $0.21 before it stopped.' from per-step costs (bug 6)"
    - "The page links back to the issue it describes (client bug 2)"
  artifacts:
    - path: "apps/dispatch-control/app/admin/runs/_components/BehindRunView.tsx"
      provides: "Pure Behind-Run view"
    - path: "apps/dispatch-control/app/admin/runs/_components/BehindRun.tsx"
      provides: "Data wrapper"
    - path: "apps/dispatch-control/lib/behindExplanations.ts"
      provides: "Plain two-paragraph explanation per step key"
      exports: ["STEP_EXPLANATIONS"]
  key_links:
    - from: "app/admin/runs/[runId]/page.tsx"
      to: "BehindRun.tsx"
      via: "server page renders <BehindRun runId>"
      pattern: "<BehindRun"
    - from: "BehindRun.tsx"
      to: "lib/editorState.ts"
      via: "deriveBehindSteps + firstProblemStep"
      pattern: "firstProblemStep\\("
---

<objective>
Replace the Run Detail page with the Behind-Run artboard: plain-words explanation of what happened to one issue, its step list, and the right single action per run state. RunDetail/RecoveryRail/RerollButton stop being imported here (files are deleted in plan 56-12).

Purpose: Locked decision 7 (failed runs explained in plain words, technical details collapsed); client bugs 2, 3, 6, 8, 9.
Output: BehindRun + BehindRunView + behindExplanations + test; page.tsx swapped.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UI-SPEC.md
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/canvas/Behind-Run.dc.html
@apps/dispatch-control/app/admin/runs/[runId]/page.tsx
@apps/dispatch-control/app/admin/runs/_components/RunDetail.tsx
@apps/dispatch-control/lib/editorState.ts

<interfaces>
```typescript
api.runs.byRunId({ runId }) -> { runId, status, startedAt, completedAt? } | null
api.pipelineRuns.byRunId({ runId }) -> { issueNumber, errorMessage?, ... } | null
api.agentRuns.byRunId({ runId }) -> rows { agentKey, status, completedAt?, costUsd?, error? }
api.pitchLog.selectedByRunId({ runId }) -> { charityName } | null
api.issues.byIssueNumber({ workspace_id, issueNumber }) -> { publishedAt?, scheduledFor?, published }
triggerRun({}, token); cancelRun(runId, token)   // lib/pipelineControlClient
isGateInterrupt(row) // lib/gateInterrupt
deriveBehindSteps, firstProblemStep, PLAIN_STEPS, runStatusWord, formatCostLine, COPY, homeSlabCopy (for wording reuse) // lib/editorState
formatIssueLine // lib/issueTitle ; issueOpenHref // lib/issueRouteResolver
NextStepSlab, StepList // components/editor
useConfirm // components/ui/ConfirmDialog
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: STEP_EXPLANATIONS + BehindRunView (pure) + test</name>
  <files>apps/dispatch-control/lib/behindExplanations.ts, apps/dispatch-control/app/admin/runs/_components/BehindRunView.tsx, apps/dispatch-control/__tests__/BehindRun.test.tsx</files>
  <read_first>
    - 56-UI-SPEC.md § "9. Behind-Run" and § Responsive contract Behind bullet (pre scrolls inside its box)
    - canvas/Behind-Run.dc.html (copy its "In plain words" paragraphs for the research step verbatim as the template)
    - lib/editorState.ts PLAIN_STEPS keys
  </read_first>
  <behavior>
    - problem view: one [data-primary] 'Start a new issue'; breadcrumb first part 'Behind the scenes' links to /admin; h1 'What happened to Issue 42'; step 6 shows 'Problem', steps 7–10 'Not yet'; h2 'In plain words' with the two paragraphs for the failing step; `details` 'Technical details' closed by default containing a `pre` with the raw error
    - footer 'This attempt cost $0.21 before it stopped.'
    - paused (gate interrupt) view: no text 'Problem' or 'Failed' anywhere, step 4 'Waiting for you', `Interrupt(` appears only inside the `pre`
    - stuck view: [data-primary] 'Stop this issue'
    - stopped (cancelled) view: sentence 'This issue was stopped. Nothing reached readers.', primary 'Start a new issue', unfinished steps 'Stopped'
    - working view: zero [data-primary], 'Working' indicator
    - ready view: sentence 'Issue 42 is waiting for you on the front page.', ghost 'Back to the issue' linking to the issue's Home (/?run=<id> or /)
    - published view: sentence 'Issue 42 went out on Thursday.' ghost 'Back to the issue'
    - textContent outside `pre` never matches EDITOR_BANNED_PATTERN or RUN_ID_PATTERN
  </behavior>
  <action>
`lib/behindExplanations.ts`: `export const STEP_EXPLANATIONS: Record<string, { what: string; next: string }>` for all 10 PLAIN_STEPS keys, plain second-person-free sentences, e.g. `'verify-research': { what: 'This step checks every fact the research found against the website it came from. It stops the issue when it cannot confirm enough of the facts, so nothing untrue reaches readers.', next: 'This usually happens when a charity\'s own website is down or very thin. Starting a new issue picks a charity again and almost always goes through.' }` (take the research-step wording from canvas/Behind-Run.dc.html verbatim where it exists). Plus `export const GENERIC_EXPLANATION = { what: 'One of the steps could not finish, so the issue stopped before anything reached readers.', next: 'Starting a new issue begins again from the start and usually goes through.' }`. Every string must fail EDITOR_BANNED_PATTERN (add a test assertion looping over all values).
`BehindRunView.tsx` props: `{ mode: 'problem'|'paused'|'stuck'|'stopped'|'working'|'ready'|'published'; issueNumber: number | null; issueLine: string; issueHref: string; steps: StepVM[] | undefined; costLine: string | null; problemKey: string | null; rawError: string | null; onPrimary: () => void; primaryBusy: boolean; actionError: string | null }`. Slab per mode: problem → homeSlabCopy problem sentence/explanation + primary 'Start a new issue' (no 'What happened' link, we are on it); stopped → A3a stopped copy + 'Start a new issue'; stuck/paused → A3b stuck copy + primary 'Stop this issue'; working → 'Nothing for you to do yet. The writers are on it.' working; ready → `Issue {N} is waiting for you on the front page.` ghost COPY.backToIssue → issueHref; published → `Issue {N} went out on {Weekday}.` ghost. Breadcrumb `p` 15px: `Link href="/admin"` 'Behind the scenes' + ` · ${issueLine}`. `h1` `What happened to Issue {N}` (Newsreader 32/42). Grid `grid-cols-1 lg:grid-cols-[3fr_2fr] gap-12`: left `<StepList label="Step by step" steps footer={costLine} />`; right (only when problemKey or rawError): `h2` 'In plain words' + two Lora 17px paragraphs from STEP_EXPLANATIONS[problemKey] ?? GENERIC_EXPLANATION, then `details` `summary` 'Technical details' (17px/600, 48px) containing `pre` `overflow-x-auto bg-[rgba(23,20,14,0.04)] p-4 text-[14px] font-[monospace] whitespace-pre` with rawError. The `pre` is the ONLY monospace/14px usage. Paused mode: right column shows h2 'In plain words' with 'This older issue stopped to wait for a choice that is now made automatically. It can\'t continue.' / 'Stop it, then start a new issue.' and the Technical details with the raw text.
Tests in `__tests__/BehindRun.test.tsx` cover every behavior bullet.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/BehindRun.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - BehindRun.test.tsx asserts `Object.keys(STEP_EXPLANATIONS).length === 10` and that every key is a PLAIN_STEPS key: `grep -n "Object.keys(STEP_EXPLANATIONS)" apps/dispatch-control/__tests__/BehindRun.test.tsx` matches
    - `grep -nE "font-mono|uppercase|tracking-|Run Detail|RecoveryRail|Re-roll" apps/dispatch-control/app/admin/runs/_components/BehindRunView.tsx` returns nothing
    - BehindRun.test.tsx passes
  </acceptance_criteria>
  <done>Every run state has a plain-words Behind-Run view with one correct action.</done>
</task>

<task type="auto">
  <name>Task 2: BehindRun data wrapper + swap the server page</name>
  <files>apps/dispatch-control/app/admin/runs/_components/BehindRun.tsx, apps/dispatch-control/app/admin/runs/[runId]/page.tsx</files>
  <read_first>
    - current [runId]/page.tsx and RunDetail.tsx (queries used; how errorMessage and agent errors are read)
    - lib/gateInterrupt.ts, lib/homeSections.ts deriveHomeFooter (gate1 = awaiting-review without completedAt)
  </read_first>
  <action>
`BehindRun.tsx` ('use client') `{ runId }`: subscribe to runs.byRunId, pipelineRuns.byRunId, agentRuns.byRunId, pitchLog.selectedByRunId, runs.latest (to compute issueHref via `issueOpenHref(runId, latest?.runId)`), issues.byIssueNumber (when issueNumber known). Mode: run.status 'complete' or issue.published → published; 'cancelled' → stopped; 'running' → working; 'awaiting-review' && completedAt != null → ready; 'awaiting-review' && completedAt == null → stuck; 'failed' → if any agent row `isGateInterrupt(row)` (or pipelineRuns.errorMessage starts with 'Interrupt(') → paused, else problem. steps = deriveBehindSteps({ agentRuns, runStatus: run.status }); problemKey = firstProblemStep(steps); rawError = failing row error ?? pipelineRuns.errorMessage ?? null. costLine = formatCostLine({ costUsd: deriveRunCostUsd(agentRuns), startedAt: run.startedAt, completedAt: run.completedAt, mode: problem|stopped|paused|stuck → 'stopped' else 'finished' }). onPrimary: problem/stopped → latch + `triggerRun({}, token)` then `router.push('/')`, error COPY.startFailed; stuck/paused → confirm(COPY.stopConfirmTitle, body with issueLine, COPY.stopConfirm, COPY.stopCancel) → `cancelRun(runId, token)`, error "That didn't go through. Press the button again.". Loading → SkeletonLine; run null → 'We couldn't find this issue.' + ghost Back to behind the scenes.
`[runId]/page.tsx`: keep `force-dynamic` + async params; render `<BehindRun runId={runId} />` only (drop the 'Run Detail' h1 and the RunDetail import); `export const metadata = { title: 'What happened' }`.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/BehindRun.test.tsx __tests__/gateInterrupt.test.ts && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "RunDetail\|Run Detail" "apps/dispatch-control/app/admin/runs/[runId]/page.tsx"` returns nothing
    - `grep -n "isGateInterrupt\|deriveRunCostUsd(\|cancelRun(\|triggerRun(" apps/dispatch-control/app/admin/runs/_components/BehindRun.tsx | wc -l` >= 4
    - strict build exits 0
  </acceptance_criteria>
  <done>Behind-Run is live for every run; old Run Detail no longer reachable.</done>
</task>

</tasks>

<verification>
BehindRun + gateInterrupt tests green; strict build green.
</verification>

<success_criteria>
Behind-Run artboard live; bugs 2, 3, 6, 8 closed on this page.
</success_criteria>

<output>
After completion, create `.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-09-SUMMARY.md`
</output>
