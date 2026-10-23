---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 10b
subsystem: dispatch-control
tags: [jargon-sweep, copy, tripwire]
requires: [56-01, 56-02, 56-03]
provides: [plain-word map page, adminGraphJargon tripwire]
key-files:
  created: [apps/dispatch-control/__tests__/adminGraphJargon.test.ts]
  modified: [app/admin/runs/graph/page.tsx, app/admin/runs/graph/_components/{AgentIOPanel,AgentNode,DriftStrip,WriterExpansion}.tsx, __tests__/{AgentIOPanel,AgentNode,DriftStrip,WriterExpansion}.test.tsx]
requirements: [P56-A2, P56-A3]
metrics:
  completed: 2026-10-23
---

# Phase 56 Plan 10b: Map page jargon sweep Summary

The map page now reads as "How the steps connect" with plain step names, and a source-scan test keeps jargon out.

## Relabels (old -> new)
- Pipeline Graph -> How the steps connect; "Live agent DAG..." -> "Click a step to see what it was given, what it wrote, and what it cost."
- Node titles (raw keys / Calibrator / Chronicler) -> `plainNameForKey`; agent-name caption removed
- suppressed -> Switched off; queued -> StatusWord "Not yet"; "Retry count" -> "Times retried"
- Drift -> Change in quality; "vs last N" -> "compared with the last N issue(s)"
- Section Strength -> How strong each part is; Re-run / Re-running -> Rewrite / Rewriting; E/W/I tooltips -> Problems to fix / Things to check / Notes
- Tokens in/out -> Words read / Words written; Handoff -> How it was passed on; Metrics -> Numbers; Error -> What went wrong
- Upstream/downstream labels -> What came in from before / What goes on to the next step; Input/Output Snapshot (raw) -> What it was given / wrote (raw); Show raw JSON -> Show technical details
- Panel title, handoff names and status line use plain names / `runStatusWord`
- Removed uppercase/tracking from visible labels

## Deviations
None. Component and file names unchanged. Tests updated for new text.

## Verification
Strict `pnpm --filter dispatch-control build` passes; full suite 116 files passed, 1066 tests.

## Self-Check: PASSED
Commit e4cad08a present; tripwire test passes.
