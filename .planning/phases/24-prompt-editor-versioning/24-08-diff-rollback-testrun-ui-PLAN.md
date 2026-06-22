---
phase: 24-prompt-editor-versioning
plan: 08
type: execute
wave: 6
depends_on: [24-02, 24-06, 24-07]
files_modified:
  - apps/dispatch-control/app/(dashboard)/prompts/_components/DiffViewer.tsx
  - apps/dispatch-control/app/(dashboard)/prompts/_components/VersionHistoryPanel.tsx
  - apps/dispatch-control/app/(dashboard)/prompts/_components/TestRunPanel.tsx
  - apps/dispatch-control/app/(dashboard)/prompts/[agentKey]/page.tsx
  - apps/dispatch-control/lib/testRunClient.ts
autonomous: false
requirements: [PRM-04, PRM-05]
must_haves:
  truths:
    - "Operator can select any two versions and see a side-by-side diff"
    - "Operator can activate or rollback to any version in one click; the control is disabled with an explanation while a run is in progress"
    - "Operator can test-run the current unsaved draft against prior-real / manual / fixture input and see output + cost"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/prompts/_components/DiffViewer.tsx"
      provides: "Side-by-side two-column diff (diff v9)"
      contains: "diffLines"
    - path: "apps/dispatch-control/app/(dashboard)/prompts/_components/TestRunPanel.tsx"
      provides: "Test-run input modes + output/cost display"
      contains: "test-run"
  key_links:
    - from: "VersionHistoryPanel activate button"
      to: "convex promptVersions.activate"
      via: "useMutation; disabled while run running"
      pattern: "activate"
    - from: "TestRunPanel"
      to: "POST /agents/{key}/test-run"
      via: "testRunClient fetch with Clerk token"
      pattern: "test-run"
---

<objective>
Complete the prompt console: a side-by-side `DiffViewer` (diff v9 + custom two-column renderer),
one-click activate/rollback wired to `promptVersions.activate` with the in-progress-run guard surfaced
in the UI, and a `TestRunPanel` that POSTs the CURRENT unsaved editor draft (D-03) to
`POST /agents/{key}/test-run` across the four input modes (D-04) and shows output + cost.

Purpose: PRM-04 (diff + activate/rollback + in-progress block) and PRM-05 (single-agent test-run UI).
Output: DiffViewer + TestRunPanel + testRunClient + VersionHistoryPanel controls; Plan-01 DiffViewer
test GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/24-prompt-editor-versioning/24-CONTEXT.md
@.planning/phases/24-prompt-editor-versioning/24-RESEARCH.md
@docs/API_CONTRACTS.md
@apps/dispatch-control/app/(dashboard)/prompts/_components/VersionHistoryPanel.tsx
@apps/dispatch-control/app/(dashboard)/graph/_components/AgentIOPanel.tsx

<interfaces>
Convex (Plan 02): promptVersions.activate(workspace_id, agentKey, version, actorId) returns
  { blocked: true, reason } | { blocked: false }; listForAgent, getByVersion.
Backend (Plan 06): POST /agents/{key}/test-run, body { workspace_id, draft_prompt, draft_user_template?,
  variables, prior_run_id? } → { output, cost_usd, tokens_in, tokens_out, model, duration_ms }.
  Auth via Clerk bearer token (require_clerk_jwt). Pipeline base URL via NEXT_PUBLIC_PIPELINE_URL (confirm env name in dispatch-control).
diff v9: import { diffLines } from 'diff'. RESEARCH Pattern 4 = two parallel column arrays.
agent_run_payloads prior-real source query: agentRuns:payloadByRunIdAgentKey.
AgentIOPanel.tsx = the output-display pattern to reuse for the test-run result.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Side-by-side DiffViewer + version-compare wiring</name>
  <files>apps/dispatch-control/app/(dashboard)/prompts/_components/DiffViewer.tsx, apps/dispatch-control/app/(dashboard)/prompts/_components/VersionHistoryPanel.tsx</files>
  <read_first>
    - .planning/phases/24-prompt-editor-versioning/24-RESEARCH.md (Pattern 4 — two-column diff renderer code; diffLines usage)
    - apps/dispatch-control/__tests__/DiffViewer.test.tsx (the test to satisfy — column logic + data-side attributes)
    - apps/dispatch-control/app/(dashboard)/prompts/_components/VersionHistoryPanel.tsx (Plan 07 — add compare controls)
  </read_first>
  <action>
    DiffViewer.tsx ('use client'): props `left:{label,content}`, `right:{label,content}`. Use
    `diffLines(left.content, right.content)` and build two parallel column arrays per RESEARCH Pattern 4
    (removed→left+empty-right, added→empty-left+right, context→both). Render a `grid grid-cols-2` with each
    column carrying a `data-side="left"|"right"` attribute and per-line type styling
    (removed=red bg, added=green bg, context=neutral). Side-by-side is mandatory (success criterion).

    VersionHistoryPanel.tsx: add a two-version selector (pick "compare A" + "compare B" from listForAgent),
    and render <DiffViewer> for the chosen pair. Default A=active version, B=selected.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/DiffViewer.test.tsx 2>&1 | grep -Eq "passed|PASS" && echo DIFF_GREEN</automated>
  </verify>
  <acceptance_criteria>
    - `apps/dispatch-control/__tests__/DiffViewer.test.tsx` PASSES
    - `grep -q "diffLines" apps/dispatch-control/app/(dashboard)/prompts/_components/DiffViewer.tsx`
    - `grep -q "grid-cols-2" .../DiffViewer.tsx` and `grep -q "data-side" .../DiffViewer.tsx` (true two-column)
    - VersionHistoryPanel renders DiffViewer for a selected pair (`grep -q "DiffViewer" .../VersionHistoryPanel.tsx`)
  </acceptance_criteria>
  <done>Side-by-side diff renders for any two versions.</done>
</task>

<task type="auto">
  <name>Task 2: Activate / rollback controls with in-progress-run guard surfaced</name>
  <files>apps/dispatch-control/app/(dashboard)/prompts/_components/VersionHistoryPanel.tsx</files>
  <read_first>
    - .planning/phases/24-prompt-editor-versioning/24-RESEARCH.md (Pattern 3 activate return shape { blocked, reason }; Pitfall 2 TOCTOU acceptable)
    - convex/promptVersions.ts (activate signature — Plan 02)
    - convex/runs.ts (a query to detect a running run for the UI's disabled state — find the runs list/by-status query; if none exists, use listForAgent-independent runs query already in dashboard)
    - apps/dispatch-control/app/(dashboard)/runs/_components/RunsTable.tsx (how the dashboard already reads run status — reuse that query for the in-progress signal)
  </read_first>
  <action>
    In VersionHistoryPanel, add per-version "Activate" (and for non-latest, the same button reads
    "Rollback to this version" — rollback == activate(olderVersion), no separate call). The button:
    - Reads whether a run is in progress (reuse the dashboard's existing runs query; a run with
      status==='running' for the workspace). When in progress, the Activate/Rollback buttons are DISABLED
      and show the tooltip/inline text "A run is in progress — activation will be available when it finishes."
      (D-02 block-with-explanation, no queue).
    - On click (when enabled), calls `useMutation(api.promptVersions.activate)({ workspace_id:'eisenbalm',
      agentKey, version, actorId:<clerk id> })`. If the mutation still returns `{ blocked: true }` (server-side
      guard fired), surface `reason` inline (defensive — handles the TOCTOU race in Pitfall 2).
    - On `{ blocked: false }`, the active badge moves to the activated version (listForAgent re-subscribes).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx tsc --noEmit 2>&1 | tail -5; grep -q "activate" apps/dispatch-control/app/(dashboard)/prompts/_components/VersionHistoryPanel.tsx && grep -q "run is in progress\|in progress" apps/dispatch-control/app/(dashboard)/prompts/_components/VersionHistoryPanel.tsx && echo ROLLBACK_OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "api.promptVersions.activate\|promptVersions.activate" apps/dispatch-control/app/(dashboard)/prompts/_components/VersionHistoryPanel.tsx`
    - `grep -q "in progress" .../VersionHistoryPanel.tsx` (disabled-state explanation present)
    - `grep -q "blocked" .../VersionHistoryPanel.tsx` (handles server-side guard return)
    - `cd apps/dispatch-control && npx tsc --noEmit` clean for this file
  </acceptance_criteria>
  <done>One-click activate/rollback with run-in-progress block + explanation; defensive on server guard.</done>
</task>

<task type="auto">
  <name>Task 3: TestRunPanel — four input modes against the unsaved draft, output + cost</name>
  <files>apps/dispatch-control/lib/testRunClient.ts, apps/dispatch-control/app/(dashboard)/prompts/_components/TestRunPanel.tsx, apps/dispatch-control/app/(dashboard)/prompts/[agentKey]/page.tsx</files>
  <read_first>
    - docs/API_CONTRACTS.md §3A (test-run endpoint contract)
    - .planning/phases/24-prompt-editor-versioning/24-RESEARCH.md (Pattern 5 four input modes; D-03 unsaved draft is what's tested)
    - apps/dispatch-control/app/(dashboard)/graph/_components/AgentIOPanel.tsx (output-display pattern to reuse)
    - apps/dispatch-control (how Clerk token is obtained client-side — grep for useAuth/getToken; how pipeline base URL env is named, e.g. NEXT_PUBLIC_PIPELINE_URL)
  </read_first>
  <action>
    testRunClient.ts: `async function runAgentTest(agentKey, body, token)` that POSTs to
    `${pipelineBaseUrl}/agents/${agentKey}/test-run` with `Authorization: Bearer ${token}` and JSON body
    `{ workspace_id:'eisenbalm', draft_prompt, draft_user_template?, variables, prior_run_id? }`, returning the
    typed `{ output, cost_usd, tokens_in, tokens_out, model, duration_ms }`.

    TestRunPanel.tsx ('use client'): props include the CURRENT editor draft (draft_prompt + draft_user_template
    — D-03 tests the unsaved buffer, NOT a saved version). Render an input-mode selector with four modes:
    (1) Prior-real input: a run picker → sets prior_run_id; (2) Manual variable entry: a form generated from
    VARIABLE_REGISTRY[agentKey] to fill each variable; (3) Canned fixture: a one-click "use sample" (server
    SAMPLE_FIXTURES fills when variables empty + no prior_run_id); (4) Edit unsaved draft is implicit (the
    draft is always sent). On "Run", call runAgentTest with the Clerk token; display output (reuse the
    AgentIOPanel display style) + a cost line (cost_usd, tokens_in/out, model, duration_ms). It must NOT
    trigger a full pipeline run.

    [agentKey]/page.tsx: mount <TestRunPanel> wired to the live editor draft state from PromptEditor.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx tsc --noEmit 2>&1 | tail -5; grep -q "test-run" apps/dispatch-control/lib/testRunClient.ts && grep -q "prior_run_id" apps/dispatch-control/app/(dashboard)/prompts/_components/TestRunPanel.tsx && grep -q "cost_usd" apps/dispatch-control/app/(dashboard)/prompts/_components/TestRunPanel.tsx && echo TESTRUN_OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "/agents/" apps/dispatch-control/lib/testRunClient.ts` and `grep -q "Bearer" apps/dispatch-control/lib/testRunClient.ts`
    - TestRunPanel references all four modes: `grep -q "prior_run_id" .../TestRunPanel.tsx`, `grep -q "VARIABLE_REGISTRY" .../TestRunPanel.tsx` (manual entry form), and a fixture/"sample" affordance
    - TestRunPanel sends the unsaved draft (`grep -q "draft_prompt" .../TestRunPanel.tsx`) per D-03
    - Output + cost displayed (`grep -q "cost_usd" .../TestRunPanel.tsx`)
    - `cd apps/dispatch-control && npx tsc --noEmit` clean; full dispatch-control test run green: `npx vitest run` reports all passing
  </acceptance_criteria>
  <done>Test-run UI tests the unsaved draft across four input modes and shows output + cost.</done>
</task>

</tasks>

<verification>
- Side-by-side diff, one-click activate/rollback with in-progress block, and four-mode test-run UI all live.
- dispatch-control vitest suite green; tsc clean.
</verification>

<success_criteria>
PRM-04 and PRM-05 UI complete: operator diffs/activates/rolls back versions (guarded mid-run) and
test-runs the unsaved draft for output + cost without running the pipeline.
</success_criteria>

<output>
After completion, create `.planning/phases/24-prompt-editor-versioning/24-08-SUMMARY.md`
</output>
