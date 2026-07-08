---
phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
plan: 06
type: execute
wave: 2
depends_on: [01]
files_modified:
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx
  - apps/dispatch-control/__tests__/DecisionRail.test.tsx
autonomous: true
requirements: [PRV-04]
must_haves:
  truths:
    - "The decision rail shows a source index: unsourced claims grouped and pinned on top with jump links, sourced claims grouped by section (galley reading order) below, each showing its source"
    - "Every source-index row has a check/skip control writing claimChecks:setStatus and a jump link to its galley section span"
    - "The Phase 34 facts-cleared prerequisite is untouched — the index reads the same claim_checks checked/skipped state; checking a claim never revokes sign-offs (D-12)"
    - "Legacy claim_checks rows (no claimId/sectionName) render as unsourced with no jump target, never crash and never hidden"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx"
      provides: "unsourced-on-top + sourced-by-section source index with check/skip + jump links"
      contains: "setStatus"
  key_links:
    - from: "claim_checks (useQuery listByRunId)"
      to: "SourceIndex rows"
      via: "claimId presence → sourced/unsourced grouping"
      pattern: "listByRunId"
    - from: "SourceIndex check/skip"
      to: "claim_checks status (same table the facts-cleared gate reads)"
      via: "useMutation(api.claimChecks.setStatus)"
      pattern: "setStatus"
---

<objective>
Upgrade the decision rail's Verification block into the source index (PRV-04, D-13/D-14): one surface merging the checklist and the source list. Unsourced claims pin on top (grouped, with jump links); sourced claims group by section in galley reading order, each showing its source. Every row carries a check/skip control (the same `claimChecks:setStatus` the galley popover uses) and a jump link to its galley span. The Phase 26 `ClaimsChecklist.tsx` stays byte-functional as the fallback; the Phase 34 facts-cleared gate contract is unchanged (D-12).

Purpose: checking claims stays fast (source one click away) while every claim — sourced or not — still requires a human check/skip.
Output: a `SourceIndex` component mounted in the rail's Verification section.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-CONTEXT.md
@.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-RESEARCH.md
@docs/design/dispatch-control-v2/README.md

<interfaces>
<!-- DecisionRail.tsx already: useQuery(api.claimChecks.listByRunId, { runId }); Verification section
     renders "done/total claims checked" + "checked Nm ago". Keep that summary; ADD the source index below it. -->
<!-- claim_checks row (Plan 01): {claimIndex, text, status, checkedAt?, claimId?, sourceUrl?, retrievedAt?, sectionName?, blockIndexHint?} -->
<!-- claimId present => sourced; absent => unsourced. -->
<!-- Jump pattern (DecisionRail.galleyAnchorFor + existing jumpToFinding): scrollIntoView('galley-<galleyId>'). -->
<!-- setStatus: useMutation(api.claimChecks.setStatus)({ runId, claimIndex, status: 'checked'|'skipped'|'pending' }) -->
<!-- Pitfall 10: checking a claim does NOT revoke sign-offs (setStatus is a Convex mutation, not in the FastAPI revoke list). Nothing to change; do NOT route it through a pipeline endpoint. -->
<!-- Design tokens: --color-marigold #f2b01e (sourced), --color-vermilion #e8471d (unsourced), --color-marigold-text #9a6f04. Reuse DecisionRail's MICRO_LABEL + button classNames. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED tests — unsourced-on-top grouping, sourced-by-section, jump links, legacy safety</name>
  <files>apps/dispatch-control/__tests__/DecisionRail.test.tsx</files>
  <read_first>
    - apps/dispatch-control/__tests__/DecisionRail.test.tsx (existing rail test fixtures + useQuery/useMutation mocking)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx (Verification section L327-354)
  </read_first>
  <behavior>
    - Given claim_checks rows mixing sourced (claimId set, sectionName='caseStudy') and unsourced (no claimId, sectionName='originStory'), the source index renders the unsourced group ABOVE the sourced group.
    - Sourced rows are grouped by section in galley reading order (originStory, problemStatement, founderBio, caseStudy, bonus) and each shows its sourceUrl.
    - Each row exposes a check/skip control; clicking calls claimChecks.setStatus with the row's claimIndex.
    - A legacy row (no claimId, no sectionName) renders in the unsourced group with no jump link and does not crash.
  </behavior>
  <action>
    Extend apps/dispatch-control/__tests__/DecisionRail.test.tsx with the four behaviors above (mock useQuery(api.claimChecks.listByRunId) with mixed sourced/unsourced/legacy fixture rows; mock useMutation). RED now.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/apps/dispatch-control && npx vitest run __tests__/DecisionRail.test.tsx; test $? -ne 0 && echo "RED-as-expected"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "sourced\|unsourced\|sourceUrl\|SourceIndex" apps/dispatch-control/__tests__/DecisionRail.test.tsx` matches
    - `grep -n "legacy\|claimId" apps/dispatch-control/__tests__/DecisionRail.test.tsx` shows the legacy-safety assertion
    - DecisionRail.test.tsx FAILS now (RED gate)
  </acceptance_criteria>
  <done>RED tests encode unsourced-on-top, sourced-by-section, per-row check/skip, and legacy-row safety.</done>
</task>

<task type="auto">
  <name>Task 2: SourceIndex component + mount in the rail's Verification section</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx, DecisionRail.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx (full — Verification section, galleyAnchorFor, MICRO_LABEL, button classNames)
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/ClaimsChecklist.tsx (the legacy fallback — confirm it stays byte-functional; do NOT edit it)
  </read_first>
  <action>
    1. Create SourceIndex.tsx ('use client') taking `{ runId: string }`:
       - `const rows = (useQuery(api.claimChecks.listByRunId, { runId }) as ClaimCheckRow[] | undefined) ?? []` (ClaimCheckRow: {claimIndex, text, status, claimId?, sourceUrl?, retrievedAt?, sectionName?}).
       - Partition: `unsourced = rows.filter(r => !r.claimId)`, `sourced = rows.filter(r => !!r.claimId)`.
       - Render the unsourced group FIRST (header "Unsourced" in MICRO_LABEL), then sourced grouped by sectionName in the fixed galley order `['originStory','problemStatement','founderBio','caseStudy','bonus']` (D-14), each group headed by its section label, each sourced row showing its sourceUrl as an "Open source" link (target=_blank rel="noopener noreferrer").
       - Each row renders: claim `text`, a state pill (pending/checked/skipped), a check/skip control calling `const setStatus = useMutation(api.claimChecks.setStatus)` → `setStatus({ runId, claimIndex: row.claimIndex, status })`, and a jump link that `document.getElementById('galley-' + row.sectionName)?.scrollIntoView({behavior:'smooth', block:'start'})`. A row with no sectionName renders WITHOUT a jump link (legacy safety — the row still shows; never hidden). All interactive targets ≥44px (reuse the rail's existing min-h-[44px] button classes). Color the unsourced header/pill with `--color-vermilion`, the sourced source link with `--color-marigold-text` (AA-safe on the light rail).
       - Add a `galleyAnchorId(sectionName)` mapping identical to the galley DOM ids in Galley.tsx (originStory/problemStatement/founderBio/caseStudy/bonus render `galley-<id>`); unknown/absent → no anchor.
    2. In DecisionRail.tsx, inside the existing `<section aria-label="Verification">` (after the "done/total claims checked" summary block, ~L336-353), mount `<SourceIndex runId={runId} />`. Keep the existing summary line + "checked Nm ago" affirmative state unchanged. Do NOT touch the Sign-offs section or the Publish gate (D-12 — facts-cleared reads the same claim_checks state; nothing changes).
    3. Run the strict build (memory rule: vitest does not type-check).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/apps/dispatch-control && npx vitest run __tests__/DecisionRail.test.tsx && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `test -f "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx"` is true
    - `grep -n "api.claimChecks.setStatus\|listByRunId" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx"` matches
    - `grep -n "originStory.*problemStatement.*founderBio.*caseStudy\|'originStory'" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx"` shows the fixed galley-order grouping (D-14)
    - `grep -n "SourceIndex" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx"` shows it mounted in the Verification section
    - DecisionRail.tsx Sign-offs section + Publish gate are unchanged (diff shows no edits outside the Verification section)
    - `npx vitest run __tests__/DecisionRail.test.tsx` passes; `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>SourceIndex renders unsourced-on-top + sourced-by-section with per-row check/skip + jump links + Open-source links; mounted in the rail's Verification section; facts-cleared gate untouched; vitest + strict build green.</done>
</task>

</tasks>

<verification>
- `cd apps/dispatch-control && npx vitest run __tests__/DecisionRail.test.tsx` passes.
- `pnpm --filter dispatch-control build` exits 0 (strict type-check).
- The Phase 34 sign-off / publish-gate tests stay green (SourceIndex only reads claim_checks + writes setStatus; D-12 non-interaction).
</verification>

<success_criteria>
PRV-04 satisfied: the rail's source index groups unsourced-on-top + sourced-by-section with sources, check/skip controls, and jump links; the source-bound checklist replaces the plain list while the facts-cleared gate contract is untouched.
</success_criteria>

<output>
After completion, create `.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-06-SUMMARY.md`
</output>
