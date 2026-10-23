---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 11
subsystem: dispatch-control
tags: [jargon-sweep, copy, tripwire]
requires: [56-01, 56-02, 56-03]
provides: ["plain-word 'What the writers are told' pages", "adminAgentsJargon tripwire"]
key-files:
  modified:
    - apps/dispatch-control/app/admin/agents/page.tsx
    - apps/dispatch-control/app/admin/agents/[agentKey]/page.tsx
    - apps/dispatch-control/app/admin/agents/_components/AgentPromptEditorView.tsx
    - apps/dispatch-control/app/admin/agents/_components/TestRunPanel.tsx
    - apps/dispatch-control/app/admin/agents/_components/AssembledPreview.tsx
    - apps/dispatch-control/app/admin/agents/_components/VersionHistoryPanel.tsx
    - apps/dispatch-control/app/admin/agents/_components/PromptEditor.tsx
    - apps/dispatch-control/__tests__/promptVersionOrigin.test.ts
  created:
    - apps/dispatch-control/__tests__/adminAgentsJargon.test.ts
duration: ~15m
completed: 2026-10-22
---

# Phase 56 Plan 11: Dial pages sweep (writers' instructions) Summary

Both "What the writers are told" pages now open with the sub-page slab and "Back to behind the scenes", show writers by plain name, and a source-scan tripwire covers all 13 owned files.

## Relabels
- List page: h1 "What the writers are told", intro "The instructions each writer follows. Earlier versions are kept, so any change can be undone."; eyebrow "System Workbench" removed.
- Detail page: h1 = plainNameForKey(agentKey); "Agent instruction" becomes "Instructions".
- Origin banner: "in run" becomes "in issue"; "View the motivating output" becomes "See the writing that led to this change".
- AssembledPreview: "What the writer sees", plain explanation.
- TestRunPanel: Run becomes "Try it" / "Trying…"; "Replay a real run" becomes "Replay a past issue"; Prior run becomes Past issue (status and prior_run_id text dropped); Tokens in/out become Words read / Words written; "Compare failed" becomes "Comparing did not work"; aria label "How to try it"; "pipeline" text removed.
- VersionHistoryPanel and PromptEditor: run/pipeline wording replaced.

## Buttons (bug 9)
"Improve this agent" never existed as a control in app/admin/agents (comments only); the live control is in the runs inspector footer (InspectorFooter), outside this plan. Comments here were reworded to "Suggest better instructions". No control removed or wired here.

## Deviations
- [Rule 1] promptVersionOrigin.test.ts asserted the old link text; updated (not in the plan file list).
- Drift label: none existed in these files.

## Verification
Tripwire green; listed tests green; full suite 116 files + this plan's tripwire, 1 skipped, all passing; strict `pnpm build` exits 0.

## Self-Check: PASSED
Commit 2efd92a5 exists; tripwire file exists.
