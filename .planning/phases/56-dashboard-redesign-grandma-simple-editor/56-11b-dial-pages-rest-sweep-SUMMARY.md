---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 11b
subsystem: dispatch-control
tags: [jargon-sweep, plain-words, tripwire]
requires: [56-01, 56-02, 56-03]
provides: [plain-worded dial sub-pages, adminPagesJargon tripwire]
affects: [apps/dispatch-control/app/admin/{tests,automation,finance,settings,charities}]
key-files:
  created: [apps/dispatch-control/__tests__/adminPagesJargon.test.ts]
  modified: [admin tests/automation/finance/settings/charities pages and components, components/help/helpCopy.ts, __tests__/nextRunDisplay.test.tsx]
decisions:
  - "Settings AuditLogViewer has no Agent/Run columns; relabelled Actor to Who and Resource to What it was about instead"
metrics:
  completed: 2026-10-22
---

# Phase 56 Plan 11b: Dial pages rest sweep Summary

Five remaining dial sub-pages now open with the sub-page slab ("Nothing here is needed to publish this week's issue." / ghost "Back to behind the scenes"), carry the dial-label h1, and are plain-worded, with a 16-file source-scan tripwire.

## Relabels
- Quality tests: h1 "Quality tests"; "Drift scoreboard" to "Change in quality"; "Preview next run" to "Practice issue" (heading, aria-label, button "Making a practice issue…"); explanatory copy de-jargoned.
- Schedule and limits: h1 (was "Config"); "Danger Zone" to "Stopping an issue" with plain stop instructions; "Scheduled runs" to "Start issues on a schedule"; "Next run:" to "Next issue starts:"; "Per-run cap (USD)" to "Most one issue may cost (USD)"; estimate/empty-state copy; auto-publish toggle/dialog to "Publish by itself".
- Money: h1 (was "Finance"), slab, title.
- Settings: slab; notification options "Issue finished" / "Something went wrong" / "Ready for your review"; audit columns Who / What it was about.
- Charities: h1 "Charities", slab, eyebrow "Behind the scenes"; RegistryTable untouched.
- helpCopy.ts: run/pipeline/agents wording swapped for issue/writers.

No buttons removed or wired. Tests updated: nextRunDisplay.test.tsx (EvalCenter and auditViewer needed no change; they use test ids).

## Deviations
None. Pre-existing `text-white` in ShadowRunPanel is outside the 13 swap-guarded files; left alone.

## Verification
Strict `pnpm --filter dispatch-control build` passes; full suite 118 files passed, 1095 tests passed.

## Commits
40aa73d1 (relabel), 93059e5e (tripwire).

## Self-Check: PASSED
