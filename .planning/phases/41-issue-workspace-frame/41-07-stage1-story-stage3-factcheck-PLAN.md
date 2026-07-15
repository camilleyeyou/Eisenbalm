---
phase: 41-issue-workspace-frame
plan: 07
type: execute
wave: 4
depends_on: [41-06, 41-04, 41-01]
files_modified:
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/page.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/page.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPlaceholder.tsx
  - apps/dispatch-control/__tests__/FactCheckPlaceholder.test.tsx
  - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx
autonomous: true
requirements: [WSP-01, WSP-07]
must_haves:
  truths:
    - "Stage 1 (Story) mounts the Signal Desk candidate slate + Gate 1 adjudication scoped to THIS issue's run"
    - "Stage 3 (Fact Check) is a first-class placeholder that shows real claim coverage, never a blank or fake-verified state"
    - "Stage 4 (Voice) no longer renders its own standalone page header — the frame's Voice tab + status is the single chrome (D-07); the in-canvas tell count is preserved"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/page.tsx"
      provides: "issue-keyed Signal Desk mount (Stage 1)"
      contains: "SignalDeskScreen"
    - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/page.tsx"
      provides: "Stage 3 route mounting the placeholder"
    - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPlaceholder.tsx"
      provides: "read-only claim_checks coverage + 'arrives next' banner, never blank/fake-verified"
      contains: "claimChecks"
    - path: "apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx"
      provides: "Voice canvas with its standalone <h1>/description stripped (D-07); tell-count signal retained"
      contains: "tellCount"
  key_links:
    - from: "story/page.tsx"
      to: "SignalDeskScreen runId={run.runId}"
      via: "server-resolve issueNumber→runId then mount with the 41-04 runId prop"
      pattern: "SignalDeskScreen"
    - from: "FactCheckPlaceholder"
      to: "api.claimChecks.listByRunId"
      via: "read-only coverage summary (checked X of Y), never a fabricated verified state"
      pattern: "listByRunId"
---

<objective>
Mount the two simplest stage routes into the frame. Stage 1 (Story) is the net-new
issue-keyed Signal Desk (D-09/D-10): copy the review/voice server-wrapper pattern, resolve
issueNumber→runId, and mount `SignalDeskScreen` with the 41-04 `runId` prop so it shows THIS
issue's run (not runs.latest). Stage 3 (Fact Check) is a first-class placeholder (D-11/WSP-07):
compose the existing read-only `claim_checks` coverage into an honest "arrives next / here's
what's checked so far" surface — never a blank, never a fake "verified" state; the real stage
is Phase 42.

Also apply the D-07 chrome-stripping rule to Stage 4 (Voice): `VoicePassRunView` still renders its
own `<h1>Voice Pass — Run {runId}</h1>` + description, which duplicates the frame's Voice tab +
status mark once mounted at `/issues/[n]/voice`. Strip that standalone header (mirroring 41-08's
Stage-2 strip), keeping the in-canvas tell-count signal — no capability lost.

Purpose: WSP-01 SC-7 (a run interrupted at charity selection is resolvable from the Workspace),
WSP-07 (Stage 3 is never a blank), and WSP-01/D-07 (one frame chrome — Stage 4's duplicate header gone).
Output: story/page.tsx + fact-check/page.tsx + FactCheckPlaceholder + its test + the Stage-4 header strip.
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
<!-- The server-wrapper pattern to copy verbatim (voice/page.tsx): parseIssueNumber → redirect('/issues')
     on null; ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL).query(api.pipelineRuns.byIssueNumber,{issueNumber:n});
     redirect(issueHref(n)) if no run; `export const dynamic = 'force-dynamic'`. -->
<!-- SignalDeskScreen (post-41-04): props { workspace_id: string; runId?: string }. Pass BOTH
     workspace_id=DEFAULT_WORKSPACE_ID and runId=run.runId to scope to this issue's run. -->
<!-- claim_checks read (verified): api.claimChecks.listByRunId({runId}) → rows { claimIndex, text, status,
     checkedAt?, claimId?, sourceUrl?, retrievedAt?, sectionName? }. status 'pending' = unchecked.
     SourceIndex.tsx renders these read+action; DecisionRail's Verification block renders "checked X/Y /
     not yet checked / No claims extracted yet" (never blank). deriveFactCheckStage already computes the
     stage state from these rows. -->
<!-- _PlaceholderScreen.tsx = the "arrives next" styling precedent. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Stage 1 (Story) — issue-keyed Signal Desk mount (D-09/D-10)</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/page.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/page.tsx (the exact server-wrapper pattern to copy)
    - apps/dispatch-control/app/(dashboard)/signal-desk/_components/SignalDeskScreen.tsx (post-41-04 props { workspace_id, runId? })
    - apps/dispatch-control/lib/issueRouteResolver.ts (parseIssueNumber, issueHref)
    - apps/dispatch-control/lib/workspace.ts (DEFAULT_WORKSPACE_ID)
  </read_first>
  <action>
    Create `issues/[issueNumber]/story/page.tsx` copying the voice/page.tsx server-wrapper shape exactly:
      - `export const dynamic = 'force-dynamic'`.
      - `params: Promise<{ issueNumber: string }>`; parse; `redirect('/issues')` on null.
      - Resolve run via `new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL).query(api.pipelineRuns.byIssueNumber, { issueNumber: n })`;
        `redirect(issueHref(n))` if no run (a run must exist to show the slate — Story precedes it only conceptually).
      - `return <SignalDeskScreen workspace_id={DEFAULT_WORKSPACE_ID} runId={run.runId} />`
        (the runId prop is the D-09 issue-keying — do NOT drop it; without it the tab silently shows runs.latest, Pitfall 2).
    Do NOT rebuild SignalDeskScreen (full Story redesign is Phase 47); the internal "Signal Desk" header
    is acceptable for the provisional mount. The frame provides the Story tab + outline presence (D-10).
  </action>
  <verify>
    <automated>grep -q "SignalDeskScreen" "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/page.tsx" && grep -q "runId={run.runId}" "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/page.tsx" && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `story/page.tsx` exists, is a Server Component with `export const dynamic = 'force-dynamic'`
    - it resolves runId via `api.pipelineRuns.byIssueNumber` server-side (grep `ConvexHttpClient`)
    - it mounts `<SignalDeskScreen ... runId={run.runId} />` (grep confirms the runId prop is passed — Pitfall 2 guard)
    - parse-failure and no-run redirects present
  </acceptance_criteria>
  <done>Stage 1 mounts the candidate slate + Gate 1 adjudication scoped to this issue's run.</done>
</task>

<task type="auto">
  <name>Task 2: Stage 3 (Fact Check) first-class placeholder (D-11/WSP-07)</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/page.tsx, apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPlaceholder.tsx, apps/dispatch-control/__tests__/FactCheckPlaceholder.test.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx lines 345–378 (the Verification block's "checked X/Y / not yet checked / No claims extracted yet" copy to mirror — never blank)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx (read-only claim rendering to reuse or slim)
    - apps/dispatch-control/components/_PlaceholderScreen.tsx (the "arrives next" styling)
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/page.tsx (server-wrapper pattern for fact-check/page.tsx)
    - .planning/phases/41-issue-workspace-frame/41-CONTEXT.md D-11/D-12 (compose read-only claim_checks; must NOT show fake verified; Phase 42 replaces)
  </read_first>
  <action>
    Create `fact-check/page.tsx` as the same server-wrapper (resolve issueNumber→runId; redirect on
    null/no-run) that mounts a `'use client'` `FactCheckPlaceholder({ runId })`.
    `FactCheckPlaceholder.tsx`:
      - A prominent banner: "Fact Check — the full stage arrives next" (Phase 42), styled per _PlaceholderScreen.
      - Reads `api.claimChecks.listByRunId({ runId })` and renders the SAME honest coverage the
        DecisionRail Verification block shows: "checked X of Y" · "N unchecked" · last-verified time,
        with the never-blank fallbacks — `totalClaims===0` → "No claims extracted yet" (NOT "verified");
        `lastChecked===0` → "not yet checked". Reuse SourceIndex read-only (or a slimmed clone) to list
        the claims; it must NOT assert a verified state that isn't backed by data (WSP-07 discipline).
      - Do NOT add write actions the real stage owns; this is a read-only interim surface.
    Create FactCheckPlaceholder.test.tsx (mock convex/react useQuery): assert (a) with zero claim rows
    it renders "No claims extracted yet" and NOT any "verified"/"complete" wording; (b) with 2 checked
    of 5 it renders "checked 2 of 5" (or equivalent X/Y), never a blank region.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- FactCheckPlaceholder.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `fact-check/page.tsx` resolves runId server-side and mounts `FactCheckPlaceholder`
    - `FactCheckPlaceholder.tsx` reads `api.claimChecks.listByRunId` and renders X/Y coverage with never-blank fallbacks
    - test asserts zero-claims → "No claims extracted yet" AND no "verified"/"complete" wording (no fake-verified)
    - `pnpm --filter dispatch-control test -- FactCheckPlaceholder.test.tsx` exits 0
  </acceptance_criteria>
  <done>Stage 3 is a first-class, honest placeholder over real claim coverage — never blank, never fake-verified.</done>
</task>

<task type="auto">
  <name>Task 3: Stage 4 (Voice) — strip standalone page chrome (D-07)</name>
  <files>apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx lines ~180-200 (the standalone `<h1>Voice Pass — Run {runId}</h1>` header + the "De-slop it..." description `<p>` to strip; the `tellCount` badge to preserve)
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/page.tsx (the issue-keyed wrapper that mounts VoicePassScreen in the frame — the reason the standalone header now duplicates chrome)
    - .planning/phases/41-issue-workspace-frame/41-08-stage2-draft-recomposition-PLAN.md Task 1 (the sibling Stage-2 strip: delete the `<h1>… — Run {runId}</h1>` header + advisory, keep the bodies — mirror it here)
    - .planning/phases/41-issue-workspace-frame/41-CONTEXT.md D-07 (mount inner content into the frame canvas; strip only standalone page chrome)
  </read_first>
  <action>
    In VoicePassRunView.tsx, DELETE the standalone `<h1>Voice Pass — Run {runId}</h1>` title and the
    "De-slop it..." description `<p>` — the frame now provides the Voice tab + status mark, so this header
    is duplicated chrome (D-07). PRESERVE the `tellCount` badge ("{n} tells") — it is an in-canvas content
    signal, not page chrome; relocate it into the retained controls/toolbar row so no capability is lost
    (mirror 41-08 Task 1, which strips the Stage-2 header + advisory but keeps the chip nav + bodies). Keep
    the `flex min-h-[70vh] flex-col gap-4` wrapper + every downstream body (galley/edit views, section nav,
    findings). This is a chrome-only strip — do NOT touch VoicePass data fetching, findings, or sign-off
    wiring (milestone "DO NOT REBUILD"; Phase 40 D-07).
    Note: unlike Stage 1 (Story), whose provisional SignalDeskScreen header is an ACCEPTED carryover this
    phase (full Story redesign is Phase 47, Task 1), Stage 4's header IS stripped now because the Voice
    screen is a shipped stage the frame fully owns.
  </action>
  <verify>
    <automated>! grep -q "Voice Pass — Run" "apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx" && grep -q "tellCount" "apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx" && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `VoicePassRunView.tsx` no longer contains the "Voice Pass — Run" standalone header string (grep returns nothing)
    - the `tellCount` badge is retained (grep `tellCount` still succeeds) — no capability lost
    - VoicePass data/findings/sign-off wiring is unchanged (chrome-only edit)
  </acceptance_criteria>
  <done>Stage 4 renders its inner Voice canvas without a duplicate standalone header; the frame's Voice tab is the single chrome; the tell-count signal survives.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- FactCheckPlaceholder.test.tsx` green.
- Grep confirms Stage 1 passes runId to SignalDeskScreen and Stage 3 shows real coverage.
- Grep confirms Stage 4's standalone "Voice Pass — Run" header is gone and the tell-count badge is retained.
</verification>

<success_criteria>
Stage 1 renders the candidate slate + Gate 1 adjudication for THIS issue's run; Stage 3 is a
first-class Fact Check placeholder showing real claim coverage, never a blank or fake-verified state;
Stage 4's duplicate standalone header is stripped (D-07) with its tell-count signal preserved.
</success_criteria>

<output>
After completion, create `.planning/phases/41-issue-workspace-frame/41-07-SUMMARY.md`
</output>
