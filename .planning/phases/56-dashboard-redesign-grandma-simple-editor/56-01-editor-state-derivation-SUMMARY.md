---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 01
subsystem: dispatch-control
tags: [pure-derivation, status-words, editor-copy, tdd]
requires: []
provides:
  - lib/editorState.ts (single pure source for every editor screen)
  - STATUS_WORDS / STATUS_WORD_ORDER in lib/nomenclature.ts
  - formatIssueLine, issueThursday, formatLongDate, EDITOR_TIME_ZONE, NO_CHARITY_YET in lib/issueTitle.ts
  - issueOpenHref now opens past issues at /?run=<runId>
  - __tests__/helpers/jargonScan.ts (shared tripwire helper)
affects: [56-02..56-13]
tech-stack:
  added: []
  patterns: [wrap deriveHomeFooter, never fork it; pass `now` instead of reading the clock]
key-files:
  created:
    - apps/dispatch-control/lib/editorState.ts
    - apps/dispatch-control/__tests__/editorState.test.ts
    - apps/dispatch-control/__tests__/BehindSteps.test.ts
    - apps/dispatch-control/__tests__/helpers/jargonScan.ts
    - apps/dispatch-control/__tests__/jargonScan.test.ts
  modified:
    - apps/dispatch-control/lib/nomenclature.ts
    - apps/dispatch-control/lib/issueTitle.ts
    - apps/dispatch-control/lib/issueRouteResolver.ts
    - apps/dispatch-control/__tests__/issueTitle.test.ts
    - apps/dispatch-control/__tests__/issueRouteResolver.test.ts
    - apps/dispatch-control/__tests__/ArchiveScreen.test.tsx
key-decisions:
  - "A1 issue Thursday = publishedAt, else scheduledFor, else first Thursday on/after runStartedAt in America/Los_Angeles"
  - "A3a stopped has its own slab copy; A3b gate1 = 'stuck' (Waiting for you, action Stop this issue)"
  - "A4 unstarted steps read 'Not yet', never 'Not started'"
  - "A5 archive reasons are generic (title null vs set), not per failing step"
  - "A6 hold reason fixed 'Held by the editor' (COPY.holdReason)"
  - "A7 older unpublished issue = 'older', read-only, never publishable"
  - "A8 every dial sub-page gets COPY.subPageSlab"
requirements-completed: [P56-B1, P56-B2, P56-A3]
duration: ~20 min
completed: 2026-10-22
---

# Phase 56 Plan 01: Editor State Derivation Summary

One pure module (`lib/editorState.ts`) now maps every run/issue state onto the six words (Done, Working, Waiting for you, Not yet, Stopped, Problem), the four stations, per-state slab copy, part rows, archive grouping, the ten Behind steps, rewrite rules and the shared banned-word pattern.

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 | STATUS_WORDS, formatIssueLine/issueThursday, issueOpenHref -> /?run= | 97a593de (+ a6edc592 ArchiveScreen test expectation) |
| 2 | editorState: Home, slab, parts, runs, archive, rewrite, cost, COPY | b80d5d64 |
| 3 | PLAIN_STEPS, deriveBehindSteps, plainNameForKey, jargonScan helper | 88697ba2 |

## Exports

editorState.ts: PART_ORDER, PART_LABELS, STATION_NAMES, HomeState, StationVM, EditorHomeVM, deriveEditorHome, SlabAction, SlabCopy, homeSlabCopy (ctx has optional `pinned`), partRowStatus, partsHint, runStatusWord, ArchiveRowVM, deriveArchiveRows, AGENT_FOR_SECTION, canRewrite, formatCostLine, EDITOR_BANNED_PATTERN, RUN_ID_PATTERN, COPY, formatClock, PlainStep, PLAIN_STEPS, plainNameForKey, StepVM, deriveBehindSteps, firstProblemStep.

## Assumptions (override any)

- A1 Thursday rule above. A3a, A3b, A4, A5, A6, A7, A8 as listed in key-decisions.
- A2 (not in plan list): ArchiveRowVM.publishedUrl is `/issue/<slug>` (relative public path); downstream plan must prefix the public site origin.
- Extra: `held` + running keeps the in-progress stations; `older` shows underlying progress with Publish "Not yet" and no current station; ready with Collaborator role undefined-while-loading shows the editor sentence with no action.

## Deviations from Plan

**1. [Rule 3 - Blocking] ArchiveScreen.test.tsx expectation updated** to `/?run=...`, since `issueOpenHref` changed as the plan required. Plan 56-07 rebuilds Archive.
**2. [Rule 1 - Bug] Strict build type error** (`issueLabel[0]` possibly undefined) fixed with `charAt(0)` before the final commit.

Minor: `grep -c "agentKeys:"` returns 11, not 10, because the `PlainStep` interface line also matches; there are exactly 10 steps.

## Verification

Full vitest suite: 108 files passed, 1024 tests passed (the known SectionReaderPage baseline did not fail in this run). `pnpm --filter dispatch-control build` passes.

## Known Stubs

None.

## Self-Check: PASSED
