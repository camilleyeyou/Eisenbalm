---
phase: 41-issue-workspace-frame
plan: 08
type: execute
wave: 4
depends_on: [41-06, 41-03, 41-01]
files_modified:
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/page.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/review/page.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx
  - apps/dispatch-control/components/galley/Galley.tsx
  - apps/dispatch-control/__tests__/DraftNotGenerated.test.tsx
autonomous: true
requirements: [WSP-04, WSP-07]
must_haves:
  truths:
    - "Stage 2 (Draft) renders the galley in publication typography, minus the decision rail (rail moves to Stage 5)"
    - "Clicking an unchecked (rust-tinted) claim in Draft navigates to the Fact Check tab"
    - "A section absent from the draft renders an Editor's-note 'Not generated' block, never a blank"
    - "The old /review route redirects to /draft"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/page.tsx"
      provides: "issue-keyed Draft mount (renamed from review/)"
      contains: "ReviewDeskRunView"
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx"
      provides: "galley canvas minus header/advisory/DecisionRail + click-through wiring + not-generated blocks"
  key_links:
    - from: "ReviewDeskRunView <Galley onUnsourcedClaimClick>"
      to: "router.push(issueFactCheckHref(issueNumber))"
      via: "the 41-03 threaded callback, wired only in the Draft mount"
      pattern: "onUnsourcedClaimClick"
    - from: "Galley not-generated block"
      to: "absent draft.sections[id]"
      via: "Editor's-note placeholder instead of a skipped/blank section"
      pattern: "Not generated"
---

<objective>
Recompose Stage 2 (Draft) from the shipped galley (D-07/D-13): rename the `/review` wrapper to
`/draft`, strip `ReviewDeskRunView`'s standalone page chrome (its `<h1>Review Desk — Run …</h1>`
header + rerun advisory) and REMOVE its `DecisionRail` mount (the rail moves to Stage 5, D-13),
wire the 41-03 `onUnsourcedClaimClick` callback so an unchecked claim click routes to the Fact
Check tab (WSP-04/D-12), and add the WSP-07 "Not generated" Editor's-note block for sections
absent from the draft. Redirect the old `/review` URL to `/draft` (D-06).

Purpose: WSP-04 (checked=marigold+hover+focus already shipped in 41-03; here we deliver the
unchecked-click-through in the Draft context) and WSP-07 ("Not generated" is a first-class canvas
state, never a blank). Do NOT rewrite galley internals (milestone "DO NOT REBUILD").
Output: draft/page.tsx + review→draft redirect + edited ReviewDeskRunView + not-generated blocks + test.
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
<!-- ReviewDeskRunView.tsx (verified) — DEFAULT export `ReviewDeskRunView({ params: Promise<{runId}> })`.
     Page chrome to DELETE: the `<h1>Review Desk — Run {runId}</h1>` header + the rerun advisory <p> (lines ~361–370).
     DecisionRail mount to DELETE: the `{viewMode === 'galley' && (<div className="...lg:w-[336px]"><DecisionRail runId={runId} /></div>)}` block (lines ~488–492) + its import.
     It renders <Galley runId draft revisionId reloadDraft onEditSection showProvenance includeAxes={FACTUAL_AXES}/>.
     It has `draft: DraftResponse | null` from getDraft; sections live at draft.sections[id].blocks. -->
<!-- Galley.tsx (post-41-03) accepts optional `onUnsourcedClaimClick?: (claimIndex:number)=>void`. -->
<!-- 41-01 hrefs: issueFactCheckHref(n). -->
<!-- review/page.tsx (current) is the server wrapper mounting ReviewDeskRunView with params Promise. -->
<!-- EDITABLE_SECTIONS long-read ids: originStory, problemStatement, founderBio, caseStudy (+ bonus, game, podcast, deliberation). -->
<!-- _PlaceholderScreen.tsx = Editor's-note styling precedent for "Not generated". -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rename to /draft, strip chrome, remove rail, wire click-through (D-06/D-07/D-13/WSP-04)</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/page.tsx, apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/review/page.tsx, apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/review/page.tsx (the wrapper to relocate to draft/ + turn into a redirect)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx (full — the header, advisory, and DecisionRail mount to delete; the <Galley> mount to extend)
    - apps/dispatch-control/components/galley/Galley.tsx (the onUnsourcedClaimClick prop from 41-03)
    - apps/dispatch-control/lib/issueRouteResolver.ts (issueFactCheckHref, issueDraftHref, parseIssueNumber, issueHref)
    - .planning/phases/41-issue-workspace-frame/41-RESEARCH.md §Pattern 2 (extraction boundary: edit in place, no new inner component) + §Pattern 8 (click-through)
  </read_first>
  <action>
    1) Create `issues/[issueNumber]/draft/page.tsx`: copy the current `review/page.tsx` server-wrapper
       verbatim, BUT ALSO pass the issue number so the click-through can build the fact-check href.
       Simplest: `return <ReviewDeskRunView params={Promise.resolve({ runId: run.runId })} issueNumber={n} />`.
    2) Edit `ReviewDeskRunView.tsx`:
       - Add an optional prop `issueNumber?: number` to `ReviewDeskRunViewProps`.
       - DELETE the `<h1>Review Desk — Run {runId}</h1>` header + the rerun-advisory `<p>` (page chrome
         the frame now provides). Keep the `flex min-h-[70vh] flex-col gap-4` wrapper + the loading/error
         states + the chip nav + galley/edit/iframe bodies.
       - DELETE the `DecisionRail` mount block (the `lg:w-[336px]` aside) AND its import — the rail is
         Stage 5 now (D-13). Stage 2 no longer renders it.
       - Add `import { useRouter } from 'next/navigation'`; in the galley `<Galley ...>` mount pass
         `onUnsourcedClaimClick={(claimIndex) => { if (issueNumber != null) router.push(issueFactCheckHref(issueNumber)) }}`
         (unchecked-claim click → Fact Check tab, D-12). Leave every other `<Galley>` caller in the repo
         untouched (undefined callback = today's popover-only behavior).
    3) Rewrite `review/page.tsx` as a redirect: `redirect(issueDraftHref(n))` (parse issueNumber; on null
       redirect '/issues'). This is the D-06 legacy /review → /draft redirect.
  </action>
  <verify>
    <automated>grep -q "issueFactCheckHref" apps/dispatch-control/app/\(dashboard\)/review-desk/\[runId\]/ReviewDeskRunView.tsx && ! grep -q "DecisionRail" apps/dispatch-control/app/\(dashboard\)/review-desk/\[runId\]/ReviewDeskRunView.tsx && grep -q "issueDraftHref" "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/review/page.tsx" && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `draft/page.tsx` exists and mounts `ReviewDeskRunView` with `issueNumber={n}`
    - `ReviewDeskRunView.tsx` no longer contains `DecisionRail` (grep returns nothing) and no longer contains the "Review Desk — Run" header string
    - `ReviewDeskRunView.tsx` passes `onUnsourcedClaimClick` to `<Galley>` using `issueFactCheckHref` + `router.push`
    - `review/page.tsx` is a redirect to `issueDraftHref(n)` (grep `redirect` + `issueDraftHref`)
  </acceptance_criteria>
  <done>Stage 2 is the galley canvas (no rail, no page chrome) with unchecked-claim click-through to Fact Check; /review redirects to /draft.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: "Not generated" Editor's-note canvas block (WSP-07)</name>
  <files>apps/dispatch-control/components/galley/Galley.tsx, apps/dispatch-control/__tests__/DraftNotGenerated.test.tsx</files>
  <read_first>
    - apps/dispatch-control/components/galley/Galley.tsx (the LONG_READ_SECTIONS map — where a section with `section?.blocks` empty/absent is currently skipped or renders empty)
    - apps/dispatch-control/lib/derivedState.ts (`draftSectionIdsFromDraft` from 41-01 — the SHARED presence source the workspace outline uses; this canvas check must stay byte-identical to it)
    - apps/dispatch-control/components/_PlaceholderScreen.tsx (Editor's-note styling to reuse)
    - .planning/phases/41-issue-workspace-frame/41-CONTEXT.md D-21 (Not-generated: section-artifact absence → Editor's-note block, never a blank)
    - apps/dispatch-control/__tests__/AnnotationMark.test.tsx (galley component-test harness to copy)
  </read_first>
  <behavior>
    - Test: a long-read section whose `draft.sections[id]` is absent (no blocks) renders a visible
      Editor's-note "Not generated" block (e.g. "— The {label} has not been generated yet.") with the
      section anchor still present (so the outline jump still lands somewhere), NOT an empty/skipped section.
    - Test: a section WITH blocks renders its content normally (no Not-generated block).
  </behavior>
  <action>
    In Galley.tsx, for each long-read section (and the bonus section), when the section's blocks array
    is empty/absent (`(section?.blocks ?? []).length === 0`), render an Editor's-note "Not generated"
    block inside the section's `<section id="galley-{id}">` wrapper (so the anchor still exists for the
    outline jump) instead of rendering nothing. This `(section?.blocks ?? []).length === 0` presence rule
    is the SAME one `draftSectionIdsFromDraft` (41-01) encodes for the workspace outline — keep the two in
    LOCKSTEP so the canvas and the outline never disagree about which sections are generated (the 41-05
    provider derives the outline's presence from that shared helper over the SAME getDraft draft this
    canvas renders; if you change the presence rule here, change it in `draftSectionIdsFromDraft` too). Style per `_PlaceholderScreen` conventions; copy e.g.
    "— Not generated. The {Section Label} will appear here once the agents write it." Keep the game/
    podcast/deliberation sections as-is (they have their own render). WSP-07: the canvas is never a blank
    for a section that simply hasn't been generated.
    Create DraftNotGenerated.test.tsx (mock convex/react useQuery for qaCorrections/claimChecks → []):
    render <Galley> with a draft missing `founderBio` and assert the Not-generated block text renders
    inside `#galley-founderBio`; render with founderBio present and assert the block is absent.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- DraftNotGenerated.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "Not generated" apps/dispatch-control/components/galley/Galley.tsx` succeeds
    - an absent long-read section renders the Editor's-note block inside its `galley-{id}` anchor (test asserts)
    - a present section does NOT render the Not-generated block (test asserts)
    - `pnpm --filter dispatch-control test -- DraftNotGenerated.test.tsx` exits 0
  </acceptance_criteria>
  <done>Absent draft sections render a first-class "Not generated" Editor's-note block in the canvas, never a blank.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- DraftNotGenerated.test.tsx ClaimMark.test.tsx` green.
- Grep confirms rail removed from ReviewDeskRunView, click-through wired, /review→/draft redirect.
- `pnpm --filter dispatch-control build` compiles the Draft route (wave close).
</verification>

<success_criteria>
Stage 2 renders the galley in publication typography without the decision rail or page chrome;
unchecked claims are clickable through to Fact Check; absent sections render a "Not generated"
Editor's-note; /review redirects to /draft. No galley internals rewritten.
</success_criteria>

<output>
After completion, create `.planning/phases/41-issue-workspace-frame/41-08-SUMMARY.md`
</output>
