---
phase: 41-issue-workspace-frame
plan: 09
type: execute
wave: 4
depends_on: [41-06, 41-01]
files_modified:
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/page.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalStage.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/PublishPreviewDialog.tsx
  - apps/dispatch-control/__tests__/DecisionRail.test.tsx
  - apps/dispatch-control/__tests__/PublishPreviewDialog.test.tsx
autonomous: true
requirements: [WSP-05, WSP-06]
must_haves:
  truths:
    - "Stage 5 leads with blockers, then a readiness board, then the agent editor's recommendation labeled as agent judgment"
    - "'Agent editor's recommendation' is the label; 'editor' unqualified is reserved for the human"
    - "Publish is disabled until Must fix = 0 AND facts-cleared AND sounds-human AND not held, with the unlock condition written next to the control"
    - "Publishing shows an exact preview (destination, title, time, consequences) and completes on one confirmation click — no typed confirmation"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/page.tsx"
      provides: "issue-keyed Stage 5 server wrapper — resolves runId + no-run redirect only (held comes from the frame context, not a re-query)"
      contains: "redirect"
    - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalStage.tsx"
      provides: "client Stage-5 inner — reads held from useWorkspaceState(), mounts the full-width held-aware DecisionRail"
      contains: "useWorkspaceState"
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/PublishPreviewDialog.tsx"
      provides: "exact-preview interstitial (destination/title/time/consequences) + one confirm click"
      contains: "consequences"
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx"
      provides: "readiness board + agent-editor's-recommendation label + held-aware publish gate + preview wiring"
      contains: "Agent editor's recommendation"
  key_links:
    - from: "DecisionRail Publish button"
      to: "PublishPreviewDialog → existing publishIssue(token, runId)"
      via: "preview interstitial replaces the direct handlePublish call; same publish endpoint, unchanged"
      pattern: "PublishPreviewDialog"
    - from: "DecisionRail publish gate"
      to: "held (from useWorkspaceState) + facts-cleared + sounds-human + zero blockers"
      via: "ApprovalStage reads held from context (Pitfall 3 — no re-query) and passes it as the DecisionRail held prop; disabled = blockers>0 || !facts || !human || held || busy, with unlock text"
      pattern: "held"
---

<objective>
Recompose Stage 5 (Approval) from the shipped decision rail (D-13/D-14/D-15). Mount `DecisionRail`
as the full-width Approval canvas (drop the `lg:w-[336px]` sidebar sizing). Add the two WSP-05
elements that don't exist yet: a scannable "readiness board" and an "Agent editor's recommendation"
block (relabel the existing editor-final memo per D-16 — SC-4, "editor" unqualified stays the human).
Deliver WSP-06: a `PublishPreviewDialog` interstitial between the Publish button and the EXISTING
`publishIssue()` — exact preview (destination/title/time/consequences) + one confirm click, no typed
confirmation (research Pitfall 1: there is no typed confirmation to remove — this is net-new UI). Add
the `!held` term to the publish gate and write the unlock condition next to the control; consume
`held` from the frame context (`useWorkspaceState().held`) rather than re-querying it (Pitfall 3 centralization).

Purpose: WSP-05 (blockers-first → readiness board → agent recommendation) and WSP-06 (exact preview,
one click, unlock condition shown). Reuse the shipped gate + sign-offs unchanged (server publish
contract does NOT change — no docs/API_CONTRACTS.md amendment needed, per research Pattern 4).
Output: approval/page.tsx + edited DecisionRail + PublishPreviewDialog + tests.
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
<!-- DecisionRail.tsx (verified) props { runId }. Renders (in order): headline count · blocking items
     (open FACTUAL error findings) · Editor's memo (editor-final deliberationEvents `notes`) · Hook card
     (pitchLog.selectedByRunId {charityName, scoutSummary}) · Verification (claims X/Y + SourceIndex) ·
     Sign-offs (facts-cleared, sounds-human via signOffs.activeByRunId) · Actions (Publish/Hold/Rerun/Transcript) ·
     ResolvedFindingsList. handlePublish() calls publishIssue(token, runId) — NO confirmation today.
     Publish disabled today = `blockers.length > 0 || !factsActive || !humanActive || busy`. -->
<!-- lib/reviewClient.ts::publishIssue(token, runId) POSTs /issues/{runId}/publish; server re-validates the
     two-sign-off gate (409) independently — client preview is purely additive; no contract change. -->
<!-- Data for the preview: destination = static "the public Dispatch site"; title = "Issue {n} — {charityName}"
     (issueNumber + pitch.charityName); time = immediate ("now"); consequences = static
     "Publishes Issue {n} to the live site and locks further edits." -->
<!-- held source: api.issues.byIssueNumber({workspace_id, issueNumber}).held — resolved by the approval page
     (issue-keyed) and passed to DecisionRail as a new optional prop. -->
<!-- 41-01 hrefs: issueDraftHref/issueFactCheckHref/issueVoiceHref (readiness-board + blocker jump links). -->
<!-- Server wrapper pattern: voice/page.tsx (resolve issueNumber→runId). -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Stage 5 route + held-aware, full-width DecisionRail mount (D-13/D-15 held term)</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/page.tsx, apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalStage.tsx, apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/page.tsx (server-wrapper pattern for approval/page.tsx)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx (full — props, the publish disabled condition line ~421, the unlock message lines ~427–433)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx lines 484–492 (the `lg:w-[336px]` sidebar sizing that Stage 5 drops — the RAIL itself is unchanged, only its container)
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx (useWorkspaceState() exposes `held` + `runId` — consume these; do NOT re-query api.issues.byIssueNumber, Pitfall 3)
    - .planning/phases/41-issue-workspace-frame/41-CONTEXT.md D-13 (rail IS the Approval stage) + D-15 (held blocks publish)
  </read_first>
  <action>
    1) Create `approval/page.tsx` as a SERVER wrapper (voice/page.tsx pattern) that resolves
       issueNumber→runId and handles ONLY the pre-render redirect (parse issueNumber → redirect('/issues')
       on null; ConvexHttpClient(api.pipelineRuns.byIssueNumber) → redirect(issueHref(n)) if no run). It does
       NOT read `held` — the frame provider already subscribes to it (Pitfall 3). It renders the client
       inner `<ApprovalStage runId={run.runId} issueNumber={n} />`.
    1b) Create `approval/ApprovalStage.tsx` (`'use client'`): reads `held` from `useWorkspaceState()` (the
       frame context populated once by WorkspaceStateProvider — do NOT re-query api.issues.byIssueNumber) and
       mounts `<DecisionRail runId={runId} issueNumber={issueNumber} held={held} />` at FULL canvas width
       (no `lg:w-[336px]` container — that sidebar sizing lived in ReviewDeskRunView, not the rail; here the
       rail takes the stage width). Reserve the server-wrapper ConvexHttpClient path for the redirect only.
    2) In DecisionRail.tsx, add optional props `issueNumber?: number` and `held?: boolean`. Add the D-15
       `!held` term to the publish gate: `disabled={blockers.length > 0 || !factsActive || !humanActive || held || busy}`.
       Update the unlock message so held is one of the shown reasons. Rail internals (sign-offs, blocking
       items, hook, verification, ResolvedFindingsList) are UNCHANGED (D-13/D-17 — do not rewrite).
  </action>
  <verify>
    <automated>grep -q "DecisionRail" "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalStage.tsx" && grep -q "useWorkspaceState" "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalStage.tsx" && grep -q "held" apps/dispatch-control/app/\(dashboard\)/review-desk/\[runId\]/_components/DecisionRail.tsx && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `approval/page.tsx` is a server wrapper that resolves runId + redirects (grep `redirect`), and does NOT query `api.issues.byIssueNumber` for held
    - `approval/ApprovalStage.tsx` mounts `<DecisionRail ... held={held} />` with `held` from `useWorkspaceState()` (grep `useWorkspaceState`) — no re-query (Pitfall 3)
    - DecisionRail's publish `disabled` condition now includes `held` (grep the disabled expression contains `held`)
    - rail internals (sign-offs blocks, blocking items, ResolvedFindingsList) unchanged (grep still present)
  </acceptance_criteria>
  <done>Stage 5 mounts the full-width decision rail; held comes from the frame context (no re-query); publish is additionally blocked when the issue is held.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Readiness board + "Agent editor's recommendation" + PublishPreviewDialog wiring (WSP-05/WSP-06)</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx, apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/PublishPreviewDialog.tsx, apps/dispatch-control/__tests__/DecisionRail.test.tsx, apps/dispatch-control/__tests__/PublishPreviewDialog.test.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx (the section order + handlePublish + the memo block + verification/sign-off/pitch data already read)
    - apps/dispatch-control/__tests__/DecisionRail.test.tsx (the existing mock harness to extend)
    - .planning/phases/41-issue-workspace-frame/41-RESEARCH.md §Pattern 3 (readiness board + recommendation are net-new; relabel editor-final memo) + §Pattern 4 (preview data sources; no server change) + §Open Q2 (memo IS the recommendation, relabeled)
    - .planning/phases/41-issue-workspace-frame/41-CONTEXT.md D-14/D-16 (blockers-first → readiness board → agent editor's recommendation; label load-bearing)
  </read_first>
  <behavior>
    - Test (WSP-05 order): the rail renders, in DOM order, blockers → readiness board → the
      "Agent editor's recommendation" block. Assert the literal label "Agent editor's recommendation"
      is present and that no block labels the AGENT's output as just "Editor" (the human reservation, SC-4).
    - Test (WSP-06 gate): the Publish button is disabled when blockers>0 OR facts not signed OR voice not
      signed OR held; the unlock condition text is rendered next to it listing "Must fix = 0",
      "Fact Check complete", "Voice approved current" (and held when applicable).
    - Test (WSP-06 flow): clicking an ENABLED Publish opens PublishPreviewDialog (does NOT publish yet);
      the dialog shows destination, title, time, consequences; clicking its single Confirm calls the
      publish path once; there is NO text input to type a confirmation.
  </behavior>
  <action>
    1) Create `PublishPreviewDialog.tsx` (`'use client'`): props `{ issueNumber?: number; charityName?: string;
       onConfirm: () => void; onCancel: () => void; busy?: boolean }`. Render the four exact-preview fields:
         - Destination: "the public Dispatch site" (static).
         - Title: `Issue ${issueNumber} — ${charityName ?? '(charity)'}`.
         - Time: "Now — publishes immediately".
         - Consequences: `Publishes Issue ${issueNumber} to the live site and locks further edits.`
       One "Publish now" confirm button (calls onConfirm) + a Cancel. NO typed-confirmation input anywhere.
    2) In DecisionRail.tsx:
       - Add a READINESS BOARD section (after blockers, before the recommendation): a scannable label+state
         grid summarizing — Fact check (claims X/Y from the data already read), Voice (sounds-human signed y/n),
         Hook & peg (selected pitch present y/n), Open decisions (blocker count). Each row renders a text
         label + state (never blank, never color-alone). For any signal with no data source this phase
         (e.g. organization verification), render an explicit "not tracked yet" state — never a blank/fake.
       - RELABEL the existing "Editor's memo" block to "Agent editor's recommendation" (D-16/Open Q2 — same
         editor-final `notes` data, agent-judgment label). Keep the honest "No … for this run" fallback.
       - Reorder so the section sequence is: headline → blocking items → readiness board → agent editor's
         recommendation → hook → verification → sign-offs → actions → resolved (blockers-first, D-14).
       - Wire the preview: replace the Publish button's direct `onClick={handlePublish}` with an
         `onClick={() => setShowPreview(true)}` that opens `PublishPreviewDialog`; the dialog's `onConfirm`
         calls the EXISTING `handlePublish` (unchanged `publishIssue(token, runId)` — no server change).
       - Write the unlock condition next to the disabled Publish: "Unlocks when: Must fix = 0 · Fact Check
         complete · Voice approved current" (+ "· Not held" when held). Keep the existing belt-and-suspenders
         server-409 message handling.
    3) Extend DecisionRail.test.tsx with the WSP-05 order + WSP-06 gate/flow behaviors; create
       PublishPreviewDialog.test.tsx for the dialog fields + single-confirm + no-typed-input.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- DecisionRail.test.tsx PublishPreviewDialog.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "Agent editor's recommendation" apps/dispatch-control/app/\(dashboard\)/review-desk/\[runId\]/_components/DecisionRail.tsx` succeeds
    - `PublishPreviewDialog.tsx` contains all four fields (grep: "public Dispatch site", "Issue ", "immediately"/"Now", "consequences"/"locks further edits") and has NO `<input`/typed-confirmation
    - DecisionRail Publish opens the preview (grep `PublishPreviewDialog` mounted) and confirm calls `handlePublish`/`publishIssue`
    - the unlock condition text next to Publish names Must fix / Fact Check / Voice (grep "Unlocks when")
    - `pnpm --filter dispatch-control test -- DecisionRail.test.tsx PublishPreviewDialog.test.tsx` exits 0 (order + gate + one-click flow)
  </acceptance_criteria>
  <done>Stage 5 is blockers-first → readiness board → agent editor's recommendation; publish shows an exact preview and completes on one click, gated with a written unlock condition, no typed confirmation.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- DecisionRail.test.tsx PublishPreviewDialog.test.tsx` green.
- No change to `lib/reviewClient.ts` publish signature or `docs/API_CONTRACTS.md` (server gate reused unchanged).
- `pnpm --filter dispatch-control build` compiles the Approval route (wave close).
</verification>

<success_criteria>
Stage 5 leads with blockers, then a readiness board, then the agent editor's recommendation (labeled as
agent judgment); Publish is disabled until Must fix=0 ∧ facts-cleared ∧ sounds-human ∧ !held with the
unlock condition written next to it; publishing shows an exact preview and completes on one click, no typed
confirmation; the two-sign-off server gate is untouched.
</success_criteria>

<output>
After completion, create `.planning/phases/41-issue-workspace-frame/41-09-SUMMARY.md`
</output>
