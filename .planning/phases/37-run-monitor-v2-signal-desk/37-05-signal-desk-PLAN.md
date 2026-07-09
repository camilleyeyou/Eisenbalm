---
phase: 37-run-monitor-v2-signal-desk
plan: 05
type: execute
wave: 3
depends_on: ["37-01", "37-02"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/signal-desk/page.tsx
  - apps/dispatch-control/app/(dashboard)/signal-desk/_components/CandidateSlate.tsx
  - apps/dispatch-control/app/(dashboard)/signal-desk/_components/DecisionPanel.tsx
  - apps/dispatch-control/app/(dashboard)/signal-desk/_components/AdjudicationPanel.tsx
  - apps/dispatch-control/lib/pipelineControlClient.ts
  - apps/dispatch-control/__tests__/CandidateSlate.test.tsx
  - apps/dispatch-control/__tests__/DecisionPanel.test.tsx
  - apps/dispatch-control/__tests__/AdjudicationPanel.test.tsx
autonomous: true
requirements: [SIG-01, SIG-02, SIG-03]
must_haves:
  truths:
    - "The operator sees the candidate slate — scout summary + advocate score + expandable argument + primaryConcern always visible and never truncated"
    - "The Gate-1 decision panel shows the winner, a confidence meter, and the editor reasoning in full"
    - "When the run is paused at Gate 1, the screen enters side-by-side adjudication and the operator's pick + reason resumes the run via the bridge"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/signal-desk/_components/CandidateSlate.tsx"
      provides: "pitchLog + advocate-argument client join, primaryConcern un-truncated"
      contains: "primaryConcern"
    - path: "apps/dispatch-control/app/(dashboard)/signal-desk/_components/DecisionPanel.tsx"
      provides: "winner + confidence meter + reasoning in full"
      contains: "confidence"
    - path: "apps/dispatch-control/app/(dashboard)/signal-desk/_components/AdjudicationPanel.tsx"
      provides: "side-by-side pick + reason → adjudicate bridge"
      contains: "adjudicate"
  key_links:
    - from: "CandidateSlate.tsx"
      to: "convex pitchLog.byRunId + deliberationEvents.byRunIdAndType('advocate-argument')"
      via: "client join on charityId"
      pattern: "advocate-argument"
    - from: "DecisionPanel.tsx"
      to: "deliberationEvents editor-decision payload"
      via: "confidence + rationale (persisted by 37-01)"
      pattern: "editor-decision"
    - from: "AdjudicationPanel.tsx"
      to: "POST /issues/{run_id}/adjudicate"
      via: "pick + reason submit"
      pattern: "adjudicate"
---

<objective>
Build out the Signal Desk (`signal-desk/page.tsx` is a placeholder stub) as the charity-decision surface: candidate slate (SIG-01), Gate-1 decision panel (SIG-02), and Gate-1 adjudication (SIG-03). Distinct from Run Monitor (Run Monitor = "what happened"; Signal Desk = "the charity decision").

- SIG-01: the slate is a CLIENT-SIDE JOIN (Research Pitfall 3 — pitchLog does NOT carry advocate data): `pitchLog:byRunId` (scoutSummary) joined with `deliberationEvents:byRunIdAndType('advocate-argument')` (payload JSON `{score, argument, keyStrengths, primaryConcern}`, row keyed by `charityId`). Show scoutSummary + advocateScore + expandable advocateArgument + `primaryConcern` ALWAYS visible and NEVER truncated (roadmap/DECISIONS anti-truncation rule — no line-clamp on those fields).
- SIG-02: the decision panel reads the `editor-decision` deliberationEvents payload — winner + confidence meter (from the `confidence` field 37-01 now persists) + editor reasoning IN FULL, never truncated.
- SIG-03: when the run is paused at Gate 1 (`status === 'awaiting-review' && completedAt == null`, Research Pitfall 4), the screen enters side-by-side adjudication; the operator picks a candidate + types a reason and submits to `POST /issues/{run_id}/adjudicate` (the Clerk-guarded bridge from 37-02). The operator NEVER handles the trigger secret.

Purpose: give Andrew the charity decision on one screen and let him resolve a Gate-1 interrupt.
Output: page + three components + tests, RED-first.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/37-run-monitor-v2-signal-desk/37-CONTEXT.md
@.planning/phases/37-run-monitor-v2-signal-desk/37-RESEARCH.md
@docs/design/dispatch-control-v2/README.md

<interfaces>
<!-- Executor: exact existing shapes. NO new Convex queries needed. -->

signal-desk/page.tsx is currently `<PlaceholderScreen title="Signal Desk" phase="Phase 37" .../>` — replace it. Follow run-monitor/graph/page.tsx's Server-Component pattern: `export const dynamic = 'force-dynamic'`, resolve `workspace_id = await getCurrentWorkspace()`, pass into a Client Component that owns the useQuery subscriptions.

Convex queries (ALL exist):
- `api.runs.latest({workspace_id})` → `{runId, status, ...}` (pick the current run).
- `api.pipelineRuns.byRunId({runId})` → `{status, completedAt, ...}` (paused detection).
- `api.pitchLog.byRunId({runId})` → rows `{charityId?, charityName, charityLocation, scoutSummary, selected, ...}`.
- `api.deliberationEvents.byRunIdAndType({runId, eventType})` → rows; for `'advocate-argument'` each row has `charityId` + `payload` (JSON string) `= {charityName, score, argument, keyStrengths, primaryConcern}`; for `'editor-decision'` the row payload (from 37-01) `= {winner, rationale, confidence, runnerUpNotes}`.

SIG-01 JOIN: for each pitchLog row, find the advocate row where `advRow.charityId === pitchRow.charityId` (fallback: match on `charityName` — advocate.py has documented name-matching fragility, so prefer charityId), `JSON.parse(advRow.payload)` for score/argument/primaryConcern.

SIG-03 adjudication submit: `POST /issues/{run_id}/adjudicate` body `{selection: {charityName}, reason}`, Clerk-guarded (from 37-02, contract §37.3). Use the SAME dashboard→pipeline-API fetch/auth helper the existing control actions use (e.g. the Phase 33 rail re-run or the cancel/rerun call sites) — do NOT hand-roll a client and NEVER send the trigger secret. `reason` is required (button disabled until non-empty).

Gate-1-paused signal (Research Pitfall 4): `run.status === 'awaiting-review' && run.completedAt == null` ⇒ paused-at-Gate-1 (enter adjudication). `awaiting-review && completedAt != null` ⇒ finished/awaiting-publish (NOT adjudication — that's the Review Desk's existing flow).

1c tokens (design README): ink `#17140e`, cobalt `#253ad4`, vermilion `#e8471d` (brand-risk/urgent), marigold `#f2b01e`, green `#148a52`. SCOPE (Research Pitfall 8): do NOT build the stale design brief's gate badges (REAL/OBSCURE/SPECIFIC/TELLABLE), hookClaim, or EIN/verification strip — those are deferred V3-DEF-02. Slate = pitchLog + advocate data ONLY.
</interfaces>
</context>

<sequencing_note>
Waves run SEQUENTIALLY in the main checkout — NO worktrees. This is Wave 3; it depends on 37-01 (confidence persisted for the meter) and 37-02 (the adjudicate bridge endpoint). Land both first.
</sequencing_note>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: CandidateSlate — pitchLog + advocate-argument client join (SIG-01)</name>
  <read_first>
    - .planning/phases/37-run-monitor-v2-signal-desk/37-RESEARCH.md (Pitfall 3 — the join)
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/page.tsx (Server→Client pattern) and lib/workspace.ts (getCurrentWorkspace)
    - apps/dispatch-control/__tests__/CandidateSlate.test.tsx (NEW — Wave 0)
  </read_first>
  <behavior>
    - CandidateSlate.test.tsx: given pitchLog rows + advocate-argument deliberationEvents rows joined on charityId, renders one card per candidate showing scoutSummary, advocateScore, and primaryConcern. `primaryConcern` renders in FULL with no truncation utility (assert the element carries no `line-clamp`/`truncate` class and full text is present). The advocateArgument is collapsed by default and expands on click. The winning/selected candidate is marked. A candidate with a missing advocate row still renders (score/argument degrade gracefully, primaryConcern empty string is fine).
  </behavior>
  <action>
    Create signal-desk/_components/CandidateSlate.tsx (Client Component). Props: `{ runId: string }`. Subscribe `pitchLog.byRunId` + `deliberationEvents.byRunIdAndType({runId, eventType: 'advocate-argument'})`. Build the join (charityId primary, charityName fallback), `JSON.parse` advocate payloads defensively (try/catch). Render candidate cards: charityName + scoutSummary, advocateScore (1-10, e.g. a small score bar), an expandable advocateArgument (`useState` collapse), and `primaryConcern` ALWAYS rendered in full (NO `line-clamp`/`truncate` — plain block). Mark the `selected` candidate. Use 1c tokens. Add the behavior tests.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- CandidateSlate</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "advocate-argument" apps/dispatch-control/app/(dashboard)/signal-desk/_components/CandidateSlate.tsx`
    - `grep -q "primaryConcern" CandidateSlate.tsx` AND the primaryConcern element has NO clamp: `grep -c "line-clamp\|truncate" CandidateSlate.tsx` is 0 (or clamp is provably not on the primaryConcern/argument nodes)
    - `grep -q "pitchLog" CandidateSlate.tsx` AND `grep -q "deliberationEvents" CandidateSlate.tsx` (client join)
    - `pnpm --filter dispatch-control test:unit -- CandidateSlate` exits 0
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: DecisionPanel — winner + confidence meter + reasoning in full (SIG-02)</name>
  <read_first>
    - docs/API_CONTRACTS.md §37.2 (editor-decision payload {winner, rationale, confidence, runnerUpNotes})
    - apps/dispatch-control/__tests__/DecisionPanel.test.tsx (NEW — Wave 0)
  </read_first>
  <behavior>
    - DecisionPanel.test.tsx: given an `editor-decision` deliberationEvents row with payload `{winner, rationale, confidence: 0.72, runnerUpNotes}`, renders the winner name, a confidence meter reflecting 0.72 (e.g. width 72% / "72%"), and the full `rationale` text with NO truncation. When no editor-decision row exists yet, renders a graceful empty state (not a crash, meter absent). Handles `confidence == null` (older runs pre-37-01) by hiding the meter, still showing winner + rationale.
  </behavior>
  <action>
    Create signal-desk/_components/DecisionPanel.tsx (Client Component). Props: `{ runId: string }`. Subscribe `deliberationEvents.byRunIdAndType({runId, eventType: 'editor-decision'})`, take the row, `JSON.parse(payload)`. Render: winner (headline), a confidence meter (0-1 → percentage bar; hide when `confidence == null`), editor reasoning (`rationale`) IN FULL (no clamp), and `runnerUpNotes` if present. Empty state when no row. Use 1c tokens. Add the behavior tests.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- DecisionPanel</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "editor-decision" apps/dispatch-control/app/(dashboard)/signal-desk/_components/DecisionPanel.tsx`
    - `grep -q "confidence" DecisionPanel.tsx` (meter reads the persisted field)
    - the rationale node has no clamp: `grep -c "line-clamp\|truncate" DecisionPanel.tsx` is 0 (or clamp provably not on winner/rationale)
    - `pnpm --filter dispatch-control test:unit -- DecisionPanel` exits 0
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 3: AdjudicationPanel + page composition — Gate-1 pause → pick + reason → bridge (SIG-03)</name>
  <read_first>
    - .planning/phases/37-run-monitor-v2-signal-desk/37-RESEARCH.md (Pitfall 4 — paused detection)
    - the existing dashboard→pipeline-API control fetch helper (grep `adjudicate`/`rerun`/`cancel` call sites under apps/dispatch-control for the auth'd fetch pattern)
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/page.tsx (Server-Component shell to mirror for signal-desk/page.tsx)
    - apps/dispatch-control/__tests__/AdjudicationPanel.test.tsx (NEW — Wave 0)
  </read_first>
  <behavior>
    - AdjudicationPanel.test.tsx: renders the top candidates side-by-side; selecting a candidate + typing a non-empty reason enables Submit; Submit POSTs `{selection: {charityName}, reason}` to `/issues/{runId}/adjudicate`. Submit is disabled when reason is empty. It never references or sends a trigger secret.
    - page composition: when `run.status === 'awaiting-review' && run.completedAt == null` the page shows AdjudicationPanel; otherwise it shows the resolved DecisionPanel. CandidateSlate is always shown.
  </behavior>
  <action>
    1. (plan-review warning 2) In `apps/dispatch-control/lib/pipelineControlClient.ts` (currently exports `triggerRun`/`cancelRun`/`rerollAgent` only — NO adjudicate call exists), add an exported `async function adjudicateGate1(runId: string, body: { selection: { charityName: string }; reason: string }, token: string | null): Promise<...>` mirroring `rerollAgent`'s fetch/auth shape (Bearer token, pipeline base URL, typed error), POSTing to `/issues/{runId}/adjudicate`. Do NOT inline a raw fetch in the component.
    2. Create signal-desk/_components/AdjudicationPanel.tsx (Client Component). Props: `{ runId: string; candidates: {charityName: string; advocateScore?: number}[] }` (top candidates for side-by-side). Radio/select a candidate, a required `reason` textarea, Submit → call `adjudicateGate1(runId, {selection: {charityName}, reason}, await getToken())`. Disable Submit until a pick AND non-empty reason. Show a success/pending state. NEVER include a trigger secret.
    3. Replace signal-desk/page.tsx: Server Component (`export const dynamic = 'force-dynamic'`, `getCurrentWorkspace()`), pass workspace_id into a Client shell that subscribes `runs.latest` + `pipelineRuns.byRunId`, computes `isPausedAtGate1 = run.status === 'awaiting-review' && run.completedAt == null`, and renders CandidateSlate (always) + either AdjudicationPanel (paused) or DecisionPanel (resolved).
    Add the behavior tests.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- AdjudicationPanel && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "adjudicateGate1" apps/dispatch-control/lib/pipelineControlClient.ts` (new client call centralized, not inlined)
    - `grep -q "adjudicateGate1\|adjudicate" apps/dispatch-control/app/(dashboard)/signal-desk/_components/AdjudicationPanel.tsx`
    - AdjudicationPanel sends no trigger secret: `grep -ci "trigger.secret\|X-Pipeline-Trigger" apps/dispatch-control/app/(dashboard)/signal-desk/_components/AdjudicationPanel.tsx` is 0
    - page.tsx computes the paused branch: `grep -q "completedAt" apps/dispatch-control/app/(dashboard)/signal-desk/page.tsx` OR the client shell it renders (`grep -rq "completedAt" apps/dispatch-control/app/(dashboard)/signal-desk/`)
    - `grep -q "CandidateSlate" apps/dispatch-control/app/(dashboard)/signal-desk/` (page renders the slate) AND both DecisionPanel + AdjudicationPanel referenced
    - `grep -c "PlaceholderScreen" apps/dispatch-control/app/(dashboard)/signal-desk/page.tsx` is 0 (stub replaced)
    - `pnpm --filter dispatch-control test:unit -- AdjudicationPanel` exits 0 AND `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test:unit` green (CandidateSlate + DecisionPanel + AdjudicationPanel)
- `pnpm --filter dispatch-control build` exits 0
- Manual: on a paused run the Signal Desk shows side-by-side adjudication; pick + reason resumes the run and is audit-logged (via 37-02 bridge); primaryConcern + editor reasoning render in full (no ellipsis)
</verification>

<success_criteria>
- Candidate slate joins pitchLog + advocate-argument, primaryConcern never truncated (SIG-01)
- Decision panel shows winner + confidence meter (from persisted confidence) + reasoning in full (SIG-02)
- Gate-1 pause → side-by-side adjudication → pick + reason → adjudicate bridge; no trigger secret in the client (SIG-03)
- Placeholder stub replaced; build exits 0
</success_criteria>

<output>
After completion, create `.planning/phases/37-run-monitor-v2-signal-desk/37-05-SUMMARY.md`
</output>
