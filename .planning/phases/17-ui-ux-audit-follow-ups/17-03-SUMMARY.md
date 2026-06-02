---
phase: 17-ui-ux-audit-follow-ups
plan: "03"
subsystem: web/archive
tags: [pagination, ux, client-state, load-more, P17-03]
dependency_graph:
  requires: [17-01]
  provides: [archive-load-more-pagination]
  affects: [apps/web/components/archive/ArchiveList.tsx]
tech_stack:
  added: []
  patterns: [useState, useEffect-reset, slice-pagination]
key_files:
  created: []
  modified:
    - apps/web/components/archive/ArchiveList.tsx
decisions:
  - "PAGE_SIZE=10 declared as module-level const above the component (single source of truth)"
  - "useEffect resets visibleCount on [query, order] change to prevent stale window after search clear (Pitfall 3)"
  - "count paragraph updated to Showing N of M to reflect the window vs total"
  - "The non-empty branch wrapped in <> fragment so Load-more button sits outside <ul> but inside the conditional"
  - "CardSwap in archive/page.tsx receives full issues array unchanged — no page.tsx edit"
metrics:
  duration: "4 min"
  completed: "2026-06-02"
  tasks_completed: 1
  files_modified: 1
---

# Phase 17 Plan 03: Archive Load-More Pagination Summary

Client-side load-more pagination added to ArchiveList: PAGE_SIZE=10, visibleCount state, useEffect reset on search/sort change, filtered.slice(0, visibleCount) render, and a ≥44px Load-N-more button gated on hasMore.

## Objective

Add client-side "load more" pagination to ArchiveList.tsx so the archive renders the first 10 issues immediately and reveals 10 more per click, keeping the DOM bounded as the weekly Dispatch accumulates issues. No GROQ query changes, no type changes, no new npm deps.

## What Was Built

### Task 1: Add client-side load-more to ArchiveList (commit: `20b6ff9`)

Modified `apps/web/components/archive/ArchiveList.tsx`:

- Added `useEffect` to the React import (alongside existing `useMemo`, `useState`)
- Added `const PAGE_SIZE = 10` module-level constant with P17-03 comment above the component
- Added `const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)` inside the component
- Derived `const visible = filtered.slice(0, visibleCount)` and `const hasMore = filtered.length > visibleCount`
- Added `useEffect(() => { setVisibleCount(PAGE_SIZE) }, [query, order])` to reset the visible window when search query or sort order changes
- Updated count paragraph to `Showing {visible.length} of {filtered.length} {…}` (role/aria preserved)
- Changed `<ul>` map from `filtered` to `visible` (key still `issue.slug`)
- Wrapped non-empty branch in `<>` fragment; added `{hasMore && <button …>Load N more</button>}` after `<ul>`
- Load-more button: `min-h-11` touch target, all colors via `var(--color-*)` tokens, no hardcoded hex

## Verification

### Acceptance Criteria
All grep checks passed:
- `const PAGE_SIZE = 10` — present
- `visibleCount` — present
- `filtered.slice(0, visibleCount)` — present
- `setVisibleCount(PAGE_SIZE)` — present
- `hasMore` — present
- `min-h-11` — present
- `useEffect` — present
- Hardcoded hex count — 0

### Tests
- `archive-pagination.test.ts`: **6/6 GREEN** (P17-03 assertions + P17-07 dep-count guard at 17)
- Full suite: **253 passed / 6 failed** — the 6 failures are pre-existing Wave 0 RED scaffold tests for plans P17-04/05/06 (loading-skeletons: 4, about-page: 1, debug-route: 1); no regressions introduced

### Constraints Preserved
- CardSwap in `apps/web/app/archive/page.tsx` still receives the full `issues` array (file untouched)
- `QUERY_ARCHIVE` GROQ query unchanged
- `IssueBonus`/`ArchiveIssue` types unchanged
- `docs/API_CONTRACTS.md` unchanged
- `apps/web/package.json` dependency count stays 17
- No hardcoded hex — all colors use `var(--color-*)` tokens
- `≥44px` touch target (`min-h-11`) on Load-more button

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED
