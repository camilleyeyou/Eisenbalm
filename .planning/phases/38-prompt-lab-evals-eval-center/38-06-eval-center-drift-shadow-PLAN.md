---
phase: 38-prompt-lab-evals-eval-center
plan: 06
type: execute
wave: 4
depends_on: ["38-01", "38-02", "38-03"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/eval-center/page.tsx
  - apps/dispatch-control/app/(dashboard)/eval-center/_components/ScenarioCard.tsx
  - apps/dispatch-control/app/(dashboard)/eval-center/_components/DriftScoreboard.tsx
  - apps/dispatch-control/app/(dashboard)/eval-center/_components/ShadowRunPanel.tsx
  - apps/dispatch-control/lib/shadowRunClient.ts
  - apps/dispatch-control/__tests__/EvalCenter.test.tsx
autonomous: true
requirements: [EVL-04, EVL-05]
must_haves:
  truths:
    - "The Eval Center shows a scenario card per golden scenario (description, what-it-catches, last result)"
    - "An append-only scoreboard renders the eval_scores time-series per scenario/agent so editorial drift over time is visible — not a single latest number"
    - "The operator can trigger a shadow discovery run from the Eval Center and see the preview output inline"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/eval-center/page.tsx"
      provides: "Eval Center screen (replaces the placeholder stub)"
      min_lines: 25
    - path: "apps/dispatch-control/app/(dashboard)/eval-center/_components/DriftScoreboard.tsx"
      provides: "eval_scores time-series render (drift detector)"
      contains: "listForScenario"
    - path: "apps/dispatch-control/app/(dashboard)/eval-center/_components/ShadowRunPanel.tsx"
      provides: "shadow-run trigger + inline preview"
      contains: "shadow"
    - path: "apps/dispatch-control/lib/shadowRunClient.ts"
      provides: "POST /eval/shadow-run client"
      exports: ["runShadow"]
  key_links:
    - from: "eval-center/page.tsx"
      to: "GET /eval/scenarios (fetchScenarios) + eval_scores queries"
      via: "ScenarioCard + DriftScoreboard"
      pattern: "ScenarioCard"
    - from: "DriftScoreboard.tsx"
      to: "api.evalScores.listForScenario / listForAgent"
      via: "useQuery"
      pattern: "listForScenario"
    - from: "lib/shadowRunClient.ts"
      to: "POST /eval/shadow-run"
      via: "fetch(`${pipelineBaseUrl()}/eval/shadow-run`)"
      pattern: "/eval/shadow-run"
---

<objective>
Build out the Eval Center stub (D-08/D-10) into the drift detector: scenario cards (description, what-it-catches, last eval_scores result), an append-only time-series scoreboard reading the eval_scores rows per scenario/agent (drift over prompt-version history, not a single number), and a Shadow Run panel that triggers `POST /eval/shadow-run` and shows the live discovery preview inline.

Purpose: EVL-04 (drift detector) + EVL-05 UI (shadow preview affordance).
Output: eval-center/page.tsx + ScenarioCard + DriftScoreboard + ShadowRunPanel + shadowRunClient.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/38-prompt-lab-evals-eval-center/38-RESEARCH.md
@docs/design/dispatch-control-v2/README.md
@apps/dispatch-control/app/(dashboard)/eval-center/page.tsx
@apps/dispatch-control/lib/testRunClient.ts
@apps/dispatch-control/lib/evalScenarioClient.ts

<interfaces>
<!-- Reads: scenarios via fetchScenarios (Plan 02); time-series via eval_scores queries (Plan 01); shadow via Plan 03 endpoint. -->
Scenarios: `fetchScenarios(agentKey?, token)` (@/lib/evalScenarioClient) → EvalScenario[].
Time-series: `useQuery(api.evalScores.listForScenario, { workspace_id, scenarioId })` (ascending by ranAt) and `listForAgent` — each row `{ scenarioId, agentKey, promptVersion, overall, axes, costUsd, ranAt, source }`.
Shadow: `POST /eval/shadow-run` body `{ workspace_id }` → `{ candidates: CharityCandidate[], featuredKeysCount: number }` (Plan 03 / §38.4).
1c tokens (design README): ink `#17140e`, cobalt `#253ad4`, vermilion `#e8471d`, marigold `#f2b01e`, green `#148a52`. Design brief §Eval Center: "8 golden-scenario cards … Shadow run card (scenario 1 against this week's real news) … append-only scoreboard time-series." Drift view = table or small sparkline (Claude's discretion). No new npm deps; ≥44px targets; single `<main>` owned by the dashboard layout.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Eval Center page + ScenarioCard + DriftScoreboard (EVL-04)</name>
  <files>apps/dispatch-control/app/(dashboard)/eval-center/page.tsx, apps/dispatch-control/app/(dashboard)/eval-center/_components/ScenarioCard.tsx, apps/dispatch-control/app/(dashboard)/eval-center/_components/DriftScoreboard.tsx, apps/dispatch-control/__tests__/EvalCenter.test.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/eval-center/page.tsx (the 15-line stub being replaced)
    - apps/dispatch-control/app/(dashboard)/prompt-lab/[agentKey]/page.tsx (force-dynamic + getCurrentWorkspace server-component pattern)
    - apps/dispatch-control/lib/evalScenarioClient.ts (Plan 02) + convex/evalScores.ts (Plan 01 queries)
    - docs/design/dispatch-control-v2/README.md §6 Eval Center
  </read_first>
  <behavior>
    - Test 1: given a mocked scenario list (2 scenarios) + mocked eval_scores rows, the page renders one ScenarioCard per scenario showing description + whatItCatches + the latest (highest ranAt) overall as "last result".
    - Test 2: DriftScoreboard renders MORE THAN the latest row for a scenario with multiple eval_scores rows (time-series, not a single number) — assert ≥2 data points render.
    - Test 3: a scenario with no eval_scores rows shows a graceful "never evaluated" state (no crash).
  </behavior>
  <action>
    Replace eval-center/page.tsx: a server component (`export const dynamic = 'force-dynamic'`) resolving `workspace_id` via getCurrentWorkspace(), rendering a client `EvalCenterClient` (may live inline in page.tsx or a sibling — keep the file count within budget). The client: `fetchScenarios(undefined, token)` for all 8 scenarios → render a `ScenarioCard` grid; render `DriftScoreboard`; render `ShadowRunPanel` (Task 2). 
    ScenarioCard.tsx (`'use client'`): props `{ scenario }`; shows id/agentKey chip, description, whatItCatches, and "last result" = the latest eval_scores row for that scenarioId (via `useQuery(api.evalScores.listForScenario, { workspace_id, scenarioId })`, take the max-ranAt overall; "never evaluated" when empty). 
    DriftScoreboard.tsx (`'use client'`): reads eval_scores per scenario (or per agent) and renders the append-only time-series as a compact table or inline sparkline across prompt versions (overall over ranAt) — at least the multi-point series, plus source/promptVersion columns, so drift is visible over time (D-10). Use `--color-*`/1c tokens; ≥44px interactive targets.

    Write apps/dispatch-control/__tests__/EvalCenter.test.tsx covering the 3 behaviors (mock fetchScenarios + the Convex queries).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/EvalCenter.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "PlaceholderScreen" apps/dispatch-control/app/(dashboard)/eval-center/page.tsx` returns NON-zero exit (stub replaced)
    - `grep -q "listForScenario" apps/dispatch-control/app/(dashboard)/eval-center/_components/DriftScoreboard.tsx` matches
    - `grep -q "whatItCatches" apps/dispatch-control/app/(dashboard)/eval-center/_components/ScenarioCard.tsx` matches
    - `npx vitest run __tests__/EvalCenter.test.tsx` exits 0 with all 3 tests passing
  </acceptance_criteria>
  <done>The Eval Center renders scenario cards with last results and an append-only drift time-series; test green.</done>
</task>

<task type="auto">
  <name>Task 2: ShadowRunPanel + shadowRunClient + strict build (EVL-05 UI)</name>
  <files>apps/dispatch-control/app/(dashboard)/eval-center/_components/ShadowRunPanel.tsx, apps/dispatch-control/lib/shadowRunClient.ts</files>
  <read_first>
    - apps/dispatch-control/lib/testRunClient.ts (pipelineBaseUrl() + bearer + error handling to mirror)
    - docs/API_CONTRACTS.md §38.4 (shadow-run request/response shape)
  </read_first>
  <action>
    Create lib/shadowRunClient.ts: `interface ShadowCandidate { name; location; website; focusArea; missionStatement; scoutSummary; whyOverlooked; assetRange }` (mirror CharityCandidate) and `async function runShadow(token: string | null): Promise<{ candidates: ShadowCandidate[]; featuredKeysCount: number }>` that POSTs `${pipelineBaseUrl()}/eval/shadow-run` with `{ workspace_id: 'eisenbalm' }` + the Clerk bearer, mirroring testRunClient error handling. Import `pipelineBaseUrl` from `@/lib/testRunClient`.
    Create ShadowRunPanel.tsx (`'use client'`): a "Shadow run" card (design brief: "runs scenario 1 against this week's real news before paying for a live run") with a button that calls `runShadow`, a loading state, and renders the returned candidates inline (name + focusArea + scoutSummary). Include a one-line note that this is read-only and writes nothing to run state (D-11/D-12). Mount ShadowRunPanel in the Eval Center client (Task 1). Use `--color-*`/1c tokens; ≥44px targets.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "/eval/shadow-run" apps/dispatch-control/lib/shadowRunClient.ts` matches
    - `grep -q "runShadow" apps/dispatch-control/app/(dashboard)/eval-center/_components/ShadowRunPanel.tsx` matches
    - `grep -Rq "ShadowRunPanel" apps/dispatch-control/app/(dashboard)/eval-center/` matches (mounted in the Eval Center)
    - `pnpm --filter dispatch-control build` exits 0 (strict type-check — MEMORY rule)
  </acceptance_criteria>
  <done>The operator can trigger a shadow discovery from the Eval Center and see the preview inline; strict build passes.</done>
</task>

</tasks>

<verification>
- `npx vitest run __tests__/EvalCenter.test.tsx` green.
- `pnpm --filter dispatch-control build` exits 0.
- Full suites per 38-VALIDATION.md before verify-work.
</verification>

<success_criteria>
EVL-04 + EVL-05 UI — the Eval Center shows scenario cards + an append-only drift time-series and can trigger a read-only shadow discovery preview.
</success_criteria>

<output>
After completion, create `.planning/phases/38-prompt-lab-evals-eval-center/38-06-SUMMARY.md`.
</output>
