---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 12
subsystem: dispatch-control
tags: [retirement, tripwire, tests]
requires: [56-05, 56-06, 56-07, 56-08, 56-09, 56-10, 56-10b, 56-11, 56-11b]
provides: [retirement tripwire, style tripwire, copy tripwire]
affects: [apps/dispatch-control]
key-files:
  created:
    - apps/dispatch-control/__tests__/editorRetirement.test.ts
    - apps/dispatch-control/__tests__/editorStyle.test.ts
    - apps/dispatch-control/__tests__/editorCopy.test.tsx
  modified:
    - apps/dispatch-control/app/(editorial)/layout.tsx
    - apps/dispatch-control/app/admin/layout.tsx
    - apps/dispatch-control/lib/homeSections.ts
decisions:
  - "Deleted the whole components/inspector set (client bug 9) because nothing under app/ used it"
metrics:
  completed: 2026-10-22
  tasks: 3
---

# Phase 56 Plan 12: Retirement and Tripwires Summary

Every retired editor component is deleted, and three tests now fail if any of them (or banned copy, mono/uppercase/small type, run ids, extra h1 or primary buttons) comes back.

## What was done

- Deleted: HeldIssueRow, CommandPalette, StopRunButton, RunDetail, RecoveryRail, RerollButton, plus RecoveryRail.test and runDetailActionNames.test; removed the RerollButton block from runControl.test.
- Dropped dead `*_SENTENCE` constants and `rowNote` from `lib/homeSections.ts` (and their tests); `SECTION_DESCRIPTORS` deliberation text now reads "How the writers chose this charity". `deriveHomeSections`/`deriveHomeFooter` untouched.
- Client bug 9 ("Improve this agent"): it lived in `components/inspector/InspectorFooter.tsx`. `useInspector` had no callers under `app/`, so the inspector was unmounted from both layouts and the whole `components/inspector/` directory (4 files) was deleted, with InspectorFooter/Panel/Provider tests and the InspectorFooter block of promptVersionOrigin.test (the saveVersion/originRef parts remain). `lib/inspector/*` stays (used by AgentIOPanel). The retirement test scans both `app/` and `components/` for the string.
- Tripwires: editorRetirement (files gone, no imports, no Admin label/UserButton, banned button copy), editorStyle (source scan, 14px allowed only on the Behind-Run monospace pre line), editorCopy (Home x10 states, Section x3, Archive x2, Behind hub, Behind-Run x3: no banned word/run id/Interrupt outside pre, one h1, <=1 data-primary, no disabled).

## Deviations from Plan

**[Rule 3 - tripwire fixes]** Tripwires flagged real violations, fixed in place:
- `app/(editorial)/_components/HoldStopFooter.tsx`: text-[16px] -> text-[15px].
- `app/(editorial)/s/[section]/_components/SectionArticle.tsx`: text-[22px] -> text-[23px].
- `app/admin/runs/[runId]/page.tsx`: comment "Run Detail" reworded.
- The loading skeleton state is allowed zero h1 in editorCopy (no heading exists while loading); all other states require exactly one.
- Scope extension (requested): inspector deletion described above, beyond the plan's "unmount if unused".

## Verification

- `pnpm --filter dispatch-control build`: exit 0.
- `pnpm --filter dispatch-control test`: 116 files passed, 1 skipped; 1098 tests passed, 2 todo, 0 failed.
- `git diff --name-only 58124eef..HEAD -- convex/ packages/pipeline/`: empty, no Convex sync needed.

## Commits

- 0c44c11d refactor(56-12): delete retired editor components, inspector and dead copy
- 83c5323b test(56-12): retirement, style and copy tripwires over the editor screens

## Known Stubs

None.

## Self-Check: PASSED
