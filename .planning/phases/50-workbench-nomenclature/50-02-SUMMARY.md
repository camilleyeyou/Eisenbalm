---
phase: 50-workbench-nomenclature
plan: 02
subsystem: ui
tags: [nextjs, vitest, react-flow, convex, nomenclature, dispatch-control]

# Dependency graph
requires:
  - phase: 50-workbench-nomenclature (plan 50-00)
    provides: "lib/nomenclature.ts's RUN_STEP_MAP/runStepFor (§7 action-name source of truth) + the reconciled 20-node pipelineTopology.ts / GATE_KEYS = {verify_candidates, verify_research, publisher}"
provides:
  - "PipelineGraph.tsx + AgentNode.tsx render every graph node by its §7 action label (primary) with the agent as secondary caption metadata, sourced from runStepFor() — the ad hoc toDisplayName() title-caser is gone"
  - "AgentIOPanel.tsx operator-facing copy says 'step', never 'node' (component/identifier names unchanged)"
  - "RunDetail.tsx's per-agent table groups by runStepFor().actionLabel: 7 writers + validate_sections collapse into ONE expandable 'Draft sections' row; calibrator/chronicler render as dimmed 'supporting step' rows; every other row is action-primary/agent-secondary, never the raw agentKey"
  - "RunDetail.tsx header states plainly whether the run is a historical record (finished) or a live run (in-flight); per-step status pills use the §7 vocabulary (Waiting/Running/Complete/Failed)"
  - "runDetailActionNames.test.ts — pins the §7 action-label map, cross-checks RUN_STEP_MAP.isDeterministicCheck against GATE_KEYS for drift, proves the Draft-sections collapse + named:false fallbacks, and source-scans RunDetail.tsx for the banned idle-header term"
affects: [50-03-automation-reframe-typed-confirm-donotuse, 50-05-failed-run-recovery-rail-honest-restart, 50-06-nomenclature-sweep-tripwire-green]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Group-by-actionLabel collapse: RunDetail.tsx groups agent_runs rows by runStepFor(agentKey).actionLabel rather than hand-listing writer agentKeys, so the 7 writers + validate_sections collapse into ONE 'Draft sections' unit automatically (RUN_STEP_MAP already assigns them the same action label) — no separate writer-detection allowlist to maintain."
    - "Action-primary/agent-secondary node label: AgentNodeData.displayName now carries the §7 action (was an ad hoc toDisplayName() title-case of the raw key); a new optional agentLabel field renders as a small secondary caption line, extended to both the Graph spine (AgentNode.tsx) and the Runs table (RunDetail.tsx)."

key-files:
  created:
    - apps/dispatch-control/__tests__/runDetailActionNames.test.ts
  modified:
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentNode.tsx
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx
    - apps/dispatch-control/__tests__/AgentIOPanel.test.tsx

key-decisions:
  - "Rendered the agent secondary caption as its own line below the node title in AgentNode.tsx (not inline in the header row) — the node is a fixed w-44 (176px) box, and an inline '— Signal Editor' next to a longer action label like 'Choose recommended story' would overflow/crowd the dot, spinner, and suppressed/retry badges that already live in that row."
  - "RunDetail.tsx's Draft-sections group is a single collapsible <tr> (default collapsed) that expands to per-writer sub-rows on click, mirroring the Graph spine's WriterExpansion.tsx precedent rather than inventing a new grouping affordance. The aggregate row shows worst-of status, summed cost/tokens, and max (not summed) duration since the 7 writers run in parallel."
  - "calibrator/chronicler render dimmed (opacity-70) with an explicit italic 'supporting step' caption instead of a fabricated agent secondary line, since RUN_STEP_MAP gives both actionLabel===agentLabel for these named:false entries — showing '— Calibrator' under 'Calibrator' would be a confusing duplicate."
  - "Per-step status pills now render the §7 vocabulary (Waiting/Running/Complete/Failed) via a small STEP_STATE_LABELS map; the top-level run.status pill is left as the raw Convex value (unchanged) since 'awaiting-review'/'cancelled' aren't part of the step-state vocabulary and remapping them wasn't in scope for this plan."
  - "Comments that needed to reference the banned legacy idle-state term (while documenting that it's banned) were phrased to avoid the literal word, so this plan's own source doesn't trip the WBN-05 tripwire (nomenclature.test.ts) once 50-06 un-skips it, and so the new runDetailActionNames.test.ts word-boundary source-scan passes cleanly."

patterns-established:
  - "Diamond/deterministic-check set is read from GATE_KEYS everywhere (PipelineGraph.tsx's isGate assignment unchanged) — no screen defines its own gate list; this plan only reconciled the copy/comments that referenced the old two-member set."

requirements-completed: [WBN-02]

# Metrics
duration: 35min
completed: 2026-07-17
---

# Phase 50 Plan 02: Run Details Action Steps + Diamonds + Framing Summary

**Wired the shared `RUN_STEP_MAP` (§7 verbatim action names) into both the Graph spine and the Runs detail table — action label primary, agent secondary everywhere — collapsed the 7 parallel writers + `validate_sections` into one expandable "Draft sections" row, and made the Run Details header state plainly whether it's a historical record or a live run.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-17T18:15:00Z (approx, first file reads)
- **Completed:** 2026-07-17T18:50:00Z (approx)
- **Tasks:** 2 completed
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments
- `PipelineGraph.tsx` now sources every graph node's label from `runStepFor(agentKey)` (`lib/nomenclature.ts`): `displayName` is the §7 action (e.g. "Find story leads"), a new `agentLabel` field carries the agent as secondary metadata. The ad hoc `toDisplayName()` title-caser is gone.
- `AgentNode.tsx` renders the agent as a small dashed secondary caption line under the action title (not crowding the header row's dot/spinner/badges); the stale "verify_research, validate_sections" gate comment now reads the reconciled `{verify_candidates, verify_research, publisher}` set. Diamond-vs-dot render logic (`isGate`) is untouched.
- `AgentIOPanel.tsx`'s operator-facing prose now says "step", never "node" (nomenclature table's Node → step); the `HandoffNode` component name and all `agentKey` identifiers are untouched per D-01.
- `RunDetail.tsx`'s per-agent table groups rows by `runStepFor().actionLabel` in real pipeline order (`PIPELINE_NODES`, not Convex insertion order): the 7 writers + `validate_sections` collapse into ONE expandable "Draft sections" row (aggregate status/cost/tokens, max duration since they run in parallel, per-section detail + the existing Re-roll button on expand); `calibrator`/`chronicler` render dimmed as "supporting step" rows using their plain fallback labels; every other row shows the action primary with the agent secondary — the raw `agentKey` never renders as a step name.
- The Run Details header now states plainly whether the run is a **historical record** (finished) or a **live run** (in-flight); per-step status pills use the §7 vocabulary (Waiting/Running/Complete/Failed).
- New `runDetailActionNames.test.ts` (11 tests): pins the §7 verbatim action labels, asserts `RUN_STEP_MAP.isDeterministicCheck` never drifts from `pipelineTopology.ts`'s `GATE_KEYS`, proves the Draft-sections collapse (all 8 keys share one action label, none are diamonds), proves `calibrator`/`chronicler`/`validate_sections` resolve non-blank `named:false` fallbacks, confirms exactly 11 distinct named action labels exist, and source-scans `RunDetail.tsx` for the banned idle-header term and the historical/live framing text.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire RUN_STEP_MAP into the Graph spine (action names + reconciled diamonds)** - `3d33be5` (feat)
2. **Task 2: RunDetail action-primary rows, Draft-sections collapse, historical-vs-live header + test** - `a94063c` (feat)

**Plan metadata:** (this commit) — docs: complete plan

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx` - node data now sources `displayName`/`agentLabel` from `runStepFor()`; removed `toDisplayName()`
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentNode.tsx` - added `agentLabel` secondary caption render + `AgentNodeData` field; updated stale gate-set comment
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx` - "node" → "step" in all operator-facing comments/JSX text
- `apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx` - full rewrite of the per-agent table into a §7 action-named, Draft-sections-collapsed, historical-vs-live-framed Run Details view
- `apps/dispatch-control/__tests__/runDetailActionNames.test.ts` - new (11 tests)
- `apps/dispatch-control/__tests__/AgentIOPanel.test.tsx` - updated 2 assertions that pinned the old "node" copy (deviation, see below)

## Decisions Made
See `key-decisions` in frontmatter for the full rationale on: secondary-caption placement in `AgentNode.tsx`, the Draft-sections collapse/expand shape, the `calibrator`/`chronicler` "supporting step" treatment, the step-state vocabulary scope (per-step only, not the top-level run status), and how banned-term-referencing comments were phrased to stay tripwire-clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `AgentIOPanel.test.tsx` pinned the pre-rename "node" copy**
- **Found during:** Task 1, first `pnpm --filter dispatch-control test -- --run AgentIOPanel` run
- **Issue:** Two existing assertions (`/This node \(input → output\)/i`, `/No upstream node/i`) asserted the literal pre-Phase-50 copy — directly invalidated by this task's "node" → "step" rename.
- **Fix:** Updated both assertions to expect "step" instead of "node", preserving the original semantic check.
- **Files modified:** `apps/dispatch-control/__tests__/AgentIOPanel.test.tsx`
- **Verification:** `pnpm --filter dispatch-control test -- --run AgentIOPanel` green (6/6).
- **Committed in:** `3d33be5` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — a direct, unavoidable consequence of this plan's copy rename)
**Impact on plan:** No scope creep — the fix only touched the two assertions whose literal strings were invalidated by the rename itself.

## Issues Encountered
- TypeScript's `noUncheckedIndexedAccess` flagged two array-index reads in `RunDetail.tsx`'s new grouping logic (`groups[idx].members.push(...)` and `group.members[0]`). Resolved by switching the grouping accumulator from an array+index-map to a `Map<string, StepGroup>` (no indexed access needed) and adding an explicit (structurally unreachable, but type-necessary) guard before reading a singleton group's sole member. Caught by `pnpm --filter dispatch-control build`, not by vitest — consistent with the project's "vitest doesn't type-check" house rule.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `RUN_STEP_MAP` now has real consumers on both Workbench surfaces (Graph spine + Runs table) — 50-03/50-05/50-06 can build on the action-primary/agent-secondary pattern being proven out twice.
- The Draft-sections collapse pattern (group-by-actionLabel, single expandable row) is now precedented in `RunDetail.tsx` for any future step that needs similar grouping.
- `rename-preservation.test.ts` and the skip-guarded `nomenclature.test.ts` both stayed green throughout — no route or stored-enum value was touched by this plan's copy changes.
- The failed-run recovery rail (WBN-03, Plan 50-05) can build directly on this plan's per-step status vocabulary (`STEP_STATE_LABELS`) and step-group shape — "Paused"/"Skipped" states are intentionally left unimplemented here since agent_runs.status never produces them at this layer (documented in a code comment for 50-05 to pick up).

---
*Phase: 50-workbench-nomenclature*
*Completed: 2026-07-17*

## Self-Check: PASSED

All 7 created/modified files confirmed present on disk; both task commits (`3d33be5`, `a94063c`) confirmed present in git history.
