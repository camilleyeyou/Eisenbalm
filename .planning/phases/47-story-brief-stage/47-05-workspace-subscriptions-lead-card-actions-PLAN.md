---
phase: 47-story-brief-stage
plan: 05
type: execute
wave: 2
depends_on: ["47-01"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx
  - apps/dispatch-control/lib/pipelineControlClient.ts
  - apps/dispatch-control/app/(dashboard)/story-brief/_components/LeadCard.tsx
  - apps/dispatch-control/app/(dashboard)/story-brief/_components/LeadActions.tsx
  - apps/dispatch-control/__tests__/LeadCard.test.tsx
  - apps/dispatch-control/__tests__/LeadActions.test.tsx
autonomous: true
requirements: [BRF-01, BRF-02]
must_haves:
  truths:
    - "WorkspaceStateProvider exposes storyLeads, verificationRecords, and the current brief as centralized subscriptions (the frame's single-subscription discipline — no per-component useQuery)"
    - "LeadCard renders EVERY story-lead field in full — premise, dated peg + source link, reader energy, charitable angle, category, confidence, and the brand-risk warning — never truncated, never tooltip-hidden"
    - "LeadActions offers Require this lead (no reason) and Remove — add reason (reason mandatory; disabled until non-empty) wired to the guarded FastAPI leads endpoints; the Remove reason lands in the Decision log"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/story-brief/_components/LeadCard.tsx"
      provides: "BRF-01 never-truncated lead card"
      min_lines: 40
    - path: "apps/dispatch-control/app/(dashboard)/story-brief/_components/LeadActions.tsx"
      provides: "BRF-02 Require/Remove+reason"
      min_lines: 30
  key_links:
    - from: "LeadActions.tsx"
      to: "requireLead / removeLead (pipelineControlClient.ts)"
      via: "Clerk getToken() then FastAPI leads endpoints"
      pattern: "removeLead"
    - from: "WorkspaceStateProvider.tsx"
      to: "api.storyLeads.byRunId / api.verificationRecords.byRunId / api.briefs.byRunId"
      via: "useQuery, runId-scoped"
      pattern: "storyLeads.byRunId"
---

<objective>
Lay the frontend data foundation for Stage 1 and build the first two components: the never-truncated `LeadCard` (BRF-01) and `LeadActions` (BRF-02). Add the `storyLeads` / `verificationRecords` / `briefs` subscriptions to the shared `WorkspaceStateProvider` (the frame's single-subscription point 41-04 established), and the `requireLead` / `removeLead` typed clients to `pipelineControlClient.ts`.

Purpose: Every Stage-1 component reads from the centralized provider (D-01 reuse; no per-component useQuery sprawl). BRF-01's "never truncated or tooltip-hidden" is a hard tripwire mirroring Phase-37's primaryConcern. BRF-02's Remove is reason-gated and Decision-logged.
Output: provider subscriptions + client fns; LeadCard.tsx; LeadActions.tsx; two filled Wave-0 tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/47-story-brief-stage/47-CONTEXT.md
@.planning/phases/47-story-brief-stage/47-RESEARCH.md
@docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md

<interfaces>
Design contract (Annotations §Stage 1, L48-55): "Leads: premise, dated peg + source, reader energy, angle, category, brand-risk warning, confidence, Require this lead / Remove — add reason (reason mandatory, logged)."

story_leads row shape (Convex, API_CONTRACTS §46.5): { _id, runId, premise, datedPeg, pegSourceUrl, readerEnergy, charitableAngle, category, confidence, brandRiskFlag, brandRiskReason?, repetitionWarning?, recommended, status? }

Never-truncated tripwire (copy from __tests__/CandidateSlate.test.tsx): assert `el.textContent` equals the full long string AND `el.className` does NOT match `/line-clamp|truncate/`.

Client fns to add (pipelineControlClient.ts, mirror adjudicateGate1's Clerk-token fetch shape):
  requireLead(runId, leadId, token) -> POST /issues/{runId}/leads/{leadId}/require, returns {leadId, status:'required'}
  removeLead(runId, leadId, reason, token) -> POST /issues/{runId}/leads/{leadId}/remove, returns {leadId, status:'removed'}

Provider pattern: WorkspaceStateProvider.tsx already does `const pitchRows = useQuery(api.pitchLog.byRunId, runId ? { runId } : 'skip')` (L135) and exposes it on WorkspaceStateValue (L52) + the returned value object (L244). Add storyLeads/verificationRecords/brief the same way.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add storyLeads/verificationRecords/briefs subscriptions + requireLead/removeLead clients</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx, apps/dispatch-control/lib/pipelineControlClient.ts</files>
  <read_first>
    apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx (the `useQuery(api.pitchLog.byRunId, ...)` subscription at L135, the WorkspaceStateValue interface at L52, and the exposed value object at L244 — mirror all three for the new queries; honor the 41-04 "reuse, no new useQuery elsewhere" discipline). apps/dispatch-control/lib/pipelineControlClient.ts (`adjudicateGate1` L186-211 — the exact Clerk-token fetch + error-throw shape to copy). convex/_generated/api (confirm api.storyLeads.byRunId, api.verificationRecords.byRunId, api.briefs.byRunId exist post-47-01).
  </read_first>
  <action>
    In WorkspaceStateProvider.tsx: add `const storyLeads = useQuery(api.storyLeads.byRunId, runId ? { runId } : 'skip')`, the same for verificationRecords (api.verificationRecords.byRunId) and brief (api.briefs.byRunId). Add the three to the WorkspaceStateValue interface and to the exposed value object. Keep runId-scoped/'skip' gating consistent with pitchRows.
    In pipelineControlClient.ts: add requireLead and removeLead per the interfaces block (POST to /issues/{runId}/leads/{leadId}/require and /remove with the Clerk Authorization header and JSON body; throw on non-ok exactly like adjudicateGate1). Export matching TypeScript result interfaces.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && grep -q "api.storyLeads.byRunId" "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx" && grep -q "api.briefs.byRunId" "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx" && grep -q "export async function removeLead" apps/dispatch-control/lib/pipelineControlClient.ts && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - WorkspaceStateProvider.tsx contains `api.storyLeads.byRunId`, `api.verificationRecords.byRunId`, `api.briefs.byRunId` useQuery calls and exposes them on WorkspaceStateValue + the value object
    - pipelineControlClient.ts exports `requireLead` and `removeLead` following adjudicateGate1's fetch/throw shape
    - `pnpm --filter dispatch-control test:unit` full suite still green (no provider regression)
  </acceptance_criteria>
  <done>The frame centralizes the three new subscriptions; the two lead-action clients exist.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: LeadCard.tsx — never-truncated lead card (BRF-01)</name>
  <files>apps/dispatch-control/app/(dashboard)/story-brief/_components/LeadCard.tsx, apps/dispatch-control/__tests__/LeadCard.test.tsx</files>
  <read_first>
    apps/dispatch-control/app/(dashboard)/signal-desk/_components/CandidateSlate.tsx L197-208 (the "primaryConcern — ALWAYS visible, rendered in FULL, never clipped" block + its `data-testid` — the exact 1c-token idiom to mirror for the brand-risk warning). apps/dispatch-control/__tests__/CandidateSlate.test.tsx L90-114 (the never-truncated assertion to copy into LeadCard.test.tsx). apps/dispatch-control/__tests__/LeadCard.test.tsx (the Wave-0 scaffold from 47-01 to fill). Annotations §Stage 1 L50. story_leads shape in the interfaces block.
  </read_first>
  <behavior>
    - Renders premise, datedPeg with a source link to pegSourceUrl, readerEnergy, charitableAngle, category, and confidence — each in full.
    - When brandRiskFlag is true, renders brandRiskReason in full with a `data-testid="brand-risk-{...}"`; the element's className does NOT match /line-clamp|truncate/ and its textContent equals the full string.
    - repetitionWarning renders in full when present.
  </behavior>
  <action>
    Create LeadCard.tsx (Client Component) taking a single story-lead row (from ws.storyLeads) and rendering every field per Annotations §Stage 1, using the 1c design tokens (`var(--color-*)`, `var(--font-*)`) copied from CandidateSlate. The brand-risk warning block mirrors CandidateSlate's primaryConcern block exactly — always visible, full text, no clamp/truncate class, `data-testid`. Fill LeadCard.test.tsx: assert every field renders + the brand-risk never-truncated tripwire.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- LeadCard</automated>
  </verify>
  <acceptance_criteria>
    - LeadCard.test.tsx asserts no truncation of the brand-risk warning: `expect(el.className).not.toMatch(/line-clamp|truncate/)` and `expect(el.textContent).toBe(longWarning)`
    - LeadCard renders premise, datedPeg + pegSourceUrl link, readerEnergy, charitableAngle, category, confidence (test asserts each present)
    - No `line-clamp`/`truncate`/`title=` attribute on the lead-field or brand-risk elements
    - `pnpm --filter dispatch-control test:unit -- LeadCard` green
  </acceptance_criteria>
  <done>Lead cards show every field in full; the brand-risk warning can never be clipped or tooltip-hidden.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: LeadActions.tsx — Require / Remove+reason (BRF-02)</name>
  <files>apps/dispatch-control/app/(dashboard)/story-brief/_components/LeadActions.tsx, apps/dispatch-control/__tests__/LeadActions.test.tsx</files>
  <read_first>
    apps/dispatch-control/app/(dashboard)/signal-desk/_components/AdjudicationPanel.tsx (the Clerk `useAuth().getToken()` + required-reason textarea + guarded-call idiom — the closest precedent). apps/dispatch-control/components/decision-log/DecisionLog.tsx (drop-in Decision-log display; confirm the props it accepts). apps/dispatch-control/lib/pipelineControlClient.ts (requireLead/removeLead added in Task 1). apps/dispatch-control/__tests__/LeadActions.test.tsx (the Wave-0 scaffold to fill). Annotations §Stage 1 L50 + §Decision & audit L112-113.
  </read_first>
  <behavior>
    - "Require this lead" calls requireLead(runId, leadId, token) with no reason.
    - The Remove submit is disabled while the reason textarea is empty/whitespace.
    - Submitting Remove with a non-empty reason calls removeLead(runId, leadId, reason, token).
  </behavior>
  <action>
    Create LeadActions.tsx: a Require button (calls requireLead via a Clerk token from useAuth().getToken()) and a Remove control with a mandatory reason textarea (submit disabled until non-empty; calls removeLead). Surface success via the shared DecisionLog (the Remove reason is logged server-side by the endpoint; the component reflects the pending/optimistic state per the AdjudicationPanel idiom). Fill LeadActions.test.tsx: Require calls requireLead; Remove disabled without reason; Remove with reason calls removeLead with the reason string.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- LeadActions</automated>
  </verify>
  <acceptance_criteria>
    - LeadActions.test.tsx asserts Require calls `requireLead`, Remove is disabled with empty reason, and Remove-with-reason calls `removeLead(runId, leadId, reason, token)`
    - The reason textarea gates the Remove button (disabled attribute tied to trimmed reason length)
    - `pnpm --filter dispatch-control test:unit -- LeadActions` green
  </acceptance_criteria>
  <done>Operators can Require a lead or Remove it with a mandatory, logged reason through the guarded endpoints.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test:unit -- LeadCard LeadActions` green; full suite green.
- Provider exposes storyLeads/verificationRecords/brief; clients exist.
</verification>

<success_criteria>
BRF-01 and BRF-02 are implemented and unit-verified; the shared provider now feeds every remaining Stage-1 component.
</success_criteria>

<output>
After completion, create `.planning/phases/47-story-brief-stage/47-05-SUMMARY.md`.
</output>
