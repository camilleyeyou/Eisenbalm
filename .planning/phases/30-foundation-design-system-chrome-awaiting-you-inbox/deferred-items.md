# Deferred Items — Phase 30

Out-of-scope discoveries logged during plan execution (SCOPE BOUNDARY rule —
not fixed here, tracked for the phase verifier / other in-flight plans).

## From 30-04 (Masthead)

- **Full `pnpm --filter dispatch-control test -- --run` was red at the time
  30-04 executed** (49 failed / 131 passed / 2 todo across 12 files), but
  every failing file belongs to OTHER concurrently-executing Phase 30 plans
  mid-flight in the same working tree (parallel execution):
  - `runControl.test.tsx`, `AgentNode.test.tsx`, `pipelineTopology.test.ts` —
    import paths broken by the in-progress `runs/` + `graph/` → `run-monitor/`
    route move (30-02/30-05 territory)
  - `screen-token-swap.test.ts` — RED-scaffold source-scan for the
    Config/Finance/Settings literal-class pass (30-03's own task, not yet
    complete at the time of this snapshot)
  - `nav.test.ts` — grouped-nav rewrite in flight (30-05)
  - `variableMaps.test.ts`, `VariableRegistry.test.ts`, `DiffViewer.test.tsx`,
    `PromptEditor.test.tsx`, `assembledPreview.test.ts`, `markerExport.test.ts`,
    `promptDescriptions.test.ts` — pre-existing Phase 28 prompt-console files
    that also moved under the `prompts/` → `prompt-lab/` rename (30-02/30-05
    territory), unrelated to this plan's `Masthead.tsx` / `(dashboard)/layout.tsx`
    changes
  - None of these files were touched by 30-04. `pnpm --filter dispatch-control
    test -- --run Masthead` (9/9 green) and `pnpm --filter dispatch-control
    build` (exit 0, all 19 routes compiled including the moved `run-monitor/*`
    and `prompt-lab/*` paths) both passed cleanly for the 30-04 diff.
  - Action: none from 30-04. The phase orchestrator's post-merge full-suite
    run (after all parallel plans land) is the correct place to re-verify
    the complete green baseline.
