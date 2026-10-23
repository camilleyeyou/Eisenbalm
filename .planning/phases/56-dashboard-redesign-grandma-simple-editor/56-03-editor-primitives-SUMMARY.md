---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 03
subsystem: dispatch-control
tags: [components, primitives, accessibility]
requires: [56-01, 56-02]
provides: [NextStepSlab, StatusWord, StatusMarker, Stations, StepList, PartsList]
affects: [wave-3 editor screens]
key-files:
  created:
    - apps/dispatch-control/components/editor/StatusWord.tsx
    - apps/dispatch-control/components/editor/NextStepSlab.tsx
    - apps/dispatch-control/components/editor/Stations.tsx
    - apps/dispatch-control/components/editor/StepList.tsx
    - apps/dispatch-control/components/editor/PartsList.tsx
    - apps/dispatch-control/__tests__/NextStepSlab.test.tsx
    - apps/dispatch-control/__tests__/Stations.test.tsx
    - apps/dispatch-control/__tests__/StepList.test.tsx
    - apps/dispatch-control/__tests__/PartsList.test.tsx
decisions:
  - Primary action may be a button or, when `href` is given, an anchor; both carry data-primary.
metrics:
  tasks: 3
  completed: 2026-10-22
---

# Phase 56 Plan 03: Editor Primitives Summary

Five props-only presentational primitives (slab, status word, four-station checklist, step list, nine-parts list) that wave-3 screens compose without restyling.

## Final props signatures
- `StatusWord({ word, text?, className?, hideMarker? })`; also exports `StatusMarker({ marker, size: 8|22|30, fill: 'cobalt'|'status', colorVar? })`
- `NextStepSlab({ sentence, explanation?, primary?: { label, onClick?, href?, busy? }, working?, ghost?: { label, href }, link?: { label, href, external? }, error?, live? })`. Priority primary > working > ghost; no `disabled` anywhere; `busy` sets aria-busy and ignores clicks.
- `Stations({ stations: StationVM[] })`
- `StepList({ steps: StepVM[], footer?, label })`
- `PartsList({ rows: HomeSectionRow[], published, hint, hrefFor? })`

## Commits
- Task 1: 9428dad3
- Task 2: dd94a8ca
- Task 3: cdbf6c7f (also the Stations strict-type fix)

## Deviations from Plan
**1. [Rule 1 - Bug] Stations indexed `stations[i - 1]` without a guard.** vitest passed; the strict `next build` failed with "possibly undefined". Fixed with optional chaining. Commit cdbf6c7f.

## Verification
New tests: 5 files' worth (20+ cases) pass. Full suite 113 files / 1053 tests green. Strict `pnpm --filter dispatch-control build` exits 0.

## Known Stubs
None.

## Self-Check: PASSED
