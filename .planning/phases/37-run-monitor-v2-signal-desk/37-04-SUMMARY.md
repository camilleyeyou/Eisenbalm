---
phase: 37-run-monitor-v2-signal-desk
plan: 04
subsystem: ui
tags: [convex, react, run-monitor, qa-corrections, drift, dispatch-control]

# Dependency graph
requires:
  - phase: 37-03-run-monitor-spine-handoff
    provides: "PipelineGraph.tsx spine (dots/diamonds, AgentIOPanel handoff inspector), GATE_KEYS/SECTION_WRITER_KEYS in pipelineTopology.ts"
  - phase: 33-accept-fix-wiring-decision-rail
    provides: "isOpenFinding predicate (lib/galley/findingState.ts) and the rerollAgent pipeline-control client (lib/pipelineControlClient.ts)"
provides:
  - "strengthScore/flagCounts/bandFor (lib/runMonitor/strengthScore.ts) — deterministic 0-100 QA-derived section strength, reused wherever a section's open-finding health needs to render"
  - "WriterExpansion.tsx — per-section strength bars + flag counts + individual rerollAgent re-run for the 6 writer sections"
  - "DriftStrip.tsx — current run vs trailing-8-completed-runs cost/duration delta, reading pipelineRuns (not the dead dashboard runs cost/duration fields)"
affects: [37-05-signal-desk]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Component-per-row Convex subscription (DriftBar) to keep useQuery hook count stable across a variable-length trailing-run set (Research Pattern 1) — same technique 37-03 used for HandoffNode"
    - "Guarded functional setState updates (return the same object reference when data is unchanged) to let React bail out of re-render when a child's per-row effect reports unchanged data"

key-files:
  created:
    - apps/dispatch-control/lib/runMonitor/strengthScore.ts
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/WriterExpansion.tsx
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/DriftStrip.tsx
    - apps/dispatch-control/__tests__/strengthScore.test.ts
    - apps/dispatch-control/__tests__/WriterExpansion.test.tsx
    - apps/dispatch-control/__tests__/DriftStrip.test.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx

key-decisions:
  - "WriterExpansion covers the 6 re-rollable writer sections (origin_story, problem, founder_bio, case_study, game, bonus) — design is excluded from the strength-row set even though it remains on the spine as a dimmed/shown node per Phase 23 Pitfall 4; QA's _extract_sections() never scores design under one of these sectionName keys the same way"
  - "WriterExpansion mounts docked bottom-left in PipelineGraph.tsx, gated on selectedAgentKey being one of SECTION_WRITER_KEYS (all 7 fan-out nodes trigger the expansion, showing all 6 rows as a group) — positioned to avoid colliding with the existing right-hand AgentIOPanel slide-over (MON-02)"
  - "DriftStrip mounts in a run-summary strip above the ReactFlow canvas, always visible once any run exists (runId truthy) — independent of node selection"
  - "DriftBar (both WriterExpansion's data source and DriftStrip's per-row fetcher) renders nothing visually for DriftStrip's case — it is purely a Research-Pattern-1 data fetcher that reports {cost, durationMs} up to the parent via a guarded setState callback; the parent computes the trailing mean and delta text"
  - "Trailing-8 set is 'complete' or 'awaiting-review' WITH completedAt set (Pitfall 4 disambiguator) — this correctly excludes a Gate-1-paused awaiting-review row (no completedAt yet) from being miscounted as a finished trailing run"

# Metrics
duration: ~20min
completed: 2026-07-09
requirements-completed: [MON-03, MON-04]
---

# Phase 37 Plan 04: Run Monitor Strength + Drift Summary

**The 7-writers fan-out now expands into 6 per-section rows with a deterministic 0-100 QA-derived strength bar, open-finding flag counts, and an individual re-run button per section; a drift strip above the graph canvas compares the current run's cost and duration against the trailing 8 completed runs (reading `pipelineRuns`, not the dead dashboard `runs` cost/duration fields).**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-09
- **Tasks:** 3
- **Files modified:** 1 (+ 6 created)

## Accomplishments
- `lib/runMonitor/strengthScore.ts` exports `strengthScore`/`flagCounts`/`bandFor` — a pure, deterministic reduction over `qaCorrections` rows that reuses the canonical `isOpenFinding` predicate (Phase 33 Pitfall 9) so a dismissed/accepted finding never lowers a section's score; severity penalties are error −25 / warning −8 / info −2, floored at 0, banded green (≥80) / amber (50-79) / red (<50)
- `WriterExpansion.tsx` subscribes `qaCorrections.byRunId`, groups rows by `sectionName` (byte-identical to the writer agentKeys per Research Pattern 2 — no new lookup), and renders one row per re-rollable section with a strength bar, flag-count chips, and a Re-run button that calls the existing `rerollAgent` client (`POST /runs/{runId}/agents/{sectionName}/rerun`) — disabled while the run is still `running`
- `DriftStrip.tsx` reads `runs.listForWorkspace` to find the most recent 8 COMPLETED runs (excluding the current run and any Gate-1-paused `awaiting-review` row with no `completedAt`), then fetches each trailing run's `pipelineRuns` row via a per-row `DriftBar` child (stable `useQuery` hook count regardless of trailing-set size) and computes an over/under % delta vs the trailing mean for both cost and duration; fewer than 8 completed prior runs labels the actual n (`vs last 3`)
- Both components are mounted into `PipelineGraph.tsx`: `DriftStrip` in an always-visible run-summary strip above the canvas, `WriterExpansion` docked bottom-left when the selected node is one of the 7 section-writer fan-out nodes

## Task Commits

Each task was committed atomically:

1. **Task 1: Deterministic strengthScore lib (MON-03 core)** - `0b6eb91` (feat)
2. **Task 2: WriterExpansion — per-section strength bars + flag counts + per-section re-run (MON-03)** - `6bfa7c3` (feat)
3. **Task 3: DriftStrip (MON-04) + mount both into PipelineGraph** - `4afd16a` (feat)

**Plan metadata:** (this commit) `docs: complete 37-04 plan`

_Note: all 3 tasks were marked `tdd="true"`; behavior tests were authored alongside each implementation in the same commit (matching the 37-03 precedent) since none of the three test files pre-existed as a separate Wave 0 scaffold in this repository._

## Files Created/Modified
- `apps/dispatch-control/lib/runMonitor/strengthScore.ts` - `strengthScore`/`flagCounts`/`bandFor`, built on the shared `isOpenFinding` predicate
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/WriterExpansion.tsx` - per-section strength bar + flag counts + re-run rows for the 6 writer sections
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/DriftStrip.tsx` - current-run-vs-trailing-8 cost/duration delta strip
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx` - mounts `DriftStrip` (run-summary strip) and `WriterExpansion` (bottom-left, gated on section-writer node selection)
- `apps/dispatch-control/__tests__/strengthScore.test.ts` (new) - 13 tests: empty/single-severity/floor-at-0/closed-finding-exclusion/mixed for `strengthScore`, `flagCounts`, and `bandFor` threshold coverage
- `apps/dispatch-control/__tests__/WriterExpansion.test.tsx` (new) - 6 tests: per-section rows, 100/green with no findings, score/band drop on an open error, closed findings excluded, `rerollAgent` called with `sectionName` as `agentKey`, re-run disabled while running
- `apps/dispatch-control/__tests__/DriftStrip.test.tsx` (new) - 4 tests: 8-trailing-run delta math, n<8 labelling, Gate-1-paused row exclusion, `parseCostJson` read path (not a raw numeric field)

## Decisions Made
- The strength-row set is the 6 re-rollable writer sections, not all 7 `SECTION_WRITER_KEYS` — `design` stays on the spine (dimmed when suppressed per Phase 23 Pitfall 4) but isn't QA-scored under one of these `sectionName` keys, so it has no strength row of its own; clicking the `design` node still triggers the expansion (it's part of the same fan-out group) but the group shows the 6 scored sections.
- `WriterExpansion` and `DriftStrip` both delegate their per-row Convex fetch to a small `DriftBar`/child-component pattern (Research Pattern 1) rather than looping `useQuery` calls directly in the parent — this is the same technique 37-03's `HandoffNode` used for the fan-out/fan-in handoff inspector, kept consistent across the phase.
- `DriftStrip`'s parent-level state updates from child data are guarded to return the same object reference when the incoming values are unchanged, letting React bail out of the resulting re-render rather than looping.
- Positioning: `DriftStrip` sits in a persistent top strip (always relevant once a run exists), while `WriterExpansion` is an on-demand bottom-left panel triggered by node selection — chosen so the two never visually collide with each other or with the existing right-hand `AgentIOPanel`.

## Deviations from Plan

None - plan executed exactly as written. All three `must_haves.key_links` (WriterExpansion → rerun endpoint via `rerollAgent`; DriftStrip → `pipelineRuns.byRunId`; strengthScore → `isOpenFinding`) are satisfied by direct reuse of existing, tested call sites — no new endpoints or Convex queries were needed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. This plan touches only `apps/dispatch-control` frontend components and their tests.

## Next Phase Readiness

- Run Monitor v2 is now complete: the forensic spine (37-03, MON-01/MON-02) plus the strength expansion and drift strip (37-04, MON-03/MON-04) together satisfy all four Run Monitor requirements for this phase.
- 37-05 (Signal Desk) is unaffected by and does not depend on anything built in this plan — it builds out the `signal-desk` stub against `pitchLog`/`deliberationEvents`/the resume endpoint, a separate surface.
- Full verification green:
  - `pnpm --filter dispatch-control test:unit` → 461 passed, 2 todo (52 files, 1 skipped)
  - `pnpm --filter dispatch-control build` → exit 0

No blockers for 37-05.

---
*Phase: 37-run-monitor-v2-signal-desk*
*Completed: 2026-07-09*

## Self-Check: PASSED

All 7 created/modified source+test files and the SUMMARY itself confirmed present on disk; all 3 task commit hashes (`0b6eb91`, `6bfa7c3`, `4afd16a`) confirmed present in `git log`.
