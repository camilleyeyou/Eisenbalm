---
phase: 42-fact-check-stage
plan: 06
type: execute
wave: 4
depends_on: ["42-04", "42-05"]
files_modified:
  - apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx
  - apps/dispatch-control/lib/factCheckClient.ts
  - apps/dispatch-control/lib/factCheckFilters.ts
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/page.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPlaceholder.tsx
  - apps/dispatch-control/__tests__/ClaimProvenanceCard.test.tsx
  - apps/dispatch-control/__tests__/factCheckFilters.test.ts
autonomous: true
requirements: [FCT-02, FCT-03, FCT-04, FCT-05, FCT-06]

must_haves:
  truths:
    - "Stage 3 shows an affirmative summary (claims checked X of Y, must fix, conflicting sources, checks not run, changed since check, last verified) where every counter renders even at zero — blank never means verified"
    - "Operator can filter the claim table by must fix / unchecked / changed / numbers & dates / people & titles / organization claims / weak source"
    - "Selecting a claim opens ONE shared ClaimProvenanceCard (text, importance, status, source+publisher, supporting passage, URL, retrieval date, agent, confidence) with Confirm / Edit claim / Replace source / Remove claim / Keep-as-written(+reason) / Ask agent for better evidence — the last returning a comparison card that applies source+rewrite together on confirm"
  artifacts:
    - path: "apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx"
      provides: "the shared 9-field provenance card + action-control slots structured for Phase 49 role-gating"
      exports: ["ClaimProvenanceCard"]
      min_lines: 60
    - path: "apps/dispatch-control/lib/factCheckClient.ts"
      provides: "typed callers for the pipeline claim-action + evidence endpoints (mirrors findingsClient.ts)"
      exports: ["keepClaim", "patchClaim", "replaceSource", "removeClaim", "evidencePreview", "evidenceApply"]
    - path: "apps/dispatch-control/lib/factCheckFilters.ts"
      provides: "the 7 client-side filter predicates incl. org/person + weak-source heuristics"
      exports: ["FACT_CHECK_FILTERS", "applyFilters"]
    - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx"
      provides: "the real Stage 3 screen (summary + filters + table + card publish + action wiring)"
      exports: ["default"]
      min_lines: 120
  key_links:
    - from: "FactCheckScreen action handlers"
      to: "factCheckClient.ts endpoints + claimChecks:setStatus (Confirm)"
      via: "Clerk-token pipeline calls for content-touching actions; direct Convex mutation for Confirm"
      pattern: "evidenceApply|setStatus"
    - from: "FactCheckScreen claim selection"
      to: "WorkspaceStateProvider setPanelContent"
      via: "publishing the ClaimProvenanceCard into the single persistent context panel (Phase 41 D-19)"
      pattern: "setPanelContent"
---

<objective>
Replace the Phase 41 Stage-3 placeholder with the real Fact Check workspace: the affirmative summary (FCT-02), the 7-filter claim table (FCT-03), the ONE shared provenance card (FCT-04) consumed on selection, the six actions (FCT-05), and the "Ask agent for better evidence" comparison flow (FCT-06). This is the phase's headline deliverable and the load-bearing demo leg.

Purpose: This is where the Researcher's importance, the derived summary, the six endpoints, and the reset-on-edit machinery become a usable editorial surface. The provenance card is built ONCE here and reused in Draft/Approval in Plan 42-07 (D-09 forbids forking).
Output: ClaimProvenanceCard.tsx, factCheckClient.ts, factCheckFilters.ts, FactCheckScreen.tsx, page.tsx swap, placeholder deleted.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/42-fact-check-stage/42-CONTEXT.md
@.planning/phases/42-fact-check-stage/42-RESEARCH.md
@docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md
@docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md

<interfaces>
<!-- Verified from the current repo tree. -->

page.tsx TODAY mounts: <FactCheckPanelPublisher/> + <FactCheckPlaceholder runId={run.runId}/>.
FactCheckPanelContent.tsx exports buildFactCheckPanelContent(claimRows) + default FactCheckPanelPublisher (publishes into the panel via setPanelContent). KEEP the publisher pattern; the "coming soon" placeholder is what goes away.
FactCheckPlaceholder.tsx — its never-blank coverage ladder + status vocabulary (Pending/Checked/Skipped) carry forward VERBATIM into the real screen; then delete the file.

lib/derivedState.ts (Plan 42-05): deriveFactCheckSummary(rows), isMustFix(row).
lib/galley/sectionIdMap.ts: galleyIdToQaSection(galleyId) -> qa/module key ('problemStatement'->'problem', etc.) — reuse for the `agent` label (title-case + " Writer"); sectionName absent => agent "—".
components/galley/ClaimMark.tsx — the current claim popover ("Open source", Mark checked/Skip via claimChecks:setStatus). The card supersedes this content in Plan 42-07.
lib/findingsClient.ts / lib/voicePassClient.ts — the client shape to mirror (getToken() from useAuth, POST to NEXT_PUBLIC_PIPELINE_URL + /issues/{runId}/... with Bearer token).
getDraft(runId, token) — the draft-read helper ReviewDeskRunView uses to obtain a current draft + its revision id (the ifRevisionID source for content-touching applies); FactCheckScreen calls it the same way.
Convex: useMutation(api.claimChecks.setStatus) for Confirm (operator-guarded, direct); useQuery(api.claimChecks.listByRunId,{runId}) returns FULL rows incl. claimType + context.
claimType vocabulary on rows today: "number" | "date" | "proper_noun" (D-13: derive person/org split client-side; do NOT expand stored vocabulary).
Per-claim chip vocabulary (D-08, authoritative — supersedes Annotations "State model", 42-RESEARCH Pitfall 7): ✓ Checked / ✕ Must fix / Unchecked / Review recommended / Changed. Every state = label + icon, never color alone (D-23).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: ClaimProvenanceCard.tsx (shared 9-field card + action slots) + factCheckClient.ts</name>
  <files>apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx, apps/dispatch-control/lib/factCheckClient.ts, apps/dispatch-control/__tests__/ClaimProvenanceCard.test.tsx</files>
  <read_first>
    - docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md §5 (the claim shape + the six actions), §6 (role gating — structure controls so Phase 49 can wrap them locked; do NOT hide)
    - .planning/phases/42-fact-check-stage/42-RESEARCH.md (§42.6 field sourcing lines 468-473; Pattern 5 agent derivation lines 238-246; D-10 confidence "—")
    - apps/dispatch-control/lib/galley/sectionIdMap.ts (galleyIdToQaSection for the agent label)
    - apps/dispatch-control/lib/findingsClient.ts AND apps/dispatch-control/lib/voicePassClient.ts (the client fetch shape to mirror: useAuth getToken, Bearer, NEXT_PUBLIC_PIPELINE_URL base)
    - apps/dispatch-control/components/galley/ClaimMark.tsx (the popover content the card supersedes — match its "Open source" + status affordances)
  </read_first>
  <behavior>
    - The card renders all 9 fields; a row with no sourceUrl renders "Unsourced" (not blank), confidence renders "—" (never blank), a legacy row with importance undefined renders "Supporting" (never blank), agent absent renders "—".
    - sourcePublisher is derived from the sourceUrl host (e.g. "https://www.postandcourier.com/x" => "Post and Courier" or the bare host — a pure function, tested).
    - agent is derived from sectionName via galleyIdToQaSection + a label map; an unknown/absent sectionName => "—".
    - The status chip uses the D-08 label+icon vocabulary (label text present for every state; never color-only).
    - All six action controls render for the editor (Confirm, Edit claim, Replace source, Ask agent for better evidence, Remove claim, Keep as written) plus Open source + Inspect — each is an isolated control the parent can later wrap (Phase 49); none are hidden.
  </behavior>
  <action>
Create components/provenance/ClaimProvenanceCard.tsx as a presentational client component:
  - Props: `{ claim: ClaimProvenanceView; actions?: ClaimCardActions; busy?: boolean }` where ClaimProvenanceView = `{ text; importance?; status; sourceUrl?; supportingPassage?; retrievedAt?; sectionName?; confidence?: number }` and ClaimCardActions holds optional callbacks: onConfirm, onEdit, onReplaceSource, onAskAgent, onRemove, onKeep, onOpenSource, onInspect.
  - Derive sourcePublisher from sourceUrl host and agent from sectionName (galleyIdToQaSection + a 5-entry label map: problem->"Problem Writer", origin_story->"Origin Story Writer", founder_bio->"Founder Bio Writer", case_study->"Case Study Writer", bonus->"Bonus Writer"; else "—"). Export these two as pure helpers (`deriveSourcePublisher`, `deriveClaimAgent`) so they are unit-testable AND reusable by Plan 42-07's ClaimMark/SourceIndex.
  - Render the 9 fields with the D-08 status chip (label + icon) and D-23 (never color alone). Render the action controls as discrete buttons wired to the optional callbacks; structure each so a Phase 49 wrapper can replace it with a locked-with-explanation render (e.g. a small `<CardAction>` slot per action). Do NOT hide any control.
Create lib/factCheckClient.ts mirroring findingsClient.ts/voicePassClient.ts (token passed in, as the other clients accept): export async `keepClaim(runId, claimIndex, reason, token)`, `patchClaim(runId, claimIndex, body, token)`, `replaceSource(runId, claimIndex, {sourceUrl, retrievedAt?}, token)`, `removeClaim(runId, claimIndex, reason, token)`, `evidencePreview(runId, claimIndex, token)`, `evidenceApply(runId, claimIndex, body, token)` — each fetches `${NEXT_PUBLIC_PIPELINE_URL}/issues/{runId}/claims/{claimIndex}/...` with the Bearer token and returns the parsed JSON, matching the §42.4 paths/bodies. This client has NO Sanity import (EDT-05).
Write __tests__/ClaimProvenanceCard.test.tsx (jsdom/testing-library) asserting the <behavior> list, especially the never-blank guarantees and the deriveSourcePublisher/deriveClaimAgent pure functions.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- __tests__/ClaimProvenanceCard.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export function ClaimProvenanceCard\|export const ClaimProvenanceCard\|export default function ClaimProvenanceCard" apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx` matches
    - ClaimProvenanceCard.tsx contains `deriveSourcePublisher` and `deriveClaimAgent` (exported for 42-07 reuse)
    - `grep -nE "export (async function|function|const) (keepClaim|patchClaim|replaceSource|removeClaim|evidencePreview|evidenceApply)" apps/dispatch-control/lib/factCheckClient.ts` shows all six
    - `grep -c "@sanity\|sanityClient\|next-sanity" apps/dispatch-control/lib/factCheckClient.ts` returns 0 (no direct Sanity path)
    - `pnpm --filter dispatch-control test:unit -- __tests__/ClaimProvenanceCard.test.tsx` exits 0
  </acceptance_criteria>
  <done>One shared provenance card renders all 9 fields honestly with all six actions as isolated controls; the pipeline-endpoint client exists with no Sanity path; the field-sourcing helpers are exported for Plan 42-07's Draft/Approval reuse.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: factCheckFilters.ts — the 7 client-side filter predicates (FCT-03)</name>
  <files>apps/dispatch-control/lib/factCheckFilters.ts, apps/dispatch-control/__tests__/factCheckFilters.test.ts</files>
  <read_first>
    - .planning/phases/42-fact-check-stage/42-CONTEXT.md (D-12 the 7 filters; D-13 the org/person + weak-source heuristics — documented defaults, refinement is discretion)
    - apps/dispatch-control/lib/derivedState.ts (isMustFix — reuse for the "must fix" filter; do NOT reimplement severity)
    - .planning/phases/42-fact-check-stage/42-RESEARCH.md (D-13 discussion lines 30-31: org-suffix split; weak-source = unsourced OR low-authority)
  </read_first>
  <behavior>
    - must fix: isMustFix(row) === true.
    - unchecked: row.status === 'pending'.
    - changed: row.changedSinceCheck === true.
    - numbers & dates: row.claimType === 'number' || row.claimType === 'date'.
    - people & titles: row.claimType === 'proper_noun' && NOT org-suffix (no Trust/Foundation/Society/Inc/LLC/Institute/Association/Fund in text).
    - organization claims: row.claimType === 'proper_noun' && org-suffix present.
    - weak source: !row.sourceUrl OR (sourceUrl present but host has no resolvable publisher / low-authority TLD per a documented small heuristic).
    - applyFilters(rows, activeFilterIds): multi-select OR-within/AND-across is the documented default — pick one and document it; a claim matching any active filter (OR union) is the recommended UX; assert whichever is chosen.
    - A 'removed'-status row is excluded from all filter result sets (tombstoned rows are not editable claims).
  </behavior>
  <action>
Create lib/factCheckFilters.ts exporting `FACT_CHECK_FILTERS` (an ordered array of `{ id, label, predicate }` for the 7 chips) and `applyFilters(rows, activeIds)`. The row type it operates on carries `claimType` and `context` (present on the FULL claim_checks rows FactCheckScreen subscribes to). Import `isMustFix` from derivedState.ts for the must-fix predicate (single source of truth). Implement the org-suffix regex and the weak-source heuristic as small documented pure helpers (`isOrgClaim`, `isWeakSource`) with a code comment citing D-13 (heuristic, refinement deferred; do not expand stored claimType vocabulary). Filter out `status === 'removed'` rows at the top of applyFilters. Document the multi-select semantics (OR union recommended) in a header comment.
Write __tests__/factCheckFilters.test.ts covering every predicate in the <behavior> list plus a mixed fixture exercising applyFilters with 2+ active chips.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- __tests__/factCheckFilters.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "export (const FACT_CHECK_FILTERS|function applyFilters)" apps/dispatch-control/lib/factCheckFilters.ts` shows both
    - factCheckFilters.ts imports `isMustFix` from `../lib/derivedState` or `./derivedState` (reuse, not reimplement)
    - factCheckFilters.ts contains an org-suffix pattern including `Foundation` and `Trust`
    - `pnpm --filter dispatch-control test:unit -- __tests__/factCheckFilters.test.ts` exits 0
  </acceptance_criteria>
  <done>All 7 filters are pure client-side predicates over the loaded claim list (no new Convex query), reusing isMustFix, with documented org/person + weak-source heuristics and removed-row exclusion.</done>
</task>

<task type="auto">
  <name>Task 3: FactCheckScreen.tsx (summary + filters + table + card + actions) + page.tsx swap + delete placeholder</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx, apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/page.tsx, apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPlaceholder.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/page.tsx (the current mount: FactCheckPanelPublisher + FactCheckPlaceholder(runId))
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPlaceholder.tsx (the never-blank coverage ladder + status vocabulary to carry forward, then delete)
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPanelContent.tsx (setPanelContent publish pattern to reuse for pushing the card into the context panel)
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx (useWorkspaceState: setPanelContent, runId — NOTE: its claimRows are the LEAN projection without claimType/context; FactCheckScreen must NOT rely on them for filters/passage)
    - the ReviewDeskRunView reloadDraft/getDraft pattern (getDraft(runId, token) → current draft + revisionId — the ifRevisionID source)
    - apps/dispatch-control/lib/derivedState.ts (deriveFactCheckSummary), lib/factCheckFilters.ts (Task 2), components/provenance/ClaimProvenanceCard.tsx (Task 1), lib/factCheckClient.ts (Task 1)
  </read_first>
  <action>
Create FactCheckScreen.tsx ('use client'), taking `{ runId }`. It:
1. Subscribes to the FULL claim rows via `useQuery(api.claimChecks.listByRunId, { runId })` (checker Warning 2 — MANDATED; do NOT read the provider's lean claimRows, which lack `claimType`/`context` needed by the filters and the card's supporting passage). Handle undefined (loading) and empty ([]) explicitly.
2. Renders the affirmative summary from `deriveFactCheckSummary(rows)` — every counter (checked X of Y, must fix, conflicting sources, checks not run, changed since check, last verified) rendered even at zero, carrying forward FactCheckPlaceholder's never-blank ladder (D-08). Loading and empty states are explicit, never a fake verified state.
3. Renders the filter chips from FACT_CHECK_FILTERS with multi-select state and pipes rows through applyFilters.
4. Renders the filtered claim table; each row shows the D-08 status chip (label+icon) + claim text + importance + source presence. Selecting a row sets local selectedClaimIndex AND publishes `<ClaimProvenanceCard claim={{text,importance,status,sourceUrl,supportingPassage:row.context,retrievedAt,sectionName,confidence}} actions={...}/>` into the context panel via `useWorkspaceState().setPanelContent` (mirror FactCheckPanelPublisher's useEffect publish + cleanup).
5. Wires the six actions to the card's callbacks; obtain the Clerk token via `useAuth().getToken()`:
   - Confirm => useMutation(api.claimChecks.setStatus)({runId, claimIndex, status:'checked'}) (direct Convex).
   - Keep as written => require a reason input (reject empty client-side) then factCheckClient.keepClaim(runId, claimIndex, reason, token).
   - Edit claim => factCheckClient.patchClaim (obtain a fresh ifRevisionID first — see below).
   - Replace source => factCheckClient.replaceSource.
   - Remove claim => factCheckClient.removeClaim.
   - Ask agent for better evidence => factCheckClient.evidencePreview -> render a comparison card (as-written claim + source vs proposed rewrittenClaim + new source/publisher) -> on Confirm replacement call factCheckClient.evidenceApply.
6. ifRevisionID source (checker Warning 3): `useWorkspaceState()` does NOT expose draft/revisionId. For any content-touching apply (Edit claim with text, evidence/apply), FactCheckScreen obtains a CURRENT `ifRevisionID` by calling `getDraft(runId, token)` itself (mirroring ReviewDeskRunView's reloadDraft) immediately before the apply, and passes the returned revision id as `ifRevisionID`. Do NOT read a non-existent `revisionId` off the workspace value.
7. Because all four surfaces read derived selectors (D-16), NO explicit cross-surface update wiring is needed — Convex reactivity propagates each mutation to counters/My Tasks/Approval/header.

In page.tsx: replace `import FactCheckPlaceholder from './FactCheckPlaceholder'` + `<FactCheckPlaceholder runId={run.runId}/>` with `import FactCheckScreen from './FactCheckScreen'` + `<FactCheckScreen runId={run.runId}/>`. Keep `<FactCheckPanelPublisher/>` as the default panel content when no claim is selected (the screen overrides it on selection, restores it on deselect/cleanup).
Delete FactCheckPlaceholder.tsx.
Note: FactCheckPlaceholder.test.tsx currently tests the deleted component — update/rename it to target FactCheckScreen's never-blank summary (or delete it and add a FactCheckScreen never-blank assertion) so the suite stays green.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `test -f apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx` succeeds
    - `test ! -f apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPlaceholder.tsx` succeeds (deleted)
    - `grep -n "FactCheckScreen" apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/page.tsx` matches; `grep -c "FactCheckPlaceholder" apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/page.tsx` returns 0
    - FactCheckScreen.tsx references `listByRunId` (full-row useQuery — not the provider's lean claimRows), `deriveFactCheckSummary`, `applyFilters`, `ClaimProvenanceCard`, `setPanelContent`, `getDraft`, and `evidenceApply`
    - `pnpm --filter dispatch-control test:unit` exits 0 (no lingering FactCheckPlaceholder test failure)
    - `pnpm --filter dispatch-control build` exits 0 (strict type-check)
  </acceptance_criteria>
  <done>Stage 3 is live: affirmative summary, 7 filters over full rows, the shared card on selection (fed context as supporting passage), and all six actions wired to the correct write boundary with a freshly-fetched ifRevisionID; the placeholder is gone; the strict build is clean.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test:unit` green (incl. new card + filter tests, and no dead placeholder test).
- `pnpm --filter dispatch-control build` exits 0 (project memory: vitest does not type-check).
- `dispatch-control-no-sanity-write.test.ts` still green (factCheckClient.ts + ClaimProvenanceCard.tsx introduce no direct Sanity write) — asserted in Plan 42-08's gate.
</verification>

<success_criteria>
FCT-02/03/04/05/06 land as a usable Stage 3 surface: the affirmative summary, the 7-filter table over full rows, the ONE shared provenance card on selection, the six actions at their correct boundaries with a real ifRevisionID, and the two-step evidence comparison → atomic apply. The load-bearing demo leg (My Tasks → claim detail → Ask agent for better evidence → Confirm) is exercisable.
</success_criteria>

<output>
After completion, create `.planning/phases/42-fact-check-stage/42-06-SUMMARY.md`.
</output>
