---
phase: 50-workbench-nomenclature
plan: 00
subsystem: ui
tags: [nextjs, vitest, react-flow, langgraph, nomenclature, dispatch-control]

# Dependency graph
requires:
  - phase: 46-signal-editor-candidate-verification
    provides: "signal_editor + verify_candidates nodes live in packages/pipeline/.../graph/builder.py (the 20-node graph this plan reconciles the frontend topology against)"
provides:
  - "pipelineTopology.ts reconciled to the live 20-node graph (was stale at 18, missing signal_editor/verify_candidates)"
  - "GATE_KEYS reconciled to the §7 diamond set {verify_candidates, verify_research, publisher} (was {verify_research, validate_sections})"
  - "lib/nomenclature.ts — the D-06 shared Workbench label source of truth (WORKBENCH_NAV_LABELS, RUN_STEP_MAP, runStepFor, PRODUCT_TERMS)"
  - "signal_editor registered in VariableRegistry.ts + promptDescriptions.ts so Agent Instructions can edit it"
  - "nomenclature.test.ts — skip-guarded WBN-05 banned-term source-scan scaffold, ready for 50-06 to un-skip"
  - "rename-preservation.test.ts — active D-02/D-03 route + stored-enum preservation guard"
affects: [50-01-nav-rename-role-indicator, 50-02-run-details-action-steps-diamonds-framing, 50-03-automation-reframe-typed-confirm-donotuse, 50-05-failed-run-recovery-rail-honest-restart, 50-06-nomenclature-sweep-tripwire-green]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Diamond set derived, not duplicated: RUN_STEP_MAP's isDeterministicCheck is computed from GATE_KEYS at module load (Object.fromEntries over a raw RunStepSource table), so the nomenclature module can never define a second, driftable diamond definition."
    - "JSX-text/string-prop-only source-scan tripwire (nomenclature.test.ts) extends the existing recursive-fs regex-scan pattern (roleGateInventory.test.ts / dispatch-control-no-sanity-write.test.ts) with a lightweight JSX-text + prop-value extractor, so banned-term matches never trip on raw identifiers, route paths, or comments."

key-files:
  created:
    - apps/dispatch-control/lib/nomenclature.ts
    - apps/dispatch-control/__tests__/nomenclature.test.ts
    - apps/dispatch-control/__tests__/rename-preservation.test.ts
  modified:
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts
    - apps/dispatch-control/__tests__/pipelineTopology.test.ts
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VariableRegistry.ts
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/promptDescriptions.ts
    - apps/dispatch-control/__tests__/AgentIOPanel.test.tsx

key-decisions:
  - "GATE_KEYS reconciled to follow §7 literally: added verify_candidates AND publisher, dropped validate_sections (not a distinct §7 step) — per RESEARCH Open Q #2/#3's recommendation to honor the spec's verbatim diamond marks rather than inventing a different rule."
  - "RUN_STEP_MAP's isDeterministicCheck field is derived from GATE_KEYS programmatically (not hand-typed per entry) so the nomenclature module structurally cannot drift out of sync with the topology's diamond set."
  - "WBN-02/WBN-05 requirements NOT marked complete by this plan — this is Wave 0 prerequisite/scaffolding only (topology fix + label module + skip-guarded tripwire). The ROADMAP's own plan list assigns the actual behavior delivery to 50-02 (WBN-02: action-named steps rendering) and 50-06 (WBN-05: nomenclature sweep + tripwire un-skipped green) — those plans will flip the requirement checkboxes."

patterns-established:
  - "Nomenclature/label source-of-truth module (lib/nomenclature.ts) mirrors the existing agentList.ts humanized-label precedent but lives at the app-wide lib/ level since it spans nav labels + run steps, not just Prompt Lab."

requirements-completed: []

# Metrics
duration: 20min
completed: 2026-07-17
---

# Phase 50 Plan 00: Topology + Nomenclature Module + Tripwire Scaffolds Summary

**Reconciled the stale 18-node `pipelineTopology.ts` to the live 20-node pipeline graph (adding `signal_editor`/`verify_candidates` and a 3-member `GATE_KEYS` diamond set), built `lib/nomenclature.ts` as the single §7 action-name/nav-label source of truth, and authored two source-scan tripwires (one skip-guarded, one active) proving no route or stored enum gets renamed.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-16T17:52:00-07:00 (approx, first file reads)
- **Completed:** 2026-07-16T18:03:09-07:00
- **Tasks:** 3 completed
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments
- `pipelineTopology.ts` now declares all 20 pipeline nodes in build order (matching `packages/pipeline/.../graph/builder.py` exactly) with the real discovery-chain edges (`calibrator→signal_editor→scout→verify_candidates→advocate`), unblocking every later Wave-1+ plan that needs these nodes to exist in the frontend topology.
- `GATE_KEYS` reconciled to spec §7's diamond marks: `{verify_candidates, verify_research, publisher}` — `validate_sections` dropped (not a named §7 step).
- `lib/nomenclature.ts` created as the D-06 shared source of truth: `WORKBENCH_NAV_LABELS`, the verbatim §7 `RUN_STEP_MAP` (action-primary/agent-secondary, 7 writers collapsed to one "Draft sections" step), a `runStepFor()` resolver with a deterministic humanized fallback, and `PRODUCT_TERMS` for later sweep plans to reuse.
- `signal_editor` registered in `VariableRegistry.ts` (`{avoid_note}` system token, `{results_block}` user-template token) and `promptDescriptions.ts`, closing the "Improve this agent" dead-link gap on Run Details' first step (RESEARCH Pitfall 6).
- Two tripwire test files authored: `nomenclature.test.ts` (WBN-05 banned-term sweep, skip-guarded for 50-06) and `rename-preservation.test.ts` (D-02/D-03 route + stored-enum guard, active and green now).

## Task Commits

Each task was committed atomically:

1. **Task 1: Reconcile pipelineTopology.ts to the live 20 nodes + 3-diamond set + its test** - `d8260d6` (feat)
2. **Task 2: Build the shared nomenclature module (RUN_STEP_MAP + renamed-term constants)** - `b101634` (feat)
3. **Task 3: Author the nomenclature + preservation tripwire scaffolds** - `9d60af1` (test)

**Plan metadata:** (this commit) — docs: complete plan

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts` - 20-node topology, reconciled edges, reconciled GATE_KEYS
- `apps/dispatch-control/__tests__/pipelineTopology.test.ts` - updated to assert 20 nodes, the 4 new edges, and the 3-member GATE_KEYS
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VariableRegistry.ts` - added `signal_editor`/`signal_editor_user` token sets + `avoid_note` description/sample
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/promptDescriptions.ts` - added `signal_editor`/`signal_editor_user` descriptions (deviation, see below)
- `apps/dispatch-control/__tests__/AgentIOPanel.test.tsx` - fixed calibrator's expected downstream (now `signal_editor`, not `scout`) (deviation, see below)
- `apps/dispatch-control/lib/nomenclature.ts` - new D-06 label/action-name source of truth
- `apps/dispatch-control/__tests__/nomenclature.test.ts` - new skip-guarded WBN-05 banned-term tripwire scaffold
- `apps/dispatch-control/__tests__/rename-preservation.test.ts` - new active D-02/D-03 preservation guard

## Decisions Made
- Followed §7 literally for the diamond set: added `verify_candidates` AND `publisher`, dropped `validate_sections` — resolving RESEARCH's Open Questions #2/#3 toward "honor the spec's verbatim diamond marks."
- Computed `isDeterministicCheck` in `lib/nomenclature.ts` from `GATE_KEYS` rather than hand-typing it per entry, per the plan's explicit instruction not to define a second diamond set literal.
- Did NOT call `requirements mark-complete` for WBN-02/WBN-05 in this plan (see Deviations/Issues below) — deferred to 50-02 and 50-06, the plans the ROADMAP explicitly assigns the actual user-facing delivery to.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `promptDescriptions.test.ts` coverage would have broken on the new VARIABLE_REGISTRY keys**
- **Found during:** Task 1 (registering `signal_editor` in `VariableRegistry.ts`)
- **Issue:** `promptDescriptions.test.ts` asserts `PROMPT_DESCRIPTIONS` is a superset of `Object.keys(VARIABLE_REGISTRY)` (D-09 "no half-covered keys"). Adding `signal_editor`/`signal_editor_user` to `VARIABLE_REGISTRY` without a matching description would have failed this existing test.
- **Fix:** Added `signal_editor` and `signal_editor_user` one-line descriptions to `promptDescriptions.ts`, matching the file's existing brand-agnostic phrasing convention.
- **Files modified:** `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/promptDescriptions.ts`
- **Verification:** `pnpm --filter dispatch-control test -- --run promptDescriptions` green (4/4).
- **Committed in:** `d8260d6` (Task 1 commit)

**2. [Rule 1 - Bug] `AgentIOPanel.test.tsx` pinned the stale calibrator→scout edge**
- **Found during:** Task 1 (updating `pipelineTopology.ts`'s edges)
- **Issue:** An existing test asserted calibrator's one downstream node renders as `scout` — true under the stale 18-node topology, now false under the reconciled 20-node graph (calibrator's real downstream is `signal_editor`).
- **Fix:** Updated the assertion to expect `signal_editor`, with a comment explaining the Phase 50 D-08 topology reconciliation.
- **Files modified:** `apps/dispatch-control/__tests__/AgentIOPanel.test.tsx`
- **Verification:** `pnpm --filter dispatch-control test -- --run AgentIOPanel` green (6/6); full suite re-run confirmed no other regressions.
- **Committed in:** `d8260d6` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs directly caused by this plan's topology change)
**Impact on plan:** Both fixes were necessary consequences of reconciling the topology to the live 20-node graph. No scope creep — no other files were touched.

## Issues Encountered
None beyond the two auto-fixed test regressions documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `signal_editor` and `verify_candidates` now exist in the frontend topology and diamond set — Wave 1 plans (50-01, 50-02, 50-03) can now build on a correct 20-node graph.
- `lib/nomenclature.ts` is authored but NOT yet wired into any screen — 50-01 (nav) and 50-02 (Run Details action steps) are the first consumers.
- `nomenclature.test.ts` is intentionally RED-if-unskipped today (operator copy hasn't been swept yet) — 50-06 is the plan that sweeps the copy and un-skips it.
- WBN-02 and WBN-05 requirement checkboxes are deliberately left unchecked by this plan (see Decisions Made) — no blocker, this is expected given the ROADMAP's own wave assignment.

---
*Phase: 50-workbench-nomenclature*
*Completed: 2026-07-17*

## Self-Check: PASSED

All 9 created/modified files confirmed present on disk; all 3 task commits (`d8260d6`, `b101634`, `9d60af1`) confirmed present in git history.
