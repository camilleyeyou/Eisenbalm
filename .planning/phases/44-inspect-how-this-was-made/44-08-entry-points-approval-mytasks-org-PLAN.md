---
phase: 44-inspect-how-this-was-made
plan: 08
type: execute
wave: 5
depends_on: ["44-06"]
files_modified:
  - apps/dispatch-control/lib/derivedState.ts
  - apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx
  - apps/dispatch-control/__tests__/derivedState.test.ts
autonomous: true
requirements: [INS-01]
must_haves:
  truths:
    - "The approval recommendation opens the inspector on the rec artifact (agentKey editor_final) from the DecisionRail recommendation section."
    - "My Tasks' reserved 'Inspect context' button is enabled and opens the inspector, AND deriveTasks now populates DerivedTask.insp for qa-finding and claim tasks (both changes are required — the button alone opens with no artifact key)."
    - "The brief organization card opens the inspector on the org artifact (agentKey scout) — a live entry point today (StoryPanelContent is real and unblocked by Phase 46/47), not a degraded stub."
    - "Sign-off tasks (signoff-facts/signoff-voice) leave insp unset — the button stays reserved for just those two rows, which have no single natural artifact (honest, not a regression)."
  artifacts:
    - path: "apps/dispatch-control/lib/derivedState.ts"
      provides: "deriveTasks populates DerivedTask.insp for qa + claim tasks (encoded artifact-key strings)"
      contains: "insp:"
    - path: "apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx"
      provides: "enabled Inspect-context button -> openInspector(task.insp)"
      contains: "openInspector"
  key_links:
    - from: "lib/derivedState.ts::deriveTasks"
      to: "DerivedTask.insp = encodeArtifactKey({type, runId, locator})"
      via: "qa finding -> founder/qa key; claim -> claim key"
      pattern: "insp:"
    - from: "MyTasksScreen.tsx"
      to: "useInspector().openInspector(task.insp)"
      via: "enable the reserved button when task.insp is set"
      pattern: "openInspector"
---

<objective>
Wire the remaining three entry points (INS-01) — approval recommendation, My Tasks "Inspect context", and the brief organization card — to the single `openInspector`, and populate the `DerivedTask.insp` field that My Tasks needs. Per RESEARCH: the approval recommendation resolves unambiguously to `editor_final` (DecisionRail's "Agent editor's recommendation" section); the brief org card is a LIVE entry point today (StoryPanelContent's winner/candidate cards are real, resolving to `scout` — NOT a degraded stub, correcting the CONTEXT optimism); and My Tasks needs TWO changes, not one — enable the reserved button AND populate `DerivedTask.insp` in `deriveTasks` (the field is declared but never assigned).

Purpose: All six entry points now open the same panel — the phase's defining constraint is satisfied end-to-end.
Output: DecisionRail Inspect button + StoryPanelContent org onInspect + MyTasksScreen enable + deriveTasks insp population + derivedState test coverage.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/44-inspect-how-this-was-made/44-CONTEXT.md
@.planning/phases/44-inspect-how-this-was-made/44-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
import { useInspector } from '@/components/inspector/InspectorProvider'
import { encodeArtifactKey } from '@/lib/inspectorArtifact'
// rec:   openInspector({ type: 'rec', runId, locator: '' })            -> editor_final
// org:   openInspector({ type: 'org', runId, locator: candidateId|'' }) -> scout
// task:  openInspector(task.insp)   // task.insp is the encoded string form

<!-- lib/derivedState.ts::deriveTasks (existing) — DerivedTask.insp?: string declared line 47, NEVER assigned.
     qaFindings block (~396-412): row.sectionName (snake_case), row._id, i.runId.
     claimRows block (~414-429): row._id (claimId), row.sectionName, i.runId.
     sign-off block (~432-462): 'signoff-facts'/'signoff-voice' — leave insp UNSET (RESEARCH Open Question 1). -->

<!-- DecisionRail.tsx section aria-label="Agent editor's recommendation" (~line 390), memo key `notes`, resolves to editor_final. -->
<!-- StoryPanelContent.tsx winner/candidate cards (winner.charityName etc.) — add an Inspect affordance -> org key. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Populate DerivedTask.insp in deriveTasks + cover it in derivedState.test.ts</name>
  <read_first>
    - apps/dispatch-control/lib/derivedState.ts lines 38-70 (DerivedTask interface incl. `insp?: string` line 47) and lines 388-462 (deriveTasks — the qaFindings, claimRows, and sign-off push blocks)
    - apps/dispatch-control/lib/inspectorArtifact.ts (encodeArtifactKey — the string encoder to use)
    - apps/dispatch-control/__tests__/derivedState.test.ts (the existing test — add cases without breaking prior assertions)
    - .planning/phases/44-inspect-how-this-was-made/44-RESEARCH.md Pitfall 5 + Open Question 1 (both changes needed; sign-offs stay unset)
  </read_first>
  <action>
    In `lib/derivedState.ts::deriveTasks`, `import { encodeArtifactKey } from './inspectorArtifact'` and set `insp` on the two task types that have a natural single artifact:
    - qaFindings block: `insp: encodeArtifactKey({ type: isVoiceAxisFinding(row) ? 'founder' : 'founder', runId: i.runId as string, locator: row.sectionName })` — a qa finding anchors to the writer that produced the section; use `type: 'founder'` with the section name as locator (the resolver normalizes snake_case section names via KNOWN_RUN_KEYS). (Voice-axis findings anchor to the same section's writer — still 'founder'.) If the section is not a known writer section, still encode it; the resolver degrades honestly.
    - claimRows block: `insp: encodeArtifactKey({ type: 'claim', runId: i.runId as string, locator: row._id })`.
    - sign-off block (`signoff-facts`/`signoff-voice`): DO NOT set `insp` (leave undefined) — these gates have no single natural artifact (RESEARCH Open Question 1); the My Tasks button stays reserved for just these two rows.
    Then extend `derivedState.test.ts`: assert a qa-finding task's `insp` decodes to `{ type:'founder', runId, locator: <sectionName> }`, a claim task's `insp` decodes to `{ type:'claim', runId, locator: <claimId> }`, and the two sign-off tasks have `insp === undefined`.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm test -- __tests__/derivedState.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "insp: encodeArtifactKey" apps/dispatch-control/lib/derivedState.ts` exits 0 (assigned in ≥2 blocks).
    - The sign-off push blocks do NOT set `insp` (`grep -n "signoff-facts" -A6 apps/dispatch-control/lib/derivedState.ts` shows no `insp:` inside them).
    - The test asserts qa/claim tasks carry a decodable `insp` and sign-off tasks carry `insp === undefined`.
    - `pnpm --filter dispatch-control test -- __tests__/derivedState.test.ts` exits 0 (prior assertions still green).
  </acceptance_criteria>
  <done>deriveTasks populates insp for qa + claim tasks and deliberately omits it for sign-offs; tested.</done>
</task>

<task type="auto">
  <name>Task 2: Enable My Tasks "Inspect context" + wire the approval recommendation Inspect</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx lines ~170-190 (the disabled "Inspect context" button with the reserved title) — enable it conditionally on `task.insp`
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx lines ~386-401 (the "Agent editor's recommendation" section — add an Inspect affordance; runId is in scope on this rail)
    - docs/API_CONTRACTS.md §44.1 (rec locator = '')
  </read_first>
  <action>
    1. MyTasksScreen: `const { openInspector } = useInspector()`. For the "Inspect context" button, when `task.insp` is set render it ENABLED with `onClick={() => openInspector(task.insp!)}` (remove `disabled`/reserved `title` for those rows); when `task.insp` is undefined (sign-off rows) keep it disabled with the existing reserved title. This satisfies both halves of RESEARCH Pitfall 5.
    2. DecisionRail: in the "Agent editor's recommendation" section, add a small "Inspect" button (label + icon, matching the rail's existing button styling) that calls `openInspector({ type: 'rec', runId, locator: '' })` from `useInspector()`. Only render it when a recommendation exists (the section already guards the empty case). Ensure the component is `'use client'` (DecisionRail is a client rail already).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm build && pnpm test</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "openInspector(task.insp" apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx` exits 0 and the button is enabled when `task.insp` is set (the reserved title only remains on the `!task.insp` branch).
    - `grep -q "openInspector({ type: 'rec'" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` exits 0.
    - `pnpm --filter dispatch-control build` exits 0; `pnpm --filter dispatch-control test` stays green.
  </acceptance_criteria>
  <done>My Tasks opens the inspector for qa/claim tasks (reserved only for sign-offs); the approval recommendation opens the rec artifact.</done>
</task>

<task type="auto">
  <name>Task 3: Wire the brief organization card (live, resolves to scout)</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx (the winner/candidate cards; how it receives runId/pitchRows — the winner row's id is the candidate locator)
    - .planning/phases/44-inspect-how-this-was-made/44-RESEARCH.md § "org and claim artifact resolution" (org resolves to scout, live today — NOT a degraded stub)
    - docs/API_CONTRACTS.md §44.1/§44.3 (org locator = candidateId or ''; resolves to scout)
  </read_first>
  <action>
    In `StoryPanelContent.tsx`, add an "Inspect how this was made" affordance (label + icon) to the winner card (and/or candidate cards) that calls `openInspector({ type: 'org', runId, locator: winner._id ?? '' })` from `useInspector()`. Use the run's id in scope (or thread it from the parent Story panel if not already present). Ensure the component is `'use client'` for `useInspector()`. This is a LIVE entry point — Scout's pitchLog is real for every run to date; do NOT gate it behind a "Phase 46/47" reserved state. (The inspector's `org` tabs may still degrade some fields — e.g. no signal_editor step — which the panel already handles.)
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm build && pnpm test</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "openInspector({ type: 'org'" apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx` exits 0.
    - The affordance is NOT wrapped in a Phase-46/47 reserved/disabled guard (it is a live button).
    - `pnpm --filter dispatch-control build` exits 0; `pnpm --filter dispatch-control test` stays green.
  </acceptance_criteria>
  <done>The brief organization card opens the inspector on the org (scout) artifact as a live entry point.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control build` and `pnpm --filter dispatch-control test` pass (incl. derivedState.test.ts).
- All three entry points call `openInspector` with the correct artifact key; sign-off tasks correctly stay reserved.
</verification>

<success_criteria>
- The final three of six entry points (approval recommendation, My Tasks, brief org) open the one shared inspector; DerivedTask.insp is populated for qa/claim tasks and deliberately omitted for sign-offs. With 44-07, all six places open the same panel.
</success_criteria>

<output>
After completion, create `.planning/phases/44-inspect-how-this-was-made/44-08-SUMMARY.md`.
</output>
