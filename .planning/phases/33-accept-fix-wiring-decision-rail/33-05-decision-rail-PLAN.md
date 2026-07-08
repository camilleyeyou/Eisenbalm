---
phase: 33-accept-fix-wiring-decision-rail
plan: 05
type: execute
wave: 4
depends_on: [33-01, 33-02, 33-03, 33-04]
files_modified:
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ResolvedFindingsList.tsx
  - apps/dispatch-control/__tests__/DecisionRail.test.tsx
  - apps/dispatch-control/__tests__/ResolvedFindingsList.test.tsx
autonomous: true
requirements: [GLY-04]

must_haves:
  truths:
    - "The rail leads with a blocker/warning count summary line and a Blocking-items checklist first"
    - "Publish is disabled with a reason when open error findings exist, and the four actions (Publish/Hold/Re-run section/Transcript) wire to existing backends"
    - "The rail shows the editor memo (from editor-final notes), a hook card (selected pitch), and a verification block with an affirmative timestamp state — never blank"
    - "The rail mounts as the design's 336px right column beside the galley"
    - "Resolved (accepted/dismissed) findings are reachable via a collapsed list with a Reopen button that returns them to the galley (D-04)"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx"
      provides: "blockers-first decision rail (336px, #f1f0ea)"
      contains: "DecisionRail"
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ResolvedFindingsList.tsx"
      provides: "collapsed resolved-findings list with Reopen affordance (D-04)"
      contains: "reopenFinding"
    - path: "apps/dispatch-control/__tests__/DecisionRail.test.tsx"
      provides: "GLY-04 coverage — ordering, publish gate, never-blank states"
      contains: "DecisionRail"
  key_links:
    - from: "apps/dispatch-control/.../DecisionRail.tsx"
      to: "apps/dispatch-control/lib/reviewClient.ts::publishIssue"
      via: "Publish action"
      pattern: "publishIssue"
    - from: "apps/dispatch-control/.../DecisionRail.tsx"
      to: "api.deliberationEvents.byRunIdAndType"
      via: "editor memo (eventType editor-final, key notes)"
      pattern: "editor-final"
    - from: "apps/dispatch-control/.../ResolvedFindingsList.tsx"
      to: "apps/dispatch-control/lib/findingsClient.ts::reopenFinding"
      via: "Reopen button"
      pattern: "reopenFinding"
---

<objective>
Build the blockers-first decision rail (GLY-04, D-10..D-17) and mount it as the design's 336px right column on the Review Desk. It leads with a count summary, lists blocking items first (unresolved error findings with jump links), shows the editor's memo, the hook card (selected pitch — D-12), and a verification block with an affirmative "checked Nm ago" state (D-13, never blank), then the four actions (Publish/Hold/Re-run section/Transcript — D-15) wired to existing backends. Publish is disabled with a reason while blockers remain (D-14 client half; the server half shipped in 33-03). A collapsed Resolved-findings list at the foot of the rail makes accepted/dismissed findings reachable again with a Reopen button (D-04) — the only operator surface where resolved findings are visible, since the galley hides them (D-03).

Purpose: The rail is the operator's "is anything unaccounted for" answer and the single place the publish decision happens; it is also the one place a resolved finding can be reopened.
Output: A new DecisionRail component, a ResolvedFindingsList sub-component (D-04 Reopen), a page mount + tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/33-accept-fix-wiring-decision-rail/33-CONTEXT.md
@.planning/phases/33-accept-fix-wiring-decision-rail/33-RESEARCH.md
@docs/API_CONTRACTS.md
@docs/design/dispatch-control-v2/README.md

<interfaces>
<!-- Verified data sources + action clients (all exist). -->
Convex queries (via useQuery(api.*)):
  api.qaCorrections.byRunId({runId})                       -> rows with severity/resolution (filter open via isOpenFinding)
  api.deliberationEvents.byRunIdAndType({runId, eventType:'editor-final'})  -> payload is a JSON STRING; JSON.parse(payload).notes  (key is `notes`, NOT editor_final_notes — §33.6)
  api.pitchLog.selectedByRunId({runId})                    -> {charityName, scoutSummary} | null   (NEW in 33-02)
  api.claimChecks.listByRunId({runId})                     -> rows with status + optional checkedAt (NEW in 33-02)
Action clients (existing):
  reviewClient.publishIssue(runId, token)     — POST /issues/{runId}/publish  (now 409 open_error_findings — 33-03)
  reviewClient.rejectIssue(runId, note, token) — Hold
  pipelineControlClient.rerollAgent(runId, agentKey, token) — POST /runs/{id}/agents/{key}/rerun; keys: origin_story/problem/founder_bio/case_study/game/bonus/design
  findingsClient.reopenFinding(runId, findingId, token) — POST /issues/{runId}/findings/{findingId}/reopen (NEW in 33-04; clears resolution, accepted=false)
  Transcript — scroll to the galley element id `galley-deliberation`
Shared helper: isOpenFinding from @/lib/galley/findingState (33-04). Resolved = the complement: `row.accepted === true || row.resolution != null`.
Design tokens (§Design tokens): rail 336px, bg #f1f0ea, vermilion #e8471d (blocking), marigold text-on-light #9a6f04 (warning), green #148a52 (verified), cobalt #253ad4 (interactive). Use the --color-* token system already in globals (do not hardcode hex where a token exists).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: DecisionRail component</name>
  <read_first>
    - docs/design/dispatch-control-v2/README.md §1 Review Desk + §Design tokens (rail spec: headline count, Blocking items checklist first, Editor's memo, Hook card, Verification block affirmative states, Actions; 336px, bg #f1f0ea)
    - apps/dispatch-control/lib/reviewClient.ts (publishIssue/rejectIssue signatures + ReviewApiError — how to surface the 409 open_error_findings reason)
    - apps/dispatch-control/lib/pipelineControlClient.ts (rerollAgent signature + agent keys)
    - apps/dispatch-control/lib/galley/findingState.ts (isOpenFinding — the rail must agree with the galley on "open")
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx (how useQuery/useAuth are used; galleyAnchorFor for jump links; the QaCorrectionRow shape)
    - convex/deliberationEvents.ts (byRunIdAndType — the editor-final memo source; payload is a JSON string)
    - .planning/phases/33-accept-fix-wiring-decision-rail/33-CONTEXT.md (D-10..D-17)
  </read_first>
  <behavior>
    - Renders a headline summary line: "{N} blocker(s) to clear · {M} warning(s)" (info folded into a muted tertiary count or omitted — discretion; do not inflate).
    - Blocking-items checklist FIRST: one row per open error-severity finding (isOpenFinding + severity==='error'), each a jump link that scrollIntoViews the finding's galley section anchor.
    - Publish button is disabled when blockers > 0, with a visible reason ("1 blocker to clear"); enabled when 0 blockers. On click (0 blockers) calls publishIssue; if the server still 409s open_error_findings, surface the message (belt-and-suspenders with D-14 server gate).
    - Editor memo: JSON.parse(payload).notes from the editor-final row; try/catch → "No editor memo for this run" when absent/malformed (never crash).
    - Hook card: selectedByRunId → charityName + scoutSummary; null → honest "No charity selected yet".
    - Verification block: "X/Y claims checked" (X = status !== 'pending'); "checked Nm ago" from max(checkedAt); claims===undefined → "Loading…"; total 0 → "No claims extracted yet"; rows without checkedAt → "not yet checked" — NEVER blank.
    - Actions row: Publish (gated), Hold (rejectIssue), Re-run section ▾ (rerollAgent — a select of agent keys), Transcript (scroll to #galley-deliberation).
  </behavior>
  <action>
Create `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` as a `'use client'` component. Props: `{ runId: string }` (it self-fetches via useQuery + useAuth().getToken(), matching page conventions). Compose the sections IN THIS ORDER per the design (D-17): (1) headline count line; (2) Blocking items checklist; (3) Editor's memo; (4) Hook card; (5) Verification block; (6) Actions row; (7) `<ResolvedFindingsList runId={runId} />` collapsed at the foot (D-04 — Task 2).

Data:
- Open findings: `useQuery(api.qaCorrections.byRunId, { runId })` filtered by `isOpenFinding`. `blockers = open.filter(f => f.severity === 'error')`; `warnings = open.filter(f => f.severity === 'warning').length`. Fold `info` into a muted count or omit (discretion — do not inflate the headline).
- Blocking checklist rows: for each blocker, render a jump `<button>` that does `document.getElementById(galleyAnchorFor(qaSectionToGalleyId(f.sectionName)) ?? '')?.scrollIntoView({behavior:'smooth', block:'start'})` (reuse the mapping helpers; import `qaSectionToGalleyId` from `@/lib/galley/sectionIdMap` and replicate `galleyAnchorFor` or import if exported).
- Editor memo: `const ef = useQuery(api.deliberationEvents.byRunIdAndType, { runId, eventType: 'editor-final' })`; parse `JSON.parse(ef?.payload).notes` inside try/catch; fallback copy on failure/absence. NOTE (§33.6): the key is `notes`, NOT `editor_final_notes`.
- Hook card: `const pitch = useQuery(api.pitchLog.selectedByRunId, { runId })`; render `pitch.charityName` + `pitch.scoutSummary`, else "No charity selected yet".
- Verification: `const claims = useQuery(api.claimChecks.listByRunId, { runId })`; `done = claims?.filter(c => c.status !== 'pending') ?? []`; `total = claims?.length ?? 0`; `lastChecked = Math.max(0, ...done.map(c => c.checkedAt ?? 0))`; render the never-blank ladder from the behavior block. Add a small "· {open QA count} open" affix per the design's "10/11 sourced · 1 open" affirmative pattern.
- Actions: Publish `<button disabled={blockers.length > 0}>` with the reason text beneath when disabled; onClick calls `publishIssue(runId, await getToken())`, catching `ReviewApiError` and surfacing `open_error_findings` message. Hold → `rejectIssue`. Re-run section → a `<select>` of the reroll agent keys + a trigger calling `rerollAgent`. Transcript → scroll to `#galley-deliberation`.

Style to the design tokens: the rail is a fixed 336px column with `bg` matching the design's `#f1f0ea` rail (use the existing `--color-rail` token if present in globals, else the raw token per the 1c system already wired in Phase 30 — check globals for a rail token first). Hard edges (no rounded corners), Space Grotesk micro-labels via the wired `--font-ui`. Keep every interactive target ≥44px.

Create `apps/dispatch-control/__tests__/DecisionRail.test.tsx` (jsdom) mocking `convex/react` useQuery + the action clients + `vi.mock('./ResolvedFindingsList')` (the sub-component is created in Task 2 — mock it here so this task's verify passes standalone): assert (a) blockers-first ordering (Blocking items appears before memo/hook/verification in the DOM), (b) Publish disabled with reason when an open error finding exists and enabled when none, (c) verification shows "checked Nm ago" when a checkedAt exists and "No claims extracted yet"/"not yet checked" in the empty/legacy cases (never blank), (d) editor memo reads `notes` and falls back gracefully when payload is malformed.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control test:unit __tests__/DecisionRail.test.tsx -- --run</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter dispatch-control test:unit __tests__/DecisionRail.test.tsx -- --run` exits 0
    - `grep -q "isOpenFinding" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` succeeds (rail agrees with galley on "open" — Pitfall 9)
    - `grep -q "editor-final" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` AND `grep -q "\.notes" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` succeed (§33.6 memo key)
    - `grep -q "selectedByRunId" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` succeeds (hook card = selected pitch, D-12)
    - `grep -q "checkedAt" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` succeeds (verification timestamp, D-13)
    - `grep -c "publishIssue\|rejectIssue\|rerollAgent" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` returns ≥ 3 (all four actions wired, D-15)
    - `grep -q "disabled" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` succeeds AND the test asserts a visible blocker reason (D-14 client)
    - `grep -q "ResolvedFindingsList" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` succeeds (D-04 list mounted at the rail foot)
    - DecisionRail.test.tsx asserts the Blocking-items block renders BEFORE the editor memo in the DOM (blockers-first, D-17)
  </acceptance_criteria>
  <done>DecisionRail renders blockers-first, gates Publish with a reason, wires all four actions to existing backends, shows memo/hook/verification with never-blank affirmative states, and mounts the resolved-findings list at its foot.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: ResolvedFindingsList — collapsed resolved findings + Reopen (D-04)</name>
  <read_first>
    - apps/dispatch-control/lib/findingsClient.ts (reopenFinding signature + FindingsError shape — from 33-04)
    - apps/dispatch-control/lib/galley/findingState.ts (isOpenFinding — Resolved is its complement)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx (QaCorrectionRow shape: findingId, severity, sectionName, reason, resolution, resolutionReason, accepted; useAuth().getToken() pattern)
    - .planning/phases/33-accept-fix-wiring-decision-rail/33-CONTEXT.md (D-03 galley hides resolved; D-04 reopen returns to open state + galley visibility, no text revert)
    - docs/design/dispatch-control-v2/README.md §Design tokens (muted/tertiary treatment for a collapsed secondary list)
  </read_first>
  <behavior>
    - Renders a collapsed (default-closed) disclosure labelled e.g. "Resolved ({K})" at the foot of the rail; K = count of findings where NOT isOpenFinding.
    - Expanded, it lists each resolved finding with its section + reason and a resolution badge ("accepted" vs "dismissed" — from `resolution`, falling back to `accepted===true` ⇒ accepted).
    - Each row has a Reopen `<button>` that calls `reopenFinding(runId, findingId, await getToken())`; on success the finding returns to open (Convex reactivity re-adds it to the galley + blockers — no manual refetch); on a `not_resolved` 409 (already open) it surfaces a small note and does not crash.
    - When K === 0, renders an honest "No resolved findings yet" line — never blank (affirmative-state rule).
    - This is the ONLY operator surface exposing resolved findings, since D-03 hides them from the galley — without it reopenFinding is unreachable (RESEARCH Open Question 2).
  </behavior>
  <action>
Create `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ResolvedFindingsList.tsx` as a `'use client'` component. Props: `{ runId: string }`. Self-fetch `const rows = useQuery(api.qaCorrections.byRunId, { runId })`; `const resolved = (rows ?? []).filter(r => !isOpenFinding(r))` (import `isOpenFinding` from `@/lib/galley/findingState`). Obtain the token via `useAuth().getToken()` (matching sibling client components). Render:
- A collapsed disclosure (a `useState(false)` open flag + a toggle `<button>` reading "Resolved ({resolved.length})"). This component is NOT inside a `<p>`, so normal block elements (`<div>`, `<ul>`) are fine — the phrasing-content constraint is only inside AnnotationMark.
- When open, map `resolved` to rows showing `sectionName`, truncated `reason`, a badge computed as `r.resolution ?? (r.accepted ? 'accepted' : 'dismissed')`, and a Reopen `<button>`.
- Reopen onClick: `try { await reopenFinding(runId, r.findingId, await getToken()) } catch (e) { /* FindingsError: if reason==='not_resolved' show an inline 'already open' note, else the message */ }`. Do NOT attempt any text revert (D-04) and do NOT refetch the draft — reopening only flips finding state; Convex reactivity re-adds it to the open surfaces.
- `resolved.length === 0` → an honest "No resolved findings yet" line (never blank). `rows === undefined` → "Loading…".
Style muted/tertiary per the design (this is a secondary, collapsed affordance — do not compete with the blockers checklist). Keep the Reopen target ≥44px.

Create `apps/dispatch-control/__tests__/ResolvedFindingsList.test.tsx` (jsdom) mocking `convex/react` useQuery, `@clerk/nextjs` useAuth, and `@/lib/findingsClient`: assert (a) the disclosure shows the resolved count and expands to list resolved findings, (b) clicking Reopen invokes `reopenFinding` with the runId + findingId, (c) an all-open dataset renders "No resolved findings yet" (never blank), (d) an accepted-vs-dismissed badge is derived correctly (including the legacy `accepted===true`, `resolution` absent case ⇒ "accepted").
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control test:unit __tests__/ResolvedFindingsList.test.tsx -- --run</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter dispatch-control test:unit __tests__/ResolvedFindingsList.test.tsx -- --run` exits 0
    - `grep -q "reopenFinding" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ResolvedFindingsList.tsx` succeeds (D-04 wired to the existing client fn — reopen is now operator-reachable, no dead code)
    - `grep -q "isOpenFinding" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ResolvedFindingsList.tsx` succeeds (Resolved = complement of open — agrees with the galley/rail)
    - `grep -q "No resolved findings yet" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ResolvedFindingsList.tsx` succeeds (never-blank empty state)
    - ResolvedFindingsList.test.tsx asserts a Reopen click calls `reopenFinding` with `runId` + a `findingId`
    - `grep -q "revert\|reload\|reloadDraft\|patchSection" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ResolvedFindingsList.tsx` returns NOTHING (D-04 — reopen never reverts text nor refetches the draft)
  </acceptance_criteria>
  <done>Resolved (accepted/dismissed) findings are reachable in a collapsed rail list; Reopen calls the existing reopenFinding client and returns findings to the galley via Convex reactivity, with no text revert and a never-blank empty state.</done>
</task>

<task type="auto">
  <name>Task 3: Mount the rail as the 336px right column</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx (the galley-mode layout at lines ~286-370: currently `chips (lg:w-64) | main`; the rail becomes a third column visible in galley mode)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx (Task 1)
    - docs/design/dispatch-control-v2/README.md §Design tokens (rail 336px)
  </read_first>
  <action>
In `page.tsx`, mount `<DecisionRail runId={runId} />` as a third column inside the galley-mode branch (visible when `viewMode === 'galley'`), to the RIGHT of the main galley column, using `lg:w-[336px] shrink-0` and the design's rail background. Keep the existing chips column (left) and galley (center); the rail is right. Do NOT render the rail in `edit` or `iframe` view modes (it belongs beside the galley per the design). Ensure the layout still collapses gracefully on mobile (stacked) — reuse the existing `flex-col lg:flex-row` pattern already in the page.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control typecheck && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "DecisionRail" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx` succeeds (rail mounted)
    - `grep -q "336px\|w-\[336px\]" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx` succeeds (design width)
    - The rail is scoped to galley mode: the `<DecisionRail` usage is within the `viewMode === 'galley'` branch (verify by reading the JSX — not rendered in edit/iframe)
    - `pnpm --filter dispatch-control typecheck` exits 0 AND `pnpm --filter dispatch-control build` exits 0 (strict — memory rule)
    - Full dashboard unit suite green: `pnpm --filter dispatch-control test:unit -- --run` exits 0 (no regression across Phase 32/31 tripwires)
  </acceptance_criteria>
  <done>The decision rail (with its resolved-findings list) renders as the 336px right column beside the galley in galley mode only; the dashboard type-checks, builds, and the full unit suite stays green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test:unit -- --run` green (incl. DecisionRail.test.tsx + ResolvedFindingsList.test.tsx + all prior tripwires).
- `pnpm --filter dispatch-control typecheck && pnpm --filter dispatch-control build` both exit 0.
- `__tests__/dispatch-control-no-sanity-write.test.ts` still green.
</verification>

<success_criteria>
- The Review Desk shows a blockers-first decision rail beside the galley: Publish is gated with a reason, all four actions work, the memo/hook/verification blocks always render an affirmative state, and resolved findings stay reachable with a working Reopen (no dead code).
</success_criteria>

<output>
After completion, create `.planning/phases/33-accept-fix-wiring-decision-rail/33-05-SUMMARY.md`
</output>
