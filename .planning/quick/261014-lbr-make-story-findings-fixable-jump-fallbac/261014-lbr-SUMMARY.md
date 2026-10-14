---
phase: quick-261014-lbr
plan: 01
subsystem: dispatch-control review-desk
tags: [findings, review-desk, ux]
key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/storyFindingActions.ts
    - apps/dispatch-control/__tests__/storyFindingActions.test.ts
  modified:
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFindingsRail.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFocusView.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx
    - apps/dispatch-control/__tests__/StoryFindingsRail.test.tsx
completed: 2026-10-14
---

# Quick 261014-lbr: Make story findings fixable

Findings-rail cards are now grouped by quoted passage, always have a live action (Jump to it never silently fails; falls back to "Fix it in the editor", which focuses and selects the quoted text), and offer Apply fix / Dismiss through the existing `acceptFinding` / `dismissFinding` helpers.

## Commits
- 6691f142 helpers + tests (storyFindingActions)
- 577a1d48 StoryFindingsRail regrouped into fixable cards
- dcba5422 StoryFocusView / SectionEditorPanel / ReviewDeskRunView wiring, duplicate QA box removal, strict-null fixes

## Notes
- Tab badge and meta "N open" remain per-finding counts (shared `chipCounts` source, D-25). The rail reconciles with "from N findings" in its header.
- Apply fix is intentionally absent on game / theme / non-specAd bonus: the server accept path returns `accept_unavailable` there.

## Deviations
- [Extra scope] Duplicate "QA finding" reason box when the editor opens from a finding: removed the copy in StoryFocusView, kept the one in SectionEditorPanel (closest to the editor fields).
- [Rule 3 - Build] Strict type-check required non-null assertions on indexed array access in storyFindingActions.ts and StoryFindingsRail.tsx.
- FindingsError constructor takes 3 args; tests pass a message.

## Verification
- `pnpm --filter dispatch-control test`: 152 files passed, 1298 tests passed (baseline on HEAD: 151 passed / 1280). One run showed a transient failure in WorkspaceApprovalPanelLoop.test.tsx under load; it passes in isolation and on rerun and does not involve the changed files.
- `pnpm --filter dispatch-control build`: passes.

## Self-Check: PASSED
