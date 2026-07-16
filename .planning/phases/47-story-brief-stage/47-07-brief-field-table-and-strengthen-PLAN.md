---
phase: 47-story-brief-stage
plan: 07
type: execute
wave: 3
depends_on: ["47-04", "47-05"]
files_modified:
  - apps/dispatch-control/lib/briefClient.ts
  - apps/dispatch-control/app/(dashboard)/story-brief/_components/BriefFieldTable.tsx
  - apps/dispatch-control/app/(dashboard)/story-brief/_components/BriefFieldStrengthen.tsx
  - apps/dispatch-control/__tests__/BriefFieldTable.test.tsx
  - apps/dispatch-control/__tests__/BriefFieldStrengthen.test.tsx
autonomous: true
requirements: [BRF-05, BRF-06]
must_haves:
  truths:
    - "The Brief renders as an editable six-field table (premise, current peg, central claim, reader effect, known risks, voice intention) reading the current brief from the provider; an edit patches through the guarded FastAPI PATCH boundary (Clerk then briefs:patch then audit_log)"
    - "Ask an agent to strengthen a single Brief field shows a read-only preview (no mutation) then Apply writes the field + audit_log + Decision-log entry, reusing the field-scoped revision engine"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/story-brief/_components/BriefFieldTable.tsx"
      provides: "BRF-05 editable six-field Brief table"
      min_lines: 45
    - path: "apps/dispatch-control/app/(dashboard)/story-brief/_components/BriefFieldStrengthen.tsx"
      provides: "BRF-06 field-scoped strengthen (preview then apply)"
      min_lines: 30
  key_links:
    - from: "BriefFieldTable.tsx"
      to: "patchBrief (briefClient.ts) then PATCH /issues/{runId}/brief"
      via: "Clerk-guarded edit"
      pattern: "patchBrief"
    - from: "BriefFieldStrengthen.tsx"
      to: "strengthenBriefFieldPreview / strengthenBriefFieldApply (briefClient.ts)"
      via: "RevisionFlow-shaped preview then apply"
      pattern: "strengthenBriefField"
---

<objective>
Build the Brief console surface: the editable six-field `BriefFieldTable` (BRF-05, edit half) and `BriefFieldStrengthen` (BRF-06). The table reads the current Brief from the provider (`ws.brief`) and writes edits through the guarded `PATCH /issues/{runId}/brief` boundary. Strengthen reuses the Phase-45 revision preview/apply state machine (`RevisionFlow`), generalized to a Brief-field scope (D-03/D-13 — one shared revision core, no third fork).

Purpose: Convex is the editable source of truth for the Brief; edits are Clerk-guarded and audited (D-12). BRF-06 is the field-scoped generalization of the revision engine, exactly as Phase 45 generalized FCT-06 to passage scope.
Output: briefClient.ts (patchBrief + strengthen preview/apply); BriefFieldTable.tsx; BriefFieldStrengthen.tsx; two filled Wave-0 tests.
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
Design contract (Annotations §Stage 1, L53): "Brief: editable field table (premise, peg, central claim, reader effect, risks, voice intention) + 'Ask an agent to strengthen a field'."

Brief field keys (must match API_CONTRACTS §47): premise, currentPeg, centralClaim, readerEffect, knownRisks, voiceIntention.

briefClient.ts fns to add (mirror revisionClient.ts previewRevision/applyRevision Clerk-token fetch shape):
  patchBrief(runId, field, value, token) -> PATCH /issues/{runId}/brief
  strengthenBriefFieldPreview(runId, field, currentValue, token) -> POST /issues/{runId}/brief/{field}/strengthen/preview -> {proposedText, whatChanged}
  strengthenBriefFieldApply(runId, field, newText, token) -> POST /issues/{runId}/brief/{field}/strengthen/apply -> {resolution}

Reuse target: components/revision/RevisionFlow.tsx — surface-agnostic by design (its docstring: "knows nothing about the galley or inspector"). Swap the passage prop for a {field, currentValue} Brief scope. DecisionLog.tsx is drop-in for the apply audit entry.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: briefClient.ts — patchBrief + strengthen preview/apply clients</name>
  <read_first>
    apps/dispatch-control/lib/revisionClient.ts (previewRevision L167 / applyRevision L190 + the RevisePreviewBody/Result interfaces L75-104 — copy the Clerk-token fetch + typed result shape). apps/dispatch-control/lib/pipelineControlClient.ts (`pipelineBaseUrl()` helper). API_CONTRACTS §47 (the three Brief endpoint shapes landed in 47-04).
  </read_first>
  <action>
    Create apps/dispatch-control/lib/briefClient.ts exporting patchBrief, strengthenBriefFieldPreview, strengthenBriefFieldApply per the interfaces block — each a typed fetch to the corresponding endpoint with the Clerk Authorization header, throwing on non-ok like previewRevision/applyRevision. Export result interfaces (BriefStrengthenPreviewResult { proposedText, whatChanged }, etc.).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && grep -q "export async function patchBrief" apps/dispatch-control/lib/briefClient.ts && grep -q "export async function strengthenBriefFieldPreview" apps/dispatch-control/lib/briefClient.ts && grep -q "export async function strengthenBriefFieldApply" apps/dispatch-control/lib/briefClient.ts && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - briefClient.ts exports patchBrief, strengthenBriefFieldPreview, strengthenBriefFieldApply
    - Each targets the correct endpoint path and includes the Clerk Authorization header, following revisionClient.ts's throw-on-non-ok shape
  </acceptance_criteria>
  <done>The three Brief clients exist and are typed against the §47 endpoints.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: BriefFieldTable.tsx — editable six-field table (BRF-05)</name>
  <read_first>
    apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx (the `brief` subscription exposed in 47-05). apps/dispatch-control/lib/briefClient.ts (patchBrief from Task 1). apps/dispatch-control/__tests__/BriefFieldTable.test.tsx (Wave-0 scaffold to fill). Annotations §Stage 1 L53. 47-CONTEXT.md D-12 (guarded content-boundary edit).
  </read_first>
  <behavior>
    - Renders the six Brief fields from ws.brief as an editable table (label + editable value per row).
    - Editing a field and saving calls patchBrief(runId, field, newValue, token).
    - When no Brief exists yet (pre-selection), shows an appropriate empty/not-yet-generated state.
  </behavior>
  <action>
    Create BriefFieldTable.tsx: a field table over the six Brief keys, each row editable (textarea/inline edit), saving via patchBrief with a Clerk token. Use the 1c tokens. Fill BriefFieldTable.test.tsx: the six fields render from a mock brief; editing a field + save calls patchBrief with the right field key + value.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- BriefFieldTable</automated>
  </verify>
  <acceptance_criteria>
    - BriefFieldTable renders all six field labels (premise, current peg, central claim, reader effect, known risks, voice intention)
    - BriefFieldTable.test.tsx asserts an edit calls `patchBrief` with the correct field key
    - `pnpm --filter dispatch-control test:unit -- BriefFieldTable` green
  </acceptance_criteria>
  <done>The Brief is an editable six-field table writing through the guarded PATCH boundary.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: BriefFieldStrengthen.tsx — field-scoped strengthen (BRF-06)</name>
  <read_first>
    apps/dispatch-control/components/revision/RevisionFlow.tsx (the surface-agnostic preview then comparison then apply state machine — wrap it with a Brief-field scope). apps/dispatch-control/lib/briefClient.ts (strengthen preview/apply from Task 1). apps/dispatch-control/components/decision-log/DecisionLog.tsx (apply audit display). apps/dispatch-control/__tests__/BriefFieldStrengthen.test.tsx (Wave-0 scaffold to fill). 47-CONTEXT.md D-13 + 47-RESEARCH.md §"Pattern 6".
  </read_first>
  <behavior>
    - "Ask an agent to strengthen" a field triggers a preview (strengthenBriefFieldPreview) that shows proposedText + whatChanged WITHOUT mutating.
    - Apply calls strengthenBriefFieldApply, which writes the field and logs to the Decision log.
    - Discard leaves the field unchanged (no apply call).
  </behavior>
  <action>
    Create BriefFieldStrengthen.tsx wrapping RevisionFlow (or its preview/comparison/apply pieces) with a {field, currentValue} Brief scope: preview via strengthenBriefFieldPreview (read-only), Apply via strengthenBriefFieldApply. Fill BriefFieldStrengthen.test.tsx: strengthen shows a preview with no apply call; Apply calls strengthenBriefFieldApply(runId, field, newText, token); Discard makes no apply call.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- BriefFieldStrengthen</automated>
  </verify>
  <acceptance_criteria>
    - BriefFieldStrengthen.test.tsx asserts preview calls strengthenBriefFieldPreview and does NOT call apply; Apply calls strengthenBriefFieldApply
    - The component reuses RevisionFlow (imported, not reimplemented)
    - `pnpm --filter dispatch-control test:unit -- BriefFieldStrengthen` green
  </acceptance_criteria>
  <done>Operators can strengthen any single Brief field via the shared, field-scoped revision engine.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test:unit -- BriefFieldTable BriefFieldStrengthen` green; full suite green.
- Edits and strengthen route through briefClient to the guarded §47 endpoints; strengthen reuses RevisionFlow.
</verification>

<success_criteria>
BRF-05 (editable Brief) and BRF-06 (strengthen a field) are implemented and unit-verified over one shared revision core.
</success_criteria>

<output>
After completion, create `.planning/phases/47-story-brief-stage/47-07-SUMMARY.md`.
</output>
