---
phase: 41-issue-workspace-frame
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/dispatch-control/app/(dashboard)/signal-desk/_components/SignalDeskScreen.tsx
  - apps/dispatch-control/__tests__/SignalDeskScreen.test.tsx
autonomous: true
requirements: [WSP-01]
must_haves:
  truths:
    - "SignalDeskScreen can be scoped to a specific runId (this issue's run), not only runs.latest"
    - "When no runId is passed, SignalDeskScreen keeps its current workspace_id/runs.latest behavior"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/signal-desk/_components/SignalDeskScreen.tsx"
      provides: "additive optional runId? prop that bypasses runs.latest when present"
      contains: "runId?"
    - path: "apps/dispatch-control/__tests__/SignalDeskScreen.test.tsx"
      provides: "proof a passed non-latest runId is used (Pitfall 2 guard)"
  key_links:
    - from: "SignalDeskScreen runId? prop"
      to: "the pipelineRuns/pitchLog/advocate subscriptions"
      via: "when runId provided, skip api.runs.latest and use it directly"
      pattern: "runId ?? latestRun"
---

<objective>
Give `SignalDeskScreen` an ADDITIVE optional `runId?` prop so Stage 1 (Story) can mount
it scoped to a SPECIFIC issue's run — not the workspace's latest run. This is the odd-one-out
issue-keying (D-09): unlike Review/Voice which already have issue-keyed wrappers, Signal Desk
was built in Phase 37 keyed to `runs.latest` via `workspace_id` and never took a runId
(41-RESEARCH Pattern 6 / Pitfall 2). Copying the review/voice wrapper verbatim would silently
show the workspace's latest run on the Story tab — breaking the moment an operator opens a
held/older issue while a newer run is in flight. Fix it here, before the Stage 1 wrapper (Plan 41-07)
consumes it, with a test that proves a passed non-latest runId is honored.

Purpose: minimal, backward-compatible signature change; the legacy top-level `/signal-desk`
route (which passes only `workspace_id`) MUST keep working unchanged.
Output: `SignalDeskScreenProps = { workspace_id: string; runId?: string }` + test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/41-issue-workspace-frame/41-CONTEXT.md
@.planning/phases/41-issue-workspace-frame/41-RESEARCH.md

<interfaces>
<!-- SignalDeskScreen.tsx (verified): props { workspace_id }. Internally:
       const latestRun = useQuery(api.runs.latest, { workspace_id })
       const runId = latestRun?.runId
       then run/pitchRows/advocateRows useQuery keyed on runId (skip when absent).
     Renders CandidateSlate + (AdjudicationPanel if paused at Gate 1 else DecisionPanel). -->
<!-- LEGACY CALLER TO PRESERVE: app/(dashboard)/signal-desk/page.tsx renders
       <SignalDeskScreen workspace_id={workspace_id} /> — passes NO runId. Must stay valid. -->
<!-- Test harness precedent: __tests__/VoicePassScreen.test.tsx (vi.mock('convex/react') dispatching
     useQuery by api key). -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add additive runId? prop that bypasses runs.latest (D-09, Pitfall 2)</name>
  <files>apps/dispatch-control/app/(dashboard)/signal-desk/_components/SignalDeskScreen.tsx, apps/dispatch-control/__tests__/SignalDeskScreen.test.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/signal-desk/_components/SignalDeskScreen.tsx (full)
    - apps/dispatch-control/app/(dashboard)/signal-desk/page.tsx (the legacy caller — must remain valid with workspace_id only)
    - apps/dispatch-control/__tests__/VoicePassScreen.test.tsx (the vi.mock('convex/react') useQuery-dispatch harness to copy)
    - .planning/phases/41-issue-workspace-frame/41-RESEARCH.md §Pattern 6 (recommendation (a))
  </read_first>
  <behavior>
    - Test: rendering `<SignalDeskScreen workspace_id="eisenbalm" runId="run-OLD" />` uses "run-OLD"
      for its pitchLog/advocate subscriptions EVEN when `api.runs.latest` would return "run-NEW"
      (assert the CandidateSlate/AdjudicationPanel receive the passed run, not latest).
    - Test: rendering `<SignalDeskScreen workspace_id="eisenbalm" />` (no runId) falls back to
      `api.runs.latest` exactly as today (regression guard for the legacy route).
  </behavior>
  <action>
    In SignalDeskScreen.tsx:
      - Change `SignalDeskScreenProps` to `{ workspace_id: string; runId?: string }`.
      - Only query `api.runs.latest` when `runId` is NOT provided (guard it: pass 'skip' or
        gate the derived runId): `const latestRun = useQuery(api.runs.latest, runId ? 'skip' : { workspace_id })`.
      - Compute the effective run: `const effectiveRunId = runId ?? latestRun?.runId`. Use
        `effectiveRunId` everywhere the old `runId` local was used (run/pitchRows/advocateRows +
        the `if (!runId)` no-run guard → `if (!effectiveRunId)`).
      - Add a comment: the runId path is the D-09 issue-keyed entry (Stage 1); the workspace_id/
        runs.latest path is the legacy `/signal-desk` behavior, untouched.
    Create SignalDeskScreen.test.tsx with the two behaviors, copying VoicePassScreen.test.tsx's mock harness.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- SignalDeskScreen.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "runId?" apps/dispatch-control/app/(dashboard)/signal-desk/_components/SignalDeskScreen.tsx` succeeds (optional prop)
    - the `api.runs.latest` useQuery is skipped when runId is provided (grep for `runId ? 'skip'` or equivalent guard)
    - `apps/dispatch-control/__tests__/SignalDeskScreen.test.tsx` exists and exits 0
    - a test asserts a passed runId is used even when latest differs (Pitfall 2 guard present)
    - legacy `signal-desk/page.tsx` still compiles (workspace_id-only call remains type-valid)
  </acceptance_criteria>
  <done>SignalDeskScreen accepts an optional runId that overrides runs.latest; legacy behavior + route intact; test green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- SignalDeskScreen.test.tsx` green.
- Legacy `/signal-desk` route type-checks with a workspace_id-only call.
</verification>

<success_criteria>
`SignalDeskScreen` is issue-keyable via an additive `runId?` prop that bypasses `runs.latest`,
with a test proving a non-latest run is honored; the workspace_id-only path is unchanged.
</success_criteria>

<output>
After completion, create `.planning/phases/41-issue-workspace-frame/41-04-SUMMARY.md`
</output>
