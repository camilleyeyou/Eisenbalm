---
phase: 38-prompt-lab-evals-eval-center
plan: 05
type: execute
wave: 3
depends_on: ["38-01", "38-02", "38-04"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/EvalDrawer.tsx
  - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AgentPromptEditorView.tsx
  - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx
  - apps/dispatch-control/__tests__/EvalDrawer.test.tsx
autonomous: true
requirements: [EVL-02, EVL-03]
must_haves:
  truths:
    - "Editing agent X's prompt auto-selects the scenarios whose agentKey === X (no manual picking)"
    - "The drawer runs each selected scenario against BOTH the draft and the active version and shows a per-scenario draft/active/delta row"
    - "An aggregate target-metric summary sits on top of the per-scenario rows"
    - "Each scored run persists an eval_scores row (source 'drawer') so the drift time-series + gate can read it"
    - "A 'Run evals for v{N}' producer on non-active version rows writes eval_scores tagged promptVersion=String(N) source='commit' — so the EVL-03 freshness gate (38-04) has fresh, target-version-tagged data to pass on its non-override path (closes the plan-review blocker: without this, every commit after the first is force-blocked into override)"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/EvalDrawer.tsx"
      provides: "auto-select + N-scenario draft-vs-active scoreboard + evalScores.record persistence"
      min_lines: 40
    - path: "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AgentPromptEditorView.tsx"
      provides: "EvalDrawer mounted in the editing pane"
      contains: "EvalDrawer"
  key_links:
    - from: "EvalDrawer.tsx"
      to: "GET /eval/scenarios (via evalScenarioClient.fetchScenarios)"
      via: "fetchScenarios(agentKey, token)"
      pattern: "fetchScenarios"
    - from: "EvalDrawer.tsx"
      to: "test-run + score (draft AND active)"
      via: "runAgentTest / runActiveVersionTest / scoreOutput per scenario"
      pattern: "runActiveVersionTest"
    - from: "EvalDrawer.tsx"
      to: "eval_scores via api.evalScores.record"
      via: "useMutation(api.evalScores.record) per scored side"
      pattern: "evalScores.record"
---

<objective>
Build the Prompt Lab eval drawer (D-04/D-05): on the agent being edited it auto-selects that agentKey's scenarios, runs each against the draft AND the active version (reusing the existing test-run→score client loop scaled from 1 to N), shows a per-scenario draft/active/delta scoreboard with an aggregate summary on top, and records each scored run to `eval_scores` (source 'drawer') so the drift time-series and commit gate can read it.

Purpose: EVL-02 — the safe iteration surface: edit → eval → scoreboard.
Output: EvalDrawer.tsx + its mount in AgentPromptEditorView.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/38-prompt-lab-evals-eval-center/38-RESEARCH.md
@apps/dispatch-control/app/(dashboard)/prompt-lab/_components/TestRunPanel.tsx
@apps/dispatch-control/lib/testRunClient.ts
@apps/dispatch-control/lib/scoreClient.ts
@apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AgentPromptEditorView.tsx

<interfaces>
<!-- The exact per-scenario 4-call sequence (Research Code Examples — the thing D-05 scales to N). -->
Per scenario, run: runAgentTest(agentKey, { draft_prompt: draft, variables: scenario.input }, token) → scoreOutput(agentKey, res.output, token) (draft side); runActiveVersionTest(agentKey, active.content, { variables: scenario.input }, token) → scoreOutput(...) (active side). delta = draftScore.overall - activeScore.overall.

Clients (already exist): `fetchScenarios` (Plan 02, @/lib/evalScenarioClient), `runAgentTest`/`runActiveVersionTest` (@/lib/testRunClient), `scoreOutput` (@/lib/scoreClient), `api.evalScores.record`/`api.promptVersions.getActive` (Convex).
Auth token: `const { getToken } = useAuth()` from @clerk/nextjs (see TestRunPanel).

COST NOTE (Pitfall 3): N scenarios × 4 model calls (2 of them Opus-tier `score`). Runs ONLY on an explicit button click (never onChange). Show an estimated call-count/cost before running the batch.

eval_scores.record args: `{ workspace_id, scenarioId, agentKey, promptVersion (String(activeVersion) for the active side; 'draft' for the draft side), overall, axes: JSON.stringify(score.axes), costUsd, source: 'drawer' }`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: EvalDrawer.tsx — auto-select + N-scenario scoreboard + eval_scores persistence</name>
  <files>apps/dispatch-control/app/(dashboard)/prompt-lab/_components/EvalDrawer.tsx, apps/dispatch-control/__tests__/EvalDrawer.test.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/TestRunPanel.tsx lines 51-368 (draft-vs-active + score-delta pattern to scale to N)
    - apps/dispatch-control/lib/testRunClient.ts + lib/scoreClient.ts (client signatures)
    - apps/dispatch-control/lib/evalScenarioClient.ts (Plan 02 — fetchScenarios shape)
    - apps/dispatch-control/vitest.config.ts + an existing component test under __tests__ for the render/mocking pattern
  </read_first>
  <behavior>
    - Test 1: given a mocked `fetchScenarios` returning 2 scout scenarios, the drawer renders exactly those 2 rows for agentKey 'scout' (auto-select by agentKey, no picker).
    - Test 2: on "Run evals" click (mocked test-run/score returning fixed scores), each row shows draft score, active score, and a signed delta; an aggregate summary (avg delta or target-up/down) renders on top.
    - Test 3: after a run, `api.evalScores.record` is invoked once per scored side per scenario (mock the mutation; assert call count/args include source 'drawer').
    - Test 4: the drawer does NOT auto-run on mount/prop change — scoring only fires on the explicit button click.
    - Test 5 (freshness producer / blocker fix): when `targetVersion={{version: 2}}` is passed, the draft-side `evalScores.record` call tags `promptVersion: '2'` and `source: 'commit'` (NOT `'draft'`/`'drawer'`); with no `targetVersion` prop the draft side stays `promptVersion: 'draft'`, `source: 'drawer'`.
  </behavior>
  <action>
    Create EvalDrawer.tsx (`'use client'`). Props: `{ workspaceId, agentKey, draftPrompt, targetVersion?: { version: number } }`. On mount, `fetchScenarios(agentKey, token)` (via a useEffect + the Clerk token) and store the auto-selected list. Read the active version via `useQuery(api.promptVersions.getActive, { workspace_id, agentKey })`. Render a scoreboard table: header = aggregate summary (count of scenarios, avg overall draft vs active, avg delta, and a target-up/down chip); one row per scenario with `whatItCatches`, draft overall, active overall, and a color-signed delta (cobalt up / vermilion down per the 1c tokens). A "Run evals (N scenarios · ~4N model calls)" button triggers the batch: for each scenario run the 4-call sequence sequentially (draft test-run→score, active test-run→score), collect scores, and call `useMutation(api.evalScores.record)` for BOTH sides. **Draft-side tag depends on `targetVersion` (the freshness-producer fix for plan-review Blocker 1):** when `targetVersion` is supplied, tag the draft side `promptVersion: String(targetVersion.version)` and `source: 'commit'` (this is the row the 38-04 gate queries by `by_workspace_agentKey_version` for the about-to-activate version); when it is NOT supplied, tag `promptVersion: 'draft'`, `source: 'drawer'` (the normal iteration case). The active side always tags `promptVersion: String(active.version)`, `source: 'drawer'`. Both sides carry `axes: JSON.stringify(score.axes)`, `costUsd: score.cost_usd`. Handle partial-failure per row (show an error state, keep others). Never fire on onChange — button click only. Use `--color-*` tokens / existing Tailwind arbitrary-value pattern; ≥44px targets; no new deps.

    Write apps/dispatch-control/__tests__/EvalDrawer.test.tsx covering the 5 behaviors (mock the fetchScenarios + testRun/score clients + the Convex mutation).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/EvalDrawer.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "fetchScenarios" apps/dispatch-control/app/(dashboard)/prompt-lab/_components/EvalDrawer.tsx` matches
    - `grep -q "runActiveVersionTest" apps/dispatch-control/app/(dashboard)/prompt-lab/_components/EvalDrawer.tsx` matches (active side runs)
    - `grep -q "evalScores.record" apps/dispatch-control/app/(dashboard)/prompt-lab/_components/EvalDrawer.tsx` matches
    - `npx vitest run __tests__/EvalDrawer.test.tsx` exits 0 with all 4 tests passing
  </acceptance_criteria>
  <done>The drawer auto-selects by agentKey, runs the N-scenario draft-vs-active scoreboard on click, and persists eval_scores; test green.</done>
</task>

<task type="auto">
  <name>Task 2: Mount EvalDrawer in AgentPromptEditorView (editing pane) + strict build</name>
  <files>apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AgentPromptEditorView.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AgentPromptEditorView.tsx lines 200-215 (where TestRunPanel is mounted in the editing branch)
  </read_first>
  <action>
    Import EvalDrawer and mount it in the `editing` branch directly below the existing `<TestRunPanel ... />` (line ~206-210), passing `workspaceId={workspaceId}`, `agentKey={agentKey}`, `draftPrompt={draft}`. Keep TestRunPanel unchanged (single-run advisory scoring stays). This gives the freshness workflow a home: after Save-as-version the operator re-opens the drawer against the saved version's content to write eval_scores tagged to that version before activation (documented inline as a comment referencing §38.3 freshness).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "EvalDrawer" apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AgentPromptEditorView.tsx` matches
    - `pnpm --filter dispatch-control build` exits 0 (strict type-check — MEMORY rule)
  </acceptance_criteria>
  <done>The eval drawer appears in the Prompt Lab editing pane; strict build passes.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: "Run evals for v{N}" freshness producer on non-active version rows (closes plan-review Blocker 1)</name>
  <files>apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx, apps/dispatch-control/__tests__/EvalDrawer.test.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx (the version list rows + the Activate button; 38-04 already added the override UI here — build on that)
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/EvalDrawer.tsx (Task 1 — the targetVersion prop)
    - .planning/phases/38-prompt-lab-evals-eval-center/38-04-commit-gate-override-PLAN.md (the gate's freshness query: eval_scores by_workspace_agentKey_version for String(target.version), ranAt >= target.createdAt)
  </read_first>
  <behavior>
    - On each NON-active version row (a saved version that is not currently active), a "Run evals for v{N}" affordance is present; the ACTIVE row does not show it (it's already the baseline).
    - Clicking it mounts/opens `EvalDrawer` with `draftPrompt = that version's saved content` AND `targetVersion={{ version: N }}`, so running the batch writes commit-tagged (`promptVersion: String(N)`, `source: 'commit'`) eval_scores rows — the exact shape the 38-04 gate requires to pass Activate(N) on its non-override path.
  </behavior>
  <action>
    In VersionHistoryPanel.tsx, for each non-active version row, add a "Run evals for v{N}" button next to Activate. Clicking it opens EvalDrawer (inline expansion or a panel toggle — Claude's discretion) with `agentKey`, `workspaceId`, `draftPrompt={version.content}` (the saved content of THAT version), and `targetVersion={{ version: version.version }}`. This is the producer that writes the freshness rows the gate reads: without a commit-tagged eval_scores row for v{N}, Activate(N) blocks and forces the override path (plan-review Blocker 1). Do NOT alter the Activate/override logic from 38-04 — only add the eval-producer affordance. Extend EvalDrawer.test.tsx (or add a VersionHistoryPanel render test) asserting the button appears on a non-active row and, when clicked, mounts EvalDrawer with the targetVersion prop set to that row's version number.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/EvalDrawer.test.tsx && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "targetVersion" apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx` matches (the producer passes it)
    - `grep -Eq "Run evals for v|Run evals for version" apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx` matches
    - `grep -q "targetVersion" apps/dispatch-control/__tests__/EvalDrawer.test.tsx` matches (Test 5 / producer test)
    - `npx vitest run __tests__/EvalDrawer.test.tsx` exits 0 AND `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>A "Run evals for v{N}" producer exists on non-active version rows, writing commit-tagged eval_scores so the EVL-03 gate can pass Activate on its intended non-override path; the force-override blocker is closed.</done>
</task>

</tasks>

<verification>
- `npx vitest run __tests__/EvalDrawer.test.tsx` green.
- `pnpm --filter dispatch-control build` exits 0.
</verification>

<success_criteria>
EVL-02 — editing a prompt auto-runs its affected scenarios and shows a draft-vs-active delta scoreboard, persisting each run to the eval_scores time-series.
</success_criteria>

<output>
After completion, create `.planning/phases/38-prompt-lab-evals-eval-center/38-05-SUMMARY.md`.
</output>
