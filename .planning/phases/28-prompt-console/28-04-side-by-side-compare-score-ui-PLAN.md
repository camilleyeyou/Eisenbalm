---
phase: 28-prompt-console
plan: 04
type: execute
wave: 2
depends_on: [28-03]
files_modified:
  - apps/dispatch-control/lib/testRunClient.ts
  - apps/dispatch-control/lib/scoreClient.ts
  - apps/dispatch-control/app/(dashboard)/prompts/_components/TestRunPanel.tsx
  - apps/dispatch-control/__tests__/scoreClient.test.ts
autonomous: true
requirements: [PRC-08, PRC-09]
must_haves:
  truths:
    - "The draft test-run runs by default at 1x cost; a 'compare against active' action additionally runs the active version on demand and shows both outputs side-by-side with real cost + token counts"
    - "A voice-rubric score (per-axis breakdown + overall headline + 1-2 line rationale) is shown on the draft output, fetched from the scoring endpoint"
    - "When both sides run, the active side is scored too and the score delta is shown"
    - "The score is advisory only and never blocks any action"
  artifacts:
    - path: "apps/dispatch-control/lib/scoreClient.ts"
      provides: "Typed client for POST /agents/{key}/score (mirrors testRunClient)"
      contains: "/score"
    - path: "apps/dispatch-control/lib/testRunClient.ts"
      provides: "runActiveVersionTest helper to run the ACTIVE version for the compare side"
      contains: "TestRunResult"
    - path: "apps/dispatch-control/app/(dashboard)/prompts/_components/TestRunPanel.tsx"
      provides: "Side-by-side draft-vs-active compare + voice-score display + delta"
      contains: "Compare against active"
  key_links:
    - from: "TestRunPanel.tsx"
      to: "scoreClient.scoreOutput (POST /agents/{key}/score)"
      via: "score the draft output (always) + active output (when compared)"
      pattern: "scoreOutput"
    - from: "TestRunPanel.tsx"
      to: "testRunClient (active-version run)"
      via: "compare-against-active runs the active version on demand (1x default preserved)"
      pattern: "Compare against active"
---

<objective>
Complete the authoring loop UI (PRC-08, PRC-09): keep the draft test-run as the
default 1× run, add a "compare against active" action that runs the active
version too and shows both outputs side-by-side with real cost + token counts,
and surface a voice-rubric score (per-axis + overall + 1-2 line rationale) on the
draft output — scoring the active side and showing the delta when both ran.

Purpose: the standout guardrail — iterate on a draft, see its voice score, and
compare against the live version before activating. Advisory only; never gates.
Output: a typed score client, an active-version run helper, and the extended
TestRunPanel. Depends on Plan 03's `POST /agents/{key}/score` endpoint + contract.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.planning/phases/28-prompt-console/28-CONTEXT.md

<interfaces>
<!-- Existing + Plan-03 contracts the UI consumes. -->

testRunClient.ts:
- TestRunBody = { draft_prompt, draft_user_template?, variables: Record<string,string>, prior_run_id? }
- TestRunResult = { output, cost_usd, tokens_in, tokens_out, model, duration_ms }
- runAgentTest(agentKey, body: TestRunBody, token): Promise<TestRunResult>  — POSTs /agents/{key}/test-run
- pipelineBaseUrl() reads NEXT_PUBLIC_PIPELINE_URL.

TestRunPanel.tsx props: { workspaceId, agentKey, draftPrompt, draftUserTemplate? }.
  Current state: mode ('fixture'|'manual'|'prior'), priorRunId, variables, running, result, error.
  handleRun() builds a TestRunBody from the mode and calls runAgentTest → setResult.
  getToken() from useAuth(). active version content is NOT currently available here.

Plan 03 scoring endpoint (docs/API_CONTRACTS §3A.2):
  POST /agents/{agent_key}/score  Auth: _require_operator
  body: { workspace_id: str, agent_key: str, output: str }
  resp: { overall: float, axes: [{axis,score,pass,note}], rationale: str, rubric_source: str,
          cost_usd, tokens_in, tokens_out, model, duration_ms }

Convex: api.promptVersions.getActive({ workspace_id, agentKey }) → active row { content, ... } | null
  (needed to run the ACTIVE version as draft_prompt for the compare side — D-07: on-demand,
  preserving the 1× default; running the draft does NOT also run active automatically).
</interfaces>

@apps/dispatch-control/lib/testRunClient.ts
@apps/dispatch-control/app/(dashboard)/prompts/_components/TestRunPanel.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: scoreClient.ts + active-version run helper</name>
  <files>apps/dispatch-control/lib/scoreClient.ts, apps/dispatch-control/lib/testRunClient.ts, apps/dispatch-control/__tests__/scoreClient.test.ts</files>
  <read_first>
    - apps/dispatch-control/lib/testRunClient.ts (pipelineBaseUrl, fetch + bearer pattern, error handling to mirror)
    - docs/API_CONTRACTS.md §3A.2 (the score request/response shape — from Plan 03)
  </read_first>
  <action>
    (A) Create apps/dispatch-control/lib/scoreClient.ts mirroring testRunClient.ts:
      - `export interface VoiceAxisScore { axis: string; score: number; pass: boolean; note: string }`
      - `export interface ScoreResult { overall: number; axes: VoiceAxisScore[]; rationale: string;
        rubric_source: string; cost_usd: number; tokens_in: number; tokens_out: number;
        model: string; duration_ms: number }`
      - `export async function scoreOutput(agentKey: string, output: string, token: string | null):
        Promise<ScoreResult>` — POST `${pipelineBaseUrl()}/agents/${encodeURIComponent(agentKey)}/score`
        with body `{ workspace_id: 'eisenbalm', agent_key: agentKey, output }`, bearer header when
        token present, same non-ok error handling as runAgentTest. Reuse the SAME
        NEXT_PUBLIC_PIPELINE_URL base (export/share pipelineBaseUrl from testRunClient, or duplicate
        the tiny helper — Claude's discretion, keep DRY if easy).

    (B) In testRunClient.ts add a thin helper `runActiveVersionTest` so the compare side runs the
        ACTIVE version's content as the draft_prompt:
      - `export async function runActiveVersionTest(agentKey: string, activeContent: string,
        body: Omit<TestRunBody,'draft_prompt'>, token: string | null): Promise<TestRunResult>` →
        calls runAgentTest(agentKey, { ...body, draft_prompt: activeContent }, token). (Same input
        mode/variables as the draft run, but the active version's prompt text.) Additive — do NOT
        change runAgentTest's signature.

    (C) Add apps/dispatch-control/__tests__/scoreClient.test.ts: a fetch-mocked unit test asserting
        scoreOutput POSTs to `/agents/{key}/score` with `{ workspace_id: 'eisenbalm', agent_key, output }`
        and parses a ScoreResult (overall/axes/rationale/rubric_source + cost fields). Set
        NEXT_PUBLIC_PIPELINE_URL in the test env. Mirror any existing testRunClient test if present;
        otherwise mock global.fetch.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control test -- scoreClient && grep -q "/score" apps/dispatch-control/lib/scoreClient.ts && grep -q "runActiveVersionTest" apps/dispatch-control/lib/testRunClient.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "scoreOutput" apps/dispatch-control/lib/scoreClient.ts` and `grep -q "/agents/" apps/dispatch-control/lib/scoreClient.ts` succeed.
    - scoreClient.test.ts asserts the POST URL ends in `/score` and the body has workspace_id/agent_key/output, and parses overall/axes/rationale.
    - `grep -q "runActiveVersionTest" apps/dispatch-control/lib/testRunClient.ts` succeeds; runAgentTest signature unchanged.
    - `pnpm --filter dispatch-control test -- scoreClient` passes.
  </acceptance_criteria>
  <done>scoreClient.scoreOutput POSTs to /agents/{key}/score and parses the §3A.2 shape (fetch-mocked test green); runActiveVersionTest added additively to run the active version's prompt for the compare side.</done>
</task>

<task type="auto">
  <name>Task 2: TestRunPanel — draft score, compare-against-active, side-by-side + delta</name>
  <files>apps/dispatch-control/app/(dashboard)/prompts/_components/TestRunPanel.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/prompts/_components/TestRunPanel.tsx (handleRun, mode/result/error state, the cost <dl> + output <pre> display blocks)
    - apps/dispatch-control/lib/scoreClient.ts + testRunClient.ts (scoreOutput, runActiveVersionTest — from Task 1)
  </read_first>
  <action>
    Extend TestRunPanel.tsx (keep 'use client'; keep the four input modes + the existing draft
    run path + the cost display style):

    1) Subscribe to the active version content for the compare side:
       `const active = useQuery(api.promptVersions.getActive, { workspace_id: workspaceId, agentKey })`.

    2) Score the DRAFT output always (PRC-09): after a successful draft run, call
       `scoreOutput(agentKey, draftResult.output, await getToken())` and store `draftScore: ScoreResult | null`.
       Render a score block under the draft output: an overall headline number, a per-axis list
       (axis · score · pass/fail dot · note), and the 1-2 line rationale + a small "rubric: {rubric_source}"
       + "advisory — does not gate" caption (D-05/D-06). Keep score errors non-fatal (show a muted
       "scoring unavailable" note; the run output still renders).

    3) "Compare against active" action (PRC-08, D-07 — on demand, 1× default preserved):
       - Add a secondary button "Compare against active" (disabled when `active == null` or running).
         Clicking it runs the ACTIVE version too via
         `runActiveVersionTest(agentKey, active.content, { variables: <same as draft run>,
         prior_run_id: <same>, draft_user_template }, token)`, stores `activeResult: TestRunResult | null`,
         and scores it (`scoreOutput(agentKey, activeResult.output, token)` → `activeScore`).
       - The default "Run" button still runs ONLY the draft (does not auto-run active) — preserves
         the 1× cost default (Phase 24 D-03 / D-07).

    4) Side-by-side layout when `activeResult != null`: render the draft and active outputs +
       cost <dl> + score blocks in two columns (grid-cols-1 md:grid-cols-2), labeled "Draft" /
       "Active". When both scores exist, show the SCORE DELTA (draft.overall − active.overall,
       signed, e.g. "+1.2 vs active") near the headline (D-08). When only the draft ran, render the
       single-column view as today plus the draft score.

    5) Nothing gates: no button disabled BECAUSE of a score; the score is display-only.

    Reuse the existing cost <dl> markup for both sides. min-h-[44px] + focus rings on new buttons.
    No new npm deps.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "Compare against active" TestRunPanel.tsx` succeeds.
    - `grep -q "scoreOutput" TestRunPanel.tsx` and `grep -q "runActiveVersionTest" TestRunPanel.tsx` succeed.
    - `grep -q "getActive" TestRunPanel.tsx` succeeds (active content subscription for the compare side).
    - The default "Run" handler does NOT call runActiveVersionTest (only the compare button does — grep the handlers: the compare button's onClick is the sole caller of runActiveVersionTest).
    - A score delta is computed when both sides scored (grep for a subtraction of overall scores / "vs active").
    - No button `disabled` expression references a score value (advisory-only).
    - `pnpm --filter dispatch-control build` (strict) passes.
  </acceptance_criteria>
  <done>Draft run is scored and shown with per-axis + overall + rationale; "compare against active" runs the active version on demand and renders both outputs/costs side-by-side with a score delta; the default Run stays 1×; nothing is gated by the score; strict build passes.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- scoreClient` passes; `pnpm --filter dispatch-control build` (strict) passes.
- Manual sanity (requires the Plan-03 endpoint reachable via NEXT_PUBLIC_PIPELINE_URL): Run scores the draft (per-axis + overall + rationale); "Compare against active" shows both outputs + costs side-by-side + a score delta; no action is blocked by a score.
</verification>

<success_criteria>
- PRC-08: draft-vs-active side-by-side compare runs the active version on demand and shows both outputs + real cost + token counts; draft runs by default at 1×.
- PRC-09 (UI): voice-rubric score (per-axis + overall + 1-2 line rationale) on the draft output (always) and the active output (when compared), with the delta; advisory only — never gates.
</success_criteria>

<output>
After completion, create `.planning/phases/28-prompt-console/28-04-SUMMARY.md`
</output>
