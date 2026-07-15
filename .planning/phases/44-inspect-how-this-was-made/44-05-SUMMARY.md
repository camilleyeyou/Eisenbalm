---
phase: 44-inspect-how-this-was-made
plan: 05
subsystem: ui
tags: [react, nextjs, inspector, lucide-react, dispatch-control, honesty-rules]

# Dependency graph
requires:
  - phase: 44-01
    provides: "docs/API_CONTRACTS.md §44 (InspectorArtifact/InspectorPanelProps contract shapes) and the Wave-0 InspectorPanel.test.tsx it.todo scaffold this plan fills in"
  - phase: 44-03
    provides: "lib/inspectorArtifact.ts's editor_gate_1 -> editor_gate1 promptKey alias, exercised end-to-end by this plan's live-footer-link test"
  - phase: 44-04
    provides: "lib/inspector/missingInputsDiff.ts (MissingInputsResult) and lib/inspector/outputDivergence.ts (OutputDivergence), the two pure diagnostics the Inputs/Output tabs render"
provides:
  - "lib/inspector/summarize.ts — summarize()/prettyJson() extracted verbatim from AgentIOPanel.tsx, now the single shared source for both the Run Details handoff inspector and the new universal panel"
  - "components/inspector/InspectorPanel.tsx — the pure-presentation 7-tab slide-over (InspectorArtifact + InspectorPanelProps types exported for the Plan 44-06 container to consume)"
  - "components/inspector/InspectorFooter.tsx — the six footer actions (4 live-or-reserved gated on promptKey, 2 always-reserved)"
  - "9 live vitest assertions replacing the Wave-0 it.todo scaffold in __tests__/InspectorPanel.test.tsx"
affects: [44-06-inspector-provider-container-mount, 44-07-entry-points-draft-voice-factcheck, 44-08-entry-points-approval-mytasks-org, 44-09-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-presentation panel component (no Convex hooks) fed by a fully-assembled artifact prop — the data-fetching container is a separate, later plan, keeping the panel unit-testable against hand-built mocks in jsdom"
    - "Two-branch honesty rendering: a permanent 'code-defined, not editable here' state is never a bare one-liner (it always renders the shared rules alongside it); an externalized state always renders the real fetched content, never a blank tab on absence"
    - "Never a custom aria-label that only repeats/reshapes the visible label text — it silently shadows the accessible name and can collide with unrelated elements in role-based queries (found via this plan's own test-writing)"

key-files:
  created:
    - apps/dispatch-control/lib/inspector/summarize.ts
    - apps/dispatch-control/components/inspector/InspectorPanel.tsx
    - apps/dispatch-control/components/inspector/InspectorFooter.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx
    - apps/dispatch-control/__tests__/InspectorPanel.test.tsx

key-decisions:
  - "InspectorArtifact and InspectorPanelProps are defined and exported from components/inspector/InspectorPanel.tsx itself (not a new lib/ file) — the plan's files_modified list scopes no new lib/ type module for this plan, and the container (44-06) can import both types directly from the component it renders"
  - "InspectorFooter.tsx was built ahead of its literal Task 3 slot, inside Task 2's commit — InspectorPanel.tsx renders <InspectorFooter> per the plan's own Task 2 action text ('built in Task 3'), so Task 2's own `pnpm build` verification cannot pass without it existing; treated as a Rule 3 (blocking issue) auto-fix, not a scope change — Task 3's later work was refining/testing it, not creating it from nothing"
  - "The 'Related quality tests' footer link is built exactly as the plan's literal template specifies (/eval-center?agent=... when promptKey is set) even though eval-center's page.tsx does not read that query param today — confirmed via grep before choosing; the link is still genuinely live (the page loads) and is forward-compatible, per the plan's own executor-discretion note"

patterns-established:
  - "components/inspector/ as the home for the pure-presentation inspector UI; lib/inspector/ stays reserved for pure, Convex-free data/diagnostic modules (44-03/44-04's precedent) — the panel imports from lib/inspector/, never the other way"

requirements-completed: [INS-02, INS-04, INS-05, INS-06]

# Metrics
duration: ~35min
completed: 2026-07-15
---

# Phase 44 Plan 05: Seven-Tab Inspector Panel Summary

**Pure-presentation 7-tab "Inspect how this was made" slide-over (Summary/Inputs/Instructions/Output/Sources/Diagnostics/Technical) plus its 6-action footer, built against docs/API_CONTRACTS.md §44 with the Instructions tab's two-branch honesty logic (code-defined+shared-rules vs real active-version content) as the load-bearing case — no Convex hooks, ready for the Plan 44-06 container to feed it real data.**

## Performance

- **Duration:** ~35 min (including required-reading pass over PLAN/CONTEXT/RESEARCH/API_CONTRACTS §44/prior summaries)
- **Started:** 2026-07-15T20:12:00Z (approx, session start)
- **Completed:** 2026-07-15T20:31:03Z
- **Tasks:** 3
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- `summarize()`/`prettyJson()` extracted byte-identically from `AgentIOPanel.tsx` into `lib/inspector/summarize.ts`; `AgentIOPanel.tsx` now imports them instead of defining local duplicates, so the Run Details handoff inspector and the new universal panel can never drift into two summarizers
- `InspectorPanel.tsx` renders all seven tabs with Summary as the always-initial state and Technical (raw JSON, behind a copy button) never a default anywhere; every field falls back to an explicit label+icon state rather than rendering blank (D-14)
- The Instructions tab implements the phase's honesty crux exactly per §44.9: for the 5 non-externalized agentKeys it renders "This agent's instructions are code-defined, not editable here" **followed by** the "Shared rules referenced" block (never a bare one-liner); for externalized agents it renders the real `instructionVersion`/`instructions` content mapped by the future container (never a blank tab)
- The Inputs tab renders `computeMissingInputs()`'s result directly — supplied keys, each missing entry with its gloss, and the truncation-approximate note when present, never a silent definitive "missing"; the Output tab renders `computeOutputDivergence()`'s three-way predicate (diverged/unchanged/unknown) with distinct icon+label, never a false "current"
- `InspectorFooter.tsx` ships all six actions: Improve this agent / Compare instruction versions / Related quality tests gate live-vs-reserved on `promptKey !== null`; Prior & downstream steps is always live; Ask agent to revise and Restart from this step are always reserved (with titles containing "not yet wired", per §44.7's Pitfall-6 rationale) for every artifact type
- All 9 Wave-0 `it.todo` cases in `InspectorPanel.test.tsx` converted to live, passing `@testing-library/react` assertions, including the two new non-externalized shared-rules cases (`founder_bio`'s VOICE_CONSTRAINTS+STRUCTURE_CONTRACT, `qa`'s rubric+content) and the externalized real-content case (`instructionVersion='v4'`, `instructions='REAL ACTIVE CONTENT'`)
- Full `pnpm --filter dispatch-control test` (95 files, 821 tests, only pre-existing/out-of-scope `it.todo`s remain in `workspace-upsert.test.ts` and `InspectorProvider.test.tsx`) and `pnpm --filter dispatch-control build` both pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract summarize()/prettyJson() to a shared module + repoint AgentIOPanel** - `3230f9d` (feat)
2. **Task 2: Build the presentational 7-tab InspectorPanel (tabs)** - `5fc3b7e` (feat) — includes `InspectorFooter.tsx` as a Rule 3 auto-fix (see Deviations)
3. **Task 3: Build InspectorFooter (six actions) + fill InspectorPanel.test.tsx** - `4a767ff` (test) — the footer's action wiring was already in place from Task 2; this commit fixes the aria-label bug found while writing the tests and lands all 9 live assertions

## Files Created/Modified

- `apps/dispatch-control/lib/inspector/summarize.ts` - `summarize()`/`prettyJson()`, extracted verbatim from `AgentIOPanel.tsx`
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx` - now imports the two helpers from `@/lib/inspector/summarize` instead of defining them locally; no behavior change
- `apps/dispatch-control/components/inspector/InspectorPanel.tsx` - the pure-presentation 7-tab slide-over; exports `InspectorArtifact` and `InspectorPanelProps` for the container (44-06)
- `apps/dispatch-control/components/inspector/InspectorFooter.tsx` - the six footer actions, live-vs-reserved gated on `promptKey`
- `apps/dispatch-control/__tests__/InspectorPanel.test.tsx` - 9 live assertions replacing the Wave-0 `it.todo` scaffold

## Decisions Made

- **`InspectorArtifact`/`InspectorPanelProps` live in `InspectorPanel.tsx`, not a new `lib/` module.** The plan's `files_modified` list scopes no new type-only file for this plan; the container (Plan 44-06) imports both types directly from the component it renders, matching how the plan's own `<interfaces>` block presented them as the component's contract, not a standalone library shape.
- **`InspectorFooter.tsx` was built inside Task 2's commit, not deferred to Task 3.** `InspectorPanel.tsx`'s own Task 2 action text instructs rendering `<InspectorFooter .../>` "(built in Task 3)" — but Task 2's own verification (`pnpm build`) cannot pass with a dangling import. Built the footer's live-vs-reserved wiring in Task 2 so both tasks' own verification gates pass in order; Task 3 then focused on filling the test suite and fixing a real bug the tests surfaced (see below).
- **"Related quality tests" links to `/eval-center?agent=${promptKey}` even though the page does not yet read that query param.** Confirmed via `grep` against `eval-center/page.tsx` before choosing — the plan's own text explicitly permits either the query-string form or a bare fallback with a comment "if eval-center ignores the query today." Chose the query-string form (still a genuinely live link) with an inline comment noting the gap, per the plan's stated executor discretion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Built `InspectorFooter.tsx` during Task 2 instead of waiting for Task 3**
- **Found during:** Task 2 (Build the presentational 7-tab InspectorPanel)
- **Issue:** `InspectorPanel.tsx`'s required structure renders `<InspectorFooter promptKey={promptKey} agentKey={agentKey} runId={runId} />` per the plan's own Task 2 action text. `./InspectorFooter` did not exist yet (its creation is Task 3's `<action>`), so Task 2's own `<verify>` command (`pnpm build`) would fail on the unresolved import.
- **Fix:** Implemented the full `InspectorFooter.tsx` (all six actions, live-vs-reserved gating) as part of Task 2's work, so Task 2's build verification passes. Task 3 then filled the test suite against the already-working footer and, in the process, found and fixed a real accessible-name bug (deviation 2 below).
- **Files modified:** `apps/dispatch-control/components/inspector/InspectorFooter.tsx`
- **Verification:** `pnpm --filter dispatch-control build` exits 0 after Task 2's commit.
- **Committed in:** `5fc3b7e` (Task 2 commit)

**2. [Rule 1 - Bug] Removed a custom `aria-label` that shadowed the visible footer-button text and collided with the Instructions tab button**
- **Found during:** Task 3 (writing the live InspectorPanel.test.tsx assertions)
- **Issue:** The "Improve this agent →" footer action carried a custom `aria-label={"Improve " + agentKey + "'s instructions"}`. This aria-label completely overrides the accessible name computation (ignoring the visible "Improve this agent →" text), and its lowercase substring `"instructions"` caused `screen.getByRole('button', { name: /Instructions/i })` (a case-insensitive regex query for the Instructions TAB button) to match two elements — a real ambiguity bug in the accessible-name surface, not just a test-authoring inconvenience.
- **Fix:** Removed the custom `ariaLabel` prop from `FooterAction` entirely (and the parameter itself) — the visible label text is already a clear, sufficient accessible name on its own.
- **Files modified:** `apps/dispatch-control/components/inspector/InspectorFooter.tsx`
- **Verification:** `pnpm --filter dispatch-control test -- __tests__/InspectorPanel.test.tsx` — all 9 assertions pass; role-based queries for "Instructions" (the tab) and "Improve this agent" (the footer link) each resolve unambiguously.
- **Committed in:** `4a767ff` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking-dependency sequencing, 1 accessibility/query-ambiguity bug).
**Impact on plan:** Both were necessary for the plan's own stated verification commands to pass in task order and for the panel's accessible-name surface to be genuinely unambiguous (not just test-green by accident). No scope creep — the footer's action set, gating rules, and copy are exactly what §44.7 and the plan's Task 3 text specify.

## Issues Encountered

None beyond the two deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `components/inspector/InspectorPanel.tsx` exports `InspectorPanel`, `InspectorArtifact`, and `InspectorPanelProps` — Plan 44-06 imports all three, assembles a real `InspectorArtifact` from `resolveInspectorStep` (44-03) + the Convex queries (`agentRuns.payloadByRunIdAgentKey`, `promptVersions.getActive`) + `computeMissingInputs`/`computeOutputDivergence` (44-04), and mounts exactly one `InspectorPanel` instance behind the `openInspector`/`closeInspector` context contract (§44.6).
- `components/inspector/InspectorFooter.tsx` is fully wired and independently tested — 44-06 does not need to touch it, only pass the resolved `promptKey`/`agentKey`/`runId`.
- No blockers. `pnpm --filter dispatch-control test` (95 files / 821 tests passing, 4 `it.todo` remaining — 2 in `workspace-upsert.test.ts` unrelated to Phase 44, 2 in `InspectorProvider.test.tsx` explicitly scoped to Plan 44-06) and `pnpm --filter dispatch-control build` both green.

---
*Phase: 44-inspect-how-this-was-made*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/lib/inspector/summarize.ts
- FOUND: apps/dispatch-control/components/inspector/InspectorPanel.tsx
- FOUND: apps/dispatch-control/components/inspector/InspectorFooter.tsx
- FOUND: apps/dispatch-control/__tests__/InspectorPanel.test.tsx
- FOUND: .planning/phases/44-inspect-how-this-was-made/44-05-SUMMARY.md
- FOUND: 3230f9d (Task 1 commit)
- FOUND: 5fc3b7e (Task 2 commit)
- FOUND: 4a767ff (Task 3 commit)
