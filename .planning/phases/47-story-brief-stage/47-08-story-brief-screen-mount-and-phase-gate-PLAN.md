---
phase: 47-story-brief-stage
plan: 08
type: execute
wave: 4
depends_on: ["47-03", "47-04", "47-06", "47-07"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/story-brief/_components/StoryBriefScreen.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/page.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx
  - apps/dispatch-control/lib/derivedState.ts
  - apps/dispatch-control/__tests__/StoryBriefScreen.test.tsx
autonomous: true
requirements: [BRF-01, BRF-02, BRF-03, BRF-04, BRF-05, BRF-06]
must_haves:
  truths:
    - "Stage 1 mounts the full Story & Brief screen (leads then org options then Needs-your-decision then Brief table) in the Phase-41 Workspace frame at issues/[issueNumber]/story — the provisional Signal Desk (StoryPanelContent.tsx) is DELETED, not extended"
    - "Empty (before discovery: the two Create paths inline), Loading ('finding leads… ~40s'), and Error (plain-language problem + Restart discovery + link into Run Details) states render per Annotations §Stage 1"
    - "deriveStoryStage's 'needs-you' is gated on the precise paused predicate (status==='awaiting-review' && completedAt==null), not merely pitchLog presence (Pitfall 3)"
    - "The full vitest suite, the full pytest suite, the strict next build, and Convex parity are all green"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/story-brief/_components/StoryBriefScreen.tsx"
      provides: "Stage-1 composition shell replacing SignalDeskScreen"
      min_lines: 60
  key_links:
    - from: "issues/[issueNumber]/story/page.tsx"
      to: "StoryBriefScreen"
      via: "mount replacing SignalDeskScreen"
      pattern: "StoryBriefScreen"
---

<objective>
Compose the six Stage-1 components into `StoryBriefScreen`, mount it at `issues/[issueNumber]/story` in place of the provisional `SignalDeskScreen`, DELETE the 131-line `StoryPanelContent.tsx` placeholder (D-01 — "replaced, not built from nothing"), tighten the StageStrip derivation (Pitfall 3), and run the phase gate (full vitest + full pytest + strict `next build` + Convex parity).

Purpose: This is the integration + replacement + gate. Stage 1 becomes the real Story & Brief stage inside the shared Workspace frame with the design's empty/loading/error/after-choose states, and the phase's hard build/parity gates confirm it ships.
Output: StoryBriefScreen.tsx; replaced story/page.tsx; deleted StoryPanelContent.tsx; tightened deriveStoryStage; green gates.
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
@.planning/phases/47-story-brief-stage/47-VALIDATION.md
@docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md

<interfaces>
Design contract (Annotations §Stage 1, L48-55):
- Composition order: Leads → Organization options grouped under the chosen lead → Paused-for-you (Needs your decision) → Brief field table.
- Empty state (before discovery): the two Create paths inline (reuse issues/_components/CreatePanel.tsx).
- Loading: lead cards stream with "finding leads… (~40s)".
- Error: discovery failure surfaces a plain-language problem + "Restart discovery" + a link into Run Details.
- After choose: brief generated, decision + rationale logged, Draft unlocks (WORKSPACE reveal via existing deriveSectionStates — NOT a pipeline gate; RESEARCH Pitfall 2).

Mount point (D-01): issues/[issueNumber]/story/page.tsx currently imports SignalDeskScreen (L22) + StoryPanelPublisher (L23) and renders `<SignalDeskScreen workspace_id=... runId=... />` (L45). Replace with StoryBriefScreen; delete StoryPanelContent.tsx.

deriveStoryStage (derivedState.ts L152-158): currently `pitchRows.length > 0 && none selected -> 'needs-you'`. Tighten to require the paused predicate (status==='awaiting-review' && completedAt==null) so a mid-flight run doesn't flash "Needs you" (Pitfall 3). Add the run status/completedAt to DerivationInputs if not already present.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: StoryBriefScreen.tsx composition + empty/loading/error states + StageStrip derivation</name>
  <read_first>
    apps/dispatch-control/app/(dashboard)/signal-desk/_components/SignalDeskScreen.tsx (the screen shell being replaced — mount contract, the runId prop, isPausedAtGate1). apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx (the two Create paths for the empty state). apps/dispatch-control/lib/derivedState.ts L148-160 (deriveStoryStage + DerivationInputs). The six components from 47-05/06/07 (LeadCard, LeadActions, OrgOptionSlate, NeedsYourDecisionCard, BriefFieldTable, BriefFieldStrengthen). apps/dispatch-control/__tests__/StoryBriefScreen.test.tsx (new). Annotations §Stage 1 L48-55.
  </read_first>
  <behavior>
    - StoryBriefScreen composes leads → org options → NeedsYourDecisionCard → Brief field table (with per-field strengthen) from provider state.
    - Empty (no run / before discovery) renders the CreatePanel two paths; Loading renders streaming lead cards with "finding leads… (~40s)"; Error renders a plain-language problem + Restart discovery + Run Details link.
    - deriveStoryStage returns 'needs-you' ONLY when the run is paused at Gate 1 (awaiting-review && completedAt==null), not merely when pitchRows exist.
  </behavior>
  <action>
    Create StoryBriefScreen.tsx (Client Component, `runId` prop like SignalDeskScreen) composing the six components in the design order, reading everything from useWorkspaceState(). Add the three states (empty via CreatePanel, loading, error) per Annotations §Stage 1. In derivedState.ts, tighten deriveStoryStage to gate 'needs-you' on the paused predicate (thread run status + completedAt through DerivationInputs). Write StoryBriefScreen.test.tsx: asserts the composition renders leads + brief table for a selected run, the empty state renders CreatePanel before discovery, and (unit-level) deriveStoryStage returns 'in-progress' for pitchRows-present-but-not-paused and 'needs-you' only when paused.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- StoryBriefScreen derivedState</automated>
  </verify>
  <acceptance_criteria>
    - StoryBriefScreen.tsx imports and composes all six Stage-1 components
    - The empty state renders CreatePanel; loading shows "finding leads"; error shows "Restart discovery"
    - deriveStoryStage 'needs-you' branch is guarded by the awaiting-review && completedAt==null predicate (test asserts pitchRows-present-not-paused → not 'needs-you')
    - `pnpm --filter dispatch-control test:unit -- StoryBriefScreen derivedState` green
  </acceptance_criteria>
  <done>The full Stage-1 screen composes correctly with the design's empty/loading/error states and a precise StageStrip signal.</done>
</task>

<task type="auto">
  <name>Task 2: Mount StoryBriefScreen at Stage 1 and delete the provisional placeholder</name>
  <read_first>
    apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/page.tsx (L22-23 imports, L45 `<SignalDeskScreen .../>` render, the runId resolution). apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx (the 131-line placeholder + `buildStoryPanelContent`/StoryPanelPublisher — confirm nothing else imports it before deleting). 47-CONTEXT.md §specifics ("replaced, not extended"; Phases 40 & 42 deleted the placeholders they replaced).
  </read_first>
  <action>
    Rewrite story/page.tsx to mount `<StoryBriefScreen runId={run.runId} />` instead of SignalDeskScreen (keep the workspace frame wiring intact). Remove the StoryPanelPublisher import/usage. Delete StoryPanelContent.tsx. Grep the repo to confirm no remaining import of StoryPanelContent/buildStoryPanelContent/StoryPanelPublisher; fix any dangling reference (the context-panel publisher becomes obsolete once org detail lives in the main canvas — remove or re-point it).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && test ! -f "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx" && grep -q "StoryBriefScreen" "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/page.tsx" && ! grep -rq "StoryPanelPublisher\|buildStoryPanelContent" apps/dispatch-control/app apps/dispatch-control/lib && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - StoryPanelContent.tsx no longer exists
    - story/page.tsx renders StoryBriefScreen (not SignalDeskScreen) and no longer imports StoryPanelPublisher
    - No repo reference to StoryPanelContent/buildStoryPanelContent/StoryPanelPublisher remains
  </acceptance_criteria>
  <done>Stage 1 is the real Story & Brief screen; the provisional Signal Desk placeholder is fully removed.</done>
</task>

<task type="auto">
  <name>Task 3: Phase gate — full suites + strict build + Convex parity</name>
  <read_first>
    47-VALIDATION.md §"Sampling Rate" / §"Validation Sign-Off" (the phase-gate definition). Memory: run-strict-build-before-frontend-phase-done (vitest does NOT type-check) + convex-functions-need-live-sync. apps/dispatch-control/package.json (build/test scripts). packages/pipeline/pyproject.toml (pytest config).
  </read_first>
  <action>
    Run and make green, fixing anything that fails: the full dispatch-control vitest suite; the full pipeline pytest suite; the strict `pnpm --filter dispatch-control build` (surfaces type errors vitest misses); and `pnpm check:convex-parity` (confirm the briefs table + all new functions are live on dev:modest-magpie-797 — re-run `pnpm --filter @eisenbalm/convex dev:once` if parity is not green). This is the phase's mandatory build/parity gate before verify-work.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control test:unit && pnpm --filter dispatch-control build && pnpm check:convex-parity && (cd packages/pipeline && uv run pytest tests/ -q)</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter dispatch-control build` exits 0 (strict next build, type-checks pass)
    - `pnpm --filter dispatch-control test:unit` full suite green
    - `cd packages/pipeline && uv run pytest tests/ -q` full suite green
    - `pnpm check:convex-parity` reports zero missing functions (briefs + storyLeads.setStatus live)
  </acceptance_criteria>
  <done>All four phase gates are green; Phase 47 is ready for verify-work.</done>
</task>

</tasks>

<verification>
- Strict build exit 0; full vitest + full pytest green; Convex parity green.
- StoryPanelContent.tsx deleted; StoryBriefScreen mounted; deriveStoryStage tightened.
</verification>

<success_criteria>
Stage 1 is the full Story & Brief stage inside the Workspace frame, the placeholder is gone, and every phase gate (strict build, both suites, Convex parity) is green — all six BRF requirements are integrated end-to-end.
</success_criteria>

<output>
After completion, create `.planning/phases/47-story-brief-stage/47-08-SUMMARY.md`.
</output>
