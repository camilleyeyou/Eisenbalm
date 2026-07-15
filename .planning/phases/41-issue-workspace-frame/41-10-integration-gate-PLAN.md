---
phase: 41-issue-workspace-frame
plan: 10
type: execute
wave: 5
depends_on: [41-06, 41-07, 41-08, 41-09]
files_modified:
  - .planning/phases/41-issue-workspace-frame/41-UAT.md
autonomous: false
requirements: [WSP-01, WSP-02, WSP-03, WSP-04, WSP-05, WSP-06, WSP-07]
must_haves:
  truths:
    - "The full dispatch-control test suite passes"
    - "The strict Next build passes (vitest does not type-check — this is the real gate)"
    - "The Convex mutation from Plan 41-02 is live on dev:modest-magpie-797"
    - "The operator can walk Draft → Voice → Approval → Publish-preview → confirm with live tab/status/publish-lock updates"
  artifacts:
    - path: ".planning/phases/41-issue-workspace-frame/41-UAT.md"
      provides: "human verification record for the live demo path"
  key_links:
    - from: "the frame"
      to: "every WSP requirement"
      via: "full suite + strict build + live demo walk"
      pattern: "build"
---

<objective>
Phase gate: prove the whole frame holds together before declaring Phase 41 done. Run the full
vitest suite AND the strict `next build` (vitest does NOT type-check — two latent bugs shipped in
Phase 27 by skipping the build, per project memory [[run-strict-build-before-frontend-phase-done]]).
Confirm the Convex mutation from Plan 41-02 is live. Then a human walks the demo path — the whole
point of the milestone — and records the result.

Purpose: catch cross-plan integration regressions (type drift between the frame context and the
stage mounts, dead redirects, tab-mark divergence) that per-file unit tests miss.
Output: green suite + green build + a recorded UAT of the live demo path.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/41-issue-workspace-frame/41-VALIDATION.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Full suite + strict build + Convex-live check</name>
  <files>apps/dispatch-control (verification only)</files>
  <read_first>
    - .planning/phases/41-issue-workspace-frame/41-VALIDATION.md (the full-suite + build gate + convex-sync requirement)
  </read_first>
  <action>
    Run, in order, and record output in the SUMMARY:
      1. `pnpm --filter dispatch-control test`  — the full suite (all 62+ files incl. the new
         derivedState/issueRouteResolver/ClaimMark/SignalDeskScreen/WorkspaceOutline/ContextPanel/
         WorkspaceLayout/FactCheckPlaceholder/DraftNotGenerated/DecisionRail/PublishPreviewDialog/nav tests).
      2. `pnpm --filter dispatch-control build`  — strict `tsc` via Next; MUST pass (the real gate;
         vitest alone is insufficient). Fix any type errors surfaced only here (e.g. frame-context ↔
         stage-mount prop drift) before proceeding.
      3. Confirm the Plan 41-02 mutation is deployed: re-run `pnpm --filter @eisenbalm/convex dev:once`
         (idempotent) and confirm `api.issues.setLastVisitedStage` resolves in dev:modest-magpie-797
         (no 404 when the frame writes it).
    If the build fails, this task is NOT done — fix forward within the touched files (do not silence types).
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter dispatch-control test` exits 0 (full suite green)
    - `pnpm --filter dispatch-control build` exits 0 (strict typecheck green)
    - `pnpm --filter @eisenbalm/convex dev:once` completed without error; setLastVisitedStage is live
    - no `@ts-ignore`/`any`-cast added to force the build green (grep the diff for new suppressions = none)
  </acceptance_criteria>
  <done>Full suite + strict build green; the Convex writer is live.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Live demo-path verification (WSP-01/02/03/04/05/06/07)</name>
  <read_first>
    - .planning/phases/41-issue-workspace-frame/41-CONTEXT.md §Specific Ideas (the demo path) + ROADMAP.md:890-897 (the 7 success criteria)
  </read_first>
  <what-built>
    The Issue Workspace frame: one workspace at /issues/[n] with stage tabs 1-5 (live status marks),
    a persistent section outline, a collapsible context panel, and persistent controls — Stage 1 Signal
    Desk, Stage 2 Draft galley (claim focus + click-through), Stage 3 Fact Check placeholder, Stage 4
    Voice Pass, Stage 5 Approval (blockers-first → readiness board → agent editor's recommendation) with
    an exact publish preview + one-click confirm. The three desk nav items are gone.
  </what-built>
  <action>
    A human runs the console against dev Convex (`pnpm --filter dispatch-control dev`) and walks the
    demo path below, recording pass/fail per criterion in
    `.planning/phases/41-issue-workspace-frame/41-UAT.md`. This is an integration-level, live-reactivity
    verification with no jsdom-automatable equivalent (multi-stage navigation + live Convex + publish
    preview), so it is a blocking human checkpoint, not an automated test.
  </action>
  <how-to-verify>
    Open an in-progress issue and confirm:
      1. Sidebar shows ONE "Issue Workspace" item; NO Review Desk / Signal Desk / Voice Pass items (WSP-01).
      2. Navigating /issues/[n] lands in the frame at the last-visited stage; the 5 tabs each show a live
         status mark (icon + label, not color alone); switching tabs does not full-reload the frame (WSP-01).
      3. The outline lists every section with its state; a not-generated section shows "not generated",
         not a blank; clicking a section jumps to it (WSP-02); the context panel hides/shows (WSP-03).
      4. Stage 2 Draft: checked claims are marigold-underlined and reveal their source on hover AND on
         Tab keyboard focus; unchecked claims are rust-tinted and clicking one lands on the Fact Check tab (WSP-04).
      5. Stage 4: approve the Voice Pass ("Sounds human"). Stage 5: blockers appear first, then the
         readiness board, then the "Agent editor's recommendation" (labeled as agent judgment) (WSP-05).
      6. Publish is disabled with the unlock condition shown until Must fix=0 ∧ Fact Check complete ∧
         Voice approved current (∧ not held); once eligible, clicking Publish shows the exact preview
         (destination, title, time, consequences) and one confirm click publishes — no typed confirmation (WSP-06).
      7. A not-generated section (e.g. the Editor's note) reads as a first-class state, never a blank (WSP-07).
      Confirm the header status, task counts, tab marks, and publish lock update live (no manual refresh).
  </how-to-verify>
  <verify>
    <automated>MANUAL — live demo-path walk (multi-stage nav + live Convex reactivity); no jsdom-automatable equivalent. Recorded in 41-UAT.md.</automated>
  </verify>
  <done>41-UAT.md records a pass across all 7 WSP success criteria on the live demo path (or lists failures to close).</done>
  <resume-signal>Type "approved" once the demo path passes, or describe any criterion that failed.</resume-signal>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test` and `pnpm --filter dispatch-control build` both exit 0.
- 41-UAT.md records the live demo-path result across all 7 success criteria.
</verification>

<success_criteria>
Full suite + strict build green, the Convex writer live, and a human-verified walk of the demo path
covering all seven WSP success criteria with live status/tab/publish-lock updates.
</success_criteria>

<output>
After completion, create `.planning/phases/41-issue-workspace-frame/41-10-SUMMARY.md`
</output>
