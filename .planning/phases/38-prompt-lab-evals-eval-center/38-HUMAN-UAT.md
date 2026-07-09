---
status: partial
phase: 38-prompt-lab-evals-eval-center
source: [38-VERIFICATION.md]
started: 2026-07-09T00:00:00Z
updated: 2026-07-09T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Eval drawer auto-select + scoreboard deltas (EVL-02)
expected: Edit a prompt in the Prompt Lab; the affected agent's scenarios auto-select and, on "Run evals", show per-scenario draft-vs-active deltas + an aggregate. (Requires live OpenRouter calls.)
result: [pending]

### 2. Commit gate blocks + override works, live (EVL-03)
expected: Attempt to commit a prompt that regresses a scenario → activate is blocked with a reason; supplying an override reason commits and writes both audit rows.
result: [pending]

### 3. Commit gate CLEAN PASS on the non-override path (EVL-03)
expected: Edit with no regression, click "Run evals for v{N}" on the saved version (writes commit-tagged eval_scores), then Activate(N) WITHOUT override → succeeds (blocked:false, no overridden flag). Code-verified by unit test; confirm the live round-trip.
result: [pending]

### 4. Eval Center drift time-series (EVL-04)
expected: The Eval Center shows scenario cards (description / what-it-catches / last result) and an append-only time-series that grows with each eval run (drift detector), not a single latest number.
result: [pending]

### 5. Shadow run isolation, live (EVL-05)
expected: Run a shadow discovery from the Eval Center; the preview renders AND no pitchLog/pipelineRuns/agent_runs rows and no Sanity charity docs are written. (Requires live search + inspecting Convex/Sanity state.)
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
