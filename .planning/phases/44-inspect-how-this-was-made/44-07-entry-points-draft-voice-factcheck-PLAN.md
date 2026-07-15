---
phase: 44-inspect-how-this-was-made
plan: 07
type: execute
wave: 5
depends_on: ["44-06"]
files_modified:
  - apps/dispatch-control/components/galley/AnnotationMark.tsx
  - apps/dispatch-control/components/galley/UnresolvedFindingCard.tsx
  - apps/dispatch-control/components/galley/GallerySection.tsx
  - apps/dispatch-control/components/galley/Galley.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx
autonomous: true
requirements: [INS-01]
must_haves:
  truths:
    - "The draft passage entry point opens the SAME inspector: a finding's action row (AnnotationMark/UnresolvedFindingCard) and a per-section header affordance both call openInspector with a founder artifact key for that section."
    - "The voice finding entry point is satisfied by the SAME AnnotationMark onInspect prop (Voice Pass reuses AnnotationMark) — one prop addition covers two of the six places."
    - "The fact-check claim detail opens the inspector by supplying ClaimProvenanceCard's already-present onInspect callback with a claim artifact key."
    - "No second panel is created — every wiring calls useInspector().openInspector."
  artifacts:
    - path: "apps/dispatch-control/components/galley/AnnotationMark.tsx"
      provides: "onInspect? optional-callback prop (covers draft + voice findings)"
      contains: "onInspect"
    - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx"
      provides: "ClaimProvenanceCard onInspect callback -> openInspector(claim key)"
      contains: "openInspector"
  key_links:
    - from: "components/galley/AnnotationMark.tsx (onInspect)"
      to: "useInspector().openInspector({type:'founder'|'signal', runId, locator: sectionId})"
      via: "conditional-action-row prop, gated on Boolean(onInspect)"
      pattern: "onInspect"
    - from: "FactCheckScreen.tsx"
      to: "openInspector({type:'claim', runId, locator: claimId})"
      via: "ClaimProvenanceCard actions.onInspect callback"
      pattern: "onInspect"
---

<objective>
Wire three of the six entry points (INS-01) — draft passage, voice finding, and fact-check claim detail — to the single `openInspector`. Per RESEARCH, two of these collapse into one change: `AnnotationMark.tsx` is the SHARED finding component behind BOTH the draft passage toolbar and the voice finding, so a single `onInspect?` prop addition (following the existing `onEditSection?`/`canEdit` conditional-action-row convention) satisfies both. The fact-check claim is even cheaper: `ClaimProvenanceCard` already has a wired-but-inert `onInspect?` prop (Phase 42) — this plan just supplies the callback where it is mounted in the Fact Check stage. Do NOT fork `ClaimProvenanceCard` (Phase 42 D-09 three-copies ban).

Purpose: A bad drafted sentence, a voice finding, or an unverified claim each opens the same inspector on the artifact that produced it.
Output: `onInspect` threaded through the galley finding chain + a per-section header affordance + the Fact Check claim callback.
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
<!-- The opener (from 44-06) -->
import { useInspector } from '@/components/inspector/InspectorProvider'
const { openInspector } = useInspector()
// artifact key: openInspector({ type: 'founder', runId, locator: sectionId })  // draft/voice section
// artifact key: openInspector({ type: 'claim', runId, locator: claimId })       // fact-check claim

<!-- Existing conditional-action-row convention to follow (UnresolvedFindingCard.tsx:25-31) -->
interface UnresolvedFindingCardProps {
  finding: UnresolvedFinding; runId?: string; sectionId?: string
  onEditSection?: (sectionId: string, findingId?: string) => void
  // ADD: onInspect?: (sectionId: string) => void   // render gate = Boolean(onInspect)
}

<!-- ClaimProvenanceCard already exposes actions.onInspect?: () => void (grep line ~131 + button ~448-454, disabled when absent) -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add onInspect to the shared galley finding chain (draft + voice)</name>
  <read_first>
    - apps/dispatch-control/components/galley/UnresolvedFindingCard.tsx lines 25-97 (the onEditSection?/canEdit conditional-action-row pattern to mirror)
    - apps/dispatch-control/components/galley/AnnotationMark.tsx (the in-paragraph finding component + its header comment noting Voice Pass reuses it with different labels)
    - apps/dispatch-control/components/galley/GallerySection.tsx (the section header where the per-section "Inspect how this was made" affordance goes; and how it receives section id + runId)
    - apps/dispatch-control/components/galley/Galley.tsx (how it threads props down to GallerySection/AnnotationMark/UnresolvedFindingCard — the point to pass onInspect through)
    - .planning/phases/44-inspect-how-this-was-made/44-RESEARCH.md entry-point table rows #2 and #4 (draft + voice, one shared prop)
  </read_first>
  <action>
    1. Add an optional `onInspect?: (sectionId: string) => void` prop to `AnnotationMark.tsx` and `UnresolvedFindingCard.tsx`, following the EXACT `onEditSection?` convention: render an "Inspect how this was made" action in the finding's action row ONLY when `Boolean(onInspect)` (label + icon, matching the existing action buttons' styling). On click, call `onInspect(sectionId)`.
    2. Add a lightweight per-section "Inspect how this was made" affordance to `GallerySection.tsx`'s header (covers sections with NO open finding), gated on an optional `onInspect?: (sectionId: string) => void` prop, calling `onInspect(sectionId)`.
    3. Thread `onInspect` through `Galley.tsx` so its consumers (the draft stage screen and the Voice Pass view — both already render Galley) can pass a callback down to sections + finding cards. Keep it optional so existing Galley callers that don't pass it are unaffected.
    4. In the DRAFT stage screen that renders Galley and the VOICE stage view that renders Galley/AnnotationMark, pass `onInspect={(sectionId) => openInspector({ type: 'founder', runId, locator: sectionId })}` (from `useInspector()`). The section id here is the galley/draft camelCase id; the resolver's `galleyIdToQaSection` normalizes it. (Voice findings anchor to the same section → same 'founder' artifact for the writer that produced the passage; this matches step-level anchoring, D-01.)
    Note: do NOT build a span-level selection toolbar — that is Phase 45 territory (RESEARCH). Section/finding-level anchoring is the locked granularity.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm build && pnpm test</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "onInspect" apps/dispatch-control/components/galley/AnnotationMark.tsx` and `...UnresolvedFindingCard.tsx` and `...GallerySection.tsx` all exit 0.
    - The action renders only when `onInspect` is provided (grep shows the `Boolean(onInspect)`/`onInspect &&` render gate, mirroring the `onEditSection` gate).
    - `grep -rq "openInspector({ type: 'founder'" apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft apps/dispatch-control/app/(dashboard)/voice-pass 2>/dev/null || grep -rq "type: 'founder'" apps/dispatch-control/app` — the draft + voice screens call openInspector with a founder key.
    - `pnpm --filter dispatch-control build` exits 0; `pnpm --filter dispatch-control test` stays green.
  </acceptance_criteria>
  <done>One onInspect prop threads through the shared galley chain; draft + voice both open the inspector on the section's founder artifact.</done>
</task>

<task type="auto">
  <name>Task 2: Supply ClaimProvenanceCard's onInspect callback in the Fact Check stage</name>
  <read_first>
    - apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx lines ~120-135 (the ClaimCardActions.onInspect prop) and ~440-458 (the disabled-when-absent Inspect button) — DO NOT modify this file (D-09 ban on forking); it already exposes onInspect
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx (where ClaimProvenanceCard is mounted; find the claim row's id and runId in scope, and the `actions={...}` object passed to the card)
    - docs/API_CONTRACTS.md §44.1 (the claim artifact key: locator = claimId)
  </read_first>
  <action>
    In `FactCheckScreen.tsx`, get `const { openInspector } = useInspector()` and add `onInspect: () => openInspector({ type: 'claim', runId, locator: claimId })` to the `actions` object already passed into `ClaimProvenanceCard` for the selected claim (use the claim row's id as `locator` and the run's id as `runId`, both already in scope on the Fact Check screen). This flips the card's existing Inspect button from disabled to live with zero changes to ClaimProvenanceCard itself. If FactCheckScreen is not a client component, ensure it (or the sub-component rendering the card) is `'use client'` so `useInspector()` is usable.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm build && pnpm test</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "openInspector({ type: 'claim'" apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx` (or the sub-component it delegates the card to) exits 0.
    - `ClaimProvenanceCard.tsx` is unchanged by this plan (`git diff --name-only` does NOT list it).
    - `pnpm --filter dispatch-control build` exits 0; `pnpm --filter dispatch-control test` stays green.
  </acceptance_criteria>
  <done>The Fact Check claim's existing Inspect button now opens the inspector on the claim artifact, without forking the provenance card.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control build` and `pnpm --filter dispatch-control test` both pass.
- Draft, voice, and fact-check entry points all call `useInspector().openInspector` with the correct artifact key type.
- `ClaimProvenanceCard.tsx` is not forked.
</verification>

<success_criteria>
- Three of the six entry points (draft passage, voice finding, fact-check claim) open the one shared inspector on the correct artifact — the draft+voice pair via one shared galley prop, the claim via the card's pre-existing onInspect.
</success_criteria>

<output>
After completion, create `.planning/phases/44-inspect-how-this-was-made/44-07-SUMMARY.md`.
</output>
